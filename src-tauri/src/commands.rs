use crate::engine::inspector::MetadataReport;
use crate::engine::pipeline::Pipeline;
use crate::engine::presets::ProcessParams;
use base64::Engine;
use std::fs;
use std::io::Read;
use std::path::PathBuf;

const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "webp", "bmp", "tiff", "tif"];
const ARCHIVE_EXTENSIONS: &[&str] = &["zip"];

fn is_image_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    IMAGE_EXTENSIONS.iter().any(|ext| lower.ends_with(ext))
}

fn is_archive_file(name: &str) -> bool {
    let lower = name.to_lowercase();
    ARCHIVE_EXTENSIONS.iter().any(|ext| lower.ends_with(ext))
}

#[derive(serde::Serialize, Clone)]
pub struct ImageEntry {
    pub name: String,
    pub path: String,
    pub source: String,
    pub report: Option<MetadataReport>,
    pub size: usize,
}

#[tauri::command]
pub fn scan_paths(paths: Vec<String>) -> Result<Vec<ImageEntry>, String> {
    let mut entries = Vec::new();
    for path_str in &paths {
        let path = PathBuf::from(path_str);
        if !path.exists() {
            continue;
        }

        if path.is_file() {
            let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
            if is_archive_file(&name) {
                entries.extend(scan_zip_file(path_str)?);
            } else if is_image_file(&name) {
                let bytes = fs::read(&path).map_err(|e| format!("Failed to read {path_str}: {e}"))?;
                entries.push(ImageEntry {
                    name,
                    path: path_str.clone(),
                    source: "file".to_string(),
                    report: None,
                    size: bytes.len(),
                });
            }
        } else if path.is_dir() {
            let dir_entries = fs::read_dir(&path).map_err(|e| format!("Failed to read dir: {e}"))?;
            for entry in dir_entries.flatten() {
                let entry_name = entry.file_name().to_string_lossy().to_string();
                let entry_path = entry.path().to_string_lossy().to_string();
                if is_archive_file(&entry_name) {
                    entries.extend(scan_zip_file(&entry_path)?);
                } else if is_image_file(&entry_name) {
                    let bytes = fs::read(entry.path()).unwrap_or_default();
                    entries.push(ImageEntry {
                        name: entry_name,
                        path: entry_path,
                        source: "file".to_string(),
                        report: None,
                        size: bytes.len(),
                    });
                }
            }
        }
    }
    Ok(entries)
}

fn scan_zip_file(zip_path: &str) -> Result<Vec<ImageEntry>, String> {
    let file = fs::File::open(zip_path).map_err(|e| format!("Failed to open zip: {e}"))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip: {e}"))?;

    let mut entries = Vec::new();
    for i in 0..archive.len() {
        let mut zip_file = archive.by_index(i).map_err(|e| format!("Zip entry error: {e}"))?;
        let name = zip_file.name().to_string();
        if !is_image_file(&name) { continue; }

        let mut bytes = Vec::new();
        zip_file.read_to_end(&mut bytes).map_err(|e| format!("Failed to read zip entry: {e}"))?;
        entries.push(ImageEntry {
            name: name.split('/').last().unwrap_or(&name).to_string(),
            path: format!("{zip_path}!/{name}"),
            source: "zip".to_string(),
            report: None,
            size: bytes.len(),
        });
    }
    Ok(entries)
}

#[tauri::command]
pub fn read_image_bytes(path: String) -> Result<Vec<u8>, String> {
    if path.contains("!/") {
        let parts: Vec<&str> = path.splitn(2, "!/").collect();
        let zip_path = parts[0];
        let entry_name = parts[1];
        let file = fs::File::open(zip_path).map_err(|e| format!("Failed to open zip: {e}"))?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip: {e}"))?;
        for i in 0..archive.len() {
            let mut zip_file = archive.by_index(i).map_err(|e| format!("Zip entry error: {e}"))?;
            if zip_file.name() == entry_name {
                let mut bytes = Vec::new();
                zip_file.read_to_end(&mut bytes).map_err(|e| format!("Failed to read: {e}"))?;
                return Ok(bytes);
            }
        }
        Err(format!("Entry not found in zip: {entry_name}"))
    } else {
        fs::read(&path).map_err(|e| format!("Failed to read file: {e}"))
    }
}

