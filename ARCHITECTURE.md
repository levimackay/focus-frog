# Focus Frog — Architecture Contract

This is the binding contract for implementation. Rust backend and React frontend
are built against this document so they integrate without drift. Do not deviate
from the command names, payload shapes, or state machine defined here without
updating this file first.

Stack: Tauri 2, Rust (edition 2021, stable toolchain), React 18 + TypeScript + Vite.

## 1. Crate/package decisions (already made — do not re-litigate)

Rust (`src-tauri/Cargo.toml`):
- `tauri` 2.x, `tauri-plugin-opener` 2.x (scaffolded default)
- `tauri-plugin-autostart` 2.x — launch on startup
- `tauri-plugin-global-shortcut` 2.x — emergency escape hotkey, works even when window isn't focused
- `rusqlite` 0.x with `bundled` feature — no external SQLite dependency, single-file DB, synchronous API run through `tauri::async_runtime::spawn_blocking`
- `r2d2` + `r2d2_sqlite` — connection pool (avoids re-opening a connection per command)
- `active-win-pos-rs` — cross-platform (macOS/Windows/Linux) active window title + app name
- `user-idle` — cross-platform system idle-time query
- `serde` / `serde_json` — IPC payloads
- `thiserror` — error types
- `time` crate (with `serde`, `formatting`, `parsing` features) for timestamps — avoid `chrono` to keep one date/time dependency
- `uuid` (v4, serde feature) for entity IDs

Frontend (`package.json`):
- `zustand` — state management (single small store per domain: session, settings, companion, stats)
- `framer-motion` (imported as `motion/react` in current major) — all animation
- `vitest` + `@testing-library/react` + `jsdom` — component/unit tests

These are deliberately minimal. No Redux, no react-query (IPC calls are simple invoke/listen, not HTTP caching), no CSS framework — hand-written CSS with CSS variables for theming (light/dark + reduced motion).

## 2. Directory layout

```
src-tauri/src/
├── main.rs                 # entry point, calls focus_frog_lib::run()
├── lib.rs                  # tauri::Builder setup, plugin registration, command registration, tray, global shortcut
├── commands/                # one file per command group, thin — validate input, call domain layer, map errors
│   ├── mod.rs
│   ├── session.rs
│   ├── settings.rs
│   ├── companion.rs
│   └── stats.rs
├── engine/                  # FocusEngine — pure, no I/O, fully unit-testable
│   ├── mod.rs
│   ├── state.rs             # FocusState enum, SessionConfig, EscalationLevel
│   └── engine.rs            # FocusEngine struct, transition logic, tick()
├── activity/                 # DesktopActivityProvider abstraction
│   ├── mod.rs                # trait ActivityProvider, ActivitySample
│   ├── macos.rs
│   ├── windows.rs
│   └── linux.rs
├── companion/                 # personality system + companion profile domain logic
│   ├── mod.rs
│   └── personality.rs         # Personality enum, message bank
├── db/
│   ├── mod.rs                 # Db struct wrapping r2d2 pool, migration runner
│   ├── migrations.rs           # embedded SQL migrations (include_str!)
│   └── repository.rs           # typed query functions used by commands
├── security/
│   └── mod.rs                  # input validation helpers (string length caps, enum validation)
└── state.rs                    # AppState (Db, FocusEngineHandle behind Mutex, EventEmitter)
```

`main.rs` and `lib.rs` stay thin. No `if cfg!(target_os = ...)` scattered in domain code — only inside `activity/mod.rs`'s factory function and `lib.rs` window-manager setup.

Frontend (`src/`):
```
src/
├── main.tsx
├── App.tsx                  # routes between onboarding / session / stats / settings by app state
├── ipc/                      # typed wrappers around invoke() and listen() — the ONLY place that calls @tauri-apps/api
│   ├── commands.ts
│   ├── events.ts
│   └── types.ts              # mirrors Rust serde types exactly
├── stores/
│   ├── sessionStore.ts
│   ├── settingsStore.ts
│   └── companionStore.ts
├── components/
│   ├── frog/                  # Frog character: Frog.tsx + per-mood animation variants
│   ├── onboarding/
│   ├── session/                # session HUD, control panel, intervention overlay
│   ├── stats/
│   └── settings/
└── styles/
```

