export interface MetadataFinding {
  container: string;
  signal: string;
  detail: string;
  snippet: string;
}

export interface MetadataReport {
  findings: MetadataFinding[];
}

export interface ProcessParams {
  noise_fraction: number;
  noise_strength: number;
  resize_scale: number;
  jpeg_quality: number;
}

export interface ProcessResponse {
  output_path: string;
  report: MetadataReport;
  image_data: string;
}

export interface BatchItemResult {
  path: string;
  output_path: string | null;
  image_data: string | null;
  report: MetadataReport | null;
  error: string | null;
}

export interface BatchResponse {
  results: BatchItemResult[];
}

export interface ImageEntry {
  name: string;
  path: string;
  source: string;
  report: MetadataReport | null;
  size: number;
}

export type Preset = "Subtle" | "Standard" | "Aggressive";

export const PRESET_PARAMS: Record<Preset, ProcessParams> = {
  Subtle: { noise_fraction: 0.01, noise_strength: 1, resize_scale: 0.999, jpeg_quality: 99 },
  Standard: { noise_fraction: 0.03, noise_strength: 1, resize_scale: 0.998, jpeg_quality: 97 },
  Aggressive: { noise_fraction: 0.06, noise_strength: 2, resize_scale: 0.995, jpeg_quality: 92 },
};
