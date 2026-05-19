import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeFile, readFile } from "@tauri-apps/plugin-fs";
import type { MetadataReport, ProcessParams, ProcessResponse, BatchResponse, Preset, ImageEntry } from "./types";
import { PRESET_PARAMS } from "./types";
import { t, plural } from "@lingui/core/macro";
import { i18n, setupI18n, getLocale, switchLocale, LOCALES, type Locale } from "./i18n";

type DirtyKey = "workspace" | "params" | "actions" | "labels";

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
  modalOpen: false,
};

const dirty = new Set<DirtyKey>();

function markDirty(...keys: DirtyKey[]) {
  for (const k of keys) dirty.add(k);
}

function markAll() {
  (["workspace", "params", "actions", "labels"] as DirtyKey[]).forEach(k => dirty.add(k));
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function lucide(name: string, size = 16): string {
  return `<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`;
}

function refreshIcons() {
  try { (window as any).lucide?.createIcons(); } catch {}
}

function flush() {
  if (dirty.has("workspace")) renderWorkspace();
  if (dirty.has("actions")) renderActions();
  if (dirty.has("labels")) renderStaticLabels();
  if (dirty.size > 0) {
    updateLocaleButton();
    refreshIcons();
  }
  dirty.clear();
}

function render() {
  markAll();
  flush();
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

function renderStaticLabels() {
  const set = (id: string, text: string) => {
    const el = $(id);
    if (el) el.textContent = text;
  };
  set("label-add", t`Add`);
  set("label-process", t`Process`);
  set("label-process-all", t`Process All`);
  set("label-save", t`Save`);
  set("label-save-all", t`Save All`);
  set("label-clear", t`Clear all`);
  set("label-drop-hint", t`Drop images here`);
  set("label-drop-formats", t`PNG, JPEG, WebP, ZIP`);
  set("label-or-click", t`or click to browse`);
  set("label-advanced", t`Advanced parameters`);
  set("label-preset", t`Preset`);
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

// ═══════════════════════════════════════
// WORKSPACE — Permute-style single view
// ═══════════════════════════════════════

function renderWorkspace() {
  const container = $("app-body");
  if (!container) return;

  if (state.files.length === 0) {
    container.innerHTML = renderEmptyState();
    attachEmptyStateEvents();
    return;
  }

  container.innerHTML = `
    <div class="workspace-content">
      ${renderAddBar()}
      ${renderFileGrid()}
      ${renderParamsSection()}
      ${renderActionSection()}
    </div>
  `;

  attachGridEvents();
  attachParamEvents();
  attachActionEvents();
}

function renderEmptyState(): string {
  return `
    <div class="empty-state" id="empty-state">
      <div class="drop-zone-large" id="drop-zone">
        <div class="drop-zone-icon">${lucide("image-plus", 48)}</div>
        <div class="drop-zone-title" id="label-drop-hint">Drop images here</div>
        <div class="drop-zone-subtitle" id="label-or-click">or click to browse</div>
        <div class="drop-zone-formats" id="label-drop-formats">PNG, JPEG, WebP, ZIP</div>
      </div>
    </div>
  `;
}

function attachEmptyStateEvents() {
  $("drop-zone")?.addEventListener("click", pickFiles);
}

function renderAddBar(): string {
  return `
    <div class="add-bar">
      <button class="btn btn-ghost btn-sm" id="btn-add">
        ${lucide("plus", 14)}
        <span id="label-add">Add</span>
      </button>
      <div class="file-count-badge">
        ${state.files.length} ${state.files.length === 1 ? t`file` : t`files`}
      </div>
      <div class="spacer"></div>
      <button class="btn btn-ghost btn-sm btn-danger-ghost" id="btn-clear">
        ${lucide("trash-2", 14)}
        <span id="label-clear">Clear all</span>
      </button>
    </div>
  `;
}

function renderFileGrid(): string {
  const selectedCount = state.files.filter(f => f.selected).length;

  let html = `
    <div class="file-grid">
      ${state.files.map((f, i) => {
        const isActive = i === state.activeIndex;
        const status = f.processed
          ? "processed"
          : f.report
            ? f.report.findings.length > 0
              ? "warning"
              : "clean"
            : "pending";

        return `
          <div class="file-card ${isActive ? "active" : ""} ${f.selected ? "selected" : ""}" data-index="${i}">
            <div class="file-card-thumb">
              ${f.originalDataUrl
                ? `<img src="${f.originalDataUrl}" alt="${f.name}" />
                   ${f.processed ? `<div class="file-card-processed-overlay">${lucide("check-circle-2", 24)}</div>` : ""}`
                : `<div class="file-card-placeholder">${lucide("image", 28)}</div>`}
            </div>
            <div class="file-card-info">
              <div class="file-card-name" title="${f.name}">${f.name}</div>
              <div class="file-card-status">
                ${status === "pending" ? `<span class="status-dot"></span><span class="status-text">${t`Scanning...`}</span>`
                  : status === "clean" ? `<span class="status-dot success"></span><span class="status-text success">${t`Clean`}</span>`
                  : status === "warning" ? `<span class="status-dot warning"></span><span class="status-text warning">${t`AI detected`}</span>`
                  : `<span class="status-dot success"></span><span class="status-text success">${t`Stripped`}</span>`}
              </div>
            </div>
            <div class="file-card-actions">
              ${f.processed && f.outputPath
                ? `<button class="btn-icon btn-sm" data-save="${i}" title="${t`Save`}">${lucide("download", 14)}</button>`
                : ""}
              <button class="btn-icon btn-sm" data-preview="${i}" title="${t`Preview`}">${lucide("eye", 14)}</button>
              <button class="btn-icon btn-sm btn-danger-ghost" data-remove="${i}" title="${t`Remove`}">${lucide("x", 14)}</button>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  if (selectedCount > 0) {
    html += `
      <div class="selection-bar">
        <span><strong>${selectedCount}</strong> ${t`selected`}</span>
        <button class="btn btn-ghost btn-sm" id="btn-deselect">${lucide("x", 12)} ${t`Deselect`}</button>
      </div>
    `;
  }

  return html;
}

function attachGridEvents() {
  $("btn-add")?.addEventListener("click", pickFiles);

  $("btn-clear")?.addEventListener("click", () => {
    if (state.files.length === 0) return;
    state.files = [];
    state.activeIndex = -1;
    render();
    toast(t`All files cleared`, "info");
  });

  $("btn-deselect")?.addEventListener("click", () => {
    state.files.forEach(f => (f.selected = false));
    markDirty("workspace");
    flush();
  });

  document.querySelectorAll(".file-card").forEach((el) => {
    el.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-save]") || target.closest("[data-preview]") || target.closest("[data-remove]")) return;

      const idx = parseInt((el as HTMLElement).dataset.index || "0");
      state.activeIndex = idx;
      markDirty("workspace");
      flush();
    });
  });

  document.querySelectorAll("[data-save]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt((el as HTMLElement).dataset.save || "0");
      saveSingle(idx);
    });
  });

  document.querySelectorAll("[data-preview]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt((el as HTMLElement).dataset.preview || "0");
      openPreviewModal(idx);
    });
  });

  document.querySelectorAll("[data-remove]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt((el as HTMLElement).dataset.remove || "0");
      state.files.splice(idx, 1);
      if (state.activeIndex >= state.files.length) state.activeIndex = state.files.length - 1;
      if (state.files.length === 0) state.activeIndex = -1;
      render();
    });
  });
}

