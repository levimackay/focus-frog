//! Pure data types for the Focus Engine: states, inputs, config, and the
//! opaque `Time` value that drives every transition. Nothing in this module
//! performs I/O or reads the wall clock.

use serde::{Deserialize, Serialize};

/// The state machine's states. `Idle` is represented at the call-site by the
/// *absence* of a `FocusEngine` (see `AppState`); once a `FocusEngine` exists
/// it is always in one of the other states.
/// Serialized with serde's default (PascalCase, matching the Rust variant
/// names exactly) to match the frontend's `FocusState` TS union in
/// `src/ipc/types.ts` -- unlike `AnnoyanceProfile`/`Theme`/`StatsRange`
/// below, which the frontend expects as snake_case/lowercase.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FocusState {
    Idle,
    Focused,
    Distracted,
    Ignored,
    Intervention,
    Recovering,
    Completed,
    Abandoned,
}

impl FocusState {
    pub fn as_str(self) -> &'static str {
        match self {
            FocusState::Idle => "idle",
            FocusState::Focused => "focused",
            FocusState::Distracted => "distracted",
            FocusState::Ignored => "ignored",
            FocusState::Intervention => "intervention",
            FocusState::Recovering => "recovering",
            FocusState::Completed => "completed",
            FocusState::Abandoned => "abandoned",
        }
    }
}

/// Annoyance profile chosen for a session; caps how far escalation is
/// allowed to go.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnnoyanceProfile {
    Gentle,
    Persistent,
    Ruthless,
    Nuclear,
}

impl AnnoyanceProfile {
    pub fn as_str(self) -> &'static str {
        match self {
            AnnoyanceProfile::Gentle => "gentle",
            AnnoyanceProfile::Persistent => "persistent",
            AnnoyanceProfile::Ruthless => "ruthless",
            AnnoyanceProfile::Nuclear => "nuclear",
        }
    }
}

/// Named escalation levels, mirroring the derived `escalation_level: u8`
/// (0-4) but as a type the companion/message-bank module can match on.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EscalationLevel {
    None,
    Distracted,
    Ignored,
    Intervention,
    NuclearOverlay,
}

impl EscalationLevel {
    pub fn from_u8(value: u8) -> Self {
        match value {
            0 => EscalationLevel::None,
            1 => EscalationLevel::Distracted,
            2 => EscalationLevel::Ignored,
            3 => EscalationLevel::Intervention,
            _ => EscalationLevel::NuclearOverlay,
        }
    }
}

/// An opaque point in time, expressed as whole seconds since the Unix epoch.
/// The engine never reads the clock itself -- every `Time` value is handed
/// in by the caller, which is what makes `FocusEngine` deterministic and
/// testable without sleeping. In production the caller derives `Time` from
/// `OffsetDateTime::now_utc().unix_timestamp()`; in tests it is built with
/// arbitrary offsets via `Time::from_secs`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Time(i64);

impl Time {
    pub const fn from_secs(secs: i64) -> Self {
        Time(secs)
    }

    pub fn as_secs(self) -> i64 {
        self.0
    }

    pub fn add_secs(self, secs: i64) -> Self {
        Time(self.0 + secs)
    }

    /// Seconds elapsed from `earlier` to `self`. Negative if `self` is
    /// before `earlier`.
    pub fn since(self, earlier: Time) -> i64 {
        self.0 - earlier.0
    }

    /// Render as an RFC 3339 UTC timestamp string, for embedding in
    /// `SessionSnapshot`/DB rows. Treats the stored offset as Unix-epoch
    /// seconds, which is the convention every production caller uses.
    pub fn to_rfc3339(self) -> String {
        time::OffsetDateTime::from_unix_timestamp(self.0)
            .map(|dt| {
                dt.format(&time::format_description::well_known::Rfc3339)
                    .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
            })
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
    }
}

/// The timing knobs that drive escalation, pulled out of `Settings` at
/// session-start time so the engine never has to know about the wider
/// `Settings` type.
#[derive(Debug, Clone, Copy)]
pub struct EngineThresholds {
    pub idle_threshold_secs: u32,
    pub distraction_grace_secs: u32,
    pub ignored_threshold_secs: u32,
    pub intervention_threshold_secs: u32,
    pub recovery_confirm_secs: u32,
}

impl Default for EngineThresholds {
    fn default() -> Self {
        EngineThresholds {
            idle_threshold_secs: 20,
            distraction_grace_secs: 8,
            ignored_threshold_secs: 60,
            intervention_threshold_secs: 180,
            recovery_confirm_secs: 5,
        }
    }
}

/// Everything needed to start a new session.
#[derive(Debug, Clone)]
pub struct SessionConfig {
    pub session_id: String,
    pub goal: String,
    pub success_criteria: String,
    pub duration_secs: u32,
    pub annoyance_profile: AnnoyanceProfile,
    pub thresholds: EngineThresholds,
}

/// A single activity observation fed into the engine.
#[derive(Debug, Clone)]
pub struct ActivitySample {
    pub idle_seconds: f64,
    /// Part of the documented contract shape (ARCHITECTURE.md section 3):
    /// callers (the activity poller) populate this for logging/debugging
    /// and for `lib.rs` to attach to `distraction_events` rows. The engine
    /// itself only ever consults `is_distracting_app`, which the caller
    /// already derived from this.
    #[allow(dead_code)]
    pub active_app: Option<String>,
    /// Computed by the caller against the settings' distracting-app list.
    pub is_distracting_app: bool,
}

/// Input to `FocusEngine::handle`.
#[derive(Debug, Clone)]
pub enum EngineInput {
    Activity(ActivitySample),
    Tick,
    Abandon,
    AcknowledgeIntervention,
}

/// The externally-visible shape of a session, mirrored exactly by the
/// frontend's TS types and returned by every session command.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSnapshot {
    pub id: String,
    pub state: FocusState,
    pub escalation_level: u8,
    pub goal: String,
    pub success_criteria: String,
    pub remaining_secs: u32,
    pub distraction_count: u32,
    pub intervention_count: u32,
    pub started_at: String,
}

/// The result of every `handle()`/`start()` call.
#[derive(Debug, Clone)]
pub struct Transition {
    pub from: FocusState,
    pub to: FocusState,
    pub escalation_level: u8,
    pub session: SessionSnapshot,
}
