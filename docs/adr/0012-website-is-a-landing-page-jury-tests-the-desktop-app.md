# The website is a landing page; the jury tests the desktop app

Buzz is a desktop app (ADR 0001), so there is no web version of Buzz to host. The site at `https://buzz.asmorodonitito.my.id` is a single static landing page on Hostinger: what Buzz is, a screenshot, one download button per system, and the install steps from `docs/beta-install.md`. It is the "live app URL" on Devpost. The jury installs the desktop app and tests it there.

The installers are built by `.github/workflows/beta-build.yml` (tauri-action, on Windows, macOS Apple Silicon and Intel, and Ubuntu 22.04) and published as a GitHub Release on `titodoni/buzz`. The landing page links to the release files for one exact tag. We picked GitHub Releases over uploading the files to Hostinger because only GitHub Actions can build the Windows and macOS installers for us, and the repo has to be public for Devpost anyway.

## Consequences

- No Vercel, and no static export of the app on the web. The landing page is plain HTML and CSS, kept apart from the app code. It holds no Supabase keys and makes no Supabase calls.
- The download links work only once the repo is public. Until then a release can be built and checked, but the jury cannot download it.
- The download links name versioned files (`Buzz_<version>_x64-setup.exe` and so on). A new release means updating the links on the landing page.
- A tag with a hyphen (`v0.1.0-beta.1`) makes a pre-release; a plain tag (`v0.1.0`) makes a normal release. The submission uses a normal release.
- The builds are not code signed. Windows SmartScreen and macOS Gatekeeper warn on first run. The landing page shows the steps around that next to the buttons, and the demo video covers a judge who does not install.
- The jury gets two test accounts that are already friends, in the private testing field on Devpost. Presence, chat and the Buzz! nudge need two people, so one account is not enough. The instructions ask for two computers, one account on each. Two copies on one computer need separate data folders (`docs/two-user-check.md`), which is a developer setup, not something to ask of a judge.
- Encryption wording on the landing page follows the product rules: nothing until Encrypted Messages pass the two-user check (ADR 0010), then only the approved sentence.
