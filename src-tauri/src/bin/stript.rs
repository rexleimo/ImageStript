use clap::Parser;
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use stript_lib::engine::inspector::MetadataInspector;
use stript_lib::engine::pipeline::Pipeline;
use stript_lib::engine::presets::ProcessParams;

#[derive(Parser)]
#[command(name = "stript", about = "Remove AI watermarks from images")]
struct Cli {
    #[arg(help = "Input file, directory, or ZIP archive")]
    input: String,

    #[arg(short, long, help = "Output directory")]
    output: Option<String>,

    #[arg(long, default_value = "0.03", help = "Noise fraction (0.0-1.0)")]
    noise: f64,

    #[arg(long, default_value_t = 1, help = "Noise strength")]
    strength: u8,

    #[arg(long, default_value = "0.998", help = "Resize perturbation scale")]
    resize: f64,

    #[arg(long, default_value_t = 97, help = "JPEG re-encode quality (0-100)")]
    jpeg: u8,

    #[arg(long, help = "Use aggressive preset")]
    aggressive: bool,

    #[arg(long, help = "Only scan for AI metadata, do not write output")]
    inspect_only: bool,
}

struct ImageInput {
    name: String,
    stem: String,
    bytes: Vec<u8>,
}

fn main() {
    let cli = Cli::parse();
    let params = if cli.aggressive {
        ProcessParams::aggressive()
    } else {
        ProcessParams {
            noise_fraction: cli.noise,
            noise_strength: cli.strength,
            resize_scale: cli.resize,
            jpeg_quality: cli.jpeg,
        }
    };

    let input_path = PathBuf::from(&cli.input);
    if !input_path.exists() {
        eprintln!("Error: path does not exist: {}", cli.input);
        std::process::exit(1);
    }

    let images = collect_images(&input_path);

    if images.is_empty() {
        println!("No supported image files found.");
        return;
    }

    let action = if cli.inspect_only { "Inspecting" } else { "Processing" };
    println!("Stript — {action} {} image(s)...", images.len());
    println!("  Noise: {:.0}% of pixels ±{}", params.noise_fraction * 100.0, params.noise_strength);
    println!("  Resize perturbation: {}", params.resize_scale);
    println!("  JPEG re-encode quality: {}", params.jpeg_quality);

    let out_dir = cli.output.unwrap_or_else(|| {
        let parent = if input_path.is_dir() { &input_path } else { input_path.parent().unwrap_or(&input_path) };
        parent.join("output").to_string_lossy().to_string()
    });

    if !cli.inspect_only {
        fs::create_dir_all(&out_dir).expect("Failed to create output directory");
        println!("  Output: {out_dir}");
    }
    println!();

    let inspector = MetadataInspector::new();
    let pipeline = Pipeline::new(params);
    let mut success = 0usize;
    let mut failed = 0usize;

    for img in &images {
        let report = inspector.inspect(&img.bytes);
        if report.findings.is_empty() {
            println!("  Scan {}: No AI metadata signatures found", img.name);
        } else {
            println!("  Scan {}:", img.name);
            for f in &report.findings {
                println!("    - {}: {} ({})", f.container, f.signal, f.detail);
            }
        }

        if cli.inspect_only {
            success += 1;
            continue;
        }

        match pipeline.process(&img.bytes) {
            Ok(output) => {
                let out_path = format!("{out_dir}/{}.png", img.stem);
                match fs::write(&out_path, &output) {
                    Ok(_) => {
                        let recheck = inspector.inspect(&output);
                        let recheck_status = if recheck.findings.is_empty() { "CLEAN" } else { "STILL HAS METADATA" };
                        println!("  OK   {} → {}.png  [{}]", img.name, img.stem, recheck_status);
                        success += 1;
                    }
                    Err(e) => {
                        println!("  FAIL {}: Failed to write output: {e}", img.name);
                        failed += 1;
                    }
                }
            }
            Err(e) => {
                println!("  FAIL {}: {e}", img.name);
                failed += 1;
            }
        }
    }

    println!();
    if cli.inspect_only {
        println!("Done. {success} image(s) inspected.");
    } else {
        println!("Done. {success} succeeded, {failed} failed.");
    }

    if failed > 0 {
        std::process::exit(1);
    }
}

const IMAGE_EXTS: &[&str] = &["png", "jpg", "jpeg", "webp", "bmp", "tiff", "tif"];

fn is_image(name: &str) -> bool {
    let lower = name.to_lowercase();
    IMAGE_EXTS.iter().any(|ext| lower.ends_with(ext))
}

fn is_zip(name: &str) -> bool {
    name.to_lowercase().ends_with(".zip")
}

fn collect_images(path: &PathBuf) -> Vec<ImageInput> {
    if path.is_dir() {
        let mut images = Vec::new();
        if let Ok(entries) = fs::read_dir(path) {
            let mut sorted: Vec<_> = entries.filter_map(|e| e.ok()).collect();
            sorted.sort_by_key(|e| e.path());
            for entry in sorted {
                let name = entry.file_name().to_string_lossy().to_string();
                if is_zip(&name) {
                    if let Ok(zipped) = extract_zip_images(&entry.path()) {
                        images.extend(zipped);
                    }
                } else if is_image(&name) {
                    if let Ok(bytes) = fs::read(entry.path()) {
                        let stem = entry.path().file_stem().unwrap_or_default().to_string_lossy().to_string();
                        images.push(ImageInput { name, stem, bytes });
                    }
                }
            }
        }
        images
    } else {
        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
        if is_zip(&name) {
            extract_zip_images(path).unwrap_or_default()
        } else if is_image(&name) {
            match fs::read(path) {
                Ok(bytes) => {
                    let stem = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
                    vec![ImageInput { name, stem, bytes }]
                }
                Err(_) => vec![],
            }
        } else {
            vec![]
        }
    }
}

fn extract_zip_images(path: &PathBuf) -> Result<Vec<ImageInput>, String> {
    let file = fs::File::open(path).map_err(|e| format!("Failed to open zip: {e}"))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip: {e}"))?;

    let mut images = Vec::new();
    for i in 0..archive.len() {
        let mut zip_file = archive.by_index(i).map_err(|e| format!("Zip entry error: {e}"))?;
        let name = zip_file.name().to_string();
        if !is_image(&name) { continue; }

        let display_name = name.split('/').last().unwrap_or(&name).to_string();
        let stem = display_name.rsplit_once('.').map(|(s, _)| s.to_string()).unwrap_or(display_name.clone());

        let mut bytes = Vec::new();
        zip_file.read_to_end(&mut bytes).map_err(|e| format!("Failed to read zip entry: {e}"))?;
        images.push(ImageInput { name: display_name, stem, bytes });
    }
    Ok(images)
}
