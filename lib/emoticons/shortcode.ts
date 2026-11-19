// Pure emoticon logic: no I/O. Art lives in public/emoticons (see scripts/gen-emoticons.mjs).

export type Token =
  | { type: "text"; value: string }
  // value = image path, source = the original matched text (e.g. ":)" or ":-O")
  | { type: "emoticon"; value: string; source: string };

export type EmoticonEntry = {
  name: string;
  shortcode: string;
  path: string;
  hidden: boolean;
};

// [shortcode, slug, name, hidden]. Slugs must match scripts/gen-emoticons.mjs.
const RAW: ReadonlyArray<readonly [string, string, string, boolean]> = [
  [":)", "smile", "Smiling", false],
  [":(", "frown", "Frowning", false],
  [";)", "wink", "Winking", false],
  [":D", "grin", "Big Grin", false],
  [";;)", "lashes", "Battling Eyelashes", false],
  [">:D<", "hug", "Big Hug", false],
  [":-/", "confused", "Confused", false],
  [":x", "love", "In Love", false],
  [':">', "blush", "Blushing", false],
  [":P", "tongue", "Tongue Out", false],
  [":-*", "kiss", "Kiss", false],
  ["=((", "brokenheart", "Broken Heart", false],
  [":-O", "surprise", "Surprise", false],
  ["X(", "angry", "Angry", false],
  [":>", "smug", "Smug", false],
  ["B-)", "cool", "Sunglasses", false],
  [":-S", "worried", "Worried", false],
  ["#:-S", "whew", "Whew!", false],
  [">:)", "devil", "Devil", false],
  [":((", "cry", "Crying", false],
  [":))", "laugh", "Laughing", false],
  [":|", "straight", "Straight Face", false],
  ["/:)", "eyebrow", "Raised Eyebrow", false],
  ["=))", "rofl", "Rolling on the Floor", false],
  ["O:-)", "angel", "Angel", false],
  [":-B", "nerd", "Nerd", false],
  ["=;", "talktohand", "Talk to the Hand", false],
  ["|-)", "sleeping", "Sleeping", false],
  ["8-|", "rollingeyes", "Rolling Eyes", false],
  [":-&", "sick", "Sick", false],
  [":-$", "donttell", "Don't Tell", false],
  ["[-(", "notalking", "No Talking", false],
  [":O)", "clown", "Clown", false],
  ["8-}", "silly", "Silly", false],
  ["<:-P", "party", "Party", false],
  ["(:|", "yawn", "Yawn", false],
  ["=P~", "drooling", "Drooling", false],
  [":-?", "thinking", "Thinking", false],
  ["#-o", "doh", "Doh!", false],
  ["=D>", "applause", "Clapping", false],
  [":-c", "callme", "Call Me", false],
  [":)>-", "peace", "Peace Sign", false],
  // Hidden: render when typed, not shown in the picker.
  [":@)", "pig", "Pig", true],
  ["3:-O", "cow", "Cow", true],
  [":(|)", "monkey", "Monkey", true],
  ["~:>", "chicken", "Chicken", true],
  ["@};-", "rose", "Rose", true],
  ["8-X", "skull", "Skull", true],
  [':-"', "whistling", "Whistling", true],
  [":D/", "dancing", "Dancing", true],
  ["~X(", "witsend", "At Wits' End", true],
  [":-L", "frustrated", "Frustrated", true],
  ["[-O<", "praying", "Praying", true],
  ["$-)", "money", "Money Eyes", true],
  [":-<", "sigh", "Sigh", true],
  [">:/", "bringit", "Bring It On", true],
  [";))", "heehee", "Hee Hee", true],
  ["@-)", "hypnotized", "Hypnotized", true],
];

const PATH_PREFIX = "/emoticons/";

/** Every emoticon in the pack, visible and hidden. */
export const EMOTICONS: readonly EmoticonEntry[] = RAW.map(
  ([shortcode, slug, name, hidden]) => ({
    name,
    shortcode,
    path: `${PATH_PREFIX}${slug}.svg`,
    hidden,
  }),
);

/** Canonical shortcode -> image path. Matching is case-insensitive in renderMessage. */
export const SHORTCODE_MAP: Record<string, string> = Object.fromEntries(
  EMOTICONS.map((e) => [e.shortcode, e.path]),
);

/** Entries shown in the picker grid (hidden ones excluded). */
export const PICKER_EMOTICONS: readonly { name: string; shortcode: string; path: string }[] =
  EMOTICONS.filter((e) => !e.hidden).map(({ name, shortcode, path }) => ({
    name,
    shortcode,
    path,
  }));

// Lowercased shortcode -> path. A Map avoids prototype-key surprises.
const LOOKUP: ReadonlyMap<string, string> = new Map(
  EMOTICONS.map((e) => [e.shortcode.toLowerCase(), e.path]),
);
const MAX_LEN = Math.max(...EMOTICONS.map((e) => e.shortcode.length));

/**
 * Split a message body into text and emoticon tokens. Longest shortcode wins
 * at each position; matching is case-insensitive. Concatenating `value` of
 * text tokens and `source` of emoticon tokens reproduces `body` exactly.
 */
export function renderMessage(body: string): Token[] {
  const tokens: Token[] = [];
  let text = "";
  let i = 0;
  while (i < body.length) {
    let matched = false;
    for (let len = Math.min(MAX_LEN, body.length - i); len >= 1; len--) {
      const source = body.slice(i, i + len);
      const path = LOOKUP.get(source.toLowerCase());
      if (path !== undefined) {
        if (text) {
          tokens.push({ type: "text", value: text });
          text = "";
        }
        tokens.push({ type: "emoticon", value: path, source });
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      text += body[i];
      i++;
    }
  }
  if (text) tokens.push({ type: "text", value: text });
  return tokens;
}

/** Insert `shortcode` at `pos` (clamped into [0, text.length]); returns new text and cursor. */
export function insertAtCursor(
  text: string,
  pos: number,
  shortcode: string,
): { text: string; pos: number } {
  const p = Number.isFinite(pos) ? Math.min(Math.max(Math.floor(pos), 0), text.length) : 0;
  return { text: text.slice(0, p) + shortcode + text.slice(p), pos: p + shortcode.length };
}
