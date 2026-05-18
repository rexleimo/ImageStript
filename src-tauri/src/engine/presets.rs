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
            resize_scale: 0.997,
            jpeg_quality: 95,
        }
    }

    pub fn standard() -> Self {
        Self {
            noise_fraction: 0.04,
            noise_strength: 2,
            resize_scale: 0.993,
            jpeg_quality: 90,
        }
    }

    pub fn aggressive() -> Self {
        Self {
            noise_fraction: 0.08,
            noise_strength: 3,
            resize_scale: 0.985,
            jpeg_quality: 82,
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

impl std::hash::Hash for ProcessParams {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.noise_fraction.to_bits().hash(state);
        self.noise_strength.hash(state);
        self.resize_scale.to_bits().hash(state);
        self.jpeg_quality.hash(state);
    }
}

impl PartialEq for ProcessParams {
    fn eq(&self, other: &Self) -> bool {
        self.noise_fraction == other.noise_fraction
            && self.noise_strength == other.noise_strength
            && self.resize_scale == other.resize_scale
            && self.jpeg_quality == other.jpeg_quality
    }
}

impl Eq for ProcessParams {}
