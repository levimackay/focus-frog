import { motion } from "motion/react";
import { useState } from "react";
import Frog from "../frog/Frog";
import Button from "../common/Button";
import type { SessionSnapshot } from "../../ipc/types";
import { formatMinutes } from "../../lib/time";
import "./CompletionScreen.css";

export interface CompletionScreenProps {
  snapshot: SessionSnapshot;
  reducedMotion: boolean;
  onSubmitJournal: (entry: string | null) => Promise<void>;
  onDone: () => void;
}

export default function CompletionScreen({
  snapshot,
  reducedMotion,
  onSubmitJournal,
  onDone,
}: CompletionScreenProps) {
  const [journal, setJournal] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Captured once, at the moment this screen first mounts (right after the
  // session ended) — not recomputed on every re-render.
  const [elapsedSeconds] = useState(() =>
    Math.max(0, (Date.now() - Date.parse(snapshot.started_at)) / 1000),
  );

  const completed = snapshot.state === "Completed";

  async function handleSubmit(entry: string | null) {
    setSubmitting(true);
    await onSubmitJournal(entry);
    setSubmitting(false);
    setSubmitted(true);
  }

  return (
    <div className="completion-screen">
      {completed && !reducedMotion && (
        <div className="celebration-burst" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => (
            <motion.span
              key={i}
              className="burst-particle"
              style={{
                left: `${(i * 97) % 100}%`,
                background: i % 2 ? "var(--color-accent)" : "var(--color-frog)",
              }}
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: [0, -40, 120], opacity: [0, 1, 0], rotate: [0, 180] }}
              transition={{ duration: 1.6, delay: i * 0.05, ease: "easeIn" }}
            />
          ))}
        </div>
      )}

      <Frog
        mood={completed ? "celebrating" : "sleeping"}
        size={150}
        reducedMotion={reducedMotion}
        label={completed ? "Focus Frog celebrating" : "Focus Frog, session ended early"}
      />

      <h1>{completed ? "Session complete" : "Session abandoned"}</h1>
      <p className="completion-goal">{snapshot.goal}</p>

      <dl className="completion-stats">
        <div>
          <dt>Status</dt>
          <dd>{completed ? "Completed" : "Abandoned"}</dd>
        </div>
        <div>
          <dt>Time in session</dt>
          <dd>{formatMinutes(elapsedSeconds)}</dd>
        </div>
        <div>
          <dt>Distractions</dt>
          <dd>{snapshot.distraction_count}</dd>
        </div>
        <div>
          <dt>Interventions</dt>
          <dd>{snapshot.intervention_count}</dd>
        </div>
      </dl>

      {!submitted ? (
        <div className="journal-block">
          <label htmlFor="journal-entry">
            Anything worth remembering? <span>(optional)</span>
          </label>
          <textarea
            id="journal-entry"
            rows={3}
            value={journal}
            maxLength={2000}
            placeholder="What actually happened in there?"
            onChange={(e) => setJournal(e.target.value)}
          />
          <div className="journal-actions">
            <Button variant="ghost" disabled={submitting} onClick={() => handleSubmit(null)}>
              Skip
            </Button>
            <Button
              variant="primary"
              disabled={submitting || journal.trim().length === 0}
              onClick={() => handleSubmit(journal.trim())}
            >
              {submitting ? "Saving…" : "Save entry"}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="primary" size="lg" onClick={onDone}>
          Back to Focus Frog
        </Button>
      )}
    </div>
  );
}
