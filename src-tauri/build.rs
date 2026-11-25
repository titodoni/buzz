fn main() {
    // Listing any command here makes Tauri check a permission for EVERY app command,
    // so every command in `generate_handler!` (src/lib.rs) must be listed, and each
    // window gets only the ones it uses in capabilities/*.json. A command missing
    // from this list is rejected for all windows.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "open_chat_window",
            "open_preferences_window",
            "chat_window_state",
            "flash_chat_window",
            "show_toast",
            "set_tray_status",
            "quit_app",
            "now_playing_supported",
            "now_playing_platform",
            "set_now_playing_enabled",
            "key_store_available",
            "key_store_get",
            "key_store_set",
            "key_store_delete",
        ]),
    ))
    .expect("failed to run tauri build");
}
