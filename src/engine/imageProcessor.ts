import {
  AspectRatioOption,
  BrushParams,
  BWParams,
  CropParams,
  CurvePoint,
  CurvesParams,
  DetailsParams,
  DoubleExposureParams,
  DramaParams,
  EditStackStep,
  EnhanceParams,
  ExpandParams,
  FramesParams,
  GlamourGlowParams,
  GrainParams,
  HdrScapeParams,
  HealingParams,
  HistogramData,
  LayerMask,
  LensBlurParams,
  Lut3DParams,
  NoirParams,
  PerspectiveParams,
  PortraitParams,
  RemoverParams,
  RetroluxParams,
  SelectiveParams,
  TextParams,
  TonalContrastParams,
  TuneParams,
  VignetteParams,
  VintageParams,
  WhiteBalanceParams,
} from '../types/editor';
import {applyTrilinearLut, getBuiltInLut, ParsedCubeLut} from './lutParser';

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
export type AnyImageSource = HTMLImageElement | ImageBitmap | AnyCanvas;

function makeCanvas(width: number, height: number): AnyCanvas {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }
  return new OffscreenCanvas(width, height);
}

function get2dCtx(
  canvas: AnyCanvas,
  willReadFrequently = false
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
  return canvas.getContext('2d', {willReadFrequently}) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
}

function getSourceDims(src: AnyImageSource): {w: number; h: number} {
  if (typeof HTMLImageElement !== 'undefined' && src instanceof HTMLImageElement) {
    return {w: src.naturalWidth, h: src.naturalHeight};
  }
  return {w: src.width, h: src.height};
}

function clampByte(val: number): number {
  return val < 0 ? 0 : val > 255 ? 255 : val | 0;
}

function clampFloat(val: number, min: number, max: number): number {
  return val < min ? min : val > max ? max : val;
}

function clampCoord(val: number, max: number): number {
  return val < 0 ? 0 : val > max ? max : val;
}

function separableBlur(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): Uint8ClampedArray {
  const r = Math.max(1, Math.round(radius));
  const temp = new Uint8ClampedArray(src.length);
  const dst = new Uint8ClampedArray(src.length);
  const win = r * 2 + 1;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;

    for (let k = -r; k <= r; k++) {
      const cx = Math.max(0, Math.min(width - 1, k));
      const idx = (rowOffset + cx) * 4;
      sumR += src[idx];
      sumG += src[idx + 1];
      sumB += src[idx + 2];
    }

    for (let x = 0; x < width; x++) {
      const outIdx = (rowOffset + x) * 4;
      temp[outIdx] = (sumR / win) | 0;
      temp[outIdx + 1] = (sumG / win) | 0;
      temp[outIdx + 2] = (sumB / win) | 0;
      temp[outIdx + 3] = 255;

      const removeX = Math.max(0, x - r);
      const addX = Math.min(width - 1, x + r + 1);
      const rIdx = (rowOffset + removeX) * 4;
      const aIdx = (rowOffset + addX) * 4;
      sumR += src[aIdx] - src[rIdx];
      sumG += src[aIdx + 1] - src[rIdx + 1];
      sumB += src[aIdx + 2] - src[rIdx + 2];
    }
  }

  for (let x = 0; x < width; x++) {
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;

    for (let k = -r; k <= r; k++) {
      const cy = Math.max(0, Math.min(height - 1, k));
      const idx = (cy * width + x) * 4;
      sumR += temp[idx];
      sumG += temp[idx + 1];
      sumB += temp[idx + 2];
    }

    for (let y = 0; y < height; y++) {
      const outIdx = (y * width + x) * 4;
      dst[outIdx] = (sumR / win) | 0;
      dst[outIdx + 1] = (sumG / win) | 0;
      dst[outIdx + 2] = (sumB / win) | 0;
      dst[outIdx + 3] = 255;

      const removeY = Math.max(0, y - r);
      const addY = Math.min(height - 1, y + r + 1);
      const rIdx = (removeY * width + x) * 4;
      const aIdx = (addY * width + x) * 4;
      sumR += temp[aIdx] - temp[rIdx];
      sumG += temp[aIdx + 1] - temp[rIdx + 1];
      sumB += temp[aIdx + 2] - temp[rIdx + 2];
    }
  }

  return dst;
}

// Smooth stroke rasterizer supporting Flow/Opacity and Hardness/Feather
function rasterizeStrokesMask(
  width: number,
  height: number,
  strokes: Array<{
    points: Array<{x: number; y: number}>;
    size: number;
    opacity?: number;
    hardness?: number;
    erase?: boolean;
  }>,
  initialFillAlpha: number = 0
): Uint8ClampedArray {
  const maskCanvas = makeCanvas(width, height);
  const ctx = get2dCtx(maskCanvas, true);
  if (!ctx) return new Uint8ClampedArray(width * height);

  if (initialFillAlpha > 0) {
    ctx.fillStyle = `rgba(255,255,255,${initialFillAlpha})`;
    ctx.fillRect(0, 0, width, height);
  }

  const minDim = Math.min(width, height);
  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    const rad = Math.max(6, (stroke.size / 100) * minDim);
    const flow = clampFloat((stroke.opacity ?? 100) / 100, 0.05, 1);
    const hardStop = clampFloat((stroke.hardness ?? 25) / 100, 0.05, 0.96);

    ctx.save();
    ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';

    // Stamp onto temporary stroke canvas first so overlapping segments in a single stroke respect flow cap
    const strokeCanvas = makeCanvas(width, height);
    const sCtx = get2dCtx(strokeCanvas);
    if (sCtx) {
      for (let i = 0; i < stroke.points.length; i++) {
        const p0 = stroke.points[i];
        const p1 = stroke.points[Math.min(i + 1, stroke.points.length - 1)];
        const x0 = p0.x * width;
        const y0 = p0.y * height;
        const x1 = p1.x * width;
        const y1 = p1.y * height;
        const dist = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(1, Math.ceil(dist / Math.max(2, rad * 0.28)));

        for (let s = 0; s <= steps; s++) {
          const t = steps === 0 ? 0 : s / steps;
          const cx = x0 + (x1 - x0) * t;
          const cy = y0 + (y1 - y0) * t;
          const grad = sCtx.createRadialGradient(cx, cy, rad * hardStop * 0.6, cx, cy, rad);
          grad.addColorStop(0, 'rgba(255,255,255,1)');
          grad.addColorStop(hardStop, 'rgba(255,255,255,0.85)');
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          sCtx.fillStyle = grad;
          sCtx.beginPath();
          sCtx.arc(cx, cy, rad, 0, Math.PI * 2);
          sCtx.fill();
        }
      }
      ctx.globalAlpha = flow;
      ctx.drawImage(strokeCanvas as CanvasImageSource, 0, 0);
    }
    ctx.restore();
  }

  const img = ctx.getImageData(0, 0, width, height).data;
  const alphaOut = new Uint8ClampedArray(width * height);
  for (let i = 0; i < alphaOut.length; i++) {
    alphaOut[i] = img[i * 4 + 3];
  }
  return alphaOut;
}

export function buildCurveLUT(points: CurvePoint[]): Uint8Array {
  const lut = new Uint8Array(256);
  const sorted = [...points].sort((a, b) => a.x - b.x);
  if (sorted.length < 2) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  const n = sorted.length;
  const xs = sorted.map((p) => p.x);
  const ys = sorted.map((p) => p.y);

  const dxs: number[] = [];
  const ms: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = Math.max(1e-4, xs[i + 1] - xs[i]);
    const dy = ys[i + 1] - ys[i];
    dxs.push(dx);
    ms.push(dy / dx);
  }

  const c1s: number[] = [ms[0]];
  for (let i = 0; i < dxs.length - 1; i++) {
    const m = ms[i];
    const mNext = ms[i + 1];
    if (m * mNext <= 0) {
      c1s.push(0);
    } else {
      const dx = dxs[i];
      const dxNext = dxs[i + 1];
      const common = dx + dxNext;
      c1s.push((3 * common) / ((common + dxNext) / m + (common + dx) / mNext));
    }
  }
  c1s.push(ms[ms.length - 1]);

  const c2s: number[] = [];
  const c3s: number[] = [];
  for (let i = 0; i < c1s.length - 1; i++) {
    const c1 = c1s[i];
    const m = ms[i];
    const invDx = 1 / dxs[i];
    const common = c1 + c1s[i + 1] - m - m;
    c2s.push((m - c1 - common) * invDx);
    c3s.push(common * invDx * invDx);
  }

  for (let x = 0; x < 256; x++) {
    if (x <= xs[0]) {
      lut[x] = clampByte(ys[0]);
      continue;
    }
    if (x >= xs[n - 1]) {
      lut[x] = clampByte(ys[n - 1]);
      continue;
    }
    let idx = 0;
    for (let i = 0; i < n - 1; i++) {
      if (x >= xs[i] && x <= xs[i + 1]) {
        idx = i;
        break;
      }
    }
    const diff = x - xs[idx];
    const val = ys[idx] + c1s[idx] * diff + c2s[idx] * diff * diff + c3s[idx] * diff * diff * diff;
    lut[x] = clampByte(Math.round(val));
  }

  return lut;
}

export function getAspectRatioValue(opt: AspectRatioOption): number | null {
  switch (opt) {
    case '1:1':
      return 1;
    case '4:3':
      return 4 / 3;
    case '3:2':
      return 3 / 2;
    case '16:9':
      return 16 / 9;
    case '3:4':
      return 3 / 4;
    default:
      return null;
  }
}

