//! Automatic Now Playing (buzz-trigger R7): reads what the OS media layer
//! says is playing and tells the Buddy List window when it changes.
//!
//! Only the artist and title ever leave this module (R7.6). Nothing is read
//! from the OS while the user's setting is off (R7.1).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Once;
use std::time::Duration;

use tauri::{AppHandle, Emitter};

/// Event sent to the Buddy List window. Payload: `[artist | null, title]`, or `null` when nothing plays.
pub const EVENT_NOW_PLAYING: &str = "buzz://now-playing";
/// How often the local media layer is read. This is a local OS query, not a network poll.
const CHECK_EVERY: Duration = Duration::from_secs(3);
/// Longest artist or title passed on; the client cuts the joined line to 140.
const MAX_FIELD_CHARS: usize = 140;

static ENABLED: AtomicBool = AtomicBool::new(false);
static STARTED: Once = Once::new();

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Track {
    pub artist: Option<String>,
    pub title: String,
}

#[cfg_attr(
    not(any(target_os = "linux", target_os = "macos", windows)),
    allow(dead_code)
)]
/// Trims, drops control characters, and bounds the length. None when empty.
fn clean(s: &str) -> Option<String> {
    let t: String = s
        .chars()
        .filter(|c| !c.is_control())
        .take(MAX_FIELD_CHARS)
        .collect();
    let t = t.trim().to_string();
    (!t.is_empty()).then_some(t)
}

#[cfg_attr(
    not(any(target_os = "linux", target_os = "macos", windows)),
    allow(dead_code)
)]
/// Builds a Track from raw metadata; None without a usable title.
fn track_from(artist: Option<&str>, title: Option<&str>) -> Option<Track> {
    let title = clean(title?)?;
    Some(Track {
        artist: artist.and_then(clean),
        title,
    })
}

/// Reads the macOS script's one line: `artist<U+001F>title`. Anything else
/// (an error message, an empty answer) is not a track. Pure, so it is tested on every OS.
#[cfg_attr(not(any(target_os = "macos", test)), allow(dead_code))]
fn parse_script_output(raw: &str) -> Option<Track> {
    let (artist, title) = raw.split_once('\u{1f}')?;
    track_from(Some(artist), Some(title))
}

#[cfg(target_os = "linux")]
mod os {
    use super::{track_from, Track};
    use mpris::{PlaybackStatus, PlayerFinder};

    pub const SUPPORTED: bool = true;

    /// The first MPRIS player that is playing right now (Spotify, VLC, mpv, browsers).
    pub fn current(finder: &mut Option<PlayerFinder>) -> Option<Track> {
        if finder.is_none() {
            *finder = PlayerFinder::new().ok();
        }
        let players = match finder.as_ref()?.find_all() {
            Ok(p) => p,
            Err(_) => {
                // The D-Bus connection may have dropped; reconnect next time.
                *finder = None;
                return None;
            }
        };
        players.into_iter().find_map(|p| {
            if p.get_playback_status().ok()? != PlaybackStatus::Playing {
                return None;
            }
            let meta = p.get_metadata().ok()?;
            let artist = meta.artists().and_then(|a| a.first().copied());
            track_from(artist, meta.title())
        })
    }

    pub type State = Option<PlayerFinder>;

    pub fn new_state() -> State {
        None
    }
}

/// macOS: Spotify and Apple Music only, through AppleScript (buzz-trigger R7.7).
/// macOS 15.4 and later blocks the general now-playing API for third-party
/// apps, so other players cannot be read. The script asks `is running` first,
/// so reading never launches either app. The first read makes macOS ask the
/// user to allow Buzz to control those apps (the Automation prompt).
#[cfg(target_os = "macos")]
mod os {
    use super::{parse_script_output, Track};
    use std::io::Read;
    use std::process::{Command, Stdio};
    use std::time::{Duration, Instant};

    pub const SUPPORTED: bool = true;
    /// The macOS reader keeps nothing between reads.
    pub struct State;

    pub fn new_state() -> State {
        State
    }

    /// Prints `artist<U+001F>title` for the first app that is playing, else nothing.
    const SCRIPT: &str = r#"
if application "Spotify" is running then
  tell application "Spotify"
    if player state is playing then
      return (artist of current track) & (character id 31) & (name of current track)
    end if
  end tell
end if
if application "Music" is running then
  tell application "Music"
    if player state is playing then
      return (artist of current track) & (character id 31) & (name of current track)
    end if
  end tell
end if
return ""
"#;

    /// A stuck script (an app that hangs, an unanswered permission prompt) must not block the reader for long.
    const SCRIPT_TIMEOUT: Duration = Duration::from_secs(2);

    pub fn current(_: &mut State) -> Option<Track> {
        let mut child = Command::new("osascript")
            .arg("-e")
            .arg(SCRIPT)
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .ok()?;
        let started = Instant::now();
        loop {
            match child.try_wait().ok()? {
                Some(status) if status.success() => break,
                Some(_) => return None, // not allowed, or the script failed
                None if started.elapsed() > SCRIPT_TIMEOUT => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return None;
                }
                None => std::thread::sleep(Duration::from_millis(50)),
            }
        }
        let mut out = String::new();
        child.stdout.take()?.read_to_string(&mut out).ok()?;
        parse_script_output(&out)
    }
}

