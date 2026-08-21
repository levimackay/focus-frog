use tauri::State;

use crate::companion::{CompanionProfile, Personality};
use crate::db::repository;
use crate::security::{self, COMPANION_NAME_MAX_LEN};
use crate::state::{AppError, AppState};

#[tauri::command]
pub async fn get_companion_profile(
    state: State<'_, AppState>,
) -> Result<CompanionProfile, AppError> {
    let now = crate::now_time().to_rfc3339();
    let profile = state
        .db
        .run_blocking(move |conn| repository::get_companion_profile(conn, &now))
        .await?;
    Ok(profile)
}

#[tauri::command]
pub async fn update_companion(
    state: State<'_, AppState>,
    name: String,
    personality: Personality,
) -> Result<CompanionProfile, AppError> {
    security::validate_required_text("companion_name", &name, COMPANION_NAME_MAX_LEN)?;
    let trimmed = name.trim().to_string();
    let now = crate::now_time().to_rfc3339();

    let profile = state
        .db
        .run_blocking(move |conn| repository::update_companion(conn, &trimmed, personality, &now))
        .await?;
    Ok(profile)
}