function applyCropAndRotate(
  source: AnyImageSource,
  crop: CropParams,
  maxDim: number,
  skipCropRect: boolean = false
): AnyCanvas {
  const {w: srcW, h: srcH} = getSourceDims(source);

  const scale = maxDim > 0 && Math.max(srcW, srcH) > maxDim ? maxDim / Math.max(srcW, srcH) : 1;
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const rotQuarter = ((crop.rotation90 % 360) + 360) % 360;
  const swapDims = rotQuarter === 90 || rotQuarter === 270;
  const baseW = swapDims ? h : w;
  const baseH = swapDims ? w : h;

  const rotCanvas = makeCanvas(Math.max(1, baseW), Math.max(1, baseH));
  const rCtx = get2dCtx(rotCanvas, true);
  if (!rCtx) return rotCanvas;

  rCtx.save();
  rCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);

  const rad = (crop.straighten * Math.PI) / 180;
  if (Math.abs(crop.straighten) > 0.05) {
    const absCos = Math.abs(Math.cos(rad));
    const absSin = Math.abs(Math.sin(rad));
    const zoom = Math.max(
      (rotCanvas.width * absCos + rotCanvas.height * absSin) / baseW,
      (rotCanvas.width * absSin + rotCanvas.height * absCos) / baseH
    );
    rCtx.scale(zoom, zoom);
  }
  if (crop.flipH) rCtx.scale(-1, 1);
  rCtx.rotate(((rotQuarter + crop.straighten) * Math.PI) / 180);
  rCtx.drawImage(source as CanvasImageSource, -w / 2, -h / 2, w, h);
  rCtx.restore();

  if (skipCropRect) return rotCanvas;

  const cx = clampFloat(crop.cropX ?? 0, 0, 0.9);
  const cy = clampFloat(crop.cropY ?? 0, 0, 0.9);
  const cw = clampFloat(crop.cropW ?? 1, 0.08, 1 - cx);
  const ch = clampFloat(crop.cropH ?? 1, 0.08, 1 - cy);

  const hasCustomRect = cx > 0.002 || cy > 0.002 || cw < 0.998 || ch < 0.998;
  const targetRatio = getAspectRatioValue(crop.aspectRatio);

  let sx = Math.round(cx * rotCanvas.width);
  let sy = Math.round(cy * rotCanvas.height);
  let sw = Math.max(8, Math.round(cw * rotCanvas.width));
  let sh = Math.max(8, Math.round(ch * rotCanvas.height));

  if (!hasCustomRect && targetRatio !== null) {
    if (rotCanvas.width / rotCanvas.height > targetRatio) {
      sw = Math.round(rotCanvas.height * targetRatio);
      sh = rotCanvas.height;
      sx = Math.round((rotCanvas.width - sw) / 2);
      sy = 0;
    } else {
      sw = rotCanvas.width;
      sh = Math.round(rotCanvas.width / targetRatio);
      sx = 0;
      sy = Math.round((rotCanvas.height - sh) / 2);
    }
  }

  const out = makeCanvas(Math.max(8, sw), Math.max(8, sh));
  const outCtx = get2dCtx(out, true);
  if (outCtx) {
    outCtx.drawImage(rotCanvas as CanvasImageSource, sx, sy, sw, sh, 0, 0, out.width, out.height);
  }
  return out;
}

function applyExpand(canvas: AnyCanvas, params: ExpandParams): AnyCanvas {
  if (params.top === 0 && params.bottom === 0 && params.left === 0 && params.right === 0) {
    return canvas;
  }

  const padT = Math.round((canvas.height * params.top) / 100);
  const padB = Math.round((canvas.height * params.bottom) / 100);
  const padL = Math.round((canvas.width * params.left) / 100);
  const padR = Math.round((canvas.width * params.right) / 100);

  const out = makeCanvas(canvas.width + padL + padR, canvas.height + padT + padB);
  const ctx = get2dCtx(out, true);
  if (!ctx) return canvas;

  if (params.fillMode === 'white') {
    ctx.fillStyle = '#F7F6F2';
    ctx.fillRect(0, 0, out.width, out.height);
  } else if (params.fillMode === 'black') {
    ctx.fillStyle = '#09090B';
    ctx.fillRect(0, 0, out.width, out.height);
  } else {
    // Smart mirrored + slightly blurred edge fill
    ctx.save();
    ctx.filter = 'blur(8px)';
    // Top mirror
    if (padT > 0) {
      ctx.save();
      ctx.translate(padL, padT);
      ctx.scale(1, -1);
      ctx.drawImage(canvas as CanvasImageSource, 0, 0, canvas.width, padT, 0, 0, canvas.width, padT);
      ctx.restore();
    }
    // Bottom mirror
    if (padB > 0) {
      ctx.save();
      ctx.translate(padL, padT + canvas.height * 2);
      ctx.scale(1, -1);
      ctx.drawImage(
        canvas as CanvasImageSource,
        0,
        Math.max(0, canvas.height - padB),
        canvas.width,
        padB,
        0,
        canvas.height - padB,
        canvas.width,
        padB
      );
      ctx.restore();
    }
    // Left mirror
    if (padL > 0) {
      ctx.save();
      ctx.translate(padL, padT);
      ctx.scale(-1, 1);
      ctx.drawImage(canvas as CanvasImageSource, 0, 0, padL, canvas.height, 0, 0, padL, canvas.height);
      ctx.restore();
    }
    // Right mirror
    if (padR > 0) {
      ctx.save();
      ctx.translate(padL + canvas.width * 2, padT);
      ctx.scale(-1, 1);
      ctx.drawImage(
        canvas as CanvasImageSource,
        Math.max(0, canvas.width - padR),
        0,
        padR,
        canvas.height,
        canvas.width - padR,
        0,
        padR,
        canvas.height
      );
      ctx.restore();
    }
    // Stretch full image softly behind corners so corners never stay transparent
    ctx.globalAlpha = 0.7;
    ctx.drawImage(canvas as CanvasImageSource, 0, 0, out.width, out.height);
    ctx.restore();
  }

  ctx.drawImage(canvas as CanvasImageSource, padL, padT);
  return out;
}

function applyPerspective(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: PerspectiveParams
) {
  if (
    Math.abs(params.verticalTilt) < 0.2 &&
    Math.abs(params.horizontalTilt) < 0.2 &&
    Math.abs(params.scale - 100) < 0.5
  ) {
    return;
  }

  const src = new Uint8ClampedArray(data);
  const vTilt = (params.verticalTilt / 45) * 0.35;
  const hTilt = (params.horizontalTilt / 45) * 0.35;
  const autoComp = 1 + (Math.abs(vTilt) + Math.abs(hTilt)) * 0.28;
  const invScale = 100 / (Math.max(50, params.scale) * autoComp);

  for (let y = 0; y < height; y++) {
    const ny = (y / height) * 2 - 1;
    for (let x = 0; x < width; x++) {
      const nx = (x / width) * 2 - 1;

      const denom = 1 + ny * vTilt + nx * hTilt;
      const safeDenom = denom < 0.25 ? 0.25 : denom;
      let sxNorm = ((nx * invScale) / safeDenom + 1) * 0.5;
      let syNorm = ((ny * invScale) / safeDenom + 1) * 0.5;

      if (sxNorm < 0) sxNorm = -sxNorm;
      if (sxNorm > 1) sxNorm = 2 - sxNorm;
      if (syNorm < 0) syNorm = -syNorm;
      if (syNorm > 1) syNorm = 2 - syNorm;

      const sx = clampFloat(sxNorm * (width - 1), 0, width - 1);
      const sy = clampFloat(syNorm * (height - 1), 0, height - 1);

      const x0 = sx | 0;
      const y0 = sy | 0;
      const x1 = Math.min(width - 1, x0 + 1);
      const y1 = Math.min(height - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;

      const i00 = (y0 * width + x0) * 4;
      const i10 = (y0 * width + x1) * 4;
      const i01 = (y1 * width + x0) * 4;
      const i11 = (y1 * width + x1) * 4;

      const outIdx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = src[i00 + c] * (1 - fx) + src[i10 + c] * fx;
        const bot = src[i01 + c] * (1 - fx) + src[i11 + c] * fx;
        data[outIdx + c] = clampByte(top * (1 - fy) + bot * fy);
      }
    }
  }
}

function applyTuneImage(data: Uint8ClampedArray, params: TuneParams) {
  const expGain = Math.pow(2, (params.brightness / 100) * 0.95);
  const contrastFactor =
    params.contrast >= 0
      ? 1 + (params.contrast / 100) * 1.15
      : 1 + (params.contrast / 100) * 0.72;
  const saturation = 1 + params.saturation / 100;
  const ambiance = params.ambiance / 100;
  const highlights = params.highlights / 100;
  const shadows = params.shadows / 100;
  const wShift = (params.warmth / 100) * 0.22;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    if (ambiance !== 0) {
      const ambDelta = ambiance * 48 * Math.sin(lum * Math.PI);
      r += ambDelta;
      g += ambDelta;
      b += ambDelta;
      const grayA = 0.299 * r + 0.587 * g + 0.114 * b;
      const midBoost = 1 + ambiance * 0.24;
      r = grayA + (r - grayA) * midBoost;
      g = grayA + (g - grayA) * midBoost;
      b = grayA + (b - grayA) * midBoost;
    }

    if (highlights !== 0) {
      const hMask = Math.pow(clampFloat((lum - 0.35) / 0.65, 0, 1), 1.7);
      const hScale = 1 + highlights * 0.45 * hMask;
      r *= hScale;
      g *= hScale;
      b *= hScale;
    }
    if (shadows !== 0) {
      const sMask = Math.pow(clampFloat((0.68 - lum) / 0.68, 0, 1), 1.8);
      const lift = shadows * 72 * sMask;
      r += lift;
      g += lift;
      b += lift;
    }

    if (params.brightness !== 0) {
      r *= expGain;
      g *= expGain;
      b *= expGain;
    }

    if (params.contrast !== 0) {
      r = (r - 128) * contrastFactor + 128;
      g = (g - 128) * contrastFactor + 128;
      b = (b - 128) * contrastFactor + 128;
    }

    if (wShift !== 0) {
      r *= 1 + wShift;
      g *= 1 + wShift * 0.15;
      b *= 1 - wShift;
    }

    if (saturation !== 1) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * saturation;
      g = gray + (g - gray) * saturation;
      b = gray + (b - gray) * saturation;
    }

    data[i] = clampByte(r);
    data[i + 1] = clampByte(g);
    data[i + 2] = clampByte(b);
  }
}

