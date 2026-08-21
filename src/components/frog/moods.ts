import type { FrogMood } from "../../stores/companionStore";

export type EyeShape = "round" | "wide" | "narrow" | "closed" | "side";
export type MouthShape = "neutral" | "smile" | "grin" | "frown" | "wobble" | "grit" | "open";
export type Ambient = "none" | "zzz" | "sweat" | "lines" | "petals" | "exclaim";

export interface MoodSpec {
  /** Body/skin color token — most moods are frog-green, escalation moods shift toward ember. */
  bodyColor: "frog" | "frog-deep" | "ember-1" | "ember-2" | "ember-3" | "nuclear";
  eyes: EyeShape;
  eyeLook: { x: number; y: number };
  mouth: MouthShape;
  /** Idle bob amplitude in px — 0 means still (e.g. sleeping). */
  bobAmplitude: number;
  bobSpeed: number; // seconds per cycle
  /** Body squash/stretch scale used for hop cycles. */
  hop: boolean;
  hopSpeed: number;
  tilt: number; // resting rotation in degrees
  ambient: Ambient;
}

export const MOOD_SPECS: Record<FrogMood, MoodSpec> = {
  idle: {
    bodyColor: "frog",
    eyes: "round",
    eyeLook: { x: 0, y: 0 },
    mouth: "neutral",
    bobAmplitude: 3,
    bobSpeed: 3.2,
    hop: false,
    hopSpeed: 0,
    tilt: 0,
    ambient: "none",
  },
  walking: {
    bodyColor: "frog",
    eyes: "round",
    eyeLook: { x: 0, y: 0 },
    mouth: "neutral",
    bobAmplitude: 4,
    bobSpeed: 0.6,
    hop: true,
    hopSpeed: 0.6,
    tilt: 0,
    ambient: "none",
  },
  sleeping: {
    bodyColor: "frog-deep",
    eyes: "closed",
    eyeLook: { x: 0, y: 0 },
    mouth: "wobble",
    bobAmplitude: 2,
    bobSpeed: 4.5,
    hop: false,
    hopSpeed: 0,
    tilt: -6,
    ambient: "zzz",
  },
  looking: {
    bodyColor: "frog",
    eyes: "side",
    eyeLook: { x: 3, y: -1 },
    mouth: "neutral",
    bobAmplitude: 2,
    bobSpeed: 3,
    hop: false,
    hopSpeed: 0,
    tilt: 3,
    ambient: "none",
  },
  happy: {
    bodyColor: "frog",
    eyes: "round",
    eyeLook: { x: 0, y: -1 },
    mouth: "smile",
    bobAmplitude: 5,
    bobSpeed: 1.4,
    hop: false,
    hopSpeed: 0,
    tilt: 0,
    ambient: "none",
  },
  confused: {
    bodyColor: "frog",
    eyes: "wide",
    eyeLook: { x: -2, y: 0 },
    mouth: "wobble",
    bobAmplitude: 2,
    bobSpeed: 2.2,
    hop: false,
    hopSpeed: 0,
    tilt: 8,
    ambient: "none",
  },
  concerned: {
    bodyColor: "ember-1",
    eyes: "wide",
    eyeLook: { x: 0, y: 1 },
    mouth: "frown",
    bobAmplitude: 2,
    bobSpeed: 2.6,
    hop: false,
    hopSpeed: 0,
    tilt: -2,
    ambient: "sweat",
  },
  angry: {
    bodyColor: "ember-2",
    eyes: "narrow",
    eyeLook: { x: 0, y: 0 },
    mouth: "grit",
    bobAmplitude: 1.5,
    bobSpeed: 0.35,
    hop: false,
    hopSpeed: 0,
    tilt: 0,
    ambient: "exclaim",
  },
  celebrating: {
    bodyColor: "frog",
    eyes: "round",
    eyeLook: { x: 0, y: -2 },
    mouth: "grin",
    bobAmplitude: 10,
    bobSpeed: 0.5,
    hop: true,
    hopSpeed: 0.5,
    tilt: 0,
    ambient: "petals",
  },
  chasing: {
    bodyColor: "ember-1",
    eyes: "narrow",
    eyeLook: { x: 4, y: 0 },
    mouth: "open",
    bobAmplitude: 6,
    bobSpeed: 0.3,
    hop: true,
    hopSpeed: 0.3,
    tilt: -4,
    ambient: "lines",
  },
  intervention: {
    bodyColor: "ember-3",
    eyes: "wide",
    eyeLook: { x: 0, y: 0 },
    mouth: "open",
    bobAmplitude: 3,
    bobSpeed: 0.25,
    hop: false,
    hopSpeed: 0,
    tilt: 0,
    ambient: "exclaim",
  },
};

export const MOUTH_PATHS: Record<MouthShape, string> = {
  neutral: "M -8 4 Q 0 4 8 4",
  smile: "M -9 2 Q 0 12 9 2",
  grin: "M -10 1 Q 0 15 10 1 Q 0 9 -10 1 Z",
  frown: "M -8 8 Q 0 -1 8 8",
  wobble: "M -9 4 Q -4 0 0 4 Q 4 8 9 4",
  grit: "M -9 3 L 9 3 M -9 3 L -6 6 M -3 3 L 0 6 M 3 3 L 6 6 M 9 3 L 6 6",
  open: "M -7 0 Q 0 14 7 0 Q 0 4 -7 0 Z",
};
