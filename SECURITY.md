# Security

## Model

Focus Frog is a local desktop app with no server component and no account
system, which removes most of the usual web attack surface. The security
posture is about being a well-behaved native app on your machine:

- **No shell access exposed to the frontend.** The `tauri-plugin-shell` is
  not a dependency, and no app-defined command runs an arbitrary command or
  passes user input to a shell. The only plugin capable of touching the
  outside world at all is `tauri-plugin-opener`, restricted (see below) to
  opening `https://` URLs — it cannot open `file://` paths or local
  executables.
- **Least-privilege Tauri capabilities.** Two capability files, scoped per
  window:
  - [`src-tauri/capabilities/default.json`](src-tauri/capabilities/default.json)
    — the main window (onboarding/settings/stats) only. Grants `core:default`,
    `opener:allow-open-url` (scoped to `https://*`), autostart
    enable/disable/is-enabled, and global-shortcut register/unregister.
  - [`src-tauri/capabilities/session-windows.json`](src-tauri/capabilities/session-windows.json)
    — the ephemeral companion and nuclear-overlay windows only. Grants
    `core:default` alone; no opener, no autostart, no global-shortcut. These
    windows never need to launch a URL or touch startup registration.

  Every app-defined command (`session::*`, `settings::*`, `companion::*`,
  `stats::*`, `window::*`) lives outside Tauri's plugin ACL system entirely —
  confirmed against the build-generated `gen/schemas/desktop-schema.json`,
  which contains no `focus-frog:*` permission identifiers — so what actually
  gates them is the input validation described below, not a capability
  wildcard.
- **Parameterized SQL only.** All database access goes through typed query
  functions in `src-tauri/src/db/repository.rs` using `rusqlite`'s bound
  parameters. There is no string-built or interpolated SQL anywhere in the
  codebase.
- **Input validation, defense in depth.** Every free-text field (goal,
  success criteria, journal entry, companion name, distracting-app name) is
  length-capped in the frontend (form validation) and re-validated
  server-side in `src-tauri/src/security/mod.rs` before it reaches the
  database — the frontend check is a UX convenience, not the enforcement
  boundary.
- **No telemetry, no network calls carrying app data.** See
  [PRIVACY.md](PRIVACY.md) for the full data-handling description.
- **The nuclear-mode focus overlay cannot trap you.** It never disables OS
  functionality, never intercepts the OS-level quit path (`Cmd+Q` / tray
  "Quit" / the `window::quit_app` command all exit the whole process
  regardless of overlay state), and is always dismissible via the global
  emergency hotkey, which is registered through `tauri-plugin-global-shortcut`
  and works even when no Focus Frog window has focus.

## Reporting a vulnerability

This repository does not yet have a dedicated security contact address.
Once this repository is hosted on GitHub, please report suspected
vulnerabilities through its **Security → Report a vulnerability** tab (GitHub
Security Advisories), rather than opening a public issue — that flow is
private between you and the maintainer until a fix ships. If that tab isn't
available yet, open a regular issue asking for a private contact channel and
avoid including exploit details until one is established.