function applyWhiteBalance(data: Uint8ClampedArray, params: WhiteBalanceParams) {
  const temp = (params.temperature / 100) * 0.32;
  const tint = (params.tint / 100) * 0.25;
  const rMult = 1 + temp + tint * 0.35;
  const gMult = 1 - tint * 0.55;
  const bMult = 1 - temp + tint * 0.35;

  for (let i = 0; i < data.length; i += 4) {
    const oldLum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    let r = data[i] * rMult;
    let g = data[i + 1] * gMult;
    let b = data[i + 2] * bMult;
    const newLum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (newLum > 1) {
      const norm = oldLum / newLum;
      r *= norm;
      g *= norm;
      b *= norm;
    }
    data[i] = clampByte(r);
    data[i + 1] = clampByte(g);
    data[i + 2] = clampByte(b);
  }
}

function applyCurves(data: Uint8ClampedArray, params: CurvesParams) {
  const rgbLut = buildCurveLUT(params.rgb);
  const rLut = buildCurveLUT(params.r);
  const gLut = buildCurveLUT(params.g);
  const bLut = buildCurveLUT(params.b);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgbLut[rLut[data[i]]];
    data[i + 1] = rgbLut[gLut[data[i + 1]]];
    data[i + 2] = rgbLut[bLut[data[i + 2]]];
  }
}

function applyDetails(data: Uint8ClampedArray, width: number, height: number, params: DetailsParams) {
  const structureAmt = (params.structure / 100) * 1.1;
  const sharpAmt = (params.sharpening / 100) * 1.25;
  if (structureAmt <= 0.01 && sharpAmt <= 0.01) return;

  const src = new Uint8ClampedArray(data);
  const wideBlur = structureAmt > 0.01 ? separableBlur(src, width, height, 3) : null;

  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = (row + x) * 4;
      const top = ((y - 1) * width + x) * 4;
      const bot = ((y + 1) * width + x) * 4;
      const left = idx - 4;
      const right = idx + 4;

      for (let c = 0; c < 3; c++) {
        const center = src[idx + c];
        let out = center;

        if (sharpAmt > 0) {
          const avgCross = (src[top + c] + src[bot + c] + src[left + c] + src[right + c]) * 0.25;
          out += (center - avgCross) * sharpAmt;
        }
        if (wideBlur) {
          const delta = clampFloat(center - wideBlur[idx + c], -48, 48);
          out += delta * structureAmt;
        }
        data[idx + c] = clampByte(out);
      }
    }
  }
}

// On-device YCbCr skin-tone & facial zone Portrait enhancement
function applyPortrait(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: PortraitParams
) {
  const spotlight = params.faceSpotlight / 100;
  const smoothAmt = params.skinSmoothing / 100;
  const eyeAmt = params.eyeClarity / 100;

  const src = smoothAmt > 0.01 || eyeAmt > 0.01 ? new Uint8ClampedArray(data) : null;
  const smoothBlur = smoothAmt > 0.01 && src ? separableBlur(src, width, height, 5) : null;

  const cx = params.faceX * width;
  const cy = params.faceY * height;
  const rad = Math.max(20, (params.faceRadius / 100) * Math.min(width, height));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dist = Math.hypot(x - cx, y - cy) / rad;
      const zoneW = dist >= 1.6 ? 0 : Math.exp(-(dist * dist) * 1.4);
      const bgDim = spotlight > 0 ? clampFloat((dist - 0.85) / 1.2, 0, 1) * spotlight * 0.22 : 0;

      const i = (y * width + x) * 4;
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (zoneW > 0.01) {
        // Skin-tone detection in YCbCr chroma space
        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        const skinDist = Math.hypot((cb - 102) / 22, (cr - 152) / 22);
        const skinProb = clampFloat(1 - Math.max(0, skinDist - 0.65) * 1.3, 0, 1);

        // Edge-preserving skin smoothing (preserves brows/eyes/pores contrast edges)
        if (smoothBlur && src && skinProb > 0.05) {
          const edgeDiff =
            (Math.abs(r - smoothBlur[i]) +
              Math.abs(g - smoothBlur[i + 1]) +
              Math.abs(b - smoothBlur[i + 2])) /
            3;
          const edgeKeep = Math.exp(-(edgeDiff * edgeDiff) / 420);
          const sW = smoothAmt * 0.78 * skinProb * zoneW * edgeKeep;
          r = r * (1 - sW) + smoothBlur[i] * sW;
          g = g * (1 - sW) + smoothBlur[i + 1] * sW;
          b = b * (1 - sW) + smoothBlur[i + 2] * sW;
        }

        // Face Spotlight lift
        if (spotlight !== 0) {
          const lift = 1 + spotlight * 0.32 * zoneW;
          r *= lift;
          g *= lift;
          b *= lift;
        }

        // Eye & detail micro-clarity inside non-skin crisp features of face zone
        if (eyeAmt > 0.01 && src && x > 1 && x < width - 1 && y > 1 && y < height - 1) {
          const nonSkin = 1 - skinProb * 0.75;
          const top = ((y - 1) * width + x) * 4;
          const bot = ((y + 1) * width + x) * 4;
          const left = i - 4;
          const right = i + 4;
          const cBoost = eyeAmt * 0.9 * zoneW * nonSkin;
          r += (src[i] - (src[top] + src[bot] + src[left] + src[right]) * 0.25) * cBoost;
          g +=
            (src[i + 1] - (src[top + 1] + src[bot + 1] + src[left + 1] + src[right + 1]) * 0.25) *
            cBoost;
          b +=
            (src[i + 2] - (src[top + 2] + src[bot + 2] + src[left + 2] + src[right + 2]) * 0.25) *
            cBoost;
        }
      }

      if (bgDim > 0) {
        r *= 1 - bgDim;
        g *= 1 - bgDim;
        b *= 1 - bgDim;
      }

      data[i] = clampByte(r);
      data[i + 1] = clampByte(g);
      data[i + 2] = clampByte(b);
    }
  }
}

function applyHdrScape(data: Uint8ClampedArray, width: number, height: number, params: HdrScapeParams) {
  const strength = params.strength / 100;
  if (strength <= 0.01) return;

  const src = new Uint8ClampedArray(data);
  const blurRadius = params.style === 'fine' ? 5 : params.style === 'people' ? 12 : 16;
  const localBlur = separableBlur(src, width, height, blurRadius);

  const styleMult = params.style === 'strong' ? 1.45 : params.style === 'people' ? 0.72 : 1.05;
  const bright = params.brightness * 1.05;
  const satMod = 1 + (params.saturation / 100) * 1.2;

  for (let i = 0; i < data.length; i += 4) {
    let r = src[i];
    let g = src[i + 1];
    let b = src[i + 2];

    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const blurLum =
      (0.299 * localBlur[i] + 0.587 * localBlur[i + 1] + 0.114 * localBlur[i + 2]) / 255;

    const localDiff = (lum - blurLum) * 130 * strength * styleMult;
    const eqShift = (0.5 - blurLum) * 58 * strength * styleMult;

    r += localDiff + eqShift + bright;
    g += localDiff + eqShift + bright;
    b += localDiff + eqShift + bright;

    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * satMod;
    g = gray + (g - gray) * satMod;
    b = gray + (b - gray) * satMod;

    data[i] = clampByte(r);
    data[i + 1] = clampByte(g);
    data[i + 2] = clampByte(b);
  }
}

function applyTonalContrast(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: TonalContrastParams
) {
  const hAmt = params.highTones / 100;
  const mAmt = params.midTones / 100;
  const lAmt = params.lowTones / 100;
  if (hAmt <= 0.01 && mAmt <= 0.01 && lAmt <= 0.01) return;

  const src = new Uint8ClampedArray(data);
  const blur = separableBlur(src, width, height, 6);
  const pShad = params.protectShadows / 100;
  const pHigh = params.protectHighlights / 100;

  for (let i = 0; i < data.length; i += 4) {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    const lowW = Math.pow(1 - lum, 2) * (1 - pShad * 0.8);
    const highW = Math.pow(lum, 2) * (1 - pHigh * 0.8);
    const midW = Math.max(0, 1 - Math.abs(lum - 0.5) * 2.2);

    const boost = 1 + lAmt * lowW * 1.4 + mAmt * midW * 1.2 + hAmt * highW * 1.4;

    data[i] = clampByte(blur[i] + (r - blur[i]) * boost);
    data[i + 1] = clampByte(blur[i + 1] + (g - blur[i + 1]) * boost);
    data[i + 2] = clampByte(blur[i + 2] + (b - blur[i + 2]) * boost);
  }
}

