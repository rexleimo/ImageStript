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
        let mut img = image::load_from_memory(input_bytes)
            .map_err(|e| format!("Failed to decode image: {e}"))?;

        if self.params.resize_scale < 1.0 {
            img = Self::resize_perturb(&img, self.params.resize_scale);
        }

        if self.params.noise_fraction > 0.0 {
            Self::inject_noise(&mut img, self.params.noise_fraction, self.params.noise_strength);
        }

        let output = if self.params.jpeg_quality < 100 {
            Self::jpeg_roundtrip(&img, self.params.jpeg_quality)?
        } else {
            Self::encode_clean_png(&img)?
        };

        Ok(output)
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

    fn jpeg_roundtrip(img: &DynamicImage, quality: u8) -> Result<Vec<u8>, String> {
        let mut jpeg_buf = std::io::Cursor::new(Vec::new());
        let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_buf, quality);
        img.write_with_encoder(encoder)
            .map_err(|e| format!("Failed to encode JPEG: {e}"))?;

        let jpeg_bytes = jpeg_buf.into_inner();
        let redecoded = image::load_from_memory_with_format(&jpeg_bytes, ImageFormat::Jpeg)
            .map_err(|e| format!("Failed to re-decode JPEG: {e}"))?;

        Self::encode_clean_png(&redecoded)
    }
}
