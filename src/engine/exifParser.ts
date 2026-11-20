import {ExifMetadata} from '../types/editor';

function getString(view: DataView, start: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    const code = view.getUint8(start + i);
    if (code === 0) break;
    out += String.fromCharCode(code);
  }
  return out.trim();
}

function readRational(view: DataView, offset: number, littleEndian: boolean): number {
  if (offset + 8 > view.byteLength) return 0;
  const num = view.getUint32(offset, littleEndian);
  const den = view.getUint32(offset + 4, littleEndian);
  return den === 0 ? 0 : num / den;
}

function readIFD(
  view: DataView,
  tiffStart: number,
  ifdOffset: number,
  littleEndian: boolean
): Record<number, {type: number; count: number; valueOffset: number; rawVal: number}> {
  const result: Record<number, {type: number; count: number; valueOffset: number; rawVal: number}> = {};
  const absOffset = tiffStart + ifdOffset;
  if (absOffset + 2 > view.byteLength) return result;
  const entries = view.getUint16(absOffset, littleEndian);

  for (let i = 0; i < entries; i++) {
    const entryOffset = absOffset + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;
    const tag = view.getUint16(entryOffset, littleEndian);
    const type = view.getUint16(entryOffset + 2, littleEndian);
    const count = view.getUint32(entryOffset + 4, littleEndian);
    const valueOffset = view.getUint32(entryOffset + 8, littleEndian);
    const rawVal =
      type === 3
        ? view.getUint16(entryOffset + 8, littleEndian)
        : view.getUint32(entryOffset + 8, littleEndian);
    result[tag] = {type, count, valueOffset, rawVal};
  }
  return result;
}

export async function parseExifFromFile(file: File): Promise<ExifMetadata> {
  try {
    const slice = file.slice(0, 131072); // first 128KB contains EXIF APP1
    const buffer = await slice.arrayBuffer();
    const view = new DataView(buffer);

    if (view.byteLength < 12 || view.getUint16(0, false) !== 0xffd8) {
      return {};
    }

    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      if (marker === 0xffe1) {
        if (getString(view, offset + 2, 4) === 'Exif') {
          const tiffStart = offset + 8;
          const endian = view.getUint16(tiffStart, false);
          const littleEndian = endian === 0x4949;
          const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
          const ifd0 = readIFD(view, tiffStart, firstIfdOffset, littleEndian);

          const meta: ExifMetadata = {};
          const make = ifd0[0x010f]
            ? getString(view, tiffStart + ifd0[0x010f].valueOffset, ifd0[0x010f].count)
            : '';
          const model = ifd0[0x0110]
            ? getString(view, tiffStart + ifd0[0x0110].valueOffset, ifd0[0x0110].count)
            : '';
          if (make || model) {
            meta.camera = model.toLowerCase().startsWith(make.toLowerCase())
              ? model
              : `${make} ${model}`.trim();
          }

          if (ifd0[0x8769]) {
            const exifIfd = readIFD(view, tiffStart, ifd0[0x8769].rawVal, littleEndian);
            if (exifIfd[0x8827]) {
              meta.iso = `ISO ${exifIfd[0x8827].rawVal}`;
            }
            if (exifIfd[0x829d]) {
              const f = readRational(view, tiffStart + exifIfd[0x829d].valueOffset, littleEndian);
              if (f > 0) meta.aperture = `f/${Number(f.toFixed(1))}`;
            }
            if (exifIfd[0x829a]) {
              const exp = readRational(view, tiffStart + exifIfd[0x829a].valueOffset, littleEndian);
              if (exp > 0) {
                meta.shutter = exp < 1 ? `1/${Math.round(1 / exp)}s` : `${exp.toFixed(1)}s`;
              }
            }
            if (exifIfd[0x920a]) {
              const fl = readRational(view, tiffStart + exifIfd[0x920a].valueOffset, littleEndian);
              if (fl > 0) meta.focalLength = `${Math.round(fl)}mm`;
            }
            if (exifIfd[0x9003]) {
              const dt = getString(
                view,
                tiffStart + exifIfd[0x9003].valueOffset,
                exifIfd[0x9003].count
              );
              if (dt) meta.dateTaken = dt.split(' ')[0].replace(/:/g, '-');
            }
          }
          return meta;
        }
        break;
      } else if ((marker & 0xff00) !== 0xff00) {
        break;
      } else {
        const size = view.getUint16(offset, false);
        offset += size;
      }
    }
  } catch {
    return {};
  }
  return {};
}
