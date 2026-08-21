use tauri::WebviewWindow;

/// macOS quirk: the companion frog should keep following the user across
/// Spaces/full-screen apps rather than being left behind on whatever
/// desktop it was created on.
pub fn apply_companion_window_style(window: &WebviewWindow) {
    let _ = window.set_visible_on_all_workspaces(true);
    let _ = window.set_always_on_top(true);
}

/// macOS quirk: the nuclear overlay additionally needs to ride along
/// across Spaces and full-screen apps -- it's meant to be genuinely hard
/// to dodge by switching desktops, while still never blocking Cmd+Q.
pub fn apply_nuclear_window_style(window: &WebviewWindow) {
    let _ = window.set_visible_on_all_workspaces(true);
    let _ = window.set_always_on_top(true);
}
