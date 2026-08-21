//! The frog's personality system: a fixed message bank keyed by
//! `(Personality, EscalationLevel)`, chosen pseudo-randomly so the same
//! session doesn't repeat itself, without pulling in a full `rand`
//! dependency for flavor text.

use crate::engine::EscalationLevel;
use serde::{Deserialize, Serialize};

/// Serialized with serde's default (PascalCase) to match the frontend's
/// `Personality` TS union in `src/ipc/types.ts`. `as_str()` below is the
/// separate lowercase/snake_case form used for DB storage only.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Personality {
    Friendly,
    PassiveAggressive,
    DrillSergeant,
    Chaotic,
    Zen,
}

impl Personality {
    pub fn as_str(self) -> &'static str {
        match self {
            Personality::Friendly => "friendly",
            Personality::PassiveAggressive => "passive_aggressive",
            Personality::DrillSergeant => "drill_sergeant",
            Personality::Chaotic => "chaotic",
            Personality::Zen => "zen",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "friendly" => Some(Personality::Friendly),
            "passive_aggressive" => Some(Personality::PassiveAggressive),
            "drill_sergeant" => Some(Personality::DrillSergeant),
            "chaotic" => Some(Personality::Chaotic),
            "zen" => Some(Personality::Zen),
            _ => None,
        }
    }
}

/// Frog mood, sent alongside message text so the frontend can pick the
/// right sprite/animation variant.
fn mood_for(level: EscalationLevel) -> &'static str {
    match level {
        EscalationLevel::None => "content",
        EscalationLevel::Distracted => "concerned",
        EscalationLevel::Ignored => "annoyed",
        EscalationLevel::Intervention => "alarmed",
        EscalationLevel::NuclearOverlay => "furious",
    }
}

pub struct CompanionMessage {
    pub text: &'static str,
    pub mood: &'static str,
}

/// A small fixed set of lines per `(Personality, EscalationLevel)` cell.
pub struct MessageBank;

impl MessageBank {
    /// Picks a line deterministically from `session_id` + a caller-supplied
    /// counter (e.g. number of transitions so far), so repeat calls within
    /// a session cycle through the bank rather than repeating the same
    /// line, without needing a `rand` dependency.
    pub fn pick(
        personality: Personality,
        level: EscalationLevel,
        session_id: &str,
        counter: u64,
    ) -> CompanionMessage {
        let lines = Self::lines(personality, level);
        let idx = (Self::mix(session_id, counter) as usize) % lines.len();
        CompanionMessage {
            text: lines[idx],
            mood: mood_for(level),
        }
    }

    /// Simple FNV-1a style mix of a string and a counter -- enough entropy
    /// to distribute picks across a short list without a real RNG.
    fn mix(session_id: &str, counter: u64) -> u64 {
        let mut hash: u64 = 0xcbf29ce484222325;
        for byte in session_id.bytes().chain(counter.to_le_bytes()) {
            hash ^= byte as u64;
            hash = hash.wrapping_mul(0x100000001b3);
        }
        hash
    }

