mod now_playing;

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Duration;

use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, UserAttentionType, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};

/// Path (relative to the static export root) of the chat page.
/// The friend id is appended as the `friendId` query parameter.
/// Must match `chatUrl` in lib/tauri/windows.ts.
const CHAT_PATH: &str = "chat/";
/// Query parameter carrying the friend id to the chat page.
const CHAT_QUERY_KEY: &str = "friendId";
const CHAT_LABEL_PREFIX: &str = "chat-";
const MAX_FRIEND_ID_LEN: usize = 64;
/// The main window: the Buddy List.
const MAIN_LABEL: &str = "main";
/// The "<name> is now online" toast (Req 16.4); at most one at a time.
const TOAST_LABEL: &str = "toast";
const TOAST_PATH: &str = "toast/";
const TOAST_SIZE: (u32, u32) = (260, 72);
const TOAST_MARGIN: i32 = 12;
const MAX_TOAST_TEXT_LEN: usize = 200;
/// How long a toast stays on screen (Req 16.4), counted from when it is shown.
const TOAST_DURATION: Duration = Duration::from_secs(5);
/// How long after showing the toast its real size is read back.
const TOAST_SETTLE: Duration = Duration::from_millis(250);
/// Which toast is current, so an old toast's timer can't close a newer one.
static TOAST_GENERATION: AtomicU64 = AtomicU64::new(0);
/// False when the desktop has no tray; then closing the Buddy List really closes it.
static HAS_TRAY: AtomicBool = AtomicBool::new(false);
const TRAY_ID: &str = "buzz-tray";
/// Events the shell sends to the Buddy List window.
const EVENT_SET_STATUS: &str = "buzz://set-status";
const EVENT_EXIT: &str = "buzz://exit-requested";
/// How long Exit waits for the Buddy List to go offline before quitting.
const EXIT_GRACE: Duration = Duration::from_millis(1500);

/// Accepts uuid-like ids only: non-empty, bounded, ASCII alphanumerics and dashes.
fn is_valid_friend_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= MAX_FRIEND_ID_LEN
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

/// Query flag telling a newly opened chat window that it was opened by an
/// incoming nudge, so it shakes and plays the sound on load (classic YM).
const NUDGE_QUERY: &str = "nudge=1";

/// App-relative URL of the chat page for `friend_id` (id already validated).
fn chat_url(friend_id: &str, nudge: bool) -> String {
    let base = format!("{CHAT_PATH}?{CHAT_QUERY_KEY}={friend_id}");
    if nudge {
        format!("{base}&{NUDGE_QUERY}")
    } else {
        base
    }
}

