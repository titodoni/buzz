# Two-user check (automated)

Date: 2026-11-25T09:43:10.481Z  Platform: linux  App: /home/tito/buzz/src-tauri/target/debug/buzz

User A: the Buzz desktop app, driven by tauri-driver. User B: the same web files in headless Chrome.
Both use the throwaway accounts from `e2e/setup-accounts.mjs` on the hosted Supabase project.
Not judged here: the shake you see and the sound you hear, the tray, and anything only a person can notice.

Result: 12 of 12 PASS

| # | Step | Result | Notes |
| --- | --- | --- | --- |
| T1 | B opens Buzz (browser), signs in if asked, and sees A in the Buddy List | PASS | B's row for A: "E2E Ann, offline. Press Enter to chat." (3.7s) |
| T2 | A opens Buzz (desktop app), signs in if asked, and the Buddy List loads | PASS | A's row for B: "E2E Bob, online, 3 waiting. Press Enter to chat." (3.3s) |
| T3 | Each sees the other Online | PASS | A sees "E2E Bob, online, 3 waiting. Press Enter to chat."; B sees "E2E Ann, online. Press Enter to chat." (2.5s) |
| T4 | A sets Busy; B sees A Busy; A goes back to Available | PASS | busy and back seen by B (6.2s) |
| T5 | A opens a chat window with B (a real app window) | PASS | windows: 1 -> 2; key readable from Buddy List: yes, from chat: yes (2.2s) |
| T6 | A sends a message; B's Buddy List shows it waiting | PASS | B's row: "E2E Ann, online, 1 waiting. Press Enter to chat." (1.0s) |
| T7 | B opens the chat and reads A's message | PASS | message readable on B (0.5s) |
| T8 | B replies; A's open chat shows it | PASS | (0.8s) |
| T9 | A sends a Buzz!; B's chat shows BUZZ!!! | PASS | button clicked (0.9s) |
| T10 | A closes the chat window; B quits; A sees B Offline and the app still answers | PASS | A sees "E2E Bob, offline, 4 waiting. Press Enter to chat." (3.4s) |
| T11 | B opens Buzz again; A sees B Online again without freezing | PASS | A sees "E2E Bob, online, 4 waiting. Press Enter to chat."; app windows open: 2 (2.9s) |
| T12 | A opens B's chat again after B came back | PASS | opened (earlier messages not shown) (2.3s) |
