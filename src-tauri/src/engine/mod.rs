pub mod machine;
pub mod state;

pub use machine::FocusEngine;
pub use state::{
    ActivitySample, AnnoyanceProfile, EngineInput, EngineThresholds, EscalationLevel, FocusState,
    SessionConfig, SessionSnapshot, Time, Transition,
};