    fn lines(personality: Personality, level: EscalationLevel) -> &'static [&'static str] {
        use EscalationLevel::*;
        use Personality::*;
        match (personality, level) {
            (Friendly, None) => &["You've got this!", "Nice and steady.", "Loving this focus."],
            (Friendly, Distracted) => &[
                "Hey, I noticed you wandered off a bit. All good?",
                "Just checking in -- still with the goal?",
            ],
            (Friendly, Ignored) => &[
                "It's been a little while now. Come on back?",
                "I believe in you, but I also believe you're on Twitter.",
            ],
            (Friendly, Intervention) => &[
                "Okay, real talk: let's get back to it together.",
                "I'm not mad, just a little croaky with worry.",
            ],
            (Friendly, NuclearOverlay) => {
                &["This is the big one. Let's refocus, right now, together."]
            }

            (PassiveAggressive, None) => &["Oh, look who's actually working.", "Cute, focus."],
            (PassiveAggressive, Distracted) => &[
                "Interesting choice, going there right now.",
                "No, it's fine. I'll just wait.",
            ],
            (PassiveAggressive, Ignored) => &[
                "Take your time. I have literally nothing else to do.",
                "This is fine. Everything is fine.",
            ],
            (PassiveAggressive, Intervention) => &[
                "Wow. Really committing to the distraction, huh.",
                "I'm sure your goal understands.",
            ],
            (PassiveAggressive, NuclearOverlay) => {
                &["Congratulations, you've unlocked my full attention."]
            }

            (DrillSergeant, None) => &["Good. Keep moving.", "That's what I like to see."],
            (DrillSergeant, Distracted) => &[
                "Eyes front! What are you doing?",
                "That is NOT the goal, soldier.",
            ],
            (DrillSergeant, Ignored) => &[
                "This is your final warning. Get back in the fight.",
                "I did not raise you to scroll like this.",
            ],
            (DrillSergeant, Intervention) => &[
                "DROP WHAT YOU'RE DOING AND REFOCUS. NOW.",
                "This is unacceptable. Fix it.",
            ],
            (DrillSergeant, NuclearOverlay) => {
                &["FULL STOP. YOU ARE NOT LEAVING THIS SCREEN UNTIL YOU REFOCUS."]
            }

            (Chaotic, None) => &["WOO focus go brrr", "yes good keep doing the thing"],
            (Chaotic, Distracted) => &["wait wait wait what happened", "did you just... leave?"],
            (Chaotic, Ignored) => &[
                "i am vibrating with concern right now",
                "the goal misses you. i miss you.",
            ],
            (Chaotic, Intervention) => &[
                "OKAY THIS IS A LOT. PLEASE COME BACK.",
                "im doing a bit but also im serious",
            ],
            (Chaotic, NuclearOverlay) => &["EMERGENCY FROG PROTOCOL ACTIVATED. RETURN. NOW."],

            (Zen, None) => &["Breathe. Continue.", "This moment, this task."],
            (Zen, Distracted) => &[
                "Notice the pull. You may return whenever you choose.",
                "A wandering mind is only a mind that can come home.",
            ],
            (Zen, Ignored) => &[
                "The goal waits without judgment. So do I.",
                "Still here, still patient, still hopeful.",
            ],
            (Zen, Intervention) => &[
                "Let this be the moment you choose to return.",
                "Nothing is lost yet. Come back.",
            ],
            (Zen, NuclearOverlay) => &["Everything else can wait. This cannot. Return now."],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // `Personality` is serialized PascalCase over IPC (matches the frontend
    // union in src/ipc/types.ts exactly, per ARCHITECTURE.md section 12) --
    // distinct from `as_str()`/`parse()` below, which are the separate
    // snake_case DB-storage form.
    #[test]
    fn personality_wire_format_parses_expected_pascal_case_values() {
        assert_eq!(
            serde_json::from_str::<Personality>("\"Friendly\"").unwrap(),
            Personality::Friendly
        );
        assert_eq!(
            serde_json::from_str::<Personality>("\"PassiveAggressive\"").unwrap(),
            Personality::PassiveAggressive
        );
    }

    #[test]
    fn personality_wire_format_rejects_snake_case_or_unknown_values() {
        assert!(serde_json::from_str::<Personality>("\"friendly\"").is_err());
        assert!(serde_json::from_str::<Personality>("\"Grumpy\"").is_err());
    }

    #[test]
    fn personality_as_str_and_parse_round_trip_for_every_variant() {
        for p in [
            Personality::Friendly,
            Personality::PassiveAggressive,
            Personality::DrillSergeant,
            Personality::Chaotic,
            Personality::Zen,
        ] {
            assert_eq!(Personality::parse(p.as_str()), Some(p));
        }
    }

    #[test]
    fn personality_parse_rejects_unknown_db_strings() {
        // Exercises the fallback path DB readers rely on
        // (`Personality::parse(..).unwrap_or(Personality::Friendly)` in
        // db/repository.rs::get_companion_profile) when a row somehow
        // contains a value that doesn't match any `as_str()` output.
        assert_eq!(Personality::parse("grumpy"), None);
        assert_eq!(Personality::parse(""), None);
        assert_eq!(Personality::parse("Friendly"), None); // wrong case
    }
}
