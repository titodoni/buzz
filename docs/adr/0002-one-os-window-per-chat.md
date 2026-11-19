# One OS window per chat, no tabs

The Buddy List is the main window and every chat opens in its **own OS window** via the `open_chat_window` Tauri command. This matches classic Yahoo Messenger 6-8 (tabbed IMs only arrived in 11.5) and lets a Nudge shake the real window. We accepted the cost of multi-window coordination: each chat window has its own webview, Supabase client, and Realtime subscriptions, and windows share state only through Supabase and the shared webview storage.
