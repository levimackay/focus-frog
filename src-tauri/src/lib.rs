mod activity;
mod commands;
mod companion;
mod db;
mod engine;
mod platform;
mod security;
mod settings;
mod state;

use std::collections::HashSet;
use std::time::Duration;

use tauri::menu::MenuBuilder;
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as AutostartManagerExt};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use time::OffsetDateTime;
use uuid::Uuid;

use companion::MessageBank;
use db::{repository, Db};
use engine::{ActivitySample, EngineInput, EscalationLevel, FocusState, Time, Transition};
use state::{AppError, AppState};

pub(crate) const MAIN_WINDOW_LABEL: &str = "main";
pub(crate) const COMPANION_WINDOW_LABEL: &str = "companion";
pub(crate) const NUCLEAR_WINDOW_LABEL: &str = "nuclear";

/// The engine never reads the clock itself; this is the single place in
/// production code that converts "now" into the opaque `Time` it expects.
pub(crate) fn now_time() -> Time {
    Time::from_secs(OffsetDateTime::now_utc().unix_timestamp())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            setup(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the main window hides it rather than quitting -- the
            // tray's "Quit" item (or `window::quit_app`) is the actual
            // exit path. Companion/nuclear windows are ephemeral and close
            // normally; neither ever intercepts app-level quit.
            if window.label() == MAIN_WINDOW_LABEL {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::session::start_session,
            commands::session::get_active_session,
            commands::session::abandon_session,
            commands::session::acknowledge_intervention,
            commands::session::submit_journal,
            commands::session::emergency_exit,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::add_distracting_app,
            commands::settings::remove_distracting_app,
            commands::settings::list_distracting_apps,
            commands::companion::get_companion_profile,
            commands::companion::update_companion,
            commands::stats::get_stats,
            commands::stats::get_recent_sessions,
            commands::window::set_frog_position,
            commands::window::quit_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.handle().clone();

    let data_dir = app_handle.path().app_data_dir()?;
    std::fs::create_dir_all(&data_dir)?;
    let db = Db::open(&data_dir.join("focus-frog.sqlite3"))?;

    let (settings, distracting_apps) = {
        let conn = db.pool().get()?;
        let settings = repository::get_settings(&conn)?;
        let apps: HashSet<String> = repository::list_distracting_apps(&conn)?
            .into_iter()
            .collect();
        (settings, apps)
    };

    apply_autostart_setting(&app_handle, settings.launch_on_startup)?;
    let hotkey = settings.emergency_hotkey.clone();

    app.manage(AppState::new(db, settings, distracting_apps));

    apply_emergency_hotkey(&app_handle, &hotkey)?;
    build_tray(&app_handle)?;

    Ok(())
}

// ---------------------------------------------------------------------
// Autostart / global shortcut
// ---------------------------------------------------------------------

pub(crate) fn apply_autostart_setting(app: &AppHandle, enabled: bool) -> Result<(), AppError> {
    let manager = app.autolaunch();
    let result = if enabled {
        manager.enable()
    } else {
        manager.disable()
    };
    result.map_err(|e| AppError::Window(format!("autostart error: {e}")))
}

pub(crate) fn apply_emergency_hotkey(app: &AppHandle, hotkey: &str) -> Result<(), AppError> {
    let global_shortcut = app.global_shortcut();
    // Best-effort: clear whatever was registered before (e.g. the default
    // on first run, or the previous setting on a change).
    let _ = global_shortcut.unregister_all();

    let app_handle = app.clone();
    global_shortcut
        .on_shortcut(hotkey, move |_app, _shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            let app_handle = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                let state = app_handle.state::<AppState>();
                if let Err(e) = commands::session::emergency_exit(app_handle.clone(), state).await {
                    eprintln!("focus-frog: emergency hotkey handler failed: {e}");
                }
            });
        })
        .map_err(|e| {
            AppError::Window(format!(
                "failed to register emergency hotkey '{hotkey}': {e}"
            ))
        })
}

// ---------------------------------------------------------------------
// System tray
// ---------------------------------------------------------------------

