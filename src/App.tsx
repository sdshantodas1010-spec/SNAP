/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Download, Layers, LayoutGrid, Sparkles} from 'lucide-react';
import {BlueprintView} from './components/BlueprintView';
import {EditStackView} from './components/EditStackView';
import {ExportModal} from './components/ExportModal';
import {GestureCanvas} from './components/GestureCanvas';
import {LooksGallery} from './components/LooksGallery';
import {OfflineIndicator} from './components/OfflineIndicator';
import {ToolInspector} from './components/ToolInspector';
import {ToolsDrawer} from './components/ToolsDrawer';
import {TopBar} from './components/TopBar';
import {createDefaultParams, SAMPLE_PHOTOS, TOOLS_CATALOG} from './data/presets';
import {renderEditPipeline} from './engine/imageProcessor';
import {loadSessionFromDb, saveSessionToDb} from './engine/storage';
import {loadAnyImageFile} from './engine/workerExport';
import {
  DoubleExposureParams,
  EditStackStep,
  ExifMetadata,
  HistogramData,
  LookPreset,
  MaskStroke,
  SelectiveParams,
  ToolId,
  WorkspaceTab,
} from './types/editor';

function parseSampleMeta(meta: string): ExifMetadata {
  const parts = meta.split('·').map((p) => p.trim());
  return {
    focalLength: parts[0],
    aperture: parts[1],
    shutter: parts[2],
    iso: parts[3],
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('darkroom');
  const [photoSrc, setPhotoSrc] = useState<string>(SAMPLE_PHOTOS[0].src);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [imageDims, setImageDims] = useState<{w: number; h: number}>({w: 0, h: 0});
  const [exif, setExif] = useState<ExifMetadata>(() =>
    parseSampleMeta(SAMPLE_PHOTOS[0].cameraMeta)
  );

  const [editStack, setEditStack] = useState<EditStackStep[]>(() => [
    {
      id: 'step-init-tune',
      toolId: 'tune',
      label: 'Tune Image',
      enabled: true,
      params: createDefaultParams('tune'),
    },
  ]);

  const [undoHistory, setUndoHistory] = useState<EditStackStep[][]>([]);
  const [redoHistory, setRedoHistory] = useState<EditStackStep[][]>([]);

  const [activeStepId, setActiveStepId] = useState<string | null>('step-init-tune');
  const [selectedParamKey, setSelectedParamKey] = useState<string>('brightness');
  const [activeLookId, setActiveLookId] = useState<string | null>('original');
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isInteracting, setIsInteracting] = useState<boolean>(false);
  const [showClippingOverlay, setShowClippingOverlay] = useState<boolean>(false);
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState<boolean>(false);
  const [mobileInspectorExpanded, setMobileInspectorExpanded] = useState<boolean>(true);

  // Per-layer mask brush state
  const [isMaskBrushMode, setIsMaskBrushMode] = useState<boolean>(false);
  const [maskBrushErase, setMaskBrushErase] = useState<boolean>(true);
  const [maskBrushSize, setMaskBrushSize] = useState<number>(10);
  const [maskBrushOpacity, setMaskBrushOpacity] = useState<number>(100);
  const [maskBrushHardness, setMaskBrushHardness] = useState<number>(25);
  const [showMaskOverlay, setShowMaskOverlay] = useState<boolean>(false);

  const [processedCanvas, setProcessedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [originalCanvas, setOriginalCanvas] = useState<HTMLCanvasElement | null>(null);
  const [histogram, setHistogram] = useState<HistogramData>({
    r: [],
    g: [],
    b: [],
    l: [],
  });

  const overlayCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [overlayVersion, setOverlayVersion] = useState(0);
  const sessionLoadedRef = useRef(false);

  const commitStackChange = useCallback(
    (updater: (prev: EditStackStep[]) => EditStackStep[], recordUndo: boolean = true) => {
      setEditStack((prev) => {
        const next = updater(prev);
        if (recordUndo) {
          setUndoHistory((h) => [...h.slice(-24), structuredClone(prev)]);
          setRedoHistory([]);
        }
        return next;
      });
    },
    []
  );

  const handleUndo = useCallback(() => {
    setUndoHistory((h) => {
      if (h.length === 0) return h;
      const previous = h[h.length - 1];
      setEditStack((curr) => {
        setRedoHistory((r) => [...r, structuredClone(curr)]);
        return previous;
      });
      return h.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoHistory((r) => {
      if (r.length === 0) return r;
      const next = r[r.length - 1];
      setEditStack((curr) => {
        setUndoHistory((h) => [...h, structuredClone(curr)]);
        return next;
      });
      return r.slice(0, -1);
    });
  }, []);

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo]);

  // Restore saved session from IndexedDB once on startup
  useEffect(() => {
    let active = true;
    loadSessionFromDb().then((saved) => {
      if (!active) return;
      sessionLoadedRef.current = true;
      if (saved && saved.photoDataUrl) {
        setPhotoSrc(saved.photoDataUrl);
        if (Array.isArray(saved.editStack)) {
          setEditStack(saved.editStack);
          setActiveStepId(saved.editStack[0]?.id ?? null);
        }
        if (saved.exif) setExif(saved.exif);
        if (saved.activeLookId !== undefined) setActiveLookId(saved.activeLookId);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Debounced auto-save to IndexedDB
  useEffect(() => {
    if (!sessionLoadedRef.current) return;
    const timer = setTimeout(() => {
      saveSessionToDb({
        photoDataUrl: photoSrc,
        editStack,
        activeLookId,
        exif,
        updatedAt: Date.now(),
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [photoSrc, editStack, activeLookId, exif]);

  // Load main source image
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      setSourceImage(img);
      setImageDims({w: img.naturalWidth, h: img.naturalHeight});
    };
    img.src = photoSrc;
    return () => {
      cancelled = true;
    };
  }, [photoSrc]);

  // Preload Double Exposure overlay images
  useEffect(() => {
    for (const step of editStack) {
      if (step.toolId === 'doubleexposure') {
        const src = (step.params as DoubleExposureParams).overlaySrc;
        if (src && !overlayCacheRef.current.has(src)) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => setOverlayVersion((v) => v + 1);
          img.src = src;
          overlayCacheRef.current.set(src, img);
        }
      }
    }
  }, [editStack]);

  const activeStep = useMemo(
    () => editStack.find((s) => s.id === activeStepId) ?? null,
    [editStack, activeStepId]
  );

  const activeToolMeta = useMemo(
    () => (activeStep ? TOOLS_CATALOG.find((t) => t.id === activeStep.toolId) ?? null : null),
    [activeStep]
  );

  const appliedToolIds = useMemo(() => {
    const set = new Set<ToolId>();
    for (const step of editStack) {
      if (step.enabled) set.add(step.toolId);
    }
    return set;
  }, [editStack]);

  // Adaptive proxy resolution: 640px while scrubbing/dragging, 1080px on settle
  useEffect(() => {
    if (!sourceImage) return;
    let rafId = 0;
    const proxySize = isInteracting ? 640 : 1080;
    rafId = requestAnimationFrame(() => {
      const result = renderEditPipeline(sourceImage, editStack, proxySize, {
        activeToolId: activeStep?.toolId ?? null,
        activeStepId: activeStep?.id ?? null,
        showMaskOverlay,
        showClippingOverlay,
        overlayCache: overlayCacheRef.current,
      });
      if (typeof HTMLCanvasElement !== 'undefined' && result.canvas instanceof HTMLCanvasElement) {
        setProcessedCanvas(result.canvas);
      }
      if (
        typeof HTMLCanvasElement !== 'undefined' &&
        result.originalCanvas instanceof HTMLCanvasElement
      ) {
        setOriginalCanvas(result.originalCanvas);
      }
      setHistogram(result.histogram);
    });
    return () => cancelAnimationFrame(rafId);
  }, [
    sourceImage,
    editStack,
    isInteracting,
    activeStep?.toolId,
    activeStep?.id,
    showMaskOverlay,
    showClippingOverlay,
    overlayVersion,
  ]);

  useEffect(() => {
    if (!activeToolMeta || activeToolMeta.parameters.length === 0) return;
    const exists = activeToolMeta.parameters.some((p) => p.key === selectedParamKey);
    if (!exists) {
      setSelectedParamKey(activeToolMeta.parameters[0].key);
    }
  }, [activeToolMeta, selectedParamKey]);

  const handleSelectTool = useCallback(
    (toolId: ToolId) => {
      setIsMaskBrushMode(false);
      const existing = [...editStack].reverse().find((s) => s.toolId === toolId);
      if (existing) {
        setActiveStepId(existing.id);
        return;
      }
      const meta = TOOLS_CATALOG.find((t) => t.id === toolId)!;
      const newStep: EditStackStep = {
        id: `step-${toolId}-${Date.now()}`,
        toolId,
        label: meta.name,
        enabled: true,
        params: createDefaultParams(toolId),
      };
      commitStackChange((prev) => [...prev, newStep]);
      setActiveStepId(newStep.id);
      if (meta.parameters.length > 0) {
        setSelectedParamKey(meta.parameters[0].key);
      }
    },
    [editStack, commitStackChange]
  );

  const handleUpdateActiveParams = useCallback(
    (nextParams: Record<string, unknown>) => {
      if (!activeStepId) return;
      commitStackChange(
        (prev) =>
          prev.map((step) =>
            step.id === activeStepId
              ? ({...step, enabled: true, params: nextParams} as unknown as EditStackStep)
              : step
          ),
        !isInteracting
      );
      setActiveLookId(null);
    },
    [activeStepId, commitStackChange, isInteracting]
  );

  const handleAdjustParamFromGesture = useCallback(
    (key: string, value: number) => {
      if (!activeStepId) return;
      setEditStack((prev) =>
        prev.map((step) => {
          if (step.id !== activeStepId) return step;
          if (step.toolId === 'selective') {
            const sel = step.params as SelectiveParams;
            const targetId = sel.activePointId || sel.points[0]?.id;
            const nextPts = sel.points.map((pt) =>
              pt.id === targetId ? {...pt, [key]: value} : pt
            );
            return {
              ...step,
              enabled: true,
              params: {...sel, points: nextPts},
            };
          }
          return {
            ...step,
            enabled: true,
            params: {...step.params, [key]: value},
          } as EditStackStep;
        })
      );
      setActiveLookId(null);
    },
    [activeStepId]
  );

  const handleResetActiveStep = useCallback(() => {
    if (!activeStep) return;
    const defaults = createDefaultParams(activeStep.toolId);
    commitStackChange((prev) =>
      prev.map((s) =>
        s.id === activeStep.id
          ? ({...s, params: defaults, mask: undefined} as unknown as EditStackStep)
          : s
      )
    );
  }, [activeStep, commitStackChange]);

  const handleDeleteStep = useCallback(
    (id: string) => {
      setIsMaskBrushMode(false);
      commitStackChange((prev) => {
        const next = prev.filter((s) => s.id !== id);
        if (activeStepId === id) {
          setActiveStepId(next.length > 0 ? next[next.length - 1].id : null);
        }
        return next;
      });
    },
    [activeStepId, commitStackChange]
  );

  const handleApplyLook = useCallback(
    (preset: LookPreset) => {
      setIsMaskBrushMode(false);
      const newStack: EditStackStep[] = preset.steps.map((s, idx) => ({
        id: `look-${preset.id}-${idx}-${Date.now()}`,
        toolId: s.toolId,
        label: s.label,
        enabled: true,
        params: structuredClone(s.params),
      }));
      commitStackChange(() => newStack);
      setActiveLookId(preset.id);
      setActiveStepId(newStack.length > 0 ? newStack[0].id : null);
      setActiveTab('darkroom');
    },
    [commitStackChange]
  );

  const handleUploadFile = useCallback(async (file: File) => {
    try {
      const loaded = await loadAnyImageFile(file);
      setExif(loaded.exif);
      setPhotoSrc(loaded.dataUrl);
    } catch {
      // Ignore unreadable files
    }
  }, []);

  const handleSelectSample = useCallback((src: string, meta: string) => {
    setPhotoSrc(src);
    setExif(parseSampleMeta(meta));
  }, []);

  const handleAddMaskStroke = useCallback(
    (stroke: MaskStroke) => {
      if (!activeStepId) return;
      commitStackChange((prev) =>
        prev.map((step) => {
          if (step.id !== activeStepId) return step;
          const existingMask = step.mask ?? {inverted: false, strokes: []};
          return {
            ...step,
            mask: {
              ...existingMask,
              strokes: [...existingMask.strokes, stroke],
            },
          };
        })
      );
    },
    [activeStepId, commitStackChange]
  );

  const handleInvertLayerMask = useCallback(() => {
    if (!activeStepId) return;
    commitStackChange((prev) =>
      prev.map((step) => {
        if (step.id !== activeStepId) return step;
        const existing = step.mask ?? {inverted: false, strokes: []};
        return {
          ...step,
          mask: {...existing, inverted: !existing.inverted},
        };
      })
    );
  }, [activeStepId, commitStackChange]);

  const handleClearLayerMask = useCallback(() => {
    if (!activeStepId) return;
    commitStackChange((prev) =>
      prev.map((step) => (step.id === activeStepId ? {...step, mask: undefined} : step))
    );
  }, [activeStepId, commitStackChange]);

  const handleToggleStep = useCallback(
    (id: string) => {
      commitStackChange((prev) =>
        prev.map((s) => (s.id === id ? {...s, enabled: !s.enabled} : s))
      );
    },
    [commitStackChange]
  );

  const handleMoveStep = useCallback(
    (id: string, dir: -1 | 1) => {
      commitStackChange((prev) => {
        const idx = prev.findIndex((s) => s.id === id);
        const target = idx + dir;
        if (idx === -1 || target < 0 || target >= prev.length) return prev;
        const copy = [...prev];
        const [item] = copy.splice(idx, 1);
        copy.splice(target, 0, item);
        return copy;
      });
    },
    [commitStackChange]
  );

  const handleEditStepFromStack = useCallback((id: string, openMaskBrush?: boolean) => {
    setActiveStepId(id);
    setIsMaskBrushMode(Boolean(openMaskBrush));
    setActiveTab('darkroom');
  }, []);

  const handleRevertAll = useCallback(() => {
    setIsMaskBrushMode(false);
    commitStackChange(() => []);
    setActiveStepId(null);
    setActiveLookId('original');
  }, [commitStackChange]);

  const handleImportRecipe = useCallback(
    (steps: EditStackStep[]) => {
      commitStackChange(() => steps);
      setActiveStepId(steps[0]?.id ?? null);
      setActiveLookId(null);
      setActiveTab('darkroom');
    },
    [commitStackChange]
  );

  const activeLayerCount = editStack.filter((s) => s.enabled).length;

  return (
    <div className="min-h-screen h-screen flex flex-col bg-[#060608] text-[#F4F4F6] overflow-hidden">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenExport={() => setIsExportOpen(true)}
        hasImage={Boolean(sourceImage)}
      />

      {activeTab === 'darkroom' && (
        <main className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          <ToolsDrawer
            activeToolId={activeStep?.toolId ?? null}
            appliedToolIds={appliedToolIds}
            activePhotoSrc={photoSrc}
            onSelectTool={(toolId) => {
              handleSelectTool(toolId);
              setMobileInspectorExpanded(true);
            }}
            onSelectSample={handleSelectSample}
            isMobileSheetOpen={isMobileToolsOpen}
            onCloseMobileSheet={() => setIsMobileToolsOpen(false)}
          />

          <GestureCanvas
            processedCanvas={processedCanvas}
            originalCanvas={originalCanvas}
            activeStep={activeStep}
            activeParameters={activeToolMeta?.parameters ?? []}
            selectedParamKey={selectedParamKey}
            onSelectParamKey={setSelectedParamKey}
            onAdjustParam={handleAdjustParamFromGesture}
            onUpdateStepParams={handleUpdateActiveParams}
            onUploadFile={handleUploadFile}
            supportsVerticalSwipe={Boolean(activeToolMeta?.supportsVerticalSwipe) && !isMaskBrushMode}
            isMaskBrushMode={isMaskBrushMode}
            maskBrushErase={maskBrushErase}
            maskBrushSize={maskBrushSize}
            maskBrushOpacity={maskBrushOpacity}
            maskBrushHardness={maskBrushHardness}
            onAddMaskStroke={handleAddMaskStroke}
            showClippingOverlay={showClippingOverlay}
            onToggleClippingOverlay={() => setShowClippingOverlay((v) => !v)}
            canUndo={undoHistory.length > 0}
            canRedo={redoHistory.length > 0}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onInteractionStateChange={setIsInteracting}
            histogram={histogram}
            imageWidth={imageDims.w}
            imageHeight={imageDims.h}
            exif={exif}
            mobileInspectorExpanded={mobileInspectorExpanded}
          />

          <ToolInspector
            activeStep={activeStep}
            histogram={histogram}
            imageWidth={imageDims.w}
            imageHeight={imageDims.h}
            exif={exif}
            selectedParamKey={selectedParamKey}
            onSelectParamKey={setSelectedParamKey}
            onUpdateParams={handleUpdateActiveParams}
            onResetStep={handleResetActiveStep}
            onDeleteStep={() => activeStep && handleDeleteStep(activeStep.id)}
            isMaskBrushMode={isMaskBrushMode}
            onToggleMaskBrushMode={() => setIsMaskBrushMode((v) => !v)}
            maskBrushErase={maskBrushErase}
            onSetMaskBrushErase={setMaskBrushErase}
            maskBrushSize={maskBrushSize}
            onSetMaskBrushSize={setMaskBrushSize}
            maskBrushOpacity={maskBrushOpacity}
            onSetMaskBrushOpacity={setMaskBrushOpacity}
            maskBrushHardness={maskBrushHardness}
            onSetMaskBrushHardness={setMaskBrushHardness}
            showMaskOverlay={showMaskOverlay}
            onToggleMaskOverlay={() => setShowMaskOverlay((v) => !v)}
            showClippingOverlay={showClippingOverlay}
            onToggleClippingOverlay={() => setShowClippingOverlay((v) => !v)}
            onInvertLayerMask={handleInvertLayerMask}
            onClearLayerMask={handleClearLayerMask}
            onInteractionStateChange={setIsInteracting}
            mobileExpanded={mobileInspectorExpanded}
            onToggleMobileExpand={() => setMobileInspectorExpanded((v) => !v)}
            onOpenMobileTools={() => setIsMobileToolsOpen(true)}
          />
        </main>
      )}

      {activeTab === 'looks' && (
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <LooksGallery
            activeLookId={activeLookId}
            previewSrc={photoSrc}
            sourceImage={sourceImage}
            currentStack={editStack}
            onApplyLook={handleApplyLook}
          />
        </main>
      )}

      {activeTab === 'stack' && (
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <EditStackView
            stack={editStack}
            activeStepId={activeStepId}
            onToggleStep={handleToggleStep}
            onMoveStep={handleMoveStep}
            onEditStep={handleEditStepFromStack}
            onDeleteStep={handleDeleteStep}
            onRevertAll={handleRevertAll}
            onImportRecipe={handleImportRecipe}
          />
        </main>
      )}

      {activeTab === 'guide' && (
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <BlueprintView />
        </main>
      )}

      {/* Mobile Ergonomic Thumb Dock (Looks · Tools · Stack · Export) */}
      <nav
        aria-label="Mobile workspace actions"
        className="md:hidden shrink-0 h-14 bg-[#0D0D12]/96 backdrop-blur-xl border-t border-white/[0.08] grid grid-cols-4 items-center px-1 pb-safe z-30"
      >
        <button
          type="button"
          onClick={() => {
            setIsMobileToolsOpen(false);
            setActiveTab('looks');
          }}
          className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
            activeTab === 'looks' ? 'text-[#22C55E]' : 'text-[#9E9EA9] hover:text-[#F4F4F6]'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Looks</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('darkroom');
            setIsMobileToolsOpen((v) => !v);
          }}
          className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
            activeTab === 'darkroom' ? 'text-[#22C55E]' : 'text-[#9E9EA9] hover:text-[#F4F4F6]'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>Tools</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setIsMobileToolsOpen(false);
            setActiveTab('stack');
          }}
          className={`h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
            activeTab === 'stack' ? 'text-[#22C55E]' : 'text-[#9E9EA9] hover:text-[#F4F4F6]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>
            Stack{activeLayerCount > 0 ? ` (${activeLayerCount})` : ''}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setIsExportOpen(true)}
          disabled={!sourceImage}
          className="h-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-[#22C55E] disabled:opacity-40 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </nav>

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        sourceImage={sourceImage}
        editStack={editStack}
        overlayCache={overlayCacheRef.current}
        sourceWidth={imageDims.w}
        sourceHeight={imageDims.h}
        stackCount={activeLayerCount}
      />

      <OfflineIndicator />
    </div>
  );
}
