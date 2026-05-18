import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { MetadataReport, ProcessParams, ProcessResponse, BatchResponse, Preset } from "./types";
import { PRESET_PARAMS } from "./types";

interface FileEntry {
  path: string;
  name: string;
  report: MetadataReport | null;
  processed: boolean;
  outputPath: string | null;
  imageDataUrl: string | null;
  originalDataUrl: string | null;
}

const state = {
  files: [] as FileEntry[],
  activeIndex: -1,
  preset: "Standard" as Preset,
  params: { ...PRESET_PARAMS.Standard } as ProcessParams,
  processing: false,
  advancedOpen: false,
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function render() {
  renderFileList();
  renderParams();
  renderPreview();
  renderReport();
}

function renderFileList() {
  const list = $("file-list");
  if (!list) return;

  if (state.files.length === 0) {
    list.innerHTML = `<div class="drop-zone" id="drop-zone">
      <div class="drop-zone-icon">\u{1F4C1}</div>
      <div class="drop-zone-text">Drop images or click to browse</div>
      <div class="drop-zone-hint">PNG, JPEG, WebP supported</div>
    </div>`;
    const dz = $("drop-zone");
    dz?.addEventListener("click", pickFiles);
    dz?.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("drag-over"); });
    dz?.addEventListener("dragleave", () => dz.classList.remove("drag-over"));
    dz?.addEventListener("drop", (e) => { e.preventDefault(); dz.classList.remove("drag-over"); handleDropped(e); });
    return;
  }

  list.innerHTML = state.files.map((f, i) => `
    <div class="file-item ${i === state.activeIndex ? "active" : ""}" data-index="${i}">
      <span class="name">${f.name}</span>
      ${f.report ? (f.report.findings.length > 0
        ? '<span class="badge badge-warning">AI</span>'
        : '<span class="badge badge-success">Clean</span>')
        : ""}
      ${f.processed ? '<span class="badge badge-success">Done</span>' : ""}
    </div>
  `).join("") + `<button class="btn-ghost" id="add-more" style="margin-top:8px;width:100%">+ Add more</button>`;

  list.querySelectorAll(".file-item").forEach((el) => {
    el.addEventListener("click", () => {
      state.activeIndex = parseInt((el as HTMLElement).dataset.index || "0");
      render();
    });
  });

  $("add-more")?.addEventListener("click", pickFiles);
}

function renderParams() {
  const container = $("params");
  if (!container) return;

  const p = state.params;
  container.innerHTML = `
    <div class="section-label">Preset</div>
    <div class="preset-row">
      ${(["Subtle", "Standard", "Aggressive"] as Preset[]).map(pr => `
        <button class="preset-btn ${state.preset === pr ? "active" : ""}" data-preset="${pr}">${pr}</button>
      `).join("")}
    </div>
    <div style="margin-top:14px">
      <button class="btn-ghost" id="toggle-advanced">${state.advancedOpen ? "\u25BE Hide parameters" : "\u25B8 Advanced parameters"}</button>
    </div>
    ${state.advancedOpen ? `
    <div style="margin-top:12px; display:flex; flex-direction:column; gap:10px;">
      <div class="param-row">
        <label>Noise fraction</label>
        <input type="range" min="0" max="10" step="0.1" value="${(p.noise_fraction * 100).toFixed(1)}" data-param="noise_fraction" />
        <span class="param-val">${(p.noise_fraction * 100).toFixed(1)}%</span>
      </div>
      <div class="param-row">
        <label>Noise strength</label>
        <input type="range" min="1" max="5" step="1" value="${p.noise_strength}" data-param="noise_strength" />
        <span class="param-val">${p.noise_strength}</span>
      </div>
      <div class="param-row">
        <label>Resize scale</label>
        <input type="range" min="0.990" max="1.000" step="0.001" value="${p.resize_scale}" data-param="resize_scale" />
        <span class="param-val">${p.resize_scale.toFixed(3)}</span>
      </div>
      <div class="param-row">
        <label>JPEG quality</label>
        <input type="range" min="80" max="100" step="1" value="${p.jpeg_quality}" data-param="jpeg_quality" />
        <span class="param-val">${p.jpeg_quality}</span>
      </div>
    </div>` : ""}
  `;

  container.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pr = (btn as HTMLElement).dataset.preset as Preset;
      state.preset = pr;
      state.params = { ...PRESET_PARAMS[pr] };
      render();
    });
  });

  $("toggle-advanced")?.addEventListener("click", () => {
    state.advancedOpen = !state.advancedOpen;
    render();
  });

  container.querySelectorAll("input[type=range]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = (input as HTMLInputElement).dataset.param as keyof ProcessParams;
      const val = parseFloat((input as HTMLInputElement).value);
      if (key === "noise_fraction") {
        state.params[key] = val / 100;
      } else {
        (state.params[key] as number) = val;
      }
      state.preset = "" as Preset;
      render();
    });
  });
}

