import { useCallback, useEffect } from "react";
import Frog from "../components/frog/Frog";
import SpeechBubble from "../components/session/SpeechBubble";
import { useSessionStore } from "../stores/sessionStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useCompanionStore } from "../stores/companionStore";
import { useFocusFrogEvents } from "../hooks/useFocusFrogEvents";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { moodForState } from "../lib/mood";
import { windowCommands } from "../ipc/commands";
import "../styles/global.css";
import "./CompanionWindow.css";

/** True only inside a real Tauri webview -- false in `vite dev`/vitest, where
 * `@tauri-apps/api/window`'s `getCurrentWindow()` throws immediately. */
function hasTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Persists the window's current position via `set_frog_position` once
 * dragging settles, debounced so a drag doesn't spam the DB/settings file
 * with a write per pixel. Mirrors the backend's `start_companion_hit_test_loop`
 * assumption that `frog_position` is the companion window's own top-left.
 */
function usePersistFrogPositionOnMove() {
  useEffect(() => {
    if (!hasTauriRuntime()) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;

    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      if (cancelled) return;
      const win = getCurrentWindow();
      win
        .listen("tauri://move", () => {
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(() => {
            // `set_frog_position` / `create_companion_window` both treat
            // frog_position as LOGICAL pixels (`tauri::LogicalPosition`),
            // but `outerPosition()` returns PHYSICAL pixels -- convert or
            // this drifts on any monitor with scale factor != 1.
            Promise.all([win.outerPosition(), win.scaleFactor()])
              .then(([physical, scale]) => {
                const logical = physical.toLogical(scale);
                return windowCommands.setFrogPosition(logical.x, logical.y);
              })
              .catch(() => {
                /* best-effort persistence; the frog just resets to last saved spot next session */
              });
          }, 250);
        })
        .then((fn) => {
          unlisten = fn;
        });
    });

    return () => {
      cancelled = true;
      if (debounce) clearTimeout(debounce);
      unlisten?.();
    };
  }, []);
}

/**
 * Root for the `#/companion` window (src-tauri/src/lib.rs
 * `create_companion_window`): a small, transparent, always-on-top,
 * decoration-less window that exists only while a session is active. This
 * is the "frog lives on the desktop" surface — the main window's own
 * session HUD reuses the exact same Frog/SpeechBubble/stores so both
 * windows stay in sync off the same `session:update` / `companion:message`
 * events, they just render the frog at different sizes.
 *
 * Native window size is set server-side to `frog_size + 48` (see
 * `create_companion_window`), so we mirror `frog_size` here rather than
 * inventing our own — the frog should fill the window the backend already
 * sized for it.
 */
export default function CompanionWindow() {
  useFocusFrogEvents();

  const loadSettings = useSettingsStore((s) => s.load);
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const frogSize = useSettingsStore((s) => s.settings.frog_size);
  const hydrateSession = useSessionStore((s) => s.hydrate);
  const snapshot = useSessionStore((s) => s.snapshot);
  const loadCompanion = useCompanionStore((s) => s.loadProfile);
  const companionName = useCompanionStore((s) => s.profile?.name);
  const bubble = useCompanionStore((s) => s.bubble);
  const reducedMotion = useReducedMotion();

  usePersistFrogPositionOnMove();

  useEffect(() => {
    loadSettings();
    hydrateSession();
    loadCompanion();
  }, [loadSettings, hydrateSession, loadCompanion]);

  // The Rust `start_companion_hit_test_loop` only forwards real mouse
  // events to this window while the cursor is over the frog sprite itself
  // (everything else stays click-through) -- so a plain mousedown here is
  // safe to wire straight to native window dragging with no hit-testing
  // of our own to do.
  const handleSpriteMouseDown = useCallback(() => {
    if (!hasTauriRuntime()) return;
    import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      getCurrentWindow()
        .startDragging()
        .catch(() => {
          /* dragging is a nice-to-have; a failed start just means the frog didn't move */
        });
    });
  }, []);

  // The backend only keeps this window alive while a session is active, but
  // stay defensive against the gap between "window opened" and "first
  // snapshot fetched" rather than flashing an opaque placeholder.
  if (!settingsLoaded || !snapshot) return null;

  const mood = bubble ? bubble.mood : moodForState(snapshot.state, snapshot.escalation_level);

  return (
    <div className="companion-window">
      <SpeechBubble text={bubble?.text ?? null} reducedMotion={reducedMotion} />
      {/* Mouse-only window-drag handle, equivalent to dragging a native
          title bar the frog doesn't have -- there's no meaningful keyboard
          gesture for "drag a window", and a keyboard/AT-reachable
          alternative already exists (Settings → Frog → reset position), so
          this deliberately isn't given fake button semantics. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div className="companion-window__sprite" onMouseDown={handleSpriteMouseDown}>
        <Frog
          mood={mood}
          size={frogSize}
          reducedMotion={reducedMotion}
          label={`${companionName ?? "Frog"}, ${snapshot.goal}`}
        />
      </div>
    </div>
  );
}
