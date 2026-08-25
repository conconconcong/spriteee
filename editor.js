(function () {
  "use strict";

  const q = (selector) => document.querySelector(selector);
  const qa = (selector) => [...document.querySelectorAll(selector)];
  const notify = (message) => {
    if (typeof window.toast === "function") {
      window.toast(message);
      return;
    }
    const element = q("#toast");
    element.textContent = message;
    element.classList.add("show");
    setTimeout(() => element.classList.remove("show"), 2500);
  };

  const el = {
    spriteTool: q("#spriteTool"),
    videoEditor: q("#videoEditor"),
    fileInput: q("#editorFileInput"),
    uploadBtn: q("#editorUploadBtn"),
    replaceBtn: q("#editorReplaceBtn"),
    fileMeta: q("#editorFileMeta"),
    video: q("#editorVideo"),
    secondaryInput: q("#secondaryFileInput"),
    secondaryUploadBtn: q("#secondaryUploadBtn"),
    secondaryVideo: q("#secondaryVideo"),
    secondaryImage: q("#secondaryImage"),
    secondaryStatus: q("#secondaryStatus"),
    stage: q("#previewViewport"),
    canvas: q("#editorCanvas"),
    spriteCanvas: q("#spriteCanvas"),
    previewVideoBtn: q("#previewVideoBtn"),
    previewSpriteBtn: q("#previewSpriteBtn"),
    previewScale: q("#previewScale"),
    cropGuide: q("#cropGuide"),
    empty: q("#editorEmpty"),
    aiBadge: q("#aiPreviewBadge"),
    playBtn: q("#editorPlayBtn"),
    currentTime: q("#editorCurrentTime"),
    totalTime: q("#editorTotalTime"),
    scrubber: q("#editorScrubber"),
    fitBtn: q("#editorFitBtn"),
    trimStart: q("#editorTrimStart"),
    trimEnd: q("#editorTrimEnd"),
    trimStartLabel: q("#editorTrimStartLabel"),
    trimEndLabel: q("#editorTrimEndLabel"),
    trimSelection: q("#editorTrimSelection"),
    clipInfo: q("#editorClipInfo"),
    cropRatioLabel: q("#cropRatioLabel"),
    cropModeHint: q("#cropModeHint"),
    cropZoom: q("#cropZoom"),
    cropZoomValue: q("#cropZoomValue"),
    cropX: q("#cropX"),
    cropXValue: q("#cropXValue"),
    cropY: q("#cropY"),
    cropYValue: q("#cropYValue"),
    speedStatus: q("#speedStatus"),
    reverseToggle: q("#reverseToggle"),
    mattingToggle: q("#mattingToggle"),
    mattingControls: q("#mattingControls"),
    modelStatus: q("#modelStatus"),
    hairDetail: q("#hairDetail"),
    hairDetailValue: q("#hairDetailValue"),
    edgeFeather: q("#edgeFeather"),
    edgeFeatherValue: q("#edgeFeatherValue"),
    despill: q("#despill"),
    despillValue: q("#despillValue"),
    spillColorIndicator: q("#spillColorIndicator"),
    spillColorLabel: q("#spillColorLabel"),
    spillAutoBtn: q("#spillAutoBtn"),
    spillPickBtn: q("#spillPickBtn"),
    spillAddBtn: q("#spillAddBtn"),
    precisionLoupe: q("#precisionLoupe"),
    precisionLoupeCanvas: q("#precisionLoupeCanvas"),
    precisionLoupeLabel: q("#precisionLoupeLabel"),
    maskAddBtn: q("#maskAddBtn"),
    maskSubtractBtn: q("#maskSubtractBtn"),
    maskClearBtn: q("#maskClearBtn"),
    maskRefineStatus: q("#maskRefineStatus"),
    maskBrushSize: q("#maskBrushSize"),
    maskBrushSizeValue: q("#maskBrushSizeValue"),
    resolution: q("#editorResolution"),
    fps: q("#editorFps"),
    exportBtn: q("#editorExportBtn"),
    exportProgress: q("#editorExportProgress"),
    resetBtn: q("#editorResetBtn"),
    syncBtn: q("#syncSpriteBtn"),
    syncStatus: q("#editorSyncStatus"),
  };

  const defaults = {
    trimStart: 0,
    trimEnd: 0,
    ratio: "free",
    cropZoom: 1,
    cropX: 0.5,
    cropY: 0.5,
    freeCropLeft: 0,
    freeCropTop: 0,
    freeCropWidth: 1,
    freeCropHeight: 1,
    layout: "single",
    speed: 1,
    reverse: false,
    matting: false,
    hairDetail: 0.78,
    feather: 0.32,
    despill: 0.68,
    background: "transparent",
    backgroundColor: "#f5f5f7",
  };

  const state = {
    ...defaults,
    file: null,
    fileUrl: null,
    secondaryFile: null,
    secondaryUrl: null,
    secondaryType: null,
    duration: 0,
    playing: false,
    exporting: false,
    bridgeRendering: false,
    previewMode: "video",
    spriteReady: false,
    spriteLabel: "SPRITE PREVIEW",
    lastLoopTime: 0,
    maskBusy: false,
    lastMaskAt: 0,
    lastMaskVideoTime: -1,
    combinedMask: null,
    spillColor: null,
    spillMisses: 0,
    spillColorLocked: false,
    pickingSpillColor: false,
    spillPickMode: null,
    manualSpillColors: [],
    maskBrushMode: null,
    maskBrushSize: 0.04,
    manualMaskStrokes: [],
    personSegmenter: null,
    hairSegmenter: null,
    segmentersReady: false,
    aiTimestamp: 0,
  };

  const context = el.canvas.getContext("2d", { alpha: true, willReadFrequently: true });
  const sourceCanvas = document.createElement("canvas");
  const subjectCanvas = document.createElement("canvas");
  const layerCanvas = document.createElement("canvas");
  const maskCanvas = document.createElement("canvas");
  const maskFrameCanvas = document.createElement("canvas");
  const spillSampleCanvas = document.createElement("canvas");
  const spillMaskCanvas = document.createElement("canvas");
  const spillPixelCanvas = document.createElement("canvas");

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function isVideoFile(file) {
    return Boolean(file && (
      file.type?.startsWith("video/")
      || /\.(mp4|mov|m4v|webm|ogv)$/i.test(file.name || "")
    ));
  }

  function isImageFile(file) {
    return Boolean(file && (
      file.type?.startsWith("image/")
      || /\.(png|jpe?g|webp|gif|avif)$/i.test(file.name || "")
    ));
  }

  function formatTime(value) {
    const seconds = Math.max(0, Number(value) || 0);
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1).padStart(4, "0");
    return `${String(mins).padStart(2, "0")}:${secs}`;
  }

  function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function setRangeProgress(input) {
    const min = Number(input.min);
    const max = Number(input.max);
    const value = Number(input.value);
    input.style.setProperty("--progress", `${((value - min) / (max - min)) * 100}%`);
  }

  function ratioValue() {
    if (!state.file || !el.video.videoWidth) return 16 / 9;
    if (state.ratio === "source") return el.video.videoWidth / el.video.videoHeight;
    if (state.ratio === "free") {
      return (el.video.videoWidth * state.freeCropWidth) / (el.video.videoHeight * state.freeCropHeight);
    }
    const [width, height] = state.ratio.split(":").map(Number);
    return width / height;
  }

  function setFreeCrop(rect) {
    const sourceWidth = el.video.videoWidth || 960;
    const sourceHeight = el.video.videoHeight || 540;
    const minWidth = Math.max(0.012, 16 / sourceWidth);
    const minHeight = Math.max(0.012, 16 / sourceHeight);
    const width = clamp(rect.width, minWidth, 1);
    const height = clamp(rect.height, minHeight, 1);
    const left = clamp(rect.left, 0, 1 - width);
    const top = clamp(rect.top, 0, 1 - height);
    state.freeCropLeft = left;
    state.freeCropTop = top;
    state.freeCropWidth = width;
    state.freeCropHeight = height;
    state.cropX = 1 - width > 0.0001 ? left / (1 - width) : 0.5;
    state.cropY = 1 - height > 0.0001 ? top / (1 - height) : 0.5;
  }

  function previewAspectValue() {
    if (!state.file || !el.video.videoWidth) return 16 / 9;
    return el.video.videoWidth / el.video.videoHeight;
  }

  function outputDuration() {
    return Math.max(0.1, (state.trimEnd - state.trimStart) / state.speed);
  }

  function sourceTimeForOutput(outputTime) {
    const sourceOffset = Math.min(
      state.trimEnd - state.trimStart,
      clamp(outputTime, 0, outputDuration()) * state.speed,
    );
    return state.reverse
      ? state.trimEnd - sourceOffset
      : state.trimStart + sourceOffset;
  }

  function positiveModulo(value, divisor) {
    if (!divisor) return 0;
    return ((value % divisor) + divisor) % divisor;
  }

  function secondaryTimeForOutput(outputTime) {
    if (state.secondaryType !== "video" || !el.secondaryVideo.duration) return null;
    const sourceOffset = clamp(outputTime, 0, outputDuration()) * state.speed;
    const clipLength = state.trimEnd - state.trimStart;
    const offset = state.reverse ? clipLength - sourceOffset : sourceOffset;
    return positiveModulo(offset, el.secondaryVideo.duration);
  }

  function editorSummary() {
    return {
      ratio: state.ratio === "source" ? "原始比例" : state.ratio === "free" ? "自由比例" : state.ratio,
      speed: `${state.speed}×`,
      direction: state.reverse ? "倒放" : "正放",
      matting: state.matting,
      layout: state.layout,
    };
  }

  function signalEditorChange() {
    if (!state.file) return;
    window.dispatchEvent(new CustomEvent("spriteeee:editor-change", {
      detail: { file: state.file, summary: editorSummary() },
    }));
  }

  function setPreviewMode(mode) {
    state.previewMode = mode === "sprite" && state.spriteReady ? "sprite" : "video";
    if (state.previewMode === "video") renderEditorFrame();
    updateUI();
  }

  function resetSpriteMatting() {
    Object.assign(state, {
      matting: defaults.matting,
      hairDetail: defaults.hairDetail,
      feather: defaults.feather,
      despill: defaults.despill,
      background: defaults.background,
      backgroundColor: defaults.backgroundColor,
      combinedMask: null,
      spillColor: null,
      spillColorLocked: false,
      pickingSpillColor: false,
      spillPickMode: null,
      manualSpillColors: [],
      maskBrushMode: null,
      maskBrushSize: 0.04,
      manualMaskStrokes: [],
      lastMaskVideoTime: -1,
    });
    window.dispatchEvent(new CustomEvent("spriteeee:matting-mode", {
      detail: { enabled: false },
    }));
    updateUI();
    signalEditorChange();
  }

  function updatePreviewFrameLayout() {
    const aspect = previewAspectValue();
    const parent = el.stage.parentElement;
    const parentStyle = parent ? window.getComputedStyle(parent) : null;
    const parentWidth = parent
      ? parent.clientWidth
        - (Number.parseFloat(parentStyle?.paddingLeft) || 0)
        - (Number.parseFloat(parentStyle?.paddingRight) || 0)
      : 960;
    const maxHeight = clamp(window.innerHeight * 0.44, 260, 520);
    const frameWidth = Math.min(parentWidth, maxHeight * aspect);
    el.stage.style.width = `${Math.max(1, Math.round(frameWidth))}px`;
    el.stage.style.setProperty("--preview-aspect", String(aspect));
    el.stage.classList.toggle("portrait-preview", aspect < 0.9);
    el.stage.classList.toggle("square-preview", aspect >= 0.9 && aspect <= 1.1);
  }

  function updatePreviewCanvasSize() {
    const aspect = previewAspectValue();
    const sourceLongEdge = Math.max(el.video.videoWidth || 1280, el.video.videoHeight || 720);
    const longEdge = clamp(sourceLongEdge, 720, 1280);
    if (aspect >= 1) {
      el.canvas.width = Math.round(longEdge);
      el.canvas.height = Math.max(1, Math.round(longEdge / aspect));
    } else {
      el.canvas.height = Math.round(longEdge);
      el.canvas.width = Math.max(1, Math.round(longEdge * aspect));
    }
    layerCanvas.width = el.canvas.width;
    layerCanvas.height = el.canvas.height;
    updatePreviewFrameLayout();
  }

  function sourceCropRect(media, targetAspect) {
    const sourceWidth = media.videoWidth || media.naturalWidth || media.width || el.video.videoWidth || 16;
    const sourceHeight = media.videoHeight || media.naturalHeight || media.height || el.video.videoHeight || 9;
    if (state.ratio === "free") {
      return {
        sx: state.freeCropLeft * sourceWidth,
        sy: state.freeCropTop * sourceHeight,
        sw: state.freeCropWidth * sourceWidth,
        sh: state.freeCropHeight * sourceHeight,
      };
    }
    const sourceAspect = sourceWidth / sourceHeight;
    let cropWidth;
    let cropHeight;
    if (sourceAspect > targetAspect) {
      cropHeight = sourceHeight;
      cropWidth = cropHeight * targetAspect;
    } else {
      cropWidth = sourceWidth;
      cropHeight = cropWidth / targetAspect;
    }
    cropWidth /= state.cropZoom;
    cropHeight /= state.cropZoom;
    const maxX = sourceWidth - cropWidth;
    const maxY = sourceHeight - cropHeight;
    return {
      sx: maxX * state.cropX,
      sy: maxY * state.cropY,
      sw: cropWidth,
      sh: cropHeight,
    };
  }

  function cropSelectionRect() {
    if (state.ratio === "free") {
      return {
        left: state.freeCropLeft,
        top: state.freeCropTop,
        width: state.freeCropWidth,
        height: state.freeCropHeight,
      };
    }
    const sourceWidth = el.video.videoWidth || 16;
    const sourceHeight = el.video.videoHeight || 9;
    const crop = sourceCropRect(el.video, ratioValue());
    return {
      left: crop.sx / sourceWidth,
      top: crop.sy / sourceHeight,
      width: crop.sw / sourceWidth,
      height: crop.sh / sourceHeight,
    };
  }

  function drawMedia(ctx, media, rect, applyPrimaryCrop = false) {
    if (!media) return;
    const sourceWidth = media.videoWidth || media.naturalWidth || media.width;
    const sourceHeight = media.videoHeight || media.naturalHeight || media.height;
    if (!sourceWidth || !sourceHeight) return;
    const crop = applyPrimaryCrop
      ? sourceCropRect(media, rect.width / rect.height)
      : (() => {
          const targetAspect = rect.width / rect.height;
          const sourceAspect = sourceWidth / sourceHeight;
          let sw = sourceWidth;
          let sh = sourceHeight;
          if (sourceAspect > targetAspect) sw = sourceHeight * targetAspect;
          else sh = sourceWidth / targetAspect;
          return { sx: (sourceWidth - sw) / 2, sy: (sourceHeight - sh) / 2, sw, sh };
        })();
    ctx.drawImage(media, crop.sx, crop.sy, crop.sw, crop.sh, rect.x, rect.y, rect.width, rect.height);
  }

  function secondaryMedia() {
    if (state.secondaryType === "video" && el.secondaryVideo.readyState >= 2) return el.secondaryVideo;
    if (state.secondaryType === "image" && el.secondaryImage.complete) return el.secondaryImage;
    return el.video;
  }

  function drawBackground(ctx, rect) {
    if (state.background === "transparent") return;
    if (state.background === "color") {
      ctx.fillStyle = state.backgroundColor;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      return;
    }
    if (state.background === "blur") {
      ctx.save();
      ctx.filter = "blur(22px) saturate(.8)";
      ctx.translate(rect.width * 0.035, rect.height * 0.035);
      drawMedia(ctx, el.video, {
        x: rect.x - rect.width * 0.07,
        y: rect.y - rect.height * 0.07,
        width: rect.width * 1.14,
        height: rect.height * 1.14,
      }, true);
      ctx.restore();
    }
  }

  function prepareSubject() {
    const matchedSource = maskFrameCanvas.width && maskFrameCanvas.height ? maskFrameCanvas : el.video;
    const width = matchedSource.videoWidth || matchedSource.naturalWidth || matchedSource.width;
    const height = matchedSource.videoHeight || matchedSource.naturalHeight || matchedSource.height;
    if (!width || !height || !state.combinedMask) return null;
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    subjectCanvas.width = width;
    subjectCanvas.height = height;
    const sourceContext = sourceCanvas.getContext("2d");
    const subjectContext = subjectCanvas.getContext("2d", { willReadFrequently: true });
    sourceContext.clearRect(0, 0, width, height);
    sourceContext.drawImage(matchedSource, 0, 0, width, height);
    subjectContext.clearRect(0, 0, width, height);
    subjectContext.drawImage(sourceCanvas, 0, 0);
    subjectContext.globalCompositeOperation = "destination-in";
    subjectContext.filter = `blur(${state.feather * 2.2}px)`;
    subjectContext.drawImage(state.combinedMask, 0, 0, width, height);
    subjectContext.filter = "none";
    subjectContext.globalCompositeOperation = "source-over";
    return subjectCanvas;
  }

  function hueFromRGB(red, green, blue) {
    const r = red / 255;
    const g = green / 255;
    const b = blue / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (!delta) return 0;
    let hue;
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    return (hue * 60 + 360) % 360;
  }

  function spillColorName(hue) {
    if (hue < 18 || hue >= 345) return "红色";
    if (hue < 48) return "橙色";
    if (hue < 72) return "黄色";
    if (hue < 165) return "绿色";
    if (hue < 195) return "青色";
    if (hue < 255) return "蓝色";
    if (hue < 300) return "紫色";
    return "洋红色";
  }

  function estimateSpillColor(source) {
    if (!source || !state.combinedMask) return null;
    const width = 96;
    const height = 96;
    spillSampleCanvas.width = width;
    spillSampleCanvas.height = height;
    spillMaskCanvas.width = width;
    spillMaskCanvas.height = height;
    const sampleContext = spillSampleCanvas.getContext("2d", { willReadFrequently: true });
    const maskContext = spillMaskCanvas.getContext("2d", { willReadFrequently: true });
    sampleContext.clearRect(0, 0, width, height);
    maskContext.clearRect(0, 0, width, height);
    sampleContext.drawImage(source, 0, 0, width, height);
    maskContext.drawImage(state.combinedMask, 0, 0, width, height);
    const pixels = sampleContext.getImageData(0, 0, width, height).data;
    const masks = maskContext.getImageData(0, 0, width, height).data;
    const binCount = 24;
    const bins = Array.from({ length: binCount }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
    let totalWeight = 0;
    let backgroundSamples = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      const maskAlpha = masks[index + 3] / 255;
      if (maskAlpha > 0.16) continue;
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const saturation = max ? (max - min) / max : 0;
      if (saturation < 0.2 || max < 34) continue;
      const hue = hueFromRGB(red, green, blue);
      const binIndex = Math.floor(hue / (360 / binCount)) % binCount;
      const weight = saturation * saturation * (0.35 + max / 255) * (1 - maskAlpha);
      const bin = bins[binIndex];
      bin.weight += weight;
      bin.r += red * weight;
      bin.g += green * weight;
      bin.b += blue * weight;
      totalWeight += weight;
      backgroundSamples += 1;
    }

    if (backgroundSamples < 24 || totalWeight < 8) return null;
    let dominantIndex = 0;
    let dominantScore = -1;
    for (let index = 0; index < binCount; index += 1) {
      const previous = bins[(index - 1 + binCount) % binCount].weight;
      const next = bins[(index + 1) % binCount].weight;
      const score = bins[index].weight + previous * 0.58 + next * 0.58;
      if (score > dominantScore) {
        dominantScore = score;
        dominantIndex = index;
      }
    }

    let weight = 0;
    let red = 0;
    let green = 0;
    let blue = 0;
    for (const offset of [-1, 0, 1]) {
      const bin = bins[(dominantIndex + offset + binCount) % binCount];
      const multiplier = offset === 0 ? 1 : 0.58;
      weight += bin.weight * multiplier;
      red += bin.r * multiplier;
      green += bin.g * multiplier;
      blue += bin.b * multiplier;
    }
    if (!weight || dominantScore / totalWeight < 0.16) return null;
    const color = { red: red / weight, green: green / weight, blue: blue / weight };
    const hue = hueFromRGB(color.red, color.green, color.blue);
    return {
      ...color,
      hue,
      name: spillColorName(hue),
      confidence: clamp(dominantScore / totalWeight, 0, 1),
    };
  }

  function stabilizeSpillColor(next) {
    const previous = state.spillColor;
    if (!next) {
      state.spillMisses += 1;
      return state.spillMisses <= 4 ? previous : null;
    }
    state.spillMisses = 0;
    if (!previous) return next;
    const hueDistance = Math.min(Math.abs(previous.hue - next.hue), 360 - Math.abs(previous.hue - next.hue));
    if (hueDistance > 52) return next;
    const previousWeight = 0.72;
    const nextWeight = 1 - previousWeight;
    const red = previous.red * previousWeight + next.red * nextWeight;
    const green = previous.green * previousWeight + next.green * nextWeight;
    const blue = previous.blue * previousWeight + next.blue * nextWeight;
    const hue = hueFromRGB(red, green, blue);
    return {
      red,
      green,
      blue,
      hue,
      name: spillColorName(hue),
      confidence: previous.confidence * previousWeight + next.confidence * nextWeight,
    };
  }

  function applyDespill(canvas) {
    const spill = state.spillColor;
    if (state.despill <= 0 || !spill) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    const amount = state.despill;
    const selectedColors = state.spillColorLocked && state.manualSpillColors.length
      ? state.manualSpillColors
      : [spill];
    const spillCandidates = selectedColors.map((color) => {
      const luma = color.red * 0.2126 + color.green * 0.7152 + color.blue * 0.0722;
      const chroma = {
        red: color.red - luma,
        green: color.green - luma,
        blue: color.blue - luma,
      };
      return {
        color,
        luma,
        chroma,
        chromaLength: chroma.red ** 2 + chroma.green ** 2 + chroma.blue ** 2,
      };
    }).filter((candidate) => candidate.chromaLength >= 36);
    if (!spillCandidates.length) return;

    const width = canvas.width;
    const height = canvas.height;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        const alpha = data[index + 3];
        if (alpha < 5) continue;
        const opacity = alpha / 255;
        let boundary = 0;
        if (alpha > 110) {
          const left = data[(y * width + Math.max(0, x - 2)) * 4 + 3];
          const right = data[(y * width + Math.min(width - 1, x + 2)) * 4 + 3];
          const top = data[(Math.max(0, y - 2) * width + x) * 4 + 3];
          const bottom = data[(Math.min(height - 1, y + 2) * width + x) * 4 + 3];
          boundary = clamp((alpha - Math.min(left, right, top, bottom)) / 255, 0, 1);
        }
        const edgeWeight = Math.max(1 - opacity, boundary * 0.72);
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const pixelLuma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        const pixelChromaRed = red - pixelLuma;
        const pixelChromaGreen = green - pixelLuma;
        const pixelChromaBlue = blue - pixelLuma;
        const pixelChromaLength = pixelChromaRed ** 2 + pixelChromaGreen ** 2 + pixelChromaBlue ** 2;
        let bestMatch = null;
        for (const candidate of spillCandidates) {
          const chromaDot = pixelChromaRed * candidate.chroma.red
            + pixelChromaGreen * candidate.chroma.green
            + pixelChromaBlue * candidate.chroma.blue;
          const projection = chromaDot / candidate.chromaLength;
          if (projection <= 0.035) continue;
          const hueCosine = pixelChromaLength > 1
            ? chromaDot / Math.sqrt(candidate.chromaLength * pixelChromaLength)
            : 0;
          const hueMatchRaw = clamp((hueCosine - 0.56) / 0.4, 0, 1);
          const hueMatch = hueMatchRaw * hueMatchRaw * (3 - 2 * hueMatchRaw);
          const relativeChroma = Math.sqrt(pixelChromaLength / candidate.chromaLength);
          const chromaMatch = clamp((relativeChroma - 0.07) / 0.72, 0, 1);
          const projectionFloor = candidate.color.manual ? 0.07 : 0.13;
          const projectionRaw = clamp((projection - projectionFloor) / (0.92 - projectionFloor), 0, 1);
          const projectionMatch = projectionRaw * projectionRaw * (3 - 2 * projectionRaw);
          const keySimilarity = hueMatch * chromaMatch * projectionMatch;
          const similarity = Math.max(clamp(projection * 1.8, 0, 1), keySimilarity);
          const rgbDistance = Math.hypot(red - candidate.color.red, green - candidate.color.green, blue - candidate.color.blue);
          const rgbMatch = 1 - clamp(rgbDistance / 220, 0, 1);
          const lumaMatch = 1 - clamp(Math.abs(pixelLuma - candidate.luma) / 160, 0, 1);
          const score = keySimilarity * 1.4
            + similarity * (0.16 + edgeWeight * 0.28)
            + rgbMatch * 0.42
            + lumaMatch * 0.18;
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { candidate, projection, keySimilarity, similarity, score };
          }
        }
        if (!bestMatch) continue;
        const { candidate, projection, keySimilarity, similarity } = bestMatch;
        const matchedSpill = candidate.color;
        const backgroundChroma = candidate.chroma;
        if (edgeWeight < 0.015 && keySimilarity < 0.04) continue;
        const recoveryWeight = amount * Math.pow(1 - opacity, 0.68) * similarity;
        const safeOpacity = Math.max(0.16, opacity);
        const recoveredRed = clamp((red - (1 - opacity) * matchedSpill.red) / safeOpacity, 0, 255);
        const recoveredGreen = clamp((green - (1 - opacity) * matchedSpill.green) / safeOpacity, 0, 255);
        const recoveredBlue = clamp((blue - (1 - opacity) * matchedSpill.blue) / safeOpacity, 0, 255);
        let cleanRed = red + (recoveredRed - red) * recoveryWeight;
        let cleanGreen = green + (recoveredGreen - green) * recoveryWeight;
        let cleanBlue = blue + (recoveredBlue - blue) * recoveryWeight;
        const boundaryRemoval = amount * boundary * similarity * clamp(projection, 0, 1.2) * 0.82;
        const keyColorRemoval = amount * keySimilarity * clamp(projection, 0, 1.25) * (matchedSpill.manual ? 1.16 : 0.86);
        const colorRemoval = boundaryRemoval + keyColorRemoval;
        cleanRed -= backgroundChroma.red * colorRemoval;
        cleanGreen -= backgroundChroma.green * colorRemoval;
        cleanBlue -= backgroundChroma.blue * colorRemoval;
        data[index] = clamp(Math.round(cleanRed), 0, 255);
        data[index + 1] = clamp(Math.round(cleanGreen), 0, 255);
        data[index + 2] = clamp(Math.round(cleanBlue), 0, 255);
        const keyStrength = 1 - Math.pow(1 - amount, matchedSpill.manual ? 2.35 : 1.8);
        const interiorGate = matchedSpill.manual ? 1 : clamp(0.24 + edgeWeight * 1.8, 0.24, 1);
        const keyAlphaRemoval = keySimilarity * keyStrength * interiorGate;
        const fringeAlphaRemoval = opacity < 0.82
          ? amount * (1 - opacity) * similarity * 0.42
          : 0;
        const alphaRemoval = 1 - (1 - keyAlphaRemoval) * (1 - fringeAlphaRemoval);
        data[index + 3] = Math.round(alpha * (1 - clamp(alphaRemoval, 0, 0.985)));
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  function drawPrimary(ctx, rect, useMatting = false, applyPrimaryCrop = true) {
    if (!useMatting || !state.matting || !state.combinedMask) {
      drawMedia(ctx, el.video, rect, applyPrimaryCrop);
      return;
    }
    drawBackground(ctx, rect);
    const subject = prepareSubject();
    if (!subject) {
      drawMedia(ctx, el.video, rect, true);
      return;
    }
    const layerContext = layerCanvas.getContext("2d", { willReadFrequently: true });
    layerContext.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
    const crop = applyPrimaryCrop
      ? sourceCropRect(subject, rect.width / rect.height)
      : { sx: 0, sy: 0, sw: subject.width, sh: subject.height };
    layerContext.drawImage(subject, crop.sx, crop.sy, crop.sw, crop.sh, rect.x, rect.y, rect.width, rect.height);
    applyDespill(layerCanvas);
    ctx.drawImage(layerCanvas, 0, 0);
  }

  function renderEditorFrame({
    useMatting = state.matting,
    showCropSource = !state.bridgeRendering && !state.exporting,
  } = {}) {
    if (!state.file || el.video.readyState < 2) return;
    const width = el.canvas.width;
    const height = el.canvas.height;
    context.clearRect(0, 0, width, height);
    const full = { x: 0, y: 0, width, height };
    const secondary = secondaryMedia();
    const applyPrimaryCrop = !showCropSource;

    if (state.layout === "split") {
      drawPrimary(context, { x: 0, y: 0, width: width / 2, height }, useMatting, applyPrimaryCrop);
      drawMedia(context, secondary, { x: width / 2, y: 0, width: width / 2, height });
    } else if (state.layout === "stack") {
      drawPrimary(context, { x: 0, y: 0, width, height: height / 2 }, useMatting, applyPrimaryCrop);
      drawMedia(context, secondary, { x: 0, y: height / 2, width, height: height / 2 });
    } else {
      drawPrimary(context, full, useMatting, applyPrimaryCrop);
      if (state.layout === "pip") {
        const pipWidth = width * 0.3;
        const pipHeight = pipWidth * 9 / 16;
        const margin = width * 0.035;
        context.save();
        context.shadowColor = "rgba(0,0,0,.35)";
        context.shadowBlur = 18;
        context.fillStyle = "#000";
        context.fillRect(width - pipWidth - margin, height - pipHeight - margin, pipWidth, pipHeight);
        context.restore();
        drawMedia(context, secondary, { x: width - pipWidth - margin, y: height - pipHeight - margin, width: pipWidth, height: pipHeight });
      }
    }
  }

  function updateUI() {
    const hasVideo = Boolean(state.file);
    const clipLength = Math.max(0, state.trimEnd - state.trimStart);
    el.empty.hidden = hasVideo;
    el.replaceBtn.hidden = !hasVideo;
    el.playBtn.disabled = !hasVideo;
    el.scrubber.disabled = !hasVideo;
    el.fitBtn.disabled = !hasVideo;
    el.exportBtn.disabled = !hasVideo || state.exporting || state.bridgeRendering;
    el.syncBtn.disabled = !hasVideo || state.exporting || state.bridgeRendering;
    el.syncStatus.textContent = hasVideo
      ? `${outputDuration().toFixed(1)} 秒 · ${state.ratio === "source" ? "原始比例" : state.ratio === "free" ? "自由比例" : state.ratio} · 自动同步`
      : "添加视频后自动同步";
    el.trimStart.disabled = !hasVideo;
    el.trimEnd.disabled = !hasVideo;
    el.reverseToggle.checked = state.reverse;
    el.mattingToggle.checked = state.matting;
    el.mattingControls.classList.toggle("off", !state.matting);
    el.aiBadge.hidden = !state.matting;
    const showSprite = state.previewMode === "sprite" && state.spriteReady;
    el.canvas.hidden = showSprite;
    el.spriteCanvas.hidden = !showSprite;
    el.stage.classList.toggle("sprite-mode", showSprite);
    el.stage.classList.toggle("matting-preview", state.matting && !showSprite);
    el.stage.classList.toggle("color-picking", state.pickingSpillColor && !showSprite);
    el.stage.classList.toggle("mask-brushing", Boolean(state.maskBrushMode) && !showSprite);
    el.stage.classList.toggle("precision-tool", (state.pickingSpillColor || Boolean(state.maskBrushMode)) && !showSprite);
    el.stage.dataset.pickHint = state.spillPickMode === "add" ? "点击补充背景颜色" : "点击主背景取色";
    if (showSprite || (!state.pickingSpillColor && !state.maskBrushMode)) hidePrecisionLoupe();
    el.cropGuide.hidden = !hasVideo || showSprite;
    if (hasVideo) {
      const selection = cropSelectionRect();
      el.cropGuide.style.left = `${selection.left * 100}%`;
      el.cropGuide.style.top = `${selection.top * 100}%`;
      el.cropGuide.style.width = `${selection.width * 100}%`;
      el.cropGuide.style.height = `${selection.height * 100}%`;
    }
    el.previewVideoBtn.classList.toggle("active", !showSprite);
    el.previewSpriteBtn.classList.toggle("active", showSprite);
    el.previewSpriteBtn.disabled = !state.spriteReady;
    el.previewScale.textContent = showSprite ? state.spriteLabel : "VIDEO PREVIEW";
    const aiBadgeLabel = el.aiBadge.querySelector("span");
    if (aiBadgeLabel) {
      aiBadgeLabel.textContent = state.segmentersReady && state.combinedMask
        ? "AI 抠像实时预览"
        : "正在准备 AI 抠像";
    }
    el.cropZoom.value = Math.round(state.cropZoom * 100);
    el.cropX.value = Math.round(state.cropX * 100);
    el.cropY.value = Math.round(state.cropY * 100);
    el.cropZoom.disabled = !hasVideo || state.ratio === "free";
    el.cropX.disabled = !hasVideo;
    el.cropY.disabled = !hasVideo;
    el.cropZoom.parentElement.classList.toggle("is-disabled", state.ratio === "free");
    el.cropZoomValue.textContent = state.ratio === "free" ? "拖拽" : `${Math.round(state.cropZoom * 100)}%`;
    el.cropXValue.textContent = Math.round(state.cropX * 100);
    el.cropYValue.textContent = Math.round(state.cropY * 100);
    el.hairDetail.value = Math.round(state.hairDetail * 100);
    el.edgeFeather.value = Math.round(state.feather * 100);
    el.despill.value = Math.round(state.despill * 100);
    el.hairDetailValue.textContent = Math.round(state.hairDetail * 100);
    el.edgeFeatherValue.textContent = Math.round(state.feather * 100);
    el.despillValue.textContent = Math.round(state.despill * 100);
    if (state.spillColor) {
      const { red, green, blue, name } = state.spillColor;
      const selectedColors = state.spillColorLocked && state.manualSpillColors.length
        ? state.manualSpillColors
        : [{ red, green, blue }];
      el.spillColorIndicator.style.background = selectedColors.length > 1
        ? `linear-gradient(135deg, ${selectedColors.map((color) => `rgb(${Math.round(color.red)}, ${Math.round(color.green)}, ${Math.round(color.blue)})`).join(", ")})`
        : `rgb(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)})`;
      el.spillColorIndicator.classList.add("detected");
      el.spillColorLabel.textContent = state.spillColorLocked
        ? state.manualSpillColors.length > 1
          ? `已加选 ${state.manualSpillColors.length} 个背景色键`
          : `已锁定${name}色键 · 可继续加选`
        : `已识别${name}背景 · 自适应净边`;
    } else {
      el.spillColorIndicator.style.background = "";
      el.spillColorIndicator.classList.remove("detected");
      el.spillColorLabel.textContent = state.matting ? "正在分析背景主色" : "自动检测背景主色";
    }
    el.spillAutoBtn.classList.toggle("active", !state.spillColorLocked && !state.pickingSpillColor);
    el.spillPickBtn.classList.toggle("active", state.spillPickMode === "replace" || (state.spillColorLocked && !state.pickingSpillColor));
    el.spillAddBtn.classList.toggle("active", state.spillPickMode === "add");
    el.spillPickBtn.textContent = state.spillPickMode === "replace"
      ? "点击主背景"
      : state.spillColorLocked ? "重取主色" : "主色取样";
    el.spillAddBtn.textContent = state.spillPickMode === "add" ? "点击补充色" : "＋ 加选";
    el.maskAddBtn.classList.toggle("active", state.maskBrushMode === "add");
    el.maskSubtractBtn.classList.toggle("active", state.maskBrushMode === "subtract");
    el.maskClearBtn.disabled = state.manualMaskStrokes.length === 0;
    el.maskBrushSize.value = Math.round(state.maskBrushSize * 100);
    el.maskBrushSizeValue.textContent = Math.round(state.maskBrushSize * 100);
    el.maskRefineStatus.textContent = state.manualMaskStrokes.length
      ? `${state.manualMaskStrokes.length} 个修补点 · 同步全部帧`
      : state.maskBrushMode ? "在左侧画面拖动涂抹" : "直接在左侧画面涂抹";
    el.speedStatus.textContent = `${state.reverse ? "倒放 · " : ""}${state.speed}×`;
    el.cropRatioLabel.textContent = state.ratio === "source" ? "原始比例" : state.ratio === "free" ? "自由框选" : state.ratio;
    el.cropModeHint.textContent = state.ratio === "free"
      ? "自由模式：四个角可分别拖动，宽高互不锁定"
      : "拖动白色选框调整位置，拖动四角等比缩放";
    el.clipInfo.textContent = hasVideo ? `${formatTime(state.trimStart)} — ${formatTime(state.trimEnd)} · ${clipLength.toFixed(1)} 秒` : "完整视频";
    el.trimStartLabel.textContent = formatTime(state.trimStart);
    el.trimEndLabel.textContent = formatTime(state.trimEnd);
    el.currentTime.textContent = formatTime(el.video.currentTime || 0);
    el.totalTime.textContent = formatTime(state.duration);
    el.scrubber.max = Math.max(0.1, state.duration || 10);
    el.scrubber.value = el.video.currentTime || 0;
    el.trimStart.max = Math.max(0.1, state.duration || 10);
    el.trimEnd.max = Math.max(0.1, state.duration || 10);
    el.trimStart.value = state.trimStart;
    el.trimEnd.value = state.trimEnd || state.duration || 10;
    const startPercent = state.duration ? state.trimStart / state.duration * 100 : 0;
    const endPercent = state.duration ? state.trimEnd / state.duration * 100 : 100;
    el.trimSelection.style.setProperty("--editor-trim-start", `${startPercent}%`);
    el.trimSelection.style.setProperty("--editor-trim-end", `${endPercent}%`);
    [el.cropZoom, el.cropX, el.cropY, el.hairDetail, el.edgeFeather, el.despill, el.maskBrushSize].forEach(setRangeProgress);

    qa(".crop-presets button").forEach((button) => button.classList.toggle("active", button.dataset.ratio === state.ratio));
    qa(".layout-grid button").forEach((button) => button.classList.toggle("active", button.dataset.layout === state.layout));
    qa(".speed-grid button").forEach((button) => button.classList.toggle("active", Number(button.dataset.speed) === state.speed));
    el.playBtn.classList.toggle("playing", state.playing);
  }

  async function loadPrimaryVideo(file, { fromSprite = false, silent = false } = {}) {
    if (!isVideoFile(file)) {
      notify("请选择有效的视频文件");
      return;
    }
    state.playing = false;
    el.video.pause();
    if (state.fileUrl) URL.revokeObjectURL(state.fileUrl);
    state.file = file;
    state.fileUrl = URL.createObjectURL(file);
    try {
      const metadataReady = new Promise((resolve, reject) => {
        const cleanup = () => {
          el.video.removeEventListener("loadedmetadata", onReady);
          el.video.removeEventListener("error", onError);
        };
        const onReady = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); reject(new Error("无法读取视频")); };
        el.video.addEventListener("loadedmetadata", onReady, { once: true });
        el.video.addEventListener("error", onError, { once: true });
      });
      el.video.src = state.fileUrl;
      await metadataReady;
      state.duration = el.video.duration;
      state.trimStart = 0;
      state.trimEnd = state.duration;
      state.ratio = defaults.ratio;
      state.cropZoom = defaults.cropZoom;
      state.cropX = defaults.cropX;
      state.cropY = defaults.cropY;
      state.freeCropLeft = defaults.freeCropLeft;
      state.freeCropTop = defaults.freeCropTop;
      state.freeCropWidth = defaults.freeCropWidth;
      state.freeCropHeight = defaults.freeCropHeight;
      state.combinedMask = null;
      state.spillColor = null;
      state.spillColorLocked = false;
      state.pickingSpillColor = false;
      state.spillPickMode = null;
      state.manualSpillColors = [];
      state.maskBrushMode = null;
      state.manualMaskStrokes = [];
      state.lastMaskVideoTime = -1;
      state.spriteReady = false;
      state.previewMode = "video";
      el.video.currentTime = 0;
      el.fileMeta.textContent = `${file.name} · ${el.video.videoWidth}×${el.video.videoHeight} · ${formatTime(state.duration)} · ${formatBytes(file.size)}`;
      updatePreviewCanvasSize();
      updateUI();
      renderEditorFrame();
      signalEditorChange();
      if (!silent) notify(fromSprite ? "精灵图素材已同步到编辑器" : "视频已载入，可以开始编辑");
    } catch (error) {
      if (state.fileUrl) URL.revokeObjectURL(state.fileUrl);
      state.file = null;
      state.fileUrl = null;
      el.video.removeAttribute("src");
      updateUI();
      notify(error.message);
    }
  }

  async function loadSecondary(file) {
    if (!file) return;
    if (!isVideoFile(file) && !isImageFile(file)) {
      notify("请选择视频或图片作为第二画面");
      return;
    }
    if (state.secondaryUrl) URL.revokeObjectURL(state.secondaryUrl);
    state.secondaryUrl = URL.createObjectURL(file);
    state.secondaryFile = file;
    if (isVideoFile(file)) {
      state.secondaryType = "video";
      const metadataReady = new Promise((resolve, reject) => {
        el.secondaryVideo.addEventListener("loadedmetadata", resolve, { once: true });
        el.secondaryVideo.addEventListener("error", () => reject(new Error("无法读取第二画面")), { once: true });
      });
      el.secondaryVideo.src = state.secondaryUrl;
      await metadataReady;
    } else if (isImageFile(file)) {
      state.secondaryType = "image";
      const imageReady = new Promise((resolve, reject) => {
        el.secondaryImage.addEventListener("load", resolve, { once: true });
        el.secondaryImage.addEventListener("error", () => reject(new Error("无法读取第二画面")), { once: true });
      });
      el.secondaryImage.src = state.secondaryUrl;
      await imageReady;
    }
    el.secondaryStatus.textContent = `第二画面：${file.name}`;
    if (state.layout === "single") state.layout = "pip";
    updateUI();
    renderEditorFrame();
    signalEditorChange();
  }

  function maskToCanvas(mask, isHair) {
    if (!mask) return null;
    const width = mask.width;
    const height = mask.height;
    const values = mask.data;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const image = ctx.createImageData(width, height);
    const detail = state.hairDetail;
    for (let index = 0; index < values.length; index += 1) {
      let confidence = values[index];
      if (isHair) confidence = Math.pow(confidence, 1.25 - detail * 0.55);
      const low = isHair ? 0.08 + (1 - detail) * 0.12 : 0.18;
      const high = isHair ? 0.76 : 0.82;
      const normalized = clamp((confidence - low) / (high - low), 0, 1);
      const smooth = normalized * normalized * (3 - 2 * normalized);
      const offset = index * 4;
      image.data[offset] = 255;
      image.data[offset + 1] = 255;
      image.data[offset + 2] = 255;
      image.data[offset + 3] = Math.round(smooth * 255);
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  function drawManualMaskStroke(ctx, width, height, stroke) {
    const radius = Math.max(1, stroke.radius * Math.min(width, height));
    ctx.save();
    ctx.globalCompositeOperation = stroke.mode === "subtract" ? "destination-out" : "source-over";
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(stroke.x * width, stroke.y * height, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function applyManualMaskStrokes(ctx, width, height) {
    state.manualMaskStrokes.forEach((stroke) => drawManualMaskStroke(ctx, width, height, stroke));
  }

  function segmentFrame(segmenter, timestamp, categoryIndex = 0) {
    return new Promise((resolve, reject) => {
      try {
        segmenter.segmentForVideo(el.video, timestamp, (result) => {
          const masks = result.confidenceMasks || [];
          const mask = masks[Math.min(categoryIndex, Math.max(0, masks.length - 1))];
          if (!mask) {
            if (typeof result.close === "function") result.close();
            resolve(null);
            return;
          }
          const data = new Float32Array(mask.getAsFloat32Array());
          const output = { data, width: mask.width, height: mask.height };
          if (typeof result.close === "function") result.close();
          resolve(output);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async function ensureSegmenters() {
    if (state.segmentersReady) return;
    el.modelStatus.textContent = "正在下载人像与毛发模型…";
    const visionModule = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/+esm");
    const vision = await visionModule.FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
    );
    const baseOptions = (modelAssetPath) => ({
      baseOptions: { modelAssetPath, delegate: "GPU" },
      runningMode: "VIDEO",
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });
    try {
      [state.personSegmenter, state.hairSegmenter] = await Promise.all([
        visionModule.ImageSegmenter.createFromOptions(vision, baseOptions(
          "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite",
        )),
        visionModule.ImageSegmenter.createFromOptions(vision, baseOptions(
          "https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite",
        )),
      ]);
    } catch (gpuError) {
      const cpuOptions = (modelAssetPath) => ({
        baseOptions: { modelAssetPath, delegate: "CPU" },
        runningMode: "VIDEO",
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
      [state.personSegmenter, state.hairSegmenter] = await Promise.all([
        visionModule.ImageSegmenter.createFromOptions(vision, cpuOptions(
          "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite",
        )),
        visionModule.ImageSegmenter.createFromOptions(vision, cpuOptions(
          "https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite",
        )),
      ]);
    }
    state.segmentersReady = true;
    el.modelStatus.textContent = "双模型已就绪 · 本地运行";
  }

  async function updateAIMask(force = false) {
    if (!state.matting || !state.segmentersReady || state.maskBusy || !state.file || el.video.seeking) return false;
    const videoTime = el.video.currentTime || 0;
    if (!force && state.combinedMask && Math.abs(videoTime - state.lastMaskVideoTime) < 0.008) return false;
    const now = performance.now();
    if (!force && now - state.lastMaskAt < 75) return false;
    state.maskBusy = true;
    state.lastMaskAt = now;
    let updated = false;
    try {
      if (!state.bridgeRendering) {
        const sourceAspect = el.video.videoWidth / el.video.videoHeight;
        const previewLongEdge = Math.min(1280, Math.max(el.video.videoWidth, el.video.videoHeight));
        if (sourceAspect >= 1) {
          maskFrameCanvas.width = previewLongEdge;
          maskFrameCanvas.height = Math.max(1, Math.round(previewLongEdge / sourceAspect));
        } else {
          maskFrameCanvas.height = previewLongEdge;
          maskFrameCanvas.width = Math.max(1, Math.round(previewLongEdge * sourceAspect));
        }
        maskFrameCanvas.getContext("2d").drawImage(el.video, 0, 0, maskFrameCanvas.width, maskFrameCanvas.height);
      } else {
        maskFrameCanvas.width = 0;
        maskFrameCanvas.height = 0;
      }
      const timestamp = Math.max(++state.aiTimestamp, Math.round(now));
      const [person, hair] = await Promise.all([
        segmentFrame(state.personSegmenter, timestamp),
        segmentFrame(state.hairSegmenter, timestamp, 1),
      ]);
      const personCanvas = maskToCanvas(person, false);
      const hairCanvas = maskToCanvas(hair, true);
      const width = Math.max(personCanvas?.width || 0, hairCanvas?.width || 0);
      const height = Math.max(personCanvas?.height || 0, hairCanvas?.height || 0);
      if (width && height) {
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskContext = maskCanvas.getContext("2d");
        maskContext.clearRect(0, 0, width, height);
        if (personCanvas) maskContext.drawImage(personCanvas, 0, 0, width, height);
        if (hairCanvas) {
          maskContext.globalCompositeOperation = "source-over";
          maskContext.drawImage(hairCanvas, 0, 0, width, height);
          maskContext.globalCompositeOperation = "source-over";
        }
        applyManualMaskStrokes(maskContext, width, height);
        state.combinedMask = maskCanvas;
        if (!state.spillColorLocked) {
          state.spillColor = stabilizeSpillColor(estimateSpillColor(maskFrameCanvas.width ? maskFrameCanvas : el.video));
        }
        state.lastMaskVideoTime = videoTime;
        updated = true;
        if (!state.bridgeRendering && !state.exporting && state.previewMode === "video") {
          renderEditorFrame({ useMatting: true });
          updateUI();
        }
      }
    } catch (error) {
      console.error(error);
      el.modelStatus.textContent = "模型运行失败，请关闭后重试";
    } finally {
      state.maskBusy = false;
    }
    return updated;
  }

  function pauseEditor() {
    state.playing = false;
    el.video.pause();
    el.secondaryVideo.pause();
    updateUI();
  }

  async function togglePlayback() {
    if (!state.file || state.exporting || state.bridgeRendering) return;
    setPreviewMode("video");
    if (state.playing) {
      pauseEditor();
      return;
    }
    if (el.video.currentTime < state.trimStart || el.video.currentTime >= state.trimEnd) {
      el.video.currentTime = state.reverse ? state.trimEnd : state.trimStart;
    }
    state.playing = true;
    state.lastLoopTime = performance.now();
    if (!state.reverse) {
      el.video.playbackRate = state.speed;
      await el.video.play();
      if (state.secondaryType === "video") {
        el.secondaryVideo.playbackRate = state.speed;
        el.secondaryVideo.play().catch(() => {});
      }
    }
    updateUI();
  }

  function editorLoop(now) {
    if (state.file && !state.bridgeRendering && !state.exporting) {
      if (state.playing && state.reverse && !state.exporting) {
        const delta = Math.min(0.05, Math.max(0, (now - state.lastLoopTime) / 1000));
        const next = el.video.currentTime - delta * state.speed;
        if (next <= state.trimStart) {
          el.video.currentTime = state.trimEnd;
        } else {
          el.video.currentTime = next;
        }
      }
      state.lastLoopTime = now;
      if (!state.reverse && state.playing && el.video.currentTime >= state.trimEnd) {
        el.video.currentTime = state.trimStart;
      }
      if (state.secondaryType === "video" && el.secondaryVideo.duration) {
        const secondaryTime = positiveModulo(el.video.currentTime - state.trimStart, el.secondaryVideo.duration);
        if (Math.abs(el.secondaryVideo.currentTime - secondaryTime) > 0.2) el.secondaryVideo.currentTime = secondaryTime;
      }
      if (state.matting) updateAIMask();
      else renderEditorFrame({ useMatting: false });
      el.currentTime.textContent = formatTime(el.video.currentTime);
      el.scrubber.value = el.video.currentTime;
    }
    requestAnimationFrame(editorLoop);
  }

  function setTrim(edge, raw) {
    if (!state.file) return;
    const gap = Math.min(0.1, state.duration);
    if (edge === "start") {
      state.trimStart = clamp(Number(raw), 0, state.trimEnd - gap);
      el.video.currentTime = state.trimStart;
    } else {
      state.trimEnd = clamp(Number(raw), state.trimStart + gap, state.duration);
      el.video.currentTime = Math.min(state.trimEnd, state.duration - 0.001);
    }
    pauseEditor();
    updateUI();
    renderEditorFrame();
    signalEditorChange();
  }

  function seekMedia(media, time, duration) {
    return new Promise((resolve, reject) => {
      const target = clamp(time, 0, Math.max(0, duration - 0.001));
      if (Math.abs(media.currentTime - target) < 0.001) {
        requestAnimationFrame(resolve);
        return;
      }
      const onSeeked = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new Error("读取视频帧失败")); };
      const cleanup = () => {
        media.removeEventListener("seeked", onSeeked);
        media.removeEventListener("error", onError);
      };
      media.addEventListener("seeked", onSeeked, { once: true });
      media.addEventListener("error", onError, { once: true });
      media.currentTime = target;
    });
  }

  function seekVideo(time) {
    return seekMedia(el.video, time, state.duration);
  }

  async function seekSecondaryForOutput(outputTime) {
    const secondaryTime = secondaryTimeForOutput(outputTime);
    if (secondaryTime === null) return;
    await seekMedia(el.secondaryVideo, secondaryTime, el.secondaryVideo.duration);
  }

  async function renderAtOutputTime(outputTime, width, height) {
    if (!state.file) throw new Error("请先添加视频");
    if (state.exporting || state.bridgeRendering) throw new Error("视频编辑器正在处理其他任务");
    pauseEditor();
    state.bridgeRendering = true;
    updateUI();
    const previewSize = { width: el.canvas.width, height: el.canvas.height };
    try {
      await seekVideo(sourceTimeForOutput(outputTime));
      await seekSecondaryForOutput(outputTime);
      if (state.matting) {
        await ensureSegmenters();
        while (state.maskBusy) await new Promise((resolve) => setTimeout(resolve, 16));
        await updateAIMask(true);
      }
      el.canvas.width = Math.max(1, Math.round(width));
      el.canvas.height = Math.max(1, Math.round(height));
      layerCanvas.width = el.canvas.width;
      layerCanvas.height = el.canvas.height;
      renderEditorFrame({ useMatting: true });
      if (typeof createImageBitmap === "function") return await createImageBitmap(el.canvas);
      const copy = document.createElement("canvas");
      copy.width = el.canvas.width;
      copy.height = el.canvas.height;
      copy.getContext("2d").drawImage(el.canvas, 0, 0);
      return copy;
    } finally {
      el.canvas.width = previewSize.width;
      el.canvas.height = previewSize.height;
      layerCanvas.width = previewSize.width;
      layerCanvas.height = previewSize.height;
      state.bridgeRendering = false;
      updateUI();
      renderEditorFrame();
    }
  }

  async function exportVideo() {
    if (!state.file || state.exporting || state.bridgeRendering) return;
    if (!el.canvas.captureStream || typeof MediaRecorder === "undefined") {
      notify("当前浏览器不支持视频导出，请使用最新版 Chrome 或 Edge");
      return;
    }
    setPreviewMode("video");
    pauseEditor();
    state.exporting = true;
    updateUI();
    el.exportProgress.hidden = false;
    const progressBar = el.exportProgress.querySelector("i");
    const progressLabel = el.exportProgress.querySelector("span");
    const previewSize = { width: el.canvas.width, height: el.canvas.height };
    const aspect = ratioValue();
    const resolution = Number(el.resolution.value);
    if (aspect >= 1) {
      el.canvas.height = resolution;
      el.canvas.width = Math.round(resolution * aspect);
    } else {
      el.canvas.width = resolution;
      el.canvas.height = Math.round(resolution / aspect);
    }
    layerCanvas.width = el.canvas.width;
    layerCanvas.height = el.canvas.height;

    try {
      const fps = Number(el.fps.value);
      const duration = outputDuration();
      const frameCount = Math.max(1, Math.ceil(duration * fps));
      if (frameCount > 1800) notify("片段较长，导出可能需要一些时间");
      const stream = el.canvas.captureStream(0);
      const track = stream.getVideoTracks()[0];
      const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : undefined);
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
      recorder.start();

      for (let index = 0; index < frameCount; index += 1) {
        const outputTime = index / fps;
        await seekVideo(sourceTimeForOutput(outputTime));
        await seekSecondaryForOutput(outputTime);
        renderEditorFrame({ useMatting: false });
        track.requestFrame();
        const progress = Math.round((index + 1) / frameCount * 100);
        progressBar.style.setProperty("--export-progress", `${progress}%`);
        el.exportProgress.style.setProperty("--export-progress", `${progress}%`);
        progressLabel.textContent = `正在导出 ${progress}%`;
        await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
      }
      recorder.stop();
      await stopped;
      const blob = new Blob(chunks, { type: mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${state.file.name.replace(/\.[^.]+$/, "")}_edited.webm`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      notify(`视频导出完成 · ${formatBytes(blob.size)}`);
    } catch (error) {
      console.error(error);
      notify(error.message || "视频导出失败");
    } finally {
      el.canvas.width = previewSize.width;
      el.canvas.height = previewSize.height;
      layerCanvas.width = previewSize.width;
      layerCanvas.height = previewSize.height;
      state.exporting = false;
      el.exportProgress.hidden = true;
      updateUI();
      renderEditorFrame();
    }
  }

  function activateTool(tool) {
    setPreviewMode(tool === "sprite" ? "sprite" : "video");
  }

  window.SPRITEEE_EDITOR = {
    hasVideo: () => Boolean(state.file),
    getFile: () => state.file,
    getOutputDuration: outputDuration,
    getAspect: ratioValue,
    getSummary: editorSummary,
    renderAtOutputTime,
    activateTool,
    setPreviewMode,
    resetSpriteMatting,
  };

  let cropDrag = null;
  let cropSelectionDrag = null;
  let cropWheelTimer = null;

  function invalidateSpritePreview() {
    if (!state.file) return;
    window.dispatchEvent(new CustomEvent("spriteeee:sprite-dirty"));
  }

  function primaryPreviewRect() {
    const width = el.canvas.width;
    const height = el.canvas.height;
    if (state.layout === "split") return { x: 0, y: 0, width: width / 2, height };
    if (state.layout === "stack") return { x: 0, y: 0, width, height: height / 2 };
    return { x: 0, y: 0, width, height };
  }

  function pointerSourcePoint(event) {
    const bounds = el.canvas.getBoundingClientRect();
    const canvasX = (event.clientX - bounds.left) / Math.max(1, bounds.width) * el.canvas.width;
    const canvasY = (event.clientY - bounds.top) / Math.max(1, bounds.height) * el.canvas.height;
    const previewRect = primaryPreviewRect();
    if (
      canvasX < previewRect.x || canvasX > previewRect.x + previewRect.width
      || canvasY < previewRect.y || canvasY > previewRect.y + previewRect.height
    ) return null;
    const source = maskFrameCanvas.width && maskFrameCanvas.height ? maskFrameCanvas : el.video;
    const sourceWidth = source.videoWidth || source.naturalWidth || source.width || 1;
    const sourceHeight = source.videoHeight || source.naturalHeight || source.height || 1;
    const viewAspect = previewRect.width / previewRect.height;
    const sourceAspect = sourceWidth / sourceHeight;
    let sourceView = { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight };
    if (!(state.matting && state.combinedMask)) {
      if (sourceAspect > viewAspect) {
        sourceView.sw = sourceHeight * viewAspect;
        sourceView.sx = (sourceWidth - sourceView.sw) / 2;
      } else {
        sourceView.sh = sourceWidth / viewAspect;
        sourceView.sy = (sourceHeight - sourceView.sh) / 2;
      }
    }
    const viewX = clamp((canvasX - previewRect.x) / previewRect.width, 0, 1);
    const viewY = clamp((canvasY - previewRect.y) / previewRect.height, 0, 1);
    const sourceX = sourceView.sx + sourceView.sw * viewX;
    const sourceY = sourceView.sy + sourceView.sh * viewY;
    return {
      source,
      sourceWidth,
      sourceHeight,
      sourceX,
      sourceY,
      normalizedX: clamp(sourceX / sourceWidth, 0, 1),
      normalizedY: clamp(sourceY / sourceHeight, 0, 1),
    };
  }

  function sampleSourceColor(point) {
    if (!point) return null;
    spillPixelCanvas.width = 3;
    spillPixelCanvas.height = 3;
    const sampleContext = spillPixelCanvas.getContext("2d", { willReadFrequently: true });
    const sourceX = clamp(Math.round(point.sourceX) - 1, 0, Math.max(0, point.sourceWidth - 3));
    const sourceY = clamp(Math.round(point.sourceY) - 1, 0, Math.max(0, point.sourceHeight - 3));
    sampleContext.clearRect(0, 0, 3, 3);
    sampleContext.drawImage(
      point.source,
      sourceX,
      sourceY,
      Math.min(3, point.sourceWidth),
      Math.min(3, point.sourceHeight),
      0,
      0,
      3,
      3,
    );
    const pixels = sampleContext.getImageData(0, 0, 3, 3).data;
    const reds = [];
    const greens = [];
    const blues = [];
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] < 200) continue;
      reds.push(pixels[index]);
      greens.push(pixels[index + 1]);
      blues.push(pixels[index + 2]);
    }
    if (!reds.length) return null;
    const median = (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
    return { red: median(reds), green: median(greens), blue: median(blues) };
  }

  function rgbToHex({ red, green, blue }) {
    return `#${[red, green, blue].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  }

  function hidePrecisionLoupe() {
    el.precisionLoupe.hidden = true;
  }

  function updatePrecisionLoupe(event) {
    const active = state.file && state.previewMode === "video"
      && (state.pickingSpillColor || Boolean(state.maskBrushMode));
    if (!active) {
      hidePrecisionLoupe();
      return;
    }
    const point = pointerSourcePoint(event);
    if (!point) {
      hidePrecisionLoupe();
      return;
    }
    const loupeContext = el.precisionLoupeCanvas.getContext("2d");
    const sampleSize = Math.max(7, Math.min(15, Math.round(Math.min(point.sourceWidth, point.sourceHeight) / 90)) | 1);
    const half = Math.floor(sampleSize / 2);
    const sx = clamp(Math.round(point.sourceX) - half, 0, Math.max(0, point.sourceWidth - sampleSize));
    const sy = clamp(Math.round(point.sourceY) - half, 0, Math.max(0, point.sourceHeight - sampleSize));
    loupeContext.imageSmoothingEnabled = false;
    loupeContext.clearRect(0, 0, el.precisionLoupeCanvas.width, el.precisionLoupeCanvas.height);
    loupeContext.drawImage(
      point.source,
      sx,
      sy,
      Math.min(sampleSize, point.sourceWidth),
      Math.min(sampleSize, point.sourceHeight),
      0,
      0,
      el.precisionLoupeCanvas.width,
      el.precisionLoupeCanvas.height,
    );
    const color = sampleSourceColor(point);
    el.precisionLoupeLabel.textContent = state.pickingSpillColor && color
      ? `${rgbToHex(color)} · RGB ${color.red}, ${color.green}, ${color.blue}`
      : `${state.maskBrushMode === "add" ? "加选主体" : "减去背景"} · 画笔 ${Math.round(state.maskBrushSize * 100)}`;
    const stageBounds = el.stage.getBoundingClientRect();
    const localX = event.clientX - stageBounds.left;
    const localY = event.clientY - stageBounds.top;
    const loupeWidth = 156;
    const loupeHeight = 174;
    const gap = 22;
    let left = localX + gap;
    let top = localY - loupeHeight - gap;
    if (left + loupeWidth > stageBounds.width - 10) left = localX - loupeWidth - gap;
    if (top < 10) top = localY + gap;
    el.precisionLoupe.style.left = `${clamp(left, 10, Math.max(10, stageBounds.width - loupeWidth - 10))}px`;
    el.precisionLoupe.style.top = `${clamp(top, 10, Math.max(10, stageBounds.height - loupeHeight - 10))}px`;
    el.precisionLoupe.hidden = false;
  }

  function pickSpillColor(event) {
    const point = pointerSourcePoint(event);
    if (!point) {
      notify("请点击主画面的纯色背景区域");
      return;
    }
    const color = sampleSourceColor(point);
    if (!color) {
      notify("没有读取到背景颜色，请重新点击");
      return;
    }
    const { red, green, blue } = color;
    const hue = hueFromRGB(red, green, blue);
    const sampledColor = {
      red,
      green,
      blue,
      hue,
      name: spillColorName(hue),
      confidence: 1,
      manual: true,
    };
    const pickingMode = state.spillPickMode || "replace";
    if (pickingMode === "add" && state.manualSpillColors.length) {
      if (state.manualSpillColors.length >= 12) {
        state.pickingSpillColor = false;
        state.spillPickMode = null;
        updateUI();
        notify("已达到 12 个背景色键，当前覆盖范围已经足够");
        return;
      }
      const alreadySelected = state.manualSpillColors.some((existing) => (
        Math.hypot(existing.red - red, existing.green - green, existing.blue - blue) < 8
      ));
      if (alreadySelected) {
        notify("这个背景颜色已经选过了，可继续点击其他明暗区域");
        return;
      }
      state.manualSpillColors.push(sampledColor);
    } else {
      state.manualSpillColors = [sampledColor];
    }
    state.spillColor = sampledColor;
    state.spillColorLocked = true;
    state.pickingSpillColor = pickingMode === "add";
    state.spillPickMode = pickingMode === "add" ? "add" : null;
    invalidateSpritePreview();
    updateUI();
    renderEditorFrame({ useMatting: true });
    signalEditorChange();
    notify(pickingMode === "add"
      ? `已加选第 ${state.manualSpillColors.length} 个颜色，可继续点击背景，完成后再点“加选”`
      : `已锁定${state.spillColor.name}背景，可用“加选”补充明暗色`);
  }

  let maskPaint = null;

  function addManualMaskPoint(event, force = false) {
    const point = pointerSourcePoint(event);
    if (!point || !state.maskBrushMode) return false;
    const stroke = {
      x: point.normalizedX,
      y: point.normalizedY,
      radius: state.maskBrushSize,
      mode: state.maskBrushMode,
    };
    const previous = state.manualMaskStrokes[state.manualMaskStrokes.length - 1];
    const strokes = [];
    if (!force && previous && previous.mode === stroke.mode) {
      const distance = Math.hypot(previous.x - stroke.x, previous.y - stroke.y);
      if (distance < stroke.radius * 0.22) return false;
      const steps = Math.max(1, Math.ceil(distance / Math.max(0.002, stroke.radius * 0.34)));
      for (let step = 1; step <= steps; step += 1) {
        const progress = step / steps;
        strokes.push({
          ...stroke,
          x: previous.x + (stroke.x - previous.x) * progress,
          y: previous.y + (stroke.y - previous.y) * progress,
        });
      }
    } else {
      strokes.push(stroke);
    }
    const maskContext = maskCanvas.getContext("2d");
    strokes.forEach((nextStroke) => {
      state.manualMaskStrokes.push(nextStroke);
      drawManualMaskStroke(maskContext, maskCanvas.width, maskCanvas.height, nextStroke);
    });
    state.combinedMask = maskCanvas;
    renderEditorFrame({ useMatting: true });
    updateUI();
    return true;
  }

  function beginMaskPaint(event) {
    if (!state.combinedMask || !maskCanvas.width || !maskCanvas.height) {
      notify("AI 抠像还在准备，请稍等一下");
      return;
    }
    setPreviewMode("video");
    pauseEditor();
    maskPaint = { pointerId: event.pointerId, changed: false };
    el.canvas.setPointerCapture?.(event.pointerId);
    invalidateSpritePreview();
    maskPaint.changed = addManualMaskPoint(event, true);
    event.preventDefault();
  }

  function beginCanvasCrop(event) {
    if (!state.file || state.exporting || state.bridgeRendering || event.button !== 0) return;
    if (state.pickingSpillColor) {
      pickSpillColor(event);
      event.preventDefault();
      return;
    }
    if (state.maskBrushMode) {
      beginMaskPaint(event);
      return;
    }
    setPreviewMode("video");
    pauseEditor();
    const bounds = el.canvas.getBoundingClientRect();
    const crop = sourceCropRect(el.video, ratioValue());
    const sourceWidth = el.video.videoWidth || 1;
    const sourceHeight = el.video.videoHeight || 1;
    cropDrag = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCropX: state.cropX,
      startCropY: state.cropY,
      width: Math.max(1, bounds.width),
      height: Math.max(1, bounds.height),
      xScale: sourceWidth > crop.sw ? crop.sw / (sourceWidth - crop.sw) : 0,
      yScale: sourceHeight > crop.sh ? crop.sh / (sourceHeight - crop.sh) : 0,
    };
    el.canvas.setPointerCapture?.(event.pointerId);
    el.canvas.classList.add("is-dragging");
    invalidateSpritePreview();
    event.preventDefault();
  }

  function moveCanvasCrop(event) {
    updatePrecisionLoupe(event);
    if (maskPaint && maskPaint.pointerId === event.pointerId) {
      maskPaint.changed = addManualMaskPoint(event) || maskPaint.changed;
      event.preventDefault();
      return;
    }
    if (!cropDrag || cropDrag.pointerId !== event.pointerId) return;
    const deltaX = (event.clientX - cropDrag.startClientX) / cropDrag.width;
    const deltaY = (event.clientY - cropDrag.startClientY) / cropDrag.height;
    state.cropX = clamp(cropDrag.startCropX - deltaX * cropDrag.xScale, 0, 1);
    state.cropY = clamp(cropDrag.startCropY - deltaY * cropDrag.yScale, 0, 1);
    updateUI();
    renderEditorFrame();
    event.preventDefault();
  }

  function endCanvasCrop(event) {
    if (maskPaint && maskPaint.pointerId === event.pointerId) {
      el.canvas.releasePointerCapture?.(event.pointerId);
      const changed = maskPaint.changed;
      maskPaint = null;
      if (changed) signalEditorChange();
      event.preventDefault();
      return;
    }
    if (!cropDrag || cropDrag.pointerId !== event.pointerId) return;
    el.canvas.releasePointerCapture?.(event.pointerId);
    el.canvas.classList.remove("is-dragging");
    cropDrag = null;
    signalEditorChange();
  }

  function zoomCanvasCrop(event) {
    if (!state.file || state.exporting || state.bridgeRendering || state.pickingSpillColor || state.maskBrushMode) return;
    event.preventDefault();
    setPreviewMode("video");
    pauseEditor();
    const direction = event.deltaY < 0 ? 1 : -1;
    if (state.ratio === "free") {
      const factor = direction > 0 ? 0.92 : 1.08;
      const centerX = state.freeCropLeft + state.freeCropWidth / 2;
      const centerY = state.freeCropTop + state.freeCropHeight / 2;
      const width = clamp(state.freeCropWidth * factor, 16 / Math.max(1, el.video.videoWidth), 1);
      const height = clamp(state.freeCropHeight * factor, 16 / Math.max(1, el.video.videoHeight), 1);
      setFreeCrop({ left: centerX - width / 2, top: centerY - height / 2, width, height });
    } else {
      state.cropZoom = clamp(state.cropZoom + direction * 0.08, 1, 4);
    }
    invalidateSpritePreview();
    updateUI();
    renderEditorFrame();
    clearTimeout(cropWheelTimer);
    cropWheelTimer = setTimeout(signalEditorChange, 140);
  }

  function beginCropSelection(event) {
    if (!state.file || state.pickingSpillColor || state.maskBrushMode || state.exporting || state.bridgeRendering || event.button !== 0) return;
    setPreviewMode("video");
    pauseEditor();
    const selection = cropSelectionRect();
    const handle = event.target.dataset.handle || null;
    cropSelectionDrag = {
      pointerId: event.pointerId,
      mode: handle ? "resize" : "move",
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      start: selection,
      baseWidth: selection.width * state.cropZoom,
      baseHeight: selection.height * state.cropZoom,
      startZoom: state.cropZoom,
      anchorX: handle?.includes("w") ? selection.left + selection.width : selection.left,
      anchorY: handle?.includes("n") ? selection.top + selection.height : selection.top,
    };
    el.cropGuide.setPointerCapture?.(event.pointerId);
    el.cropGuide.classList.add("is-dragging");
    invalidateSpritePreview();
    event.stopPropagation();
    event.preventDefault();
  }

  function moveCropSelection(event) {
    if (!cropSelectionDrag || cropSelectionDrag.pointerId !== event.pointerId) return;
    const bounds = el.canvas.getBoundingClientRect();
    const pointerX = clamp((event.clientX - bounds.left) / Math.max(1, bounds.width), 0, 1);
    const pointerY = clamp((event.clientY - bounds.top) / Math.max(1, bounds.height), 0, 1);
    let left;
    let top;
    let width;
    let height;

    if (cropSelectionDrag.mode === "move") {
      const deltaX = (event.clientX - cropSelectionDrag.startClientX) / Math.max(1, bounds.width);
      const deltaY = (event.clientY - cropSelectionDrag.startClientY) / Math.max(1, bounds.height);
      width = cropSelectionDrag.start.width;
      height = cropSelectionDrag.start.height;
      left = clamp(cropSelectionDrag.start.left + deltaX, 0, 1 - width);
      top = clamp(cropSelectionDrag.start.top + deltaY, 0, 1 - height);
    } else if (state.ratio === "free") {
      const minWidth = Math.max(0.012, 16 / Math.max(1, el.video.videoWidth));
      const minHeight = Math.max(0.012, 16 / Math.max(1, el.video.videoHeight));
      if (cropSelectionDrag.handle.includes("w")) {
        const right = cropSelectionDrag.anchorX;
        left = clamp(pointerX, 0, right - minWidth);
        width = right - left;
      } else {
        left = cropSelectionDrag.anchorX;
        width = clamp(pointerX, left + minWidth, 1) - left;
      }
      if (cropSelectionDrag.handle.includes("n")) {
        const bottom = cropSelectionDrag.anchorY;
        top = clamp(pointerY, 0, bottom - minHeight);
        height = bottom - top;
      } else {
        top = cropSelectionDrag.anchorY;
        height = clamp(pointerY, top + minHeight, 1) - top;
      }
    } else {
      const desiredWidth = Math.max(0.01, Math.abs(pointerX - cropSelectionDrag.anchorX));
      const desiredHeight = Math.max(0.01, Math.abs(pointerY - cropSelectionDrag.anchorY));
      const zoomFromWidth = cropSelectionDrag.baseWidth / desiredWidth;
      const zoomFromHeight = cropSelectionDrag.baseHeight / desiredHeight;
      state.cropZoom = clamp(Math.max(zoomFromWidth, zoomFromHeight), 1, 4);
      width = cropSelectionDrag.baseWidth / state.cropZoom;
      height = cropSelectionDrag.baseHeight / state.cropZoom;
      left = cropSelectionDrag.handle.includes("w")
        ? cropSelectionDrag.anchorX - width
        : cropSelectionDrag.anchorX;
      top = cropSelectionDrag.handle.includes("n")
        ? cropSelectionDrag.anchorY - height
        : cropSelectionDrag.anchorY;
      left = clamp(left, 0, 1 - width);
      top = clamp(top, 0, 1 - height);
    }

    if (state.ratio === "free") {
      setFreeCrop({ left, top, width, height });
    } else {
      state.cropX = 1 - width > 0.0001 ? clamp(left / (1 - width), 0, 1) : 0.5;
      state.cropY = 1 - height > 0.0001 ? clamp(top / (1 - height), 0, 1) : 0.5;
    }
    updateUI();
    renderEditorFrame();
    event.preventDefault();
  }

  function endCropSelection(event) {
    if (!cropSelectionDrag || cropSelectionDrag.pointerId !== event.pointerId) return;
    el.cropGuide.releasePointerCapture?.(event.pointerId);
    el.cropGuide.classList.remove("is-dragging");
    cropSelectionDrag = null;
    signalEditorChange();
  }

  function openPrimaryPicker() {
    el.fileInput.value = "";
    el.fileInput.click();
  }

  el.uploadBtn.addEventListener("click", openPrimaryPicker);
  el.replaceBtn.addEventListener("click", openPrimaryPicker);
  el.fileInput.addEventListener("change", (event) => loadPrimaryVideo(event.target.files[0]));
  el.secondaryUploadBtn.addEventListener("click", () => {
    el.secondaryInput.value = "";
    el.secondaryInput.click();
  });
  el.secondaryInput.addEventListener("change", (event) => {
    loadSecondary(event.target.files[0]).catch((error) => {
      console.error(error);
      notify(error.message || "第二画面载入失败");
    });
  });
  el.playBtn.addEventListener("click", togglePlayback);
  el.previewVideoBtn.addEventListener("click", () => setPreviewMode("video"));
  el.previewSpriteBtn.addEventListener("click", () => setPreviewMode("sprite"));
  el.scrubber.addEventListener("input", (event) => {
    if (!state.file) return;
    setPreviewMode("video");
    pauseEditor();
    el.video.currentTime = Number(event.target.value);
  });
  el.trimStart.addEventListener("input", (event) => setTrim("start", event.target.value));
  el.trimEnd.addEventListener("input", (event) => setTrim("end", event.target.value));
  el.fitBtn.addEventListener("click", () => {
    state.cropZoom = 1;
    state.cropX = 0.5;
    state.cropY = 0.5;
    setFreeCrop({ left: 0, top: 0, width: 1, height: 1 });
    updateUI();
    renderEditorFrame();
    signalEditorChange();
  });
  el.canvas.addEventListener("pointerdown", beginCanvasCrop);
  el.canvas.addEventListener("pointermove", moveCanvasCrop);
  el.canvas.addEventListener("pointerup", endCanvasCrop);
  el.canvas.addEventListener("pointercancel", endCanvasCrop);
  el.canvas.addEventListener("pointerenter", updatePrecisionLoupe);
  el.canvas.addEventListener("pointerleave", hidePrecisionLoupe);
  el.canvas.addEventListener("wheel", zoomCanvasCrop, { passive: false });
  el.cropGuide.addEventListener("pointerdown", beginCropSelection);
  el.cropGuide.addEventListener("pointermove", moveCropSelection);
  el.cropGuide.addEventListener("pointerup", endCropSelection);
  el.cropGuide.addEventListener("pointercancel", endCropSelection);
  el.cropGuide.addEventListener("dblclick", (event) => {
    state.cropZoom = 1;
    state.cropX = 0.5;
    state.cropY = 0.5;
    setFreeCrop({ left: 0, top: 0, width: 1, height: 1 });
    updateUI();
    renderEditorFrame();
    signalEditorChange();
    event.stopPropagation();
  });
  el.canvas.addEventListener("dblclick", () => {
    if (!state.file || state.pickingSpillColor || state.maskBrushMode) return;
    state.cropZoom = 1;
    state.cropX = 0.5;
    state.cropY = 0.5;
    setFreeCrop({ left: 0, top: 0, width: 1, height: 1 });
    updateUI();
    renderEditorFrame();
    signalEditorChange();
  });
  function toggleSpillPicker(mode) {
    if (!state.file || !state.matting) {
      notify("请先添加视频并开启 AI 抠像");
      return;
    }
    const cancel = state.pickingSpillColor && state.spillPickMode === mode;
    state.pickingSpillColor = !cancel;
    state.spillPickMode = cancel ? null : mode;
    state.maskBrushMode = null;
    setPreviewMode("video");
    pauseEditor();
    updateUI();
    notify(cancel
      ? "已完成背景取色"
      : mode === "add" ? "请连续点击背景中不同的明暗或颜色区域" : "请点击左侧主背景颜色");
  }

  el.spillPickBtn.addEventListener("click", () => toggleSpillPicker("replace"));
  el.spillAddBtn.addEventListener("click", () => toggleSpillPicker("add"));
  el.spillAutoBtn.addEventListener("click", () => {
    state.pickingSpillColor = false;
    state.spillPickMode = null;
    state.spillColorLocked = false;
    state.spillColor = null;
    state.manualSpillColors = [];
    state.spillMisses = 0;
    state.lastMaskVideoTime = -1;
    if (state.matting && state.segmentersReady) updateAIMask(true);
    updateUI();
    renderEditorFrame();
    signalEditorChange();
    notify("已恢复自动背景色识别");
  });

  function setMaskBrushMode(mode) {
    if (!state.file || !state.matting) {
      notify("请先添加视频并开启 AI 抠像");
      return;
    }
    state.maskBrushMode = state.maskBrushMode === mode ? null : mode;
    state.pickingSpillColor = false;
    state.spillPickMode = null;
    setPreviewMode("video");
    pauseEditor();
    updateUI();
    if (state.maskBrushMode) {
      notify(state.maskBrushMode === "add" ? "加选已开启，在左侧涂回主体" : "减选已开启，在左侧擦除背景");
    } else {
      notify("已退出遮罩修补");
    }
  }

  el.maskAddBtn.addEventListener("click", () => setMaskBrushMode("add"));
  el.maskSubtractBtn.addEventListener("click", () => setMaskBrushMode("subtract"));
  el.maskClearBtn.addEventListener("click", async () => {
    if (!state.manualMaskStrokes.length) return;
    state.manualMaskStrokes = [];
    state.lastMaskVideoTime = -1;
    invalidateSpritePreview();
    if (state.matting && state.segmentersReady) await updateAIMask(true);
    renderEditorFrame({ useMatting: true });
    updateUI();
    signalEditorChange();
    notify("手动修补已清除");
  });
  el.maskBrushSize.addEventListener("input", (event) => {
    state.maskBrushSize = Number(event.target.value) / 100;
    el.maskBrushSizeValue.textContent = event.target.value;
    setRangeProgress(el.maskBrushSize);
  });

  qa(".crop-presets button").forEach((button) => button.addEventListener("click", () => {
    const nextRatio = button.dataset.ratio;
    if (nextRatio === state.ratio) return;
    if (nextRatio === "free") {
      const currentSelection = cropSelectionRect();
      setFreeCrop(currentSelection);
      state.cropZoom = 1;
    } else if (state.ratio === "free") {
      state.cropZoom = 1;
    }
    state.ratio = nextRatio;
    updatePreviewCanvasSize();
    updateUI();
    renderEditorFrame();
    signalEditorChange();
  }));
  qa(".layout-grid button").forEach((button) => button.addEventListener("click", () => {
    state.layout = button.dataset.layout;
    updateUI();
    renderEditorFrame();
    signalEditorChange();
  }));
  qa(".speed-grid button").forEach((button) => button.addEventListener("click", () => {
    state.speed = Number(button.dataset.speed);
    el.video.playbackRate = state.speed;
    updateUI();
    signalEditorChange();
  }));
  function bindEditorRange(input, output, setter, { refreshMask = false } = {}) {
    input.addEventListener("input", (event) => {
      setter(Number(event.target.value));
      output.textContent = event.target.value;
      setRangeProgress(input);
      if (refreshMask) {
        state.lastMaskVideoTime = -1;
        if (state.matting && state.segmentersReady) updateAIMask(true);
      }
      renderEditorFrame();
      signalEditorChange();
    });
  }
  bindEditorRange(el.cropZoom, el.cropZoomValue, (value) => {
    if (state.ratio !== "free") state.cropZoom = value / 100;
  });
  bindEditorRange(el.cropX, el.cropXValue, (value) => {
    state.cropX = value / 100;
    if (state.ratio === "free") setFreeCrop({
      left: state.cropX * (1 - state.freeCropWidth),
      top: state.freeCropTop,
      width: state.freeCropWidth,
      height: state.freeCropHeight,
    });
  });
  bindEditorRange(el.cropY, el.cropYValue, (value) => {
    state.cropY = value / 100;
    if (state.ratio === "free") setFreeCrop({
      left: state.freeCropLeft,
      top: state.cropY * (1 - state.freeCropHeight),
      width: state.freeCropWidth,
      height: state.freeCropHeight,
    });
  });
  bindEditorRange(el.hairDetail, el.hairDetailValue, (value) => { state.hairDetail = value / 100; }, { refreshMask: true });
  bindEditorRange(el.edgeFeather, el.edgeFeatherValue, (value) => { state.feather = value / 100; });
  bindEditorRange(el.despill, el.despillValue, (value) => { state.despill = value / 100; });

  el.reverseToggle.addEventListener("change", (event) => {
    const checked = event.target.checked;
    pauseEditor();
    state.reverse = checked;
    el.video.currentTime = state.reverse ? Math.max(state.trimStart, state.trimEnd - 0.001) : state.trimStart;
    updateUI();
    renderEditorFrame();
    signalEditorChange();
  });
  el.mattingToggle.addEventListener("change", async (event) => {
    state.matting = event.target.checked;
    if (!state.matting) {
      state.combinedMask = null;
      state.spillColor = null;
      state.spillColorLocked = false;
      state.pickingSpillColor = false;
      state.spillPickMode = null;
      state.manualSpillColors = [];
      state.maskBrushMode = null;
      state.lastMaskVideoTime = -1;
      window.dispatchEvent(new CustomEvent("spriteeee:matting-mode", {
        detail: { enabled: false },
      }));
      updateUI();
      renderEditorFrame();
      signalEditorChange();
      return;
    }
    if (!state.file) {
      notify("请先添加视频");
      state.matting = false;
      window.dispatchEvent(new CustomEvent("spriteeee:matting-mode", {
        detail: { enabled: false },
      }));
      updateUI();
      return;
    }
    state.background = "transparent";
    state.combinedMask = null;
    state.spillColor = null;
    state.spillColorLocked = false;
    state.pickingSpillColor = false;
    state.spillPickMode = null;
    state.manualSpillColors = [];
    state.maskBrushMode = null;
    state.lastMaskVideoTime = -1;
    window.dispatchEvent(new CustomEvent("spriteeee:matting-mode", {
      detail: { enabled: true },
    }));
    updateUI();
    el.modelStatus.textContent = state.segmentersReady ? "双模型已就绪 · 正在抠像" : "正在下载人像与毛发模型…";
    signalEditorChange();
    notify("正在准备 AI 抠像实时预览");
    try {
      await ensureSegmenters();
      if (!state.matting) return;
      await updateAIMask(true);
      renderEditorFrame({ useMatting: true });
      updateUI();
      notify("AI 抠像实时预览已开启");
    } catch (error) {
      console.error(error);
      state.matting = false;
      state.combinedMask = null;
      state.spillColor = null;
      state.spillColorLocked = false;
      state.pickingSpillColor = false;
      state.spillPickMode = null;
      state.manualSpillColors = [];
      state.maskBrushMode = null;
      state.lastMaskVideoTime = -1;
      el.modelStatus.textContent = "模型加载失败，请检查网络后重试";
      window.dispatchEvent(new CustomEvent("spriteeee:matting-mode", {
        detail: { enabled: false },
      }));
      updateUI();
      renderEditorFrame({ useMatting: false });
      signalEditorChange();
      notify("AI 模型加载失败，请检查网络后重试");
    }
  });
  el.exportBtn.addEventListener("click", exportVideo);
  el.syncBtn.addEventListener("click", () => {
    if (!state.file) return;
    signalEditorChange();
    activateTool("sprite");
    notify("编辑结果已同步，可直接生成精灵图");
  });
  el.resetBtn.addEventListener("click", () => {
    const duration = state.duration;
    Object.assign(state, {
      trimStart: 0,
      trimEnd: duration,
      ratio: defaults.ratio,
      cropZoom: defaults.cropZoom,
      cropX: defaults.cropX,
      cropY: defaults.cropY,
      freeCropLeft: defaults.freeCropLeft,
      freeCropTop: defaults.freeCropTop,
      freeCropWidth: defaults.freeCropWidth,
      freeCropHeight: defaults.freeCropHeight,
      layout: defaults.layout,
      speed: defaults.speed,
      reverse: defaults.reverse,
    });
    pauseEditor();
    updatePreviewCanvasSize();
    updateUI();
    renderEditorFrame();
    signalEditorChange();
    notify("视频编辑参数已重置");
  });

  window.addEventListener("spriteeee:sprite-source", (event) => {
    const file = event.detail?.file;
    if (!file) return;
    if (state.file === file && el.video.readyState >= 1) {
      signalEditorChange();
      return;
    }
    loadPrimaryVideo(file, { fromSprite: true, silent: true }).catch((error) => {
      console.error(error);
      notify("素材同步到视频编辑器失败");
    });
  });

  window.addEventListener("spriteeee:sprite-dirty", () => {
    state.spriteReady = false;
    state.previewMode = "video";
    updateUI();
  });

  window.addEventListener("spriteeee:sprite-ready", (event) => {
    state.spriteReady = true;
    state.previewMode = "sprite";
    state.spriteLabel = event.detail?.label || "SPRITE PREVIEW";
    updateUI();
  });

  window.addEventListener("resize", updatePreviewFrameLayout);

  updatePreviewCanvasSize();
  updateUI();
  requestAnimationFrame(editorLoop);
}());
