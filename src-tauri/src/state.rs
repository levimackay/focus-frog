//! Shared application state: the DB handle, the (optional) live
//! `FocusEngine`, a write-through settings cache, and the handle to the
//! background activity-polling task.

use std::collections::HashSet;
use std::sync::Mutex;

use serde::Serialize;
use thiserror::Error;

use crate::activity::{new_provider, ActivityError, ActivityProvider};
use crate::db::{Db, DbError};
use crate::engine::FocusEngine;
use crate::security::ValidationError;
use crate::settings::Settings;

/// The top-level error type returned by every Tauri command. Serialized as
/// `{ "kind": ..., "message": ... }` so the frontend can branch on `kind`.
#[derive(Debug, Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    #[error("validation error: {0}")]
    Validation(#[from] ValidationError),
    #[error("database error: {0}")]
    Database(#[from] DbError),
    #[error("activity sampling error: {0}")]
    Activity(#[from] ActivityError),
    #[error("no active session")]
    NoActiveSession,
    #[error("window error: {0}")]
    Window(String),
}

pub struct AppState {
    pub db: Db,
    pub engine: Mutex<Option<FocusEngine>>,
    pub settings: Mutex<Settings>,
    pub distracting_apps: Mutex<HashSet<String>>,
    pub activity_provider: Box<dyn ActivityProvider>,
    /// Handle to the background 2s activity-polling task, alive only
    /// while a session is active.
    pub polling_task: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
    /// The id of the currently-open `distraction_events` row, if the
    /// engine is anywhere in the Distracted/Ignored/Intervention chain.
    pub open_distraction_event: Mutex<Option<OpenDistractionEvent>>,
    /// Monotonic counter used to vary companion message selection.
    pub message_counter: Mutex<u64>,
}

#[derive(Debug, Clone)]
pub struct OpenDistractionEvent {
    pub id: String,
    pub started_at_secs: i64,
}

impl AppState {
    pub fn new(db: Db, settings: Settings, distracting_apps: HashSet<String>) -> Self {
        AppState {
            db,
            engine: Mutex::new(None),
            settings: Mutex::new(settings),
            distracting_apps: Mutex::new(distracting_apps),
            activity_provider: new_provider(),
            polling_task: Mutex::new(None),
            open_distraction_event: Mutex::new(None),
            message_counter: Mutex::new(0),
        }
    }
}