fn build_tray(app: &AppHandle) -> Result<(), AppError> {
    let menu = MenuBuilder::new(app)
        .text("show_companion", "Show Companion")
        .text("hide_companion", "Hide Companion")
        .separator()
        .text("start_session", "Start Session…")
        .text("abandon_session", "Abandon Session")
        .separator()
        .text("quit", "Quit Focus Frog")
        .build()
        .map_err(|e| AppError::Window(e.to_string()))?;

    let mut builder = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(true)
        .tooltip("Focus Frog")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show_companion" => {
                if let Some(w) = app.get_webview_window(COMPANION_WINDOW_LABEL) {
                    let _ = w.show();
                }
            }
            "hide_companion" => {
                if let Some(w) = app.get_webview_window(COMPANION_WINDOW_LABEL) {
                    let _ = w.hide();
                }
            }
            "start_session" => {
                if let Some(w) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "abandon_session" => {
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    let state = app_handle.state::<AppState>();
                    let _ = commands::session::abandon_session(app_handle.clone(), state).await;
                });
            }
            "quit" => app.exit(0),
            _ => {}
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    builder
        .build(app)
        .map_err(|e| AppError::Window(e.to_string()))?;
    Ok(())
}

// ---------------------------------------------------------------------
// Companion / nuclear window management
// ---------------------------------------------------------------------

/// Extra height reserved above the frog sprite so a popped-up speech
/// bubble (see `SpeechBubble.css`) has room to render without clipping at
/// the window edge. The sprite itself always occupies the bottom
/// `sprite_side x sprite_side` square of the window -- see
/// `start_companion_hit_test_loop`, which relies on that invariant.
const COMPANION_BUBBLE_HEADROOM: f64 = 140.0;

fn create_companion_window(app: &AppHandle) -> Result<(), AppError> {
    if app.get_webview_window(COMPANION_WINDOW_LABEL).is_some() {
        return Ok(());
    }
    let (frog_size, position) = {
        let state = app.state::<AppState>();
        let settings = state.settings.lock().unwrap();
        (settings.frog_size, settings.frog_position)
    };
    let sprite_side = frog_size as f64 + 48.0;

    let window = WebviewWindowBuilder::new(
        app,
        COMPANION_WINDOW_LABEL,
        WebviewUrl::App("index.html#/companion".into()),
    )
    .title("Focus Frog")
    .inner_size(sprite_side, sprite_side + COMPANION_BUBBLE_HEADROOM)
    .position(position.0, position.1)
    .transparent(true)
    .decorations(false)
    .always_on_top(true)
    .shadow(false)
    .resizable(false)
    .skip_taskbar(true)
    .focused(false)
    .visible(true)
    .build()
    .map_err(|e| AppError::Window(e.to_string()))?;

    // Click-through everywhere by default; `start_companion_hit_test_loop`
    // polls the global cursor position (via `Window::cursor_position`,
    // added in Tauri 2) against the sprite's bounds and toggles this off
    // only while the cursor is actually over the frog, so the transparent
    // bubble headroom above it stays click-through and dragging/clicking
    // the frog itself works. Tauri 2 has no native per-pixel hit testing,
    // so this coarse polling toggle is the documented workaround.
    let _ = window.set_ignore_cursor_events(true);
    platform::apply_companion_window_style(&window);
    start_companion_hit_test_loop(app);
    Ok(())
}

/// Polls the global cursor position at 50ms while the companion window is
/// open and toggles `set_ignore_cursor_events` based on whether the cursor
/// is over the frog sprite (the bottom `sprite_side x sprite_side` square
/// of the window -- see `COMPANION_BUBBLE_HEADROOM`), so the transparent
/// bubble headroom above the frog stays click-through while the sprite
/// itself is clickable/draggable. Self-terminates once the companion
/// window is closed, mirroring `start_polling_loop`'s lifecycle pattern.
fn start_companion_hit_test_loop(app: &AppHandle) {
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(50));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        let mut currently_ignoring = true;
        loop {
            interval.tick().await;
            let Some(window) = app_handle.get_webview_window(COMPANION_WINDOW_LABEL) else {
                break;
            };
            let (Ok(cursor), Ok(win_pos), Ok(win_size)) = (
                window.cursor_position(),
                window.outer_position(),
                window.outer_size(),
            ) else {
                continue;
            };
            let sprite_side = win_size.width as f64;
            let sprite_left = win_pos.x as f64;
            let sprite_top = win_pos.y as f64 + (win_size.height as f64 - sprite_side);
            let over_sprite = cursor.x >= sprite_left
                && cursor.x <= sprite_left + sprite_side
                && cursor.y >= sprite_top
                && cursor.y <= sprite_top + sprite_side;
            let should_ignore = !over_sprite;
            if should_ignore != currently_ignoring {
                let _ = window.set_ignore_cursor_events(should_ignore);
                currently_ignoring = should_ignore;
            }
        }
    });
}

