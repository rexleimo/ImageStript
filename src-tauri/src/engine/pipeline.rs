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

        // Step 1: Resize perturb (breaks spatial watermark alignment)
        if self.params.resize_scale < 1.0 {
            current = Self::resize_perturb(&current, self.params.resize_scale);
        }

        // Step 2: JPEG round-trip (breaks frequency-domain watermarks)
        if self.params.jpeg_quality < 100 {
            current = Self::jpeg_roundtrip_img(&current, self.params.jpeg_quality)?;
        }

        // Step 3: Second resize perturb (small, breaks watermark after JPEG)
        if self.params.resize_scale < 1.0 {
            current = Self::resize_perturb(&current, (self.params.resize_scale + 1.0) / 2.0);
        }

        // Step 4: Noise injection (disrupts statistical watermark patterns)
        if self.params.noise_fraction > 0.0 {
            Self::inject_noise(&mut current, self.params.noise_fraction, self.params.noise_strength);
        }

        // Step 5: Pixel value quantization (defeats LSB-based watermarks)
        Self::quantize_pixels(&mut current, 2);

        // Step 6: Channel shuffle perturbation (breaks cross-channel watermark correlation)
        Self::channel_perturb(&mut current, 0.005);

        // Step 7: Final encode as clean PNG (strips all metadata containers)
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

    fn inject_noise(img: &mut DynamicImage, fraction: f64, strength: u8) {
        let mut rng = rand::rng();
        let (w, h) = img.dimensions();
        let strength_i = strength as i16;

        for y in 0..h {
            for x in 0..w {
                if rng.random::<f64>() >= fraction { continue; }
                let Rgba([r, g, b, a]) = img.get_pixel(x, y);
                let dr: i16 = rng.random_range(-strength_i..=strength_i);
                let dg: i16 = rng.random_range(-strength_i..=strength_i);
                let db: i16 = rng.random_range(-strength_i..=strength_i);
                let nr = (r as i16 + dr).clamp(0, 255) as u8;
                let ng = (g as i16 + dg).clamp(0, 255) as u8;
                let nb = (b as i16 + db).clamp(0, 255) as u8;
                img.put_pixel(x, y, Rgba([nr, ng, nb, a]));
            }
        }
    }

    fn quantize_pixels(img: &mut DynamicImage, step: u8) {
        let (w, h) = img.dimensions();
        let half = step / 2;
        for y in 0..h {
            for x in 0..w {
                let Rgba([r, g, b, a]) = img.get_pixel(x, y);
                let qr = ((r / step) * step + half).min(255);
                let qg = ((g / step) * step + half).min(255);
                let qb = ((b / step) * step + half).min(255);
                img.put_pixel(x, y, Rgba([qr, qg, qb, a]));
            }
        }
    }

    fn channel_perturb(img: &mut DynamicImage, fraction: f64) {
        let mut rng = rand::rng();
        let (w, h) = img.dimensions();
        for y in 0..h {
            for x in 0..w {
                if rng.random::<f64>() >= fraction { continue; }
                let Rgba([r, g, b, a]) = img.get_pixel(x, y);
                let shift: i16 = rng.random_range(-2..=2);
                let nr = (r as i16 + shift).clamp(0, 255) as u8;
                let ng = (g as i16 - shift).clamp(0, 255) as u8;
                img.put_pixel(x, y, Rgba([nr, ng, b, a]));
            }
        }
    }

    fn jpeg_roundtrip_img(img: &DynamicImage, quality: u8) -> Result<DynamicImage, String> {
        let mut jpeg_buf = std::io::Cursor::new(Vec::new());
        let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_buf, quality);
        img.write_with_encoder(encoder)
            .map_err(|e| format!("Failed to encode JPEG: {e}"))?;

        let jpeg_bytes = jpeg_buf.into_inner();
        image::load_from_memory_with_format(&jpeg_bytes, ImageFormat::Jpeg)
            .map_err(|e| format!("Failed to re-decode JPEG: {e}"))
    }
}
