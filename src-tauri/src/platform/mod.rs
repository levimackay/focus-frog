//! Per-OS window quirks, isolated here so business logic in `lib.rs` never
//! has an inline `cfg!` block. Each function is a no-op stub on platforms
//! where no extra native call is needed beyond what `WebviewWindowBuilder`
//! already configures cross-platform.

#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "macos")]
pub mod macos;
#[cfg(target_os = "windows")]
pub mod windows;

use tauri::WebviewWindow;

/// Applies platform-specific quirks to the companion window (the small
/// always-on-top frog window) after it's built.
pub fn apply_companion_window_style(window: &WebviewWindow) {
    #[cfg(target_os = "macos")]
    macos::apply_companion_window_style(window);
    #[cfg(target_os = "windows")]
    windows::apply_companion_window_style(window);
    #[cfg(target_os = "linux")]
    linux::apply_companion_window_style(window);
}

/// Applies platform-specific quirks to the nuclear-mode overlay window.
pub fn apply_nuclear_window_style(window: &WebviewWindow) {
    #[cfg(target_os = "macos")]
    macos::apply_nuclear_window_style(window);
    #[cfg(target_os = "windows")]
    windows::apply_nuclear_window_style(window);
    #[cfg(target_os = "linux")]
    linux::apply_nuclear_window_style(window);
}
