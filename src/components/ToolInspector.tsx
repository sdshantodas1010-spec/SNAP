import React, {useState} from 'react';
import {
  RotateCcw,
  Trash2,
  FlipHorizontal,
  RotateCw,
  Pipette,
  Paintbrush,
  Eraser,
  Upload,
  Eye,
} from 'lucide-react';
import {SAMPLE_PHOTOS, TOOLS_CATALOG} from '../data/presets';
import {parseCubeLutText} from '../engine/lutParser';
import {
  AspectRatioOption,
  BrushMode,
  BrushParams,
  BuiltInLutId,
  BWFilter,
  BWParams,
  CropParams,
  CurvesParams,
  DoubleExposureBlend,
  DoubleExposureParams,
  EditStackStep,
  EnhanceParams,
  ExifMetadata,
  ExpandFillMode,
  ExpandParams,
  FramesParams,
  FrameStyle,
  HdrScapeParams,
  HdrStyle,
  HealingParams,
  HistogramData,
  LensBlurParams,
  LensBlurShape,
  Lut3DParams,
  NoirParams,
  NoirStyle,
  RemoverParams,
  RetroluxParams,
  RetroluxStyle,
  SelectiveParams,
  TextParams,
  TextStylePreset,
  VintageParams,
  VintageStyle,
  WhiteBalanceParams,
} from '../types/editor';
import {CurvesEditor} from './CurvesEditor';
import {HistogramPanel} from './HistogramPanel';
import {ProSlider} from './ProSlider';

interface ToolInspectorProps {
  activeStep: EditStackStep | null;
  histogram: HistogramData;
  imageWidth: number;
  imageHeight: number;
  exif: ExifMetadata;
  selectedParamKey: string;
  onSelectParamKey: (key: string) => void;
  onUpdateParams: (nextParams: Record<string, unknown>) => void;
  onResetStep: () => void;
  onDeleteStep: () => void;
  isMaskBrushMode: boolean;
  onToggleMaskBrushMode: () => void;
  maskBrushErase: boolean;
  onSetMaskBrushErase: (erase: boolean) => void;
  maskBrushSize: number;
  onSetMaskBrushSize: (size: number) => void;
  maskBrushOpacity: number;
  onSetMaskBrushOpacity: (opacity: number) => void;
  maskBrushHardness: number;
  onSetMaskBrushHardness: (hardness: number) => void;
  showMaskOverlay: boolean;
  onToggleMaskOverlay: () => void;
  showClippingOverlay: boolean;
  onToggleClippingOverlay: () => void;
  onInvertLayerMask: () => void;
  onClearLayerMask: () => void;
  onInteractionStateChange?: (interacting: boolean) => void;
}

