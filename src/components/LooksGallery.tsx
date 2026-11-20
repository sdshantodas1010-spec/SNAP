import React, {useEffect, useMemo, useState} from 'react';
import {Plus, Trash2} from 'lucide-react';
import {LOOK_PRESETS} from '../data/presets';
import {renderEditPipeline} from '../engine/imageProcessor';
import {EditStackStep, LookPreset} from '../types/editor';

interface LooksGalleryProps {
  activeLookId: string | null;
  previewSrc: string;
  sourceImage: HTMLImageElement | null;
  currentStack: EditStackStep[];
  onApplyLook: (preset: LookPreset) => void;
}

const CUSTOM_LOOKS_KEY = 'chitro_custom_looks_v1';

export const LooksGallery: React.FC<LooksGalleryProps> = ({
  activeLookId,
  previewSrc,
  sourceImage,
  currentStack,
  onApplyLook,
}) => {
  const [customLooks, setCustomLooks] = useState<LookPreset[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_LOOKS_KEY);
      return raw ? (JSON.parse(raw) as LookPreset[]) : [];
    } catch {
      return [];
    }
  });
  const [newLookName, setNewLookName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const allLooks = useMemo(() => [...customLooks, ...LOOK_PRESETS], [customLooks]);

  // Generate pixel-accurate micro thumbnails using the real darkroom pipeline
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!sourceImage) return;
    let cancelled = false;
    const nextThumbs: Record<string, string> = {};

    // Defer across frames slightly so UI stays silky smooth
    const timer = setTimeout(() => {
      for (const look of allLooks) {
        if (cancelled) return;
        const steps: EditStackStep[] = look.steps.map((s, idx) => ({
          id: `thumb-${look.id}-${idx}`,
          toolId: s.toolId,
          label: s.label,
          enabled: true,
          params: s.params,
        }));
        const res = renderEditPipeline(sourceImage, steps, 240);
        if ('toDataURL' in res.canvas) {
          nextThumbs[look.id] = res.canvas.toDataURL('image/jpeg', 0.82);
        }
      }
      if (!cancelled) setThumbnails(nextThumbs);
    }, 30);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sourceImage, allLooks]);

  const handleSaveCurrentLook = () => {
    const trimmed = newLookName.trim();
    if (!trimmed || currentStack.length === 0) return;

    const custom: LookPreset = {
      id: `custom-${Date.now()}`,
      name: trimmed,
      description: `Custom look (${currentStack.length} layers)`,
      steps: currentStack
        .filter((s) => s.enabled)
        .map((s) => ({
          toolId: s.toolId,
          label: s.label,
          params: structuredClone(s.params),
        })),
    };

    const next = [custom, ...customLooks];
    setCustomLooks(next);
    try {
      localStorage.setItem(CUSTOM_LOOKS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    setNewLookName('');
    setIsSaving(false);
  };

  const handleDeleteCustomLook = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = customLooks.filter((l) => l.id !== id);
    setCustomLooks(next);
    try {
      localStorage.setItem(CUSTOM_LOOKS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex-1 overflow-y-auto darkroom-scroll p-5 md:p-8 max-w-[1200px] mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/[0.07] pb-5 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#F4F4F6]">
            Curated &amp; Custom Looks
          </h1>
          <p className="text-sm text-[#8E8E98] mt-1">
            True pixel-accurate Look previews rendered through the darkroom engine. Click any Look to apply its edit stack.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {currentStack.length > 0 && !isSaving && (
            <button
              type="button"
              onClick={() => setIsSaving(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#15151C] hover:bg-[#1E1E27] text-[#F4F4F6] border border-white/[0.08] rounded-xl cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Save Current Stack as Look</span>
            </button>
          )}
        </div>
      </div>

      {isSaving && (
        <div className="mb-6 p-4 bg-[#121216] border border-[#22C55E]/50 rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            value={newLookName}
            onChange={(e) => setNewLookName(e.target.value)}
            placeholder="Name your custom Look (e.g. Dhaka Golden Street)..."
            className="flex-1 px-3 py-2 text-xs bg-[#0B0B0D] border border-[#26262E] rounded text-[#F4F4F6] focus:outline-none focus:border-[#22C55E]"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveCurrentLook}
              disabled={!newLookName.trim()}
              className="px-4 py-2 text-xs font-semibold bg-[#22C55E] text-[#051B0C] rounded-md disabled:opacity-40 cursor-pointer whitespace-nowrap"
            >
              Save Look
            </button>
            <button
              type="button"
              onClick={() => setIsSaving(false)}
              className="px-3 py-2 text-xs text-[#8E8E98] hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {allLooks.map((look) => {
          const isActive = activeLookId === look.id;
          const isCustom = look.id.startsWith('custom-');
          const thumbUrl = thumbnails[look.id] || previewSrc;

          return (
            <div
              key={look.id}
              role="button"
              tabIndex={0}
              onClick={() => onApplyLook(look)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onApplyLook(look);
                }
              }}
              className={`group text-left rounded-2xl overflow-hidden border transition-all cursor-pointer bg-[#121218] ${
                isActive
                  ? 'border-[#22C55E] ring-1 ring-[#22C55E]'
                  : 'border-white/[0.07] hover:border-white/[0.16]'
              }`}
            >
              <div className="relative aspect-[4/3] bg-[#08080B] overflow-hidden">
                <img
                  src={thumbUrl}
                  alt={look.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                {isCustom && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteCustomLook(look.id, e)}
                    title="Delete custom look"
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/75 text-[#D4D4DC] hover:text-[#EF4444] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold text-[#F4F4F6] truncate">
                    {look.name}
                  </h3>
                  <span className="text-xs font-mono text-[#71717A] shrink-0">
                    {look.steps.length === 0 ? 'Reset' : `${look.steps.length} layers`}
                  </span>
                </div>
                <p className="text-xs text-[#8E8E98] mt-1 line-clamp-2">
                  {look.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
