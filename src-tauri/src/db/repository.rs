//! Typed, parameterized query functions. No string-built SQL anywhere --
//! every value crosses into SQLite through a bound parameter.

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::companion::{CompanionProfile, Personality};
use crate::engine::{AnnoyanceProfile, FocusState};
use crate::settings::Settings;

use super::DbError;

// ---------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionStatus {
    Active,
    Completed,
    Abandoned,
}

impl SessionStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            SessionStatus::Active => "active",
            SessionStatus::Completed => "completed",
            SessionStatus::Abandoned => "abandoned",
        }
    }
}

impl From<FocusState> for SessionStatus {
    fn from(state: FocusState) -> Self {
        match state {
            FocusState::Completed => SessionStatus::Completed,
            FocusState::Abandoned => SessionStatus::Abandoned,
            _ => SessionStatus::Active,
        }
    }
}

pub struct NewSession<'a> {
    pub id: &'a str,
    pub goal: &'a str,
    pub success_criteria: &'a str,
    pub planned_duration_secs: u32,
    pub annoyance_profile: AnnoyanceProfile,
    pub personality: Personality,
    pub started_at: &'a str,
}

pub fn insert_session(conn: &Connection, session: &NewSession) -> Result<(), DbError> {
    conn.execute(
        "INSERT INTO focus_sessions
            (id, goal, success_criteria, planned_duration_secs, annoyance_profile, personality, status, started_at, ended_at, journal_entry)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL, NULL)",
        params![
            session.id,
            session.goal,
            session.success_criteria,
            session.planned_duration_secs,
            session.annoyance_profile.as_str(),
            session.personality.as_str(),
            SessionStatus::Active.as_str(),
            session.started_at,
        ],
    )?;
    Ok(())
}

pub fn set_session_status(
    conn: &Connection,
    session_id: &str,
    status: SessionStatus,
    ended_at: Option<&str>,
) -> Result<(), DbError> {
    conn.execute(
        "UPDATE focus_sessions SET status = ?1, ended_at = ?2 WHERE id = ?3",
        params![status.as_str(), ended_at, session_id],
    )?;
    Ok(())
}

pub fn set_journal_entry(
    conn: &Connection,
    session_id: &str,
    entry: Option<&str>,
) -> Result<(), DbError> {
    conn.execute(
        "UPDATE focus_sessions SET journal_entry = ?1 WHERE id = ?2",
        params![entry, session_id],
    )?;
    Ok(())
}

// ---------------------------------------------------------------------
// Focus events
// ---------------------------------------------------------------------

pub fn insert_focus_event(
    conn: &Connection,
    id: &str,
    session_id: &str,
    from_state: FocusState,
    to_state: FocusState,
    escalation_level: u8,
    occurred_at: &str,
) -> Result<(), DbError> {
    conn.execute(
        "INSERT INTO focus_events (id, session_id, from_state, to_state, escalation_level, occurred_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            id,
            session_id,
            from_state.as_str(),
            to_state.as_str(),
            escalation_level,
            occurred_at
        ],
    )?;
    Ok(())
}

// ---------------------------------------------------------------------
// Distraction events
// ---------------------------------------------------------------------

pub fn open_distraction_event(
    conn: &Connection,
    id: &str,
    session_id: &str,
    app_name: Option<&str>,
    started_at: &str,
) -> Result<(), DbError> {
    conn.execute(
        "INSERT INTO distraction_events (id, session_id, app_name, started_at, ended_at, duration_secs)
         VALUES (?1, ?2, ?3, ?4, NULL, NULL)",
        params![id, session_id, app_name, started_at],
    )?;
    Ok(())
}

pub fn close_distraction_event(
    conn: &Connection,
    id: &str,
    ended_at: &str,
    duration_secs: i64,
) -> Result<(), DbError> {
    conn.execute(
        "UPDATE distraction_events SET ended_at = ?1, duration_secs = ?2 WHERE id = ?3",
        params![ended_at, duration_secs, id],
    )?;
    Ok(())
}

