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
  Subtle: { noise_fraction: 0.01, noise_strength: 1, resize_scale: 0.997, jpeg_quality: 95 },
  Standard: { noise_fraction: 0.04, noise_strength: 2, resize_scale: 0.993, jpeg_quality: 90 },
  Aggressive: { noise_fraction: 0.08, noise_strength: 3, resize_scale: 0.985, jpeg_quality: 82 },
};
