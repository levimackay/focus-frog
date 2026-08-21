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

// Engine-threshold and frog-size bounds. The frontend already clamps these
// via `<input min/max>` in SettingsScreen.tsx, but `update_settings` is a
// real IPC command and must not trust the caller -- these exist so a
// malformed or malicious `Settings` payload can't push the engine into
// degenerate behavior (e.g. thresholds so large escalation never fires) or
// grow the companion window unreasonably.
pub const MIN_IDLE_THRESHOLD_SECS: u32 = 1;
pub const MAX_IDLE_THRESHOLD_SECS: u32 = 3_600;
pub const MAX_DISTRACTION_GRACE_SECS: u32 = 600;
pub const MAX_IGNORED_THRESHOLD_SECS: u32 = 3_600;
pub const MAX_INTERVENTION_THRESHOLD_SECS: u32 = 7_200;
pub const MAX_RECOVERY_CONFIRM_SECS: u32 = 600;
pub const MIN_FROG_SIZE: u32 = 32;
pub const MAX_FROG_SIZE: u32 = 512;

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
    #[error("{field} must be between {min} and {max} (got {actual})")]
    NumberOutOfRange {
        field: &'static str,
        min: u32,
        max: u32,
        actual: u32,
    },
}

fn validate_range(
    field: &'static str,
    value: u32,
    min: u32,
    max: u32,
) -> Result<(), ValidationError> {
    if !(min..=max).contains(&value) {
        return Err(ValidationError::NumberOutOfRange {
            field,
            min,
            max,
            actual: value,
        });
    }
    Ok(())
}

