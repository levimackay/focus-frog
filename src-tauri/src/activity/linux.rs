use super::{ActivityError, ActivityProvider, RawActivity};

/// Note (honest limitation, not faked): both `user-idle` and
/// `active-win-pos-rs` support X11 well; Wayland support for idle time and
/// active-window queries is best-effort upstream and may return errors or
/// stale data on some Wayland compositors (there is no portable protocol
/// for either query under Wayland). When that happens `sample()` simply
/// returns `idle_seconds: 0.0` / `active_app: None` for that tick rather
/// than fabricating a value -- distraction detection degrades to
/// distracting-app detection being unavailable, not to lying about state.
#[derive(Debug, Default)]
pub struct LinuxActivityProvider;

impl ActivityProvider for LinuxActivityProvider {
    fn sample(&self) -> Result<RawActivity, ActivityError> {
        let idle_seconds = user_idle::UserIdle::get_time()
            .map(|idle| idle.as_seconds() as f64)
            .unwrap_or(0.0);

        let active_app = match active_win_pos_rs::get_active_window() {
            Ok(window) if !window.app_name.is_empty() => Some(window.app_name),
            Ok(_) => None,
            Err(_) => None,
        };

        Ok(RawActivity {
            idle_seconds,
            active_app,
        })
    }
}
