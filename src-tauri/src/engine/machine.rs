//! `FocusEngine`: the pure focus/distraction state machine. No I/O, no
//! `Instant::now()`, no sleeping -- every transition is driven by an
//! explicit `Time` value passed in by the caller (see `engine::state::Time`).

use super::state::{
    ActivitySample, AnnoyanceProfile, EngineInput, EngineThresholds, FocusState, SessionConfig,
    SessionSnapshot, Time, Transition,
};

#[derive(Debug, Clone)]
pub struct FocusEngine {
    state: FocusState,
    session_id: String,
    goal: String,
    success_criteria: String,
    annoyance_profile: AnnoyanceProfile,
    thresholds: EngineThresholds,
    session_started_at: Time,
    session_end_at: Time,
    /// When the current continuous distraction signal first appeared.
    /// Anchors the grace / ignored / intervention thresholds -- they all
    /// count from the same moment the signal began, not from when the
    /// state actually changed.
    distraction_signal_since: Option<Time>,
    /// When the current continuous focus signal (while Recovering) began.
    recovery_signal_since: Option<Time>,
    escalation_level: u8,
    distraction_count: u32,
    intervention_count: u32,
}

impl FocusEngine {
    /// Starts a new session. This is the only way to produce a
    /// `FocusEngine` -- there is no `Idle` variant of the struct itself;
    /// callers represent "no session" as `Option::None`.
    pub fn start(config: SessionConfig, now: Time) -> (Self, Transition) {
        let session_end_at = now.add_secs(config.duration_secs as i64);
        let engine = FocusEngine {
            state: FocusState::Focused,
            session_id: config.session_id,
            goal: config.goal,
            success_criteria: config.success_criteria,
            annoyance_profile: config.annoyance_profile,
            thresholds: config.thresholds,
            session_started_at: now,
            session_end_at,
            distraction_signal_since: None,
            recovery_signal_since: None,
            escalation_level: 0,
            distraction_count: 0,
            intervention_count: 0,
        };
        let session = engine.snapshot(now);
        let transition = Transition {
            from: FocusState::Idle,
            to: FocusState::Focused,
            escalation_level: 0,
            session,
        };
        (engine, transition)
    }

    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    pub fn is_terminal(&self) -> bool {
        matches!(self.state, FocusState::Completed | FocusState::Abandoned)
    }

    pub fn snapshot(&self, now: Time) -> SessionSnapshot {
        let remaining = self.session_end_at.since(now).max(0) as u32;
        SessionSnapshot {
            id: self.session_id.clone(),
            state: self.state,
            escalation_level: self.escalation_level,
            goal: self.goal.clone(),
            success_criteria: self.success_criteria.clone(),
            remaining_secs: remaining,
            distraction_count: self.distraction_count,
            intervention_count: self.intervention_count,
            started_at: self.session_started_at.to_rfc3339(),
        }
    }

    /// The single entry point for driving the state machine forward.
    pub fn handle(&mut self, input: EngineInput, now: Time) -> Transition {
        let from = self.state;

        // "Any state except Completed/Abandoned: if now >= session_end_at
        // -> Completed." Checked first, unconditionally, ahead of whatever
        // the input says -- duration completion always wins.
        if !self.is_terminal() && now.as_secs() >= self.session_end_at.as_secs() {
            self.state = FocusState::Completed;
            return self.finish(from, now);
        }

        if self.is_terminal() {
            // Terminal states ignore all further input.
            return self.finish(from, now);
        }

        match input {
            EngineInput::Abandon => {
                self.state = FocusState::Abandoned;
            }
            EngineInput::AcknowledgeIntervention => {
                if self.state == FocusState::Intervention {
                    self.state = FocusState::Recovering;
                    self.recovery_signal_since = None;
                }
            }
            EngineInput::Tick => {
                // Duration completion is the only thing Tick drives; that
                // check already happened above.
            }
            EngineInput::Activity(sample) => {
                self.handle_activity(&sample, now);
            }
        }

        self.finish(from, now)
    }

