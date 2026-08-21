use tauri::State;

use crate::db::repository::{self, SessionSummary, StatsRange, StatsSummary};
use crate::state::{AppError, AppState};

#[tauri::command]
pub async fn get_stats(
    state: State<'_, AppState>,
    range: StatsRange,
) -> Result<StatsSummary, AppError> {
    let now = crate::now_time().to_rfc3339();
    let summary = state
        .db
        .run_blocking(move |conn| repository::get_stats(conn, range, &now))
        .await?;
    Ok(summary)
}

#[tauri::command]
pub async fn get_recent_sessions(
    state: State<'_, AppState>,
    limit: u32,
) -> Result<Vec<SessionSummary>, AppError> {
    let limit = limit.clamp(1, 500);
    let summaries = state
        .db
        .run_blocking(move |conn| repository::get_recent_sessions(conn, limit))
        .await?;
    Ok(summaries)
}
