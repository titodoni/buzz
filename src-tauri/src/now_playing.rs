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

#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
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

#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
/// Builds a Track from raw metadata; None without a usable title.
fn track_from(artist: Option<&str>, title: Option<&str>) -> Option<Track> {
    let title = clean(title?)?;
    Some(Track {
        artist: artist.and_then(clean),
        title,
    })
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
}

#[cfg(not(target_os = "linux"))]
mod os {
    use super::Track;

    pub const SUPPORTED: bool = false;
    pub fn current(_: &mut ()) -> Option<Track> {
        None
    }
    pub type State = ();
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
            let mut state = os::State::default();
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
    use super::{clean, track_from, Track, MAX_FIELD_CHARS};

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
}
