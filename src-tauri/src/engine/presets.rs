use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum Preset {
    Subtle,
    Standard,
    Aggressive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessParams {
    pub noise_fraction: f64,
    pub noise_strength: u8,
    pub resize_scale: f64,
    pub jpeg_quality: u8,
}

impl Default for ProcessParams {
    fn default() -> Self {
        Self::standard()
    }
}

impl ProcessParams {
    pub fn subtle() -> Self {
        Self {
            noise_fraction: 0.01,
            noise_strength: 1,
            resize_scale: 0.999,
            jpeg_quality: 99,
        }
    }

    pub fn standard() -> Self {
        Self {
            noise_fraction: 0.03,
            noise_strength: 1,
            resize_scale: 0.998,
            jpeg_quality: 97,
        }
    }

    pub fn aggressive() -> Self {
        Self {
            noise_fraction: 0.06,
            noise_strength: 2,
            resize_scale: 0.995,
            jpeg_quality: 92,
        }
    }

    pub fn from_preset(preset: Preset) -> Self {
        match preset {
            Preset::Subtle => Self::subtle(),
            Preset::Standard => Self::standard(),
            Preset::Aggressive => Self::aggressive(),
        }
    }
}
