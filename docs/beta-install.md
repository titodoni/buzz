# Installing the Buzz beta

Thanks for testing Buzz! Download the file for your system from the beta
release page, then follow the steps below.

These beta builds are **not code signed** yet, so Windows and macOS will warn
you that they don't know who made the app. That is expected for this beta.

## Windows 10 and 11

1. Download `Buzz_<version>_x64-setup.exe`.
2. Run it. If Windows shows **"Windows protected your PC"**, click
   **More info**, then **Run anyway**.
3. Follow the installer. Buzz appears in the Start menu.

Buzz uses Microsoft Edge WebView2, which Windows 10 and 11 already have. If
it's missing, the installer downloads it.

## macOS

1. Download the `.dmg` for your Mac:
   - Apple Silicon (M1 and later): `Buzz_<version>_aarch64.dmg`
   - Intel: `Buzz_<version>_x64.dmg`
   - Not sure? Apple menu > About This Mac. "Chip: Apple M…" means Apple Silicon.
2. Open the `.dmg` and drag **Buzz** into **Applications**.
3. Open Buzz from Applications. macOS will block it the first time:
   - Open **System Settings > Privacy & Security**, scroll down to the
     message about Buzz, and click **Open Anyway**.
   - If macOS instead says **"Buzz is damaged and can't be opened"**, open
     Terminal and run:
     ```
     xattr -dr com.apple.quarantine /Applications/Buzz.app
     ```
     Then open Buzz again. This removes the download flag that macOS puts on
     apps that aren't signed by an Apple developer account.

## Linux (64-bit Intel/AMD)

Pick one:

- **Ubuntu, Debian, Mint, Pop!_OS:** download `Buzz_<version>_amd64.deb`, then
  ```
  sudo apt install ./Buzz_<version>_amd64.deb
  ```
- **Fedora, openSUSE:** download `Buzz-<version>-1.x86_64.rpm`, then
  ```
  sudo dnf install ./Buzz-<version>-1.x86_64.rpm
  ```
- **Any other distribution:** download `Buzz_<version>_amd64.AppImage`, then
  ```
  chmod +x Buzz_<version>_amd64.AppImage
  ./Buzz_<version>_amd64.AppImage
  ```
  If it says FUSE is missing, install `libfuse2` (on Ubuntu 24.04 and later:
  `sudo apt install libfuse2t64`).

Buzz shows an icon in the system tray. On GNOME you may need the
"AppIndicator and KStatusNotifierItem Support" extension to see it.

## First steps

1. Click **Get a new account** and sign up with your email and a password.
2. **Add a Friend** by their exact email address. They accept your request,
   and you appear in each other's Buddy List.
3. Double-click a friend to chat. Try **Buzz!** (Ctrl+G).

Closing the Buddy List keeps Buzz running in the tray. To quit, use the tray
icon's menu and choose **Exit**. On Linux, the tray menu's **Open Buzz**
brings the Buddy List back.

## Known limits in this beta

- **Forgot your password?** may not send a code yet.
- Only friends see each other. Your messages are not end-to-end encrypted.
- There are no automatic updates yet; install each new beta over the old one.

## Reporting a problem

Tell us what you did, what you expected, and what happened, with your system
(for example "Windows 11" or "Ubuntu 24.04") and a screenshot if you can.

## Share What I'm Playing (optional)

In Buzz, **Messenger > Share What I'm Playing** is off until you turn it on.
When it is on, your friends see the artist and title of what is playing.

- **Windows and Linux:** Buzz reads players that report to the system, such
  as Spotify and browsers. Nothing else leaves your computer.
- **macOS:** Buzz reads **Spotify and Apple Music only**. The first time,
  macOS asks to let Buzz control those apps. Choose **OK**. If you chose
  **Don't Allow**, change it in **System Settings > Privacy & Security >
  Automation**. Buzz never opens Spotify or Music by itself.
- This beta is new on Windows and macOS and has not been tested there yet.
  Tell us if your song doesn't show up.

