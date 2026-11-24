# Design: Buzz! landing page (website/)

The owner pinned the world: a 2000s website in the spirit of the original Yahoo! Messenger download page. All art is Buzz's own; nothing of Yahoo's is used. The desktop app keeps its own skin (app/globals.css); the landing page shows that skin live in the hero demo.

## World
- A fixed 770 px page, centred on white. One column under 780 px.
- Universal header: the B! logo, "Buzz!" with "MESSENGER" letter-spaced under it, small text links on the right.
- Purple tabs with rounded tops on a 4 px purple bar. A yellow "NEW!" strip under them.
- Content lives in boxed modules: thin lilac frame, bevelled light header bar (or solid purple for the download box).
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
