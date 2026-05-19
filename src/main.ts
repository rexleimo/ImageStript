import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeFile, readFile } from "@tauri-apps/plugin-fs";
import type { MetadataReport, ProcessParams, ProcessResponse, BatchResponse, Preset, ImageEntry } from "./types";
import { PRESET_PARAMS } from "./types";
import { t, plural } from "@lingui/core/macro";
import { i18n, setupI18n, getLocale, switchLocale, LOCALES, type Locale } from "./i18n";

type ViewMode = "preview" | "gallery";

interface FileEntry {
  path: string;
  name: string;
  source: string;
  report: MetadataReport | null;
  processed: boolean;
  outputPath: string | null;
  imageDataUrl: string | null;
  originalDataUrl: string | null;
  selected: boolean;
}

const state = {
  files: [] as FileEntry[],
  activeIndex: -1,
  preset: "Standard" as Preset,
  params: { ...PRESET_PARAMS.Standard } as ProcessParams,
  processing: false,
  advancedOpen: false,
  viewMode: "preview" as ViewMode,
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function lucide(name: string, size = 16): string {
  return `<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`;
}

function refreshIcons() {
  try { (window as any).lucide?.createIcons(); } catch {}
}

function toast(message: string, type: "success" | "error" | "info" = "info") {
  const container = $("toast-container");
  if (!container) return;

  const iconMap = { success: "check-circle-2", error: "alert-circle", info: "info" };
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <span class="toast-icon">${lucide(iconMap[type])}</span>
    <span>${message}</span>
  `;
  container.appendChild(el);
  refreshIcons();

  setTimeout(() => {
    el.classList.add("toast-out");
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

function render() {
  renderFileList();
  renderParams();
  renderMainContent();
  renderReport();
  renderActionStrip();
  renderStaticLabels();
  updateFileCount();
  updateLocaleButton();
  refreshIcons();
}

function renderStaticLabels() {
  const set = (id: string, text: string) => {
    const el = $(id);
    if (el) el.textContent = text;
  };
  set("label-add", t`Add`);
  set("label-files", t`Files`);
  set("label-settings", t`Settings`);
  set("label-process", t`Process`);
  set("label-save", t`Save`);
  set("label-save-all", t`Save All`);

  const btnClear = $("btn-clear");
  if (btnClear) btnClear.title = t`Clear`;

  const statusEl = $("status-text");
  if (statusEl && state.files.length === 0) statusEl.textContent = t`Ready`;
}

function updateFileCount() {
  const el = $("file-count");
  if (el) el.textContent = String(state.files.length);
}

function updateLocaleButton() {
  const wrapper = $("locale-dropdown");
  if (!wrapper) return;
  const current = getLocale();
  const currentLabel = LOCALES.find(l => l.value === current)?.label || "English";
  const btnEl = wrapper.querySelector(".btn-locale") as HTMLElement;
  if (btnEl) btnEl.innerHTML = `${currentLabel} <i data-lucide="chevron-down" style="width:12px;height:12px"></i>`;
  wrapper.querySelectorAll(".locale-menu-item").forEach((item) => {
    const val = (item as HTMLElement).dataset.locale;
    item.classList.toggle("active", val === current);
    item.querySelector(".locale-check")!.innerHTML = val === current ? lucide("check", 12) : "";
  });
}

function setupLocaleDropdown() {
  const wrapper = $("locale-dropdown");
  if (!wrapper) return;

  const btn = wrapper.querySelector(".btn-locale");
  btn?.addEventListener("click", (e) => {
    e.stopPropagation();
    wrapper.classList.toggle("open");
    refreshIcons();
  });

  wrapper.querySelectorAll(".locale-menu-item").forEach((item) => {
    item.addEventListener("click", async (e) => {
      e.stopPropagation();
      const locale = (item as HTMLElement).dataset.locale as Locale;
      wrapper.classList.remove("open");
      await switchLocale(locale);
      render();
    });
  });

  document.addEventListener("click", () => {
    wrapper.classList.remove("open");
  });
}

// ── Left Panel ──
function renderFileList() {
  const list = $("file-list");
  if (!list) return;

  if (state.files.length === 0) {
    list.innerHTML = `
      <div class="drop-zone" id="drop-zone">
        <div class="drop-zone-icon">${lucide("folder-open", 28)}</div>
        <div class="drop-zone-text">${t`Click to browse`}</div>
        <div class="drop-zone-hint">${t`PNG, JPEG, WebP, ZIP`}</div>
      </div>`;
    const dz = $("drop-zone");
    dz?.addEventListener("click", pickFiles);
    return;
  }

  const selectedCount = state.files.filter(f => f.selected).length;

  let html = `<div class="thumbnail-list">`;

  html += state.files.map((f, i) => {
    const isActive = i === state.activeIndex;
    return `
      <div class="thumbnail-item ${isActive ? "active" : ""}" data-index="${i}">
        <div class="thumb-check ${f.selected ? "checked" : ""}" data-check="${i}">
          ${f.selected ? lucide("check", 10) : ""}
        </div>
        ${f.originalDataUrl
          ? `<img src="${f.originalDataUrl}" alt="${f.name}" />`
          : `<div class="thumb-placeholder">${lucide("image", 20)}</div>`}
        <div class="thumb-overlay">${f.name}</div>
        ${f.report ? (f.report.findings.length > 0
          ? `<div class="thumb-badge"><span class="badge badge-warning">AI</span></div>`
          : `<div class="thumb-badge"><span class="badge badge-success">${t`Clean`}</span></div>`)
          : ""}
        ${f.processed ? `<div class="thumb-badge" style="top:auto;bottom:5px;right:5px"><span class="badge badge-success">${lucide("check", 8)}</span></div>` : ""}
      </div>
    `;
  }).join("");

  html += `</div>`;

  if (selectedCount > 0) {
    html += `
      <div class="batch-bar">
        <span class="batch-info"><strong>${selectedCount}</strong> ${t`selected`}</span>
        <div class="spacer"></div>
        <button class="btn btn-ghost" style="padding:4px 10px;font-size:11px" id="btn-deselect">
          ${lucide("x", 10)} ${t`Deselect`}
        </button>
      </div>
    `;
  }

  html += `
    <button class="btn btn-ghost" id="add-more" style="margin:8px;width:calc(100% - 16px);justify-content:center;font-size:12px">
      ${lucide("plus", 12)} ${t`Add more`}
    </button>
  `;

  list.innerHTML = html;

  list.querySelectorAll(".thumbnail-item").forEach((el) => {
    el.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest(".thumb-check")) return;
      state.activeIndex = parseInt((el as HTMLElement).dataset.index || "0");
      render();
    });
  });

  list.querySelectorAll(".thumb-check[data-check]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt((el as HTMLElement).dataset.check || "0");
      state.files[idx].selected = !state.files[idx].selected;
      render();
    });
  });

  $("btn-deselect")?.addEventListener("click", () => {
    state.files.forEach(f => (f.selected = false));
    render();
  });

  $("add-more")?.addEventListener("click", pickFiles);
}

// ── Right Panel ──
function renderParams() {
  const container = $("params");
  if (!container) return;

  const p = state.params;
  container.innerHTML = `
    <div class="section-label">${t`Preset`}</div>
    <div class="preset-row">
      ${(["Subtle", "Standard", "Aggressive"] as Preset[]).map(pr => {
        const presetLabel = pr === "Subtle" ? t`Subtle` : pr === "Standard" ? t`Standard` : t`Aggressive`;
        return `<button class="preset-btn ${state.preset === pr ? "active" : ""}" data-preset="${pr}">${presetLabel}</button>`;
      }).join("")}
    </div>
    <div style="margin-top:14px">
      <button class="toggle-btn ${state.advancedOpen ? "open" : ""}" id="toggle-advanced">
        <span class="chevron">${lucide("chevron-right", 12)}</span>
        ${t`Advanced parameters`}
      </button>
    </div>
    ${state.advancedOpen ? `
    <div style="margin-top:10px; display:flex; flex-direction:column; gap:10px;">
      <div class="param-row">
        <label>${t`Noise fraction`}</label>
        <input type="range" min="0" max="10" step="0.1" value="${(p.noise_fraction * 100).toFixed(1)}" data-param="noise_fraction" />
        <span class="param-val">${(p.noise_fraction * 100).toFixed(1)}%</span>
      </div>
      <div class="param-row">
        <label>${t`Noise strength`}</label>
        <input type="range" min="1" max="5" step="1" value="${p.noise_strength}" data-param="noise_strength" />
        <span class="param-val">${p.noise_strength}</span>
      </div>
      <div class="param-row">
        <label>${t`Resize scale`}</label>
        <input type="range" min="0.990" max="1.000" step="0.001" value="${p.resize_scale}" data-param="resize_scale" />
        <span class="param-val">${p.resize_scale.toFixed(3)}</span>
      </div>
      <div class="param-row">
        <label>${t`JPEG quality`}</label>
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

// ── Center Panel ──
function renderMainContent() {
  const center = $("panel-center");
  if (!center) return;

  if (state.files.length === 0) {
    center.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon-wrapper">
          ${lucide("image", 36)}
        </div>
        <div class="empty-title">${t`Drop images to start`}</div>
        <div class="empty-hint">${t`PNG, JPEG, WebP, ZIP`}</div>
      </div>`;
    return;
  }

  if (state.viewMode === "gallery") {
    renderGallery(center);
    return;
  }

  const file = state.files[state.activeIndex];
  if (!file) return;

  const originalSrc = file.originalDataUrl || "";
  const hasOriginal = originalSrc.length > 0;
  const viewMode = state.viewMode as string;

  center.innerHTML = `
    <div class="preview-header">
      <span class="preview-filename">${file.name}</span>
      <div class="view-switcher">
        <button class="${viewMode === "preview" ? "active" : ""}" data-view="preview">${lucide("columns-2", 14)}</button>
        <button class="${viewMode === "gallery" ? "active" : ""}" data-view="gallery">${lucide("grid-3x3", 14)}</button>
      </div>
    </div>
    <div class="preview-area">
      <div class="preview-panel">
        <div class="label">${t`Before`}</div>
        <div class="frame">
          ${hasOriginal ? `<img src="${originalSrc}" alt="original" />` : '<div class="spinner"></div>'}
        </div>
      </div>
      <div class="preview-panel">
        <div class="label">${t`After`}</div>
        <div class="frame">
          ${file.processed && file.imageDataUrl
            ? `<img src="${file.imageDataUrl}" alt="processed" />`
            : state.processing
              ? `<div style="display:flex;align-items:center;gap:8px;color:var(--text-tertiary);font-size:13px"><div class="spinner"></div> ${t`Processing...`}</div>`
              : `<div style="text-align:center;color:var(--text-tertiary);font-size:13px">${lucide("wand-2", 22)}<br><br>${t`Click Process to strip AI metadata`}</div>`}
        </div>
      </div>
    </div>
  `;

  center.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.viewMode = (btn as HTMLElement).dataset.view as ViewMode;
      render();
    });
  });
}