/// Percent-encodes everything but unreserved URL characters (RFC 3986).
fn percent_encode(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for b in text.bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// App-relative URL of the toast page (friend id already validated).
fn toast_url(friend_id: &str, text: &str) -> String {
    format!(
        "{TOAST_PATH}?{CHAT_QUERY_KEY}={friend_id}&text={}",
        percent_encode(text)
    )
}

/// Top-left corner for a window of `size` in the bottom-right of a work area
/// (the screen minus taskbars), clamped so it never starts off the area.
fn toast_position(
    area_pos: (i32, i32),
    area_size: (u32, u32),
    size: (u32, u32),
    margin: i32,
) -> (i32, i32) {
    let right = area_pos.0 + area_size.0 as i32;
    let bottom = area_pos.1 + area_size.1 as i32;
    let x = (right - size.0 as i32 - margin).max(area_pos.0);
    let y = (bottom - size.1 as i32 - margin).max(area_pos.1);
    (x, y)
}

fn chat_label(friend_id: &str) -> String {
    format!("{CHAT_LABEL_PREFIX}{friend_id}")
}

/// Opens (or raises) the chat window for `friend_id` in its own OS window.
///
/// - `nudge`: an incoming nudge opens it; a new window shakes on load. An
///   already open window is raised (Req 18.1) and shakes from its own channel.
/// - `focus: false`: an incoming message opens it behind the other windows
///   and flashes its taskbar entry instead of taking focus (Req 16.1).
///
/// Returns "opened" for a new window or "existing" when one was already open.
#[tauri::command]
fn open_chat_window(
    app: AppHandle,
    friend_id: String,
    nudge: Option<bool>,
    focus: Option<bool>,
) -> Result<String, String> {
    if !is_valid_friend_id(&friend_id) {
        return Err("invalid friend id".into());
    }
    let focus = focus.unwrap_or(true);
    let label = chat_label(&friend_id);
    if let Some(window) = app.get_webview_window(&label) {
        if focus {
            // Window may be minimized or hidden behind others.
            window.unminimize().map_err(|e| e.to_string())?;
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
        } else {
            window
                .request_user_attention(Some(UserAttentionType::Informational))
                .map_err(|e| e.to_string())?;
        }
        return Ok("existing".into());
    }
    let url = chat_url(&friend_id, nudge.unwrap_or(false));
    let window = WebviewWindowBuilder::new(&app, label, WebviewUrl::App(url.into()))
        .title("Buzz Chat")
        // Tall enough for the menu bar, formatting bar, and a few messages (Req 11.4, 17.1, 17.2).
        .inner_size(440.0, 420.0)
        .min_inner_size(320.0, 280.0)
        .resizable(true)
        .decorations(false)
        .transparent(true)
        .focused(focus)
        .build()
        .map_err(|e| e.to_string())?;
    if !focus {
        window
            .request_user_attention(Some(UserAttentionType::Informational))
            .map_err(|e| e.to_string())?;
    }
    Ok("opened".into())
}

/// "closed", "focused", or "unfocused": what an incoming message should do (Req 16.1, 16.2).
#[tauri::command]
fn chat_window_state(app: AppHandle, friend_id: String) -> Result<String, String> {
    if !is_valid_friend_id(&friend_id) {
        return Err("invalid friend id".into());
    }
    let Some(window) = app.get_webview_window(&chat_label(&friend_id)) else {
        return Ok("closed".into());
    };
    let focused = window.is_focused().map_err(|e| e.to_string())?;
    Ok(if focused { "focused" } else { "unfocused" }.into())
}

/// Flashes an open chat window's taskbar entry (Req 16.2).
#[tauri::command]
fn flash_chat_window(app: AppHandle, friend_id: String) -> Result<(), String> {
    if !is_valid_friend_id(&friend_id) {
        return Err("invalid friend id".into());
    }
    if let Some(window) = app.get_webview_window(&chat_label(&friend_id)) {
        window
            .request_user_attention(Some(UserAttentionType::Informational))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Shows the "<name> is now online" toast at the bottom-right of the primary
/// screen for 5 seconds; a newer toast replaces it.
#[tauri::command]
fn show_toast(app: AppHandle, friend_id: String, text: String) -> Result<(), String> {
    if !is_valid_friend_id(&friend_id) {
        return Err("invalid friend id".into());
    }
    let text: String = text.chars().take(MAX_TOAST_TEXT_LEN).collect();
    if let Some(old) = app.get_webview_window(TOAST_LABEL) {
        old.destroy().map_err(|e| e.to_string())?;
    }
    let window = WebviewWindowBuilder::new(
        &app,
        TOAST_LABEL,
        WebviewUrl::App(toast_url(&friend_id, &text).into()),
    )
    .title("Buzz")
    .inner_size(f64::from(TOAST_SIZE.0), f64::from(TOAST_SIZE.1))
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .focused(false)
    .visible(false)
    .build()
    .map_err(|e| e.to_string())?;
    // Place it by the intended size, show it, then correct the size and the
    // position by what the window system really made (Linux can enforce a
    // larger minimum, and an unshown window reports no size).
    place_bottom_right(&window, TOAST_SIZE)?;
    window.show().map_err(|e| e.to_string())?;
    window
        .set_size(tauri::LogicalSize::new(
            f64::from(TOAST_SIZE.0),
            f64::from(TOAST_SIZE.1),
        ))
        .map_err(|e| e.to_string())?;
    let generation = TOAST_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    std::thread::spawn(move || {
        // GTK applies the size asynchronously, so read it back after a moment.
        std::thread::sleep(TOAST_SETTLE);
        let _ = fit_to_actual_size(&window);
        // Close it here rather than in the page, so a page that fails to
        // load can't leave it on screen.
        std::thread::sleep(TOAST_DURATION.saturating_sub(TOAST_SETTLE));
        if TOAST_GENERATION.load(Ordering::SeqCst) == generation {
            let _ = window.destroy();
        }
    });
    Ok(())
}

/// Re-places the toast by the size the window system really gave it.
fn fit_to_actual_size(window: &tauri::WebviewWindow) -> Result<(), String> {
    let actual = window.outer_size().map_err(|e| e.to_string())?;
    if actual.width == 0 || actual.height == 0 {
        return Ok(());
    }
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let logical = (
        (f64::from(actual.width) / scale) as u32,
        (f64::from(actual.height) / scale) as u32,
    );
    if logical != TOAST_SIZE {
        place_bottom_right(window, logical)?;
    }
    Ok(())
}

/// Moves `window` (of logical `size`) to the bottom-right of the primary screen's work area.
fn place_bottom_right(window: &tauri::WebviewWindow, size: (u32, u32)) -> Result<(), String> {
    let Some(monitor) = window.primary_monitor().map_err(|e| e.to_string())? else {
        return Ok(());
    };
    let area = monitor.work_area();
    let scale = monitor.scale_factor();
    let physical = (
        (f64::from(size.0) * scale) as u32,
        (f64::from(size.1) * scale) as u32,
    );
    let margin = (f64::from(TOAST_MARGIN) * scale) as i32;
    let (x, y) = toast_position(
        (area.position.x, area.position.y),
        (area.size.width, area.size.height),
        physical,
        margin,
    );
    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(|e| e.to_string())
}

/// Swaps the tray icon to match the user's Availability (Req 16.6).
#[tauri::command]
fn set_tray_status(app: AppHandle, status: String) -> Result<(), String> {
    let (bytes, tip): (&[u8], &str) = match status.as_str() {
        "online" => (
            include_bytes!("../icons/tray/online.png"),
            "Buzz - Available",
        ),
        "busy" => (include_bytes!("../icons/tray/busy.png"), "Buzz - Busy"),
        "away" => (include_bytes!("../icons/tray/away.png"), "Buzz - Away"),
        "invisible" => (
            include_bytes!("../icons/tray/invisible.png"),
            "Buzz - Invisible",
        ),
        _ => (
            include_bytes!("../icons/tray/offline.png"),
            "Buzz - Signed out",
        ),
    };
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        return Ok(());
    };
    let image = Image::from_bytes(bytes).map_err(|e| e.to_string())?;
    tray.set_icon(Some(image)).map_err(|e| e.to_string())?;
    tray.set_tooltip(Some(tip)).map_err(|e| e.to_string())?;
    Ok(())
}

/// Quits Buzz. The Buddy List calls this after going Offline (Req 16.8).
#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_LABEL) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Tray icon and menu (Req 16.6-16.9). Linux trays (AppIndicator) don't
/// report clicks on the icon, so "Open Buzz" in the menu covers 16.9 there.
fn build_tray(app: &AppHandle) -> tauri::Result<TrayIcon> {
    let open = MenuItem::with_id(app, "open", "Open Buzz", true, None::<&str>)?;
    let available = MenuItem::with_id(app, "status:online", "Available", true, None::<&str>)?;
    let busy = MenuItem::with_id(app, "status:busy", "Busy", true, None::<&str>)?;
    let invisible = MenuItem::with_id(app, "status:invisible", "Invisible", true, None::<&str>)?;
    let exit = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &open,
            &PredefinedMenuItem::separator(app)?,
            &available,
            &busy,
            &invisible,
            &PredefinedMenuItem::separator(app)?,
            &exit,
        ],
    )?;
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(Image::from_bytes(include_bytes!(
            "../icons/tray/offline.png"
        ))?)
        .tooltip("Buzz")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "exit" => {
                // Let the Buddy List go Offline first, then quit regardless.
                let _ = app.emit_to(MAIN_LABEL, EVENT_EXIT, ());
                let app = app.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(EXIT_GRACE);
                    app.exit(0);
                });
            }
            id => {
                if let Some(status) = id.strip_prefix("status:") {
                    let _ = app.emit_to(MAIN_LABEL, EVENT_SET_STATUS, status);
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        })
        .build(app)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Some Linux desktops have no tray; Buzz still runs, without hide-to-tray.
            match build_tray(app.handle()) {
                Ok(_) => HAS_TRAY.store(true, Ordering::SeqCst),
                Err(e) => eprintln!("Buzz: no tray icon ({e}); closing the Buddy List quits"),
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the Buddy List hides it to the tray; Buzz keeps running (Req 16.7).
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == MAIN_LABEL && HAS_TRAY.load(Ordering::SeqCst) {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_chat_window,
            chat_window_state,
            flash_chat_window,
            show_toast,
            set_tray_status,
            quit_app,
            now_playing::now_playing_supported,
            now_playing::set_now_playing_enabled
        ])
        .run(tauri::generate_context!())
        .expect("error while running Buzz");
}

