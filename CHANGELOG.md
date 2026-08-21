# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project has not made a versioned release yet — everything below is
unreleased, in-progress work.

## [Unreleased]

### Added

- Tauri 2 + Rust + React/TypeScript desktop scaffold (see
  [ARCHITECTURE.md](ARCHITECTURE.md) for the full contract).
- Pure, deterministic focus-engine state machine (`Idle → Focused →
  Distracted → Ignored → Intervention → Recovering → Completed/Abandoned`)
  with unit tests driven by explicit timestamps, not sleeps.
- Cross-platform activity sampling (idle time + foreground app name) via
  `user-idle` and `active-win-pos-rs`, polled every 2 seconds only while a
  session is active.
- Four annoyance profiles (Gentle, Persistent, Ruthless, Nuclear) that cap how
  far escalation is allowed to go, including an opt-in Nuclear full-screen
  focus overlay with a global emergency-exit hotkey and tray-quit that always
  work.
- Five companion personalities (Friendly, Passive Aggressive, Drill Sergeant,
  Chaotic, Zen) with a fixed message bank per personality/escalation-level
  pair.
- Local SQLite persistence (sessions, focus events, distraction events,
  companion profile, settings, distracting-app list) via `rusqlite` +
  `r2d2`, no external database.
- Session flow: onboarding, goal/duration/success-criteria capture, live
  session HUD, intervention overlay, completion screen with optional journal
  entry.
- Stats screen backed by `stats::get_stats` / `stats::get_recent_sessions`
  (weekly/monthly/all-time session counts, focused time, streaks).
- Settings screen: escalation thresholds, default annoyance profile and
  personality, app-detection toggle, launch-on-startup, sound, reduced
  motion, theme, frog size/position, emergency hotkey, Nuclear mode opt-in,
  and a distracting-app list editor.
- System tray with show/hide companion, start/abandon session, and quit.
- Least-privilege Tauri capabilities split between the main window and the
  ephemeral companion/nuclear windows; input validation enforced in both
  TypeScript and Rust.
- Companion leveling data model (experience awarded on session completion,
  level derived from it) — tracked but not yet surfaced as any player-facing
  reward; see the Roadmap section of [README.md](README.md).

### Known limitations

- Linux Wayland has no portable idle-time or active-window protocol; support
  is best-effort per compositor and degrades to "no signal" rather than
  fabricating data (see [PRIVACY.md](PRIVACY.md)).
- No packaged releases yet — build from source (see README).
