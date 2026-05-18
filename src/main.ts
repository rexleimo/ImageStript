import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { MetadataReport, ProcessParams, ProcessResponse, BatchResponse, Preset } from "./types";
import { PRESET_PARAMS } from "./types";

interface FileEntry {
  path: string;
  name: string;
  report: MetadataReport | null;
  processed: boolean;
  outputBytes: string | null;
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
  renderHeader();
  renderFileList();
  renderParams();
  renderPreview();
  renderReport();
}

function renderHeader() {
  const clearBtn = $("btn-clear");
  if (clearBtn) {
    (clearBtn as HTMLButtonElement).disabled = state.files.length === 0;
  }
}

function renderFileList() {
  const list = $("file-list");
  if (!list) return;

  if (state.files.length === 0) {
    list.innerHTML = `<div class="drop-zone" id="drop-zone">
      <div class="drop-zone-icon">📁</div>
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
  `).join("");

  list.querySelectorAll(".file-item").forEach((el) => {
    el.addEventListener("click", () => {
      state.activeIndex = parseInt((el as HTMLElement).dataset.index || "0");
      render();
    });
  });
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
      <button class="btn-ghost" id="toggle-advanced">${state.advancedOpen ? "▾ Hide parameters" : "▸ Advanced parameters"}</button>
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

  const toggleBtn = $("toggle-advanced");
  toggleBtn?.addEventListener("click", () => {
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
      <div class="icon">🖼️</div>
      <div class="title">No image selected</div>
      <div class="hint">Add images from the left panel</div>
    </div>`;
    return;
  }

  const file = state.files[state.activeIndex];
  if (!file) return;

  const processedSrc = file.processed
    ? `stript://localhost/converted/${encodeURIComponent(file.outputBytes || "")}`
    : "";

  center.innerHTML = `
    <div class="preview-area">
      <div class="preview-panel">
        <div class="label">Before</div>
        <div class="frame"><img src="file://${file.path}" alt="original" /></div>
      </div>
      <div class="preview-panel">
        <div class="label">After</div>
        <div class="frame">
          ${file.processed
            ? `<img src="${processedSrc}" alt="processed" />`
            : state.processing
              ? '<div class="spinner"></div>'
              : '<div class="empty-state"><div class="hint">Click "Process" to clean</div></div>'}
        </div>
      </div>
    </div>
    <div class="action-row">
      <button class="btn btn-primary" id="btn-process" ${state.processing ? "disabled" : ""}>
        ${state.processing ? "Processing…" : `Process ${state.files.length > 1 ? `All (${state.files.length})` : ""}`}
      </button>
      <button class="btn btn-outline" id="btn-save" ${!file.processed ? "disabled" : ""}>Save</button>
      <button class="btn btn-outline" id="btn-save-all" ${state.files.every(f => !f.processed) ? "disabled" : ""}>Save All</button>
    </div>
  `;

  $("btn-process")?.addEventListener("click", processActive);
  $("btn-save")?.addEventListener("click", () => saveSingle(state.activeIndex));
  $("btn-save-all")?.addEventListener("click", saveAll);
}

function renderReport() {
  const el = $("report");
  if (!el) return;

  const file = state.files[state.activeIndex];
  if (!file || !file.report) { el.innerHTML = ""; return; }

  const r = file.report;
  el.innerHTML = `
    <div class="report-card ${r.findings.length > 0 ? "warn" : "safe"}">
      <div class="title">${r.findings.length > 0 ? "⚠ AI metadata detected" : "✓ No AI metadata"}</div>
      <div class="detail">
        ${r.findings.length > 0
          ? r.findings.slice(0, 4).map(f => `<div>${f.container}: ${f.signal} — ${f.detail}</div>`).join("")
          : "No embedded AI metadata signatures found."}
        ${r.findings.length > 4 ? `<div>…and ${r.findings.length - 4} more</div>` : ""}
      </div>
    </div>
  `;
}

async function pickFiles() {
  const selected = await open({
    multiple: true,
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "tiff", "tif"] }],
  });
  if (!selected) return;
  const paths = Array.isArray(selected) ? selected : [selected];
  addFiles(paths);
}

function handleDropped(e: DragEvent) {
  const files = e.dataTransfer?.files;
  if (!files) return;
  const paths = Array.from(files).map(f => f.path || f.name);
  addFiles(paths);
}

function addFiles(paths: string[]) {
  for (const p of paths) {
    const name = p.split("/").pop() || p;
    state.files.push({ path: p, name, report: null, processed: false, outputBytes: null });
  }
  if (state.activeIndex < 0) state.activeIndex = 0;
  render();
  inspectAll();
}

async function inspectAll() {
  for (let i = 0; i < state.files.length; i++) {
    try {
      const report = await invoke<MetadataReport>("inspect_image", { path: state.files[i].path });
      state.files[i].report = report;
    } catch {
      state.files[i].report = { findings: [] };
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
      state.files[0].outputBytes = result.output_path;
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
        state.files[i].outputBytes = r.output_path;
        state.files[i].report = r.report;
      }
    }
  } catch (e) {
    console.error("Process failed:", e);
  }

  state.processing = false;
  render();
}

async function saveSingle(index: number) {
  const file = state.files[index];
  if (!file?.outputBytes) return;
  const outPath = file.outputBytes;
  const name = outPath.split("/").pop() || "stript-output.png";
  try {
    await invoke("save_file_dialog", { path: outPath, name });
  } catch {
    // user cancelled
  }
}

async function saveAll() {
  for (let i = 0; i < state.files.length; i++) {
    if (state.files[i].processed) {
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
