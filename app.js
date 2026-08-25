const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  dropzone: $("#dropzone"),
  fileInput: $("#fileInput"),
  browseBtn: $("#browseBtn"),
  replaceBtn: $("#replaceBtn"),
  fileCard: $("#fileCard"),
  sourceVideo: $("#sourceVideo"),
  fileName: $("#fileName"),
  fileMeta: $("#fileMeta"),
  materialState: $("#materialState"),
  spriteSyncBar: $("#spriteSyncBar"),
  spriteSyncSummary: $("#spriteSyncSummary"),
  backToEditorBtn: $("#backToEditorBtn"),
  emptyPreview: $("#emptyPreview"),
  spriteCanvas: $("#spriteCanvas"),
  previewViewport: $("#previewViewport"),
  processingOverlay: $("#processingOverlay"),
  processingPercent: $("#processingPercent"),
  processingBar: $("#processingBar"),
  processingText: $("#processingText"),
  previewScale: $("#previewScale"),
  timelineStartLabel: $("#timelineStartLabel"),
  durationLabel: $("#durationLabel"),
  trimSection: $("#trimSection"),
  clipDurationLabel: $("#clipDurationLabel"),
  trimStartInput: $("#trimStartInput"),
  trimEndInput: $("#trimEndInput"),
  trimStartRange: $("#trimStartRange"),
  trimEndRange: $("#trimEndRange"),
  trimRangeWrap: $("#trimRangeWrap"),
  trimStartLabel: $("#trimStartLabel"),
  trimEndLabel: $("#trimEndLabel"),
  frameCount: $("#frameCount"),
  frameCountNumber: $("#frameCountNumber"),
  countControl: $("#countControl"),
  fpsControl: $("#fpsControl"),
  fps: $("#fps"),
  fpsNumber: $("#fpsNumber"),
  frameWidthInput: $("#frameWidthInput"),
  frameHeightInput: $("#frameHeightInput"),
  aspectLock: $("#aspectLock"),
  dimensionHint: $("#dimensionHint"),
  formatSelect: $("#formatSelect"),
  compressionLevel: $("#compressionLevel"),
  compressionLevelControl: $("#compressionLevelControl"),
  compressionLevelValue: $("#compressionLevelValue"),
  compressionLevelHint: $("#compressionLevelHint"),
  compressionHint: $("#compressionHint"),
  postCompression: $("#postCompression"),
  precisionCompressBtn: $("#precisionCompressBtn"),
  precisionCompressionStatus: $("#precisionCompressionStatus"),
  outputSpec: $("#outputSpec"),
  canvasDimensions: $("#canvasDimensions"),
  summaryFrames: $("#summaryFrames"),
  summaryClip: $("#summaryClip"),
  summarySize: $("#summarySize"),
  generateBtn: $("#generateBtn"),
  generateLabel: $("#generateLabel"),
  downloadBtn: $("#downloadBtn"),
  downloadMeta: $("#downloadMeta"),
  resetBtn: $("#resetBtn"),
  toast: $("#toast"),
};

const defaults = {
  mode: "count",
  frameCount: 12,
  fps: 2,
  frameWidth: 750,
  frameHeight: 422,
  aspectLocked: true,
  trimStart: 0,
  trimEnd: null,
  format: "image/webp",
  transparentPNG: false,
  compressionLevel: 35,
};

const state = {
  ...defaults,
  file: null,
  fileUrl: null,
  duration: 0,
  videoWidth: 16,
  videoHeight: 9,
  rawOutputBlob: null,
  outputBlob: null,
  outputWidth: 0,
  outputHeight: 0,
  outputCompressed: false,
  compressionAttempted: false,
  compressionSavings: 0,
  isCompressing: false,
  isProcessing: false,
  editorSynced: false,
};

