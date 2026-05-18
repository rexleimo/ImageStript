use crate::engine::inspector::MetadataReport;
use crate::engine::pipeline::Pipeline;
use crate::engine::presets::{Preset, ProcessParams};
use std::fs;
use std::path::PathBuf;

#[tauri::command]
pub fn inspect_image(path: String) -> Result<MetadataReport, String> {
    let bytes = fs::read(&path).map_err(|e| format!("Failed to read file: {e}"))?;
    let inspector = crate::engine::inspector::MetadataInspector::new();
    Ok(inspector.inspect(&bytes))
}

#[derive(serde::Serialize)]
pub struct ProcessResponse {
    pub output_path: String,
    pub report: MetadataReport,
}

#[tauri::command]
pub fn process_image(
    path: String,
    output_dir: Option<String>,
    params: Option<ProcessParams>,
    preset: Option<Preset>,
) -> Result<ProcessResponse, String> {
    let bytes = fs::read(&path).map_err(|e| format!("Failed to read file: {e}"))?;
    let effective_params = match (params, preset) {
        (Some(p), _) => p,
        (None, Some(pr)) => ProcessParams::from_preset(pr),
        (None, None) => ProcessParams::default(),
    };

    let pipeline = Pipeline::new(effective_params);
    let result = pipeline.process_with_report(&bytes)?;

    let input_path = PathBuf::from(&path);
    let stem = input_path.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
    let out = output_dir.unwrap_or_else(|| {
        input_path.parent()
            .map(|p| p.join("output"))
            .unwrap_or_else(|| PathBuf::from("output"))
            .to_string_lossy()
            .to_string()
    });
    fs::create_dir_all(&out).map_err(|e| format!("Failed to create output dir: {e}"))?;

    let output_path = format!("{out}/{stem}.png");
    fs::write(&output_path, &result.output_bytes)
        .map_err(|e| format!("Failed to write output: {e}"))?;

    Ok(ProcessResponse {
        output_path,
        report: result.report,
    })
}

#[derive(serde::Serialize)]
pub struct BatchResponse {
    pub results: Vec<BatchItemResult>,
}

#[derive(serde::Serialize)]
pub struct BatchItemResult {
    pub path: String,
    pub output_path: Option<String>,
    pub report: Option<MetadataReport>,
    pub error: Option<String>,
}

#[tauri::command]
pub fn process_batch(
    paths: Vec<String>,
    output_dir: Option<String>,
    params: Option<ProcessParams>,
    preset: Option<Preset>,
) -> Result<BatchResponse, String> {
    let effective_params = match (params, preset) {
        (Some(p), _) => p,
        (None, Some(pr)) => ProcessParams::from_preset(pr),
        (None, None) => ProcessParams::default(),
    };
    let pipeline = Pipeline::new(effective_params);

    let mut results = Vec::new();
    for path in &paths {
        match fs::read(path) {
            Ok(bytes) => {
                match pipeline.process_with_report(&bytes) {
                    Ok(proc_result) => {
                        let input_path = PathBuf::from(path);
                        let stem = input_path.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
                        let out = output_dir.clone().unwrap_or_else(|| {
                            input_path.parent()
                                .map(|p| p.join("output"))
                                .unwrap_or_else(|| PathBuf::from("output"))
                                .to_string_lossy()
                                .to_string()
                        });
                        let _ = fs::create_dir_all(&out);
                        let output_path = format!("{out}/{stem}.png");
                        match fs::write(&output_path, &proc_result.output_bytes) {
                            Ok(_) => results.push(BatchItemResult {
                                path: path.clone(),
                                output_path: Some(output_path),
                                report: Some(proc_result.report),
                                error: None,
                            }),
                            Err(e) => results.push(BatchItemResult {
                                path: path.clone(),
                                output_path: None,
                                report: Some(proc_result.report),
                                error: Some(e.to_string()),
                            }),
                        }
                    }
                    Err(e) => results.push(BatchItemResult {
                        path: path.clone(),
                        output_path: None,
                        report: None,
                        error: Some(e),
                    }),
                }
            }
            Err(e) => results.push(BatchItemResult {
                path: path.clone(),
                output_path: None,
                report: None,
                error: Some(format!("Failed to read file: {e}")),
            }),
        }
    }

    Ok(BatchResponse { results })
}