function applyGlamourGlow(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: GlamourGlowParams
) {
  const glow = params.glow / 100;
  if (glow <= 0.01) return;

  const src = new Uint8ClampedArray(data);
  const blur = separableBlur(src, width, height, 10);
  const sat = 1 + params.saturation / 100;
  const warm = params.warmth * 0.45;

  for (let i = 0; i < data.length; i += 4) {
    const sr = 255 - ((255 - src[i]) * (255 - blur[i])) / 255;
    const sg = 255 - ((255 - src[i + 1]) * (255 - blur[i + 1])) / 255;
    const sb = 255 - ((255 - src[i + 2]) * (255 - blur[i + 2])) / 255;

    let r = src[i] * (1 - glow * 0.55) + sr * (glow * 0.55) + warm * glow;
    let g = src[i + 1] * (1 - glow * 0.55) + sg * (glow * 0.55);
    let b = src[i + 2] * (1 - glow * 0.55) + sb * (glow * 0.55) - warm * glow;

    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * sat;
    g = gray + (g - gray) * sat;
    b = gray + (b - gray) * sat;

    data[i] = clampByte(r);
    data[i + 1] = clampByte(g);
    data[i + 2] = clampByte(b);
  }
}

function applyLensBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: LensBlurParams
) {
  const strength = params.blurStrength / 100;
  if (strength <= 0.01) return;

  const src = new Uint8ClampedArray(data);
  const blurRad = Math.max(2, Math.round(strength * Math.min(width, height) * 0.025));
  const blurred = separableBlur(
    separableBlur(src, width, height, blurRad),
    width,
    height,
    Math.max(2, blurRad >> 1)
  );

  const cx = params.centerX * width;
  const cy = params.centerY * height;
  const minDim = Math.min(width, height);
  const innerR = (params.radius / 100) * minDim * 0.65;
  const transR = Math.max(12, (params.transition / 100) * minDim * 0.65);
  const vig = (params.vignetteStrength / 100) * 0.55;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dist = params.shape === 'linear' ? Math.abs(y - cy) : Math.hypot(x - cx, y - cy);
      const t = clampFloat((dist - innerR) / transR, 0, 1);
      const mask = t * t * (3 - 2 * t);
      const vigFactor = 1 - mask * vig;

      const i = (y * width + x) * 4;
      data[i] = clampByte((src[i] * (1 - mask) + blurred[i] * mask) * vigFactor);
      data[i + 1] = clampByte((src[i + 1] * (1 - mask) + blurred[i + 1] * mask) * vigFactor);
      data[i + 2] = clampByte((src[i + 2] * (1 - mask) + blurred[i + 2] * mask) * vigFactor);
    }
  }
}

function applyHealing(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: HealingParams
) {
  if (!params.spots.length) return;
  const minDim = Math.min(width, height);

  for (const spot of params.spots) {
    const rPx = Math.max(4, Math.round((spot.radius / 100) * minDim));
    const sampleDist = Math.max(rPx + 6, Math.round(rPx * 1.6));

    for (const pt of spot.points) {
      const px = clampCoord(Math.round(pt.x * width), width - 1);
      const py = clampCoord(Math.round(pt.y * height), height - 1);

      const srcSnap = new Uint8ClampedArray(data);
      let destSumR = 0;
      let destSumG = 0;
      let destSumB = 0;
      const dirs = 8;
      for (let d = 0; d < dirs; d++) {
        const ang = (d / dirs) * Math.PI * 2;
        const bx = clampCoord(Math.round(px + Math.cos(ang) * (rPx + 2)), width - 1);
        const by = clampCoord(Math.round(py + Math.sin(ang) * (rPx + 2)), height - 1);
        const bi = (by * width + bx) * 4;
        destSumR += srcSnap[bi];
        destSumG += srcSnap[bi + 1];
        destSumB += srcSnap[bi + 2];
      }
      const destMeanR = destSumR / dirs;
      const destMeanG = destSumG / dirs;
      const destMeanB = destSumB / dirs;

      let bestAngle = 0;
      let bestDiff = Infinity;
      for (let d = 0; d < dirs; d++) {
        const ang = (d / dirs) * Math.PI * 2;
        const ox = clampCoord(Math.round(px + Math.cos(ang) * sampleDist), width - 1);
        const oy = clampCoord(Math.round(py + Math.sin(ang) * sampleDist), height - 1);
        const oi = (oy * width + ox) * 4;
        const diff =
          Math.abs(srcSnap[oi] - destMeanR) +
          Math.abs(srcSnap[oi + 1] - destMeanG) +
          Math.abs(srcSnap[oi + 2] - destMeanB);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestAngle = ang;
        }
      }

      const offX = Math.round(Math.cos(bestAngle) * sampleDist);
      const offY = Math.round(Math.sin(bestAngle) * sampleDist);

      const donorCenterIdx =
        (clampCoord(py + offY, height - 1) * width + clampCoord(px + offX, width - 1)) * 4;
      const shiftR = destMeanR - srcSnap[donorCenterIdx];
      const shiftG = destMeanG - srcSnap[donorCenterIdx + 1];
      const shiftB = destMeanB - srcSnap[donorCenterIdx + 2];

      const minX = Math.max(0, px - rPx);
      const maxX = Math.min(width - 1, px + rPx);
      const minY = Math.max(0, py - rPx);
      const maxY = Math.min(height - 1, py + rPx);

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dist = Math.hypot(x - px, y - py) / rPx;
          if (dist >= 1) continue;
          const weight = 0.5 * (1 + Math.cos(dist * Math.PI));

          const sx = clampCoord(x + offX, width - 1);
          const sy = clampCoord(y + offY, height - 1);
          const si = (sy * width + sx) * 4;
          const di = (y * width + x) * 4;

          const pR = srcSnap[si] + shiftR * 0.45;
          const pG = srcSnap[si + 1] + shiftG * 0.45;
          const pB = srcSnap[si + 2] + shiftB * 0.45;

          data[di] = clampByte(srcSnap[di] * (1 - weight) + pR * weight);
          data[di + 1] = clampByte(srcSnap[di + 1] * (1 - weight) + pG * weight);
          data[di + 2] = clampByte(srcSnap[di + 2] * (1 - weight) + pB * weight);
        }
      }
    }
  }
}

