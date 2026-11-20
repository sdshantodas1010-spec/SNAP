import {ExifMetadata} from '../types/editor';

// Lightweight browser TIFF/DNG parser that locates embedded full-size JPEG previews or uncompressed RGB IFDs inside DNG files
export async function decodeDngOrRawFile(
  file: File
): Promise<{dataUrl: string; exif: ExifMetadata} | null> {
  try {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    if (view.byteLength < 16) return null;

    const byteOrder = view.getUint16(0, false);
    const isLE = byteOrder === 0x4949;
    if (!isLE && byteOrder !== 0x4d4d) return null;

    const magic = view.getUint16(2, isLE);
    if (magic !== 42) return null;

    const exif: ExifMetadata = {isRaw: true};

    // Scan TIFF for embedded JPEG preview (SOI 0xFF 0xD8 ... EOI 0xFF 0xD9) choosing the largest JPEG stream (full-size DNG preview)
    const bytes = new Uint8Array(buffer);
    let bestStart = -1;
    let bestEnd = -1;
    let bestLen = 0;

    for (let i = 8; i < bytes.length - 4; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
        // Scan forward for matching EOI marker
        let end = -1;
        for (let j = i + 4; j < bytes.length - 1; j++) {
          if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
            end = j + 2;
            // Keep scanning slightly in case embedded thumbnails exist inside EXIF, pick largest reasonable block
            if (end - i > 8000) break;
          }
        }
        if (end > i && end - i > bestLen) {
          bestLen = end - i;
          bestStart = i;
          bestEnd = end;
        }
      }
    }

    // Parse basic IFD0 camera make/model
    const firstIfd = view.getUint32(4, isLE);
    if (firstIfd > 0 && firstIfd + 2 < view.byteLength) {
      const entries = view.getUint16(firstIfd, isLE);
      for (let e = 0; e < entries; e++) {
        const off = firstIfd + 2 + e * 12;
        if (off + 12 > view.byteLength) break;
        const tag = view.getUint16(off, isLE);
        const count = view.getUint32(off + 4, isLE);
        const valOff = view.getUint32(off + 8, isLE);
        if ((tag === 0x010f || tag === 0x0110) && valOff + count < view.byteLength) {
          let s = '';
          for (let k = 0; k < Math.min(64, count); k++) {
            const c = bytes[valOff + k];
            if (c === 0) break;
            s += String.fromCharCode(c);
          }
          if (tag === 0x0110 && s.trim()) exif.camera = s.trim();
        }
      }
    }

    if (bestStart !== -1 && bestEnd > bestStart && bestLen > 4096) {
      const jpegBlob = new Blob([bytes.subarray(bestStart, bestEnd)], {
        type: 'image/jpeg',
      });
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(jpegBlob);
      });
      return {dataUrl, exif};
    }

    return null;
  } catch {
    return null;
  }
}