## 3. The Focus Engine (`engine/`)

Pure state machine, no timers, no I/O, no `Instant::now()` calls internally — every
transition is driven by an explicit timestamp passed in by the caller. This is what
makes it deterministic and testable without `sleep`.

### States

```rust
pub enum FocusState {
    Idle,          // no active session
    Focused,       // actively working
    Distracted,    // signal indicates distraction, within grace period
    Ignored,       // distraction persisted past threshold, escalating
    Intervention,  // top escalation reached, prominent UI required
    Recovering,    // user returned to focus, confirming it sticks before trusting it
    Completed,     // planned duration elapsed
    Abandoned,     // user ended session early
}
```

### Inputs

```rust
pub struct ActivitySample {
    pub idle_seconds: f64,
    pub active_app: Option<String>,
    pub is_distracting_app: bool, // computed by caller against settings' distracting-app list
}

pub enum EngineInput {
    Activity(ActivitySample),
    Tick,                 // clock advanced, no new activity sample (used for duration/timeout checks)
    Abandon,
    AcknowledgeIntervention,
}
```

### Transition rules (evaluated in `FocusEngine::handle(&mut self, input: EngineInput, now: Time)`)

- Any state except `Completed`/`Abandoned`: if `now >= session_end_at` → `Completed`.
- `Idle` → `Focused` on session start (via `FocusEngine::start(config, now)`, not `handle`).
- `Focused` → `Distracted`: activity sample is a distraction signal (`idle_seconds > settings.idle_threshold_secs` OR `is_distracting_app`) and stays a distraction signal continuously for `settings.distraction_grace_secs` (default 8s) — debounced so a single blip doesn't flip state.
- `Distracted` → `Ignored`: distraction signal persists continuously for `settings.ignored_threshold_secs` (default 60s) since it first began.
- `Ignored` → `Intervention`: distraction signal persists continuously for `settings.intervention_threshold_secs` (default 180s) since it first began, AND the active annoyance profile allows escalation to this level (Gentle caps at `Ignored`; Persistent caps at `Intervention`; Ruthless and Nuclear allow full escalation, Nuclear additionally allows the focus overlay).
- `Distracted` / `Ignored` / `Intervention` → `Recovering`: activity sample is a focus signal (not idle, not distracting app).
- `Recovering` → `Focused`: focus signal persists continuously for `settings.recovery_confirm_secs` (default 5s).
- `Recovering` → `Distracted`: a distraction signal arrives before recovery confirms (treated as a fresh distraction, timers reset).
- `Intervention` → `Recovering` also accepts `EngineInput::AcknowledgeIntervention` (user dismissed the overlay) even without a focus signal yet, so the UI is never stuck — but escalation level does not drop to 0 until an actual focus signal is seen.
- Any active state → `Abandoned` on `EngineInput::Abandon`.

### Escalation level

`escalation_level: u8` (0–4) is derived, not stored independently: 0 while `Focused`/`Idle`,
1 on entering `Distracted`, 2 on entering `Ignored`, 3 on entering `Intervention` under
Persistent/Ruthless, 4 on entering `Intervention` under Nuclear specifically (only Nuclear
ever reaches 4 — the focus overlay). `Recovering` keeps the escalation level frozen at
whatever it was, so the UI can show "coming back down" rather than snapping to 0.

### Output

Every `handle()`/`start()` call returns a `Transition { from: FocusState, to: FocusState, escalation_level: u8, session: SessionSnapshot }`. `lib.rs` is responsible for turning a transition into a DB write (`focus_events` row) and a `session:update` event emit — the engine itself never touches the DB or Tauri APIs.

### Testability requirement

`FocusEngine` unit tests must construct explicit `Time` values (offsets from a fixed
epoch, e.g. `Time::from_secs(0)`, `Time::from_secs(9)`) and call `handle()` directly —
never `std::thread::sleep`. `cargo test -p focus-frog` for the engine module must run
in well under a second.

## 4. Activity abstraction (`activity/`)

```rust
pub trait ActivityProvider: Send + Sync {
    fn sample(&self) -> Result<RawActivity, ActivityError>;
}
pub struct RawActivity { pub idle_seconds: f64, pub active_app: Option<String> }
```

