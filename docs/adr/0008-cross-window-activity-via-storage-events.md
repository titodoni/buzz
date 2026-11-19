# Chat windows report activity through storage events

Presence is tracked only by the Buddy List window (docs/adr/0003), but users spend most of their active time in chat windows, so activity there must keep them Available. Each chat window writes a throttled timestamp to `localStorage` (`buzz:lastActivityAt`), and the Buddy List hears it through the browser `storage` event, which fires in every other window of the same origin. We chose this over Tauri cross-window events because it needs no Rust or IPC changes and works identically in the plain-browser development mode.

## Consequences

- It relies on all windows sharing one webview origin and storage, which holds for Tauri windows of one app and for same-origin browser popups.
