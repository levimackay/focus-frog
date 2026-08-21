# Privacy

Focus Frog is local-first. There is no account, no cloud backend, no
telemetry, and no analytics. This document describes precisely what the app
observes, where that data lives, and how to remove it.

## What is observed, and when

While — and only while — a focus session is active, Focus Frog polls two
signals every 2 seconds:

- **System idle time**, in seconds (how long since the last keyboard/mouse
  input), via the `user-idle` crate.
- **The foreground application's name** (e.g. `"Safari"`, `"Slack"`), via the
  `active-win-pos-rs` crate.

That's the entire signal surface. Idle time and the active app name are
compared against your settings (idle threshold, distracting-app list) purely
in memory, to drive the focus engine's state machine. No polling happens
while there is no active session — the background loop that samples activity
starts when you start a session and stops the moment it ends.

If you turn off "app detection" in Settings, only idle time is used; the
active app name is never read.

## What is never done

Focus Frog does not, and architecturally cannot without new code and a new
release:

- Log keystrokes or mouse movement (no keylogging).
- Take screenshots or record the screen.
- Read window *contents*, only the foreground app's *name*.
- Access the clipboard.
- Make network requests containing session data, activity data, or anything
  else about you or your usage. The only network-capable code path in the app
  is the `opener` plugin, which is used solely to open explicit `https://`
  links you click (e.g. "open GitHub repo"), scoped by Tauri capability to
  that purpose.
- Send any data anywhere by default — Focus Frog has no server component to
  send it to.

## Where your data lives

Everything Focus Frog stores — sessions, goals, success criteria, journal
entries, distraction events, companion state, settings, the distracting-app
list — lives in a single local SQLite file:

| OS | Path |
| --- | --- |
| macOS | `~/Library/Application Support/com.levimackay.focusfrog/focus-frog.sqlite3` |
| Windows | `%APPDATA%\com.levimackay.focusfrog\focus-frog.sqlite3` |
| Linux | `~/.local/share/com.levimackay.focusfrog/focus-frog.sqlite3` |

This path is Tauri's standard per-OS app-data directory, keyed by the app
identifier (`com.levimackay.focusfrog` in `src-tauri/tauri.conf.json`). Nothing
is written outside this one file and directory.

## Deleting your data

Quit Focus Frog, then delete the file (or the whole containing folder) at the
path above for your OS. There is no other copy anywhere — no cloud backup, no
sync target. Deleting the file removes every session record, journal entry,
companion profile, and setting; the app will recreate a fresh, empty database
the next time it starts.

## OS permissions

- **macOS**: idle-time detection (`user-idle`, via IOKit) requires no special
  permission. Active-app detection (`active-win-pos-rs`) reads only the
  foreground app's **name**, never its window title or contents; per that
  library's own documentation, window *title* access is gated behind macOS's
  Screen Recording permission, but app *name* is not. In practice, some macOS
  versions restrict window enumeration more broadly than others — if the frog
  never seems to notice which app you switched to, check **System Settings →
  Privacy & Security → Screen Recording** and grant it to Focus Frog. Nothing
  Focus Frog reads changes based on that grant (still just the app name), so
  granting it is only ever a reliability fix, never a scope increase.
- **Windows**: no special permission is required for either signal.
- **Linux (X11)**: no special permission is required for either signal.
- **Linux (Wayland)**: idle time and active-window queries have no portable
  protocol under Wayland; support is best-effort and compositor-dependent
  (see the Linux section of the main [README](README.md#supported-platforms)).
  When a query fails, that tick reports `idle_seconds: 0.0` and
  `active_app: None` rather than a fabricated value — it never invents
  activity data.
