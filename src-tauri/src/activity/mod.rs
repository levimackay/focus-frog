//! Cross-platform desktop activity sampling: idle time and foreground
//! application name only. No keylogging, no screenshots, no window content
//! inspection -- see the platform modules for the exact two calls made.

#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "macos")]
pub mod macos;
#[cfg(target_os = "windows")]
pub mod windows;

use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum ActivityError {
    #[error("failed to query system idle time: {0}")]
    Idle(String),
}

/// A raw platform observation: how long the system has been idle, and the
/// name of the foreground application (if one could be determined).
#[derive(Debug, Clone, Default)]
pub struct RawActivity {
    pub idle_seconds: f64,
    pub active_app: Option<String>,
}

pub trait ActivityProvider: Send + Sync {
    fn sample(&self) -> Result<RawActivity, ActivityError>;
}

/// The only place in this crate with an OS conditional for activity
/// sampling. Picks the platform implementation; all three wrap the same two
/// crates (`user-idle`, `active-win-pos-rs`), which are themselves
/// cross-platform under the hood.
pub fn new_provider() -> Box<dyn ActivityProvider> {
    #[cfg(target_os = "macos")]
    {
        Box::new(macos::MacosActivityProvider)
    }
    #[cfg(target_os = "windows")]
    {
        Box::new(windows::WindowsActivityProvider)
    }
    #[cfg(target_os = "linux")]
    {
        Box::new(linux::LinuxActivityProvider)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        compile_error!(
            "focus-frog activity sampling is only implemented for macOS, Windows and Linux"
        );
    }
}
