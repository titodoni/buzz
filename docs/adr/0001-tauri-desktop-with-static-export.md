# Tauri desktop app over a Next.js static export

Buzz ships as a native desktop app for Windows, Linux, and macOS, not a website. We wrap a Next.js App Router **static export** (`output: 'export'`) in **Tauri v2**, with cloud Supabase as the only backend. We picked Tauri over Electron for small installers and native webviews (WebView2, WebKitGTK, WKWebView); the cost is a Rust toolchain for builds.

## Consequences

- There is no server runtime: no Server Components, middleware, server actions, or server-side Supabase client. Auth sessions live client-side in webview storage, and every data rule is enforced by Postgres RLS and triggers.
- Dynamic route segments can't be prerendered for unknown ids, so the chat route is `/chat?friendId=<id>` rather than `/chat/[friendId]`. The Rust side's `CHAT_PATH` constant and `lib/tauri/windows.ts` must agree.
- The service-role key never ships; it is only for migrations.
