import React, {useRef, useState} from 'react';
import {buildCurveLUT} from '../engine/imageProcessor';
import {CurveChannel, CurvePoint, CurvesParams} from '../types/editor';

interface CurvesEditorProps {
  params: CurvesParams;
  histogramBins?: number[];
  onChange: (next: CurvesParams) => void;
}

const CHANNELS: {id: CurveChannel; label: string; stroke: string}[] = [
  {id: 'rgb', label: 'RGB', stroke: '#F4F4F6'},
  {id: 'r', label: 'Red', stroke: '#EF4444'},
  {id: 'g', label: 'Green', stroke: '#22C55E'},
  {id: 'b', label: 'Blue', stroke: '#3B82F6'},
];

const CURVE_PRESETS: {label: string; points: CurvePoint[]}[] = [
  {
    label: 'Linear',
    points: [
      {x: 0, y: 0},
      {x: 255, y: 255},
    ],
  },
  {
    label: 'Soft S',
    points: [
      {x: 0, y: 0},
      {x: 64, y: 54},
      {x: 192, y: 204},
      {x: 255, y: 255},
    ],
  },
  {
    label: 'Hard S',
    points: [
      {x: 0, y: 0},
      {x: 64, y: 42},
      {x: 192, y: 218},
      {x: 255, y: 255},
    ],
  },
  {
    label: 'Fade',
    points: [
      {x: 0, y: 28},
      {x: 72, y: 78},
      {x: 190, y: 196},
      {x: 255, y: 242},
    ],
  },
];

function buildHistogramBackdrop(bins: number[], size: number): string {
  if (!bins.length) return '';
  const step = size / (bins.length - 1);
  let d = `M 0 ${size}`;
  for (let i = 0; i < bins.length; i++) {
    const x = i * step;
    const y = size - bins[i] * (size * 0.85);
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  d += ` L ${size} ${size} Z`;
  return d;
}

export const CurvesEditor: React.FC<CurvesEditorProps> = ({
  params,
  histogramBins = [],
  onChange,
}) => {
  const [channel, setChannel] = useState<CurveChannel>('rgb');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const activePoints = [...params[channel]].sort((a, b) => a.x - b.x);
  const lut = buildCurveLUT(activePoints);
  const activeChannelMeta = CHANNELS.find((c) => c.id === channel)!;

  const size = 220;
  const toSvgX = (x: number) => (x / 255) * size;
  const toSvgY = (y: number) => size - (y / 255) * size;

  let pathD = '';
  for (let i = 0; i < 256; i += 3) {
    const sx = toSvgX(i);
    const sy = toSvgY(lut[i]);
    pathD += i === 0 ? `M ${sx} ${sy}` : ` L ${sx} ${sy}`;
  }
  pathD += ` L ${toSvgX(255)} ${toSvgY(lut[255])}`;

  const getCoordFromEvent = (e: React.PointerEvent<SVGSVGElement>): CurvePoint => {
    const rect = svgRef.current!.getBoundingClientRect();
    const rx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ry = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    return {x: Math.round(rx * 255), y: Math.round(ry * 255)};
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const pt = getCoordFromEvent(e);
    const hitIdx = activePoints.findIndex(
      (p) => Math.hypot(p.x - pt.x, p.y - pt.y) < 18
    );

    if (hitIdx !== -1) {
      setDragIdx(hitIdx);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }

    if (activePoints.length < 7) {
      const next = [...activePoints, pt].sort((a, b) => a.x - b.x);
      const newIdx = next.findIndex((p) => p.x === pt.x && p.y === pt.y);
      onChange({...params, [channel]: next});
      setDragIdx(newIdx);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragIdx === null) return;
    const pt = getCoordFromEvent(e);
    const updated = [...activePoints];
    const isFirst = dragIdx === 0;
    const isLast = dragIdx === updated.length - 1;

    const minX = isFirst ? 0 : updated[dragIdx - 1].x + 6;
    const maxX = isLast ? 255 : updated[dragIdx + 1].x - 6;

    updated[dragIdx] = {
      x: isFirst ? 0 : isLast ? 255 : Math.max(minX, Math.min(maxX, pt.x)),
      y: pt.y,
    };
    onChange({...params, [channel]: updated});
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragIdx !== null) {
      setDragIdx(null);
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
    }
  };

  const handlePointDoubleClick = (idx: number) => {
    if (idx === 0 || idx === activePoints.length - 1) return;
    const next = activePoints.filter((_, i) => i !== idx);
    onChange({...params, [channel]: next});
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 p-1 bg-[#141418] rounded-md border border-[#222228]">
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setChannel(c.id)}
            className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              channel === c.id
                ? 'bg-[#27272E] text-[#F4F4F6]'
                : 'text-[#8E8E98] hover:text-[#D4D4DC]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="relative bg-[#09090B] border border-[#222228] rounded-md p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${size} ${size}`}
          className="w-full aspect-square touch-none cursor-crosshair select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Live Histogram Backdrop */}
          {histogramBins.length > 0 && (
            <path
              d={buildHistogramBackdrop(histogramBins, size)}
              fill="rgba(244, 244, 246, 0.09)"
            />
          )}

          {/* 4x4 darkroom grid */}
          {[0.25, 0.5, 0.75].map((t) => (
            <React.Fragment key={t}>
              <line
                x1={size * t}
                y1={0}
                x2={size * t}
                y2={size}
                stroke="#1E1E24"
                strokeWidth="1"
              />
              <line
                x1={0}
                y1={size * t}
                x2={size}
                y2={size * t}
                stroke="#1E1E24"
                strokeWidth="1"
              />
            </React.Fragment>
          ))}
          <line
            x1={0}
            y1={size}
            x2={size}
            y2={0}
            stroke="#27272E"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          <path
            d={pathD}
            fill="none"
            stroke={activeChannelMeta.stroke}
            strokeWidth="2"
            strokeLinecap="round"
          />

          {activePoints.map((pt, idx) => (
            <circle
              key={`${idx}-${pt.x}`}
              cx={toSvgX(pt.x)}
              cy={toSvgY(pt.y)}
              r={dragIdx === idx ? 6 : 4.5}
              fill="#0B0B0D"
              stroke={activeChannelMeta.stroke}
              strokeWidth="2"
              className="cursor-grab active:cursor-grabbing"
              onDoubleClick={(e) => {
                e.stopPropagation();
                handlePointDoubleClick(idx);
              }}
            />
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {CURVE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange({...params, [channel]: structuredClone(preset.points)})}
            className="py-1.5 px-2 text-xs font-medium bg-[#18181D] hover:bg-[#23232A] text-[#D4D4DC] rounded border border-[#26262E] transition-colors cursor-pointer whitespace-nowrap"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-[#71717A]">
        Click curve to add node · Double-click interior node to remove
      </p>
    </div>
  );
};
