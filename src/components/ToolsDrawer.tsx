import React, {useState} from 'react';
import {
  Sliders,
  Sparkles,
  TrendingUp,
  SunMedium,
  Crop,
  Maximize2,
  Expand,
  Target,
  Paintbrush,
  Bandage,
  ScanFace,
  CircleDot,
  Aperture,
  Zap,
  Layers,
  Sun,
  Flame,
  Film,
  Sparkle,
  Moon,
  Contrast,
  Grip,
  Palette,
  Blend,
  Type,
  Frame,
  Eraser,
  Wand2,
} from 'lucide-react';
import {SAMPLE_PHOTOS, ToolCategory, TOOLS_CATALOG} from '../data/presets';
import {ToolId} from '../types/editor';

interface ToolsDrawerProps {
  activeToolId: ToolId | null;
  appliedToolIds: Set<ToolId>;
  activePhotoSrc: string;
  onSelectTool: (toolId: ToolId) => void;
  onSelectSample: (src: string, meta: string) => void;
}

const TOOL_ICONS: Record<ToolId, React.ComponentType<{className?: string}>> = {
  tune: Sliders,
  details: Sparkles,
  curves: TrendingUp,
  whitebalance: SunMedium,
  crop: Crop,
  perspective: Maximize2,
  expand: Expand,
  selective: Target,
  brush: Paintbrush,
  healing: Bandage,
  remover: Eraser,
  enhance: Wand2,
  portrait: ScanFace,
  lensblur: Aperture,
  hdrscape: Zap,
  tonalcontrast: Layers,
  glamourglow: Sun,
  drama: Flame,
  vintage: Film,
  retrolux: Sparkle,
  noir: Moon,
  bw: Contrast,
  grain: Grip,
  lut3d: Palette,
  doubleexposure: Blend,
  vignette: CircleDot,
  text: Type,
  frames: Frame,
};

const CATEGORIES: Array<'All' | ToolCategory> = [
  'All',
  'Essentials',
  'Geometry',
  'Retouch',
  'Creative',
  'Finishing',
];

export const ToolsDrawer: React.FC<ToolsDrawerProps> = ({
  activeToolId,
  appliedToolIds,
  activePhotoSrc,
  onSelectTool,
  onSelectSample,
}) => {
  const [catFilter, setCatFilter] = useState<'All' | ToolCategory>('All');

  const visibleTools =
    catFilter === 'All'
      ? TOOLS_CATALOG
      : TOOLS_CATALOG.filter((t) => t.category === catFilter);

  return (
    <aside className="w-full lg:w-[262px] shrink-0 border-b lg:border-b-0 lg:border-r border-[#222228] bg-[#0E0E11] flex flex-col overflow-hidden">
      <div className="px-3.5 py-2 lg:py-2.5 border-b border-[#222228] flex items-center justify-between">
        <h2 className="font-display text-xs font-semibold text-[#D4D4DC]">
          Darkroom Tools
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex lg:hidden items-center gap-1">
            {SAMPLE_PHOTOS.map((photo, idx) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => onSelectSample(photo.src, photo.cameraMeta)}
                title={photo.title}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded border cursor-pointer ${
                  activePhotoSrc === photo.src
                    ? 'border-[#22C55E] text-[#22C55E] bg-[#22C55E]/10'
                    : 'border-[#26262E] text-[#8E8E98]'
                }`}
              >
                S{idx + 1}
              </button>
            ))}
          </div>
          <span className="text-[11px] font-mono tabular-nums text-[#71717A]">
            {TOOLS_CATALOG.length} tools
          </span>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="px-3 py-1.5 lg:py-2 border-b border-[#222228] flex items-center gap-1 overflow-x-auto no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCatFilter(cat)}
            className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              catFilter === cat
                ? 'bg-[#22C55E]/15 text-[#22C55E]'
                : 'text-[#8E8E98] hover:text-[#E4E4E7]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Mobile: Compact horizontal tool strip | Desktop: 2-column vertical grid */}
      <div className="flex-none lg:flex-1 overflow-x-auto lg:overflow-y-auto darkroom-scroll p-2 lg:p-3">
        <div className="flex lg:grid lg:grid-cols-2 gap-1.5 min-w-max lg:min-w-0">
          {visibleTools.map((tool) => {
            const Icon = TOOL_ICONS[tool.id];
            const isSelected = activeToolId === tool.id;
            const isApplied = appliedToolIds.has(tool.id);

            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => onSelectTool(tool.id)}
                title={tool.shortDesc}
                className={`group relative flex flex-col items-start gap-1 lg:gap-1.5 px-2.5 py-2 lg:p-2.5 rounded-md border text-left transition-all cursor-pointer shrink-0 w-[92px] lg:w-auto ${
                  isSelected
                    ? 'bg-[#1A241E] border-[#22C55E] text-[#F4F4F6]'
                    : 'bg-[#141418] border-[#222228] text-[#D4D4DC] hover:bg-[#1A1A20] hover:border-[#32323A]'
                }`}
              >
                <div className="w-full flex items-center justify-between">
                  <Icon
                    className={`w-4 h-4 ${
                      isSelected
                        ? 'text-[#22C55E]'
                        : isApplied
                        ? 'text-[#E4E4E7]'
                        : 'text-[#8E8E98] group-hover:text-[#D4D4DC]'
                    }`}
                  />
                  {isApplied && (
                    <span className="text-[10px] font-mono text-[#22C55E]">On</span>
                  )}
                </div>
                <span className="text-[11px] font-medium leading-tight truncate w-full">
                  {tool.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sample Photos Strip (Desktop sidebar footer) */}
      <div className="hidden lg:block border-t border-[#222228] p-3 space-y-2 bg-[#0B0B0D]">
        <span className="block text-xs font-medium text-[#A1A1AA]">
          Sample Negatives
        </span>
        <div className="grid grid-cols-3 gap-2">
          {SAMPLE_PHOTOS.map((photo) => {
            const isActive = activePhotoSrc === photo.src;
            return (
              <button
                key={photo.id}
                type="button"
                onClick={() => onSelectSample(photo.src, photo.cameraMeta)}
                title={`${photo.title} (${photo.cameraMeta})`}
                className={`relative aspect-[4/3] rounded overflow-hidden border transition-all cursor-pointer ${
                  isActive
                    ? 'border-[#22C55E] ring-1 ring-[#22C55E]'
                    : 'border-[#26262E] opacity-75 hover:opacity-100'
                }`}
              >
                <img
                  src={photo.src}
                  alt={photo.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
