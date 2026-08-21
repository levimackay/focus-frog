use serde::Deserialize;
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::db::repository::{self, NewSession};
use crate::engine::{AnnoyanceProfile, EngineInput, FocusEngine, SessionConfig, SessionSnapshot};
use crate::security::{self, GOAL_MAX_LEN, JOURNAL_MAX_LEN, SUCCESS_CRITERIA_MAX_LEN};
use crate::state::{AppError, AppState};

#[derive(Debug, Clone, Deserialize)]
pub struct StartSessionInput {
    pub goal: String,
    pub success_criteria: String,
    pub duration_secs: u32,
    pub annoyance_profile: AnnoyanceProfile,
}

#[tauri::command]
pub async fn start_session(
    app: AppHandle,
    state: State<'_, AppState>,
    input: StartSessionInput,
) -> Result<SessionSnapshot, AppError> {
    security::validate_required_text("goal", &input.goal, GOAL_MAX_LEN)?;
    security::validate_required_text(
        "success_criteria",
        &input.success_criteria,
        SUCCESS_CRITERIA_MAX_LEN,
    )?;
    security::validate_duration_secs(input.duration_secs)?;

    // Starting a new session implicitly ends whatever was running before.
    {
        let existing = state.engine.lock().unwrap().is_some();
        if existing {
            return Err(AppError::Window(
                "a session is already active; abandon or complete it first".to_string(),
            ));
        }
    }

    let (personality, thresholds) = {
        let settings = state.settings.lock().unwrap();
        (settings.default_personality, settings.thresholds())
    };

    let session_id = Uuid::new_v4().to_string();
    let now = crate::now_time();

    let config = SessionConfig {
        session_id: session_id.clone(),
        goal: input.goal.clone(),
        success_criteria: input.success_criteria.clone(),
        duration_secs: input.duration_secs,
        annoyance_profile: input.annoyance_profile,
        thresholds,
    };
    let (engine, transition) = FocusEngine::start(config, now);

    state
        .db
        .run_blocking({
            let session_id = session_id.clone();
            let goal = input.goal.clone();
            let success_criteria = input.success_criteria.clone();
            let started_at = transition.session.started_at.clone();
            move |conn| {
                repository::insert_session(
                    conn,
                    &NewSession {
                        id: &session_id,
                        goal: &goal,
                        success_criteria: &success_criteria,
                        planned_duration_secs: input.duration_secs,
                        annoyance_profile: input.annoyance_profile,
                        personality,
                        started_at: &started_at,
                    },
                )
            }
        })
        .await?;

    *state.engine.lock().unwrap() = Some(engine);

    let session = transition.session.clone();
    crate::process_transition(&app, &state, transition, None).await?;
    crate::start_polling_loop(&app);

    Ok(session)
}

/// Also drives the engine forward with a `Tick` so that duration-based
/// completion is caught even if the frontend polls this between activity
/// samples (e.g. right at the edge of the session's planned duration).
#[tauri::command]
pub async fn get_active_session(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<SessionSnapshot>, AppError> {
    let now = crate::now_time();
    let transition = {
        let mut guard = state.engine.lock().unwrap();
        guard
            .as_mut()
            .map(|engine| engine.handle(EngineInput::Tick, now))
    };

    match transition {
        Some(transition) => {
            let session = transition.session.clone();
            crate::process_transition(&app, &state, transition, None).await?;
            Ok(Some(session))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn abandon_session(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SessionSnapshot, AppError> {
    let now = crate::now_time();
    let transition = {
        let mut guard = state.engine.lock().unwrap();
        let engine = guard.as_mut().ok_or(AppError::NoActiveSession)?;
        engine.handle(EngineInput::Abandon, now)
    };
    let session = transition.session.clone();
    crate::process_transition(&app, &state, transition, None).await?;
    Ok(session)
}

#[tauri::command]
pub async fn acknowledge_intervention(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SessionSnapshot, AppError> {
    let now = crate::now_time();
    let transition = {
        let mut guard = state.engine.lock().unwrap();
        let engine = guard.as_mut().ok_or(AppError::NoActiveSession)?;
        engine.handle(EngineInput::AcknowledgeIntervention, now)
    };
    let session = transition.session.clone();
    crate::process_transition(&app, &state, transition, None).await?;
    Ok(session)
}

#[tauri::command]
pub async fn submit_journal(
    state: State<'_, AppState>,
    entry: Option<String>,
) -> Result<SessionSnapshot, AppError> {
    if let Some(text) = &entry {
        security::validate_optional_text("journal_entry", text, JOURNAL_MAX_LEN)?;
    }

    let now = crate::now_time();
    let (session_id, snapshot) = {
        let guard = state.engine.lock().unwrap();
        let engine = guard.as_ref().ok_or(AppError::NoActiveSession)?;
        (engine.session_id().to_string(), engine.snapshot(now))
    };

    state
        .db
        .run_blocking(move |conn| {
            repository::set_journal_entry(conn, &session_id, entry.as_deref())
        })
        .await?;

    Ok(snapshot)
}

/// Also bound to the global emergency shortcut -- must always be reachable
/// even if no window has focus, and must never leave the user stuck. Always
/// abandons the session outright (the panic button), which in turn tears
/// down the nuclear overlay and companion windows via `process_transition`
/// regardless of what state the engine was in.
#[tauri::command]
pub async fn emergency_exit(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SessionSnapshot, AppError> {
    let now = crate::now_time();
    let transition = {
        let mut guard = state.engine.lock().unwrap();
        let engine = guard.as_mut().ok_or(AppError::NoActiveSession)?;
        engine.handle(EngineInput::Abandon, now)
    };
    let session = transition.session.clone();
    crate::process_transition(&app, &state, transition, None).await?;
    Ok(session)
}
