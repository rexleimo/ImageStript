use image::{DynamicImage, GenericImage, GenericImageView, ImageFormat, Rgba};
use rand::Rng;
use crate::engine::presets::ProcessParams;
use crate::engine::inspector::{MetadataInspector, MetadataReport};

pub struct ProcessResult {
    pub output_bytes: Vec<u8>,
    pub report: MetadataReport,
}

pub struct Pipeline {
    params: ProcessParams,
    inspector: MetadataInspector,
}

impl Pipeline {
    pub fn new(params: ProcessParams) -> Self {
        Self {
            params,
            inspector: MetadataInspector::new(),
        }
    }

    pub fn inspect(&self, bytes: &[u8]) -> MetadataReport {
        self.inspector.inspect(bytes)
    }

    pub fn process(&self, input_bytes: &[u8]) -> Result<Vec<u8>, String> {
        let img = image::load_from_memory(input_bytes)
            .map_err(|e| format!("Failed to decode image: {e}"))?;

        let mut current = img;

        // Stage 1: Resize down then back up
        // Breaks spatial watermark alignment, Lanczos3 resampling
        // introduces natural interpolation artifacts
        if self.params.resize_scale < 1.0 {
            current = Self::resize_perturb(&current, self.params.resize_scale);
        }

        // Stage 2: JPEG round-trip at moderate quality
        // This is the strongest single countermeasure:
        // - DCT quantization destroys frequency-domain watermarks
        // - 8x8 block boundaries disrupt spatial patterns
        // - Chroma subsampling breaks cross-channel correlation
        if self.params.jpeg_quality < 100 {
            current = Self::jpeg_roundtrip(&current, self.params.jpeg_quality)?;
        }

        // Stage 3: Second subtle resize perturbation
        // After JPEG introduced block artifacts, resize again to smooth
        // and break any watermark that survived JPEG
        if self.params.resize_scale < 1.0 {
            let mid_scale = (self.params.resize_scale + 1.0) / 2.0;
            current = Self::resize_perturb(&current, mid_scale);
        }

        // Stage 4: Noise injection with natural distribution
        // Gaussian-like noise approximated by sum of uniform randoms
        // Only applied to a fraction of pixels, maintaining statistical normality
        if self.params.noise_fraction > 0.0 {
            Self::inject_natural_noise(&mut current, self.params.noise_fraction, self.params.noise_strength);
        }

        // Stage 5: LSB randomization
        // Instead of quantizing to even (detectable!), randomize LSBs
        // This ensures LSB distribution is ~50/50 (natural) while destroying
        // any LSB-encoded watermark
        Self::randomize_lsbs(&mut current);

        // Stage 6: Encode as clean PNG with no metadata
        Self::encode_clean_png(&current)
    }

    pub fn process_with_report(&self, input_bytes: &[u8]) -> Result<ProcessResult, String> {
        let report = self.inspector.inspect(input_bytes);
        let output_bytes = self.process(input_bytes)?;
        Ok(ProcessResult { output_bytes, report })
    }

    fn encode_clean_png(img: &DynamicImage) -> Result<Vec<u8>, String> {
        let mut buf = std::io::Cursor::new(Vec::new());
        img.write_to(&mut buf, ImageFormat::Png)
            .map_err(|e| format!("Failed to encode PNG: {e}"))?;
        Ok(buf.into_inner())
    }

    fn resize_perturb(img: &DynamicImage, scale: f64) -> DynamicImage {
        let w = img.width();
        let h = img.height();
        let small_w = ((w as f64 * scale) as u32).max(1).min(w);
        let small_h = ((h as f64 * scale) as u32).max(1).min(h);
        let small = img.resize_exact(small_w, small_h, image::imageops::FilterType::Lanczos3);
        small.resize_exact(w, h, image::imageops::FilterType::Lanczos3)
    }

    /// Natural noise injection: approximates Gaussian noise by summing 3 uniform randoms.
    /// Preserves statistical normality of the image.
    fn inject_natural_noise(img: &mut DynamicImage, fraction: f64, strength: u8) {
        let mut rng = rand::rng();
        let (w, h) = img.dimensions();
        let s = strength as i32;

        for y in 0..h {
            for x in 0..w {
                if rng.random::<f64>() >= fraction { continue; }
                let Rgba([r, g, b, a]) = img.get_pixel(x, y);

                // Approximate Gaussian via sum of 3 uniform [-s, s]
                let dr: i32 = (rng.random_range(-s..=s) + rng.random_range(-s..=s) + rng.random_range(-s..=s)) / 3;
                let dg: i32 = (rng.random_range(-s..=s) + rng.random_range(-s..=s) + rng.random_range(-s..=s)) / 3;
                let db: i32 = (rng.random_range(-s..=s) + rng.random_range(-s..=s) + rng.random_range(-s..=s)) / 3;

                let nr = (r as i32 + dr).clamp(0, 255) as u8;
                let ng = (g as i32 + dg).clamp(0, 255) as u8;
                let nb = (b as i32 + db).clamp(0, 255) as u8;
                img.put_pixel(x, y, Rgba([nr, ng, nb, a]));
            }
        }
    }

    /// Randomize all LSBs across all color channels.
    /// Destroys any LSB-encoded watermark while keeping the distribution
    /// statistically indistinguishable from natural images (~50% even, ~50% odd).
    fn randomize_lsbs(img: &mut DynamicImage) {
        let mut rng = rand::rng();
        let (w, h) = img.dimensions();

        for y in 0..h {
            for x in 0..w {
                let Rgba([r, g, b, a]) = img.get_pixel(x, y);
                let bit: u8 = if rng.random::<f64>() < 0.5 { 0 } else { 1 };
                let bit2: u8 = if rng.random::<f64>() < 0.5 { 0 } else { 1 };
                let bit3: u8 = if rng.random::<f64>() < 0.5 { 0 } else { 1 };
                let nr = (r & 0xFE) | bit;
                let ng = (g & 0xFE) | bit2;
                let nb = (b & 0xFE) | bit3;
                img.put_pixel(x, y, Rgba([nr, ng, nb, a]));
            }
        }
    }

    fn jpeg_roundtrip(img: &DynamicImage, quality: u8) -> Result<DynamicImage, String> {
        let mut jpeg_buf = std::io::Cursor::new(Vec::new());
        let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_buf, quality);
        img.write_with_encoder(encoder)
            .map_err(|e| format!("Failed to encode JPEG: {e}"))?;

        let jpeg_bytes = jpeg_buf.into_inner();
        image::load_from_memory_with_format(&jpeg_bytes, ImageFormat::Jpeg)
            .map_err(|e| format!("Failed to re-decode JPEG: {e}"))
    }
}
