import {EditStackStep} from '../types/editor';
import {AnyImageSource, renderEditPipeline} from './imageProcessor';

export interface WorkerRenderRequest {
  id: string;
  imageBitmap: ImageBitmap;
  stack: EditStackStep[];
  overlays: Array<{src: string; bitmap: ImageBitmap}>;
  format: 'image/jpeg' | 'image/png';
  quality: number;
  maxDimension: number;
}

self.onmessage = async (e: MessageEvent<WorkerRenderRequest>) => {
  const {id, imageBitmap, stack, overlays, format, quality, maxDimension} = e.data;
  try {
    const overlayCache = new Map<string, AnyImageSource>();
    for (const ov of overlays) {
      overlayCache.set(ov.src, ov.bitmap);
    }

    const result = renderEditPipeline(imageBitmap, stack, maxDimension, {
      overlayCache,
      onProgress: (pct) => {
        self.postMessage({id, type: 'progress', pct});
      },
    });

    const outCanvas = result.canvas;
    let blob: Blob;
    if ('convertToBlob' in outCanvas) {
      blob = await outCanvas.convertToBlob({type: format, quality});
    } else {
      throw new Error('OffscreenCanvas convertToBlob unavailable');
    }

    self.postMessage({id, type: 'done', blob});
  } catch (err) {
    self.postMessage({
      id,
      type: 'error',
      message: err instanceof Error ? err.message : 'Worker export failed',
    });
  }
};
