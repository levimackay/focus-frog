use tauri::WebviewWindow;

/// Linux quirk: window-manager support for always-on-top/skip-taskbar
/// varies a lot by compositor; this is best-effort, same as the activity
/// provider's Wayland caveat.
pub fn apply_companion_window_style(window: &WebviewWindow) {
    let _ = window.set_skip_taskbar(true);
    let _ = window.set_always_on_top(true);
}

pub fn apply_nuclear_window_style(window: &WebviewWindow) {
    let _ = window.set_skip_taskbar(true);
    let _ = window.set_always_on_top(true);
}
