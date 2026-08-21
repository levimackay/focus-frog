use super::{ActivityError, ActivityProvider, RawActivity};

#[derive(Debug, Default)]
pub struct MacosActivityProvider;

impl ActivityProvider for MacosActivityProvider {
    fn sample(&self) -> Result<RawActivity, ActivityError> {
        let idle_seconds = user_idle::UserIdle::get_time()
            .map(|idle| idle.as_seconds() as f64)
            .map_err(|e| ActivityError::Idle(e.to_string()))?;

        let active_app = match active_win_pos_rs::get_active_window() {
            Ok(window) if !window.app_name.is_empty() => Some(window.app_name),
            Ok(_) => None,
            // No focused window (e.g. desktop click-through) is not an
            // error condition worth surfacing -- just no active app.
            Err(_) => None,
        };

        Ok(RawActivity {
            idle_seconds,
            active_app,
        })
    }
}
