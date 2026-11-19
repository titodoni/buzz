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
await check("unfriend hides history (Req 3.5)", async () => { await as(A); await c.query(`update friendships set status='removed'`); await as(B); return (await c.query(`select count(*)::int n from messages`)).rows[0].n; }, 0);
await check("B may re-request after removal", async () => { await asAdmin(); await c.query(`update friendships set status='removed'`); await as(B); return (await c.query(`update friendships set status='pending', requester_id=$1, addressee_id=$2`, [B, A])).rowCount; }, 1);
await check("is_friend_of_me true for a friend", async () => { await as(A); return (await c.query(`select public.is_friend_of_me($1) f`, [B])).rows[0].f; }, true);
await check("is_friend_of_me false for a stranger", async () => { await as(A); return (await c.query(`select public.is_friend_of_me($1) f`, [C])).rows[0].f; }, false);
await c.query("rollback");
await c.end();
console.table(results);
const allPass = results.every((r) => r.ok === "PASS");
console.log(allPass ? "ALL PASS" : "SOME FAILED");
process.exit(allPass ? 0 : 1);