// Pro Object Remover: Multi-pass Laplace harmonic color bridge + reflected boundary texture synthesis
function applyObjectRemover(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: RemoverParams
) {
  if (!params.regions.length) return;
  const strokes = params.regions.map((reg) => ({
    points: reg.points,
    size: reg.size,
    opacity: 100,
    hardness: 90,
    erase: false,
  }));
  const maskAlpha = rasterizeStrokesMask(width, height, strokes, 0);

  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (maskAlpha[row + x] > 32) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return;

  const pad = 12;
  const bx0 = Math.max(0, minX - pad);
  const bx1 = Math.min(width - 1, maxX + pad);
  const by0 = Math.max(0, minY - pad);
  const by1 = Math.min(height - 1, maxY + pad);
  const bw = bx1 - bx0 + 1;
  const bh = by1 - by0 + 1;
  const boxLen = bw * bh;

  const inMask = new Uint8Array(boxLen);
  const nearX = new Int32Array(boxLen);
  const nearY = new Int32Array(boxLen);
  const distMap = new Int32Array(boxLen);
  distMap.fill(-1);

  const queue = new Int32Array(boxLen);
  let qHead = 0;
  let qTail = 0;

  for (let ly = 0; ly < bh; ly++) {
    const gy = by0 + ly;
    for (let lx = 0; lx < bw; lx++) {
      const gx = bx0 + lx;
      const li = ly * bw + lx;
      const gi = gy * width + gx;
      if (maskAlpha[gi] > 32) {
        inMask[li] = 1;
      } else {
        distMap[li] = 0;
        nearX[li] = gx;
        nearY[li] = gy;
        queue[qTail++] = li;
      }
    }
  }

  // BFS from known boundary inward to record nearest known pixel for every masked point
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  while (qHead < qTail) {
    const li = queue[qHead++];
    const lx = li % bw;
    const ly = (li / bw) | 0;
    const d = distMap[li];
    for (let k = 0; k < 4; k++) {
      const nx = lx + dirs[k][0];
      const ny = ly + dirs[k][1];
      if (nx < 0 || nx >= bw || ny < 0 || ny >= bh) continue;
      const nli = ny * bw + nx;
      if (distMap[nli] === -1) {
        distMap[nli] = d + 1;
        nearX[nli] = nearX[li];
        nearY[nli] = nearY[li];
        queue[qTail++] = nli;
      }
    }
  }

  // Working float buffer for seamless harmonic relaxation
  const srcSnap = new Uint8ClampedArray(data);
  const harmR = new Float32Array(boxLen);
  const harmG = new Float32Array(boxLen);
  const harmB = new Float32Array(boxLen);

  const maskedIndices: number[] = [];
  for (let ly = 0; ly < bh; ly++) {
    const gy = by0 + ly;
    for (let lx = 0; lx < bw; lx++) {
      const gx = bx0 + lx;
      const li = ly * bw + lx;
      if (inMask[li]) {
        const nx = clampCoord(nearX[li], width - 1);
        const ny = clampCoord(nearY[li], height - 1);
        const ni = (ny * width + nx) * 4;
        harmR[li] = srcSnap[ni];
        harmG[li] = srcSnap[ni + 1];
        harmB[li] = srcSnap[ni + 2];
        maskedIndices.push(li);
      } else {
        const gi = (gy * width + gx) * 4;
        harmR[li] = srcSnap[gi];
        harmG[li] = srcSnap[gi + 1];
        harmB[li] = srcSnap[gi + 2];
      }
    }
  }

  // 22 fast Gauss-Seidel harmonic relaxation sweeps
  const passes = 22;
  for (let p = 0; p < passes; p++) {
    for (let m = 0; m < maskedIndices.length; m++) {
      const li = maskedIndices[m];
      const lx = li % bw;
      const ly = (li / bw) | 0;
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let cnt = 0;
      if (lx > 0) {
        sr += harmR[li - 1];
        sg += harmG[li - 1];
        sb += harmB[li - 1];
        cnt++;
      }
      if (lx < bw - 1) {
        sr += harmR[li + 1];
        sg += harmG[li + 1];
        sb += harmB[li + 1];
        cnt++;
      }
      if (ly > 0) {
        sr += harmR[li - bw];
        sg += harmG[li - bw];
        sb += harmB[li - bw];
        cnt++;
      }
      if (ly < bh - 1) {
        sr += harmR[li + bw];
        sg += harmG[li + bw];
        sb += harmB[li + bw];
        cnt++;
      }
      if (cnt > 0) {
        harmR[li] = sr / cnt;
        harmG[li] = sg / cnt;
        harmB[li] = sb / cnt;
      }
    }
  }

  const featherAmt = clampFloat((params.feather ?? 45) / 100, 0, 1);

  // Combine smooth harmonic base + reflected boundary texture residual + feathered edge blend
  for (let m = 0; m < maskedIndices.length; m++) {
    const li = maskedIndices[m];
    const lx = li % bw;
    const ly = (li / bw) | 0;
    const gx = bx0 + lx;
    const gy = by0 + ly;
    const gi = (gy * width + gx) * 4;

    const bpx = clampCoord(nearX[li], width - 1);
    const bpy = clampCoord(nearY[li], height - 1);
    const rx = clampCoord(bpx + (bpx - gx), width - 1);
    const ry = clampCoord(bpy + (bpy - gy), height - 1);

    // Local 3x3 high-frequency texture residual around reflected known pixel (rx, ry)
    let meanR = 0;
    let meanG = 0;
    let meanB = 0;
    let mCnt = 0;
    for (let oy = -2; oy <= 2; oy += 2) {
      for (let ox = -2; ox <= 2; ox += 2) {
        const sx = clampCoord(rx + ox, width - 1);
        const sy = clampCoord(ry + oy, height - 1);
        const si = (sy * width + sx) * 4;
        meanR += srcSnap[si];
        meanG += srcSnap[si + 1];
        meanB += srcSnap[si + 2];
        mCnt++;
      }
    }
    meanR /= mCnt;
    meanG /= mCnt;
    meanB /= mCnt;

    const ri = (ry * width + rx) * 4;
    const texR = clampFloat(srcSnap[ri] - meanR, -32, 32);
    const texG = clampFloat(srcSnap[ri + 1] - meanG, -32, 32);
    const texB = clampFloat(srcSnap[ri + 2] - meanB, -32, 32);

    const outR = harmR[li] + texR * 0.85;
    const outG = harmG[li] + texG * 0.85;
    const outB = harmB[li] + texB * 0.85;

    const rawAlpha = maskAlpha[gy * width + gx] / 255;
    const blendW = featherAmt > 0.05 ? clampFloat((rawAlpha - 0.12) / (0.35 + featherAmt * 0.5), 0, 1) : 1;

    data[gi] = clampByte(srcSnap[gi] * (1 - blendW) + outR * blendW);
    data[gi + 1] = clampByte(srcSnap[gi + 1] * (1 - blendW) + outG * blendW);
    data[gi + 2] = clampByte(srcSnap[gi + 2] * (1 - blendW) + outB * blendW);
  }
}

function upscaleCanvasScale(canvas: AnyCanvas, factor: number): AnyCanvas {
  const newW = Math.min(4096, Math.max(1, Math.round(canvas.width * factor)));
  const newH = Math.min(4096, Math.max(1, Math.round(canvas.height * factor)));
  if (newW === canvas.width && newH === canvas.height) return canvas;
  const out = makeCanvas(newW, newH);
  const ctx = get2dCtx(out, true);
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas as CanvasImageSource, 0, 0, newW, newH);
  }
  return out;
}

// Remini-style HD Enhance: Edge-preserving bilateral denoise + multi-scale deconvolution clarity + face/eye micro-detail restoration
function applyEnhance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: EnhanceParams
) {
  const clarityAmt = (params.clarity / 100) * 1.15;
  const denoiseAmt = params.denoise / 100;
  const faceAmt = params.faceRestore / 100;

  if (clarityAmt <= 0.01 && denoiseAmt <= 0.01 && faceAmt <= 0.01) return;

  const src = new Uint8ClampedArray(data);

  // 1. Edge-preserving fast Bilateral Filter (3x3 range-weighted) for noise & JPEG artifact cleanup
  const denoised = new Uint8ClampedArray(src.length);
  if (denoiseAmt > 0.02 || faceAmt > 0.02) {
    const sigmaRange = 14 + Math.max(denoiseAmt, faceAmt * 0.65) * 44;
    const invSigmaSq = 1 / (2 * sigmaRange * sigmaRange);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ci = (y * width + x) * 4;
        const cr = src[ci];
        const cg = src[ci + 1];
        const cb = src[ci + 2];

        let wSum = 1.0;
        let rSum = cr;
        let gSum = cg;
        let bSum = cb;

        for (let oy = -1; oy <= 1; oy++) {
          const ny = y + oy;
          if (ny < 0 || ny >= height) continue;
          for (let ox = -1; ox <= 1; ox++) {
            if (ox === 0 && oy === 0) continue;
            const nx = x + ox;
            if (nx < 0 || nx >= width) continue;
            const ni = (ny * width + nx) * 4;
            const dr = src[ni] - cr;
            const dg = src[ni + 1] - cg;
            const db = src[ni + 2] - cb;
            const diffSq = 0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db;
            const w = Math.exp(-diffSq * invSigmaSq) * (ox === 0 || oy === 0 ? 0.85 : 0.6);
            wSum += w;
            rSum += src[ni] * w;
            gSum += src[ni + 1] * w;
            bSum += src[ni + 2] * w;
          }
        }

        denoised[ci] = (rSum / wSum) | 0;
        denoised[ci + 1] = (gSum / wSum) | 0;
        denoised[ci + 2] = (bSum / wSum) | 0;
        denoised[ci + 3] = 255;
      }
    }
  } else {
    denoised.set(src);
  }

  // 2. Multi-scale soft structure blur for halo-free deconvolution sharpening
  const wideBlur = clarityAmt > 0.01 || faceAmt > 0.01 ? separableBlur(denoised, width, height, 2) : null;

  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = (row + x) * 4;
      const top = ((y - 1) * width + x) * 4;
      const bot = ((y + 1) * width + x) * 4;
      const left = idx - 4;
      const right = idx + 4;

      let r = src[idx] * (1 - denoiseAmt * 0.82) + denoised[idx] * (denoiseAmt * 0.82);
      let g = src[idx + 1] * (1 - denoiseAmt * 0.82) + denoised[idx + 1] * (denoiseAmt * 0.82);
      let b = src[idx + 2] * (1 - denoiseAmt * 0.82) + denoised[idx + 2] * (denoiseAmt * 0.82);

      // YCbCr skin-tone detection for Remini-style face/eye micro-detail restoration
      let skinProb = 0;
      if (faceAmt > 0.01) {
        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        const skinDist = Math.hypot((cb - 102) / 22, (cr - 152) / 22);
        skinProb = clampFloat(1 - Math.max(0, skinDist - 0.65) * 1.35, 0, 1);

        // Clean smooth skin micro-noise while sharpening eyes/lashes/brows/hair
        if (skinProb > 0.35) {
          const skinW = faceAmt * 0.55 * skinProb;
          r = r * (1 - skinW) + denoised[idx] * skinW;
          g = g * (1 - skinW) + denoised[idx + 1] * skinW;
          b = b * (1 - skinW) + denoised[idx + 2] * skinW;
        }
      }

      // Fine deconvolution crispness + soft-clipped local contrast
      const detailGain = clarityAmt + faceAmt * (1 - skinProb * 0.82) * 0.9;
      if (detailGain > 0.01) {
        const avgCrossR = (denoised[top] + denoised[bot] + denoised[left] + denoised[right]) * 0.25;
        const avgCrossG =
          (denoised[top + 1] + denoised[bot + 1] + denoised[left + 1] + denoised[right + 1]) * 0.25;
        const avgCrossB =
          (denoised[top + 2] + denoised[bot + 2] + denoised[left + 2] + denoised[right + 2]) * 0.25;

        const dR = clampFloat((denoised[idx] - avgCrossR) * detailGain * 1.1, -40, 40);
        const dG = clampFloat((denoised[idx + 1] - avgCrossG) * detailGain * 1.1, -40, 40);
        const dB = clampFloat((denoised[idx + 2] - avgCrossB) * detailGain * 1.1, -40, 40);
        r += dR;
        g += dG;
        b += dB;
      }

      if (wideBlur && (clarityAmt > 0.01 || faceAmt > 0.01)) {
        const midBoost = clarityAmt * 0.42 + faceAmt * 0.18;
        r += clampFloat((denoised[idx] - wideBlur[idx]) * midBoost, -26, 26);
        g += clampFloat((denoised[idx + 1] - wideBlur[idx + 1]) * midBoost, -26, 26);
        b += clampFloat((denoised[idx + 2] - wideBlur[idx + 2]) * midBoost, -26, 26);
      }

      // Subtle dynamic range micro-punch on faded photos when faceRestore/clarity active
      if (faceAmt > 0.15) {
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const sLift = (lum * lum * (3 - 2 * lum) - lum) * 32 * faceAmt;
        r += sLift;
        g += sLift;
        b += sLift;
      }

      data[idx] = clampByte(r);
      data[idx + 1] = clampByte(g);
      data[idx + 2] = clampByte(b);
    }
  }
}

