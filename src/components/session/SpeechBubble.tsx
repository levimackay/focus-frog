import { AnimatePresence, motion } from "motion/react";
import "./SpeechBubble.css";

export interface SpeechBubbleProps {
  text: string | null;
  reducedMotion: boolean;
}

/**
 * Renders whatever text arrived on the `companion:message` event. Never
 * hardcode frog dialogue here — this component only displays what the
 * companionStore received from the backend.
 */
export default function SpeechBubble({ text, reducedMotion }: SpeechBubbleProps) {
  return (
    <div className="speech-bubble-slot" aria-live="polite">
      <AnimatePresence>
        {text && (
          <motion.div
            key={text}
            className="speech-bubble"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.34, 1.2, 0.64, 1] }}
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
