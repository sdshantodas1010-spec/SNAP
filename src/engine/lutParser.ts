import {BuiltInLutId} from '../types/editor';

export interface ParsedCubeLut {
  size: number;
  table: Float32Array; // length = size^3 * 3
}

export function parseCubeLutText(text: string): ParsedCubeLut | null {
  const lines = text.split(/\r?\n/);
  let size = 0;
  const values: number[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('TITLE') || line.startsWith('DOMAIN_MIN') || line.startsWith('DOMAIN_MAX')) {
      continue;
    }
    if (line.startsWith('LUT_3D_SIZE')) {
      const parts = line.split(/\s+/);
      size = parseInt(parts[1] || '0', 10);
      continue;
    }
    const nums = line.split(/\s+/).map(Number);
    if (nums.length >= 3 && !Number.isNaN(nums[0]) && !Number.isNaN(nums[1]) && !Number.isNaN(nums[2])) {
      values.push(nums[0], nums[1], nums[2]);
    }
  }

  if (size < 2 || values.length < size * size * size * 3) {
    return null;
  }

  return {
    size,
    table: new Float32Array(values.slice(0, size * size * size * 3)),
  };
}

const BUILTIN_LUT_CACHE = new Map<BuiltInLutId, ParsedCubeLut>();

export function getBuiltInLut(id: BuiltInLutId): ParsedCubeLut | null {
  if (id === 'custom') return null;
  const cached = BUILTIN_LUT_CACHE.get(id);
  if (cached) return cached;

  const size = 17;
  const table = new Float32Array(size * size * size * 3);
  let idx = 0;

  // Note: standard .cube ordering iterates B (outer) -> G -> R (inner)
  for (let bi = 0; bi < size; bi++) {
    const b = bi / (size - 1);
    for (let gi = 0; gi < size; gi++) {
      const g = gi / (size - 1);
      for (let ri = 0; ri < size; ri++) {
        const r = ri / (size - 1);
        let nr = r;
        let ng = g;
        let nb = b;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        if (id === 'tealorange') {
          // Cool cyan-teal shadows, warm golden-orange highlights
          const shadowW = Math.pow(1 - lum, 1.5);
          const highW = Math.pow(lum, 1.3);
          nr = r + highW * 0.14 - shadowW * 0.08;
          ng = g + shadowW * 0.03 + highW * 0.02;
          nb = b + shadowW * 0.14 - highW * 0.12;
        } else if (id === 'kodak2383') {
          // Classic Kodak 2383 print film curve: deep rich blacks, warm midtones, crisp contrast
          const s = (v: number) => v * v * (3 - 2 * v);
          nr = s(r) * 1.03;
          ng = s(g) * 0.99;
          nb = s(b) * 0.94 + (1 - lum) * 0.04;
        } else if (id === 'fujieterna') {
          // Soft matte cine film: lifted shadows, muted saturation, cool-green tint
          const gray = lum;
          nr = gray + (r - gray) * 0.82;
          ng = gray + (g - gray) * 0.86 + 0.02;
          nb = gray + (b - gray) * 0.84 + 0.015;
          nr = 0.05 + nr * 0.91;
          ng = 0.055 + ng * 0.91;
          nb = 0.06 + nb * 0.91;
        } else if (id === 'bleachbypass') {
          // Desaturated high-contrast silver-retention cinema look
          const sLum = lum * lum * (3 - 2 * lum);
          nr = r * 0.42 + sLum * 0.58;
          ng = g * 0.42 + sLum * 0.58;
          nb = b * 0.42 + sLum * 0.58;
        }

        table[idx++] = Math.max(0, Math.min(1, nr));
        table[idx++] = Math.max(0, Math.min(1, ng));
        table[idx++] = Math.max(0, Math.min(1, nb));
      }
    }
  }

  const lut = {size, table};
  BUILTIN_LUT_CACHE.set(id, lut);
  return lut;
}

// Fast trilinear 3D LUT sampling
export function applyTrilinearLut(
  data: Uint8ClampedArray,
  lut: ParsedCubeLut,
  strengthPct: number
) {
  const s = strengthPct / 100;
  if (s <= 0.005) return;

  const size = lut.size;
  const maxIdx = size - 1;
  const tbl = lut.table;
  const strideG = size;
  const strideB = size * size;

  const sample = (r: number, g: number, b: number, c: number) => {
    const idx = (b * strideB + g * strideG + r) * 3 + c;
    return tbl[idx] ?? 0;
  };

  for (let i = 0; i < data.length; i += 4) {
    const rf = (data[i] / 255) * maxIdx;
    const gf = (data[i + 1] / 255) * maxIdx;
    const bf = (data[i + 2] / 255) * maxIdx;

    const r0 = Math.min(maxIdx - 1, rf | 0);
    const g0 = Math.min(maxIdx - 1, gf | 0);
    const b0 = Math.min(maxIdx - 1, bf | 0);
    const r1 = r0 + 1;
    const g1 = g0 + 1;
    const b1 = b0 + 1;

    const dr = rf - r0;
    const dg = gf - g0;
    const db = bf - b0;

    for (let c = 0; c < 3; c++) {
      const c00 = sample(r0, g0, b0, c) * (1 - dr) + sample(r1, g0, b0, c) * dr;
      const c10 = sample(r0, g1, b0, c) * (1 - dr) + sample(r1, g1, b0, c) * dr;
      const c01 = sample(r0, g0, b1, c) * (1 - dr) + sample(r1, g0, b1, c) * dr;
      const c11 = sample(r0, g1, b1, c) * (1 - dr) + sample(r1, g1, b1, c) * dr;

      const c0 = c00 * (1 - dg) + c10 * dg;
      const c1 = c01 * (1 - dg) + c11 * dg;
      const out = (c0 * (1 - db) + c1 * db) * 255;

      const orig = data[i + c];
      const blended = orig * (1 - s) + out * s;
      data[i + c] = blended < 0 ? 0 : blended > 255 ? 255 : blended | 0;
    }
  }
}