function applyBrush(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: BrushParams
) {
  if (!params.strokes.length) return;

  for (const stroke of params.strokes) {
    if (stroke.mode === 'eraser' || stroke.points.length === 0) continue;
    const alphaMask = rasterizeStrokesMask(width, height, [stroke], 0);
    const str = stroke.strength / 10;

    for (let idx = 0; idx < alphaMask.length; idx++) {
      const a = alphaMask[idx];
      if (a === 0) continue;
      const w = a / 255;
      const i = idx * 4;
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (stroke.mode === 'dodgeburn') {
        const factor = 1 + str * w * 0.65;
        r *= factor;
        g *= factor;
        b *= factor;
      } else if (stroke.mode === 'exposure') {
        const shift = str * w * 65;
        r += shift;
        g += shift;
        b += shift;
      } else if (stroke.mode === 'temperature') {
        const t = str * w * 45;
        r += t;
        b -= t;
      } else if (stroke.mode === 'saturation') {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const s = 1 + str * w * 0.9;
        r = gray + (r - gray) * s;
        g = gray + (g - gray) * s;
        b = gray + (b - gray) * s;
      }

      data[i] = clampByte(r);
      data[i + 1] = clampByte(g);
      data[i + 2] = clampByte(b);
    }
  }
}

function applySelective(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: SelectiveParams,
  showRubylithMask: boolean = false
) {
  if (!params.points.length) return;
  const minDim = Math.min(width, height);

  for (const pt of params.points) {
    const px = clampCoord(Math.round(pt.x * width), width - 1);
    const py = clampCoord(Math.round(pt.y * height), height - 1);
    const radPx = Math.max(12, (pt.radius / 100) * minDim);
    const invRad = 1 / radPx;

    const refIdx = (py * width + px) * 4;
    const refR = data[refIdx];
    const refG = data[refIdx + 1];
    const refB = data[refIdx + 2];
    const sigma = Math.max(18, (pt.tolerance ?? 45) * 2.2);
    const invTwoSigmaSq = 1 / (2 * sigma * sigma);

    const minX = Math.max(0, Math.floor(px - radPx));
    const maxX = Math.min(width - 1, Math.ceil(px + radPx));
    const minY = Math.max(0, Math.floor(py - radPx));
    const maxY = Math.min(height - 1, Math.ceil(py + radPx));

    const bright = pt.brightness * 1.05;
    const contrastMod = pt.contrast / 100;
    const satMod = pt.saturation / 100;

    for (let y = minY; y <= maxY; y++) {
      const dy = y - py;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - px;
        const dist = Math.sqrt(dx * dx + dy * dy) * invRad;
        if (dist >= 1) continue;

        const i = (y * width + x) * 4;
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        const dr = r - refR;
        const dg = g - refG;
        const db = b - refB;
        const colorDistSq = 0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db;
        const colorWeight = Math.exp(-colorDistSq * invTwoSigmaSq);
        const spatialWeight = 0.5 * (1 + Math.cos(dist * Math.PI));
        const weight = spatialWeight * colorWeight;

        if (showRubylithMask && pt.id === params.activePointId) {
          const redOverlay = weight * 0.55;
          data[i] = clampByte(r * (1 - redOverlay) + 239 * redOverlay);
          data[i + 1] = clampByte(g * (1 - redOverlay) + 45 * redOverlay);
          data[i + 2] = clampByte(b * (1 - redOverlay) + 68 * redOverlay);
          continue;
        }

        r += bright * weight;
        g += bright * weight;
        b += bright * weight;

        const cFactor = 1 + contrastMod * weight;
        r = (r - 128) * cFactor + 128;
        g = (g - 128) * cFactor + 128;
        b = (b - 128) * cFactor + 128;

        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const sFactor = 1 + satMod * weight;
        r = gray + (r - gray) * sFactor;
        g = gray + (g - gray) * sFactor;
        b = gray + (b - gray) * sFactor;

        data[i] = clampByte(r);
        data[i + 1] = clampByte(g);
        data[i + 2] = clampByte(b);
      }
    }
  }
}

function applyDrama(data: Uint8ClampedArray, params: DramaParams) {
  const strength = params.strength / 100;
  if (strength <= 0.01) return;
  const satMod = 1 + params.saturation / 100;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    const sCurve = lum < 0.5 ? 2 * lum * lum : 1 - 2 * (1 - lum) * (1 - lum);
    const targetLum = lum + (sCurve - lum) * strength * 0.85;
    const scale = lum > 0.01 ? targetLum / lum : 1;

    const nr = r * scale;
    const ng = g * scale;
    const nb = b * scale + strength * 10 * (1 - Math.abs(lum - 0.5) * 2);

    const gray = 0.299 * nr + 0.587 * ng + 0.114 * nb;
    const finalSat = 1 + (satMod - 1) * strength;
    data[i] = clampByte(gray + (nr - gray) * finalSat);
    data[i + 1] = clampByte(gray + (ng - gray) * finalSat);
    data[i + 2] = clampByte(gray + (nb - gray) * finalSat);
  }
}

function applyVintage(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: VintageParams
) {
  const s = params.strength / 100;
  const bright = params.brightness * 1.1;
  const satMod = 1 + (params.saturation ?? 0) / 100;
  const vig = params.vignette / 100;

  let tintR = 24;
  let tintG = 12;
  let tintB = -18;
  let fade = 18;

  if (params.style === 'coolfuji') {
    tintR = -14;
    tintG = 12;
    tintB = 22;
    fade = 14;
  } else if (params.style === 'retrofade') {
    tintR = 20;
    tintG = 16;
    tintB = 8;
    fade = 32;
  } else if (params.style === 'kodachrome') {
    tintR = 26;
    tintG = 4;
    tintB = -14;
    fade = 8;
  }

  const cx = width * 0.5;
  const cy = height * 0.5;
  const maxDist = Math.sqrt(cx * cx + cy * cy) || 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const vr = gray + (r - gray) * 0.78 * satMod + tintR;
      const vg = gray + (g - gray) * 0.82 * satMod + tintG;
      const vb = gray + (b - gray) * 0.75 * satMod + tintB;

      const fr = vr + fade * (1 - clampFloat(vr / 255, 0, 1));
      const fg = vg + fade * (1 - clampFloat(vg / 255, 0, 1));
      const fb = vb + fade * (1 - clampFloat(vb / 255, 0, 1));

      r = r + (fr - r) * s + bright;
      g = g + (fg - g) * s + bright;
      b = b + (fb - b) * s + bright;

      if (vig > 0) {
        const dist = Math.hypot(x - cx, y - cy) / maxDist;
        const vFactor = 1 - Math.pow(clampFloat((dist - 0.35) / 0.65, 0, 1), 1.8) * vig * 0.65;
        r *= vFactor;
        g *= vFactor;
        b *= vFactor;
      }

      data[i] = clampByte(r);
      data[i + 1] = clampByte(g);
      data[i + 2] = clampByte(b);
    }
  }
}

function applyRetrolux(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: RetroluxParams
) {
  const s = params.styleStrength / 100;
  const leaks = params.lightLeaks / 100;
  const scratches = params.scratches / 100;
  const contrastFactor = 1 + (params.contrast / 100) * 0.9;
  const bright = params.brightness * 1.1;
  const satMod = 1 + params.saturation / 100;

  const scratchCols = new Set<number>();
  if (scratches > 0.05) {
    const count = Math.round(scratches * 14);
    for (let k = 1; k <= count; k++) {
      scratchCols.add((k * 173 + 47) % Math.max(10, width));
    }
  }

  for (let y = 0; y < height; y++) {
    const ny = y / height;
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const i = (y * width + x) * 4;
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      r = (r - 128) * contrastFactor + 128 + bright + s * 16;
      g = (g - 128) * contrastFactor + 128 + bright + s * 6;
      b = (b - 128) * contrastFactor + 128 + bright - s * 14;

      if (leaks > 0) {
        const leakOriginX = params.style === 'amberburn' ? 0.92 : 0.08;
        const leakOriginY = params.style === 'duststrip' ? 0.85 : 0.15;
        const d = Math.hypot(nx - leakOriginX, ny - leakOriginY);
        const glow = Math.max(0, 1 - d * 1.45) * leaks;
        r += glow * 135;
        g += glow * 68;
        b += glow * 18;
      }

      if (scratchCols.has(x) && (y * 13 + x) % 19 > 6) {
        const scratchAmt = scratches * 85;
        r += scratchAmt;
        g += scratchAmt;
        b += scratchAmt;
      }

      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i] = clampByte(gray + (r - gray) * satMod);
      data[i + 1] = clampByte(gray + (g - gray) * satMod);
      data[i + 2] = clampByte(gray + (b - gray) * satMod);
    }
  }
}