/// Bound-checks every numeric field on a `Settings` payload before it's
/// persisted. Mirrors (and backstops) the `<input min/max>` clamps in
/// `SettingsScreen.tsx` -- `update_settings` is a real IPC command and must
/// not trust the caller's numbers, since values far outside these ranges
/// push the engine into degenerate behavior rather than a crash (see the
/// security audit that flagged this: out-of-range thresholds don't panic,
/// they just make escalation effectively never fire).
pub fn validate_settings_ranges(
    settings: &crate::settings::Settings,
) -> Result<(), ValidationError> {
    validate_range(
        "idle_threshold_secs",
        settings.idle_threshold_secs,
        MIN_IDLE_THRESHOLD_SECS,
        MAX_IDLE_THRESHOLD_SECS,
    )?;
    validate_range(
        "distraction_grace_secs",
        settings.distraction_grace_secs,
        0,
        MAX_DISTRACTION_GRACE_SECS,
    )?;
    validate_range(
        "ignored_threshold_secs",
        settings.ignored_threshold_secs,
        0,
        MAX_IGNORED_THRESHOLD_SECS,
    )?;
    validate_range(
        "intervention_threshold_secs",
        settings.intervention_threshold_secs,
        0,
        MAX_INTERVENTION_THRESHOLD_SECS,
    )?;
    validate_range(
        "recovery_confirm_secs",
        settings.recovery_confirm_secs,
        0,
        MAX_RECOVERY_CONFIRM_SECS,
    )?;
    validate_range(
        "frog_size",
        settings.frog_size,
        MIN_FROG_SIZE,
        MAX_FROG_SIZE,
    )?;
    Ok(())
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

    #[test]
    fn duration_zero_and_max_u32_are_out_of_range() {
        assert!(validate_duration_secs(0).is_err());
        assert!(validate_duration_secs(u32::MAX).is_err());
    }

    /// Length caps must count Unicode scalar values, not UTF-8 bytes -- a
    /// goal full of multi-byte characters (emoji, accented text, CJK) would
    /// be rejected far too early if `len()` (byte count) were used instead
    /// of `chars().count()`.
    #[test]
    fn length_cap_counts_unicode_chars_not_bytes() {
        // Each frog emoji is 4 bytes in UTF-8 but 1 `char`.
        let max_len_emoji_goal = "🐸".repeat(GOAL_MAX_LEN);
        assert_eq!(max_len_emoji_goal.chars().count(), GOAL_MAX_LEN);
        assert!(max_len_emoji_goal.len() > GOAL_MAX_LEN); // byte length is larger
        assert!(validate_required_text("goal", &max_len_emoji_goal, GOAL_MAX_LEN).is_ok());

        let over_max_emoji_goal = "🐸".repeat(GOAL_MAX_LEN + 1);
        assert!(validate_required_text("goal", &over_max_emoji_goal, GOAL_MAX_LEN).is_err());
    }

    #[test]
    fn whitespace_only_is_rejected_distinctly_from_populated_text() {
        // Various whitespace, including a non-ASCII space, must all still
        // count as "empty" after trimming.
        assert!(validate_required_text("goal", "\t\n  ", GOAL_MAX_LEN).is_err());
        assert!(validate_required_text("goal", "\u{00A0}", GOAL_MAX_LEN).is_err());
        assert!(validate_required_text("goal", " a ", GOAL_MAX_LEN).is_ok());
    }

    #[test]
    fn optional_text_at_exact_boundaries_for_every_field_cap() {
        for max in [
            SUCCESS_CRITERIA_MAX_LEN,
            JOURNAL_MAX_LEN,
            COMPANION_NAME_MAX_LEN,
            DISTRACTING_APP_NAME_MAX_LEN,
        ] {
            let at_max = "a".repeat(max);
            let over_max = "a".repeat(max + 1);
            assert!(validate_optional_text("field", &at_max, max).is_ok());
            assert!(validate_optional_text("field", &over_max, max).is_err());
        }
    }

    #[test]
    fn validation_error_reports_the_actual_length() {
        let long = "a".repeat(GOAL_MAX_LEN + 5);
        match validate_required_text("goal", &long, GOAL_MAX_LEN) {
            Err(ValidationError::TooLong { max, actual, .. }) => {
                assert_eq!(max, GOAL_MAX_LEN);
                assert_eq!(actual, GOAL_MAX_LEN + 5);
            }
            other => panic!("expected TooLong, got {other:?}"),
        }
    }

    #[test]
    fn settings_ranges_accept_defaults() {
        assert!(validate_settings_ranges(&crate::settings::Settings::default()).is_ok());
    }

    #[test]
    fn settings_ranges_reject_out_of_range_frog_size() {
        let base = crate::settings::Settings::default();
        let too_big = crate::settings::Settings {
            frog_size: MAX_FROG_SIZE + 1,
            ..base.clone()
        };
        assert!(validate_settings_ranges(&too_big).is_err());
        let too_small = crate::settings::Settings {
            frog_size: MIN_FROG_SIZE - 1,
            ..base
        };
        assert!(validate_settings_ranges(&too_small).is_err());
    }

    #[test]
    fn settings_ranges_reject_out_of_range_thresholds() {
        let base = crate::settings::Settings::default();

        let idle_too_high = crate::settings::Settings {
            idle_threshold_secs: MAX_IDLE_THRESHOLD_SECS + 1,
            ..base.clone()
        };
        assert!(validate_settings_ranges(&idle_too_high).is_err());

        let idle_zero = crate::settings::Settings {
            idle_threshold_secs: 0, // below MIN_IDLE_THRESHOLD_SECS
            ..base.clone()
        };
        assert!(validate_settings_ranges(&idle_zero).is_err());

        let intervention_too_high = crate::settings::Settings {
            intervention_threshold_secs: MAX_INTERVENTION_THRESHOLD_SECS + 1,
            ..base
        };
        assert!(validate_settings_ranges(&intervention_too_high).is_err());
    }

    #[test]
    fn settings_ranges_accept_boundary_values() {
        let base = crate::settings::Settings::default();

        let at_minimums = crate::settings::Settings {
            frog_size: MIN_FROG_SIZE,
            idle_threshold_secs: MIN_IDLE_THRESHOLD_SECS,
            distraction_grace_secs: 0,
            ignored_threshold_secs: 0,
            intervention_threshold_secs: 0,
            recovery_confirm_secs: 0,
            ..base.clone()
        };
        assert!(validate_settings_ranges(&at_minimums).is_ok());

        let at_maximums = crate::settings::Settings {
            frog_size: MAX_FROG_SIZE,
            idle_threshold_secs: MAX_IDLE_THRESHOLD_SECS,
            distraction_grace_secs: MAX_DISTRACTION_GRACE_SECS,
            ignored_threshold_secs: MAX_IGNORED_THRESHOLD_SECS,
            intervention_threshold_secs: MAX_INTERVENTION_THRESHOLD_SECS,
            recovery_confirm_secs: MAX_RECOVERY_CONFIRM_SECS,
            ..base
        };
        assert!(validate_settings_ranges(&at_maximums).is_ok());
    }
}