function renderPreview() {
  const center = $("panel-center");
  if (!center) return;

  if (state.files.length === 0) {
    center.innerHTML = `<div class="empty-state">
      <div class="icon">\u{1F5BC}\u{FE0F}</div>
      <div class="title">No image selected</div>
      <div class="hint">Add images from the left panel</div>
    </div>`;
    return;
  }

  const file = state.files[state.activeIndex];
  if (!file) return;

  const originalSrc = file.originalDataUrl || convertFileSrc(file.path);

  center.innerHTML = `
    <div class="preview-area">
      <div class="preview-panel">
        <div class="label">Before</div>
        <div class="frame"><img src="${originalSrc}" alt="original" /></div>
      </div>
      <div class="preview-panel">
        <div class="label">After</div>
        <div class="frame">
          ${file.processed && file.imageDataUrl
            ? `<img src="${file.imageDataUrl}" alt="processed" />`
            : state.processing
              ? '<div style="display:flex;align-items:center;gap:8px"><div class="spinner"></div> Processing...</div>'
              : '<div class="empty-state"><div class="hint">Click "Process" to strip AI metadata</div></div>'}
        </div>
      </div>
    </div>
    <div class="action-row">
      <button class="btn btn-primary" id="btn-process" ${state.processing ? "disabled" : ""}>
        ${state.processing ? "Processing\u2026" : `Process${state.files.length > 1 ? ` All (${state.files.length})` : ""}`}
      </button>
      <button class="btn btn-outline" id="btn-save" disabled>Save</button>
      <button class="btn btn-outline" id="btn-save-all" disabled>Save All</button>
    </div>
  `;

  $("btn-process")?.addEventListener("click", processActive);

  const btnSave = $("btn-save") as HTMLButtonElement;
  const btnSaveAll = $("btn-save-all") as HTMLButtonElement;

  if (file.processed && file.outputPath) {
    btnSave.disabled = false;
    btnSave.addEventListener("click", () => saveSingle(state.activeIndex));
  }

  const hasAnyProcessed = state.files.some(f => f.processed && f.outputPath);
  if (hasAnyProcessed) {
    btnSaveAll.disabled = false;
    btnSaveAll.addEventListener("click", saveAll);
  }
}

function renderReport() {
  const el = $("report");
  if (!el) return;

  const file = state.files[state.activeIndex];
  if (!file || !file.report) { el.innerHTML = ""; return; }

  const r = file.report;
  el.innerHTML = `
    <div class="report-card ${r.findings.length > 0 ? "warn" : "safe"}">
      <div class="title">${r.findings.length > 0 ? "\u26A0 AI metadata detected" : "\u2713 No AI metadata"}</div>
      <div class="detail">
        ${r.findings.length > 0
          ? r.findings.slice(0, 6).map(f => `<div>${f.container}: ${f.signal} \u2014 ${f.detail}</div>`).join("")
          : "No embedded AI metadata signatures found."}
        ${r.findings.length > 6 ? `<div>\u2026and ${r.findings.length - 6} more</div>` : ""}
      </div>
    </div>
  `;
}

