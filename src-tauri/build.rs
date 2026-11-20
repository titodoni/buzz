fn main() {
    // Only the Buddy List and chat windows may use the key store (capabilities/*.json);
    // listing the commands here is what makes Tauri require that permission.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "key_store_available",
            "key_store_get",
            "key_store_set",
            "key_store_delete",
        ]),
    ))
    .expect("failed to run tauri build");
}