const ASPECT_RATIOS: AspectRatioOption[] = ['free', '1:1', '4:3', '3:2', '16:9', '3:4'];
const EXPAND_MODES: {id: ExpandFillMode; label: string}[] = [
  {id: 'smart', label: 'Smart Mirror'},
  {id: 'white', label: 'White'},
  {id: 'black', label: 'Black'},
];
const BUILTIN_LUTS: {id: BuiltInLutId; label: string}[] = [
  {id: 'tealorange', label: 'Teal & Orange'},
  {id: 'kodak2383', label: 'Kodak 2383'},
  {id: 'fujieterna', label: 'Fuji Eterna'},
  {id: 'bleachbypass', label: 'Bleach Bypass'},
];
const VINTAGE_STYLES: {id: VintageStyle; label: string}[] = [
  {id: 'warm70', label: 'Warm 70s'},
  {id: 'coolfuji', label: 'Cool Fuji'},
  {id: 'retrofade', label: 'Retro Fade'},
  {id: 'kodachrome', label: 'Kodachrome'},
];
const BW_FILTERS: {id: BWFilter; label: string}[] = [
  {id: 'neutral', label: 'Neutral'},
  {id: 'red', label: 'Red'},
  {id: 'orange', label: 'Orange'},
  {id: 'yellow', label: 'Yellow'},
  {id: 'green', label: 'Green'},
];
const FRAME_STYLES: {id: FrameStyle; label: string}[] = [
  {id: 'none', label: 'None'},
  {id: 'thin-black', label: 'Thin Black'},
  {id: 'gallery-white', label: 'Gallery White'},
  {id: 'polaroid', label: 'Polaroid'},
  {id: 'film', label: '35mm Film'},
];
const HDR_STYLES: {id: HdrStyle; label: string}[] = [
  {id: 'nature', label: 'Nature'},
  {id: 'people', label: 'People'},
  {id: 'fine', label: 'Fine'},
  {id: 'strong', label: 'Strong'},
];
const RETROLUX_STYLES: {id: RetroluxStyle; label: string}[] = [
  {id: 'sunnyleak', label: 'Sunny Leak'},
  {id: 'amberburn', label: 'Amber Burn'},
  {id: 'duststrip', label: 'Dust Strip'},
  {id: 'vintage70', label: '70s Strip'},
];
const NOIR_STYLES: {id: NoirStyle; label: string}[] = [
  {id: 'silver', label: 'S01 Silver'},
  {id: 'contrast', label: 'S02 Contrast'},
  {id: 'wash', label: 'S03 Wash'},
  {id: 'deep', label: 'S04 Deep'},
];
const BRUSH_MODES: {id: BrushMode; label: string}[] = [
  {id: 'dodgeburn', label: 'Dodge & Burn'},
  {id: 'exposure', label: 'Exposure'},
  {id: 'temperature', label: 'Temperature'},
  {id: 'saturation', label: 'Saturation'},
  {id: 'eraser', label: 'Eraser'},
];
const BLEND_MODES: {id: DoubleExposureBlend; label: string}[] = [
  {id: 'screen', label: 'Screen'},
  {id: 'multiply', label: 'Multiply'},
  {id: 'overlay', label: 'Overlay'},
  {id: 'add', label: 'Add'},
  {id: 'lighten', label: 'Lighten'},
  {id: 'darken', label: 'Darken'},
];
const TEXT_STYLES: {id: TextStylePreset; label: string}[] = [
  {id: 'clean', label: 'Modern'},
  {id: 'editorial', label: 'Editorial'},
  {id: 'badge', label: 'Framed'},
  {id: 'stamp', label: 'Mono'},
];
const TEXT_COLORS = ['#F4F4F6', '#0B0B0D', '#FACC15', '#22C55E', '#38BDF8', '#FB7185'];