#[tauri::command]
pub fn inspect_image(path: String) -> Result<MetadataReport, String> {
    let bytes = read_image_bytes(path)?;
    let inspector = crate::engine::inspector::MetadataInspector::new();
    Ok(inspector.inspect(&bytes))
}

#[derive(serde::Serialize)]
pub struct ProcessResponse {
    pub output_path: String,
    pub report: MetadataReport,
    pub image_data: String,
}

#[tauri::command]
pub fn process_image(
    path: String,
    output_dir: Option<String>,
    params: Option<ProcessParams>,
) -> Result<ProcessResponse, String> {
    let bytes = read_image_bytes(path.clone())?;
    let effective_params = params.unwrap_or_default();

    let pipeline = Pipeline::new(effective_params);
    let result = pipeline.process_with_report(&bytes)?;

    let input_path = PathBuf::from(&path);
    let stem = input_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");
    let out = output_dir.unwrap_or_else(|| {
        input_path
            .parent()
            .map(|p| p.join("output"))
            .unwrap_or_else(|| PathBuf::from("output"))
            .to_string_lossy()
            .to_string()
    });
    fs::create_dir_all(&out).map_err(|e| format!("Failed to create output dir: {e}"))?;

    let output_path = format!("{out}/{stem}.png");
    fs::write(&output_path, &result.output_bytes)
        .map_err(|e| format!("Failed to write output: {e}"))?;

    let image_data = base64::engine::general_purpose::STANDARD.encode(&result.output_bytes);

    Ok(ProcessResponse {
        output_path,
        report: result.report,
        image_data,
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
    pub image_data: Option<String>,
    pub report: Option<MetadataReport>,
    pub error: Option<String>,
}

#[tauri::command]
pub fn process_batch(
    paths: Vec<String>,
    output_dir: Option<String>,
    params: Option<ProcessParams>,
) -> Result<BatchResponse, String> {
    let effective_params = params.unwrap_or_default();
    let pipeline = Pipeline::new(effective_params);

    let mut results = Vec::new();
    for path in &paths {
        match read_image_bytes(path.clone()) {
            Ok(bytes) => match pipeline.process_with_report(&bytes) {
                Ok(proc_result) => {
                    let input_path = PathBuf::from(path);
                    let stem = input_path
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("output");
                    let out = output_dir.clone().unwrap_or_else(|| {
                        input_path
                            .parent()
                            .map(|p| p.join("output"))
                            .unwrap_or_else(|| PathBuf::from("output"))
                            .to_string_lossy()
                            .to_string()
                    });
                    let _ = fs::create_dir_all(&out);
                    let output_path = format!("{out}/{stem}.png");
                    let image_data =
                        base64::engine::general_purpose::STANDARD.encode(&proc_result.output_bytes);

                    match fs::write(&output_path, &proc_result.output_bytes) {
                        Ok(_) => results.push(BatchItemResult {
                            path: path.clone(),
                            output_path: Some(output_path),
                            image_data: Some(image_data),
                            report: Some(proc_result.report),
                            error: None,
                        }),
                        Err(e) => results.push(BatchItemResult {
                            path: path.clone(),
                            output_path: None,
                            image_data: Some(image_data),
                            report: Some(proc_result.report),
                            error: Some(e.to_string()),
                        }),
                    }
                }
                Err(e) => results.push(BatchItemResult {
                    path: path.clone(),
                    output_path: None,
                    image_data: None,
                    report: None,
                    error: Some(e),
                }),
            },
            Err(e) => results.push(BatchItemResult {
                path: path.clone(),
                output_path: None,
                image_data: None,
                report: None,
                error: Some(format!("Failed to read file: {e}")),
            }),
        }
    }

    Ok(BatchResponse { results })
}

#[tauri::command]
pub fn read_image_as_base64(path: String) -> Result<String, String> {
    let bytes = read_image_bytes(path)?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}