// ═══════════════════════════════════════
// PARAMETERS — Collapsible, preset-first
// ═══════════════════════════════════════

function renderParamsSection(): string {
  return `
    <div class="params-section">
      <div class="section-header">
        <span class="section-title" id="label-preset">Preset</span>
      </div>
      <div class="preset-segmented" id="preset-segmented">
        ${(["Subtle", "Standard", "Aggressive"] as Preset[]).map(pr => {
          const presetLabel = pr === "Subtle" ? t`Subtle` : pr === "Standard" ? t`Standard` : t`Aggressive`;
          return `<button class="preset-segment ${state.preset === pr ? "active" : ""}" data-preset="${pr}">${presetLabel}</button>`;
        }).join("")}
      </div>
      <button class="toggle-btn ${state.advancedOpen ? "open" : ""}" id="toggle-advanced">
        <span class="chevron">${lucide("chevron-right", 12)}</span>
        <span id="label-advanced">Advanced parameters</span>
      </button>
      <div class="advanced-params ${state.advancedOpen ? "open" : ""}" id="advanced-params">
        ${renderAdvancedParams()}
      </div>
    </div>
  `;
}

function renderAdvancedParams(): string {
  const p = state.params;
  return `
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
  `;
}

function attachParamEvents() {
  $("toggle-advanced")?.addEventListener("click", () => {
    state.advancedOpen = !state.advancedOpen;
    const el = $("advanced-params");
    if (el) el.classList.toggle("open", state.advancedOpen);
    const btn = $("toggle-advanced");
    if (btn) btn.classList.toggle("open", state.advancedOpen);
    refreshIcons();
  });

  document.querySelectorAll("#preset-segmented .preset-segment").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pr = (btn as HTMLElement).dataset.preset as Preset;
      state.preset = pr;
      state.params = { ...PRESET_PARAMS[pr] };
      markDirty("workspace", "actions");
      flush();
    });
  });

  document.querySelectorAll(".advanced-params input[type=range]").forEach((input) => {
    const el = input as HTMLInputElement;
    const updateProgress = () => {
      const min = parseFloat(el.min);
      const max = parseFloat(el.max);
      const val = parseFloat(el.value);
      const pct = ((val - min) / (max - min)) * 100;
      el.style.setProperty("--range-progress", `${pct}%`);
    };
    updateProgress();
    el.addEventListener("input", () => {
      const key = el.dataset.param as keyof ProcessParams;
      const val = parseFloat(el.value);
      if (key === "noise_fraction") {
        state.params[key] = val / 100;
      } else {
        (state.params[key] as number) = val;
      }
      state.preset = "" as Preset;
      updateProgress();
      const valSpan = el.parentElement?.querySelector(".param-val") as HTMLElement;
      if (valSpan) {
        if (key === "noise_fraction") valSpan.textContent = `${val.toFixed(1)}%`;
        else if (key === "resize_scale") valSpan.textContent = val.toFixed(3);
        else valSpan.textContent = String(val);
      }
    });
    el.addEventListener("change", () => {
      markDirty("workspace", "actions");
      flush();
    });
  });
}