function applyNoir(data: Uint8ClampedArray, params: NoirParams) {
  const str = params.filterStrength / 100;
  const wash = params.wash * 0.65;
  const bright = params.brightness * 1.1;
  const grain = params.grain * 0.6;
  const contrastFactor =
    params.style === 'contrast'
      ? 1.55
      : params.style === 'deep'
      ? 1.75
      : params.style === 'wash'
      ? 1.1
      : 1.35;

  let seed = 9001;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    let lum = 0.34 * r + 0.54 * g + 0.12 * b;
    lum = (lum - 128) * contrastFactor + 128 + bright;
    lum = lum + wash * (1 - clampFloat(lum / 255, 0, 1));

    if (grain > 0) {
      seed = (seed * 1664525 + 1013904223) | 0;
      lum += (((seed >>> 16) & 0xff) / 255 - 0.5) * grain;
    }

    const mono = clampByte(lum);
    data[i] = clampByte(r * (1 - str) + mono * str);
    data[i + 1] = clampByte(g * (1 - str) + mono * str);
    data[i + 2] = clampByte(b * (1 - str) + mono * str);
  }
}

function applyBW(data: Uint8ClampedArray, params: BWParams) {
  let wr = 0.299;
  let wg = 0.587;
  let wb = 0.114;

  switch (params.filter) {
    case 'red':
      wr = 0.72;
      wg = 0.22;
      wb = 0.06;
      break;
    case 'orange':
      wr = 0.55;
      wg = 0.38;
      wb = 0.07;
      break;
    case 'yellow':
      wr = 0.42;
      wg = 0.49;
      wb = 0.09;
      break;
    case 'green':
      wr = 0.18;
      wg = 0.68;
      wb = 0.14;
      break;
  }

  const bright = params.brightness * 1.1;
  const contrastFactor =
    params.contrast >= 0
      ? 1 + (params.contrast / 100) * 1.4
      : 1 + (params.contrast / 100) * 0.75;
  const grain = params.grain * 0.55;

  let seed = 1337;
  for (let i = 0; i < data.length; i += 4) {
    let lum = wr * data[i] + wg * data[i + 1] + wb * data[i + 2];
    lum = (lum - 128) * contrastFactor + 128 + bright;
    if (grain > 0) {
      seed = (seed * 1664525 + 1013904223) | 0;
      lum += (((seed >>> 16) & 0xff) / 255 - 0.5) * grain;
    }
    const v = clampByte(lum);
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
}

function applyVignette(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: VignetteParams
) {
  const cx = params.centerX * width;
  const cy = params.centerY * height;
  const maxDist = Math.max(width, height) * 0.72;
  const innerR = (params.radius / 100) * maxDist * 0.45;
  const outerR = Math.max(innerR + 20, (params.radius / 100) * maxDist * 1.15);

  const outerShift = params.outerBrightness * 1.35;
  const innerShift = params.innerBrightness * 0.85;

  for (let y = 0; y < height; y++) {
    const dy = y - cy;
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const t = clampFloat((dist - innerR) / (outerR - innerR), 0, 1);
      const smooth = t * t * (3 - 2 * t);
      const shift = innerShift * (1 - smooth) + outerShift * smooth;

      const i = (y * width + x) * 4;
      data[i] = clampByte(data[i] + shift);
      data[i + 1] = clampByte(data[i + 1] + shift);
      data[i + 2] = clampByte(data[i + 2] + shift);
    }
  }
}

function applyGrain(data: Uint8ClampedArray, params: GrainParams) {
  const grain = params.grain * 0.65;
  const style = params.styleStrength / 100;
  let seed = 4242;

  for (let i = 0; i < data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) | 0;
    const noise = (((seed >>> 16) & 0xff) / 255 - 0.5) * grain;
    let r = data[i] + noise;
    let g = data[i + 1] + noise;
    let b = data[i + 2] + noise;

    if (style > 0) {
      r += style * 8;
      b -= style * 6;
      const lift = style * 14;
      r = r + lift * (1 - clampFloat(r / 255, 0, 1));
      g = g + lift * (1 - clampFloat(g / 255, 0, 1));
      b = b + lift * (1 - clampFloat(b / 255, 0, 1));
    }

    data[i] = clampByte(r);
    data[i + 1] = clampByte(g);
    data[i + 2] = clampByte(b);
  }
}

function applyLut3DPass(data: Uint8ClampedArray, params: Lut3DParams) {
  let lut: ParsedCubeLut | null = null;
  if (params.preset === 'custom' && params.customSize && params.customTable) {
    lut = {
      size: params.customSize,
      table: new Float32Array(params.customTable),
    };
  } else {
    lut = getBuiltInLut(params.preset);
  }
  if (!lut) return;
  applyTrilinearLut(data, lut, params.strength);
}

function applyDoubleExposure(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: DoubleExposureParams,
  overlayCache: Map<string, AnyImageSource>
) {
  const overlayImg = overlayCache.get(params.overlaySrc);
  if (!overlayImg) return;
  const {w: ovW, h: ovH} = getSourceDims(overlayImg);
  if (ovW === 0 || ovH === 0) return;

  const offCanvas = makeCanvas(width, height);
  const oCtx = get2dCtx(offCanvas, true);
  if (!oCtx) return;

  const scale = params.scale / 100;
  const imgAspect = ovW / ovH;
  const canvasAspect = width / height;
  let drawW = width * scale;
  let drawH = height * scale;
  if (imgAspect > canvasAspect) {
    drawW = drawH * imgAspect;
  } else {
    drawH = drawW / imgAspect;
  }
  const dx = (width - drawW) / 2 + (params.offsetX / 100) * width;
  const dy = (height - drawH) / 2 + (params.offsetY / 100) * height;
  oCtx.drawImage(overlayImg as CanvasImageSource, dx, dy, drawW, drawH);

  const oData = oCtx.getImageData(0, 0, width, height).data;
  const alpha = params.opacity / 100;

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const a = data[i + c];
      const b = oData[i + c];
      let blended = b;
      if (params.blendMode === 'add') {
        blended = Math.min(255, a + b);
      } else if (params.blendMode === 'multiply') {
        blended = (a * b) / 255;
      } else if (params.blendMode === 'screen') {
        blended = 255 - ((255 - a) * (255 - b)) / 255;
      } else if (params.blendMode === 'overlay') {
        blended = a < 128 ? (2 * a * b) / 255 : 255 - (2 * (255 - a) * (255 - b)) / 255;
      } else if (params.blendMode === 'lighten') {
        blended = Math.max(a, b);
      } else if (params.blendMode === 'darken') {
        blended = Math.min(a, b);
      }
      data[i + c] = clampByte(a * (1 - alpha) + blended * alpha);
    }
  }
}

function applyLayerMaskBlend(
  before: Uint8ClampedArray,
  after: Uint8ClampedArray,
  width: number,
  height: number,
  mask: LayerMask,
  showRubylith: boolean = false
) {
  const alphaMask = rasterizeStrokesMask(
    width,
    height,
    mask.strokes,
    mask.inverted ? 0 : 1
  );

  for (let idx = 0; idx < alphaMask.length; idx++) {
    const w = alphaMask[idx] / 255;
    const i = idx * 4;
    const r = before[i] * (1 - w) + after[i] * w;
    const g = before[i + 1] * (1 - w) + after[i + 1] * w;
    const b = before[i + 2] * (1 - w) + after[i + 2] * w;

    if (showRubylith && w > 0.05) {
      const ov = w * 0.42;
      after[i] = clampByte(r * (1 - ov) + 239 * ov);
      after[i + 1] = clampByte(g * (1 - ov) + 45 * ov);
      after[i + 2] = clampByte(b * (1 - ov) + 68 * ov);
    } else {
      after[i] = clampByte(r);
      after[i + 1] = clampByte(g);
      after[i + 2] = clampByte(b);
    }
  }
}

