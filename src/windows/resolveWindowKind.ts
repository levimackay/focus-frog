/**
 * Which of the three Tauri windows this bundle is currently running in.
 *
 * The backend (src-tauri/src/lib.rs, `create_companion_window` /
 * `create_nuclear_window`) opens the companion and nuclear windows with
 * `WebviewUrl::App("index.html#/companion")` / `"index.html#/nuclear"` —
 * same single-page bundle, distinguished purely by URL hash. The main
 * window loads plain `index.html` with no hash.
 *
 * We deliberately key off `location.hash` rather than
 * `getCurrentWindow().label` from `@tauri-apps/api/window`:
 *  - it's how the backend actually distinguishes these windows (the label
 *    is incidental; the URL is the routing mechanism it chose),
 *  - it needs zero Tauri API surface / capability grants to read,
 *  - it works identically under `vite dev`/`vite preview` and in vitest's
 *    jsdom environment, where `window.__TAURI_INTERNALS__` doesn't exist
 *    and `getCurrentWindow()` would throw.
 */
export type WindowKind = "main" | "companion" | "nuclear";

export function resolveWindowKind(hash: string): WindowKind {
  if (hash.startsWith("#/companion")) return "companion";
  if (hash.startsWith("#/nuclear")) return "nuclear";
  return "main";
}