    fn handle_activity(&mut self, sample: &ActivitySample, now: Time) {
        let is_distraction_signal = sample.idle_seconds
            > self.thresholds.idle_threshold_secs as f64
            || sample.is_distracting_app;

        match self.state {
            FocusState::Focused => {
                if is_distraction_signal {
                    let since = *self.distraction_signal_since.get_or_insert(now);
                    if now.since(since) >= self.thresholds.distraction_grace_secs as i64 {
                        self.state = FocusState::Distracted;
                        self.escalation_level = 1;
                        self.distraction_count += 1;
                    }
                } else {
                    self.distraction_signal_since = None;
                }
            }
            FocusState::Distracted => {
                if is_distraction_signal {
                    let since = self.distraction_signal_since.unwrap_or(now);
                    if now.since(since) >= self.thresholds.ignored_threshold_secs as i64 {
                        self.state = FocusState::Ignored;
                        self.escalation_level = 2;
                    }
                } else {
                    self.enter_recovering(now);
                }
            }
            FocusState::Ignored => {
                if is_distraction_signal {
                    if self.annoyance_profile != AnnoyanceProfile::Gentle {
                        let since = self.distraction_signal_since.unwrap_or(now);
                        if now.since(since) >= self.thresholds.intervention_threshold_secs as i64 {
                            self.state = FocusState::Intervention;
                            self.escalation_level =
                                if self.annoyance_profile == AnnoyanceProfile::Nuclear {
                                    4
                                } else {
                                    3
                                };
                            self.intervention_count += 1;
                        }
                    }
                    // Gentle caps at Ignored: stays here regardless of
                    // elapsed time.
                } else {
                    self.enter_recovering(now);
                }
            }
            FocusState::Intervention => {
                if !is_distraction_signal {
                    self.enter_recovering(now);
                }
                // Already at the profile's cap; a continuing distraction
                // signal keeps it in Intervention.
            }
            FocusState::Recovering => {
                if is_distraction_signal {
                    // Rule: a distraction arriving before recovery
                    // confirms is a fresh distraction -- timers reset and
                    // it goes straight to Distracted (bypassing the
                    // Focused->Distracted grace debounce).
                    self.state = FocusState::Distracted;
                    self.distraction_signal_since = Some(now);
                    self.recovery_signal_since = None;
                    self.escalation_level = 1;
                    self.distraction_count += 1;
                } else {
                    let since = *self.recovery_signal_since.get_or_insert(now);
                    if now.since(since) >= self.thresholds.recovery_confirm_secs as i64 {
                        self.state = FocusState::Focused;
                        self.escalation_level = 0;
                        self.distraction_signal_since = None;
                        self.recovery_signal_since = None;
                    }
                }
            }
            FocusState::Idle | FocusState::Completed | FocusState::Abandoned => {
                // Idle never occurs on a live engine; Completed/Abandoned
                // are handled by the terminal guard in `handle`.
            }
        }
    }

    /// Common path into `Recovering` from Distracted/Ignored/Intervention:
    /// escalation level is left untouched ("frozen") -- this function
    /// simply does not modify it.
    fn enter_recovering(&mut self, now: Time) {
        self.state = FocusState::Recovering;
        self.recovery_signal_since = Some(now);
    }

