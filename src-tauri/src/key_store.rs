//! Keeps each account's Message private key in the operating system's
//! keychain (buzz-encryption E1.2, ADR 0010): Keychain Services on macOS,
//! Credential Manager on Windows, the Secret Service (gnome-keyring, KWallet)
//! on Linux.
//!
//! There is no file fallback. If the keychain cannot be used, `key_store_available`
//! says so and the app keeps encryption off instead of storing the key somewhere weaker.
//! The key itself is never written to a log or to an error message.

use keyring::{Entry, Error};

const SERVICE: &str = "app.buzz.desktop";
/// A base64url X25519 private key is 43 characters; leave room, refuse anything odd.
const MAX_KEY_CHARS: usize = 128;

/// Account ids are Supabase user ids (UUIDs); nothing else is accepted as a keychain name.
fn valid_account(account: &str) -> bool {
    account.len() == 36 && account.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

/// Keys are base64url text without padding.
fn valid_key(key: &str) -> bool {
    !key.is_empty()
        && key.len() <= MAX_KEY_CHARS
        && key
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn entry(account: &str) -> Result<Entry, String> {
    if !valid_account(account) {
        return Err("invalid account".into());
    }
    Entry::new(SERVICE, account).map_err(|_| "keychain unavailable".to_string())
}

/// True when this computer has a usable keychain.
#[tauri::command]
pub fn key_store_available() -> bool {
    Entry::store_status().is_ok()
}

/// The stored private key for `account`, or `None` if there is none yet.
#[tauri::command]
pub fn key_store_get(account: String) -> Result<Option<String>, String> {
    match entry(&account)?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(Error::NoEntry) => Ok(None),
        Err(_) => Err("keychain read failed".into()),
    }
}

/// Stores the private key for `account`, replacing any earlier one.
#[tauri::command]
pub fn key_store_set(account: String, key: String) -> Result<(), String> {
    if !valid_key(&key) {
        return Err("invalid key".into());
    }
    entry(&account)?
        .set_password(&key)
        .map_err(|_| "keychain write failed".to_string())
}

/// Removes the stored key for `account`. Missing is not an error.
#[tauri::command]
pub fn key_store_delete(account: String) -> Result<(), String> {
    match entry(&account)?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(_) => Err("keychain delete failed".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_a_uuid_account() {
        assert!(valid_account("00000000-0000-4000-8000-00000000000a"));
    }

    #[test]
    fn refuses_other_account_names() {
        assert!(!valid_account(""));
        assert!(!valid_account("ann"));
        assert!(!valid_account("00000000-0000-4000-8000-00000000000g"));
        assert!(!valid_account("00000000-0000-4000-8000-00000000000a/../x"));
    }

    #[test]
    fn accepts_a_base64url_key() {
        assert!(valid_key("AbC-_123"));
        assert!(valid_key(&"a".repeat(43)));
    }

    #[test]
    fn refuses_odd_keys() {
        assert!(!valid_key(""));
        assert!(!valid_key("has space"));
        assert!(!valid_key("pad=="));
        assert!(!valid_key("new\nline"));
        assert!(!valid_key(&"a".repeat(MAX_KEY_CHARS + 1)));
    }

    /// Needs a real keychain, so it is skipped by default.
    /// Run: `cargo test key_store -- --ignored`
    #[test]
    #[ignore]
    fn round_trip_with_the_real_keychain() {
        let account = "00000000-0000-4000-8000-0000000000f0".to_string();
        assert!(key_store_available());
        key_store_delete(account.clone()).unwrap();
        assert_eq!(key_store_get(account.clone()).unwrap(), None);
        key_store_set(account.clone(), "test-key_ABC123".into()).unwrap();
        assert_eq!(
            key_store_get(account.clone()).unwrap().as_deref(),
            Some("test-key_ABC123")
        );
        key_store_set(account.clone(), "second-key".into()).unwrap();
        assert_eq!(
            key_store_get(account.clone()).unwrap().as_deref(),
            Some("second-key")
        );
        key_store_delete(account.clone()).unwrap();
        assert_eq!(key_store_get(account).unwrap(), None);
    }
}
