//! The `Settings` shape (contract section 6), stored as a single JSON blob
//! in the `settings` table and mirrored exactly by the TS `Settings` type.

use crate::companion::Personality;
use crate::engine::AnnoyanceProfile;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Theme {
    System,
    Light,
    Dark,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub idle_threshold_secs: u32,
    pub distraction_grace_secs: u32,
    pub ignored_threshold_secs: u32,
    pub intervention_threshold_secs: u32,
    pub recovery_confirm_secs: u32,
    pub default_annoyance_profile: AnnoyanceProfile,
    pub default_personality: Personality,
    pub app_detection_enabled: bool,
    pub launch_on_startup: bool,
    pub sound_enabled: bool,
    pub reduced_motion: bool,
    pub theme: Theme,
    pub frog_size: u32,
    pub frog_position: (f64, f64),
    pub emergency_hotkey: String,
    pub nuclear_mode_enabled: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            idle_threshold_secs: 20,
            distraction_grace_secs: 8,
            ignored_threshold_secs: 60,
            intervention_threshold_secs: 180,
            recovery_confirm_secs: 5,
            default_annoyance_profile: AnnoyanceProfile::Persistent,
            default_personality: Personality::Friendly,
            app_detection_enabled: true,
            launch_on_startup: false,
            sound_enabled: true,
            reduced_motion: false,
            theme: Theme::System,
            frog_size: 96,
            frog_position: (32.0, 32.0),
            emergency_hotkey: "CommandOrControl+Shift+Escape".to_string(),
            nuclear_mode_enabled: false,
        }
    }
}

impl Settings {
    pub fn thresholds(&self) -> crate::engine::EngineThresholds {
        crate::engine::EngineThresholds {
            idle_threshold_secs: self.idle_threshold_secs,
            distraction_grace_secs: self.distraction_grace_secs,
            ignored_threshold_secs: self.ignored_threshold_secs,
            intervention_threshold_secs: self.intervention_threshold_secs,
            recovery_confirm_secs: self.recovery_confirm_secs,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // `Theme` crosses IPC as snake_case/lowercase (ARCHITECTURE.md section
    // 12), matching the frontend's `Theme` TS union exactly.
    #[test]
    fn theme_parses_expected_snake_case_values() {
        assert_eq!(
            serde_json::from_str::<Theme>("\"system\"").unwrap(),
            Theme::System
        );
        assert_eq!(
            serde_json::from_str::<Theme>("\"light\"").unwrap(),
            Theme::Light
        );
        assert_eq!(
            serde_json::from_str::<Theme>("\"dark\"").unwrap(),
            Theme::Dark
        );
    }

    #[test]
    fn theme_rejects_unknown_or_wrong_case_values() {
        assert!(serde_json::from_str::<Theme>("\"System\"").is_err());
        assert!(serde_json::from_str::<Theme>("\"midnight\"").is_err());
        assert!(serde_json::from_str::<Theme>("\"\"").is_err());
    }

    #[test]
    fn settings_default_round_trips_through_json() {
        // The whole Settings struct is stored as one JSON blob (section 5);
        // a round-trip failure here would corrupt every user's settings row.
        let json = serde_json::to_string(&Settings::default()).unwrap();
        let restored: Settings = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.theme, Settings::default().theme);
        assert_eq!(
            restored.default_annoyance_profile,
            Settings::default().default_annoyance_profile
        );
    }
}