fn destroy_companion_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(COMPANION_WINDOW_LABEL) {
        let _ = window.close();
    }
}

fn create_nuclear_window(app: &AppHandle) -> Result<(), AppError> {
    if app.get_webview_window(NUCLEAR_WINDOW_LABEL).is_some() {
        return Ok(());
    }
    let window = WebviewWindowBuilder::new(
        app,
        NUCLEAR_WINDOW_LABEL,
        WebviewUrl::App("index.html#/nuclear".into()),
    )
    .title("Focus Frog")
    .inner_size(900.0, 620.0)
    .center()
    .decorations(false)
    .always_on_top(true)
    .resizable(false)
    .skip_taskbar(true)
    // No native close button: dismissal is only ever through
    // `acknowledge_intervention` or the global emergency hotkey, both
    // of which are always reachable. This never blocks OS-level quit
    // (Cmd+Q / tray Quit / `window::quit_app`), which exits the whole
    // process regardless of any window's closable flag.
    .closable(false)
    .build()
    .map_err(|e| AppError::Window(e.to_string()))?;

    platform::apply_nuclear_window_style(&window);
    Ok(())
}

fn destroy_nuclear_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(NUCLEAR_WINDOW_LABEL) {
        let _ = window.close();
    }
}

// ---------------------------------------------------------------------
// Background activity polling (only while a session is active)
// ---------------------------------------------------------------------

pub(crate) fn start_polling_loop(app: &AppHandle) {
    let app_handle = app.clone();
    let join_handle = tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(2));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        loop {
            interval.tick().await;

            let state = app_handle.state::<AppState>();
            if state.engine.lock().unwrap().is_none() {
                break;
            }

            let (app_detection_enabled, distracting_apps) = {
                let settings = state.settings.lock().unwrap();
                let apps = state.distracting_apps.lock().unwrap();
                (settings.app_detection_enabled, apps.clone())
            };

            let raw = match state.activity_provider.sample() {
                Ok(raw) => raw,
                Err(e) => {
                    eprintln!("focus-frog: activity sampling failed, skipping tick: {e}");
                    // No fresh sample, but still drive the engine with a
                    // Tick so a session can't fail to complete just
                    // because activity sampling is broken.
                    let now = now_time();
                    let transition = {
                        let mut guard = state.engine.lock().unwrap();
                        guard
                            .as_mut()
                            .map(|engine| engine.handle(EngineInput::Tick, now))
                    };
                    if let Some(transition) = transition {
                        let is_terminal =
                            matches!(transition.to, FocusState::Completed | FocusState::Abandoned);
                        if let Err(e) =
                            process_transition(&app_handle, &state, transition, None).await
                        {
                            eprintln!("focus-frog: failed to process transition: {e}");
                        }
                        if is_terminal {
                            break;
                        }
                    }
                    continue;
                }
            };

            let is_distracting_app = app_detection_enabled
                && raw
                    .active_app
                    .as_deref()
                    .map(|name| distracting_apps.contains(name))
                    .unwrap_or(false);

            let sample = ActivitySample {
                idle_seconds: raw.idle_seconds,
                active_app: raw.active_app.clone(),
                is_distracting_app,
            };

            let now = now_time();
            let transition = {
                let mut guard = state.engine.lock().unwrap();
                guard
                    .as_mut()
                    .map(|engine| engine.handle(EngineInput::Activity(sample), now))
            };

            let Some(transition) = transition else {
                break;
            };
            let is_terminal =
                matches!(transition.to, FocusState::Completed | FocusState::Abandoned);

            if let Err(e) =
                process_transition(&app_handle, &state, transition, raw.active_app).await
            {
                eprintln!("focus-frog: failed to process transition: {e}");
            }

            if is_terminal {
                break;
            }
        }
    });

    let state = app.state::<AppState>();
    let mut guard = state.polling_task.lock().unwrap();
    if let Some(old) = guard.replace(join_handle) {
        old.abort();
    }
}

pub(crate) fn stop_polling_loop(state: &AppState) {
    if let Some(handle) = state.polling_task.lock().unwrap().take() {
        handle.abort();
    }
}