function renderGallery(center: HTMLElement) {
  center.innerHTML = `
    <div class="preview-header">
      <span class="preview-filename">${t`Gallery`}</span>
      <div class="view-switcher">
        <button class="${state.viewMode === "preview" ? "active" : ""}" data-view="preview">${lucide("columns-2", 14)}</button>
        <button class="${state.viewMode === "gallery" ? "active" : ""}" data-view="gallery">${lucide("grid-3x3", 14)}</button>
      </div>
    </div>
    <div class="gallery-grid">
      ${state.files.map((f, i) => `
        <div class="gallery-item ${i === state.activeIndex ? "active" : ""}" data-index="${i}">
          ${f.originalDataUrl
            ? `<img src="${f.originalDataUrl}" alt="${f.name}" />`
            : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-tertiary)">${lucide("image", 22)}</div>`}
          <div class="gallery-overlay">${f.name}</div>
          ${f.report ? (f.report.findings.length > 0
            ? `<div class="gallery-badge"><span class="badge badge-warning">AI</span></div>`
            : `<div class="gallery-badge"><span class="badge badge-success">${t`Clean`}</span></div>`)
            : ""}
          ${f.processed ? `<div style="position:absolute;bottom:6px;right:6px"><span class="badge badge-success">${lucide("check", 8)}</span></div>` : ""}
        </div>
      `).join("")}
    </div>
  `;

  center.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.viewMode = (btn as HTMLElement).dataset.view as ViewMode;
      render();
    });
  });

  center.querySelectorAll(".gallery-item").forEach((el) => {
    el.addEventListener("click", () => {
      state.activeIndex = parseInt((el as HTMLElement).dataset.index || "0");
      state.viewMode = "preview";
      render();
    });
  });
}