fn count_distraction_events(conn: &Connection, session_id: &str) -> Result<u32, DbError> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM distraction_events WHERE session_id = ?1",
        params![session_id],
        |row| row.get(0),
    )?;
    Ok(count as u32)
}

fn count_intervention_events(conn: &Connection, session_id: &str) -> Result<u32, DbError> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM focus_events WHERE session_id = ?1 AND to_state = 'intervention'",
        params![session_id],
        |row| row.get(0),
    )?;
    Ok(count as u32)
}

// ---------------------------------------------------------------------
// Companion profile
// ---------------------------------------------------------------------

pub fn get_companion_profile(conn: &Connection, now: &str) -> Result<CompanionProfile, DbError> {
    let existing = conn
        .query_row(
            "SELECT species, name, personality, level, experience, created_at, updated_at FROM companion_profile WHERE id = 1",
            [],
            |row| {
                let personality_str: String = row.get(2)?;
                Ok(CompanionProfile {
                    id: 1,
                    species: row.get(0)?,
                    name: row.get(1)?,
                    personality: Personality::parse(&personality_str).unwrap_or(Personality::Friendly),
                    level: row.get::<_, i64>(3)? as u32,
                    experience: row.get::<_, i64>(4)? as u32,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )
        .optional()?;

    if let Some(profile) = existing {
        return Ok(profile);
    }

    let default = CompanionProfile {
        id: 1,
        species: "frog".to_string(),
        name: "Frog".to_string(),
        personality: Personality::Friendly,
        level: 1,
        experience: 0,
        created_at: now.to_string(),
        updated_at: now.to_string(),
    };
    conn.execute(
        "INSERT INTO companion_profile (id, species, name, personality, level, experience, created_at, updated_at)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            default.species,
            default.name,
            default.personality.as_str(),
            default.level,
            default.experience,
            default.created_at,
            default.updated_at
        ],
    )?;
    Ok(default)
}

pub fn update_companion(
    conn: &Connection,
    name: &str,
    personality: Personality,
    now: &str,
) -> Result<CompanionProfile, DbError> {
    // Ensure a row exists first.
    get_companion_profile(conn, now)?;
    conn.execute(
        "UPDATE companion_profile SET name = ?1, personality = ?2, updated_at = ?3 WHERE id = 1",
        params![name, personality.as_str(), now],
    )?;
    get_companion_profile(conn, now)
}

pub fn add_companion_experience(
    conn: &Connection,
    amount: u32,
    now: &str,
) -> Result<CompanionProfile, DbError> {
    get_companion_profile(conn, now)?;
    conn.execute(
        "UPDATE companion_profile
         SET experience = experience + ?1,
             level = 1 + ((experience + ?1) / 100),
             updated_at = ?2
         WHERE id = 1",
        params![amount, now],
    )?;
    get_companion_profile(conn, now)
}

// ---------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------

pub fn get_settings(conn: &Connection) -> Result<Settings, DbError> {
    let payload: Option<String> = conn
        .query_row("SELECT payload FROM settings WHERE id = 1", [], |row| {
            row.get(0)
        })
        .optional()?;

    match payload {
        Some(json) => {
            let settings: Settings = serde_json::from_str(&json)
                .map_err(|e| DbError::Query(format!("corrupt settings payload: {e}")))?;
            Ok(settings)
        }
        None => Ok(Settings::default()),
    }
}

pub fn update_settings(conn: &Connection, settings: &Settings, now: &str) -> Result<(), DbError> {
    let payload = serde_json::to_string(settings).map_err(|e| DbError::Query(e.to_string()))?;
    conn.execute(
        "INSERT INTO settings (id, payload, updated_at) VALUES (1, ?1, ?2)
         ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at",
        params![payload, now],
    )?;
    Ok(())
}

// ---------------------------------------------------------------------
// Distracting apps
// ---------------------------------------------------------------------

pub fn add_distracting_app(conn: &Connection, app_name: &str) -> Result<(), DbError> {
    conn.execute(
        "INSERT OR IGNORE INTO distracting_apps (app_name) VALUES (?1)",
        params![app_name],
    )?;
    Ok(())
}

pub fn remove_distracting_app(conn: &Connection, app_name: &str) -> Result<(), DbError> {
    conn.execute(
        "DELETE FROM distracting_apps WHERE app_name = ?1",
        params![app_name],
    )?;
    Ok(())
}

pub fn list_distracting_apps(conn: &Connection) -> Result<Vec<String>, DbError> {
    let mut stmt = conn.prepare("SELECT app_name FROM distracting_apps ORDER BY app_name ASC")?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
    let mut apps = Vec::new();
    for row in rows {
        apps.push(row?);
    }
    Ok(apps)
}

// ---------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StatsRange {
    Week,
    Month,
    All,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatsSummary {
    pub range: StatsRange,
    pub sessions_count: u32,
    pub completions: u32,
    pub abandonments: u32,
    /// Approximate: sum of planned duration for completed sessions, plus
    /// wall-clock elapsed time for abandoned ones.
    pub focused_seconds: i64,
    pub distractions_defeated: u32,
    pub current_streak_days: u32,
    pub longest_streak_days: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionSummary {
    pub id: String,
    pub goal: String,
    pub status: String,
    pub planned_duration_secs: u32,
    pub distraction_count: u32,
    pub intervention_count: u32,
    pub started_at: String,
    pub ended_at: Option<String>,
}

struct SessionRow {
    id: String,
    goal: String,
    status: String,
    planned_duration_secs: i64,
    started_at: String,
    ended_at: Option<String>,
}

fn range_cutoff(range: StatsRange, now: &str) -> Option<String> {
    match range {
        StatsRange::All => None,
        StatsRange::Week => Some(shift_rfc3339_days(now, -7)),
        StatsRange::Month => Some(shift_rfc3339_days(now, -30)),
    }
}

fn shift_rfc3339_days(now: &str, days: i64) -> String {
    use time::format_description::well_known::Rfc3339;
    let parsed =
        time::OffsetDateTime::parse(now, &Rfc3339).unwrap_or(time::OffsetDateTime::UNIX_EPOCH);
    let shifted = parsed + time::Duration::days(days);
    shifted.format(&Rfc3339).unwrap_or_else(|_| now.to_string())
}

pub fn get_stats(conn: &Connection, range: StatsRange, now: &str) -> Result<StatsSummary, DbError> {
    let cutoff = range_cutoff(range, now);

    let rows: Vec<SessionRow> = {
        let mut stmt = match &cutoff {
            Some(_) => conn.prepare(
                "SELECT id, goal, status, planned_duration_secs, started_at, ended_at
                 FROM focus_sessions WHERE started_at >= ?1 ORDER BY started_at ASC",
            )?,
            None => conn.prepare(
                "SELECT id, goal, status, planned_duration_secs, started_at, ended_at
                 FROM focus_sessions ORDER BY started_at ASC",
            )?,
        };
        let mapped = |row: &rusqlite::Row| -> rusqlite::Result<SessionRow> {
            Ok(SessionRow {
                id: row.get(0)?,
                goal: row.get(1)?,
                status: row.get(2)?,
                planned_duration_secs: row.get(3)?,
                started_at: row.get(4)?,
                ended_at: row.get(5)?,
            })
        };
        let iter = match &cutoff {
            Some(cutoff) => stmt.query_map(params![cutoff], mapped)?,
            None => stmt.query_map([], mapped)?,
        };
        iter.collect::<rusqlite::Result<Vec<_>>>()?
    };

    let mut sessions_count = 0u32;
    let mut completions = 0u32;
    let mut abandonments = 0u32;
    let mut focused_seconds: i64 = 0;
    let mut distractions_defeated = 0u32;
    let mut completed_dates: Vec<time::Date> = Vec::new();

    for row in &rows {
        sessions_count += 1;
        distractions_defeated += count_distraction_events(conn, &row.id)?;

        match row.status.as_str() {
            "completed" => {
                completions += 1;
                focused_seconds += row.planned_duration_secs;
                if let Ok(parsed) = time::OffsetDateTime::parse(
                    &row.started_at,
                    &time::format_description::well_known::Rfc3339,
                ) {
                    completed_dates.push(parsed.date());
                }
            }
            "abandoned" => {
                abandonments += 1;
                if let (Ok(start), Some(end)) = (
                    time::OffsetDateTime::parse(
                        &row.started_at,
                        &time::format_description::well_known::Rfc3339,
                    ),
                    &row.ended_at,
                ) {
                    if let Ok(end) = time::OffsetDateTime::parse(
                        end,
                        &time::format_description::well_known::Rfc3339,
                    ) {
                        focused_seconds += (end - start).whole_seconds().max(0);
                    }
                }
            }
            _ => {}
        }
    }

    let (current_streak_days, longest_streak_days) = compute_streaks(&mut completed_dates);

    Ok(StatsSummary {
        range,
        sessions_count,
        completions,
        abandonments,
        focused_seconds,
        distractions_defeated,
        current_streak_days,
        longest_streak_days,
    })
}

fn compute_streaks(dates: &mut [time::Date]) -> (u32, u32) {
    if dates.is_empty() {
        return (0, 0);
    }
    dates.sort();
    dates.iter_mut().for_each(|_| {}); // no-op, kept for clarity of intent
    let mut unique: Vec<time::Date> = Vec::with_capacity(dates.len());
    for d in dates.iter() {
        if unique.last() != Some(d) {
            unique.push(*d);
        }
    }

    let mut longest = 1u32;
    let mut current_run = 1u32;
    for window in unique.windows(2) {
        if window[1] - window[0] == time::Duration::days(1) {
            current_run += 1;
        } else {
            current_run = 1;
        }
        longest = longest.max(current_run);
    }

    // Current streak: run ending at the most recent date, only meaningful
    // if it touches today or yesterday; callers only need the count.
    let mut current_streak = 1u32;
    for window in unique.windows(2).rev() {
        if window[1] - window[0] == time::Duration::days(1) {
            current_streak += 1;
        } else {
            break;
        }
    }

    (current_streak, longest)
}

pub fn get_recent_sessions(conn: &Connection, limit: u32) -> Result<Vec<SessionSummary>, DbError> {
    let mut stmt = conn.prepare(
        "SELECT id, goal, status, planned_duration_secs, started_at, ended_at
         FROM focus_sessions ORDER BY started_at DESC LIMIT ?1",
    )?;
    let rows = stmt.query_map(params![limit], |row| {
        Ok(SessionRow {
            id: row.get(0)?,
            goal: row.get(1)?,
            status: row.get(2)?,
            planned_duration_secs: row.get(3)?,
            started_at: row.get(4)?,
            ended_at: row.get(5)?,
        })
    })?;

    let mut summaries = Vec::new();
    for row in rows {
        let row = row?;
        let distraction_count = count_distraction_events(conn, &row.id)?;
        let intervention_count = count_intervention_events(conn, &row.id)?;
        summaries.push(SessionSummary {
            id: row.id,
            goal: row.goal,
            status: row.status,
            planned_duration_secs: row.planned_duration_secs as u32,
            distraction_count,
            intervention_count,
            started_at: row.started_at,
            ended_at: row.ended_at,
        });
    }
    Ok(summaries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;
    use tempfile::NamedTempFile;

    fn test_conn() -> (NamedTempFile, Connection) {
        let file = NamedTempFile::new().unwrap();
        let mut conn = Connection::open(file.path()).unwrap();
        migrations::run(&mut conn).unwrap();
        (file, conn)
    }

    #[test]
    fn session_round_trips_through_insert_and_status_update() {
        let (_file, conn) = test_conn();
        insert_session(
            &conn,
            &NewSession {
                id: "s1",
                goal: "write the report",
                success_criteria: "report is done",
                planned_duration_secs: 1800,
                annoyance_profile: AnnoyanceProfile::Persistent,
                personality: Personality::Friendly,
                started_at: "2026-01-01T00:00:00Z",
            },
        )
        .unwrap();

        let summaries = get_recent_sessions(&conn, 10).unwrap();
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].goal, "write the report");
        assert_eq!(summaries[0].status, "active");

        set_session_status(
            &conn,
            "s1",
            SessionStatus::Completed,
            Some("2026-01-01T00:30:00Z"),
        )
        .unwrap();
        let summaries = get_recent_sessions(&conn, 10).unwrap();
        assert_eq!(summaries[0].status, "completed");
        assert_eq!(
            summaries[0].ended_at.as_deref(),
            Some("2026-01-01T00:30:00Z")
        );
    }

    #[test]
    fn journal_entry_round_trips_and_accepts_none() {
        let (_file, conn) = test_conn();
        insert_session(
            &conn,
            &NewSession {
                id: "s1",
                goal: "goal",
                success_criteria: "criteria",
                planned_duration_secs: 60,
                annoyance_profile: AnnoyanceProfile::Gentle,
                personality: Personality::Zen,
                started_at: "2026-01-01T00:00:00Z",
            },
        )
        .unwrap();
        set_journal_entry(&conn, "s1", Some("it went well")).unwrap();
        let entry: Option<String> = conn
            .query_row(
                "SELECT journal_entry FROM focus_sessions WHERE id = 's1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(entry.as_deref(), Some("it went well"));

        set_journal_entry(&conn, "s1", None).unwrap();
        let entry: Option<String> = conn
            .query_row(
                "SELECT journal_entry FROM focus_sessions WHERE id = 's1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(entry, None);
    }

    #[test]
    fn distraction_events_round_trip_and_count() {
        let (_file, conn) = test_conn();
        insert_session(
            &conn,
            &NewSession {
                id: "s1",
                goal: "goal",
                success_criteria: "criteria",
                planned_duration_secs: 60,
                annoyance_profile: AnnoyanceProfile::Gentle,
                personality: Personality::Zen,
                started_at: "2026-01-01T00:00:00Z",
            },
        )
        .unwrap();
        open_distraction_event(&conn, "d1", "s1", Some("Twitter"), "2026-01-01T00:01:00Z").unwrap();
        close_distraction_event(&conn, "d1", "2026-01-01T00:02:00Z", 60).unwrap();
        assert_eq!(count_distraction_events(&conn, "s1").unwrap(), 1);
    }

    // `StatsRange` crosses IPC as snake_case (ARCHITECTURE.md section 12),
    // matching the frontend's `StatsRange` TS union ('week' | 'month' | 'all').
    #[test]
    fn stats_range_parses_expected_snake_case_values() {
        assert_eq!(
            serde_json::from_str::<StatsRange>("\"week\"").unwrap(),
            StatsRange::Week
        );
        assert_eq!(
            serde_json::from_str::<StatsRange>("\"month\"").unwrap(),
            StatsRange::Month
        );
        assert_eq!(
            serde_json::from_str::<StatsRange>("\"all\"").unwrap(),
            StatsRange::All
        );
    }

    #[test]
    fn stats_range_rejects_unknown_or_wrong_case_values() {
        assert!(serde_json::from_str::<StatsRange>("\"Week\"").is_err());
        assert!(serde_json::from_str::<StatsRange>("\"year\"").is_err());
        assert!(serde_json::from_str::<StatsRange>("\"\"").is_err());
    }

    #[test]
    fn companion_profile_falls_back_to_friendly_for_a_corrupt_personality_column() {
        // Exercises `Personality::parse(..).unwrap_or(Personality::Friendly)`
        // in `get_companion_profile` -- every write path (insert_session,
        // update_companion) always writes a valid `as_str()` value, so this
        // fallback only fires if the column is corrupted out-of-band. Insert
        // directly via raw SQL to simulate that.
        let (_file, conn) = test_conn();
        get_companion_profile(&conn, "2026-01-01T00:00:00Z").unwrap(); // seed the row
        conn.execute(
            "UPDATE companion_profile SET personality = 'not_a_real_personality' WHERE id = 1",
            [],
        )
        .unwrap();

        let profile = get_companion_profile(&conn, "2026-01-01T00:00:00Z").unwrap();
        assert_eq!(profile.personality, Personality::Friendly);
    }

    #[test]
    fn companion_profile_defaults_then_updates() {
        let (_file, conn) = test_conn();
        let profile = get_companion_profile(&conn, "2026-01-01T00:00:00Z").unwrap();
        assert_eq!(profile.name, "Frog");
        assert_eq!(profile.personality, Personality::Friendly);

        let updated = update_companion(
            &conn,
            "Hopper",
            Personality::Chaotic,
            "2026-01-01T00:05:00Z",
        )
        .unwrap();
        assert_eq!(updated.name, "Hopper");
        assert_eq!(updated.personality, Personality::Chaotic);

        let leveled = add_companion_experience(&conn, 250, "2026-01-01T00:10:00Z").unwrap();
        assert_eq!(leveled.experience, 250);
        assert_eq!(leveled.level, 3);
    }

    #[test]
    fn settings_round_trip_defaults_when_absent() {
        let (_file, conn) = test_conn();
        let settings = get_settings(&conn).unwrap();
        assert_eq!(settings.idle_threshold_secs, 20);

        let mut custom = settings;
        custom.idle_threshold_secs = 45;
        update_settings(&conn, &custom, "2026-01-01T00:00:00Z").unwrap();
        let reloaded = get_settings(&conn).unwrap();
        assert_eq!(reloaded.idle_threshold_secs, 45);

        // Update again to exercise the ON CONFLICT path.
        custom.idle_threshold_secs = 50;
        update_settings(&conn, &custom, "2026-01-01T00:01:00Z").unwrap();
        let reloaded = get_settings(&conn).unwrap();
        assert_eq!(reloaded.idle_threshold_secs, 50);
    }

    #[test]
    fn distracting_apps_add_remove_list() {
        let (_file, conn) = test_conn();
        add_distracting_app(&conn, "Twitter").unwrap();
        add_distracting_app(&conn, "Reddit").unwrap();
        // Duplicate insert must not error.
        add_distracting_app(&conn, "Twitter").unwrap();

        let apps = list_distracting_apps(&conn).unwrap();
        assert_eq!(apps, vec!["Reddit".to_string(), "Twitter".to_string()]);

        remove_distracting_app(&conn, "Twitter").unwrap();
        let apps = list_distracting_apps(&conn).unwrap();
        assert_eq!(apps, vec!["Reddit".to_string()]);
    }

    #[test]
    fn stats_summary_counts_completed_and_abandoned_sessions() {
        let (_file, conn) = test_conn();
        insert_session(
            &conn,
            &NewSession {
                id: "s1",
                goal: "a",
                success_criteria: "a",
                planned_duration_secs: 1200,
                annoyance_profile: AnnoyanceProfile::Persistent,
                personality: Personality::Friendly,
                started_at: "2026-01-01T00:00:00Z",
            },
        )
        .unwrap();
        set_session_status(
            &conn,
            "s1",
            SessionStatus::Completed,
            Some("2026-01-01T00:20:00Z"),
        )
        .unwrap();

        insert_session(
            &conn,
            &NewSession {
                id: "s2",
                goal: "b",
                success_criteria: "b",
                planned_duration_secs: 1200,
                annoyance_profile: AnnoyanceProfile::Persistent,
                personality: Personality::Friendly,
                started_at: "2026-01-02T00:00:00Z",
            },
        )
        .unwrap();
        set_session_status(
            &conn,
            "s2",
            SessionStatus::Abandoned,
            Some("2026-01-02T00:05:00Z"),
        )
        .unwrap();
        open_distraction_event(&conn, "d1", "s2", Some("Reddit"), "2026-01-02T00:01:00Z").unwrap();

        let summary = get_stats(&conn, StatsRange::All, "2026-01-03T00:00:00Z").unwrap();
        assert_eq!(summary.sessions_count, 2);
        assert_eq!(summary.completions, 1);
        assert_eq!(summary.abandonments, 1);
        assert_eq!(summary.distractions_defeated, 1);
        assert_eq!(summary.focused_seconds, 1200 + 300); // planned + 5 min abandoned span
    }
}
