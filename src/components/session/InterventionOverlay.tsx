import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import Frog from "../frog/Frog";
import Button from "../common/Button";
import { formatHotkey } from "../../lib/hotkey";
import "./InterventionOverlay.css";

export interface InterventionOverlayProps {
  goal: string;
  escalationLevel: number;
  emergencyHotkey: string;
  reducedMotion: boolean;
  onAcknowledge: () => void;
  onEmergencyExit: () => void;
}

/**
 * Covers the screen when the engine reaches Intervention. escalationLevel 4
 * is Nuclear specifically (ARCHITECTURE.md section 3) and gets a hotter
 * treatment, but the exit path is identical and always present at both
 * levels — this overlay must never trap the user.
 */
export default function InterventionOverlay({
  goal,
  escalationLevel,
  emergencyHotkey,
  reducedMotion,
  onAcknowledge,
  onEmergencyExit,
}: InterventionOverlayProps) {
  const nuclear = escalationLevel >= 4;
  const exitButtonRef = useRef<HTMLButtonElement>(null);

  // Move focus to the emergency exit on mount — the WAI-ARIA modal pattern
  // (JS-driven, not the `autofocus` attribute) so a keyboard/screen-reader
  // user lands directly on the one control that always gets them out.
  useEffect(() => {
    exitButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onEmergencyExit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEmergencyExit]);

  return (
    <motion.div
      className={
        nuclear ? "intervention-overlay intervention-overlay--nuclear" : "intervention-overlay"
      }
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="intervention-heading"
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {/* Always the first and last focusable-adjacent element: never bury the exit. */}
      <button
        ref={exitButtonRef}
        type="button"
        className="emergency-exit"
        onClick={onEmergencyExit}
      >
        Emergency exit
        <kbd>{formatHotkey(emergencyHotkey)}</kbd>
      </button>

      <div className="intervention-body">
        <Frog
          mood={nuclear ? "intervention" : "chasing"}
          size={150}
          reducedMotion={reducedMotion}
          label={nuclear ? "Focus Frog, full intervention" : "Focus Frog, chasing you down"}
        />
        <h2 id="intervention-heading">
          {nuclear ? "Nuclear intervention" : "The frog caught you"}
        </h2>
        <p>
          You said the goal was <strong>{goal}</strong>. Come back to it, or leave — either is fine,
          just don't sit in between.
        </p>

        <div className="intervention-actions">
          <Button variant="primary" size="lg" onClick={onAcknowledge}>
            I'm back on track
          </Button>
          <Button variant="ghost" onClick={onEmergencyExit}>
            Exit session ({formatHotkey(emergencyHotkey)})
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