#[cfg(test)]
mod tests {
    use super::{chat_url, is_valid_friend_id, percent_encode, toast_position, toast_url};

    #[test]
    fn percent_encode_keeps_safe_characters_and_escapes_the_rest() {
        assert_eq!(percent_encode("Ann-B_2.x~"), "Ann-B_2.x~");
        assert_eq!(percent_encode("Ann & Co #1"), "Ann%20%26%20Co%20%231");
        assert_eq!(percent_encode("Zoë"), "Zo%C3%AB");
    }

    #[test]
    fn toast_url_carries_the_friend_and_the_escaped_text() {
        assert_eq!(
            toast_url("abc-123", "Ann & Co is now online"),
            "toast/?friendId=abc-123&text=Ann%20%26%20Co%20is%20now%20online"
        );
    }

    #[test]
    fn toast_sits_in_the_bottom_right_corner_of_the_work_area() {
        // Work area 1920x1040 at (0,0) (taskbar below), toast 260x72, 12 px margin.
        assert_eq!(
            toast_position((0, 0), (1920, 1040), (260, 72), 12),
            (1648, 956)
        );
        // A second monitor to the left of the primary one has negative x.
        assert_eq!(
            toast_position((-1280, 0), (1280, 1024), (260, 72), 12),
            (-272, 940)
        );
    }

    #[test]
    fn toast_never_goes_off_a_tiny_screen() {
        assert_eq!(toast_position((0, 0), (200, 50), (260, 72), 12), (0, 0));
    }

    #[test]
    fn chat_url_for_a_normal_open() {
        assert_eq!(chat_url("abc-123", false), "chat/?friendId=abc-123");
    }

    #[test]
    fn chat_url_for_an_incoming_nudge_asks_the_window_to_shake() {
        assert_eq!(chat_url("abc-123", true), "chat/?friendId=abc-123&nudge=1");
    }

    #[test]
    fn accepts_uuid() {
        assert!(is_valid_friend_id("123e4567-e89b-12d3-a456-426614174000"));
    }

    #[test]
    fn rejects_bad_ids() {
        assert!(!is_valid_friend_id(""));
        assert!(!is_valid_friend_id("a/b"));
        assert!(!is_valid_friend_id("a?b=c"));
        assert!(!is_valid_friend_id("../x"));
        assert!(!is_valid_friend_id(&"a".repeat(65)));
    }
}