    fn finish(&mut self, from: FocusState, now: Time) -> Transition {
        let to = self.state;
        let session = self.snapshot(now);
        Transition {
            from,
            to,
            escalation_level: self.escalation_level,
            session,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::state::AnnoyanceProfile::*;

    fn thresholds() -> EngineThresholds {
        EngineThresholds {
            idle_threshold_secs: 20,
            distraction_grace_secs: 8,
            ignored_threshold_secs: 60,
            intervention_threshold_secs: 180,
            recovery_confirm_secs: 5,
        }
    }

    fn config(profile: AnnoyanceProfile, duration_secs: u32) -> SessionConfig {
        SessionConfig {
            session_id: "session-1".to_string(),
            goal: "ship the thing".to_string(),
            success_criteria: "it ships".to_string(),
            duration_secs,
            annoyance_profile: profile,
            thresholds: thresholds(),
        }
    }

    fn focus_sample() -> ActivitySample {
        ActivitySample {
            idle_seconds: 0.0,
            active_app: Some("Editor".to_string()),
            is_distracting_app: false,
        }
    }

    fn idle_sample(idle_seconds: f64) -> ActivitySample {
        ActivitySample {
            idle_seconds,
            active_app: None,
            is_distracting_app: false,
        }
    }

    fn distracting_app_sample() -> ActivitySample {
        ActivitySample {
            idle_seconds: 0.0,
            active_app: Some("SocialApp".to_string()),
            is_distracting_app: true,
        }
    }

    #[test]
    fn start_enters_focused_at_zero_escalation() {
        let (_engine, transition) =
            FocusEngine::start(config(Persistent, 3600), Time::from_secs(0));
        assert_eq!(transition.from, FocusState::Idle);
        assert_eq!(transition.to, FocusState::Focused);
        assert_eq!(transition.escalation_level, 0);
        assert_eq!(transition.session.remaining_secs, 3600);
    }

    #[test]
    fn idle_time_beyond_threshold_is_a_distraction_signal() {
        let (mut engine, _) = FocusEngine::start(config(Persistent, 3600), Time::from_secs(0));
        // idle_seconds (25) > idle_threshold_secs (20) -> distraction signal
        let t = engine.handle(EngineInput::Activity(idle_sample(25.0)), Time::from_secs(1));
        assert_eq!(t.to, FocusState::Focused); // still within grace period
    }

    #[test]
    fn a_single_blip_does_not_flip_state_before_grace_elapses() {
        let (mut engine, _) = FocusEngine::start(config(Persistent, 3600), Time::from_secs(0));
        engine.handle(EngineInput::Activity(idle_sample(25.0)), Time::from_secs(1));
        // Recovers before the 8s grace period elapses.
        let t = engine.handle(EngineInput::Activity(focus_sample()), Time::from_secs(3));
        assert_eq!(t.to, FocusState::Focused);
        // A fresh distraction signal after the blip must restart its own
        // grace timer rather than reusing the old anchor.
        let t2 = engine.handle(EngineInput::Activity(idle_sample(25.0)), Time::from_secs(9));
        assert_eq!(t2.to, FocusState::Focused);
        let t3 = engine.handle(
            EngineInput::Activity(idle_sample(25.0)),
            Time::from_secs(17),
        );
        assert_eq!(t3.to, FocusState::Distracted);
    }

    #[test]
    fn focused_to_distracted_after_grace_period() {
        let (mut engine, _) = FocusEngine::start(config(Persistent, 3600), Time::from_secs(0));
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(0),
        );
        // Still within the 8s grace window.
        let t = engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(7),
        );
        assert_eq!(t.to, FocusState::Focused);
        // Exactly at the grace threshold -> Distracted.
        let t2 = engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(8),
        );
        assert_eq!(t2.to, FocusState::Distracted);
        assert_eq!(t2.escalation_level, 1);
        assert_eq!(t2.session.distraction_count, 1);
    }

    #[test]
    fn distracted_to_ignored_after_ignored_threshold_since_signal_began() {
        let (mut engine, _) = FocusEngine::start(config(Persistent, 3600), Time::from_secs(0));
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(0),
        );
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(8),
        ); // -> Distracted
        let t = engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(59),
        );
        assert_eq!(t.to, FocusState::Distracted);
        let t2 = engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(60),
        );
        assert_eq!(t2.to, FocusState::Ignored);
        assert_eq!(t2.escalation_level, 2);
    }

    #[test]
    fn ignored_to_intervention_requires_permissive_profile() {
        let (mut engine, _) = FocusEngine::start(config(Gentle, 1_000_000), Time::from_secs(0));
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(0),
        );
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(8),
        ); // Distracted
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(60),
        ); // Ignored
           // Gentle caps here: even long past the intervention threshold it
           // must never escalate further (session duration is long enough
           // that this isn't just duration-completion firing instead).
        let t = engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(10_000),
        );
        assert_eq!(t.to, FocusState::Ignored);
        assert_eq!(t.session.intervention_count, 0);
    }

    #[test]
    fn ignored_to_intervention_under_persistent_caps_at_level_3() {
        let (mut engine, _) = FocusEngine::start(config(Persistent, 3600), Time::from_secs(0));
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(0),
        );
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(8),
        );
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(60),
        );
        let t = engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(180),
        );
        assert_eq!(t.to, FocusState::Intervention);
        assert_eq!(t.escalation_level, 3);
        assert_eq!(t.session.intervention_count, 1);
    }

    #[test]
    fn ignored_to_intervention_under_nuclear_reaches_escalation_level_4() {
        let (mut engine, _) = FocusEngine::start(config(Nuclear, 3600), Time::from_secs(0));
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(0),
        );
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(8),
        );
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(60),
        );
        let t = engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(180),
        );
        assert_eq!(t.to, FocusState::Intervention);
        assert_eq!(t.escalation_level, 4);
    }

    #[test]
    fn ruthless_also_reaches_intervention_but_caps_at_level_3() {
        let (mut engine, _) = FocusEngine::start(config(Ruthless, 3600), Time::from_secs(0));
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(0),
        );
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(8),
        );
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(60),
        );
        let t = engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(180),
        );
        assert_eq!(t.to, FocusState::Intervention);
        assert_eq!(t.escalation_level, 3);
    }

    #[test]
    fn recovery_from_intervention_requires_confirm_period_and_resets_to_zero() {
        let (mut engine, _) = FocusEngine::start(config(Nuclear, 3600), Time::from_secs(0));
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(0),
        );
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(8),
        );
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(60),
        );
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(180),
        ); // Intervention, level 4

        let t = engine.handle(EngineInput::Activity(focus_sample()), Time::from_secs(181));
        assert_eq!(t.to, FocusState::Recovering);
        // Escalation level frozen at 4 while recovering.
        assert_eq!(t.escalation_level, 4);

        let t2 = engine.handle(EngineInput::Activity(focus_sample()), Time::from_secs(184));
        assert_eq!(t2.to, FocusState::Recovering);
        assert_eq!(t2.escalation_level, 4);

        let t3 = engine.handle(EngineInput::Activity(focus_sample()), Time::from_secs(186));
        assert_eq!(t3.to, FocusState::Focused);
        assert_eq!(t3.escalation_level, 0);
    }

    #[test]
    fn distraction_during_recovery_resets_straight_to_distracted() {
        let (mut engine, _) = FocusEngine::start(config(Persistent, 3600), Time::from_secs(0));
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(0),
        );
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(8),
        ); // Distracted
        let t = engine.handle(EngineInput::Activity(focus_sample()), Time::from_secs(9));
        assert_eq!(t.to, FocusState::Recovering);

        // A distraction signal arrives before the 5s recovery-confirm
        // period elapses -> straight back to Distracted, timers reset (not
        // continuing the old anchor from t=0).
        let t2 = engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(11),
        );
        assert_eq!(t2.to, FocusState::Distracted);
        assert_eq!(t2.escalation_level, 1);
        assert_eq!(t2.session.distraction_count, 2);

        // Because the anchor reset to t=11, the ignored threshold (60s)
        // should not fire until t=71, not t=60.
        let t3 = engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(70),
        );
        assert_eq!(t3.to, FocusState::Distracted);
        let t4 = engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(71),
        );
        assert_eq!(t4.to, FocusState::Ignored);
    }

    #[test]
    fn acknowledge_intervention_always_unsticks_the_ui() {
        let (mut engine, _) = FocusEngine::start(config(Nuclear, 3600), Time::from_secs(0));
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(0),
        );
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(8),
        );
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(60),
        );
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(180),
        ); // Intervention

        // Acknowledged even though the user has not actually returned to
        // focus yet -- must move to Recovering immediately.
        let t = engine.handle(EngineInput::AcknowledgeIntervention, Time::from_secs(181));
        assert_eq!(t.to, FocusState::Recovering);
        assert_eq!(t.escalation_level, 4); // still frozen, not reset yet

        // Still distracted right after acknowledging: recovery has not
        // been confirmed by an actual focus signal, so a distraction
        // signal should send it back to Distracted rather than pretending
        // recovery already happened.
        let t2 = engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(182),
        );
        assert_eq!(t2.to, FocusState::Distracted);
    }

    #[test]
    fn abandon_from_any_active_state_is_terminal_and_ignores_further_input() {
        let (mut engine, _) = FocusEngine::start(config(Persistent, 3600), Time::from_secs(0));
        let t = engine.handle(EngineInput::Abandon, Time::from_secs(5));
        assert_eq!(t.to, FocusState::Abandoned);

        // Further input must not resurrect the session.
        let t2 = engine.handle(EngineInput::Activity(focus_sample()), Time::from_secs(6));
        assert_eq!(t2.to, FocusState::Abandoned);
        assert_eq!(t2.from, FocusState::Abandoned);
    }

    #[test]
    fn session_completes_once_planned_duration_elapses() {
        let (mut engine, _) = FocusEngine::start(config(Persistent, 60), Time::from_secs(0));
        let t = engine.handle(EngineInput::Tick, Time::from_secs(59));
        assert_eq!(t.to, FocusState::Focused);
        let t2 = engine.handle(EngineInput::Tick, Time::from_secs(60));
        assert_eq!(t2.to, FocusState::Completed);
        assert_eq!(t2.session.remaining_secs, 0);
    }

    #[test]
    fn duration_completion_takes_priority_over_other_inputs() {
        let (mut engine, _) = FocusEngine::start(config(Persistent, 60), Time::from_secs(0));
        // Even an Abandon input arriving after the deadline should resolve
        // to Completed, per "any state ... if now >= session_end_at ->
        // Completed" being evaluated first.
        let t = engine.handle(EngineInput::Abandon, Time::from_secs(61));
        assert_eq!(t.to, FocusState::Completed);
    }

    #[test]
    fn duration_completion_fires_even_mid_escalation() {
        let (mut engine, _) = FocusEngine::start(config(Nuclear, 100), Time::from_secs(0));
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(0),
        );
        engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(8),
        );
        let t = engine.handle(
            EngineInput::Activity(distracting_app_sample()),
            Time::from_secs(100),
        );
        assert_eq!(t.to, FocusState::Completed);
    }
}