// ── Report ──
function renderReport() {
  const el = $("report");
  if (!el) return;

  const file = state.files[state.activeIndex];
  if (!file || !file.report) {
    el.innerHTML = "";
    return;
  }

  const r = file.report;
  const isWarn = r.findings.length > 0;
  el.innerHTML = `
    <div class="report-card ${isWarn ? "warn" : "safe"}">
      <span class="report-icon">${lucide(isWarn ? "alert-triangle" : "shield-check", 16)}</span>
      <div class="report-content">
        <div class="title">${isWarn ? t`AI metadata detected` : t`Clean`}</div>
        <div class="detail">
          ${isWarn
            ? r.findings.slice(0, 5).map(f => `<div>${f.container}: ${f.signal}</div>`).join("")
            : t`No AI metadata signatures found.`}
          ${r.findings.length > 5 ? `<div style="color:var(--text-tertiary)">${plural(r.findings.length - 5, { one: `...and # more`, other: `...and # more` })}</div>` : ""}
        </div>
      </div>
    </div>
  `;
}

// ── Action Strip ──
function renderActionStrip() {
  const processedCount = state.files.filter(f => f.processed).length;
  const selectedCount = state.files.filter(f => f.selected && f.processed).length;
  const activeFile = state.activeIndex >= 0 ? state.files[state.activeIndex] : null;

  const statusEl = $("status-text");
  if (statusEl) {
    if (state.processing) {
      statusEl.textContent = t`Processing...`;
    } else if (processedCount > 0) {
      statusEl.textContent = plural(processedCount, {
        one: `#/${state.files.length} processed`,
        other: `#/${state.files.length} processed`,
      });
    } else if (state.files.length > 0) {
      statusEl.textContent = plural(state.files.length, {
        one: `# file ready`,
        other: `# files ready`,
      });
    } else {
      statusEl.textContent = t`Ready`;
    }
  }

  const progressEl = $("progress-text");
  if (progressEl) {
    progressEl.textContent = selectedCount > 0
      ? plural(selectedCount, { one: `# selected`, other: `# selected` })
      : "";
  }

  const btnProcess = $("btn-process") as HTMLButtonElement;
  const btnSave = $("btn-save") as HTMLButtonElement;
  const btnSaveAll = $("btn-save-all") as HTMLButtonElement;

  if (btnProcess) {
    btnProcess.disabled = state.processing;
    const label = state.processing
      ? t`Processing...`
      : state.files.length > 1
        ? plural(state.files.length, { one: `Process`, other: `Process All (#)` })
        : t`Process`;
    btnProcess.innerHTML = `${lucide("zap", 15)}<span>${label}</span>`;
  }

  if (btnSave) {
    btnSave.disabled = !(activeFile?.processed && activeFile?.outputPath);
  }

  if (btnSaveAll) {
    btnSaveAll.disabled = !state.files.some(f => f.processed && f.outputPath);
  }
}