`activity::new_provider() -> Box<dyn ActivityProvider>` picks the platform impl via
`#[cfg(target_os = ...)]` — this is the ONLY place with OS conditionals for activity.
- macOS: `user-idle` for idle seconds, `active-win-pos-rs` for active app name.
- Windows: same two crates, both support Windows.
- Linux: same two crates (X11; note Wayland idle/active-window support is best-effort upstream — document this honestly in README limitations, do not fake it).

A background loop in `lib.rs` (spawned via `tauri::async_runtime::spawn`, `tokio::time::interval` every 2s, only while a session is active — no polling when idle) calls `sample()`, converts to `ActivitySample` by checking `active_app` against the user's configured distracting-app list, and feeds `FocusEngine::handle(EngineInput::Activity(...))`. If the user disables application detection in settings, only idle time drives distraction signals.

Never implement keylogging, screenshots, screen recording, or arbitrary window content inspection. Only: idle seconds, and foreground application name/title.

## 5. Database schema (SQLite, migrations in `db/migrations.rs`)

```sql
CREATE TABLE focus_sessions (
    id TEXT PRIMARY KEY,
    goal TEXT NOT NULL,
    success_criteria TEXT NOT NULL,
    planned_duration_secs INTEGER NOT NULL,
    annoyance_profile TEXT NOT NULL, -- 'gentle' | 'persistent' | 'ruthless' | 'nuclear'
    personality TEXT NOT NULL,
    status TEXT NOT NULL,             -- 'active' | 'completed' | 'abandoned'
    started_at TEXT NOT NULL,
    ended_at TEXT,
    journal_entry TEXT
);

CREATE TABLE focus_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES focus_sessions(id),
    from_state TEXT NOT NULL,
    to_state TEXT NOT NULL,
    escalation_level INTEGER NOT NULL,
    occurred_at TEXT NOT NULL
);

CREATE TABLE distraction_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES focus_sessions(id),
    app_name TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_secs INTEGER
);

CREATE TABLE companion_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- single row
    species TEXT NOT NULL DEFAULT 'frog',
    name TEXT NOT NULL DEFAULT 'Frog',
    personality TEXT NOT NULL DEFAULT 'friendly',
    level INTEGER NOT NULL DEFAULT 1,
    experience INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE settings (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- single row, JSON blob for the whole Settings struct
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE distracting_apps (
    app_name TEXT PRIMARY KEY
);

CREATE TABLE achievements (
    key TEXT PRIMARY KEY,      -- e.g. 'first_session', 'streak_3', 'streak_7', 'hundred_distractions_defeated'
    unlocked_at TEXT
);
```

Deliberate simplification: `Goal`/`success criteria` live inline on `focus_sessions`
rather than a separate normalized `goals` table — v1 has no goal templates or reuse
across sessions, so a join would be pure overhead. Revisit only if goal reuse becomes
a real feature.

Migrations run once at startup via a `PRAGMA user_version` check; each migration is a
plain `.sql` file embedded with `include_str!`, applied in a transaction.

## 6. Settings shape (stored as one JSON blob, mirrored exactly in TS)

```rust
pub struct Settings {
    pub idle_threshold_secs: u32,          // default 20
    pub distraction_grace_secs: u32,       // default 8
    pub ignored_threshold_secs: u32,       // default 60
    pub intervention_threshold_secs: u32,  // default 180
    pub recovery_confirm_secs: u32,        // default 5
    pub default_annoyance_profile: AnnoyanceProfile,
    pub default_personality: Personality,
    pub app_detection_enabled: bool,
    pub launch_on_startup: bool,
    pub sound_enabled: bool,
    pub reduced_motion: bool,
    pub theme: Theme,                      // 'system' | 'light' | 'dark'
    pub frog_size: u32,                    // px, default 96
    pub frog_position: (f64, f64),         // last dragged position
    pub emergency_hotkey: String,          // default "CommandOrControl+Shift+Escape"
    pub nuclear_mode_enabled: bool,        // must be explicitly opted in, default false
}
```

## 7. IPC command contract

All commands live under `commands/` grouped by domain, registered in `lib.rs`'s
`tauri::generate_handler![...]`. Every command validates its input (length caps on
free text, enum parsing) before touching the DB — see `security/mod.rs`.