async function pickFiles() {
  try {
    const selected = await open({
      multiple: true,
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "tiff", "tif"] }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    await addFiles(paths);
  } catch (e) {
    console.error("File picker error:", e);
  }
}

function handleDropped(e: DragEvent) {
  const files = e.dataTransfer?.files;
  if (!files) return;
  const paths = Array.from(files).map(f => (f as File & { path?: string }).path || f.name).filter(Boolean);
  if (paths.length > 0) addFiles(paths);
}

async function addFiles(paths: string[]) {
  for (const p of paths) {
    const name = p.split("/").pop() || p;
    state.files.push({ path: p, name, report: null, processed: false, outputPath: null, imageDataUrl: null, originalDataUrl: null });
  }
  if (state.activeIndex < 0) state.activeIndex = 0;
  render();
  await inspectAll();
  await loadOriginalPreviews();
}

async function inspectAll() {
  for (let i = 0; i < state.files.length; i++) {
    if (state.files[i].report) continue;
    try {
      const report = await invoke<MetadataReport>("inspect_image", { path: state.files[i].path });
      state.files[i].report = report;
    } catch {
      state.files[i].report = { findings: [] };
    }
  }
  render();
}

async function loadOriginalPreviews() {
  for (let i = 0; i < state.files.length; i++) {
    if (state.files[i].originalDataUrl) continue;
    try {
      const b64 = await invoke<string>("read_image_as_base64", { path: state.files[i].path });
      const ext = state.files[i].path.toLowerCase();
      const mime = ext.endsWith(".jpg") || ext.endsWith(".jpeg") ? "image/jpeg"
        : ext.endsWith(".webp") ? "image/webp"
        : "image/png";
      state.files[i].originalDataUrl = `data:${mime};base64,${b64}`;
    } catch {
      // fallback: use convertFileSrc
    }
  }
  render();
}

async function processActive() {
  state.processing = true;
  render();

  try {
    if (state.files.length === 1) {
      const result = await invoke<ProcessResponse>("process_image", {
        path: state.files[0].path,
        params: state.params,
      });
      state.files[0].processed = true;
      state.files[0].outputPath = result.output_path;
      state.files[0].imageDataUrl = `data:image/png;base64,${result.image_data}`;
      state.files[0].report = result.report;
    } else {
      const paths = state.files.map(f => f.path);
      const result = await invoke<BatchResponse>("process_batch", {
        paths,
        params: state.params,
      });
      for (let i = 0; i < result.results.length; i++) {
        const r = result.results[i];
        state.files[i].processed = r.error === null;
        state.files[i].outputPath = r.output_path;
        state.files[i].report = r.report;
        if (r.image_data) {
          state.files[i].imageDataUrl = `data:image/png;base64,${r.image_data}`;
        }
      }
    }
  } catch (e) {
    console.error("Process failed:", e);
    alert("Process failed: " + e);
  }

  state.processing = false;
  render();
}

async function saveSingle(index: number) {
  const file = state.files[index];
  if (!file?.outputPath) return;
  const name = file.name.replace(/\.[^.]+$/, "") + "-stript.png";
  try {
    const dest = await save({
      defaultPath: name,
      filters: [{ name: "PNG", extensions: ["png"] }],
    });
    if (!dest) return;
    const bytes = await readFile(file.outputPath);
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    await writeFile(dest, bytes);
  } catch (e) {
    console.error("Save failed:", e);
  }
}

async function saveAll() {
  for (let i = 0; i < state.files.length; i++) {
    if (state.files[i].processed && state.files[i].outputPath) {
      await saveSingle(i);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  render();

  $("btn-add")?.addEventListener("click", pickFiles);
  $("btn-clear")?.addEventListener("click", () => {
    state.files = [];
    state.activeIndex = -1;
    render();
  });
});