// ═══════════════════════════════════════
// ACTIONS — Contextual, centered
// ═══════════════════════════════════════

function renderActions(): string {
  return "";
}

function renderActionSection(): string {
  const processedCount = state.files.filter(f => f.processed).length;
  const hasProcessed = processedCount > 0;
  const allProcessed = processedCount === state.files.length && state.files.length > 0;

  return `
    <div class="action-section">
      <button class="btn btn-primary btn-lg" id="btn-process" ${state.processing ? "disabled" : ""}>
        ${state.processing ? lucide("loader-2", 18) : lucide("zap", 18)}
        <span id="label-process">${state.processing ? t`Processing...` : state.files.length > 1 ? t`Process All` : t`Process`}</span>
      </button>
      ${hasProcessed ? `
        <button class="btn btn-secondary btn-lg" id="btn-save-all">
          ${lucide("download", 16)}
          <span id="label-save-all">${processedCount > 1 ? t`Save All` : t`Save`}</span>
        </button>
      ` : ""}
    </div>
  `;
}

function attachActionEvents() {
  $("btn-process")?.addEventListener("click", processAll);
  $("btn-save-all")?.addEventListener("click", saveAll);
}

// ═══════════════════════════════════════
// PREVIEW MODAL
// ═══════════════════════════════════════

function openPreviewModal(index: number) {
  const file = state.files[index];
  if (!file) return;

  state.modalOpen = true;
  const modal = $("preview-modal");
  const body = $("modal-body");
  if (!modal || !body) return;

  const originalSrc = file.originalDataUrl || "";
  const hasOriginal = originalSrc.length > 0;

  body.innerHTML = `
    <div class="modal-preview">
      <div class="modal-preview-panel">
        <div class="modal-preview-label">${t`Original`}</div>
        <div class="modal-preview-frame">
          ${hasOriginal ? `<img src="${originalSrc}" alt="original" />` : `<div class="spinner"></div>`}
        </div>
      </div>
      <div class="modal-preview-panel">
        <div class="modal-preview-label">${t`Stripped`}</div>
        <div class="modal-preview-frame">
          ${file.processed && file.imageDataUrl
            ? `<img src="${file.imageDataUrl}" alt="processed" />`
            : state.processing
              ? `<div style="display:flex;align-items:center;gap:8px;color:var(--text-tertiary)"><div class="spinner"></div> ${t`Processing...`}</div>`
              : `<div class="modal-preview-placeholder">${lucide("wand-2", 32)}<div>${t`Process to see result`}</div></div>`}
        </div>
      </div>
    </div>
    ${file.report ? `
      <div class="modal-report ${file.report.findings.length > 0 ? "warn" : "safe"}">
        ${lucide(file.report.findings.length > 0 ? "alert-triangle" : "shield-check", 16)}
        <span>${file.report.findings.length > 0 ? t`AI metadata detected` : t`No AI metadata found`}</span>
      </div>
    ` : ""}
  `;

  modal.classList.remove("hidden");
  refreshIcons();
}

function closePreviewModal() {
  state.modalOpen = false;
  $("preview-modal")?.classList.add("hidden");
}

// ═══════════════════════════════════════
// FILE OPERATIONS
// ═══════════════════════════════════════

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
  markDirty("workspace");
  flush();
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
  markDirty("workspace");
  flush();
}

async function processAll() {
  if (state.files.length === 0) return;
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

// ═══════════════════════════════════════
// DRAG & DROP
// ═══════════════════════════════════════

function setupDragDrop() {
  const app = $("app");
  if (!app) return;

  let dragCounter = 0;

  document.body.addEventListener("dragenter", (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) {
      app.classList.add("drag-over");
    }
  });

  document.body.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      app.classList.remove("drag-over");
    }
  });

  document.body.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  document.body.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    app.classList.remove("drag-over");

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

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════

document.addEventListener("DOMContentLoaded", async () => {
  await setupI18n();
  render();
  setupDragDrop();

  $("modal-close")?.addEventListener("click", closePreviewModal);
  $("preview-modal")?.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).classList.contains("modal-backdrop")) {
      closePreviewModal();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.modalOpen) closePreviewModal();
  });

  setupLocaleDropdown();
});