```
session::start_session(input: StartSessionInput) -> SessionSnapshot
session::get_active_session() -> Option<SessionSnapshot>
session::abandon_session() -> SessionSnapshot
session::acknowledge_intervention() -> SessionSnapshot
session::submit_journal(entry: Option<String>) -> SessionSnapshot
session::emergency_exit() -> SessionSnapshot          // also bound to global shortcut
settings::get_settings() -> Settings
settings::update_settings(settings: Settings) -> Settings
settings::add_distracting_app(name: String) -> Vec<String>
settings::remove_distracting_app(name: String) -> Vec<String>
settings::list_distracting_apps() -> Vec<String>
companion::get_companion_profile() -> CompanionProfile
companion::update_companion(name: String, personality: Personality) -> CompanionProfile
stats::get_stats(range: StatsRange) -> StatsSummary    // 'week' | 'month' | 'all'
stats::get_recent_sessions(limit: u32) -> Vec<SessionSummary>
window::set_frog_position(x: f64, y: f64) -> ()
window::quit_app() -> ()
```

```rust
pub struct StartSessionInput {
    pub goal: String,             // max 200 chars
    pub success_criteria: String, // max 300 chars
    pub duration_secs: u32,       // 60..=14400 (1min..4h)
    pub annoyance_profile: AnnoyanceProfile,
}
pub struct SessionSnapshot {
    pub id: String,
    pub state: FocusState,
    pub escalation_level: u8,
    pub goal: String,
    pub success_criteria: String,
    pub remaining_secs: u32,
    pub distraction_count: u32,
    pub intervention_count: u32,
    pub started_at: String,
}
```

## 8. Events (backend → frontend, via `app_handle.emit(...)`, consumed through `src/ipc/events.ts`)

```
"session:update"        -> SessionSnapshot   // on every state transition and once per tick while active
"session:completed"     -> SessionSnapshot
"companion:message"     -> { text: string, mood: string }  // frog speech bubble content, chosen by the personality module
```

## 9. Window management

`WindowManager` abstraction in `lib.rs` setup, with per-OS quirks isolated to small
functions (`platform::macos::apply_companion_window_style(window)`, etc.) rather than
inline `cfg!` blocks in business logic:
- Main window: normal window, used for onboarding, settings, stats.
- Companion window: separate small transparent, always-on-top, decoration-less window
  used only during an active session, showing the frog. Click-through is enabled by
  default over its transparent regions and disabled over the frog sprite itself using
  a polling toggle of `set_ignore_cursor_events` based on cursor-over-sprite bounds
  (Tauri 2 has no native per-pixel hit testing yet — documented upstream limitation).
- Nuclear-mode overlay: a third window, only created when `EngineInput` drives the
  engine into `Intervention` under the Nuclear profile, full-screen-ish, always-on-top,
  requires `acknowledge_intervention` (button, or emergency hotkey) to close. It must
  never block the global emergency shortcut or OS-level window close.

## 10. Personality system (`companion/personality.rs`)

```rust
pub enum Personality { Friendly, PassiveAggressive, DrillSergeant, Chaotic, Zen }
```
A `MessageBank` keyed by `(Personality, EscalationLevel)` returning a small fixed set
of lines per cell, chosen pseudo-randomly (seeded from session id + counter, not a
`rand` dependency needed for this — `wyhash`-style simple counter mix is enough,
avoid adding a whole RNG crate for flavor text). Frontend never hardcodes copy —
all frog dialogue comes from `companion:message` events sourced from this module.

## 11. Security posture

- No `shell` plugin, no arbitrary command execution exposed to the frontend, ever.
- `tauri-plugin-opener` (scaffolded default) is fine — used only for "open GitHub repo" style links, restricted via capabilities to `https://` URLs.
- Capabilities file grants only the specific commands above plus the specific plugin permissions needed (autostart, global-shortcut register/unregister, opener open-url), nothing wildcard.
- All free-text input (goal, success criteria, journal, companion name) is length-capped both in TS (form validation) and Rust (defense in depth) before hitting the DB.
- SQLite access exclusively through parameterized queries in `db/repository.rs` — no string-built SQL anywhere.
