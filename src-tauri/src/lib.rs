use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// Path (relative to the static export root) of the chat page.
/// The friend id is appended as the `friendId` query parameter.
/// Single source of truth: align this with the Next.js static-export
/// approach for dynamic chat routes (e.g. `chat/index.html` with
/// `trailingSlash`, or a generated `chat/<id>` page).
const CHAT_PATH: &str = "chat/";

/// Query parameter carrying the friend id to the chat page.
const CHAT_QUERY_KEY: &str = "friendId";

const CHAT_LABEL_PREFIX: &str = "chat-";
const MAX_FRIEND_ID_LEN: usize = 64;

/// Accepts uuid-like ids only: non-empty, bounded, ASCII alphanumerics and dashes.
fn is_valid_friend_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= MAX_FRIEND_ID_LEN
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

/// Opens (or focuses) the chat window for `friend_id` in its own OS window.
#[tauri::command]
fn open_chat_window(app: AppHandle, friend_id: String) -> Result<(), String> {
    if !is_valid_friend_id(&friend_id) {
        return Err("invalid friend id".into());
    }

    let label = format!("{CHAT_LABEL_PREFIX}{friend_id}");

    if let Some(window) = app.get_webview_window(&label) {
        // Window may be minimized or hidden behind others.
        window.unminimize().map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let url = format!("{CHAT_PATH}?{CHAT_QUERY_KEY}={friend_id}");
    WebviewWindowBuilder::new(&app, label, WebviewUrl::App(url.into()))
        .title("Buzz Chat")
        .inner_size(420.0, 360.0)
        .min_inner_size(320.0, 280.0)
        .resizable(true)
        .decorations(false)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_chat_window])
        .run(tauri::generate_context!())
        .expect("error while running Buzz");
}

#[cfg(test)]
mod tests {
    use super::is_valid_friend_id;

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
