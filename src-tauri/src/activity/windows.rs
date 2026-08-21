use super::{ActivityError, ActivityProvider, RawActivity};

#[derive(Debug, Default)]
pub struct WindowsActivityProvider;

impl ActivityProvider for WindowsActivityProvider {
    fn sample(&self) -> Result<RawActivity, ActivityError> {
        let idle_seconds = user_idle::UserIdle::get_time()
            .map(|idle| idle.as_seconds() as f64)
            .map_err(|e| ActivityError::Idle(e.to_string()))?;

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
