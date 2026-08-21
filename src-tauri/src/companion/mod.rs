pub mod personality;

pub use personality::{MessageBank, Personality};
use serde::{Deserialize, Serialize};

/// The single-row `companion_profile` domain type. `id` is always `1`
/// (there is only ever one row) -- included because the frontend's
/// `CompanionProfile` TS type carries it as a literal `1`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanionProfile {
    pub id: u8,
    pub species: String,
    pub name: String,
    pub personality: Personality,
    pub level: u32,
    pub experience: u32,
    pub created_at: String,
    pub updated_at: String,
}