// ── File Operations ──
async function pickFiles() {
  try {
    const selected = await open({
      multiple: true,
      filters: [{ name: t`Images & Archives`, extensions: ["png", "jpg", "jpeg", "webp", "bmp", "tiff", "tif", "zip"] }],
    });
    if (!selected) return;
    const paths: string[] = Array.isArray(selected) ? selected : [selected];
    if (paths.length > 0) await addFiles(paths);
  } catch (e) {
    console.error("File picker error:", e);
    toast(t`Failed to open file picker`, "error");
  }
}

async function addFiles(paths: string[]) {
  try {
    const entries = await invoke<ImageEntry[]>("scan_paths", { paths });
    for (const entry of entries) {
      if (state.files.some(f => f.path === entry.path)) continue;
      state.files.push({
        path: entry.path,
        name: entry.name,
        source: entry.source,
        report: null,
        processed: false,
        outputPath: null,
        imageDataUrl: null,
        originalDataUrl: null,
        selected: false,
      });
    }
  } catch (e) {
    console.error("Scan failed:", e);
    for (const p of paths) {
      const name = p.split("/").pop() || p;
      state.files.push({
        path: p, name, source: "file", report: null, processed: false,
        outputPath: null, imageDataUrl: null, originalDataUrl: null, selected: false,
      });
    }
  }
  if (state.activeIndex < 0 && state.files.length > 0) state.activeIndex = 0;
  render();
  toast(plural(paths.length, {
    one: `Added # file`,
    other: `Added # files`,
  }), "success");
  await Promise.all([inspectAll(), loadOriginalPreviews()]);
}

