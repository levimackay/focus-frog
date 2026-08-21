import { motion, type Transition } from "motion/react";
import { useMemo } from "react";
import type { FrogMood } from "../../stores/companionStore";
import { MOOD_SPECS, MOUTH_PATHS } from "./moods";
import "./Frog.css";

export interface FrogProps {
  mood: FrogMood;
  size?: number;
  reducedMotion?: boolean;
  className?: string;
  /** Accessible name — should describe what the frog is doing, not just its mood id. */
  label?: string;
}

const BODY_COLOR_VAR: Record<string, string> = {
  frog: "var(--color-frog)",
  "frog-deep": "var(--color-frog-deep)",
  "ember-1": "var(--color-ember-1)",
  "ember-2": "var(--color-ember-2)",
  "ember-3": "var(--color-ember-3)",
  nuclear: "var(--color-nuclear)",
};

const MOOD_DESCRIPTIONS: Record<FrogMood, string> = {
  idle: "sitting calmly",
  walking: "hopping along",
  sleeping: "asleep",
  looking: "glancing around",
  happy: "content",
  confused: "confused",
  concerned: "a little worried",
  angry: "annoyed",
  celebrating: "celebrating",
  chasing: "hopping after you, insistently",
  intervention: "very insistent — time for an intervention",
};

