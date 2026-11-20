// Two-user RLS checks against a real Supabase database.
// Runs everything inside one transaction and ROLLS BACK, so no test users,
// friendships, or messages are left behind.
//
// Usage (never commit the connection string):
//   SUPABASE_DB_URL='postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres' \
//     npm run test:rls
import pg from "pg";
if (!process.env.SUPABASE_DB_URL) { console.error("Set SUPABASE_DB_URL"); process.exit(1); }
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
c.on("error", e => { console.error("CLIENT ERROR", e.message); process.exit(2); });
await c.connect();
await c.query("set statement_timeout = 15000");
const A = "00000000-0000-4000-8000-00000000000a", B = "00000000-0000-4000-8000-00000000000b", C = "00000000-0000-4000-8000-00000000000c";
const results = [];
const as = async (uid) => { await c.query(`set local role authenticated`); await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: "authenticated" })]); };
const asAdmin = async () => { await c.query(`reset role`); };
// Updates name the test users: the project also holds real rows, and an
// unscoped admin update would run the triggers on them too (rolled back, but it fails).
const check = async (name, fn, expect) => {
  await c.query("savepoint s");
  let got;
  try { got = await fn(); } catch (e) { got = "ERROR: " + e.message.slice(0, 70); }
  await c.query("rollback to savepoint s");
  const ok = typeof expect === "function" ? expect(got) : String(got) === String(expect);
  results.push({ check: name, got: String(got).slice(0, 60), ok: ok ? "PASS" : "FAIL" });
};
await c.query("begin");
for (const [id, email] of [[A, "ann@buzz.test"], [B, "bob@buzz.test"], [C, "cat@buzz.test"]])
  await c.query(`insert into auth.users (id, email, aud, role, instance_id) values ($1, $2, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')`, [id, email]);
