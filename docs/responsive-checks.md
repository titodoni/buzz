# Responsive layout checks

Requirement 11 ([requirements.md](../.kiro/specs/buzz/requirements.md)) says every
window stays usable at any size. This records what was checked and how, so a
later change can be compared against it.

## Method

Headless Chrome (driven by `puppeteer-core`, installed outside the repo) opened
each screen with an exact viewport size, took a screenshot, and measured:

- the page never scrolls sideways (`scrollWidth` equals the window width);
- every button, link, field, and menu item lies fully inside the window.

The chat window and the Buddy List need a signed-in user, so they were checked
through a temporary page that rendered the real components with sample data
(long names and status lines, a long unbroken link, a friend request). That page
was deleted afterwards. The sign-in and sign-up pages were checked as they are.
The Tauri minimum sizes are 220x400 (Buddy List) and 320x280 (chat).

## Result (all sizes: no sideways scrolling, every control inside the window)

| Window | Sizes checked |
| --- | --- |
| Chat | 320x280 (minimum), 420x360 (default), 420x300 (short), 1400x900 (wide); the pictures column is hidden at 320 wide and shown from 400 wide |
| Chat with Emoticon picker open | 320x280 |
| Buddy List | 220x400 (minimum), 260x560 (default), 1400x900 (wide); with the Help menu open at 220 wide |
| Sign in | 220x400, 260x560, 1400x900 |
| Sign up | 220x400, 260x300 |

## Found and fixed while checking

- The message box and the profile and status text fields were invisible:
  Tailwind's reset removes their border and background. They now have a base
  style that utility classes can still override.
- At 220 px the fourth menu ("Help") fell off the Buddy List menu bar. The menu
  bar now wraps onto a second line, and menus open from the bar's left edge in
  narrow windows.
- A large sign-in window showed a small card with its own title bar. It now has
  a full-width title bar with the form centered inside.

## Not checked

- Real Tauri windows. Every screenshot is Chrome, so the layout has not been
  seen in WebKitGTK (Linux), WebView2 (Windows), or WKWebView (macOS). The chat
  window relies on a chain of `height: 100%` boxes (`.ym-content` to `.ym-chat`
  to the message list); if a webview scrolls the whole window instead of the
  message list, start there. Also unchecked: dragging the edges of a transparent
  frameless window to resize it on Linux.
- The Profile page (needs a signed-in user). It uses the same frame and field
  styles as the pages above, and its picture button now has the `ym-button`
  style it was missing.
- The custom-status dialog in the Buddy List header at 220 px. It opens inside
  the narrow status column, so it cannot overflow the window but may look
  cramped.
- The right-click friend menu at 220 px (its position is clamped to the window
  in code, not by a screenshot).
- Font scaling: text sizes stay fixed at every window size.