/// Windows: any player that reports to the system media controls (SMTC):
/// Spotify, browsers, and most music and video players (buzz-trigger R7.7).
#[cfg(windows)]
mod os {
    use super::{track_from, Track};
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSessionManager as Manager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
    };
    use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};

    pub const SUPPORTED: bool = true;

    /// Whether this thread has joined the Windows Runtime yet.
    #[derive(Default)]
    pub struct State {
        ready: bool,
    }

    pub fn new_state() -> State {
        State::default()
    }

    fn read() -> windows::core::Result<Option<Track>> {
        let manager = Manager::RequestAsync()?.join()?;
        for session in manager.GetSessions()? {
            if session.GetPlaybackInfo()?.PlaybackStatus()? != Status::Playing {
                continue;
            }
            let props = session.TryGetMediaPropertiesAsync()?.join()?;
            let artist = props.Artist()?.to_string();
            let title = props.Title()?.to_string();
            if let Some(track) = track_from(Some(&artist), Some(&title)) {
                return Ok(Some(track));
            }
        }
        Ok(None)
    }

    /// The first session that is playing right now.
    pub fn current(state: &mut State) -> Option<Track> {
        if !state.ready {
            // The reader runs on its own thread, which must join the runtime
            // before it can ask for media sessions. A failure here means the
            // thread already joined in another mode, which is fine.
            let _ = unsafe { RoInitialize(RO_INIT_MULTITHREADED) };
            state.ready = true;
        }
        read().ok().flatten()
    }
}

#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
mod os {
    use super::Track;

    pub const SUPPORTED: bool = false;
    pub fn current(_: &mut State) -> Option<Track> {
        None
    }
    pub struct State;

    pub fn new_state() -> State {
        State
    }
}

/// Which system this build reads from: "linux", "windows", "macos", or "other".
/// The app words the setting from this: on a Mac only Spotify and Apple Music are read.
#[tauri::command]
pub fn now_playing_platform() -> &'static str {
    match std::env::consts::OS {
        "linux" => "linux",
        "windows" => "windows",
        "macos" => "macos",
        _ => "other",
    }
}

/// True when this build can read what is playing.
#[tauri::command]
pub fn now_playing_supported() -> bool {
    os::SUPPORTED
}

/// Turns reading on or off. The reader thread starts on first enable and
/// stays idle (reads nothing) while disabled.
#[tauri::command]
pub fn set_now_playing_enabled(app: AppHandle, enabled: bool) {
    ENABLED.store(enabled && os::SUPPORTED, Ordering::SeqCst);
    if !enabled || !os::SUPPORTED {
        return;
    }
    STARTED.call_once(move || {
        std::thread::spawn(move || {
            let mut state = os::new_state();
            let mut last: Option<Option<Track>> = None;
            loop {
                if ENABLED.load(Ordering::SeqCst) {
                    let now = os::current(&mut state);
                    if last.as_ref() != Some(&now) {
                        let payload = now.as_ref().map(|t| (t.artist.clone(), t.title.clone()));
                        let _ = app.emit_to(crate::MAIN_LABEL, EVENT_NOW_PLAYING, payload);
                        last = Some(now);
                    }
                } else {
                    // Re-announce after re-enabling, so the client gets a fresh value.
                    last = None;
                }
                std::thread::sleep(CHECK_EVERY);
            }
        });
    });
}

#[cfg(test)]
mod tests {
    use super::{clean, parse_script_output, track_from, Track, MAX_FIELD_CHARS};

    #[test]
    fn keeps_artist_and_title() {
        assert_eq!(
            track_from(Some(" Daft Punk "), Some("One More Time")),
            Some(Track {
                artist: Some("Daft Punk".into()),
                title: "One More Time".into()
            })
        );
    }

    #[test]
    fn no_title_means_nothing_to_show() {
        assert_eq!(track_from(Some("Artist"), None), None);
        assert_eq!(track_from(Some("Artist"), Some("   ")), None);
    }

    #[test]
    fn empty_artist_is_dropped() {
        assert_eq!(track_from(Some(""), Some("Video")).unwrap().artist, None);
    }

    #[test]
    fn strips_control_characters_and_bounds_length() {
        assert_eq!(clean("a\nb\u{7}c").as_deref(), Some("abc"));
        assert_eq!(
            clean(&"x".repeat(500)).unwrap().chars().count(),
            MAX_FIELD_CHARS
        );
    }

    // The macOS reader prints "artist<US>title" (US = unit separator, U+001F),
    // so a newline inside a title cannot be mistaken for the divider.
    #[test]
    fn parses_artist_and_title_from_script_output() {
        assert_eq!(
            parse_script_output("Daft Punk\u{1f}One More Time\n"),
            Some(Track {
                artist: Some("Daft Punk".into()),
                title: "One More Time".into()
            })
        );
    }

    #[test]
    fn script_output_with_no_artist_keeps_the_title() {
        assert_eq!(
            parse_script_output("\u{1f}Podcast episode\n"),
            Some(Track {
                artist: None,
                title: "Podcast episode".into()
            })
        );
    }

    #[test]
    fn nothing_playing_gives_no_track() {
        assert_eq!(parse_script_output(""), None);
        assert_eq!(parse_script_output("\n"), None);
        assert_eq!(parse_script_output("Artist\u{1f}\n"), None);
    }

    #[test]
    fn output_without_the_divider_is_ignored() {
        // An error message or anything unexpected must never become Now Playing.
        assert_eq!(
            parse_script_output("execution error: not authorized (-1743)"),
            None
        );
    }

    #[test]
    fn a_newline_inside_the_title_is_kept_out_of_the_line() {
        assert_eq!(
            parse_script_output("A\u{1f}Part 1\nPart 2\n")
                .unwrap()
                .title,
            "Part 1Part 2"
        );
    }
}
