use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetadataFinding {
    pub container: String,
    pub signal: String,
    pub detail: String,
    pub snippet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetadataReport {
    pub findings: Vec<MetadataFinding>,
}

impl MetadataReport {
    pub fn has_ai_metadata(&self) -> bool {
        !self.findings.is_empty()
    }

    pub fn summary(&self) -> String {
        if self.findings.is_empty() {
            return "No AI metadata signatures found".to_string();
        }
        let signals: std::collections::HashSet<&str> =
            self.findings.iter().map(|f| f.signal.as_str()).collect();
        signals.into_iter().collect::<Vec<_>>().join(", ")
    }
}

struct AiSignal {
    pattern: regex::Regex,
    signal: &'static str,
}

pub struct MetadataInspector {
    signals: Vec<AiSignal>,
}

impl MetadataInspector {
    pub fn new() -> Self {
        use regex::Regex;
        let signals = vec![
            AiSignal {
                pattern: Regex::new("(?i)(stable[- ]?diffusion|sdxl|automatic1111|a1111|comfyui|invokeai|midjourney|dall[- .·]?e|firefly|aigc)").unwrap(),
                signal: "AI generator metadata",
            },
            AiSignal {
                pattern: Regex::new("(?i)(negative prompt|cfg scale|sampler|model hash|checkpoint|lora|controlnet|workflow|steps:\\s*\\d+|seed:\\s*\\d+)").unwrap(),
                signal: "Stable Diffusion prompt/parameters",
            },
            AiSignal {
                pattern: Regex::new("(?i)(c2pa|content credentials|jumbf|trainedalgorithmicmedia|digitalSourceType|ai[-.]?disclosure|softwareAgent)").unwrap(),
                signal: "C2PA/content provenance metadata",
            },
            AiSignal {
                pattern: Regex::new("(?i)(xmpmeta|xmp:creatortool|dc:description|photoshop:instructions)").unwrap(),
                signal: "XMP creator/source metadata",
            },
        ];
        Self { signals }
    }

    pub fn inspect(&self, bytes: &[u8]) -> MetadataReport {
        let findings = if Self::is_png(bytes) {
            self.inspect_png(bytes)
        } else if Self::is_jpeg(bytes) {
            self.inspect_jpeg(bytes)
        } else if Self::is_webp(bytes) {
            self.inspect_webp(bytes)
        } else {
            self.find_signals("Binary scan", &Self::decode_readable(bytes))
        };
        MetadataReport { findings }
    }

    fn inspect_png(&self, bytes: &[u8]) -> Vec<MetadataFinding> {
        let mut findings = Vec::new();
        let metadata_chunks = ["tEXt", "zTXt", "iTXt", "eXIf", "iCCP", "caBX", "c2pa"];
        let c2pa_chunks = ["caBX", "c2pa"];

        let mut offset = 8usize;
        while offset + 12 <= bytes.len() {
            let length = u32::from_be_bytes([bytes[offset], bytes[offset+1], bytes[offset+2], bytes[offset+3]]) as usize;
            let data_start = offset + 8;
            let data_end = data_start + length;
            let next = data_end + 4;
            if data_end > bytes.len() || next > bytes.len() { break; }

            let chunk_type = std::str::from_utf8(&bytes[offset+4..offset+8]).unwrap_or("????");
            if metadata_chunks.contains(&chunk_type) {
                if c2pa_chunks.contains(&chunk_type) {
                    findings.push(MetadataFinding {
                        container: format!("PNG {chunk_type}"),
                        signal: "C2PA/content provenance metadata".to_string(),
                        detail: "C2PA container".to_string(),
                        snippet: "C2PA container present".to_string(),
                    });
                }
                let data = &bytes[data_start..data_end];
                let text = self.decode_png_metadata(chunk_type, data);
                findings.extend(self.find_signals(&format!("PNG {chunk_type}"), &text));
            }
            offset = next;
        }
        findings
    }

    fn inspect_jpeg(&self, bytes: &[u8]) -> Vec<MetadataFinding> {
        let mut findings = Vec::new();
        let mut offset = 2usize;

        while offset + 4 <= bytes.len() {
            if bytes[offset] != 0xFF {
                offset += 1;
                continue;
            }
            while offset < bytes.len() && bytes[offset] == 0xFF { offset += 1; }
            if offset >= bytes.len() { break; }

            let marker = bytes[offset];
            offset += 1;
            if marker == 0xD9 || marker == 0xDA { break; }
            if matches!(marker, 0x01 | 0xD0..=0xD7) { continue; }
            if offset + 2 > bytes.len() { break; }

            let length = ((bytes[offset] as usize) << 8) | bytes[offset+1] as usize;
            if length < 2 || offset + length > bytes.len() { break; }

            if (0xE1..=0xEF).contains(&marker) || marker == 0xFE {
                let payload = &bytes[offset+2..offset+length];
                let container = if marker == 0xFE { "JPEG COM" } else { "JPEG APP" };
                findings.extend(self.find_signals(container, &Self::decode_readable(payload)));
            }
            offset += length;
        }
        findings
    }

    fn inspect_webp(&self, bytes: &[u8]) -> Vec<MetadataFinding> {
        let mut findings = Vec::new();
        let metadata_chunks = ["EXIF", "XMP ", "ICCP", "C2PA"];
        let mut offset = 12usize;

        while offset + 8 <= bytes.len() {
            let chunk_type = std::str::from_utf8(&bytes[offset..offset+4]).unwrap_or("????");
            let size = u32::from_le_bytes([bytes[offset+4], bytes[offset+5], bytes[offset+6], bytes[offset+7]]) as usize;
            let data_start = offset + 8;
            let data_end = data_start + size;
            if data_end > bytes.len() { break; }

            if metadata_chunks.contains(&chunk_type) {
                findings.extend(self.find_signals(
                    &format!("WebP {chunk_type}"),
                    &Self::decode_readable(&bytes[data_start..data_end]),
                ));
            }
            offset = data_end + if size % 2 == 1 { 1 } else { 0 };
        }
        findings
    }

    fn find_signals(&self, container: &str, text: &str) -> Vec<MetadataFinding> {
        if text.trim().is_empty() { return Vec::new(); }
        let mut findings = Vec::new();
        for signal in &self.signals {
            if let Some(m) = signal.pattern.find(text) {
                findings.push(MetadataFinding {
                    container: container.to_string(),
                    signal: signal.signal.to_string(),
                    detail: m.as_str().to_string(),
                    snippet: Self::snippet(text, m.start()),
                });
            }
        }
        findings
    }

    fn decode_png_metadata(&self, chunk_type: &str, data: &[u8]) -> String {
        match chunk_type {
            "tEXt" => Self::decode_readable(data),
            "zTXt" => {
                let zero_pos = data.iter().position(|&b| b == 0);
                match zero_pos {
                    Some(zero) if zero + 2 < data.len() => {
                        let keyword = String::from_utf8_lossy(&data[..zero]);
                        let compressed = &data[zero+2..];
                        let inflated = Self::inflate_readable(compressed);
                        format!("{keyword} {inflated}")
                    }
                    _ => Self::decode_readable(data),
                }
            }
            "iTXt" => {
                let keyword_end = data.iter().position(|&b| b == 0);
                match keyword_end {
                    Some(kw_end) if kw_end + 3 < data.len() => {
                        let keyword = String::from_utf8_lossy(&data[..kw_end]);
                        let compressed = data[kw_end + 1] == 1;
                        let mut off = kw_end + 3;
                        if let Some(lang_end) = data[off..].iter().position(|&b| b == 0) {
                            off += lang_end + 1;
                        } else {
                            return Self::decode_readable(data);
                        }
                        if let Some(tr_end) = data[off..].iter().position(|&b| b == 0) {
                            off += tr_end + 1;
                        } else {
                            return Self::decode_readable(data);
                        }
                        let text = &data[off..];
                        if compressed {
                            format!("{} {}", keyword, Self::inflate_readable(text))
                        } else {
                            format!("{} {}", keyword, String::from_utf8_lossy(text))
                        }
                    }
                    _ => Self::decode_readable(data),
                }
            }
            _ => Self::decode_readable(data),
        }
    }

    fn inflate_readable(data: &[u8]) -> String {
        use std::io::Read;
        match flate2::read::ZlibDecoder::new(data).bytes().collect::<Result<Vec<u8>, _>>() {
            Ok(decompressed) => String::from_utf8_lossy(&decompressed).to_string(),
            Err(_) => Self::decode_readable(data),
        }
    }

    fn decode_readable(bytes: &[u8]) -> String {
        String::from_utf8_lossy(bytes).to_string()
    }

    fn snippet(text: &str, start: usize) -> String {
        let begin = start.saturating_sub(40);
        let end = (start + 120).min(text.len());
        text[begin..end].split_whitespace().collect::<Vec<_>>().join(" ")
    }

    fn is_png(bytes: &[u8]) -> bool {
        bytes.len() >= 8 && bytes[..8] == [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
    }

    fn is_jpeg(bytes: &[u8]) -> bool {
        bytes.len() >= 2 && bytes[0] == 0xFF && bytes[1] == 0xD8
    }

    fn is_webp(bytes: &[u8]) -> bool {
        bytes.len() >= 12
            && &bytes[0..4] == b"RIFF"
            && &bytes[8..12] == b"WEBP"
    }
}
