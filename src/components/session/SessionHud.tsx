import { motion } from "motion/react";
import { useEffect, useState } from "react";
import Frog from "../frog/Frog";
import SpeechBubble from "./SpeechBubble";
import ControlPanel from "./ControlPanel";
import ConfirmDialog from "../common/ConfirmDialog";
import { useSessionStore } from "../../stores/sessionStore";
import { useCompanionStore } from "../../stores/companionStore";
import { useCountdown } from "../../hooks/useCountdown";
import { moodForState } from "../../lib/mood";
import { formatDuration } from "../../lib/time";
import "./SessionHud.css";

const BUBBLE_LIFETIME_MS = 6000;

export interface SessionHudProps {
  reducedMotion: boolean;
  onOpenSettings: () => void;
}

export default function SessionHud({ reducedMotion, onOpenSettings }: SessionHudProps) {
  const snapshot = useSessionStore((s) => s.snapshot);
  const abandon = useSessionStore((s) => s.abandon);
  const bubble = useCompanionStore((s) => s.bubble);
  const dismissBubble = useCompanionStore((s) => s.dismissBubble);
  const [frogVisible, setFrogVisible] = useState(true);
  const [confirmingAbandon, setConfirmingAbandon] = useState(false);

  const active = !!snapshot && snapshot.state !== "Completed" && snapshot.state !== "Abandoned";
  const remaining = useCountdown(snapshot?.remaining_secs ?? 0, active);

  useEffect(() => {
    if (!bubble) return;
    const id = window.setTimeout(() => dismissBubble(), BUBBLE_LIFETIME_MS);
    return () => window.clearTimeout(id);
  }, [bubble, dismissBubble]);

  if (!snapshot) return null;

  // The effect above clears `bubble` from the store after BUBBLE_LIFETIME_MS,
  // so its mere presence already means "fresh" — no need to re-check a
  // timestamp against the clock during render.
  const mood = bubble ? bubble.mood : moodForState(snapshot.state, snapshot.escalation_level);

  return (
    <div className="session-hud" data-escalation={snapshot.escalation_level}>
      <motion.div
        className="escalation-field"
        aria-hidden="true"
        animate={reducedMotion ? {} : { opacity: [0.5, 0.85, 0.5] }}
        transition={
          reducedMotion
            ? undefined
            : {
                duration: Math.max(0.6, 2.6 - snapshot.escalation_level * 0.5),
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
      />

      <header className="session-hud-header">
        <span className="session-timer" aria-live="off">
          {formatDuration(remaining)}
        </span>
        <p className="session-goal">{snapshot.goal}</p>
        <dl className="session-stats" aria-label="Session counters">
          <div>
            <dt>Distractions</dt>
            <dd>{snapshot.distraction_count}</dd>
          </div>
          <div>
            <dt>Interventions</dt>
            <dd>{snapshot.intervention_count}</dd>
          </div>
        </dl>
      </header>

      <div className="session-frog-area">
        {frogVisible ? (
          <>
            <SpeechBubble text={bubble?.text ?? null} reducedMotion={reducedMotion} />
            <Frog mood={mood} size={140} reducedMotion={reducedMotion} />
          </>
        ) : (
          <p className="frog-hidden-note">
            Frog is hidden in this window — it's still on your desktop, and the session is
            still running.
          </p>
        )}
      </div>

      <ControlPanel
        frogVisible={frogVisible}
        onToggleFrogVisible={() => setFrogVisible((v) => !v)}
        onOpenSettings={onOpenSettings}
        onAbandon={() => setConfirmingAbandon(true)}
      />

      <ConfirmDialog
        open={confirmingAbandon}
        title="Abandon this session?"
        description="Your progress won't count as a completion. You can always start a new one."
        confirmLabel="Abandon session"
        danger
        onConfirm={() => {
          setConfirmingAbandon(false);
          abandon();
        }}
        onCancel={() => setConfirmingAbandon(false)}
      />
    </div>
  );
}
