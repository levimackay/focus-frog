CREATE TABLE focus_sessions (
    id TEXT PRIMARY KEY,
    goal TEXT NOT NULL,
    success_criteria TEXT NOT NULL,
    planned_duration_secs INTEGER NOT NULL,
    annoyance_profile TEXT NOT NULL,
    personality TEXT NOT NULL,
    status TEXT NOT NULL,
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
    id INTEGER PRIMARY KEY CHECK (id = 1),
    species TEXT NOT NULL DEFAULT 'frog',
    name TEXT NOT NULL DEFAULT 'Frog',
    personality TEXT NOT NULL DEFAULT 'friendly',
    level INTEGER NOT NULL DEFAULT 1,
    experience INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE distracting_apps (
    app_name TEXT PRIMARY KEY
);

CREATE TABLE achievements (
    key TEXT PRIMARY KEY,
    unlocked_at TEXT
);

CREATE INDEX idx_focus_events_session_id ON focus_events(session_id);
CREATE INDEX idx_distraction_events_session_id ON distraction_events(session_id);
CREATE INDEX idx_focus_sessions_started_at ON focus_sessions(started_at);
