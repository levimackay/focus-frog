import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import Frog from "../frog/Frog";
import Button from "../common/Button";
import type { AnnoyanceProfile, StartSessionInput } from "../../ipc/types";
import {
  ANNOYANCE_PROFILES,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  SUCCESS_CRITERIA_MAX_LENGTH,
  GOAL_MAX_LENGTH,
  validateGoalForm,
  type GoalFormValues,
} from "./validation";
import "./OnboardingFlow.css";

type Step = "intro" | "goal" | "profile" | "ready";

export interface OnboardingFlowProps {
  onComplete: (input: StartSessionInput) => void;
  starting: boolean;
  error: string | null;
  reducedMotion: boolean;
  /** False when this is a returning user starting another session — skips the "Meet Focus Frog" intro. */
  showIntro?: boolean;
}

export default function OnboardingFlow({
  onComplete,
  starting,
  error,
  reducedMotion,
  showIntro = true,
}: OnboardingFlowProps) {
  const stepOrder: Step[] = showIntro
    ? ["intro", "goal", "profile", "ready"]
    : ["goal", "profile", "ready"];
  const [step, setStep] = useState<Step>(showIntro ? "intro" : "goal");
  const [touched, setTouched] = useState(false);
  const [form, setForm] = useState<GoalFormValues>({
    goal: "",
    successCriteria: "",
    durationMinutes: 25,
  });
  const [profile, setProfile] = useState<AnnoyanceProfile>("gentle");
  const [nuclearOptIn, setNuclearOptIn] = useState(false);

  const errors = validateGoalForm(form);
  const goalStepValid = Object.keys(errors).length === 0;
  const profileStepValid = profile !== "nuclear" || nuclearOptIn;

  const direction = 1;

  function goTo(next: Step) {
    setStep(next);
  }

  function handleGoalNext() {
    setTouched(true);
    if (goalStepValid) goTo("profile");
  }

  function handleStart() {
    if (form.durationMinutes === "" || !goalStepValid || !profileStepValid) return;
    onComplete({
      goal: form.goal.trim(),
      success_criteria: form.successCriteria.trim(),
      duration_secs: Math.round(Number(form.durationMinutes) * 60),
      annoyance_profile: profile,
    });
  }

  return (
    <div className="onboarding">
      <div className="onboarding-progress" aria-hidden="true">
        {stepOrder.map((s) => (
          <span key={s} className={s === step ? "dot dot--active" : "dot"} />
        ))}
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          className="onboarding-step"
          custom={direction}
          initial={reducedMotion ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reducedMotion ? undefined : { opacity: 0, x: -24 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          {step === "intro" && (
            <section aria-labelledby="onboarding-heading">
              <Frog
                mood="happy"
                size={140}
                reducedMotion={reducedMotion}
                label="Focus Frog waving hello"
              />
              <h1 id="onboarding-heading">Meet Focus Frog</h1>
              <p className="onboarding-lede">
                A small companion that sits on your desktop, watches whether you're actually doing
                the thing you said you'd do, and says something about it when you drift. Set a goal,
                pick how much heat you want, and go.
              </p>
              <Button variant="primary" size="lg" onClick={() => goTo("goal")}>
                Get started
              </Button>
            </section>
          )}

          {step === "goal" && (
            <section aria-labelledby="goal-heading">
              <h2 id="goal-heading">What are you working on?</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleGoalNext();
                }}
              >
                <label className="field">
                  <span>Goal</span>
                  <input
                    type="text"
                    value={form.goal}
                    maxLength={GOAL_MAX_LENGTH}
                    placeholder="Finish the quarterly report"
                    onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
                    aria-invalid={touched && !!errors.goal}
                    aria-describedby="goal-error"
                  />
                  {touched && errors.goal && (
                    <span id="goal-error" className="field-error" role="alert">
                      {errors.goal}
                    </span>
                  )}
                </label>

                <label className="field">
                  <span>What does "done" look like?</span>
                  <textarea
                    value={form.successCriteria}
                    maxLength={SUCCESS_CRITERIA_MAX_LENGTH}
                    placeholder="Report is drafted, numbers double-checked, sent to Maya"
                    rows={3}
                    onChange={(e) => setForm((f) => ({ ...f, successCriteria: e.target.value }))}
                    aria-invalid={touched && !!errors.successCriteria}
                    aria-describedby="success-error"
                  />
                  {touched && errors.successCriteria && (
                    <span id="success-error" className="field-error" role="alert">
                      {errors.successCriteria}
                    </span>
                  )}
                </label>

                <label className="field field-duration">
                  <span>Duration (minutes)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={MIN_DURATION_MINUTES}
                    max={MAX_DURATION_MINUTES}
                    value={form.durationMinutes}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        durationMinutes: e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                    aria-invalid={touched && !!errors.durationMinutes}
                    aria-describedby="duration-error"
                  />
                  {touched && errors.durationMinutes && (
                    <span id="duration-error" className="field-error" role="alert">
                      {errors.durationMinutes}
                    </span>
                  )}
                </label>

                <div className="onboarding-actions">
                  {showIntro ? (
                    <Button type="button" variant="ghost" onClick={() => goTo("intro")}>
                      Back
                    </Button>
                  ) : (
                    <span />
                  )}
                  <Button type="submit" variant="primary">
                    Next
                  </Button>
                </div>
              </form>
            </section>
          )}

          {step === "profile" && (
            <section aria-labelledby="profile-heading">
              <h2 id="profile-heading">How annoying should the frog get?</h2>
              <p className="onboarding-lede">
                This decides how far the frog escalates if you stay distracted. You can change it
                per session later.
              </p>
              <div className="profile-grid" role="radiogroup" aria-labelledby="profile-heading">
                {ANNOYANCE_PROFILES.map((option) => (
                  <label
                    key={option.id}
                    className={
                      profile === option.id ? "profile-card profile-card--active" : "profile-card"
                    }
                  >
                    <input
                      type="radio"
                      name="annoyance-profile"
                      value={option.id}
                      checked={profile === option.id}
                      onChange={() => {
                        setProfile(option.id);
                        if (option.id !== "nuclear") setNuclearOptIn(false);
                      }}
                    />
                    <span className="profile-card-label">{option.label}</span>
                    <span className="profile-card-desc">{option.description}</span>
                  </label>
                ))}
              </div>

              {profile === "nuclear" && (
                <label className="nuclear-optin">
                  <input
                    type="checkbox"
                    checked={nuclearOptIn}
                    onChange={(e) => setNuclearOptIn(e.target.checked)}
                  />
                  <span>
                    I understand Nuclear mode can show a full-screen overlay, and I know the
                    emergency exit works at any time.
                  </span>
                </label>
              )}

              <div className="onboarding-actions">
                <Button type="button" variant="ghost" onClick={() => goTo("goal")}>
                  Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={!profileStepValid}
                  onClick={() => goTo("ready")}
                >
                  Next
                </Button>
              </div>
            </section>
          )}

          {step === "ready" && (
            <section aria-labelledby="ready-heading">
              <Frog
                mood="looking"
                size={110}
                reducedMotion={reducedMotion}
                label="Focus Frog, ready to start"
              />
              <h2 id="ready-heading">Ready?</h2>
              <dl className="ready-summary">
                <div>
                  <dt>Goal</dt>
                  <dd>{form.goal}</dd>
                </div>
                <div>
                  <dt>Done means</dt>
                  <dd>{form.successCriteria}</dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>{form.durationMinutes} minutes</dd>
                </div>
                <div>
                  <dt>Profile</dt>
                  <dd>{ANNOYANCE_PROFILES.find((p) => p.id === profile)?.label}</dd>
                </div>
              </dl>

              {error && (
                <p className="onboarding-error" role="alert">
                  {error}
                </p>
              )}

              <div className="onboarding-actions">
                <Button type="button" variant="ghost" onClick={() => goTo("profile")}>
                  Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  disabled={starting}
                  onClick={handleStart}
                >
                  {starting ? "Starting…" : "Start session"}
                </Button>
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