function applyTextOverlay(canvas: AnyCanvas, params: TextParams) {
  if (!params.content.trim()) return;
  const ctx = get2dCtx(canvas);
  if (!ctx) return;

  ctx.save();
  ctx.globalAlpha = clampFloat(params.opacity / 100, 0.05, 1);
  const scaleFactor = Math.min(canvas.width, canvas.height) / 720;
  const fontSize = Math.max(14, Math.round(params.size * scaleFactor));
  const x = params.x * canvas.width;
  const y = params.y * canvas.height;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (params.style === 'editorial') {
    ctx.font = `600 ${fontSize}px Georgia, "Times New Roman", serif`;
  } else if (params.style === 'stamp') {
    ctx.font = `600 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
  } else {
    ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
  }

  if (params.style === 'badge') {
    const metrics = ctx.measureText(params.content);
    const padX = fontSize * 0.65;
    const padY = fontSize * 0.38;
    const boxW = metrics.width + padX * 2;
    const boxH = fontSize + padY * 2;
    ctx.strokeStyle = params.color;
    ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.08));
    ctx.strokeRect(x - boxW / 2, y - boxH / 2, boxW, boxH);
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = Math.max(4, fontSize * 0.2);
  }

  ctx.fillStyle = params.color;
  ctx.fillText(params.content, x, y);
  ctx.restore();
}

function applyFrames(canvas: AnyCanvas, params: FramesParams): AnyCanvas {
  if (params.style === 'none') return canvas;
  const border = Math.max(4, Math.round((Math.min(canvas.width, canvas.height) * params.width) / 220));
  const bottomExtra = params.style === 'polaroid' ? border * 2.8 : border;

  const out = makeCanvas(canvas.width + border * 2, canvas.height + border + bottomExtra);
  const ctx = get2dCtx(out);
  if (!ctx) return canvas;

  if (params.style === 'thin-black' || params.style === 'film') {
    ctx.fillStyle = '#09090B';
  } else {
    ctx.fillStyle = '#F5F4F0';
  }
  ctx.fillRect(0, 0, out.width, out.height);

  if (params.style === 'film') {
    ctx.fillStyle = '#27272A';
    const holeW = Math.max(6, Math.round(border * 0.7));
    const holeH = Math.max(4, Math.round(border * 0.45));
    const step = holeW * 2.1;
    for (let x = border; x < out.width - border; x += step) {
      ctx.fillRect(x, Math.round(border * 0.25), holeW, holeH);
      ctx.fillRect(x, out.height - Math.round(border * 0.7), holeW, holeH);
    }
  }

  ctx.drawImage(canvas as CanvasImageSource, border, border);

  if (params.style === 'gallery-white') {
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(border - 0.5, border - 0.5, canvas.width + 1, canvas.height + 1);
  }

  return out;
}

export function computeHistogram(imageData: ImageData): HistogramData {
  const bins = 64;
  const r = new Array(bins).fill(0);
  const g = new Array(bins).fill(0);
  const b = new Array(bins).fill(0);
  const l = new Array(bins).fill(0);

  const data = imageData.data;
  let totalSampled = 0;
  let shadowClip = 0;
  let highlightClip = 0;

  for (let i = 0; i < data.length; i += 16) {
    const rv = data[i];
    const gv = data[i + 1];
    const bv = data[i + 2];
    const lv = Math.round(0.299 * rv + 0.587 * gv + 0.114 * bv);
    r[rv >> 2]++;
    g[gv >> 2]++;
    b[bv >> 2]++;
    l[lv >> 2]++;
    totalSampled++;
    if (rv <= 3 && gv <= 3 && bv <= 3) shadowClip++;
    if (rv >= 252 && gv >= 252 && bv >= 252) highlightClip++;
  }

  const maxVal = Math.max(1, ...r, ...g, ...b, ...l);
  for (let i = 0; i < bins; i++) {
    r[i] /= maxVal;
    g[i] /= maxVal;
    b[i] /= maxVal;
    l[i] /= maxVal;
  }

  return {
    r,
    g,
    b,
    l,
    shadowClipPct: totalSampled ? Number(((shadowClip / totalSampled) * 100).toFixed(1)) : 0,
    highlightClipPct: totalSampled ? Number(((highlightClip / totalSampled) * 100).toFixed(1)) : 0,
  };
}

function applyClippingZebra(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r >= 252 && g >= 252 && b >= 252) {
      data[i] = 239;
      data[i + 1] = 68;
      data[i + 2] = 68;
    } else if (r <= 3 && g <= 3 && b <= 3) {
      data[i] = 59;
      data[i + 1] = 130;
      data[i + 2] = 246;
    }
  }
}

export function renderEditPipeline(
  source: AnyImageSource,
  stack: EditStackStep[],
  maxDimension: number = 1050,
  options?: {
    activeToolId?: string | null;
    activeStepId?: string | null;
    showMaskOverlay?: boolean;
    showClippingOverlay?: boolean;
    overlayCache?: Map<string, AnyImageSource>;
    onProgress?: (pct: number) => void;
  }
): {canvas: AnyCanvas; originalCanvas: AnyCanvas; histogram: HistogramData} {
  const enabledSteps = stack.filter((s) => s.enabled);
  let cropParams: CropParams = {
    aspectRatio: 'free',
    rotation90: 0,
    straighten: 0,
    flipH: false,
    cropX: 0,
    cropY: 0,
    cropW: 1,
    cropH: 1,
  };
  let expandParams: ExpandParams | null = null;

  for (const step of enabledSteps) {
    if (step.toolId === 'crop') cropParams = step.params as CropParams;
    if (step.toolId === 'expand') expandParams = step.params as ExpandParams;
  }

  const skipCropRect = options?.activeToolId === 'crop';
  let baseCanvas = applyCropAndRotate(source, cropParams, maxDimension, skipCropRect);
  if (expandParams) {
    baseCanvas = applyExpand(baseCanvas, expandParams);
  }

  let originalCanvas = makeCanvas(baseCanvas.width, baseCanvas.height);
  const origCtx = get2dCtx(originalCanvas);
  if (origCtx) origCtx.drawImage(baseCanvas as CanvasImageSource, 0, 0);

  let ctx = get2dCtx(baseCanvas, true);
  if (!ctx) {
    return {
      canvas: baseCanvas,
      originalCanvas,
      histogram: {r: [], g: [], b: [], l: []},
    };
  }

  let imgData = ctx.getImageData(0, 0, baseCanvas.width, baseCanvas.height);
  let data = imgData.data;

  let frameStep: FramesParams | null = null;
  const textSteps: TextParams[] = [];
  const total = Math.max(1, enabledSteps.length);
  const allow2xUpscale = maxDimension === 0 || maxDimension >= 900;

  for (let idx = 0; idx < enabledSteps.length; idx++) {
    const step = enabledSteps[idx];
    options?.onProgress?.(Math.round(((idx + 0.5) / total) * 85));

    if (step.toolId === 'crop' || step.toolId === 'expand') continue;
    if (step.toolId === 'frames') {
      frameStep = step.params as FramesParams;
      continue;
    }
    if (step.toolId === 'text') {
      textSteps.push(step.params as TextParams);
      continue;
    }

    if (step.toolId === 'enhance') {
      const ep = step.params as EnhanceParams;
      if (ep.upscale === '2x' && allow2xUpscale && baseCanvas.width < 2200 && baseCanvas.height < 2200) {
        ctx.putImageData(imgData, 0, 0);
        baseCanvas = upscaleCanvasScale(baseCanvas, 2);
        originalCanvas = upscaleCanvasScale(originalCanvas, 2);
        const nextCtx = get2dCtx(baseCanvas, true);
        if (nextCtx) {
          ctx = nextCtx;
          imgData = ctx.getImageData(0, 0, baseCanvas.width, baseCanvas.height);
          data = imgData.data;
        }
      }
    }

    const hasMask = Boolean(step.mask && (step.mask.inverted || step.mask.strokes.length > 0));
    const beforeSnapshot = hasMask ? new Uint8ClampedArray(data) : null;
    const isActiveMaskOverlay =
      Boolean(options?.showMaskOverlay) && step.id === options?.activeStepId;

    switch (step.toolId) {
      case 'perspective':
        applyPerspective(data, baseCanvas.width, baseCanvas.height, step.params as PerspectiveParams);
        break;
      case 'tune':
        applyTuneImage(data, step.params as TuneParams);
        break;
      case 'whitebalance':
        applyWhiteBalance(data, step.params as WhiteBalanceParams);
        break;
      case 'curves':
        applyCurves(data, step.params as CurvesParams);
        break;
      case 'details':
        applyDetails(data, baseCanvas.width, baseCanvas.height, step.params as DetailsParams);
        break;
      case 'enhance':
        applyEnhance(data, baseCanvas.width, baseCanvas.height, step.params as EnhanceParams);
        break;
      case 'portrait':
        applyPortrait(data, baseCanvas.width, baseCanvas.height, step.params as PortraitParams);
        break;
      case 'hdrscape':
        applyHdrScape(data, baseCanvas.width, baseCanvas.height, step.params as HdrScapeParams);
        break;
      case 'tonalcontrast':
        applyTonalContrast(data, baseCanvas.width, baseCanvas.height, step.params as TonalContrastParams);
        break;
      case 'glamourglow':
        applyGlamourGlow(data, baseCanvas.width, baseCanvas.height, step.params as GlamourGlowParams);
        break;
      case 'lensblur':
        applyLensBlur(data, baseCanvas.width, baseCanvas.height, step.params as LensBlurParams);
        break;
      case 'healing':
        applyHealing(data, baseCanvas.width, baseCanvas.height, step.params as HealingParams);
        break;
      case 'remover':
        applyObjectRemover(data, baseCanvas.width, baseCanvas.height, step.params as RemoverParams);
        break;
      case 'brush':
        applyBrush(data, baseCanvas.width, baseCanvas.height, step.params as BrushParams);
        break;
      case 'selective':
        applySelective(
          data,
          baseCanvas.width,
          baseCanvas.height,
          step.params as SelectiveParams,
          isActiveMaskOverlay
        );
        break;
      case 'drama':
        applyDrama(data, step.params as DramaParams);
        break;
      case 'vintage':
        applyVintage(data, baseCanvas.width, baseCanvas.height, step.params as VintageParams);
        break;
      case 'retrolux':
        applyRetrolux(data, baseCanvas.width, baseCanvas.height, step.params as RetroluxParams);
        break;
      case 'noir':
        applyNoir(data, step.params as NoirParams);
        break;
      case 'bw':
        applyBW(data, step.params as BWParams);
        break;
      case 'lut3d':
        applyLut3DPass(data, step.params as Lut3DParams);
        break;
      case 'vignette':
        applyVignette(data, baseCanvas.width, baseCanvas.height, step.params as VignetteParams);
        break;
      case 'grain':
        applyGrain(data, step.params as GrainParams);
        break;
      case 'doubleexposure':
        if (options?.overlayCache) {
          applyDoubleExposure(
            data,
            baseCanvas.width,
            baseCanvas.height,
            step.params as DoubleExposureParams,
            options.overlayCache
          );
        }
        break;
    }

    if (beforeSnapshot && step.mask) {
      applyLayerMaskBlend(
        beforeSnapshot,
        data,
        baseCanvas.width,
        baseCanvas.height,
        step.mask,
        isActiveMaskOverlay
      );
    }
  }

  const histogram = computeHistogram(imgData);

  if (options?.showClippingOverlay) {
    applyClippingZebra(data);
  }

  ctx.putImageData(imgData, 0, 0);

  for (const txt of textSteps) {
    applyTextOverlay(baseCanvas, txt);
  }

  const finalCanvas = frameStep ? applyFrames(baseCanvas, frameStep) : baseCanvas;
  options?.onProgress?.(100);

  return {canvas: finalCanvas, originalCanvas, histogram};
}