// ---------------------------------------------------------------------
// The single place a `Transition` becomes DB writes + emitted events.
// The engine itself never touches the DB or Tauri APIs -- everything here
// is the "glue" the architecture contract assigns to `lib.rs`.
// ---------------------------------------------------------------------

pub(crate) async fn process_transition(
    app: &AppHandle,
    state: &AppState,
    transition: Transition,
    active_app: Option<String>,
) -> Result<(), AppError> {
    let Transition {
        from,
        to,
        escalation_level,
        session,
    } = transition;
    let now = now_time();
    let now_str = now.to_rfc3339();
    let session_id = session.id.clone();

    if from == FocusState::Idle {
        create_companion_window(app)?;
    }

    if from != to {
        state
            .db
            .run_blocking({
                let session_id = session_id.clone();
                let now_str = now_str.clone();
                move |conn| {
                    let event_id = Uuid::new_v4().to_string();
                    repository::insert_focus_event(
                        conn,
                        &event_id,
                        &session_id,
                        from,
                        to,
                        escalation_level,
                        &now_str,
                    )
                }
            })
            .await?;
    }

    // Distraction-episode bookkeeping: one open `distraction_events` row
    // spans the whole Distracted -> Ignored -> Intervention chain.
    if to == FocusState::Distracted {
        let already_open = state.open_distraction_event.lock().unwrap().is_some();
        if !already_open {
            let event_id = Uuid::new_v4().to_string();
            state
                .db
                .run_blocking({
                    let event_id = event_id.clone();
                    let session_id = session_id.clone();
                    let active_app = active_app.clone();
                    let now_str = now_str.clone();
                    move |conn| {
                        repository::open_distraction_event(
                            conn,
                            &event_id,
                            &session_id,
                            active_app.as_deref(),
                            &now_str,
                        )
                    }
                })
                .await?;
            *state.open_distraction_event.lock().unwrap() = Some(state::OpenDistractionEvent {
                id: event_id,
                started_at_secs: now.as_secs(),
            });
        }
    } else if matches!(
        to,
        FocusState::Recovering | FocusState::Completed | FocusState::Abandoned
    ) {
        let open_event = state.open_distraction_event.lock().unwrap().take();
        if let Some(open_event) = open_event {
            let duration_secs = (now.as_secs() - open_event.started_at_secs).max(0);
            state
                .db
                .run_blocking({
                    let now_str = now_str.clone();
                    move |conn| {
                        repository::close_distraction_event(
                            conn,
                            &open_event.id,
                            &now_str,
                            duration_secs,
                        )
                    }
                })
                .await?;
        }
    }

    // Nuclear overlay: only ever created for escalation level 4 (Nuclear
    // profile reaching Intervention), and always torn down the moment we
    // leave Intervention for any reason.
    if to == FocusState::Intervention && escalation_level == 4 {
        create_nuclear_window(app)?;
    } else if from == FocusState::Intervention && to != FocusState::Intervention {
        destroy_nuclear_window(app);
    }

    if matches!(to, FocusState::Completed | FocusState::Abandoned) {
        let status = repository::SessionStatus::from(to);
        state
            .db
            .run_blocking({
                let session_id = session_id.clone();
                let now_str = now_str.clone();
                move |conn| {
                    repository::set_session_status(conn, &session_id, status, Some(&now_str))
                }
            })
            .await?;

        if to == FocusState::Completed {
            const COMPLETION_EXPERIENCE: u32 = 10;
            state
                .db
                .run_blocking({
                    let now_str = now_str.clone();
                    move |conn| {
                        repository::add_companion_experience(conn, COMPLETION_EXPERIENCE, &now_str)
                    }
                })
                .await?;
        }

        *state.engine.lock().unwrap() = None;
        *state.open_distraction_event.lock().unwrap() = None;
        stop_polling_loop(state);
        destroy_companion_window(app);
        destroy_nuclear_window(app);
    }

    let _ = app.emit("session:update", &session);
    if to == FocusState::Completed {
        let _ = app.emit("session:completed", &session);
    }

    if from != to {
        let personality = state.settings.lock().unwrap().default_personality;
        let counter = {
            let mut counter = state.message_counter.lock().unwrap();
            *counter += 1;
            *counter
        };
        let message = MessageBank::pick(
            personality,
            EscalationLevel::from_u8(escalation_level),
            &session_id,
            counter,
        );
        let _ = app.emit(
            "companion:message",
            serde_json::json!({ "text": message.text, "mood": message.mood }),
        );
    }

    Ok(())
}
