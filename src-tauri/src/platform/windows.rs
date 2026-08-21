use tauri::WebviewWindow;

/// Windows quirk: keep the companion off the taskbar and Alt+Tab list --
/// it's a floating companion, not a real application window.
pub fn apply_companion_window_style(window: &WebviewWindow) {
    let _ = window.set_skip_taskbar(true);
    let _ = window.set_always_on_top(true);
}

pub fn apply_nuclear_window_style(window: &WebviewWindow) {
    let _ = window.set_skip_taskbar(true);
    let _ = window.set_always_on_top(true);
}
