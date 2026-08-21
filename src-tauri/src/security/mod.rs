//! Defense-in-depth input validation. The frontend also validates these
//! fields, but every command re-validates in Rust before anything touches
//! the database.

use serde::Serialize;
use thiserror::Error;

pub const GOAL_MAX_LEN: usize = 200;
pub const SUCCESS_CRITERIA_MAX_LEN: usize = 300;
pub const JOURNAL_MAX_LEN: usize = 2000;
pub const COMPANION_NAME_MAX_LEN: usize = 40;
pub const DISTRACTING_APP_NAME_MAX_LEN: usize = 200;

pub const MIN_DURATION_SECS: u32 = 60;
pub const MAX_DURATION_SECS: u32 = 14_400;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum ValidationError {
    #[error("{field} must not be empty")]
    Empty { field: &'static str },
    #[error("{field} must be at most {max} characters (got {actual})")]
    TooLong {
        field: &'static str,
        max: usize,
        actual: usize,
    },
    #[error("duration_secs must be between {min} and {max} seconds (got {actual})")]
    DurationOutOfRange { min: u32, max: u32, actual: u32 },
}

/// Validates a required, non-empty, length-capped free-text field.
pub fn validate_required_text(
    field: &'static str,
    value: &str,
    max: usize,
) -> Result<(), ValidationError> {
    if value.trim().is_empty() {
        return Err(ValidationError::Empty { field });
    }
    validate_optional_text(field, value, max)
}

/// Validates a length-capped free-text field that may be empty (e.g. an
/// optional journal entry).
pub fn validate_optional_text(
    field: &'static str,
    value: &str,
    max: usize,
) -> Result<(), ValidationError> {
    let len = value.chars().count();
    if len > max {
        return Err(ValidationError::TooLong {
            field,
            max,
            actual: len,
        });
    }
    Ok(())
}

pub fn validate_duration_secs(duration_secs: u32) -> Result<(), ValidationError> {
    if !(MIN_DURATION_SECS..=MAX_DURATION_SECS).contains(&duration_secs) {
        return Err(ValidationError::DurationOutOfRange {
            min: MIN_DURATION_SECS,
            max: MAX_DURATION_SECS,
            actual: duration_secs,
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_goal() {
        assert!(validate_required_text("goal", "", GOAL_MAX_LEN).is_err());
        assert!(validate_required_text("goal", "   ", GOAL_MAX_LEN).is_err());
    }

    #[test]
    fn rejects_overlong_goal() {
        let long = "a".repeat(GOAL_MAX_LEN + 1);
        assert!(validate_required_text("goal", &long, GOAL_MAX_LEN).is_err());
    }

    #[test]
    fn accepts_goal_at_exact_max_len() {
        let ok = "a".repeat(GOAL_MAX_LEN);
        assert!(validate_required_text("goal", &ok, GOAL_MAX_LEN).is_ok());
    }

    #[test]
    fn optional_text_allows_empty() {
        assert!(validate_optional_text("journal_entry", "", JOURNAL_MAX_LEN).is_ok());
    }

    #[test]
    fn duration_bounds_are_inclusive() {
        assert!(validate_duration_secs(MIN_DURATION_SECS).is_ok());
        assert!(validate_duration_secs(MAX_DURATION_SECS).is_ok());
        assert!(validate_duration_secs(MIN_DURATION_SECS - 1).is_err());
        assert!(validate_duration_secs(MAX_DURATION_SECS + 1).is_err());
    }
}
