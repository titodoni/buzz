//! The one rule for ids that come from the webview: a UUID, exactly.

/// True for `8-4-4-4-12` hexadecimal digits (a Supabase user id), and nothing else.
pub fn is_uuid(id: &str) -> bool {
    const DASHES: [usize; 4] = [8, 13, 18, 23];
    id.len() == 36
        && id.bytes().enumerate().all(|(i, b)| {
            if DASHES.contains(&i) {
                b == b'-'
            } else {
                b.is_ascii_hexdigit()
            }
        })
}

#[cfg(test)]
mod tests {
    use super::is_uuid;

    #[test]
    fn accepts_a_uuid() {
        assert!(is_uuid("123e4567-e89b-12d3-a456-426614174000"));
        assert!(is_uuid("00000000-0000-4000-8000-00000000000A"));
    }

    #[test]
    fn refuses_everything_else() {
        assert!(!is_uuid(""));
        assert!(!is_uuid("abc-123"));
        assert!(!is_uuid("a/b"));
        assert!(!is_uuid("../x"));
        assert!(!is_uuid("123e4567e89b12d3a456426614174000----"));
        assert!(!is_uuid("123e4567-e89b-12d3-a456-42661417400g"));
        assert!(!is_uuid("123e4567-e89b-12d3-a456-4266141740000"));
        assert!(!is_uuid("123e4567-e89b-12d3-a456-426614174000/../x"));
    }
}
