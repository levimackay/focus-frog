# Contributing

Focus Frog is early and actively changing — check [ARCHITECTURE.md](ARCHITECTURE.md)
before touching backend code; it's the binding contract for command names,
payload shapes, and the focus-engine state machine, and it should be updated
*before* code that deviates from it, not after.

## Setup

Prerequisites:

- [Rust](https://rustup.rs/) (stable toolchain; the crate targets edition 2021)
- [Node.js](https://nodejs.org/) 18+
- Platform build tools for Tauri 2 — see the
  [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/) for
  your OS (Xcode Command Line Tools on macOS; WebView2 + MSVC Build Tools on
  Windows; `libwebkit2gtk`, `libxdo-dev`, and friends on Linux — Linux also
  needs `libxcb-ewmh-dev`, `libxcb-randr0-dev`, `libdbus-1-dev`, and
  `pkg-config` for the active-window/idle-time crates specifically)

```sh
git clone <this repo>
cd focus-frog
npm install
npm run tauri dev
```

## Running tests

Frontend (Vitest + Testing Library):

```sh
npm run test         # single run
npm run test:watch   # watch mode
```

Backend (the focus engine is pure and unit-tested without sleeping — see
`ARCHITECTURE.md` section 3):

```sh
cd src-tauri
cargo test
```

## Code style

Before opening a PR:

```sh
# Rust
cd src-tauri
cargo fmt
cargo clippy -- -D warnings

# Frontend
npm run lint
npm run typecheck
npm run format:check
```

CI (once configured) will run the same checks; a clean `cargo fmt`/`clippy`
and clean lint/typecheck are the bar, not a suggestion.

Conventions already in place, worth following rather than re-litigating:

- No `if cfg!(target_os = ...)` scattered through domain code — OS
  conditionals live only in `activity/`'s provider factory and `platform/`'s
  per-OS window-styling functions.
- The focus engine (`src-tauri/src/engine/`) stays pure: no I/O, no
  `Instant::now()`, every transition driven by an explicit `Time` passed in
  by the caller. Tests construct `Time` values directly and call `handle()`
  — never `std::thread::sleep`.
- `src/ipc/types.ts` mirrors the Rust serde types field-for-field. If you
  change a payload shape on one side, update both, and update
  `ARCHITECTURE.md` first.
- All free-text input gets length-validated in both TypeScript (UX) and Rust
  (`src-tauri/src/security/mod.rs`, the actual enforcement boundary).

## Opening a pull request

- Keep PRs scoped to one change; note any `ARCHITECTURE.md` updates the
  change requires in the PR description.
- Include or update tests for behavior changes, especially anything touching
  the focus engine's state transitions.
- Describe what you tested manually if the change touches platform-specific
  code (activity providers, window management) you can't fully cover with
  automated tests on one OS.

## A note on how this codebase was built

Large parts of this codebase, including this documentation, were written
with [Claude Code](https://claude.com/claude-code) under the maintainer's
direction. That's disclosed here for transparency, not as an endorsement —
review contributions (human or AI-assisted) on their merits.
