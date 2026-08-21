# Third-Party Notices

Focus Frog is built on the open-source packages below. This list covers the
direct, major dependencies declared in `src-tauri/Cargo.toml` and
`package.json` — not the full transitive dependency tree. License
identifiers were checked against each package's own published metadata
(`Cargo.toml` `license` field for Rust crates, `package.json` `license` field
for npm packages) at the versions pinned in this repo's lockfiles.

Before a packaged release, regenerate a complete transitive list with
`cargo license` (Rust) and a license-checker tool for npm — this file is a
direct-dependency summary, not a substitute for that.

## Rust (`src-tauri/Cargo.toml`)

| Crate | License |
| --- | --- |
| tauri | Apache-2.0 OR MIT |
| tauri-plugin-opener | Apache-2.0 OR MIT |
| tauri-plugin-autostart | Apache-2.0 OR MIT |
| tauri-plugin-global-shortcut | Apache-2.0 OR MIT |
| rusqlite | MIT |
| r2d2 | MIT OR Apache-2.0 |
| r2d2_sqlite | MIT |
| active-win-pos-rs | MIT OR Apache-2.0 |
| user-idle | MIT OR Apache-2.0 |
| serde / serde_json | MIT OR Apache-2.0 |
| thiserror | MIT OR Apache-2.0 |
| time | MIT OR Apache-2.0 |
| uuid | Apache-2.0 OR MIT |
| tokio | MIT |

`rusqlite`'s `bundled` feature vendors and statically links SQLite itself,
which is released into the [public domain](https://www.sqlite.org/copyright.html).

## Frontend (`package.json`)

| Package | License |
| --- | --- |
| react / react-dom | MIT |
| zustand | MIT |
| motion (Motion for React, imported as `motion/react`) | MIT |
| @tauri-apps/api | Apache-2.0 OR MIT |
| @tauri-apps/plugin-opener | Apache-2.0 OR MIT |
| @fontsource-variable/fraunces | OFL-1.1 |
| @fontsource-variable/bricolage-grotesque | OFL-1.1 |
| @fontsource/jetbrains-mono | OFL-1.1 |

Fonts are self-hosted via `@fontsource` (no Google Fonts network requests at
runtime — see `src/styles/fonts.css`) and are licensed under the SIL Open
Font License 1.1.

## Development-only dependencies

Vitest, Testing Library, ESLint, Prettier, TypeScript, and the Tauri CLI are
build/test tooling only, not shipped in the built app; their licenses (MIT
for all of the above, at the time this was written) don't affect end users
but are worth the same regeneration pass before a release if a full SBOM is
ever needed.
