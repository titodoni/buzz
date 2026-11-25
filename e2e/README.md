# Two-user check (automated)

`two-user.mjs` runs two people against the hosted Supabase project:

- **A** in the real Buzz desktop app, driven through `tauri-driver` (Linux) or
  `msedgedriver` (Windows). Its chat
  windows are real app windows.
- **B** in headless Chrome, using the same web files (`out/`).

Steps: both see each other Online, A goes Busy and back, A opens a chat
window, messages both ways (encrypted and decrypted), a Buzz!, B quits and comes
back while A's app keeps answering, and A opens the chat again. The result goes
to `e2e/report.md`; screenshots of a failed step go to `e2e/out/`.

It does not judge the shake you see, the sound you hear, the tray, or the
installers. Those still need a person (`docs/test-report-v0.1.3.md`).

## Linux (this computer)

One-time setup:

```sh
sudo apt install webkitgtk-webdriver xvfb
cargo install tauri-driver --locked
node e2e/setup-accounts.mjs      # two throwaway accounts, logins in .env.e2e.local
```

Each run (close any running Buzz first, it is single instance):

```sh
npm run tauri build -- --debug --no-bundle
npm run test:e2e
```

A runs on a private screen (Xvfb `:99`) but uses your real keychain, where it
keeps its test key. Both users keep a profile in `e2e/.profiles/`, like a real
user's saved sign-in. `E2E_FRESH=1` starts both over; then also make new
accounts (delete `.env.e2e.local` and run the setup again), because the old
messages were sent with the old keys.

## Windows

Run the **e2e** workflow from the Actions tab. It builds the app on a Windows
runner, makes two new throwaway accounts, runs the check, and attaches the
report and screenshots to the run.
