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
      ? 'bg-gradient-to-r from-[#3B82F6]/55 via-[#23232C] to-[#F59E0B]/65'
      : gradientTrack === 'tint'
      ? 'bg-gradient-to-r from-[#22C55E]/55 via-[#23232C] to-[#EC4899]/55'
      : gradientTrack === 'saturation'
      ? 'bg-gradient-to-r from-[#52525B] via-[#23232C] to-[#22C55E]/60'
      : 'bg-[#212129]';

  const fillLeft = isBipolar ? Math.min(pct, zeroPct) : 0;
  const fillWidth = isBipolar ? Math.abs(pct - zeroPct) : pct;

  const resetVal = Math.max(min, Math.min(max, defaultValue));

  return (
    <div
      onClick={onFocus}
      className={`rounded-xl px-3 py-2 transition-colors border ${
        isFocused
          ? 'bg-[#17171F] border-white/[0.08]'
          : 'bg-transparent border-transparent hover:bg-[#14141B]'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5 select-none">
        <button
          type="button"
          onDoubleClick={() => onChange(resetVal)}
          title="Double-click to reset"
          className={`text-xs font-medium text-left cursor-pointer transition-colors ${
            isFocused ? 'text-[#22C55E]' : 'text-[#E4E4EA] hover:text-white'
          }`}
        >
          {label}
        </button>
        <button
          type="button"
          onDoubleClick={() => onChange(resetVal)}
          title="Double-click to reset"
          className={`text-xs font-mono tabular-nums cursor-pointer px-1.5 py-0.5 rounded ${
            clamped !== resetVal
              ? 'text-[#F4F4F6] bg-white/[0.05]'
              : 'text-[#71717A]'
          }`}
        >
          {isBipolar && clamped > 0 ? `+${clamped}` : clamped}
        </button>
      </div>

      {/* Custom Precision Track (44px touch height via h-7 + padding) */}
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
        className="relative h-7 flex items-center cursor-ew-resize touch-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#22C55E] rounded-md"
      >
        <div className={`relative w-full h-[5px] rounded-full overflow-hidden ${trackBgClass}`}>
          {gradientTrack === 'none' && (
            <div
              style={{left: `${fillLeft}%`, width: `${fillWidth}%`}}
              className="absolute top-0 bottom-0 bg-[#22C55E]"
            />
          )}
          {isBipolar && (
            <div
              style={{left: `${zeroPct}%`}}
              className="absolute top-0 bottom-0 w-[1.5px] bg-white/40 -translate-x-1/2"
            />
          )}
        </div>

        {/* Machined Thumb */}
        <div
          style={{left: `${pct}%`}}
          className={`absolute -translate-x-1/2 w-4 h-4 rounded-full border-2 shadow-[0_2px_8px_rgba(0,0,0,0.75)] transition-transform ${
            isFocused
              ? 'bg-white border-[#22C55E] scale-110 ring-2 ring-[#22C55E]/25'
              : 'bg-[#E4E4E7] border-[#22C55E]'
          }`}
        />
      </div>
    </div>
  );
};