async function inspectAll() {
  const promises = state.files.map(async (f) => {
    if (f.report) return;
    try {
      f.report = await invoke<MetadataReport>("inspect_image", { path: f.path });
    } catch {
      f.report = { findings: [] };
    }
  });
  await Promise.all(promises);
  render();
}

async function loadOriginalPreviews() {
  const promises = state.files.map(async (f) => {
    if (f.originalDataUrl) return;
    try {
      const b64 = await invoke<string>("read_image_as_base64", { path: f.path });
      const ext = f.path.toLowerCase();
      const mime = ext.endsWith(".jpg") || ext.endsWith(".jpeg") ? "image/jpeg"
        : ext.endsWith(".webp") ? "image/webp"
        : "image/png";
      f.originalDataUrl = `data:${mime};base64,${b64}`;
    } catch (e) {
      console.error("Preview load failed for", f.path, e);
    }
  });
  await Promise.all(promises);
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
      const result = await invoke<BatchResponse>("process_batch", { paths, params: state.params });
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
    const cnt = state.files.filter(f => f.processed).length;
    toast(plural(cnt, {
      one: `Processed # image successfully`,
      other: `Processed # images successfully`,
    }), "success");
  } catch (e) {
    console.error("Process failed:", e);
    toast(t`Processing failed`, "error");
  }

  state.processing = false;
  render();
}

async function saveSingle(index: number) {
  const file = state.files[index];
  if (!file?.outputPath) return;
  const suggestedName = file.name.replace(/\.[^.]+$/, "") + "-stript.png";
  try {
    const dest = await save({
      defaultPath: suggestedName,
      filters: [{ name: "PNG", extensions: ["png"] }],
    });
    if (!dest) return;
    const bytes = await readFile(file.outputPath);
    await writeFile(dest, bytes);
    toast(t`File saved successfully`, "success");
  } catch (e) {
    console.error("Save failed:", e);
    toast(t`Save failed`, "error");
  }
}

async function saveAll() {
  const processedFiles = state.files
    .map((f, i) => ({ index: i, file: f }))
    .filter(({ file }) => file.processed && file.outputPath);

  if (processedFiles.length === 0) {
    toast(t`No processed files to save`, "info");
    return;
  }

  if (processedFiles.length === 1) {
    await saveSingle(processedFiles[0].index);
    return;
  }

  try {
    const selected = await open({ directory: true, multiple: false, title: t`Select output directory` });
    if (!selected || typeof selected !== "string") return;

    let saved = 0;
    for (const { file } of processedFiles) {
      const destName = file.name.replace(/\.[^.]+$/, "") + "-stript.png";
      const destPath = selected.endsWith("/") ? selected + destName : selected + "/" + destName;
      const bytes = await readFile(file.outputPath!);
      await writeFile(destPath, bytes);
      saved++;
    }

    toast(plural(saved, {
      one: `Saved # file to output directory`,
      other: `Saved # files to output directory`,
    }), "success");
  } catch (e) {
    console.error("Batch save failed:", e);
    toast(t`Batch save failed`, "error");
  }
}

// ── Drag & Drop ──
function setupDragDrop() {
  document.body.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  document.body.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const paths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i] as File & { path?: string };
      if (f.path) paths.push(f.path);
    }
    if (paths.length > 0) await addFiles(paths);
  });
}

// ── Init ──
document.addEventListener("DOMContentLoaded", async () => {
  await setupI18n();
  render();
  setupDragDrop();

  $("btn-add")?.addEventListener("click", pickFiles);
  $("btn-clear")?.addEventListener("click", () => {
    if (state.files.length === 0) return;
    state.files = [];
    state.activeIndex = -1;
    state.viewMode = "preview";
    render();
    toast(t`All files cleared`, "info");
  });

  $("btn-process")?.addEventListener("click", processActive);
  $("btn-save")?.addEventListener("click", () => saveSingle(state.activeIndex));
  $("btn-save-all")?.addEventListener("click", saveAll);

  setupLocaleDropdown();
});