const typeExtensions = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDownloadBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatPreciseTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(safe / 60);
  const secs = (safe % 60).toFixed(1).padStart(4, "0");
  return `${String(mins).padStart(2, "0")}:${secs}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isVideoFile(file) {
  return Boolean(file && (
    file.type?.startsWith("video/")
    || /\.(mp4|mov|m4v|webm|ogv)$/i.test(file.name || "")
  ));
}

function selectedFrameCount() {
  if (state.mode === "fps" && state.duration) {
    return clamp(Math.round(clipDuration() * state.fps), 2, 48);
  }
  return state.frameCount;
}

function clipDuration() {
  const end = state.trimEnd ?? state.duration;
  return Math.max(0.1, end - state.trimStart);
}

function editorBridge() {
  const bridge = window.SPRITEEE_EDITOR;
  return state.editorSynced && bridge?.hasVideo?.() ? bridge : null;
}

function frameHeight() {
  if (state.aspectLocked) {
    return Math.max(16, Math.round(state.frameWidth * state.videoHeight / state.videoWidth));
  }
  return clamp(Math.round(state.frameHeight), 16, 4096);
}

function estimateBytes() {
  const pixels = selectedFrameCount() * state.frameWidth * frameHeight();
  const lossyMultiplier = 0.72 - state.compressionLevel / 100 * 0.44;
  const multiplier = state.format === "image/png" ? 1.35 : lossyMultiplier;
  return pixels * multiplier;
}

function compressionLevelLabel() {
  if (state.compressionLevel <= 30) return "轻度";
  if (state.compressionLevel <= 65) return "均衡";
  return "强力";
}

function outputQuality() {
  return clamp(1 - state.compressionLevel / 100 * 0.5, 0.5, 0.95);
}

function syncOutputFileUI({ pulse = false } = {}) {
  if (!state.outputBlob) return;
  const extension = typeExtensions[state.format].toUpperCase();
  const currentSize = formatDownloadBytes(state.outputBlob.size);
  const status = state.outputCompressed ? "已压缩" : state.compressionAttempted ? "已优化" : "原图";
  els.summarySize.textContent = currentSize;
  els.downloadMeta.textContent = `${extension} · ${currentSize} · ${status}`;
  els.downloadBtn.title = `当前下载文件：${extension} · ${currentSize}`;
  if (pulse) {
    els.downloadBtn.classList.remove("size-updated");
    requestAnimationFrame(() => els.downloadBtn.classList.add("size-updated"));
  }
}

function setRangeProgress(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = Number(input.value);
  const percent = ((value - min) / (max - min)) * 100;
  input.style.setProperty("--progress", `${percent}%`);
}

function markDirty() {
  if (!state.file || state.isProcessing || state.isCompressing) return;
  state.rawOutputBlob = null;
  state.outputBlob = null;
  state.outputCompressed = false;
  state.compressionAttempted = false;
  state.compressionSavings = 0;
  els.downloadBtn.hidden = true;
  els.generateLabel.textContent = "生成原始精灵图";
  els.materialState.textContent = state.editorSynced ? "编辑已同步" : "参数已更改";
  window.dispatchEvent(new CustomEvent("spriteeee:sprite-dirty"));
}

function updateUI({ dirty = false } = {}) {
  if (state.transparentPNG) {
    state.format = "image/png";
  }
  if (dirty && state.file) markDirty();
  const frames = selectedFrameCount();
  const height = frameHeight();
  const width = frames * state.frameWidth;
  const extension = typeExtensions[state.format].toUpperCase();
  const trimEnd = state.trimEnd ?? state.duration;
  const maxTrim = Math.max(0.1, state.duration || 10);

  els.frameCount.value = state.frameCount;
  els.frameCountNumber.value = state.frameCount;
  els.fps.value = state.fps;
  els.fpsNumber.value = state.fps;
  els.compressionLevel.value = state.compressionLevel;
  els.compressionLevelValue.textContent = `${state.compressionLevel}% · ${compressionLevelLabel()}`;
  els.formatSelect.value = state.format;
  els.formatSelect.disabled = state.transparentPNG || state.isProcessing || state.isCompressing;
  const isLosslessPNG = state.format === "image/png";
  els.compressionLevel.disabled = state.isCompressing;
  els.compressionLevelHint.textContent = isLosslessPNG
    ? "无损优化强度，画面、尺寸与透明度不会改变"
    : "越高文件越小，建议使用 25%–55%";
  els.frameWidthInput.value = state.frameWidth;
  els.frameHeightInput.value = height;
  els.aspectLock.classList.toggle("active", state.aspectLocked);
  els.aspectLock.setAttribute("aria-pressed", String(state.aspectLocked));
  els.aspectLock.querySelector("span").textContent = state.aspectLocked ? "比例锁定" : "自由尺寸";
  els.dimensionHint.textContent = state.aspectLocked ? "已按原视频比例锁定宽高" : "宽度与高度可独立调整";
  els.spriteSyncBar.hidden = !state.editorSynced;

  els.trimSection.classList.toggle("is-disabled", !state.file);
  [els.trimStartInput, els.trimEndInput, els.trimStartRange, els.trimEndRange].forEach((input) => { input.disabled = !state.file; });
  els.trimStartInput.max = Math.max(0, maxTrim - 0.1);
  els.trimEndInput.max = maxTrim;
  els.trimStartRange.max = maxTrim;
  els.trimEndRange.max = maxTrim;
  els.trimStartInput.value = Number(state.trimStart.toFixed(1));
  els.trimEndInput.value = Number(trimEnd.toFixed(1));
  els.trimStartRange.value = state.trimStart;
  els.trimEndRange.value = trimEnd;
  const startPercent = state.duration ? (state.trimStart / state.duration) * 100 : 0;
  const endPercent = state.duration ? (trimEnd / state.duration) * 100 : 100;
  els.trimRangeWrap.style.setProperty("--trim-start", `${startPercent}%`);
  els.trimRangeWrap.style.setProperty("--trim-end", `${endPercent}%`);
  els.trimStartLabel.textContent = formatPreciseTime(state.trimStart);
  els.trimEndLabel.textContent = formatPreciseTime(trimEnd);
  els.timelineStartLabel.textContent = formatDuration(state.trimStart);
  els.durationLabel.textContent = state.file ? formatDuration(trimEnd) : "END";
  els.clipDurationLabel.textContent = state.file ? `已选 ${clipDuration().toFixed(1)} 秒` : "上传视频后可用";
  setRangeProgress(els.frameCount);
  setRangeProgress(els.fps);
  setRangeProgress(els.compressionLevel);

  els.canvasDimensions.textContent = state.file ? `${width} × ${height}` : `${width} × AUTO`;
  els.summaryFrames.textContent = `${frames} FRAMES`;
  els.summaryClip.textContent = state.file ? `${clipDuration().toFixed(1)} 秒` : "完整视频";
  els.summarySize.textContent = state.outputBlob ? formatBytes(state.outputBlob.size) : `≈ ${formatBytes(estimateBytes())}`;
  if (state.outputBlob) syncOutputFileUI();
  els.outputSpec.textContent = `${width} × ${state.file ? height : "AUTO"} / ${extension}`;
  els.countControl.hidden = state.mode !== "count";
  els.fpsControl.hidden = state.mode !== "fps";
  els.compressionHint.textContent = state.transparentPNG
    ? "透明 PNG 会先按完整像素生成，压缩时不缩图、不减色"
    : isLosslessPNG
      ? "PNG 先按完整像素生成，再进行无损优化"
      : "先按最高画质生成，再按下方保真度精准压缩";

  const hasOutput = Boolean(state.rawOutputBlob);
  els.postCompression.classList.toggle("ready", hasOutput && !state.compressionAttempted);
  els.postCompression.classList.toggle("compressed", state.compressionAttempted);
  els.postCompression.classList.toggle("compressing", state.isCompressing);
  els.precisionCompressBtn.disabled = !hasOutput || state.isProcessing || state.isCompressing;
  els.precisionCompressBtn.querySelector("span").textContent = state.isCompressing
    ? "正在压缩"
    : state.compressionAttempted
      ? "重新压缩"
      : "开始压缩";
  if (state.isCompressing) {
    els.precisionCompressionStatus.textContent = isLosslessPNG ? "正在进行像素级无损优化…" : `正在按 ${state.compressionLevel}% 压缩程度重新编码…`;
  } else if (state.compressionAttempted) {
    els.precisionCompressionStatus.textContent = state.outputCompressed
      ? `已完成 · ${formatDownloadBytes(state.rawOutputBlob.size)} → ${formatDownloadBytes(state.outputBlob.size)} · 尺寸不变`
      : "已完成 · 当前已是最佳大小 · 尺寸不变";
  } else if (hasOutput) {
    els.precisionCompressionStatus.textContent = `原始文件 ${formatBytes(state.rawOutputBlob.size)} · ${state.compressionLevel}% ${isLosslessPNG ? "无损优化" : "压缩"}`;
  } else {
    els.precisionCompressionStatus.textContent = "生成精灵图后可用 · 不改变尺寸";
  }

  $$(".segment").forEach((button) => button.classList.toggle("active", button.dataset.mode === state.mode));
  $$(".size-grid button").forEach((button) => button.classList.toggle("active", Number(button.dataset.width) === state.frameWidth));

  if (state.file) {
    els.generateBtn.disabled = state.isProcessing || state.isCompressing;
  }
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}
window.toast = toast;

function openFilePicker() {
  if (!state.isProcessing && !state.isCompressing) {
    els.fileInput.value = "";
    els.fileInput.click();
  }
}

async function loadVideoFile(file, { fromEditor = false, silent = false } = {}) {
  if (state.isProcessing || state.isCompressing) {
    if (!silent) toast("请等待当前处理完成");
    return;
  }
  if (!isVideoFile(file)) {
    toast("请选择有效的视频文件");
    return;
  }

  if (!fromEditor) state.editorSynced = false;
  if (state.fileUrl) URL.revokeObjectURL(state.fileUrl);
  state.file = file;
  state.fileUrl = URL.createObjectURL(file);
  state.rawOutputBlob = null;
  state.outputBlob = null;
  state.outputCompressed = false;
  state.compressionAttempted = false;
  state.compressionSavings = 0;

  try {
    const metadataReady = new Promise((resolve, reject) => {
      const cleanup = () => {
        els.sourceVideo.removeEventListener("loadedmetadata", onReady);
        els.sourceVideo.removeEventListener("error", onError);
      };
      const onReady = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new Error("无法读取视频")); };
      els.sourceVideo.addEventListener("loadedmetadata", onReady, { once: true });
      els.sourceVideo.addEventListener("error", onError, { once: true });
    });
    els.sourceVideo.src = state.fileUrl;
    await metadataReady;

    state.duration = els.sourceVideo.duration;
    state.videoWidth = els.sourceVideo.videoWidth;
    state.videoHeight = els.sourceVideo.videoHeight;
    state.trimStart = 0;
    state.trimEnd = state.duration;
    if (state.aspectLocked) state.frameHeight = Math.round(state.frameWidth * state.videoHeight / state.videoWidth);
    els.fileName.textContent = file.name;
    els.fileMeta.textContent = `${formatBytes(file.size)} · ${state.videoWidth}×${state.videoHeight} · ${formatDuration(state.duration)}`;
    els.dropzone.hidden = true;
    els.fileCard.hidden = false;
    els.emptyPreview.hidden = false;
    els.spriteCanvas.hidden = true;
    els.downloadBtn.hidden = true;
    els.materialState.textContent = "素材就绪";
    els.generateBtn.disabled = false;
    els.generateLabel.textContent = "生成原始精灵图";
    updateUI();
    if (!fromEditor) {
      window.dispatchEvent(new CustomEvent("spriteeee:sprite-source", { detail: { file } }));
    }
    if (!silent) toast(fromEditor ? "编辑素材已同步到精灵图" : "视频已载入，素材不会离开本地");
  } catch (error) {
    if (state.fileUrl) URL.revokeObjectURL(state.fileUrl);
    state.file = null;
    state.fileUrl = null;
    els.sourceVideo.removeAttribute("src");
    els.generateBtn.disabled = true;
    toast(error.message);
  }
}

function seekVideo(time) {
  return new Promise((resolve, reject) => {
    const video = els.sourceVideo;
    const target = clamp(time, 0, Math.max(0, video.duration - 0.001));
    if (Math.abs(video.currentTime - target) < 0.001) {
      requestAnimationFrame(resolve);
      return;
    }
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("读取视频帧失败"));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.currentTime = target;
  });
}

function applyEditorTimeline({ resetTrim = false } = {}) {
  const bridge = window.SPRITEEE_EDITOR;
  if (!bridge?.hasVideo?.()) return;
  const previousDuration = state.duration;
  const wasFullClip = state.trimStart <= 0.001
    && Math.abs((state.trimEnd ?? previousDuration) - previousDuration) < 0.11;
  const duration = Math.max(0.1, bridge.getOutputDuration());
  const aspect = Math.max(0.05, bridge.getAspect());
  state.editorSynced = true;
  state.duration = duration;
  state.videoWidth = Math.max(1, Math.round(aspect * 1000));
  state.videoHeight = 1000;
  if (resetTrim || wasFullClip) {
    state.trimStart = 0;
    state.trimEnd = duration;
  } else {
    state.trimStart = clamp(state.trimStart, 0, Math.max(0, duration - 0.1));
    state.trimEnd = clamp(state.trimEnd ?? duration, state.trimStart + Math.min(0.1, duration), duration);
  }
  if (state.aspectLocked) state.frameHeight = frameHeight();
  const summary = bridge.getSummary();
  els.fileMeta.textContent = `编辑结果 · ${summary.ratio} · ${duration.toFixed(1)} 秒`;
  els.spriteSyncSummary.textContent = `${summary.ratio} · ${summary.speed} · ${summary.direction}${summary.matting ? " · AI 抠像" : ""}`;
  updateUI({ dirty: true });
}

async function syncFromEditor({ resetTrim = false } = {}) {
  if (state.isProcessing) return;
  const bridge = window.SPRITEEE_EDITOR;
  if (!bridge?.hasVideo?.()) return;
  const file = bridge.getFile();
  if (!state.file || state.file !== file) {
    await loadVideoFile(file, { fromEditor: true, silent: true });
    resetTrim = true;
  }
  applyEditorTimeline({ resetTrim });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片编码失败")), type, quality);
  });
}

function quantizeTransparentCanvas(source, scale, preferredQuality, attempt) {
  const frames = selectedFrameCount();
  const sourceFrameWidth = source.width / frames;
  const scaledFrameWidth = Math.max(8, Math.floor(sourceFrameWidth * scale));
  const canvas = document.createElement("canvas");
  canvas.width = scaledFrameWidth * frames;
  canvas.height = Math.max(1, Math.round(source.height * canvas.width / source.width));
  const context = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const qualityFactor = clamp(preferredQuality / 100, 0.3, 1);
  const baseColorStep = qualityFactor >= 0.9 ? 4 : qualityFactor >= 0.72 ? 7 : 12;
  const colorStep = Math.min(28, Math.round(baseColorStep * (1 + attempt * 0.28)));
  const alphaStep = Math.min(16, Math.max(3, Math.round(colorStep * 0.62)));
  for (let index = 0; index < image.data.length; index += 4) {
    const alpha = image.data[index + 3];
    if (alpha < 3) {
      image.data[index] = 0;
      image.data[index + 1] = 0;
      image.data[index + 2] = 0;
      image.data[index + 3] = 0;
      continue;
    }
    image.data[index] = Math.min(255, Math.round(image.data[index] / colorStep) * colorStep);
    image.data[index + 1] = Math.min(255, Math.round(image.data[index + 1] / colorStep) * colorStep);
    image.data[index + 2] = Math.min(255, Math.round(image.data[index + 2] / colorStep) * colorStep);
    image.data[index + 3] = Math.min(255, Math.round(alpha / alphaStep) * alphaStep);
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

let pngCrcTable = null;

function crc32(bytes) {
  if (!pngCrcTable) {
    pngCrcTable = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      pngCrcTable[index] = value >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = pngCrcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function joinBytes(parts) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });
  return output;
}

function pngChunk(type, data) {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(joinBytes([typeBytes, data])));
  return chunk;
}

function paethPredictor(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  if (upDistance <= upperLeftDistance) return up;
  return upperLeft;
}

function filterRGBAForPNG(image, width, height, compressionLevel = 35) {
  const bytesPerPixel = 4;
  const rowLength = width * bytesPerPixel;
  const filtered = new Uint8Array((rowLength + 1) * height);
  const candidate = new Uint8Array(rowLength);
  const filterTypes = compressionLevel <= 30
    ? [0, 1]
    : compressionLevel <= 65
      ? [0, 1, 2, 3]
      : [0, 1, 2, 3, 4];
  for (let y = 0; y < height; y += 1) {
    const sourceOffset = y * rowLength;
    const outputOffset = y * (rowLength + 1);
    let bestScore = Infinity;
    for (const filterType of filterTypes) {
      let score = 0;
      for (let x = 0; x < rowLength; x += 1) {
        const value = image.data[sourceOffset + x];
        const left = x >= bytesPerPixel ? image.data[sourceOffset + x - bytesPerPixel] : 0;
        const up = y > 0 ? image.data[sourceOffset - rowLength + x] : 0;
        const upperLeft = y > 0 && x >= bytesPerPixel
          ? image.data[sourceOffset - rowLength + x - bytesPerPixel]
          : 0;
        let filteredValue = value;
        if (filterType === 1) filteredValue = value - left;
        else if (filterType === 2) filteredValue = value - up;
        else if (filterType === 3) filteredValue = value - Math.floor((left + up) / 2);
        else if (filterType === 4) filteredValue = value - paethPredictor(left, up, upperLeft);
        filteredValue &= 255;
        candidate[x] = filteredValue;
        score += filteredValue < 128 ? filteredValue : 256 - filteredValue;
      }
      if (score < bestScore) {
        bestScore = score;
        filtered[outputOffset] = filterType;
        filtered.set(candidate, outputOffset + 1);
      }
    }
  }
  return filtered;
}

async function encodeLosslessPNG(source, compressionLevel = 35) {
  if (typeof CompressionStream === "undefined") return null;
  const context = source.getContext("2d", { alpha: true, willReadFrequently: true });
  const image = context.getImageData(0, 0, source.width, source.height);
  const filtered = filterRGBAForPNG(image, source.width, source.height, compressionLevel);
  const compressedBuffer = await new Response(
    new Blob([filtered]).stream().pipeThrough(new CompressionStream("deflate")),
  ).arrayBuffer();
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, source.width);
  headerView.setUint32(4, source.height);
  header[8] = 8;
  header[9] = 6;
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const png = joinBytes([
    signature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", new Uint8Array(compressedBuffer)),
    pngChunk("IEND", new Uint8Array()),
  ]);
  return new Blob([png], { type: "image/png" });
}

function buildPalette(imageData, maxColors) {
  const colorsByKey = new Map();
  const pixels = imageData.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3];
    if (alpha < 4) continue;
    const key = (pixels[index] >> 4) << 12
      | (pixels[index + 1] >> 4) << 8
      | (pixels[index + 2] >> 4) << 4
      | (alpha >> 4);
    let color = colorsByKey.get(key);
    if (!color) {
      color = { red: 0, green: 0, blue: 0, alpha: 0, count: 0 };
      colorsByKey.set(key, color);
    }
    color.red += pixels[index];
    color.green += pixels[index + 1];
    color.blue += pixels[index + 2];
    color.alpha += alpha;
    color.count += 1;
  }
  const colors = [...colorsByKey.values()].map((color) => ({
    red: color.red / color.count,
    green: color.green / color.count,
    blue: color.blue / color.count,
    alpha: color.alpha / color.count,
    count: color.count,
  }));
  const limit = Math.max(1, Math.min(255, maxColors - 1));
  let buckets = colors.length ? [colors] : [];
  while (buckets.length < limit) {
    let selectedIndex = -1;
    let selectedDimension = "red";
    let selectedScore = -1;
    buckets.forEach((bucket, bucketIndex) => {
      if (bucket.length < 2) return;
      const totals = bucket.reduce((result, color) => {
        result.count += color.count;
        for (const key of ["red", "green", "blue", "alpha"]) {
          result.min[key] = Math.min(result.min[key], color[key]);
          result.max[key] = Math.max(result.max[key], color[key]);
        }
        return result;
      }, {
        count: 0,
        min: { red: 255, green: 255, blue: 255, alpha: 255 },
        max: { red: 0, green: 0, blue: 0, alpha: 0 },
      });
      const ranges = {
        red: totals.max.red - totals.min.red,
        green: totals.max.green - totals.min.green,
        blue: totals.max.blue - totals.min.blue,
        alpha: (totals.max.alpha - totals.min.alpha) * 0.78,
      };
      const dimension = Object.keys(ranges).reduce((best, key) => ranges[key] > ranges[best] ? key : best, "red");
      const score = ranges[dimension] * Math.log2(totals.count + 1);
      if (score > selectedScore) {
        selectedIndex = bucketIndex;
        selectedDimension = dimension;
        selectedScore = score;
      }
    });
    if (selectedIndex < 0) break;
    const bucket = buckets[selectedIndex].sort((a, b) => a[selectedDimension] - b[selectedDimension]);
    const total = bucket.reduce((sum, color) => sum + color.count, 0);
    let running = 0;
    let splitIndex = 1;
    for (; splitIndex < bucket.length; splitIndex += 1) {
      running += bucket[splitIndex - 1].count;
      if (running >= total / 2) break;
    }
    buckets.splice(selectedIndex, 1, bucket.slice(0, splitIndex), bucket.slice(splitIndex));
  }
  const palette = [{ red: 0, green: 0, blue: 0, alpha: 0 }];
  buckets.forEach((bucket) => {
    const aggregate = bucket.reduce((result, color) => {
      result.count += color.count;
      result.red += color.red * color.count;
      result.green += color.green * color.count;
      result.blue += color.blue * color.count;
      result.alpha += color.alpha * color.count;
      return result;
    }, { red: 0, green: 0, blue: 0, alpha: 0, count: 0 });
    palette.push({
      red: Math.round(aggregate.red / aggregate.count),
      green: Math.round(aggregate.green / aggregate.count),
      blue: Math.round(aggregate.blue / aggregate.count),
      alpha: Math.round(aggregate.alpha / aggregate.count),
    });
  });
  return palette;
}

async function encodeIndexedPNG(source, maxColors = 256) {
  if (typeof CompressionStream === "undefined") return null;
  const context = source.getContext("2d", { alpha: true, willReadFrequently: true });
  const image = context.getImageData(0, 0, source.width, source.height);
  const palette = buildPalette(image, maxColors);
  const paletteBytes = new Uint8Array(palette.length * 3);
  const alphaBytes = new Uint8Array(palette.length);
  palette.forEach((color, index) => {
    paletteBytes[index * 3] = color.red;
    paletteBytes[index * 3 + 1] = color.green;
    paletteBytes[index * 3 + 2] = color.blue;
    alphaBytes[index] = color.alpha;
  });
  const rows = new Uint8Array((source.width + 1) * source.height);
  const cache = new Map();
  for (let y = 0; y < source.height; y += 1) {
    const rowOffset = y * (source.width + 1);
    rows[rowOffset] = 0;
    for (let x = 0; x < source.width; x += 1) {
      const pixelOffset = (y * source.width + x) * 4;
      const red = image.data[pixelOffset];
      const green = image.data[pixelOffset + 1];
      const blue = image.data[pixelOffset + 2];
      const alpha = image.data[pixelOffset + 3];
      if (alpha < 4) {
        rows[rowOffset + x + 1] = 0;
        continue;
      }
      const key = (red >> 4) << 12 | (green >> 4) << 8 | (blue >> 4) << 4 | (alpha >> 4);
      let paletteIndex = cache.get(key);
      if (paletteIndex === undefined) {
        let closestDistance = Infinity;
        paletteIndex = 1;
        const opacity = alpha / 255;
        for (let index = 1; index < palette.length; index += 1) {
          const color = palette[index];
          const paletteOpacity = color.alpha / 255;
          const distance = (red * opacity - color.red * paletteOpacity) ** 2
            + (green * opacity - color.green * paletteOpacity) ** 2
            + (blue * opacity - color.blue * paletteOpacity) ** 2
            + ((alpha - color.alpha) * 0.72) ** 2;
          if (distance < closestDistance) {
            closestDistance = distance;
            paletteIndex = index;
          }
        }
        cache.set(key, paletteIndex);
      }
      rows[rowOffset + x + 1] = paletteIndex;
    }
  }
  const compressedBuffer = await new Response(
    new Blob([rows]).stream().pipeThrough(new CompressionStream("deflate")),
  ).arrayBuffer();
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, source.width);
  headerView.setUint32(4, source.height);
  header[8] = 8;
  header[9] = 3;
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const png = joinBytes([
    signature,
    pngChunk("IHDR", header),
    pngChunk("PLTE", paletteBytes),
    pngChunk("tRNS", alphaBytes),
    pngChunk("IDAT", new Uint8Array(compressedBuffer)),
    pngChunk("IEND", new Uint8Array()),
  ]);
  return new Blob([png], { type: "image/png" });
}

async function generateSprite() {
  if (!state.file || state.isProcessing || state.isCompressing) return;
  if (state.transparentPNG) state.format = "image/png";
  const frameCount = selectedFrameCount();
  const width = state.frameWidth;
  const height = frameHeight();
  const maxCanvasWidth = 32000;
  if (frameCount * width > maxCanvasWidth) {
    toast(`${frameCount} 帧 × ${width}px 超出浏览器单图宽度，请减少帧数或单帧尺寸`);
    return;
  }
  state.rawOutputBlob = null;
  state.outputBlob = null;
  state.outputCompressed = false;
  state.compressionAttempted = false;
  state.compressionSavings = 0;
  state.isProcessing = true;
  els.generateBtn.disabled = true;
  els.precisionCompressBtn.disabled = true;
  els.downloadBtn.hidden = true;
  els.processingOverlay.hidden = false;
  els.processingPercent.textContent = "0%";
  els.processingBar.style.width = "0%";
  els.processingText.textContent = "正在读取画面";
  els.materialState.textContent = "处理中";

  const canvas = els.spriteCanvas;
  canvas.width = width * frameCount;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  if (state.format === "image/jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  try {
    const bridge = editorBridge();
    if (bridge?.getSummary?.().matting) els.processingText.textContent = "正在准备 AI 毛发抠像模型";
    const clipStart = clamp(state.trimStart, 0, state.duration);
    const safeVideoEnd = bridge
      ? state.duration
      : Math.max(0, state.duration - Math.min(0.05, state.duration / 100));
    const clipEnd = clamp(state.trimEnd ?? state.duration, clipStart, safeVideoEnd);
    const usableDuration = Math.max(0, clipEnd - clipStart);
    for (let index = 0; index < frameCount; index += 1) {
      const time = frameCount === 1 ? clipStart : clipStart + (usableDuration * index) / (frameCount - 1);
      if (bridge) {
        const frame = await bridge.renderAtOutputTime(time, width, height);
        context.drawImage(frame, index * width, 0, width, height);
        if (typeof frame.close === "function") frame.close();
      } else {
        await seekVideo(time);
        context.drawImage(els.sourceVideo, index * width, 0, width, height);
      }
      const progress = Math.round(((index + 1) / frameCount) * 84);
      els.processingPercent.textContent = `${progress}%`;
      els.processingBar.style.width = `${progress}%`;
      els.processingText.textContent = `正在抽取第 ${index + 1} / ${frameCount} 帧`;
      await new Promise(requestAnimationFrame);
    }

    els.processingPercent.textContent = "92%";
    els.processingBar.style.width = "92%";
    els.processingText.textContent = state.format === "image/png"
      ? "正在封装原始透明 PNG"
      : "正在封装最高画质原图";
    const originalBlob = await canvasToBlob(canvas, state.format, state.format === "image/png" ? undefined : 1);

    state.rawOutputBlob = originalBlob;
    state.outputBlob = originalBlob;
    state.outputWidth = canvas.width;
    state.outputHeight = canvas.height;
    state.outputCompressed = false;
    state.compressionAttempted = false;
    state.compressionSavings = 0;
    els.processingPercent.textContent = "100%";
    els.processingBar.style.width = "100%";
    els.processingText.textContent = "交付文件已准备好";
    await new Promise((resolve) => setTimeout(resolve, 320));

    els.emptyPreview.hidden = true;
    canvas.hidden = false;
    els.previewScale.textContent = canvas.width > els.previewViewport.clientWidth ? "FIT HEIGHT · 可横向滚动" : "1 : 1";
    els.canvasDimensions.textContent = `${canvas.width} × ${canvas.height}`;
    els.summaryFrames.textContent = `${frameCount} FRAMES`;
    els.outputSpec.textContent = `${canvas.width} × ${canvas.height} / ${typeExtensions[state.format].toUpperCase()}`;
    syncOutputFileUI();
    els.downloadBtn.hidden = false;
    els.generateLabel.textContent = "重新生成原图";
    els.materialState.textContent = "可交付";
    window.dispatchEvent(new CustomEvent("spriteeee:sprite-ready", {
      detail: { label: `${canvas.width} × ${canvas.height} · ${typeExtensions[state.format].toUpperCase()}` },
    }));
    toast(`原始精灵图已生成 · ${formatBytes(originalBlob.size)}`);
  } catch (error) {
    console.error(error);
    els.materialState.textContent = "生成失败";
    window.dispatchEvent(new CustomEvent("spriteeee:sprite-dirty"));
    toast(error.message || "生成失败，请更换视频后重试");
  } finally {
    state.isProcessing = false;
    els.generateBtn.disabled = false;
    els.processingOverlay.hidden = true;
    updateUI();
  }
}

async function preciseCompressOutput() {
  if (!state.rawOutputBlob || state.isProcessing || state.isCompressing) return;
  state.isCompressing = true;
  updateUI();

  try {
    const source = els.spriteCanvas;
    const candidate = state.format === "image/png"
      ? await encodeLosslessPNG(source, state.compressionLevel)
      : await canvasToBlob(source, state.format, outputQuality());
    const original = state.rawOutputBlob;
    const useCandidate = Boolean(candidate && candidate.size < original.size);
    state.outputBlob = useCandidate ? candidate : original;
    state.outputCompressed = useCandidate;
    state.compressionAttempted = true;
    state.compressionSavings = useCandidate ? original.size - candidate.size : 0;
    syncOutputFileUI({ pulse: true });
    els.materialState.textContent = "可交付";
    toast(useCandidate
      ? `精准压缩完成 · ${formatDownloadBytes(original.size)} → ${formatDownloadBytes(state.outputBlob.size)}`
      : "当前文件已经是最佳大小，画面与尺寸保持不变");
  } catch (error) {
    console.error(error);
    state.outputBlob = state.rawOutputBlob;
    state.outputCompressed = false;
    state.compressionAttempted = false;
    state.compressionSavings = 0;
    toast("精准压缩失败，已保留原始文件");
  } finally {
    state.isCompressing = false;
    updateUI();
  }
}

function downloadSprite() {
  if (!state.outputBlob) return;
  syncOutputFileUI();
  const extension = typeExtensions[state.format];
  const base = state.file.name.replace(/\.[^.]+$/, "");
  const url = URL.createObjectURL(state.outputBlob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${base}_framestrip_${selectedFrameCount()}f${state.outputCompressed ? "_compressed" : ""}.${extension}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("下载已开始");
}

function resetSettings() {
  const keepEditorSync = state.editorSynced;
  Object.assign(state, defaults);
  state.editorSynced = keepEditorSync;
  state.trimStart = 0;
  state.trimEnd = state.duration || null;
  if (state.file) state.frameHeight = Math.round(state.frameWidth * state.videoHeight / state.videoWidth);
  window.SPRITEEE_EDITOR?.resetSpriteMatting?.();
  updateUI({ dirty: true });
  toast("参数已重置");
}

els.browseBtn.addEventListener("click", (event) => { event.stopPropagation(); openFilePicker(); });
els.replaceBtn.addEventListener("click", openFilePicker);
els.dropzone.addEventListener("click", openFilePicker);
els.dropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openFilePicker(); }
});
els.fileInput.addEventListener("change", (event) => loadVideoFile(event.target.files[0]));

["dragenter", "dragover"].forEach((name) => els.dropzone.addEventListener(name, (event) => {
  event.preventDefault();
  els.dropzone.classList.add("dragging");
}));
["dragleave", "drop"].forEach((name) => els.dropzone.addEventListener(name, (event) => {
  event.preventDefault();
  els.dropzone.classList.remove("dragging");
}));
els.dropzone.addEventListener("drop", (event) => loadVideoFile(event.dataTransfer.files[0]));

$$('.segment').forEach((button) => button.addEventListener("click", () => {
  state.mode = button.dataset.mode;
  updateUI({ dirty: true });
}));

function bindMirroredRange(rangeEl, numberEl, key, min, max) {
  const set = (raw) => {
    state[key] = clamp(Number(raw) || min, min, max);
    updateUI({ dirty: true });
  };
  rangeEl.addEventListener("input", (event) => set(event.target.value));
  numberEl.addEventListener("change", (event) => set(event.target.value));
}

bindMirroredRange(els.frameCount, els.frameCountNumber, "frameCount", 2, 48);
bindMirroredRange(els.fps, els.fpsNumber, "fps", 0.5, 24);

$$('.size-grid button').forEach((button) => button.addEventListener("click", () => {
  state.frameWidth = Number(button.dataset.width);
  if (state.aspectLocked) state.frameHeight = frameHeight();
  updateUI({ dirty: true });
}));

function setTrimValue(edge, rawValue) {
  if (!state.file) return;
  const minimumGap = Math.min(0.1, state.duration);
  if (edge === "start") {
    state.trimStart = clamp(Number(rawValue) || 0, 0, (state.trimEnd ?? state.duration) - minimumGap);
    if (!state.isProcessing && !state.editorSynced) els.sourceVideo.currentTime = state.trimStart;
  } else {
    state.trimEnd = clamp(Number(rawValue) || minimumGap, state.trimStart + minimumGap, state.duration);
    if (!state.isProcessing && !state.editorSynced) els.sourceVideo.currentTime = Math.min(state.trimEnd, state.duration - 0.001);
  }
  updateUI({ dirty: true });
}

els.trimStartRange.addEventListener("input", (event) => setTrimValue("start", event.target.value));
els.trimEndRange.addEventListener("input", (event) => setTrimValue("end", event.target.value));
els.trimStartInput.addEventListener("change", (event) => setTrimValue("start", event.target.value));
els.trimEndInput.addEventListener("change", (event) => setTrimValue("end", event.target.value));

els.frameWidthInput.addEventListener("change", (event) => {
  state.frameWidth = clamp(Math.round(Number(event.target.value) || 750), 16, 4096);
  if (state.aspectLocked) state.frameHeight = frameHeight();
  updateUI({ dirty: true });
});

els.frameHeightInput.addEventListener("change", (event) => {
  const nextHeight = clamp(Math.round(Number(event.target.value) || frameHeight()), 16, 4096);
  if (state.aspectLocked) {
    state.frameWidth = clamp(Math.round(nextHeight * state.videoWidth / state.videoHeight), 16, 4096);
  }
  state.frameHeight = nextHeight;
  updateUI({ dirty: true });
});

els.aspectLock.addEventListener("click", () => {
  const currentHeight = frameHeight();
  state.aspectLocked = !state.aspectLocked;
  state.frameHeight = state.aspectLocked
    ? Math.round(state.frameWidth * state.videoHeight / state.videoWidth)
    : currentHeight;
  updateUI({ dirty: true });
});

els.formatSelect.addEventListener("change", (event) => {
  if (state.transparentPNG) {
    state.format = "image/png";
    updateUI();
    return;
  }
  state.format = event.target.value;
  updateUI({ dirty: true });
});
els.compressionLevel.addEventListener("input", (event) => {
  state.compressionLevel = clamp(Number(event.target.value) || 10, 10, 100);
  if (state.rawOutputBlob) {
    state.outputBlob = state.rawOutputBlob;
    state.outputCompressed = false;
    state.compressionAttempted = false;
    state.compressionSavings = 0;
    syncOutputFileUI({ pulse: true });
  }
  updateUI();
});
els.generateBtn.addEventListener("click", generateSprite);
els.precisionCompressBtn.addEventListener("click", preciseCompressOutput);
els.downloadBtn.addEventListener("click", downloadSprite);
els.resetBtn.addEventListener("click", resetSettings);

els.backToEditorBtn.addEventListener("click", () => {
  window.SPRITEEE_EDITOR?.setPreviewMode?.("video");
});

window.addEventListener("spriteeee:editor-change", () => {
  syncFromEditor().catch((error) => {
    console.error(error);
    toast("编辑结果同步失败，请重试");
  });
});

window.addEventListener("spriteeee:matting-mode", (event) => {
  state.transparentPNG = Boolean(event.detail?.enabled);
  if (state.transparentPNG) {
    state.format = "image/png";
  }
  updateUI({ dirty: Boolean(state.file) });
  if (state.transparentPNG) toast("已切换为透明 PNG 精灵图");
});

updateUI();
