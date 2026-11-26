# Design: Buzz! landing page (website/)

The owner pinned the world: a 2000s company software portal in the spirit of the original Yahoo! Messenger download page (`https://trybuzz.me/`, also served on `https://buzz.asmorodonitito.my.id/`). All art is Buzz's own; nothing of Yahoo's is used. The desktop app keeps its own skin (`app/globals.css`); the landing page showcases real captured desktop screenshots in `website/assets/screens/` alongside a switchable interactive demo (`#ymxStage`) and click-to-zoom lightbox.

## World
- A fixed 790 px portal sheet centred on a cool `#dfe3ee`–`#e8eaf2` gradient backdrop; one column under 780 px.
- Universal header: the tilted B! + smiley emblem, "Buzz!" with "MESSENGER" letter-spaced under it, and portal navigation/version metadata on the right.
- Glossy purple tabs with rounded tops on a 4 px purple bar (`Home`, `Screenshots`, `Features`, `Emoticons`, `Download`, `Help`) plus a yellow "NEW!" strip under them.
- Hero preview stage with two tabs: **Real Screenshots** (paired Chat + Buddy List captures, window view pills, zoom button) and **Interactive Demo**.
- Content lives in boxed modules: 2x2 real screenshot gallery cards, feature highlights, comparison table, emoticons grid, download table, FAQ, and sidebar System Requirements / Share / Publisher boxes.
- Links are blue and underlined; visited links turn purple; hover turns red.
- One glossy gold button with a green arrow disc is the main action. Small gold buttons for each download row.

## Colour
- Purple `#5f1f9e` (dark `#3d0f6e`) owns the chrome: tabs, headings, the download box.
- Gold `#ffe98a` to `#ffb81c` is reserved for download buttons.
- Yellow `#fffbd6` for notices, red `#c8102e` for "NEW!" and hovers, green `#2e7d1f` for ticks and "Tested".
- Body text `#222` on white.

## Type
- Verdana for body and UI (12 px, small text 11.5 px), Arial bold for big headlines. These are the era's own faces.

## Rules
- Every claim true today. Windows and Mac downloads carry "Beta, untested" until someone runs them on a real machine.
- No encryption claim (PRODUCT.md).
- Icons are drawn SVG in the app's style, never emoji.
