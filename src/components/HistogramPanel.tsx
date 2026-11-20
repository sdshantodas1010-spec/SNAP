import React from 'react';
import {AlertTriangle} from 'lucide-react';
import {ExifMetadata, HistogramData} from '../types/editor';

interface HistogramPanelProps {
  histogram: HistogramData;
  width: number;
  height: number;
  exif: ExifMetadata;
  showClippingOverlay: boolean;
  onToggleClippingOverlay: () => void;
}

function buildAreaPath(bins: number[], w: number, h: number): string {
  if (!bins.length) return '';
  const step = w / (bins.length - 1);
  let d = `M 0 ${h}`;
  for (let i = 0; i < bins.length; i++) {
    const x = i * step;
    const y = h - bins[i] * (h - 4);
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  d += ` L ${w} ${h} Z`;
  return d;
}

export const HistogramPanel: React.FC<HistogramPanelProps> = ({
  histogram,
  width,
  height,
  exif,
  showClippingOverlay,
  onToggleClippingOverlay,
}) => {
  const svgW = 240;
  const svgH = 68;

  const shadowPct = histogram.shadowClipPct ?? 0;
  const highlightPct = histogram.highlightClipPct ?? 0;

  const exifParts = [
    exif.isRaw ? 'RAW' : null,
    exif.camera,
    exif.focalLength,
    exif.aperture,
    exif.shutter,
    exif.iso,
  ].filter(Boolean);

  return (
    <div className="border-b border-[#222228] px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#A1A1AA]">Histogram</span>
          <button
            type="button"
            onClick={onToggleClippingOverlay}
            title="Toggle Shadow (Blue) & Highlight (Red) Clipping Warning (Key: J)"
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums border transition-colors cursor-pointer ${
              showClippingOverlay
                ? 'bg-[#EF4444]/15 border-[#EF4444]/60 text-[#FCA5A5]'
                : 'bg-[#141418] border-[#26262E] text-[#8E8E98] hover:text-[#E4E4E7]'
            }`}
          >
            <AlertTriangle className="w-2.5 h-2.5" />
            <span className="text-[#60A5FA]">{shadowPct}%</span>
            <span>/</span>
            <span className="text-[#F87171]">{highlightPct}%</span>
          </button>
        </div>
        <span className="text-xs font-mono tabular-nums text-[#71717A]">
          {width > 0 ? `${width} × ${height}` : '—'}
        </span>
      </div>

      <div className="relative bg-[#09090B] border border-[#222228] rounded-md overflow-hidden h-[68px]">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-full block" preserveAspectRatio="none">
          <line x1={svgW * 0.25} y1="0" x2={svgW * 0.25} y2={svgH} stroke="#1D1D22" strokeWidth="1" />
          <line x1={svgW * 0.5} y1="0" x2={svgW * 0.5} y2={svgH} stroke="#1D1D22" strokeWidth="1" />
          <line x1={svgW * 0.75} y1="0" x2={svgW * 0.75} y2={svgH} stroke="#1D1D22" strokeWidth="1" />

          {histogram.r.length > 0 && (
            <>
              <path d={buildAreaPath(histogram.r, svgW, svgH)} fill="rgba(239, 68, 68, 0.28)" />
              <path d={buildAreaPath(histogram.g, svgW, svgH)} fill="rgba(34, 197, 94, 0.26)" />
              <path d={buildAreaPath(histogram.b, svgW, svgH)} fill="rgba(59, 130, 246, 0.28)" />
              <path
                d={buildAreaPath(histogram.l, svgW, svgH)}
                fill="rgba(244, 244, 246, 0.14)"
                stroke="rgba(244, 244, 246, 0.55)"
                strokeWidth="1"
              />
            </>
          )}
        </svg>
      </div>

      {exifParts.length > 0 && (
        <p className="text-[11px] text-[#71717A] font-mono truncate">
          {exifParts.join(' · ')}
        </p>
      )}
    </div>
  );
};