await check("signup trigger creates profile from email prefix", async () => (await c.query(`select display_name from profiles where id=$1`, [A])).rows[0]?.display_name, "ann");
await c.query(`insert into friendships (requester_id, addressee_id, status) values ($1,$2,'accepted')`, [A, B]);
await c.query(`insert into messages (sender_id, receiver_id, body) values ($1,$2,'hi bob')`, [A, B]);
await check("friend B reads A's message", async () => { await as(B); return (await c.query(`select count(*)::int n from messages`)).rows[0].n; }, 1);
await check("stranger C reads no messages", async () => { await as(C); return (await c.query(`select count(*)::int n from messages`)).rows[0].n; }, 0);
await check("stranger C sees no friendships", async () => { await as(C); return (await c.query(`select count(*)::int n from friendships`)).rows[0].n; }, 0);
await check("C cannot send to non-friend A", async () => { await as(C); await c.query(`insert into messages (sender_id, receiver_id, body) values ($1,$2,'hey')`, [C, A]); return "inserted"; }, (g) => g.startsWith("ERROR"));
await check("A cannot forge a message as B", async () => { await as(A); await c.query(`insert into messages (sender_id, receiver_id, body) values ($1,$2,'fake')`, [B, A]); return "inserted"; }, (g) => g.startsWith("ERROR"));
await check("receiver B can set read_at", async () => { await as(B); return (await c.query(`update messages set read_at=now() where receiver_id=$1`, [B])).rowCount; }, 1);
await check("receiver B cannot edit body", async () => { await as(B); await c.query(`update messages set body='edited' where receiver_id=$1`, [B]); return "updated"; }, (g) => g.startsWith("ERROR"));
await check("A cannot update B's profile", async () => { await as(A); return (await c.query(`update profiles set display_name='x' where id=$1`, [B])).rowCount; }, 0);
await check("search_users finds bob by exact email", async () => { await as(A); return (await c.query(`select display_name from search_users('bob@buzz.test')`)).rows.map(r => r.display_name).join(","); }, "bob");
await check("search_users does not match partial email", async () => { await as(A); return (await c.query(`select count(*)::int n from search_users('bob@buzz')`)).rows[0].n; }, 0);
await check("unfriend hides history (Req 3.5)", async () => { await as(A); await c.query(`update friendships set status='removed' where requester_id in ($1,$2) and addressee_id in ($1,$2)`, [A, B]); await as(B); return (await c.query(`select count(*)::int n from messages`)).rows[0].n; }, 0);
await check("B may re-request after removal", async () => { await asAdmin(); await c.query(`update friendships set status='removed' where requester_id in ($1,$2) and addressee_id in ($1,$2)`, [A, B]); await as(B); return (await c.query(`update friendships set status='pending', requester_id=$1, addressee_id=$2 where requester_id in ($1,$2) and addressee_id in ($1,$2)`, [B, A])).rowCount; }, 1);
await check("is_friend_of_me true for a friend", async () => { await as(A); return (await c.query(`select public.is_friend_of_me($1) f`, [B])).rows[0].f; }, true);
await check("is_friend_of_me false for a stranger", async () => { await as(A); return (await c.query(`select public.is_friend_of_me($1) f`, [C])).rows[0].f; }, false);
// ---- Groups and ignore list (Req 14.2-14.4, 15.1): every row belongs to its owner.
await asAdmin(); await c.query(`update friendships set status='accepted'`);
await check("A creates a group", async () => { await as(A); return (await c.query(`insert into contact_groups (owner_id, name) values ($1,'Family')`, [A])).rowCount; }, 1);
await check("A cannot create a group owned by B", async () => { await as(A); await c.query(`insert into contact_groups (owner_id, name) values ($1,'Sneaky')`, [B]); return "inserted"; }, (g) => /row-level security/.test(g));
await check("B cannot see A's groups", async () => { await asAdmin(); await c.query(`insert into contact_groups (owner_id, name) values ($1,'Family')`, [A]); await as(B); return (await c.query(`select count(*)::int n from contact_groups`)).rows[0].n; }, 0);
await check("group names are unique per owner, ignoring case", async () => { await as(A); await c.query(`insert into contact_groups (owner_id, name) values ($1,'Family')`, [A]); await c.query(`insert into contact_groups (owner_id, name) values ($1,'FAMILY')`, [A]); return "inserted"; }, (g) => /duplicate key/.test(g));
await check("'Friends' is reserved for the default group", async () => { await as(A); await c.query(`insert into contact_groups (owner_id, name) values ($1,'friends')`, [A]); return "inserted"; }, (g) => /check constraint/.test(g));
await check("A moves friend B into A's group", async () => { await as(A); const g = (await c.query(`insert into contact_groups (owner_id, name) values ($1,'Work') returning id`, [A])).rows[0].id; return (await c.query(`insert into contact_group_members (owner_id, friend_id, group_id) values ($1,$2,$3)`, [A, B, g])).rowCount; }, 1);
await check("A cannot put B into a group A doesn't own", async () => { await asAdmin(); const g = (await c.query(`insert into contact_groups (owner_id, name) values ($1,'Bobs') returning id`, [B])).rows[0].id; await as(A); await c.query(`insert into contact_group_members (owner_id, friend_id, group_id) values ($1,$2,$3)`, [A, B, g]); return "inserted"; }, (g) => /foreign key|row-level security/.test(g));
await check("deleting a group returns its friends to the default group (Req 14.3)", async () => { await as(A); const g = (await c.query(`insert into contact_groups (owner_id, name) values ($1,'Gone') returning id`, [A])).rows[0].id; await c.query(`insert into contact_group_members (owner_id, friend_id, group_id) values ($1,$2,$3)`, [A, B, g]); await c.query(`delete from contact_groups where id=$1`, [g]); return (await c.query(`select count(*)::int n from contact_group_members where owner_id=$1`, [A])).rows[0].n; }, 0);
await check("A ignores C; C cannot see that row (Req 15.7)", async () => { await as(A); await c.query(`insert into ignored_users (owner_id, ignored_id) values ($1,$2)`, [A, C]); await as(C); return (await c.query(`select count(*)::int n from ignored_users`)).rows[0].n; }, 0);
await check("A cannot file stranger C into a group (only friends)", async () => { await as(A); const g = (await c.query(`insert into contact_groups (owner_id, name) values ($1,'Strangers') returning id`, [A])).rows[0].id; await c.query(`insert into contact_group_members (owner_id, friend_id, group_id) values ($1,$2,$3)`, [A, C, g]); return "inserted"; }, (g) => /row-level security/.test(g));
// ---- Ignore list enforcement (Req 15.2, 15.4, 15.6). A ignores friend B.
const ignoreB = async () => { await as(A); await c.query(`insert into ignored_users (owner_id, ignored_id) values ($1,$2)`, [A, B]); };
await check("ignored B cannot message A (Req 15.2)", async () => { await ignoreB(); await as(B); await c.query(`insert into messages (sender_id, receiver_id, body) values ($1,$2,'hello?')`, [B, A]); return "inserted"; }, (g) => /row-level security/.test(g));
await check("A can still message B, who A ignored", async () => { await ignoreB(); await as(A); return (await c.query(`insert into messages (sender_id, receiver_id, body) values ($1,$2,'hi')`, [A, B])).rowCount; }, 1);
await check("B messages A again after A un-ignores B (Req 15.6)", async () => { await ignoreB(); await as(A); await c.query(`delete from ignored_users where owner_id=$1 and ignored_id=$2`, [A, B]); await as(B); return (await c.query(`insert into messages (sender_id, receiver_id, body) values ($1,$2,'back')`, [B, A])).rowCount; }, 1);
await check("ignored C cannot send A a friend request (Req 15.4)", async () => { await as(A); await c.query(`insert into ignored_users (owner_id, ignored_id) values ($1,$2)`, [A, C]); await as(C); await c.query(`insert into friendships (requester_id, addressee_id, status) values ($1,$2,'pending')`, [C, A]); return "inserted"; }, (g) => /row-level security/.test(g));
await check("ignored B cannot re-request A after removal", async () => { await ignoreB(); await asAdmin(); await c.query(`update friendships set status='removed' where requester_id in ($1,$2) and addressee_id in ($1,$2)`, [A, B]); await as(B); await c.query(`update friendships set status='pending', requester_id=$1, addressee_id=$2 where requester_id in ($1,$2) and addressee_id in ($1,$2)`, [B, A]); return "updated"; }, (g) => /request not allowed/.test(g));
await check("is_ignored_by tells B that A ignores B", async () => { await ignoreB(); await as(B); return (await c.query(`select public.is_ignored_by($1) x`, [A])).rows[0].x; }, true);
await check("ignorers_of_me lists A for B, nothing for C", async () => { await ignoreB(); await as(B); const forB = (await c.query(`select count(*)::int n from public.ignorers_of_me()`)).rows[0].n; await as(C); const forC = (await c.query(`select count(*)::int n from public.ignorers_of_me()`)).rows[0].n; return `${forB},${forC}`; }, "1,0");
await check("is_ignored_by can't read someone else's list: C asks about A, who ignores B", async () => { await ignoreB(); await as(C); return (await c.query(`select public.is_ignored_by($1) x`, [A])).rows[0].x; }, false);
await check("is_ignored_by is false for a malformed id", async () => { await as(B); return (await c.query(`select public.is_ignored_by('not-a-uuid') x`)).rows[0].x; }, false);
// Message formatting (Req 17.2, 17.4): the CHECK and the receipt guard.
const fmt = (o) => JSON.stringify({ font: "Verdana", size: 14, color: "#cc0000", bold: true, italic: false, underline: false, ...o });
const sendFormatted = async (f) => { await as(A); return (await c.query(`insert into messages (sender_id, receiver_id, body, format) values ($1,$2,'styled',$3::jsonb)`, [A, B, f])).rowCount; };
await check("A sends a message with an allowed format", async () => sendFormatted(fmt({})), 1);
await check("format rejects a font Buzz doesn't offer", async () => sendFormatted(fmt({ font: "Comic Sans MS" })), (g) => /check constraint/.test(g));
await check("format rejects size 25", async () => sendFormatted(fmt({ size: 25 })), (g) => /check constraint/.test(g));
await check("format rejects a fractional size", async () => sendFormatted(fmt({ size: 12.5 })), (g) => /check constraint/.test(g));
await check("format rejects a color that isn't #rrggbb", async () => sendFormatted(fmt({ color: "red;background:url(x)" })), (g) => /check constraint/.test(g));
await check("format rejects a format with keys missing", async () => sendFormatted(JSON.stringify({ size: 12 })), (g) => /check constraint/.test(g));
await check("format rejects an extra key", async () => sendFormatted(fmt({ background: "#000000" })), (g) => /check constraint/.test(g));
await check("receiver B cannot change a message's format", async () => { await as(B); await c.query(`update messages set format=$2::jsonb where receiver_id=$1`, [B, fmt({ size: 24 })]); return "updated"; }, (g) => g.startsWith("ERROR"));
// ---- Privacy hardening (migration 20250101001400): strangers see no one, avatars are pinned.
const HOST = "https://mkeozqwudranxrdferai.supabase.co/storage/v1/object/public/avatars/";
const profileCount = async (uid, target) => { await as(uid); return (await c.query(target ? `select count(*)::int n from profiles where id=$1` : `select count(*)::int n from profiles`, target ? [target] : [])).rows[0].n; };
await check("stranger C lists only their own profile", async () => profileCount(C), 1);
await check("friend B reads friend A's profile", async () => profileCount(B, A), 1);
await check("pending requester's profile is visible to the addressee", async () => { await asAdmin(); await c.query(`update friendships set status='pending', requester_id=$1, addressee_id=$2 where requester_id in ($1,$2) and addressee_id in ($1,$2)`, [A, B]); return profileCount(B, A); }, 1);
await check("a removed friend's profile is hidden", async () => { await asAdmin(); await c.query(`update friendships set status='removed' where requester_id in ($1,$2) and addressee_id in ($1,$2)`, [A, B]); return profileCount(B, A); }, 0);
await check("A still reads the profile of someone on A's Ignore List", async () => { await as(A); await c.query(`insert into ignored_users (owner_id, ignored_id) values ($1,$2)`, [A, C]); return profileCount(A, C); }, 1);
await check("search_users still finds a stranger by name", async () => { await as(C); return (await c.query(`select count(*)::int n from search_users('ann')`)).rows[0].n; }, 1);
await check("C can set an avatar in C's own folder", async () => { await as(C); return (await c.query(`update profiles set avatar_url=$2 where id=$1`, [C, `${HOST}${C}/x.png`])).rowCount; }, 1);
await check("C cannot set an avatar in A's folder", async () => { await as(C); await c.query(`update profiles set avatar_url=$2 where id=$1`, [C, `${HOST}${A}/x.png`]); return "updated"; }, (g) => /check constraint/.test(g));
await check("C cannot point avatar_url at another site", async () => { await as(C); await c.query(`update profiles set avatar_url='https://evil.example/x.png' where id=$1`, [C]); return "updated"; }, (g) => /check constraint/.test(g));
await check("nobody can list the avatars bucket", async () => { await asAdmin(); await c.query(`insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${A}/t.png`]); await as(C); return (await c.query(`select count(*)::int n from storage.objects where bucket_id='avatars'`)).rows[0].n; }, 0);
// ---- Public keys (migration 20250101001500): friends read, nobody else, only the owner writes.
const K1 = "A".repeat(43), K2 = "B".repeat(43);
await asAdmin(); await c.query(`update friendships set status='accepted'`); await c.query(`insert into user_keys (user_id, public_key) values ($1,$2)`, [A, K1]);
await check("friend B reads A's public key", async () => { await as(B); return (await c.query(`select count(*)::int n from user_keys where user_id=$1`, [A])).rows[0].n; }, 1);
await check("stranger C reads no public keys", async () => { await as(C); return (await c.query(`select count(*)::int n from user_keys`)).rows[0].n; }, 0);
await check("C cannot write a key for A", async () => { await as(C); await c.query(`insert into user_keys (user_id, public_key) values ($1,$2)`, [A, K2]); return "inserted"; }, (g) => /row-level security|duplicate key/.test(g));
await check("C can write C's own key", async () => { await as(C); return (await c.query(`insert into user_keys (user_id, public_key) values ($1,$2)`, [C, K2])).rowCount; }, 1);
await check("a key of the wrong shape is refused", async () => { await as(C); await c.query(`insert into user_keys (user_id, public_key) values ($1,'short')`, [C]); return "inserted"; }, (g) => /check constraint/.test(g));
await check("friend B cannot replace A's key", async () => { await as(B); return (await c.query(`update user_keys set public_key=$2 where user_id=$1`, [A, K2])).rowCount; }, 0);
await check("friend B cannot delete A's key", async () => { await as(B); return (await c.query(`delete from user_keys where user_id=$1`, [A])).rowCount; }, 0);
await check("A can replace A's own key", async () => { await as(A); return (await c.query(`update user_keys set public_key=$2 where user_id=$1`, [A, K2])).rowCount; }, 1);
await check("a removed friend no longer reads the key", async () => { await asAdmin(); await c.query(`update friendships set status='removed' where requester_id in ($1,$2) and addressee_id in ($1,$2)`, [A, B]); await as(B); return (await c.query(`select count(*)::int n from user_keys where user_id=$1`, [A])).rows[0].n; }, 0);
// ---- Encrypted Messages (migrations 20250101001600 to 20250101001602): shape rules and receipts.
const K = "A".repeat(43);
await asAdmin(); await c.query(`update friendships set status='accepted'`);
const sendEnc = async (cols) => { await as(A); const keys = Object.keys(cols); return (await c.query(`insert into messages (sender_id, receiver_id, ${keys.join(",")}) values ($1,$2,${keys.map((_, i) => "$" + (i + 3)).join(",")})`, [A, B, ...keys.map(k => cols[k])])).rowCount; };
await check("an encrypted message with two copies and a sender key is accepted", async () => sendEnc({ encrypted: true, cipher_receiver: "x", cipher_sender: "y", sender_public_key: K }), 1);
await check("an encrypted message with a readable body is refused", async () => sendEnc({ encrypted: true, cipher_receiver: "x", cipher_sender: "y", sender_public_key: K, body: "leak" }), (g) => /check constraint/.test(g));
await check("an encrypted message with one copy is refused", async () => sendEnc({ encrypted: true, cipher_receiver: "x", sender_public_key: K }), (g) => /check constraint/.test(g));
await check("an encrypted message without a sender key is refused", async () => sendEnc({ encrypted: true, cipher_receiver: "x", cipher_sender: "y" }), (g) => /check constraint/.test(g));
await check("a cipher over 6000 characters is refused", async () => sendEnc({ encrypted: true, cipher_receiver: "x".repeat(6001), cipher_sender: "y", sender_public_key: K }), (g) => /check constraint/.test(g));
await check("a plaintext message carrying a cipher is refused", async () => sendEnc({ body: "hi", cipher_receiver: "x" }), (g) => /check constraint/.test(g));
await check("receiver B cannot edit a cipher or clear the encrypted flag", async () => { await asAdmin(); await c.query(`insert into messages (id, sender_id, receiver_id, encrypted, cipher_receiver, cipher_sender, sender_public_key) values (gen_random_uuid(), $1,$2,true,'x','y',$3)`, [A, B, K]); await as(B); await c.query(`update messages set cipher_receiver='tampered' where receiver_id=$1 and encrypted`, [B]); return "updated"; }, (g) => g.startsWith("ERROR"));
await check("receiver B can still set read_at on an encrypted message", async () => { await asAdmin(); await c.query(`insert into messages (id, sender_id, receiver_id, encrypted, cipher_receiver, cipher_sender, sender_public_key) values (gen_random_uuid(), $1,$2,true,'x','y',$3)`, [A, B, K]); await as(B); return (await c.query(`update messages set read_at=now() where receiver_id=$1 and encrypted`, [B])).rowCount; }, (g) => Number(g) >= 1);
await c.query("rollback");
await c.end();
console.table(results);
const allPass = results.every((r) => r.ok === "PASS");
console.log(allPass ? "ALL PASS" : "SOME FAILED");
process.exit(allPass ? 0 : 1);