export const ToolInspector: React.FC<ToolInspectorProps> = ({
  activeStep,
  histogram,
  imageWidth,
  imageHeight,
  exif,
  selectedParamKey,
  onSelectParamKey,
  onUpdateParams,
  onResetStep,
  onDeleteStep,
  isMaskBrushMode,
  onToggleMaskBrushMode,
  maskBrushErase,
  onSetMaskBrushErase,
  maskBrushSize,
  onSetMaskBrushSize,
  maskBrushOpacity,
  onSetMaskBrushOpacity,
  maskBrushHardness,
  onSetMaskBrushHardness,
  showMaskOverlay,
  onToggleMaskOverlay,
  showClippingOverlay,
  onToggleClippingOverlay,
  onInvertLayerMask,
  onClearLayerMask,
  onInteractionStateChange,
}) => {
  const [lutParseError, setLutParseError] = useState<string | null>(null);

  const toolMeta = activeStep
    ? TOOLS_CATALOG.find((t) => t.id === activeStep.toolId)
    : null;

  const getGradientTrack = (key: string): 'temperature' | 'tint' | 'saturation' | 'none' => {
    if (key === 'temperature' || key === 'warmth') return 'temperature';
    if (key === 'tint') return 'tint';
    if (key === 'saturation') return 'saturation';
    return 'none';
  };

  return (
    <aside className="w-full lg:w-[318px] max-h-[38vh] lg:max-h-none shrink-0 border-t lg:border-t-0 lg:border-l border-[#222228] bg-[#0E0E11] flex flex-col overflow-hidden">
      <div className="hidden lg:block">
        <HistogramPanel
          histogram={histogram}
          width={imageWidth}
          height={imageHeight}
          exif={exif}
          showClippingOverlay={showClippingOverlay}
          onToggleClippingOverlay={onToggleClippingOverlay}
        />
      </div>

      <div className="flex-1 overflow-y-auto darkroom-scroll p-3.5 lg:p-4 space-y-4">
        {!activeStep || !toolMeta ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-sm font-medium text-[#D4D4DC]">No Active Tool</p>
            <p className="text-xs text-[#71717A] leading-relaxed">
              Select any tool from the drawer or pick a Look preset to start editing non-destructively.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-[#222228] pb-3">
              <div className="min-w-0 pr-2">
                <h2 className="font-display text-sm font-semibold text-[#F4F4F6] truncate">
                  {toolMeta.name}
                </h2>
                <p className="text-xs text-[#71717A] truncate">{toolMeta.shortDesc}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {toolMeta.supportsLayerMask && (
                  <button
                    type="button"
                    onClick={onToggleMaskBrushMode}
                    title="Paint selective layer mask (Snapseed View Edits Brush)"
                    className={`p-1.5 rounded transition-colors cursor-pointer ${
                      isMaskBrushMode
                        ? 'bg-[#22C55E] text-[#051B0C]'
                        : 'text-[#8E8E98] hover:text-[#F4F4F6] hover:bg-[#1B1B20]'
                    }`}
                  >
                    <Paintbrush className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onResetStep}
                  title="Reset tool parameters"
                  className="p-1.5 text-[#8E8E98] hover:text-[#F4F4F6] hover:bg-[#1B1B20] rounded transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onDeleteStep}
                  title="Remove layer from Edit Stack"
                  className="p-1.5 text-[#8E8E98] hover:text-[#EF4444] hover:bg-[#1B1B20] rounded transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Per-Layer Mask Brush Sub-panel */}
            {isMaskBrushMode && toolMeta.supportsLayerMask && (
              <div className="bg-[#141A16] border border-[#22C55E]/40 rounded-md p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#22C55E]">
                    Layer Mask Brush
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onToggleMaskOverlay}
                      title="Show Rubylith Red Mask Overlay"
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border cursor-pointer ${
                        showMaskOverlay
                          ? 'bg-[#EF4444]/20 border-[#EF4444] text-[#EF4444]'
                          : 'bg-[#18181D] border-[#26262E] text-[#A1A1AA]'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      <span>Overlay</span>
                    </button>
                    <button
                      type="button"
                      onClick={onToggleMaskBrushMode}
                      className="text-[11px] text-[#D4D4DC] hover:underline cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSetMaskBrushErase(false)}
                    className={`py-1.5 text-xs font-medium rounded border cursor-pointer ${
                      !maskBrushErase
                        ? 'bg-[#22C55E]/20 border-[#22C55E] text-[#22C55E]'
                        : 'bg-[#18181D] border-[#26262E] text-[#D4D4DC]'
                    }`}
                  >
                    Paint Effect
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetMaskBrushErase(true)}
                    className={`py-1.5 text-xs font-medium rounded border cursor-pointer ${
                      maskBrushErase
                        ? 'bg-[#EF4444]/20 border-[#EF4444] text-[#EF4444]'
                        : 'bg-[#18181D] border-[#26262E] text-[#D4D4DC]'
                    }`}
                  >
                    Erase Effect
                  </button>
                </div>

                <ProSlider
                  label="Brush Radius"
                  value={maskBrushSize}
                  min={2}
                  max={25}
                  defaultValue={10}
                  onChange={onSetMaskBrushSize}
                />
                <ProSlider
                  label="Flow / Opacity"
                  value={maskBrushOpacity}
                  min={10}
                  max={100}
                  defaultValue={100}
                  onChange={onSetMaskBrushOpacity}
                />
                <ProSlider
                  label="Hardness"
                  value={maskBrushHardness}
                  min={0}
                  max={100}
                  defaultValue={25}
                  onChange={onSetMaskBrushHardness}
                />

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={onInvertLayerMask}
                    className="py-1.5 text-[11px] font-medium bg-[#18181D] hover:bg-[#23232A] border border-[#26262E] text-[#D4D4DC] rounded cursor-pointer"
                  >
                    Invert Mask
                  </button>
                  <button
                    type="button"
                    onClick={onClearLayerMask}
                    className="py-1.5 text-[11px] font-medium bg-[#18181D] hover:bg-[#23232A] border border-[#26262E] text-[#D4D4DC] rounded cursor-pointer"
                  >
                    Clear Mask
                  </button>
                </div>
              </div>
            )}

            {/* White Balance Eyedropper */}
            {activeStep.toolId === 'whitebalance' && (
              <button
                type="button"
                onClick={() => {
                  const wb = activeStep.params as WhiteBalanceParams;
                  onUpdateParams({...wb, eyedropperActive: !wb.eyedropperActive});
                }}
                className={`w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded border cursor-pointer transition-colors ${
                  (activeStep.params as WhiteBalanceParams).eyedropperActive
                    ? 'bg-[#22C55E] border-[#22C55E] text-[#051B0C]'
                    : 'bg-[#16161B] hover:bg-[#1F1F26] border-[#26262E] text-[#D4D4DC]'
                }`}
              >
                <Pipette className="w-3.5 h-3.5" />
                <span>
                  {(activeStep.params as WhiteBalanceParams).eyedropperActive
                    ? 'Click Neutral Spot on Photo...'
                    : 'Pick Neutral Gray (Eyedropper)'}
                </span>
              </button>
            )}

            {/* Curves with live Histogram */}
            {activeStep.toolId === 'curves' && (
              <CurvesEditor
                params={activeStep.params as CurvesParams}
                histogramBins={histogram.l}
                onChange={(next) => onUpdateParams(next as unknown as Record<string, unknown>)}
              />
            )}

            {/* Expand Tool */}
            {activeStep.toolId === 'expand' && (
              <div>
                <span className="block text-xs font-medium text-[#A1A1AA] mb-2">
                  Canvas Fill Mode
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {EXPAND_MODES.map((m) => {
                    const ep = activeStep.params as ExpandParams;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onUpdateParams({...ep, fillMode: m.id})}
                        className={`py-1.5 px-2 text-xs font-medium rounded border cursor-pointer ${
                          ep.fillMode === m.id
                            ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                            : 'bg-[#16161B] border-[#26262E] text-[#D4D4DC]'
                        }`}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Portrait Tool Info */}
            {activeStep.toolId === 'portrait' && (
              <div className="bg-[#141418] border border-[#222228] rounded-md p-2.5 text-xs text-[#A1A1AA] leading-relaxed">
                Drag the <span className="text-[#22C55E] font-medium">Face Target</span> ring directly onto the subject&apos;s face for skin-aware smoothing &amp; spotlight.
              </div>
            )}

            {/* 3D LUT Tool */}
            {activeStep.toolId === 'lut3d' &&
              (() => {
                const lp = activeStep.params as Lut3DParams;
                return (
                  <div className="space-y-3">
                    <div>
                      <span className="block text-xs font-medium text-[#A1A1AA] mb-2">
                        Cinema Film 3D LUTs
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {BUILTIN_LUTS.map((lut) => (
                          <button
                            key={lut.id}
                            type="button"
                            onClick={() => {
                              setLutParseError(null);
                              onUpdateParams({...lp, preset: lut.id});
                            }}
                            className={`py-1.5 px-2 text-xs font-medium rounded border cursor-pointer ${
                              lp.preset === lut.id
                                ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                                : 'bg-[#16161B] border-[#26262E] text-[#D4D4DC]'
                            }`}
                          >
                            {lut.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded border border-dashed border-[#34343F] hover:border-[#22C55E] bg-[#141418] text-[#D4D4DC] cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5 text-[#22C55E]" />
                        <span className="truncate">
                          {lp.preset === 'custom' && lp.customName
                            ? `${lp.customName} (${lp.customSize}³)`
                            : 'Import Custom .cube 3D LUT'}
                        </span>
                        <input
                          type="file"
                          accept=".cube,.CUBE,text/plain"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const text = await file.text();
                            const parsed = parseCubeLutText(text);
                            if (!parsed) {
                              setLutParseError('Invalid .cube 3D LUT format');
                            } else {
                              setLutParseError(null);
                              onUpdateParams({
                                ...lp,
                                preset: 'custom',
                                customName: file.name,
                                customSize: parsed.size,
                                customTable: Array.from(parsed.table),
                              });
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {lutParseError && (
                        <p className="text-[11px] text-[#EF4444] mt-1">{lutParseError}</p>
                      )}
                    </div>
                  </div>
                );
              })()}

            {/* Crop & Rotate */}
            {activeStep.toolId === 'crop' && (
              <div className="space-y-4">
                <div>
                  <span className="block text-xs font-medium text-[#A1A1AA] mb-2">
                    Aspect Ratio (Locked on Drag)
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {ASPECT_RATIOS.map((ratio) => {
                      const crop = activeStep.params as CropParams;
                      const active = crop.aspectRatio === ratio;
                      return (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() =>
                            onUpdateParams({
                              ...crop,
                              aspectRatio: ratio,
                              cropX: 0,
                              cropY: 0,
                              cropW: 1,
                              cropH: 1,
                            })
                          }
                          className={`py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer uppercase ${
                            active
                              ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                              : 'bg-[#16161B] border-[#26262E] text-[#D4D4DC] hover:bg-[#1F1F26]'
                          }`}
                        >
                          {ratio}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const crop = activeStep.params as CropParams;
                      onUpdateParams({
                        ...crop,
                        rotation90: (crop.rotation90 + 90) % 360,
                      });
                    }}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium bg-[#16161B] hover:bg-[#1F1F26] border border-[#26262E] text-[#D4D4DC] rounded cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Rotate 90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const crop = activeStep.params as CropParams;
                      onUpdateParams({...crop, flipH: !crop.flipH});
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium border rounded cursor-pointer ${
                      (activeStep.params as CropParams).flipH
                        ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                        : 'bg-[#16161B] hover:bg-[#1F1F26] border-[#26262E] text-[#D4D4DC]'
                    }`}
                  >
                    <FlipHorizontal className="w-3.5 h-3.5" />
                    <span>Mirror</span>
                  </button>
                </div>
              </div>
            )}

            {/* Brush Tool */}
            {activeStep.toolId === 'brush' &&
              (() => {
                const bp = activeStep.params as BrushParams;
                return (
                  <div className="space-y-3">
                    <div>
                      <span className="block text-xs font-medium text-[#A1A1AA] mb-2">
                        Brush Type
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {BRUSH_MODES.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => onUpdateParams({...bp, activeMode: m.id})}
                            className={`py-1.5 px-2 text-xs font-medium rounded border cursor-pointer flex items-center justify-center gap-1.5 ${
                              bp.activeMode === m.id
                                ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                                : 'bg-[#16161B] border-[#26262E] text-[#D4D4DC]'
                            }`}
                          >
                            {m.id === 'eraser' && <Eraser className="w-3 h-3" />}
                            <span>{m.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {bp.activeMode !== 'eraser' && (
                      <div>
                        <span className="block text-xs font-medium text-[#A1A1AA] mb-2">
                          Stroke Strength
                        </span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[-10, -5, 5, 10].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => onUpdateParams({...bp, activeStrength: val})}
                              className={`py-1.5 text-xs font-mono rounded border cursor-pointer ${
                                bp.activeStrength === val
                                  ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                                  : 'bg-[#16161B] border-[#26262E] text-[#D4D4DC]'
                              }`}
                            >
                              {val > 0 ? `+${val}` : val}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {bp.strokes.length > 0 && (
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-[#8E8E98] font-mono">
                          {bp.strokes.length} painted strokes
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateParams({...bp, strokes: []})}
                          className="text-[#EF4444] hover:underline cursor-pointer"
                        >
                          Clear All
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

            {/* Healing Tool */}
            {activeStep.toolId === 'healing' &&
              (() => {
                const hp = activeStep.params as HealingParams;
                return (
                  <div className="bg-[#141418] border border-[#222228] rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#A1A1AA]">Healed Spots</span>
                      <span className="font-mono tabular-nums text-[#F4F4F6]">
                        {hp.spots.length}
                      </span>
                    </div>
                    {hp.spots.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onUpdateParams({...hp, spots: []})}
                        className="w-full py-1.5 text-xs font-medium text-[#EF4444] bg-[#1C1618] border border-[#3B2326] rounded cursor-pointer"
                      >
                        Clear All Healing Spots
                      </button>
                    )}
                  </div>
                );
              })()}

            {/* Pro Object Remover */}
            {activeStep.toolId === 'remover' &&
              (() => {
                const rp = activeStep.params as RemoverParams;
                return (
                  <div className="bg-[#141418] border border-[#222228] rounded-md p-3 space-y-2.5">
                    <p className="text-xs text-[#A1A1AA] leading-relaxed">
                      Paint over any unwanted object, pole, wire, or watermark directly on the photo to seamlessly inpaint &amp; remove it.
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#A1A1AA]">Erased Regions</span>
                      <span className="font-mono tabular-nums text-[#F4F4F6]">
                        {rp.regions.length}
                      </span>
                    </div>
                    {rp.regions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onUpdateParams({...rp, regions: []})}
                        className="w-full py-1.5 text-xs font-medium text-[#EF4444] bg-[#1C1618] border border-[#3B2326] rounded cursor-pointer"
                      >
                        Restore All Removed Regions
                      </button>
                    )}
                  </div>
                );
              })()}

            {/* Remini-Style HD Enhance */}
            {activeStep.toolId === 'enhance' &&
              (() => {
                const ep = activeStep.params as EnhanceParams;
                return (
                  <div className="space-y-2.5">
                    <span className="block text-xs font-medium text-[#A1A1AA]">
                      Super-Resolution Scale
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['1x', '2x'] as const).map((sc) => (
                        <button
                          key={sc}
                          type="button"
                          onClick={() => onUpdateParams({...ep, upscale: sc})}
                          className={`py-1.5 px-2 text-xs font-medium rounded border cursor-pointer ${
                            ep.upscale === sc
                              ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                              : 'bg-[#16161B] border-[#26262E] text-[#D4D4DC]'
                          }`}
                        >
                          {sc === '1x' ? '1x Original Size' : '2x HD Upscale'}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-[#71717A] leading-relaxed">
                      Removes compression blur &amp; noise while sharpening eyes, hair, and textures completely offline.
                    </p>
                  </div>
                );
              })()}

            {/* Lens Blur Shape */}
            {activeStep.toolId === 'lensblur' && (
              <div>
                <span className="block text-xs font-medium text-[#A1A1AA] mb-2">
                  Blur Geometry
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['circular', 'linear'] as LensBlurShape[]).map((sh) => {
                    const lb = activeStep.params as LensBlurParams;
                    return (
                      <button
                        key={sh}
                        type="button"
                        onClick={() => onUpdateParams({...lb, shape: sh})}
                        className={`py-1.5 text-xs font-medium rounded border capitalize cursor-pointer ${
                          lb.shape === sh
                            ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                            : 'bg-[#16161B] border-[#26262E] text-[#D4D4DC]'
                        }`}
                      >
                        {sh}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* HDR Scape Style */}
            {activeStep.toolId === 'hdrscape' && (
              <div>
                <span className="block text-xs font-medium text-[#A1A1AA] mb-2">
                  HDR Mode
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {HDR_STYLES.map((st) => {
                    const hdr = activeStep.params as HdrScapeParams;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => onUpdateParams({...hdr, style: st.id})}
                        className={`py-1.5 text-xs font-medium rounded border cursor-pointer ${
                          hdr.style === st.id
                            ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                            : 'bg-[#16161B] border-[#26262E] text-[#D4D4DC]'
                        }`}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Vintage Style */}
            {activeStep.toolId === 'vintage' && (
              <div>
                <span className="block text-xs font-medium text-[#A1A1AA] mb-2">
                  Film Emulation
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {VINTAGE_STYLES.map((st) => {
                    const vig = activeStep.params as VintageParams;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => onUpdateParams({...vig, style: st.id})}
                        className={`py-1.5 px-2 text-xs font-medium rounded border transition-colors cursor-pointer ${
                          vig.style === st.id
                            ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                            : 'bg-[#16161B] border-[#26262E] text-[#D4D4DC] hover:bg-[#1F1F26]'
                        }`}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Retrolux Style */}
            {activeStep.toolId === 'retrolux' && (
              <div>
                <span className="block text-xs font-medium text-[#A1A1AA] mb-2">
                  Analog Style
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {RETROLUX_STYLES.map((st) => {
                    const rx = activeStep.params as RetroluxParams;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => onUpdateParams({...rx, style: st.id})}
                        className={`py-1.5 px-2 text-xs font-medium rounded border cursor-pointer ${
                          rx.style === st.id
                            ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                            : 'bg-[#16161B] border-[#26262E] text-[#D4D4DC]'
                        }`}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Noir Style */}
            {activeStep.toolId === 'noir' && (
              <div>
                <span className="block text-xs font-medium text-[#A1A1AA] mb-2">
                  Noir Preset
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {NOIR_STYLES.map((st) => {
                    const np = activeStep.params as NoirParams;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => onUpdateParams({...np, style: st.id})}
                        className={`py-1.5 px-2 text-xs font-medium rounded border cursor-pointer ${
                          np.style === st.id
                            ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                            : 'bg-[#16161B] border-[#26262E] text-[#D4D4DC]'
                        }`}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* B&W Filter */}
            {activeStep.toolId === 'bw' && (
              <div>
                <span className="block text-xs font-medium text-[#A1A1AA] mb-2">
                  Color Lens Filter
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {BW_FILTERS.map((f) => {
                    const bw = activeStep.params as BWParams;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => onUpdateParams({...bw, filter: f.id})}
                        className={`py-1.5 px-2 text-xs font-medium rounded border transition-colors cursor-pointer ${
                          bw.filter === f.id
                            ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                            : 'bg-[#16161B] border-[#26262E] text-[#D4D4DC] hover:bg-[#1F1F26]'
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Double Exposure */}
            {activeStep.toolId === 'doubleexposure' &&
              (() => {
                const de = activeStep.params as DoubleExposureParams;
                return (
                  <div className="space-y-3">
                    <div>
                      <span className="block text-xs font-medium text-[#A1A1AA] mb-2">
                        Overlay Photo
                      </span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {SAMPLE_PHOTOS.map((sp) => (
                          <button
                            key={sp.id}
                            type="button"
                            onClick={() => onUpdateParams({...de, overlaySrc: sp.src})}
                            className={`aspect-square rounded overflow-hidden border cursor-pointer ${
                              de.overlaySrc === sp.src
                                ? 'border-[#22C55E]'
                                : 'border-[#26262E] opacity-75'
                            }`}
                          >
                            <img
                              src={sp.src}
                              alt={sp.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                        <label className="aspect-square rounded border border-dashed border-[#3A3A44] flex flex-col items-center justify-center text-[#A1A1AA] hover:text-white cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          <span className="text-[10px] mt-0.5">File</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const url = URL.createObjectURL(file);
                                onUpdateParams({...de, overlaySrc: url});
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-medium text-[#A1A1AA] mb-2">
                        Blend Mode
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {BLEND_MODES.map((bm) => (
                          <button
                            key={bm.id}
                            type="button"
                            onClick={() => onUpdateParams({...de, blendMode: bm.id})}
                            className={`py-1.5 text-xs font-medium rounded border cursor-pointer ${
                              de.blendMode === bm.id
                                ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                                : 'bg-[#16161B] border-[#26262E] text-[#D4D4DC]'
                            }`}
                          >
                            {bm.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

            {/* Text Overlay */}
            {activeStep.toolId === 'text' &&
              (() => {
                const tp = activeStep.params as TextParams;
                return (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                        Text Content
                      </label>
                      <input
                        type="text"
                        value={tp.content}
                        onChange={(e) => onUpdateParams({...tp, content: e.target.value})}
                        placeholder="Enter caption..."
                        className="w-full px-3 py-2 text-xs bg-[#141418] border border-[#26262E] rounded text-[#F4F4F6] focus:outline-none focus:border-[#22C55E]"
                      />
                    </div>

                    <div>
                      <span className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                        Typography Style
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {TEXT_STYLES.map((ts) => (
                          <button
                            key={ts.id}
                            type="button"
                            onClick={() => onUpdateParams({...tp, style: ts.id})}
                            className={`py-1.5 text-xs font-medium rounded border cursor-pointer ${
                              tp.style === ts.id
                                ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                                : 'bg-[#16161B] border-[#26262E] text-[#D4D4DC]'
                            }`}
                          >
                            {ts.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-medium text-[#A1A1AA] mb-1.5">
                        Ink Color
                      </span>
                      <div className="flex items-center gap-2">
                        {TEXT_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => onUpdateParams({...tp, color: c})}
                            style={{backgroundColor: c}}
                            className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                              tp.color === c ? 'border-[#22C55E] scale-110' : 'border-[#2C2C34]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

            {/* Frame Styles */}
            {activeStep.toolId === 'frames' && (
              <div>
                <span className="block text-xs font-medium text-[#A1A1AA] mb-2">
                  Frame Style
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {FRAME_STYLES.map((fr) => {
                    const fp = activeStep.params as FramesParams;
                    return (
                      <button
                        key={fr.id}
                        type="button"
                        onClick={() => onUpdateParams({...fp, style: fr.id})}
                        className={`py-1.5 px-2 text-xs font-medium rounded border transition-colors cursor-pointer ${
                          fp.style === fr.id
                            ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                            : 'bg-[#16161B] border-[#26262E] text-[#D4D4DC] hover:bg-[#1F1F26]'
                        }`}
                      >
                        {fr.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selective U-Point controls vs Standard ProSliders */}
            {activeStep.toolId === 'selective' ? (
              (() => {
                const sel = activeStep.params as SelectiveParams;
                const activePt =
                  sel.points.find((p) => p.id === sel.activePointId) || sel.points[0];
                if (!activePt) return null;

                const updatePt = (key: string, val: number) => {
                  const nextPts = sel.points.map((pt) =>
                    pt.id === activePt.id ? {...pt, [key]: val} : pt
                  );
                  onUpdateParams({...sel, points: nextPts});
                };

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#A1A1AA]">
                        Edge-Aware U-Points
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={onToggleMaskOverlay}
                          title="Show Rubylith Mask Overlay"
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border cursor-pointer ${
                            showMaskOverlay
                              ? 'bg-[#EF4444]/20 border-[#EF4444] text-[#EF4444]'
                              : 'bg-[#18181D] border-[#26262E] text-[#A1A1AA]'
                          }`}
                        >
                          <Eye className="w-3 h-3" />
                          <span>Mask</span>
                        </button>
                        {sel.points.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const remaining = sel.points.filter((p) => p.id !== activePt.id);
                              onUpdateParams({
                                points: remaining,
                                activePointId: remaining[0]?.id ?? null,
                              });
                            }}
                            className="text-xs text-[#EF4444] hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {sel.points.map((pt, i) => (
                        <button
                          key={pt.id}
                          type="button"
                          onClick={() => onUpdateParams({...sel, activePointId: pt.id})}
                          className={`px-2.5 py-1 text-xs font-mono rounded border cursor-pointer ${
                            pt.id === activePt.id
                              ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]'
                              : 'bg-[#16161B] border-[#26262E] text-[#D4D4DC]'
                          }`}
                        >
                          Point {i + 1}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1">
                      {toolMeta.parameters.map((p) => (
                        <ProSlider
                          key={p.key}
                          label={p.label}
                          value={Number((activePt as unknown as Record<string, number>)[p.key] ?? 0)}
                          min={p.min}
                          max={p.max}
                          defaultValue={p.key === 'radius' ? 28 : p.key === 'tolerance' ? 45 : 0}
                          isFocused={selectedParamKey === p.key}
                          gradientTrack={getGradientTrack(p.key)}
                          onFocus={() => onSelectParamKey(p.key)}
                          onChange={(val) => updatePt(p.key, val)}
                          onInteractionStart={() => onInteractionStateChange?.(true)}
                          onInteractionEnd={() => onInteractionStateChange?.(false)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="space-y-1">
                {toolMeta.parameters.map((p) => (
                  <ProSlider
                    key={p.key}
                    label={p.label}
                    value={Number(
                      (activeStep.params as unknown as Record<string, unknown>)[p.key] ?? 0
                    )}
                    min={p.min}
                    max={p.max}
                    defaultValue={
                      p.key === 'scale' || p.key === 'opacity'
                        ? 100
                        : p.key === 'hardness'
                        ? 25
                        : p.min > 0
                        ? p.min
                        : 0
                    }
                    isFocused={selectedParamKey === p.key}
                    gradientTrack={getGradientTrack(p.key)}
                    onFocus={() => onSelectParamKey(p.key)}
                    onChange={(val) => onUpdateParams({...activeStep.params, [p.key]: val})}
                    onInteractionStart={() => onInteractionStateChange?.(true)}
                    onInteractionEnd={() => onInteractionStateChange?.(false)}
                  />
                ))}
              </div>
            )}

            <p className="text-[11px] text-[#52525B] pt-1">
              Tip: Double-click any parameter label to reset it to default.
            </p>
          </>
        )}
      </div>
    </aside>
  );
};
