import {decodeDngOrRawFile} from './dngLoader';
import {parseExifFromFile} from './exifParser';
import {AnyImageSource, renderEditPipeline} from './imageProcessor';
import {DoubleExposureParams, EditStackStep, ExifMetadata} from '../types/editor';

export interface LoadedImageFile {
  dataUrl: string;
  exif: ExifMetadata;
}

export async function loadAnyImageFile(file: File): Promise<LoadedImageFile> {
  const isRawExt = /\.(dng|tif|tiff)$/i.test(file.name);
  if (isRawExt) {
    const rawDecoded = await decodeDngOrRawFile(file);
    if (rawDecoded) {
      return rawDecoded;
    }
  }

  const parsedExif = await parseExifFromFile(file);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read image file'));
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });

  return {
    dataUrl,
    exif: isRawExt ? {...parsedExif, isRaw: true} : parsedExif,
  };
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src = src;
  });
}

function canvasToBlobAsync(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  format: 'image/jpeg' | 'image/png',
  quality: number
): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({type: format, quality});
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas export failed'));
      },
      format,
      quality
    );
  });
}

export async function exportImageWithWorker(
  source: HTMLImageElement,
  stack: EditStackStep[],
  format: 'image/jpeg' | 'image/png',
  quality: number,
  maxDimension: number = 0,
  overlayCache?: Map<string, HTMLImageElement>,
  onProgress?: (pct: number) => void
): Promise<{blob: Blob; width: number; height: number}> {
  const canUseWorker =
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof createImageBitmap !== 'undefined';

  if (canUseWorker) {
    try {
      const imageBitmap = await createImageBitmap(source);
      const overlays: Array<{src: string; bitmap: ImageBitmap}> = [];
      const transferables: Transferable[] = [imageBitmap];

      const neededOverlaySrcs = new Set<string>();
      for (const step of stack) {
        if (step.enabled && step.toolId === 'doubleexposure') {
          const src = (step.params as DoubleExposureParams).overlaySrc;
          if (src) neededOverlaySrcs.add(src);
        }
      }

      for (const src of neededOverlaySrcs) {
        let ovImg = overlayCache?.get(src);
        if (!ovImg) {
          ovImg = await loadImageElement(src);
        }
        const ovBitmap = await createImageBitmap(ovImg);
        overlays.push({src, bitmap: ovBitmap});
        transferables.push(ovBitmap);
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        const worker = new Worker(new URL('./renderWorker.ts', import.meta.url), {
          type: 'module',
        });
        const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        worker.onmessage = (e: MessageEvent<{id: string; type: string; pct?: number; blob?: Blob; message?: string}>) => {
          if (e.data.id !== id) return;
          if (e.data.type === 'progress' && typeof e.data.pct === 'number') {
            onProgress?.(e.data.pct);
          } else if (e.data.type === 'done' && e.data.blob) {
            worker.terminate();
            resolve(e.data.blob);
          } else if (e.data.type === 'error') {
            worker.terminate();
            reject(new Error(e.data.message || 'Worker render failed'));
          }
        };

        worker.onerror = (err) => {
          worker.terminate();
          reject(new Error(err.message || 'Worker error'));
        };

        worker.postMessage(
          {
            id,
            imageBitmap,
            stack,
            overlays,
            format,
            quality,
            maxDimension,
          },
          transferables
        );
      });

      return {
        blob,
        width: source.naturalWidth,
        height: source.naturalHeight,
      };
    } catch {
      // Fall back cleanly to main-thread rendering below
    }
  }

  const ovMap = new Map<string, AnyImageSource>();
  if (overlayCache) {
    overlayCache.forEach((v, k) => ovMap.set(k, v));
  }
  const result = renderEditPipeline(source, stack, maxDimension, {
    overlayCache: ovMap,
    onProgress,
  });
  const blob = await canvasToBlobAsync(result.canvas, format, quality);
  return {
    blob,
    width: result.canvas.width,
    height: result.canvas.height,
  };
}
