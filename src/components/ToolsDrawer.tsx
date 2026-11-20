import React, {useMemo, useState} from 'react';
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
  Search,
  X,
  LayoutGrid,
  Columns2,
} from 'lucide-react';
import {SAMPLE_PHOTOS, ToolCategory, TOOLS_CATALOG} from '../data/presets';
import {ToolId} from '../types/editor';

interface ToolsDrawerProps {
  activeToolId: ToolId | null;
  appliedToolIds: Set<ToolId>;
  activePhotoSrc: string;
  onSelectTool: (toolId: ToolId) => void;
  onSelectSample: (src: string, meta: string) => void;
  isMobileSheetOpen: boolean;
  onCloseMobileSheet: () => void;
}

export const TOOL_ICONS: Record<ToolId, React.ComponentType<{className?: string}>> = {
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
  isMobileSheetOpen,
  onCloseMobileSheet,
}) => {
  const [catFilter, setCatFilter] = useState<'All' | ToolCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [desktopDenseGrid, setDesktopDenseGrid] = useState(true);

  const visibleTools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return TOOLS_CATALOG.filter((tool) => {
      const matchesCat = catFilter === 'All' || tool.category === catFilter;
      const matchesQuery =
        !q ||
        tool.name.toLowerCase().includes(q) ||
        tool.shortDesc.toLowerCase().includes(q) ||
        tool.category.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [catFilter, searchQuery]);

  const handlePickTool = (toolId: ToolId) => {
    onSelectTool(toolId);
    onCloseMobileSheet();
  };

  return (
    <>
      {/* Desktop: Left Obsidian Tool Matrix */}
      <aside className="hidden lg:flex w-[300px] xl:w-[322px] shrink-0 border-r border-white/[0.07] bg-[#0C0C10] flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <h2 className="font-display text-sm font-semibold text-[#F4F4F6]">Tools</h2>
            <span className="text-[11px] font-mono tabular-nums text-[#71717A]">
              {visibleTools.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDesktopDenseGrid((v) => !v)}
            title={desktopDenseGrid ? 'Switch to 2-column detailed view' : 'Switch to 3-column icon matrix'}
            className="p-1.5 rounded-lg text-[#8E8E98] hover:text-[#F4F4F6] hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            {desktopDenseGrid ? (
              <Columns2 className="w-3.5 h-3.5" />
            ) : (
              <LayoutGrid className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Search Input */}
        <div className="px-3.5 pt-2.5 pb-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find tool (e.g. Enhance, Curves)..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#14141B] border border-white/[0.07] rounded-lg text-[#F4F4F6] placeholder-[#646470] focus:outline-none focus:border-[#22C55E]/70 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-[#F4F4F6] cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-3.5 pb-2.5 border-b border-white/[0.07] flex items-center gap-1 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCatFilter(cat)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                catFilter === cat
                  ? 'bg-[#22C55E]/15 text-[#22C55E]'
                  : 'text-[#8E8E98] hover:text-[#E4E4E7] hover:bg-white/[0.04]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Tool Matrix */}
        <div className="flex-1 overflow-y-auto darkroom-scroll p-3">
          {visibleTools.length === 0 ? (
            <div className="py-10 text-center space-y-1.5">
              <p className="text-xs font-medium text-[#D4D4DC]">No matching tool</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCatFilter('All');
                }}
                className="text-xs text-[#22C55E] hover:underline cursor-pointer"
              >
                Show all 28 tools
              </button>
            </div>
          ) : (
            <div
              className={`grid gap-2 ${
                desktopDenseGrid ? 'grid-cols-3' : 'grid-cols-2'
              }`}
            >
              {visibleTools.map((tool) => {
                const Icon = TOOL_ICONS[tool.id];
                const isSelected = activeToolId === tool.id;
                const isApplied = appliedToolIds.has(tool.id);

                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => handlePickTool(tool.id)}
                    title={tool.shortDesc}
                    className={`group relative flex flex-col items-center justify-center gap-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                      desktopDenseGrid ? 'px-1.5 py-2.5 min-h-[78px]' : 'px-2.5 py-3 min-h-[76px]'
                    } ${
                      isSelected
                        ? 'bg-[#17211B] border-[#22C55E]/70 text-[#F4F4F6] shadow-[0_0_20px_rgba(34,197,94,0.08)]'
                        : 'bg-[#13131A] border-white/[0.06] text-[#D4D4DC] hover:bg-[#191922] hover:border-white/[0.14]'
                    }`}
                  >
                    {isApplied && (
                      <span className="absolute top-1.5 right-2 text-[9px] font-mono text-[#22C55E]">
                        On
                      </span>
                    )}
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-[#22C55E]/20 text-[#22C55E]'
                          : isApplied
                          ? 'bg-white/[0.06] text-[#F4F4F6]'
                          : 'bg-[#1A1A23] text-[#9E9EA9] group-hover:text-[#F4F4F6]'
                      }`}
                    >
                      <Icon className="w-[18px] h-[18px]" />
                    </div>
                    <span className="text-[11px] font-medium leading-tight line-clamp-2 w-full px-0.5">
                      {tool.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sample Negatives Strip */}
        <div className="border-t border-white/[0.07] p-3.5 space-y-2 bg-[#09090D]">
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
                  className={`relative aspect-[4/3] rounded-lg overflow-hidden border transition-all cursor-pointer ${
                    isActive
                      ? 'border-[#22C55E] ring-1 ring-[#22C55E]'
                      : 'border-white/[0.08] opacity-75 hover:opacity-100'
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

      {/* Mobile: Tactile Slide-Up 4-Column Pro Tools Sheet */}
      {isMobileSheetOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/65 backdrop-blur-xs"
          onClick={onCloseMobileSheet}
        >
          <div
            className="animate-sheet-up w-full max-h-[84vh] rounded-t-3xl bg-[#111117]/96 backdrop-blur-2xl border-t border-white/[0.12] shadow-[0_-24px_70px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Handle */}
            <div className="pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="px-4 py-2 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-baseline gap-2">
                <h2 className="font-display text-base font-semibold text-[#F4F4F6]">
                  Tools
                </h2>
                <span className="text-xs font-mono tabular-nums text-[#71717A]">
                  {visibleTools.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {SAMPLE_PHOTOS.map((photo, idx) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => {
                        onSelectSample(photo.src, photo.cameraMeta);
                        onCloseMobileSheet();
                      }}
                      title={photo.title}
                      className={`px-2 py-1 text-[11px] font-mono rounded-lg border cursor-pointer ${
                        activePhotoSrc === photo.src
                          ? 'border-[#22C55E] text-[#22C55E] bg-[#22C55E]/15'
                          : 'border-white/[0.08] text-[#9E9EA9] bg-[#181820]'
                      }`}
                    >
                      S{idx + 1}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onCloseMobileSheet}
                  aria-label="Close tools sheet"
                  className="p-2 rounded-xl bg-[#191922] text-[#A1A1AA] hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search + Category Filter */}
            <div className="px-4 pb-2.5 space-y-2 border-b border-white/[0.07] shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 28 darkroom tools..."
                  className="w-full pl-8 pr-8 py-2 text-xs bg-[#171720] border border-white/[0.08] rounded-xl text-[#F4F4F6] placeholder-[#646470] focus:outline-none focus:border-[#22C55E]/70"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatFilter(cat)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      catFilter === cat
                        ? 'bg-[#22C55E]/15 text-[#22C55E]'
                        : 'bg-[#17171F] text-[#9E9EA9] hover:text-[#F4F4F6]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 4-Column Tactile Icon Grid (Inspired by Mobile Darkroom Grid) */}
            <div className="flex-1 overflow-y-auto darkroom-scroll p-3.5">
              <div className="grid grid-cols-4 gap-2">
                {visibleTools.map((tool) => {
                  const Icon = TOOL_ICONS[tool.id];
                  const isSelected = activeToolId === tool.id;
                  const isApplied = appliedToolIds.has(tool.id);

                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => handlePickTool(tool.id)}
                      className={`relative flex flex-col items-center justify-start gap-1.5 px-1 py-2.5 min-h-[82px] rounded-2xl border text-center transition-all active:scale-[0.96] cursor-pointer ${
                        isSelected
                          ? 'bg-[#17221C] border-[#22C55E]/80 text-[#F4F4F6]'
                          : 'bg-[#16161E] border-white/[0.06] text-[#D4D4DC] hover:bg-[#1C1C26]'
                      }`}
                    >
                      {isApplied && (
                        <span className="absolute top-1.5 right-1.5 text-[9px] font-mono text-[#22C55E]">
                          On
                        </span>
                      )}
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isSelected
                            ? 'bg-[#22C55E]/20 text-[#22C55E]'
                            : isApplied
                            ? 'bg-white/[0.07] text-[#F4F4F6]'
                            : 'bg-[#1F1F29] text-[#A1A1AA]'
                        }`}
                      >
                        <Icon className="w-[19px] h-[19px]" />
                      </div>
                      <span className="text-[11px] font-medium leading-tight line-clamp-2 w-full">
                        {tool.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
