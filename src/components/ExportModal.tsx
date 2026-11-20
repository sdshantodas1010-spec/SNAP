import React, {useEffect, useState} from 'react';
import {Download, X, Layers, Image as ImageIcon, CheckCircle2, Loader2} from 'lucide-react';
import {renderEditPipeline} from '../engine/imageProcessor';
import {exportImageWithWorker, loadAnyImageFile, loadImageElement} from '../engine/workerExport';
import {EditStackStep} from '../types/editor';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceImage: HTMLImageElement | null;
  editStack: EditStackStep[];
  overlayCache: Map<string, HTMLImageElement>;
  sourceWidth: number;
  sourceHeight: number;
  stackCount: number;
}

interface BatchItem {
  id: string;
  file: File;
  status: 'queued' | 'processing' | 'done' | 'error';
  progress: number;
  sizeLabel?: string;
  downloadUrl?: string;
  downloadName?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  sourceImage,
  editStack,
  overlayCache,
  sourceWidth,
  sourceHeight,
  stackCount,
}) => {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [format, setFormat] = useState<'image/jpeg' | 'image/png'>('image/jpeg');
  const [quality, setQuality] = useState(92);

  const [estimatedSize, setEstimatedSize] = useState<string>('Estimating...');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  // Live file size estimation whenever modal is open or format/quality changes
  useEffect(() => {
    if (!isOpen || !sourceImage || mode !== 'single') return;
    let cancelled = false;
    setEstimatedSize('Estimating...');

    const timer = setTimeout(() => {
      const proxyMax = 900;
      const proxy = renderEditPipeline(sourceImage, editStack, proxyMax);
      const scaleArea =
        (sourceWidth * sourceHeight) / Math.max(1, proxy.canvas.width * proxy.canvas.height);

      if ('toBlob' in proxy.canvas) {
        proxy.canvas.toBlob(
          (blob) => {
            if (cancelled || !blob) return;
            const estBytes = Math.round(blob.size * Math.max(1, scaleArea * 0.88));
            setEstimatedSize(`~${formatBytes(estBytes)}`);
          },
          format,
          quality / 100
        );
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, sourceImage, editStack, format, quality, sourceWidth, sourceHeight, mode]);

  if (!isOpen) return null;

  const handleSingleDownload = async () => {
    if (!sourceImage || isExporting) return;
    setIsExporting(true);
    setExportProgress(5);
    try {
      const {blob} = await exportImageWithWorker(
        sourceImage,
        editStack,
        format,
        quality / 100,
        0,
        overlayCache,
        (pct) => setExportProgress(pct)
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `chitro-pro-edit.${format === 'image/png' ? 'png' : 'jpg'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      setIsExporting(false);
      onClose();
    } catch {
      setIsExporting(false);
    }
  };

  const handleAddBatchFiles = (files: FileList | null) => {
    if (!files) return;
    const added: BatchItem[] = Array.from(files).map((file, idx) => ({
      id: `batch-${Date.now()}-${idx}`,
      file,
      status: 'queued',
      progress: 0,
    }));
    setBatchItems((prev) => [...prev, ...added]);
  };

  const handleRunBatch = async () => {
    if (isBatchRunning || batchItems.length === 0) return;
    setIsBatchRunning(true);
    const ext = format === 'image/png' ? 'png' : 'jpg';

    for (const item of batchItems) {
      if (item.status === 'done') continue;
      setBatchItems((prev) =>
        prev.map((b) => (b.id === item.id ? {...b, status: 'processing', progress: 5} : b))
      );

      try {
        const loaded = await loadAnyImageFile(item.file);
        const img = await loadImageElement(loaded.dataUrl);
        const {blob} = await exportImageWithWorker(
          img,
          editStack,
          format,
          quality / 100,
          0,
          overlayCache,
          (pct) => {
            setBatchItems((prev) =>
              prev.map((b) => (b.id === item.id ? {...b, progress: pct} : b))
            );
          }
        );

        const url = URL.createObjectURL(blob);
        const baseName = item.file.name.replace(/\.[^.]+$/, '');
        const downloadName = `${baseName}-chitro.${ext}`;

        const link = document.createElement('a');
        link.href = url;
        link.download = downloadName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setBatchItems((prev) =>
          prev.map((b) =>
            b.id === item.id
              ? {
                  ...b,
                  status: 'done',
                  progress: 100,
                  sizeLabel: formatBytes(blob.size),
                  downloadUrl: url,
                  downloadName,
                }
              : b
          )
        );
      } catch {
        setBatchItems((prev) =>
          prev.map((b) => (b.id === item.id ? {...b, status: 'error', progress: 0} : b))
        );
      }
    }
    setIsBatchRunning(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={() => !isExporting && !isBatchRunning && onClose()}
    >
      <div
        className="w-full max-w-lg bg-[#121218] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <h2 className="font-display text-base font-semibold text-[#F4F4F6]">
            Darkroom Render &amp; Export
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting || isBatchRunning}
            className="p-1.5 text-[#8E8E98] hover:text-[#F4F4F6] rounded-lg cursor-pointer disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-1.5 bg-[#09090D] p-1 rounded-xl border border-white/[0.07]">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg cursor-pointer ${
                mode === 'single' ? 'bg-[#191922] text-[#F4F4F6]' : 'text-[#8E8E98]'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Single Photo</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('batch')}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg cursor-pointer ${
                mode === 'batch' ? 'bg-[#191922] text-[#F4F4F6]' : 'text-[#8E8E98]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Batch Apply ({batchItems.length})</span>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {mode === 'single' ? (
            <div className="space-y-2 border-b border-[#222228] pb-3 text-xs">
              <div className="flex items-center justify-between text-[#A1A1AA]">
                <span>Output Resolution</span>
                <span className="font-mono tabular-nums text-[#F4F4F6]">
                  {sourceWidth} × {sourceHeight} px · {stackCount} layers
                </span>
              </div>
              <div className="flex items-center justify-between text-[#A1A1AA]">
                <span>Estimated File Size</span>
                <span className="font-mono tabular-nums text-[#22C55E]">{estimatedSize}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 border-b border-[#222228] pb-4">
              <label className="w-full flex flex-col items-center justify-center py-4 px-3 border border-dashed border-[#34343F] hover:border-[#22C55E] rounded-md bg-[#0B0B0D] cursor-pointer text-center">
                <span className="text-xs font-medium text-[#E4E4E7]">
                  Select Multiple Photos (JPEG / PNG / DNG)
                </span>
                <span className="text-[11px] text-[#71717A] mt-0.5">
                  Applies your current {stackCount}-layer edit stack to every selected photo
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*,.dng,.DNG,.tif,.tiff"
                  className="hidden"
                  onChange={(e) => {
                    handleAddBatchFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>

              {batchItems.length > 0 && (
                <div className="max-h-36 overflow-y-auto darkroom-scroll space-y-1.5">
                  {batchItems.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between px-3 py-2 bg-[#16161B] border border-[#23232A] rounded text-xs"
                    >
                      <span className="truncate text-[#E4E4E7] max-w-[200px]">
                        {b.file.name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {b.status === 'queued' && (
                          <span className="text-[11px] font-mono text-[#71717A]">Queued</span>
                        )}
                        {b.status === 'processing' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#22C55E]">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {b.progress}%
                          </span>
                        )}
                        {b.status === 'done' && (
                          <a
                            href={b.downloadUrl}
                            download={b.downloadName}
                            className="inline-flex items-center gap-1 text-[11px] font-mono text-[#22C55E] hover:underline"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{b.sizeLabel}</span>
                          </a>
                        )}
                        {b.status === 'error' && (
                          <span className="text-[11px] font-mono text-[#EF4444]">Failed</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <span className="block text-xs font-medium text-[#A1A1AA] mb-2">File Format</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat('image/jpeg')}
                className={`py-2 px-3 text-xs font-medium rounded border cursor-pointer ${
                  format === 'image/jpeg'
                    ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                    : 'bg-[#18181D] border-[#26262E] text-[#D4D4DC]'
                }`}
              >
                JPEG (Compressed)
              </button>
              <button
                type="button"
                onClick={() => setFormat('image/png')}
                className={`py-2 px-3 text-xs font-medium rounded border cursor-pointer ${
                  format === 'image/png'
                    ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                    : 'bg-[#18181D] border-[#26262E] text-[#D4D4DC]'
                }`}
              >
                PNG (Lossless)
              </button>
            </div>
          </div>

          {format === 'image/jpeg' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-[#A1A1AA]">JPEG Quality</span>
                <span className="text-xs font-mono tabular-nums text-[#F4F4F6]">
                  {quality}%
                </span>
              </div>
              <input
                type="range"
                min={60}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="darkroom-slider"
              />
            </div>
          )}

          {isExporting && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#22C55E]">
                <span>Rendering in Background Worker...</span>
                <span>{exportProgress}%</span>
              </div>
              <div className="h-1.5 w-full bg-[#1C1C22] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#22C55E] transition-all duration-150"
                  style={{width: `${exportProgress}%`}}
                />
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 bg-[#0E0E11] border-t border-[#222228] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting || isBatchRunning}
            className="px-4 py-2 text-xs font-medium text-[#A1A1AA] hover:text-[#F4F4F6] cursor-pointer disabled:opacity-40"
          >
            Close
          </button>
          {mode === 'single' ? (
            <button
              type="button"
              onClick={handleSingleDownload}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#22C55E] hover:bg-[#1EB054] text-[#051B0C] rounded-md cursor-pointer disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isExporting ? `Exporting ${exportProgress}%` : 'Download Full-Res'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunBatch}
              disabled={isBatchRunning || batchItems.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#22C55E] hover:bg-[#1EB054] text-[#051B0C] rounded-md cursor-pointer disabled:opacity-40"
            >
              {isBatchRunning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Layers className="w-3.5 h-3.5" />
              )}
              <span>
                {isBatchRunning ? 'Processing Batch...' : `Render & Download (${batchItems.length})`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
