use tauri::{AppHandle, Manager, State};

use crate::db::repository;
use crate::state::{AppError, AppState};

#[tauri::command]
pub async fn set_frog_position(
    app: AppHandle,
    state: State<'_, AppState>,
    x: f64,
    y: f64,
) -> Result<(), AppError> {
    let settings = {
        let mut guard = state.settings.lock().unwrap();
        guard.frog_position = (x, y);
        guard.clone()
    };

    let now = crate::now_time().to_rfc3339();
    state
        .db
        .run_blocking({
            let settings = settings.clone();
            move |conn| repository::update_settings(conn, &settings, &now)
        })
        .await?;

    if let Some(companion) = app.get_webview_window(crate::COMPANION_WINDOW_LABEL) {
        let _ = companion.set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }));
    }

    Ok(())
}

#[tauri::command]
pub async fn quit_app(app: AppHandle) -> Result<(), AppError> {
    app.exit(0);
    Ok(())
}
