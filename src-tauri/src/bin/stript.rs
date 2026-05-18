use clap::Parser;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use stript_lib::engine::inspector::MetadataInspector;
use stript_lib::engine::pipeline::Pipeline;
use stript_lib::engine::presets::{Preset, ProcessParams};

#[derive(Parser)]
#[command(name = "stript", about = "Remove AI watermarks from images")]
struct Cli {
    #[arg(help = "Input file or directory")]
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

#[derive(Serialize)]
struct CliReport {
    path: String,
    findings_count: usize,
    findings: Vec<FindingDetail>,
}

#[derive(Serialize)]
struct FindingDetail {
    container: String,
    signal: String,
    detail: String,
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

    let files: Vec<PathBuf> = if input_path.is_dir() {
        let exts = ["png", "jpg", "jpeg", "webp", "bmp", "tiff", "tif"];
        let mut f: Vec<PathBuf> = fs::read_dir(&input_path)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path()
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| exts.contains(&ext.to_lowercase().as_str()))
                    .unwrap_or(false)
            })
            .map(|e| e.path())
            .collect();
        f.sort();
        f
    } else {
        vec![input_path.clone()]
    };

    if files.is_empty() {
        println!("No supported image files found.");
        return;
    }

    let action = if cli.inspect_only { "Inspecting" } else { "Processing" };
    println!("Stript — {action} {} image(s)...", files.len());
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

    for file in &files {
        let name = file.file_name().unwrap_or_default().to_string_lossy();
        match fs::read(file) {
            Ok(bytes) => {
                let report = inspector.inspect(&bytes);
                if report.findings.is_empty() {
                    println!("  Scan {name}: No AI metadata signatures found");
                } else {
                    println!("  Scan {name}:");
                    for f in &report.findings {
                        println!("    - {}: {} ({})", f.container, f.signal, f.detail);
                    }
                }

                if cli.inspect_only {
                    success += 1;
                    continue;
                }

                match pipeline.process(&bytes) {
                    Ok(output) => {
                        let stem = file.file_stem().unwrap_or_default().to_string_lossy();
                        let out_path = format!("{out_dir}/{stem}.png");
                        match fs::write(&out_path, &output) {
                            Ok(_) => {
                                // Re-verify: inspect the output
                                let recheck = inspector.inspect(&output);
                                let recheck_status = if recheck.findings.is_empty() { "CLEAN" } else { "STILL HAS METADATA" };
                                println!("  OK   {name} → {stem}.png  [{recheck_status}]");
                                if !recheck.findings.is_empty() {
                                    for f in &recheck.findings {
                                        println!("       REMAINING: {}: {} ({})", f.container, f.signal, f.detail);
                                    }
                                }
                                success += 1;
                            }
                            Err(e) => {
                                println!("  FAIL {name}: Failed to write output: {e}");
                                failed += 1;
                            }
                        }
                    }
                    Err(e) => {
                        println!("  FAIL {name}: {e}");
                        failed += 1;
                    }
                }
            }
            Err(e) => {
                println!("  FAIL {name}: Failed to read file: {e}");
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