export default function Frog({
  mood,
  size = 96,
  reducedMotion = false,
  className,
  label,
}: FrogProps) {
  const spec = MOOD_SPECS[mood];
  const bodyColor = BODY_COLOR_VAR[spec.bodyColor];
  const mouthPath = MOUTH_PATHS[spec.mouth];

  const bob = reducedMotion
    ? { y: 0 }
    : spec.hop
      ? { y: [0, -spec.bobAmplitude, 0], scaleX: [1, 0.94, 1], scaleY: [1, 1.06, 1] }
      : { y: [0, -spec.bobAmplitude, 0] };

  const bobTransition = reducedMotion
    ? undefined
    : ({
        duration: spec.hop ? spec.hopSpeed : spec.bobSpeed,
        repeat: Infinity,
        ease: spec.hop ? "easeOut" : "easeInOut",
      } satisfies Transition);

  const ambient = useMemo(
    () => renderAmbient(spec.ambient, reducedMotion),
    [spec.ambient, reducedMotion],
  );

  return (
    <div
      className={["frog-root", className].filter(Boolean).join(" ")}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `Focus Frog, ${MOOD_DESCRIPTIONS[mood]}`}
    >
      <motion.div
        className="frog-tilt"
        animate={{ rotate: spec.tilt }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <motion.svg
          viewBox="-50 -50 100 100"
          width="100%"
          height="100%"
          animate={bob}
          transition={bobTransition}
        >
          {/* back legs */}
          <ellipse cx="-28" cy="20" rx="12" ry="7" fill={bodyColor} opacity={0.9} />
          <ellipse cx="28" cy="20" rx="12" ry="7" fill={bodyColor} opacity={0.9} />

          {/* body */}
          <ellipse cx="0" cy="10" rx="34" ry="24" fill={bodyColor} />

          {/* belly */}
          <ellipse cx="0" cy="20" rx="20" ry="12" fill="var(--color-frog-belly)" opacity={0.85} />

          {/* front feet */}
          <ellipse cx="-18" cy="32" rx="8" ry="5" fill={bodyColor} />
          <ellipse cx="18" cy="32" rx="8" ry="5" fill={bodyColor} />

          {/* eye stalks */}
          <circle cx="-14" cy="-14" r="11" fill={bodyColor} />
          <circle cx="14" cy="-14" r="11" fill={bodyColor} />

          <Eye
            cx={-14}
            cy={-14}
            shape={spec.eyes}
            look={spec.eyeLook}
            reducedMotion={reducedMotion}
          />
          <Eye
            cx={14}
            cy={-14}
            shape={spec.eyes}
            look={spec.eyeLook}
            reducedMotion={reducedMotion}
          />

          {/* mouth */}
          <motion.path
            d={mouthPath}
            transform="translate(0 6)"
            fill={spec.mouth === "grin" || spec.mouth === "open" ? "var(--color-ink)" : "none"}
            fillOpacity={0.85}
            stroke="var(--color-ink)"
            strokeWidth={2}
            strokeLinecap="round"
            initial={false}
            animate={{ d: mouthPath }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </motion.svg>
      </motion.div>
      {ambient}
    </div>
  );
}

function Eye({
  cx,
  cy,
  shape,
  look,
  reducedMotion,
}: {
  cx: number;
  cy: number;
  shape: string;
  look: { x: number; y: number };
  reducedMotion: boolean;
}) {
  if (shape === "closed") {
    return (
      <path
        d={`M ${cx - 5} ${cy} Q ${cx} ${cy + 4} ${cx + 5} ${cy}`}
        stroke="var(--color-ink)"
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    );
  }

  const radius = shape === "wide" ? 6.5 : shape === "narrow" ? 4 : 5.5;
  const pupilRy = shape === "narrow" ? 2 : radius * 0.55;

  return (
    <g>
      <circle cx={cx} cy={cy} r={radius} fill="var(--color-ink)" opacity={0.08} />
      <circle cx={cx} cy={cy} r={radius * 0.8} fill="white" />
      <motion.ellipse
        cx={cx}
        cy={cy}
        rx={radius * 0.55}
        ry={pupilRy}
        fill="var(--color-ink)"
        animate={
          reducedMotion
            ? { cx: cx + look.x, cy: cy + look.y }
            : { cx: [cx, cx + look.x, cx], cy: [cy, cy + look.y, cy] }
        }
        transition={
          reducedMotion ? { duration: 0.2 } : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
        }
      />
    </g>
  );
}

function renderAmbient(kind: string, reducedMotion: boolean) {
  switch (kind) {
    case "zzz":
      return (
        <div className="frog-ambient frog-ambient-zzz" aria-hidden="true">
          <motion.span
            animate={reducedMotion ? {} : { y: [-2, -14], opacity: [0, 1, 0] }}
            transition={
              reducedMotion ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeOut" }
            }
          >
            z
          </motion.span>
          <motion.span
            animate={reducedMotion ? {} : { y: [-2, -14], opacity: [0, 1, 0] }}
            transition={
              reducedMotion
                ? undefined
                : { duration: 2.4, repeat: Infinity, ease: "easeOut", delay: 0.6 }
            }
          >
            z
          </motion.span>
        </div>
      );
    case "sweat":
      return (
        <motion.div
          className="frog-ambient frog-ambient-sweat"
          aria-hidden="true"
          animate={reducedMotion ? {} : { y: [0, 4, 8], opacity: [1, 1, 0] }}
          transition={
            reducedMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeIn" }
          }
        />
      );
    case "exclaim":
      return (
        <motion.div
          className="frog-ambient frog-ambient-exclaim"
          aria-hidden="true"
          animate={reducedMotion ? {} : { scale: [1, 1.25, 1], rotate: [-4, 4, -4] }}
          transition={
            reducedMotion ? undefined : { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
          }
        >
          !
        </motion.div>
      );
    case "lines":
      return (
        <div className="frog-ambient frog-ambient-lines" aria-hidden="true">
          <motion.span
            animate={reducedMotion ? {} : { x: [-6, 0], opacity: [0, 1, 0] }}
            transition={reducedMotion ? undefined : { duration: 0.35, repeat: Infinity }}
          />
          <motion.span
            animate={reducedMotion ? {} : { x: [-6, 0], opacity: [0, 1, 0] }}
            transition={
              reducedMotion ? undefined : { duration: 0.35, repeat: Infinity, delay: 0.1 }
            }
          />
          <motion.span
            animate={reducedMotion ? {} : { x: [-6, 0], opacity: [0, 1, 0] }}
            transition={
              reducedMotion ? undefined : { duration: 0.35, repeat: Infinity, delay: 0.2 }
            }
          />
        </div>
      );
    case "petals":
      return (
        <div className="frog-ambient frog-ambient-petals" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.span
              key={i}
              className="petal"
              style={{ left: `${10 + i * 14}%` }}
              animate={reducedMotion ? {} : { y: [-10, 60], opacity: [0, 1, 0], rotate: [0, 180] }}
              transition={
                reducedMotion
                  ? undefined
                  : { duration: 1.8, repeat: Infinity, delay: i * 0.22, ease: "easeIn" }
              }
            />
          ))}
        </div>
      );
    default:
      return null;
  }
}
