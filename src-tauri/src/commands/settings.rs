use tauri::{AppHandle, State};

use crate::db::repository;
use crate::security::{self, DISTRACTING_APP_NAME_MAX_LEN};
use crate::settings::Settings;
use crate::state::{AppError, AppState};

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Settings, AppError> {
    Ok(state.settings.lock().unwrap().clone())
}

#[tauri::command]
pub async fn update_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    settings: Settings,
) -> Result<Settings, AppError> {
    security::validate_optional_text("emergency_hotkey", &settings.emergency_hotkey, 64)?;
    if settings.emergency_hotkey.trim().is_empty() {
        return Err(AppError::Window(
            "emergency_hotkey must not be empty".to_string(),
        ));
    }
    security::validate_settings_ranges(&settings)?;

    let now = crate::now_time().to_rfc3339();
    state
        .db
        .run_blocking({
            let settings = settings.clone();
            let now = now.clone();
            move |conn| repository::update_settings(conn, &settings, &now)
        })
        .await?;

    let previous = state.settings.lock().unwrap().clone();
    *state.settings.lock().unwrap() = settings.clone();

    if previous.launch_on_startup != settings.launch_on_startup {
        crate::apply_autostart_setting(&app, settings.launch_on_startup)?;
    }
    if previous.emergency_hotkey != settings.emergency_hotkey {
        crate::apply_emergency_hotkey(&app, &settings.emergency_hotkey)?;
    }

    Ok(settings)
}

#[tauri::command]
pub async fn add_distracting_app(
    state: State<'_, AppState>,
    name: String,
) -> Result<Vec<String>, AppError> {
    security::validate_required_text("distracting_app_name", &name, DISTRACTING_APP_NAME_MAX_LEN)?;
    let trimmed = name.trim().to_string();

    state
        .db
        .run_blocking({
            let trimmed = trimmed.clone();
            move |conn| repository::add_distracting_app(conn, &trimmed)
        })
        .await?;

    state.distracting_apps.lock().unwrap().insert(trimmed);
    let mut apps: Vec<String> = state
        .distracting_apps
        .lock()
        .unwrap()
        .iter()
        .cloned()
        .collect();
    apps.sort();
    Ok(apps)
}

#[tauri::command]
pub async fn remove_distracting_app(
    state: State<'_, AppState>,
    name: String,
) -> Result<Vec<String>, AppError> {
    state
        .db
        .run_blocking({
            let name = name.clone();
            move |conn| repository::remove_distracting_app(conn, &name)
        })
        .await?;

    state.distracting_apps.lock().unwrap().remove(&name);
    let mut apps: Vec<String> = state
        .distracting_apps
        .lock()
        .unwrap()
        .iter()
        .cloned()
        .collect();
    apps.sort();
    Ok(apps)
}

#[tauri::command]
pub async fn list_distracting_apps(state: State<'_, AppState>) -> Result<Vec<String>, AppError> {
    let mut apps: Vec<String> = state
        .distracting_apps
        .lock()
        .unwrap()
        .iter()
        .cloned()
        .collect();
    apps.sort();
    Ok(apps)
}
