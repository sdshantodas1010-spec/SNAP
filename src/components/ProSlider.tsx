import React, {useRef} from 'react';

interface ProSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue?: number;
  isFocused?: boolean;
  gradientTrack?: 'temperature' | 'tint' | 'saturation' | 'none';
  onFocus?: () => void;
  onChange: (value: number) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

export const ProSlider: React.FC<ProSliderProps> = ({
  label,
  value,
  min,
  max,
  defaultValue = 0,
  isFocused = false,
  gradientTrack = 'none',
  onFocus,
  onChange,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const isBipolar = min < 0 && max > 0;
  const clamped = Math.max(min, Math.min(max, value));
  const pct = ((clamped - min) / (max - min)) * 100;
  const zeroPct = isBipolar ? ((0 - min) / (max - min)) * 100 : 0;

  const updateFromClientX = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const next = Math.round(min + ratio * (max - min));
    onChange(next);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    onFocus?.();
    draggingRef.current = true;
    onInteractionStart?.();
    updateFromClientX(e.clientX);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    onInteractionEnd?.();
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const trackBgClass =
    gradientTrack === 'temperature'
      ? 'bg-gradient-to-r from-[#3B82F6]/45 via-[#27272E] to-[#F59E0B]/55'
      : gradientTrack === 'tint'
      ? 'bg-gradient-to-r from-[#22C55E]/45 via-[#27272E] to-[#EC4899]/45'
      : gradientTrack === 'saturation'
      ? 'bg-gradient-to-r from-[#52525B] via-[#27272E] to-[#22C55E]/50'
      : 'bg-[#23232A]';

  const fillLeft = isBipolar ? Math.min(pct, zeroPct) : 0;
  const fillWidth = isBipolar ? Math.abs(pct - zeroPct) : pct;

  const resetVal = Math.max(min, Math.min(max, defaultValue));

  return (
    <div
      onClick={onFocus}
      className={`rounded-md px-2.5 py-2 transition-colors ${
        isFocused ? 'bg-[#17171D]' : 'hover:bg-[#131318]'
      }`}
    >
      <div className="flex items-center justify-between mb-2 select-none">
        <button
          type="button"
          onDoubleClick={() => onChange(resetVal)}
          title="Double-click to reset"
          className={`text-xs font-medium text-left cursor-pointer transition-colors ${
            isFocused ? 'text-[#22C55E]' : 'text-[#D4D4DC] hover:text-white'
          }`}
        >
          {label}
        </button>
        <button
          type="button"
          onDoubleClick={() => onChange(resetVal)}
          title="Double-click to reset"
          className={`text-xs font-mono tabular-nums cursor-pointer ${
            clamped !== resetVal ? 'text-[#F4F4F6]' : 'text-[#71717A]'
          }`}
        >
          {isBipolar && clamped > 0 ? `+${clamped}` : clamped}
        </button>
      </div>

      {/* Custom Precision Track */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clamped}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            onChange(Math.min(max, clamped + 1));
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            onChange(Math.max(min, clamped - 1));
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative h-5 flex items-center cursor-ew-resize touch-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#22C55E] rounded"
      >
        <div className={`relative w-full h-[4px] rounded-full overflow-hidden ${trackBgClass}`}>
          {gradientTrack === 'none' && (
            <div
              style={{left: `${fillLeft}%`, width: `${fillWidth}%`}}
              className="absolute top-0 bottom-0 bg-[#22C55E]"
            />
          )}
          {isBipolar && (
            <div
              style={{left: `${zeroPct}%`}}
              className="absolute top-0 bottom-0 w-[1px] bg-white/35 -translate-x-1/2"
            />
          )}
        </div>

        {/* Thumb */}
        <div
          style={{left: `${pct}%`}}
          className={`absolute -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 shadow-md transition-transform ${
            isFocused
              ? 'bg-white border-[#22C55E] scale-110'
              : 'bg-[#E4E4E7] border-[#22C55E]'
          }`}
        />
      </div>
    </div>
  );
};
