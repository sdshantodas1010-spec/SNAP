import React, {useEffect, useRef, useState} from 'react';
import {
  Eye,
  SplitSquareHorizontal,
  Upload,
  Plus,
  Move,
  ZoomIn,
  ZoomOut,
  Maximize,
  Hand,
  Undo2,
  Undo,
  Redo,
  AlertTriangle,
} from 'lucide-react';
import {getAspectRatioValue} from '../engine/imageProcessor';
import {
  BrushParams,
  CropParams,
  DoubleExposureParams,
  EditStackStep,
  HealingParams,
  LensBlurParams,
  MaskStroke,
  ParameterDescriptor,
  PortraitParams,
  RemoverParams,
  SelectiveParams,
  TextParams,
  VignetteParams,
  WhiteBalanceParams,
} from '../types/editor';

interface GestureCanvasProps {
  processedCanvas: HTMLCanvasElement | null;
  originalCanvas: HTMLCanvasElement | null;
  activeStep: EditStackStep | null;
  activeParameters: ParameterDescriptor[];
  selectedParamKey: string;
  onSelectParamKey: (key: string) => void;
  onAdjustParam: (key: string, value: number) => void;
  onUpdateStepParams: (params: Record<string, unknown>) => void;
  onUploadFile: (file: File) => void;
  supportsVerticalSwipe: boolean;
  isMaskBrushMode: boolean;
  maskBrushErase: boolean;
  maskBrushSize: number;
  maskBrushOpacity: number;
  maskBrushHardness: number;
  onAddMaskStroke: (stroke: MaskStroke) => void;
  showClippingOverlay: boolean;
  onToggleClippingOverlay: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onInteractionStateChange?: (interacting: boolean) => void;
}

type CropHandle = 'tl' | 'tr' | 'bl' | 'br' | 'move';

export const GestureCanvas: React.FC<GestureCanvasProps> = ({
  processedCanvas,
  originalCanvas,
  activeStep,
  activeParameters,
  selectedParamKey,
  onSelectParamKey,
  onAdjustParam,
  onUpdateStepParams,
  onUploadFile,
  supportsVerticalSwipe,
  isMaskBrushMode,
  maskBrushErase,
  maskBrushSize,
  maskBrushOpacity,
  maskBrushHardness,
  onAddMaskStroke,
  showClippingOverlay,
  onToggleClippingOverlay,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onInteractionStateChange,
}) => {
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);

  const [isComparing, setIsComparing] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [splitPos, setSplitPos] = useState(0.5);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [isDragOverFile, setIsDragOverFile] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{x: number; y: number}>({x: 0, y: 0});
  const [panToolActive, setPanToolActive] = useState(false);
  const [hoverRgb, setHoverRgb] = useState<{r: number; g: number; b: number} | null>(null);

  const [livePoints, setLivePoints] = useState<Array<{x: number; y: number}>>([]);

  // Multi-touch Pinch-to-Zoom tracking
  const activeTouchesRef = useRef<Map<number, {x: number; y: number}>>(new Map());
  const pinchStateRef = useRef<{
    active: boolean;
    startDist: number;
    startZoom: number;
    startMidX: number;
    startMidY: number;
    startPanX: number;
    startPanY: number;
  }>({
    active: false,
    startDist: 0,
    startZoom: 1,
    startMidX: 0,
    startMidY: 0,
    startPanX: 0,
    startPanY: 0,
  });

  const [gestureHud, setGestureHud] = useState<{
    visible: boolean;
    label: string;
    value: number;
    mode: 'horizontal' | 'vertical' | null;
  }>({visible: false, label: '', value: 0, mode: null});

  const gestureRef = useRef<{
    active: boolean;
    mode:
      | 'swipe'
      | 'pan'
      | 'vignette'
      | 'lensblur'
      | 'portrait'
      | 'text'
      | 'selective'
      | 'brush'
      | 'healing'
      | 'remover'
      | 'mask'
      | 'crop'
      | 'doubleexposure'
      | null;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    startOffsetX: number;
    startOffsetY: number;
    lastYStep: number;
    startVal: number;
    lockedAxis: 'horizontal' | 'vertical' | null;
    targetId: string | null;
    cropHandle: CropHandle | null;
    startCrop: CropParams | null;
  }>({
    active: false,
    mode: null,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    lastYStep: 0,
    startVal: 0,
    lockedAxis: null,
    targetId: null,
    cropHandle: null,
    startCrop: null,
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '\\') setIsComparing(true);
      if (e.key === '0') {
        setZoom(1);
        setPan({x: 0, y: 0});
      }
      if (e.key === '1') setZoom(2);
      if (e.key.toLowerCase() === 'j' && !e.metaKey && !e.ctrlKey) {
        onToggleClippingOverlay();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === '\\') setIsComparing(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onToggleClippingOverlay]);

  useEffect(() => {
    const dest = displayCanvasRef.current;
    if (!dest || !processedCanvas) return;

    dest.width = processedCanvas.width;
    dest.height = processedCanvas.height;
    const ctx = dest.getContext('2d');
    if (!ctx) return;

    if (isComparing && originalCanvas) {
      ctx.drawImage(originalCanvas, 0, 0, dest.width, dest.height);
      return;
    }

    ctx.drawImage(processedCanvas, 0, 0);

    if (splitMode && originalCanvas) {
      const splitX = Math.round(dest.width * splitPos);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitX, dest.height);
      ctx.clip();
      ctx.drawImage(originalCanvas, 0, 0, dest.width, dest.height);
      ctx.restore();
    }

    if (livePoints.length > 0) {
      ctx.save();
      ctx.strokeStyle = isMaskBrushMode
        ? maskBrushErase
          ? 'rgba(239, 68, 68, 0.7)'
          : 'rgba(34, 197, 94, 0.7)'
        : activeStep?.toolId === 'healing'
        ? 'rgba(239, 68, 68, 0.65)'
        : activeStep?.toolId === 'remover'
        ? 'rgba(168, 85, 247, 0.65)'
        : 'rgba(56, 189, 248, 0.65)';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const minDim = Math.min(dest.width, dest.height);
      const sizePct = isMaskBrushMode
        ? maskBrushSize
        : activeStep?.toolId === 'healing'
        ? (activeStep.params as HealingParams).brushSize
        : activeStep?.toolId === 'remover'
        ? (activeStep.params as RemoverParams).brushSize
        : (activeStep?.params as BrushParams | undefined)?.brushSize ?? 8;
      ctx.lineWidth = Math.max(6, (sizePct / 100) * minDim * 2);
      ctx.beginPath();
      livePoints.forEach((pt, idx) => {
        const px = pt.x * dest.width;
        const py = pt.y * dest.height;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.restore();
    }
  }, [
    processedCanvas,
    originalCanvas,
    isComparing,
    splitMode,
    splitPos,
    livePoints,
    isMaskBrushMode,
    maskBrushErase,
    maskBrushSize,
    activeStep,
  ]);

  const currentParamDesc =
    activeParameters.find((p) => p.key === selectedParamKey) || activeParameters[0] || null;

  const getCurrentParamValue = (key: string): number => {
    if (!activeStep) return 0;
    if (activeStep.toolId === 'selective') {
      const sel = activeStep.params as SelectiveParams;
      const pt = sel.points.find((p) => p.id === sel.activePointId) || sel.points[0];
      if (!pt) return 0;
      return Number((pt as unknown as Record<string, number>)[key] ?? 0);
    }
    return Number((activeStep.params as unknown as Record<string, unknown>)[key] ?? 0);
  };

  const getNormalizedCoords = (clientX: number, clientY: number) => {
    const rect = displayCanvasRef.current!.getBoundingClientRect();
    return {
      nx: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      ny: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  };

  const isEyedropper =
    activeStep?.toolId === 'whitebalance' &&
    Boolean((activeStep.params as WhiteBalanceParams).eyedropperActive);

  // Stage-level two-finger pinch-to-zoom handlers
  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    activeTouchesRef.current.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (activeTouchesRef.current.size === 2) {
      const pts = Array.from(activeTouchesRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) * 0.5;
      const midY = (pts[0].y + pts[1].y) * 0.5;
      pinchStateRef.current = {
        active: true,
        startDist: Math.max(10, dist),
        startZoom: zoom,
        startMidX: midX,
        startMidY: midY,
        startPanX: pan.x,
        startPanY: pan.y,
      };
      // Cancel any single-finger swipe/brush if second finger lands
      gestureRef.current.active = false;
      gestureRef.current.mode = null;
      setLivePoints([]);
    }
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    if (activeTouchesRef.current.has(e.pointerId)) {
      activeTouchesRef.current.set(e.pointerId, {x: e.clientX, y: e.clientY});
    }
    if (pinchStateRef.current.active && activeTouchesRef.current.size >= 2) {
      const pts = Array.from(activeTouchesRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) * 0.5;
      const midY = (pts[0].y + pts[1].y) * 0.5;
      const ratio = dist / pinchStateRef.current.startDist;
      const nextZoom = Math.max(0.5, Math.min(4, Number((pinchStateRef.current.startZoom * ratio).toFixed(2))));
      setZoom(nextZoom);
      if (nextZoom <= 1) {
        setPan({x: 0, y: 0});
      } else {
        setPan({
          x: pinchStateRef.current.startPanX + (midX - pinchStateRef.current.startMidX),
          y: pinchStateRef.current.startPanY + (midY - pinchStateRef.current.startMidY),
        });
      }
    }
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    activeTouchesRef.current.delete(e.pointerId);
    if (activeTouchesRef.current.size < 2) {
      pinchStateRef.current.active = false;
    }
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!displayCanvasRef.current) return;
    if (e.pointerType === 'touch' && activeTouchesRef.current.size >= 2) return;

    const {nx, ny} = getNormalizedCoords(e.clientX, e.clientY);

    if (panToolActive || e.button === 1) {
      gestureRef.current = {
        ...gestureRef.current,
        active: true,
        mode: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }

    if (isEyedropper && activeStep?.toolId === 'whitebalance') {
      const canvas = displayCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const px = Math.min(canvas.width - 1, Math.max(0, Math.round(nx * canvas.width)));
        const py = Math.min(canvas.height - 1, Math.max(0, Math.round(ny * canvas.height)));
        const pixel = ctx.getImageData(px, py, 1, 1).data;
        const avg = (pixel[0] + pixel[1] + pixel[2]) / 3;
        const tempShift = Math.round(((avg - pixel[0]) - (avg - pixel[2])) * 0.7);
        const tintShift = Math.round((pixel[1] - avg) * 0.8);
        const wb = activeStep.params as WhiteBalanceParams;
        onUpdateStepParams({
          temperature: Math.max(-100, Math.min(100, wb.temperature + tempShift)),
          tint: Math.max(-100, Math.min(100, wb.tint + tintShift)),
          eyedropperActive: false,
        });
      }
      setHoverRgb(null);
      return;
    }

    if (isMaskBrushMode && activeStep) {
      gestureRef.current.active = true;
      gestureRef.current.mode = 'mask';
      setLivePoints([{x: nx, y: ny}]);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }

    if (activeStep?.toolId === 'brush') {
      gestureRef.current.active = true;
      gestureRef.current.mode = 'brush';
      setLivePoints([{x: nx, y: ny}]);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }

    if (activeStep?.toolId === 'healing') {
      gestureRef.current.active = true;
      gestureRef.current.mode = 'healing';
      setLivePoints([{x: nx, y: ny}]);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }

    if (activeStep?.toolId === 'remover') {
      gestureRef.current.active = true;
      gestureRef.current.mode = 'remover';
      setLivePoints([{x: nx, y: ny}]);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }

    if (activeStep?.toolId === 'vignette') {
      const vig = activeStep.params as VignetteParams;
      if (Math.hypot(nx - vig.centerX, ny - vig.centerY) < 0.1) {
        gestureRef.current.active = true;
        gestureRef.current.mode = 'vignette';
        onInteractionStateChange?.(true);
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        return;
      }
    }

    if (activeStep?.toolId === 'lensblur') {
      const lb = activeStep.params as LensBlurParams;
      if (Math.hypot(nx - lb.centerX, ny - lb.centerY) < 0.11) {
        gestureRef.current.active = true;
        gestureRef.current.mode = 'lensblur';
        onInteractionStateChange?.(true);
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        return;
      }
    }

    if (activeStep?.toolId === 'portrait') {
      const pp = activeStep.params as PortraitParams;
      if (Math.hypot(nx - pp.faceX, ny - pp.faceY) < 0.14) {
        gestureRef.current.active = true;
        gestureRef.current.mode = 'portrait';
        onInteractionStateChange?.(true);
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        return;
      }
    }

    if (activeStep?.toolId === 'text') {
      const txt = activeStep.params as TextParams;
      if (Math.hypot(nx - txt.x, ny - txt.y) < 0.2) {
        gestureRef.current.active = true;
        gestureRef.current.mode = 'text';
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        return;
      }
    }

    if (activeStep?.toolId === 'doubleexposure') {
      const de = activeStep.params as DoubleExposureParams;
      gestureRef.current = {
        ...gestureRef.current,
        active: true,
        mode: 'doubleexposure',
        startX: e.clientX,
        startY: e.clientY,
        startOffsetX: de.offsetX,
        startOffsetY: de.offsetY,
      };
      onInteractionStateChange?.(true);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      return;
    }

    if (activeStep?.toolId === 'selective') {
      const sel = activeStep.params as SelectiveParams;
      const hit = sel.points.find((pt) => Math.hypot(nx - pt.x, ny - pt.y) < 0.08);
      if (hit) {
        onUpdateStepParams({...sel, activePointId: hit.id});
        gestureRef.current.active = true;
        gestureRef.current.mode = 'selective';
        gestureRef.current.targetId = hit.id;
        onInteractionStateChange?.(true);
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        return;
      }
    }

    if (!supportsVerticalSwipe || !currentParamDesc) return;
    const val = getCurrentParamValue(currentParamDesc.key);
    gestureRef.current = {
      ...gestureRef.current,
      active: true,
      mode: 'swipe',
      startX: e.clientX,
      startY: e.clientY,
      lastYStep: 0,
      startVal: val,
      lockedAxis: null,
    };
    onInteractionStateChange?.(true);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pinchStateRef.current.active) return;

    if (isEyedropper && displayCanvasRef.current && !gestureRef.current.active) {
      const {nx, ny} = getNormalizedCoords(e.clientX, e.clientY);
      const ctx = displayCanvasRef.current.getContext('2d');
      if (ctx) {
        const px = Math.min(
          displayCanvasRef.current.width - 1,
          Math.max(0, Math.round(nx * displayCanvasRef.current.width))
        );
        const py = Math.min(
          displayCanvasRef.current.height - 1,
          Math.max(0, Math.round(ny * displayCanvasRef.current.height))
        );
        const p = ctx.getImageData(px, py, 1, 1).data;
        setHoverRgb({r: p[0], g: p[1], b: p[2]});
      }
    }

    const g = gestureRef.current;
    if (!g.active || !displayCanvasRef.current) return;

    if (g.mode === 'pan') {
      setPan({
        x: g.startPanX + (e.clientX - g.startX),
        y: g.startPanY + (e.clientY - g.startY),
      });
      return;
    }

    const {nx, ny} = getNormalizedCoords(e.clientX, e.clientY);

    if (g.mode === 'mask' || g.mode === 'brush' || g.mode === 'healing' || g.mode === 'remover') {
      setLivePoints((prev) => [...prev, {x: nx, y: ny}]);
      return;
    }

    if (g.mode === 'vignette' && activeStep?.toolId === 'vignette') {
      const vig = activeStep.params as VignetteParams;
      onUpdateStepParams({...vig, centerX: nx, centerY: ny});
      return;
    }

    if (g.mode === 'lensblur' && activeStep?.toolId === 'lensblur') {
      const lb = activeStep.params as LensBlurParams;
      onUpdateStepParams({...lb, centerX: nx, centerY: ny});
      return;
    }

    if (g.mode === 'portrait' && activeStep?.toolId === 'portrait') {
      const pp = activeStep.params as PortraitParams;
      onUpdateStepParams({...pp, faceX: nx, faceY: ny});
      return;
    }

    if (g.mode === 'text' && activeStep?.toolId === 'text') {
      const txt = activeStep.params as TextParams;
      onUpdateStepParams({...txt, x: nx, y: ny});
      return;
    }

    if (g.mode === 'doubleexposure' && activeStep?.toolId === 'doubleexposure') {
      const rect = displayCanvasRef.current.getBoundingClientRect();
      const dxPct = Math.round(((e.clientX - g.startX) / rect.width) * 100);
      const dyPct = Math.round(((e.clientY - g.startY) / rect.height) * 100);
      const de = activeStep.params as DoubleExposureParams;
      onUpdateStepParams({
        ...de,
        offsetX: Math.max(-50, Math.min(50, g.startOffsetX + dxPct)),
        offsetY: Math.max(-50, Math.min(50, g.startOffsetY + dyPct)),
      });
      return;
    }

    if (g.mode === 'selective' && activeStep?.toolId === 'selective' && g.targetId) {
      const sel = activeStep.params as SelectiveParams;
      const updatedPts = sel.points.map((pt) =>
        pt.id === g.targetId ? {...pt, x: nx, y: ny} : pt
      );
      onUpdateStepParams({...sel, points: updatedPts});
      return;
    }

    if (g.mode === 'swipe' && currentParamDesc) {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;

      if (!g.lockedAxis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        g.lockedAxis = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
      }

      if (g.lockedAxis === 'horizontal') {
        const range = currentParamDesc.max - currentParamDesc.min;
        const delta = Math.round((dx / 240) * range);
        const nextVal = Math.max(
          currentParamDesc.min,
          Math.min(currentParamDesc.max, g.startVal + delta)
        );
        onAdjustParam(currentParamDesc.key, nextVal);
        setGestureHud({
          visible: true,
          label: currentParamDesc.label,
          value: nextVal,
          mode: 'horizontal',
        });
      } else if (g.lockedAxis === 'vertical' && activeParameters.length > 1) {
        const stepIndex = Math.round(dy / 42);
        if (stepIndex !== g.lastYStep) {
          const curIdx = activeParameters.findIndex((p) => p.key === currentParamDesc.key);
          const dir = stepIndex > g.lastYStep ? 1 : -1;
          const nextIdx = (curIdx + dir + activeParameters.length) % activeParameters.length;
          const nextParam = activeParameters[nextIdx];
          g.lastYStep = stepIndex;
          g.startVal = getCurrentParamValue(nextParam.key);
          onSelectParamKey(nextParam.key);
          setGestureHud({
            visible: true,
            label: nextParam.label,
            value: g.startVal,
            mode: 'vertical',
          });
        }
      }
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gestureRef.current;
    if (!g.active) return;

    if (g.mode === 'mask' && livePoints.length > 0) {
      onAddMaskStroke({
        id: `mask-${Date.now()}`,
        points: livePoints,
        size: maskBrushSize,
        opacity: maskBrushOpacity,
        hardness: maskBrushHardness,
        erase: maskBrushErase,
      });
      setLivePoints([]);
    } else if (g.mode === 'brush' && activeStep?.toolId === 'brush' && livePoints.length > 0) {
      const bp = activeStep.params as BrushParams;
      if (bp.activeMode === 'eraser') {
        const remaining = bp.strokes.filter(
          (st) =>
            !st.points.some((sp) =>
              livePoints.some((lp) => Math.hypot(sp.x - lp.x, sp.y - lp.y) < bp.brushSize / 100)
            )
        );
        onUpdateStepParams({...bp, strokes: remaining});
      } else {
        onUpdateStepParams({
          ...bp,
          strokes: [
            ...bp.strokes,
            {
              id: `b-${Date.now()}`,
              mode: bp.activeMode,
              strength: bp.activeStrength,
              size: bp.brushSize,
              opacity: bp.opacity ?? 100,
              hardness: bp.hardness ?? 25,
              points: livePoints,
            },
          ],
        });
      }
      setLivePoints([]);
    } else if (
      g.mode === 'healing' &&
      activeStep?.toolId === 'healing' &&
      livePoints.length > 0
    ) {
      const hp = activeStep.params as HealingParams;
      onUpdateStepParams({
        ...hp,
        spots: [
          ...hp.spots,
          {
            id: `heal-${Date.now()}`,
            points: livePoints,
            radius: hp.brushSize,
          },
        ],
      });
      setLivePoints([]);
    } else if (
      g.mode === 'remover' &&
      activeStep?.toolId === 'remover' &&
      livePoints.length > 0
    ) {
      const rp = activeStep.params as RemoverParams;
      onUpdateStepParams({
        ...rp,
        regions: [
          ...rp.regions,
          {
            id: `rem-${Date.now()}`,
            size: rp.brushSize,
            points: livePoints,
          },
        ],
      });
      setLivePoints([]);
    }

    g.active = false;
    g.mode = null;
    g.targetId = null;
    onInteractionStateChange?.(false);

    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setTimeout(() => {
      setGestureHud((prev) => ({...prev, visible: false}));
    }, 650);
  };

  const startCropDrag = (handle: CropHandle, e: React.PointerEvent) => {
    e.stopPropagation();
    if (!activeStep || activeStep.toolId !== 'crop') return;
    gestureRef.current = {
      ...gestureRef.current,
      active: true,
      mode: 'crop',
      cropHandle: handle,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: {...(activeStep.params as CropParams)},
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const moveCropDrag = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g.active || g.mode !== 'crop' || !g.startCrop || !displayCanvasRef.current) return;
    const rect = displayCanvasRef.current.getBoundingClientRect();
    const dx = (e.clientX - g.startX) / rect.width;
    const dy = (e.clientY - g.startY) / rect.height;
    const sc = g.startCrop;
    let {cropX, cropY, cropW, cropH} = sc;

    const targetRatio = getAspectRatioValue(sc.aspectRatio);
    const canvasRatio = displayCanvasRef.current.width / Math.max(1, displayCanvasRef.current.height);
    const normRatio = targetRatio !== null ? targetRatio / canvasRatio : null;

    if (g.cropHandle === 'move') {
      cropX = Math.max(0, Math.min(1 - cropW, sc.cropX + dx));
      cropY = Math.max(0, Math.min(1 - cropH, sc.cropY + dy));
    } else if (normRatio !== null) {
      // Aspect-ratio locked corner resize
      const minW = 0.12;
      if (g.cropHandle === 'br') {
        const maxW = 1 - sc.cropX;
        const maxH = 1 - sc.cropY;
        let w = Math.max(minW, Math.min(maxW, sc.cropW + dx));
        let h = w / normRatio;
        if (h > maxH) {
          h = maxH;
          w = h * normRatio;
        }
        cropW = w;
        cropH = h;
      } else if (g.cropHandle === 'bl') {
        const right = sc.cropX + sc.cropW;
        const maxW = right;
        const maxH = 1 - sc.cropY;
        let w = Math.max(minW, Math.min(maxW, sc.cropW - dx));
        let h = w / normRatio;
        if (h > maxH) {
          h = maxH;
          w = h * normRatio;
        }
        cropX = right - w;
        cropW = w;
        cropH = h;
      } else if (g.cropHandle === 'tr') {
        const bottom = sc.cropY + sc.cropH;
        const maxW = 1 - sc.cropX;
        const maxH = bottom;
        let w = Math.max(minW, Math.min(maxW, sc.cropW + dx));
        let h = w / normRatio;
        if (h > maxH) {
          h = maxH;
          w = h * normRatio;
        }
        cropY = bottom - h;
        cropW = w;
        cropH = h;
      } else if (g.cropHandle === 'tl') {
        const right = sc.cropX + sc.cropW;
        const bottom = sc.cropY + sc.cropH;
        const maxW = right;
        const maxH = bottom;
        let w = Math.max(minW, Math.min(maxW, sc.cropW - dx));
        let h = w / normRatio;
        if (h > maxH) {
          h = maxH;
          w = h * normRatio;
        }
        cropX = right - w;
        cropY = bottom - h;
        cropW = w;
        cropH = h;
      }
    } else if (g.cropHandle === 'tl') {
      const nx = Math.max(0, Math.min(sc.cropX + sc.cropW - 0.12, sc.cropX + dx));
      const ny = Math.max(0, Math.min(sc.cropY + sc.cropH - 0.12, sc.cropY + dy));
      cropW = sc.cropX + sc.cropW - nx;
      cropH = sc.cropY + sc.cropH - ny;
      cropX = nx;
      cropY = ny;
    } else if (g.cropHandle === 'tr') {
      const ny = Math.max(0, Math.min(sc.cropY + sc.cropH - 0.12, sc.cropY + dy));
      cropW = Math.max(0.12, Math.min(1 - sc.cropX, sc.cropW + dx));
      cropH = sc.cropY + sc.cropH - ny;
      cropY = ny;
    } else if (g.cropHandle === 'bl') {
      const nx = Math.max(0, Math.min(sc.cropX + sc.cropW - 0.12, sc.cropX + dx));
      cropW = sc.cropX + sc.cropW - nx;
      cropX = nx;
      cropH = Math.max(0.12, Math.min(1 - sc.cropY, sc.cropH + dy));
    } else if (g.cropHandle === 'br') {
      cropW = Math.max(0.12, Math.min(1 - sc.cropX, sc.cropW + dx));
      cropH = Math.max(0.12, Math.min(1 - sc.cropY, sc.cropH + dy));
    }

    onUpdateStepParams({...sc, cropX, cropY, cropW, cropH});
  };

  const endCropDrag = (e: React.PointerEvent) => {
    if (gestureRef.current.mode === 'crop') {
      gestureRef.current.active = false;
      gestureRef.current.mode = null;
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handleAddSelectivePoint = () => {
    if (!activeStep || activeStep.toolId !== 'selective') return;
    const sel = activeStep.params as SelectiveParams;
    const id = `pt-${Date.now()}`;
    const offset = (sel.points.length % 4) * 0.08;
    const newPt = {
      id,
      x: Math.min(0.85, 0.35 + offset),
      y: Math.min(0.85, 0.4 + offset),
      radius: 26,
      tolerance: 45,
      brightness: 20,
      contrast: 8,
      saturation: 12,
    };
    onUpdateStepParams({
      points: [...sel.points, newPt],
      activePointId: id,
    });
  };

  const handleWheelZoom = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey || zoom > 1) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.18 : -0.18;
      setZoom((z) => {
        const next = Math.max(0.5, Math.min(4, Number((z + delta).toFixed(2))));
        if (next <= 1) setPan({x: 0, y: 0});
        return next;
      });
    }
  };

  const cropBox =
    activeStep?.toolId === 'crop' ? (activeStep.params as CropParams) : null;

  const activeSelectivePt =
    activeStep?.toolId === 'selective'
      ? (activeStep.params as SelectiveParams).points.find(
          (p) => p.id === (activeStep.params as SelectiveParams).activePointId
        ) || (activeStep.params as SelectiveParams).points[0]
      : null;

  const lensBlurParams =
    activeStep?.toolId === 'lensblur' ? (activeStep.params as LensBlurParams) : null;

  const portraitParams =
    activeStep?.toolId === 'portrait' ? (activeStep.params as PortraitParams) : null;

  const canvasCursor = panToolActive
    ? 'cursor-grab active:cursor-grabbing'
    : isEyedropper
    ? 'cursor-crosshair'
    : isMaskBrushMode ||
      activeStep?.toolId === 'brush' ||
      activeStep?.toolId === 'healing' ||
      activeStep?.toolId === 'remover'
    ? 'cursor-crosshair'
    : activeStep?.toolId === 'doubleexposure'
    ? 'cursor-move'
    : supportsVerticalSwipe
    ? 'cursor-ew-resize'
    : 'cursor-default';

  return (
    <div
      ref={stageContainerRef}
      onWheel={handleWheelZoom}
      onPointerDown={handleStagePointerDown}
      onPointerMove={handleStagePointerMove}
      onPointerUp={handleStagePointerUp}
      onPointerCancel={handleStagePointerUp}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOverFile(true);
      }}
      onDragLeave={() => setIsDragOverFile(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOverFile(false);
        const file = e.dataTransfer.files?.[0];
        if (file && (file.type.startsWith('image/') || /\.(dng|tif|tiff)$/i.test(file.name))) {
          onUploadFile(file);
        }
      }}
      className="relative flex-1 flex flex-col items-center justify-center bg-[#070709] overflow-hidden p-2 sm:p-4 md:p-8 select-none touch-none min-h-[240px]"
    >
      {/* Top Stage Utility Bar */}
      <div className="absolute top-2.5 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-1.5 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1">
          <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#D4D4DC] bg-[#141418]/95 hover:bg-[#1E1E24] border border-[#26262E] rounded-md cursor-pointer transition-colors whitespace-nowrap">
            <Upload className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>Open</span>
            <input
              type="file"
              accept="image/*,.dng,.DNG,.tif,.tiff"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUploadFile(file);
                e.target.value = '';
              }}
            />
          </label>

          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 text-[#D4D4DC] bg-[#141418]/95 hover:bg-[#1E1E24] border border-[#26262E] rounded-md disabled:opacity-35 cursor-pointer"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="p-1.5 text-[#D4D4DC] bg-[#141418]/95 hover:bg-[#1E1E24] border border-[#26262E] rounded-md disabled:opacity-35 cursor-pointer"
          >
            <Redo className="w-3.5 h-3.5" />
          </button>

          {activeStep?.toolId === 'selective' && (
            <button
              type="button"
              onClick={handleAddSelectivePoint}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-[#D4D4DC] bg-[#141418]/95 hover:bg-[#1E1E24] border border-[#26262E] rounded-md cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-[#22C55E]" />
              <span>Add Point</span>
            </button>
          )}

          {activeStep?.toolId === 'healing' &&
            (activeStep.params as HealingParams).spots.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const hp = activeStep.params as HealingParams;
                  onUpdateStepParams({...hp, spots: hp.spots.slice(0, -1)});
                }}
                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-[#D4D4DC] bg-[#141418]/95 hover:bg-[#1E1E24] border border-[#26262E] rounded-md cursor-pointer whitespace-nowrap"
              >
                <Undo2 className="w-3.5 h-3.5 text-[#22C55E]" />
                <span>Undo Spot</span>
              </button>
            )}

          {activeStep?.toolId === 'remover' &&
            (activeStep.params as RemoverParams).regions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const rp = activeStep.params as RemoverParams;
                  onUpdateStepParams({...rp, regions: rp.regions.slice(0, -1)});
                }}
                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-[#D4D4DC] bg-[#141418]/95 hover:bg-[#1E1E24] border border-[#26262E] rounded-md cursor-pointer whitespace-nowrap"
              >
                <Undo2 className="w-3.5 h-3.5 text-[#A855F7]" />
                <span>Undo Region</span>
              </button>
            )}
        </div>

        {/* Eyedropper RGB Readout + Clipping + Zoom + Compare Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          {isEyedropper && hoverRgb && (
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-[#141418]/95 border border-[#26262E] rounded-md text-[11px] font-mono tabular-nums text-[#D4D4DC]">
              <span
                className="w-2.5 h-2.5 rounded-xs border border-white/25"
                style={{backgroundColor: `rgb(${hoverRgb.r},${hoverRgb.g},${hoverRgb.b})`}}
              />
              <span>
                R:{hoverRgb.r} G:{hoverRgb.g} B:{hoverRgb.b}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={onToggleClippingOverlay}
            title="Show Shadow/Highlight Clipping Zebra (J)"
            className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
              showClippingOverlay
                ? 'bg-[#EF4444]/20 border-[#EF4444] text-[#FCA5A5]'
                : 'bg-[#141418]/95 border-[#26262E] text-[#A1A1AA] hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center bg-[#141418]/95 border border-[#26262E] rounded-md overflow-hidden">
            <button
              type="button"
              onClick={() => setPanToolActive((v) => !v)}
              title="Pan image"
              className={`p-1.5 transition-colors cursor-pointer ${
                panToolActive ? 'bg-[#22C55E] text-[#051B0C]' : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                setZoom((z) => {
                  const n = Math.max(0.5, Number((z - 0.25).toFixed(2)));
                  if (n <= 1) setPan({x: 0, y: 0});
                  return n;
                })
              }
              title="Zoom Out"
              className="hidden sm:inline-flex p-1.5 text-[#A1A1AA] hover:text-white cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[11px] font-mono tabular-nums text-[#D4D4DC]">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(4, Number((z + 0.25).toFixed(2))))}
              title="Zoom In"
              className="hidden sm:inline-flex p-1.5 text-[#A1A1AA] hover:text-white cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({x: 0, y: 0});
                setPanToolActive(false);
              }}
              title="Fit to screen (0)"
              className="p-1.5 text-[#A1A1AA] hover:text-white border-l border-[#26262E] cursor-pointer"
            >
              <Maximize className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSplitMode((v) => !v)}
            className={`inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
              splitMode
                ? 'bg-[#22C55E]/15 border-[#22C55E]/50 text-[#22C55E]'
                : 'bg-[#141418]/95 border-[#26262E] text-[#D4D4DC] hover:bg-[#1E1E24]'
            }`}
          >
            <SplitSquareHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Split</span>
          </button>

          <button
            type="button"
            onPointerDown={() => setIsComparing(true)}
            onPointerUp={() => setIsComparing(false)}
            onPointerLeave={() => setIsComparing(false)}
            title="Hold to view original photo (or hold \ key)"
            className={`inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer whitespace-nowrap ${
              isComparing
                ? 'bg-[#22C55E] border-[#22C55E] text-[#051B0C]'
                : 'bg-[#141418]/95 border-[#26262E] text-[#D4D4DC] hover:bg-[#1E1E24]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isComparing ? 'Original' : 'Compare'}</span>
          </button>
        </div>
      </div>

      {/* Snapseed Floating Gesture HUD */}
      {gestureHud.visible && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="bg-[#121216]/95 border border-[#2C2C34] rounded-md px-4 py-2 shadow-xl flex items-center gap-4 min-w-[210px] justify-between">
            <span className="text-xs font-medium text-[#E4E4E7] whitespace-nowrap">
              {gestureHud.label}
            </span>
            <span className="text-sm font-mono tabular-nums font-semibold text-[#22C55E]">
              {gestureHud.value > 0 ? `+${gestureHud.value}` : gestureHud.value}
            </span>
          </div>
          {gestureHud.mode === 'vertical' && activeParameters.length > 1 && (
            <div className="mt-1.5 bg-[#121216]/95 border border-[#2C2C34] rounded-md py-1 px-2 flex flex-col gap-0.5">
              {activeParameters.map((p) => (
                <div
                  key={p.key}
                  className={`text-[11px] px-2 py-0.5 rounded ${
                    p.key === selectedParamKey
                      ? 'bg-[#22C55E]/20 text-[#22C55E] font-medium'
                      : 'text-[#8E8E98]'
                  }`}
                >
                  {p.label}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transformable Viewport Canvas Container */}
      <div
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
        }}
        className="relative flex items-center justify-center max-w-full max-h-full transition-transform duration-75"
      >
        <canvas
          ref={displayCanvasRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerLeave={() => setHoverRgb(null)}
          className={`max-w-full max-h-[38vh] lg:max-h-[calc(100vh-14.5rem)] w-auto h-auto object-contain rounded-sm shadow-[0_20px_60px_rgba(0,0,0,0.85)] ring-1 ring-white/10 touch-none ${canvasCursor}`}
        />

        {/* Perspective Alignment Grid Overlay */}
        {activeStep?.toolId === 'perspective' && !isComparing && (
          <div className="absolute inset-0 pointer-events-none grid grid-cols-4 grid-rows-4 z-10">
            {Array.from({length: 16}).map((_, idx) => (
              <div key={idx} className="border border-white/15" />
            ))}
          </div>
        )}

        {/* Interactive Draggable Crop Box Overlay */}
        {cropBox && !isComparing && (
          <div
            style={{
              left: `${cropBox.cropX * 100}%`,
              top: `${cropBox.cropY * 100}%`,
              width: `${cropBox.cropW * 100}%`,
              height: `${cropBox.cropH * 100}%`,
            }}
            onPointerDown={(e) => startCropDrag('move', e)}
            onPointerMove={moveCropDrag}
            onPointerUp={endCropDrag}
            className="absolute border-2 border-[#22C55E] shadow-[0_0_0_9999px_rgba(0,0,0,0.58)] cursor-move z-20 touch-none"
          >
            <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
              {Array.from({length: 9}).map((_, idx) => (
                <div key={idx} className="border border-white/20" />
              ))}
            </div>
            {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
              <div
                key={corner}
                onPointerDown={(e) => startCropDrag(corner, e)}
                onPointerMove={moveCropDrag}
                onPointerUp={endCropDrag}
                className={`absolute w-4 h-4 bg-[#22C55E] border-2 border-[#051B0C] rounded-xs ${
                  corner === 'tl'
                    ? '-top-2 -left-2 cursor-nwse-resize'
                    : corner === 'tr'
                    ? '-top-2 -right-2 cursor-nesw-resize'
                    : corner === 'bl'
                    ? '-bottom-2 -left-2 cursor-nesw-resize'
                    : '-bottom-2 -right-2 cursor-nwse-resize'
                }`}
              />
            ))}
          </div>
        )}

        {/* Portrait Face Target Overlay */}
        {portraitParams && !isComparing && (
          <div
            style={{
              left: `${portraitParams.faceX * 100}%`,
              top: `${portraitParams.faceY * 100}%`,
              width: `${portraitParams.faceRadius * 1.45}%`,
              aspectRatio: '1 / 1',
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[#22C55E]/75 pointer-events-none z-10 flex items-center justify-center"
          >
            <div className="px-2 py-0.5 rounded bg-[#0B0B0D]/80 border border-[#22C55E] text-[10px] font-mono text-[#22C55E]">
              Face Target
            </div>
          </div>
        )}

        {/* Vignette Center Handle */}
        {activeStep?.toolId === 'vignette' && !isComparing && !isMaskBrushMode && (
          <div
            style={{
              left: `${(activeStep.params as VignetteParams).centerX * 100}%`,
              top: `${(activeStep.params as VignetteParams).centerY * 100}%`,
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
          >
            <div className="w-7 h-7 rounded-full border-2 border-[#38BDF8] bg-[#38BDF8]/20 flex items-center justify-center shadow-md">
              <Move className="w-3.5 h-3.5 text-[#38BDF8]" />
            </div>
          </div>
        )}

        {/* Lens Blur Focus & Transition Rings */}
        {lensBlurParams && !isComparing && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
            {lensBlurParams.shape === 'circular' ? (
              <>
                <div
                  style={{
                    left: `${lensBlurParams.centerX * 100}%`,
                    top: `${lensBlurParams.centerY * 100}%`,
                    width: `${lensBlurParams.radius * 1.3}%`,
                    aspectRatio: '1 / 1',
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#38BDF8]/85"
                />
                <div
                  style={{
                    left: `${lensBlurParams.centerX * 100}%`,
                    top: `${lensBlurParams.centerY * 100}%`,
                    width: `${(lensBlurParams.radius + lensBlurParams.transition * 0.85) * 1.3}%`,
                    aspectRatio: '1 / 1',
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[#38BDF8]/50"
                />
              </>
            ) : (
              <>
                <div
                  style={{top: `${Math.max(5, lensBlurParams.centerY * 100 - lensBlurParams.radius * 0.4)}%`}}
                  className="absolute inset-x-0 h-[1px] bg-[#38BDF8]/80"
                />
                <div
                  style={{top: `${Math.min(95, lensBlurParams.centerY * 100 + lensBlurParams.radius * 0.4)}%`}}
                  className="absolute inset-x-0 h-[1px] bg-[#38BDF8]/80"
                />
              </>
            )}

            <div
              style={{
                left: `${lensBlurParams.centerX * 100}%`,
                top: `${lensBlurParams.centerY * 100}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-2 border-[#38BDF8] bg-[#38BDF8]/20 flex items-center justify-center shadow-md"
            >
              <div className="w-2 h-2 rounded-full bg-[#38BDF8]" />
            </div>
          </div>
        )}

        {/* Text Drag Handle */}
        {activeStep?.toolId === 'text' && !isComparing && (
          <div
            style={{
              left: `${(activeStep.params as TextParams).x * 100}%`,
              top: `${(activeStep.params as TextParams).y * 100}%`,
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
          >
            <div className="px-2 py-0.5 border border-dashed border-[#22C55E] rounded text-[10px] font-mono text-[#22C55E] bg-[#0B0B0D]/60">
              Drag text
            </div>
          </div>
        )}

        {/* Selective U-Point Nodes + Active Influence Radius Ring */}
        {activeStep?.toolId === 'selective' && !isComparing && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
            {activeSelectivePt && (
              <div
                style={{
                  left: `${activeSelectivePt.x * 100}%`,
                  top: `${activeSelectivePt.y * 100}%`,
                  width: `${activeSelectivePt.radius * 1.9}%`,
                  aspectRatio: '1 / 1',
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[#22C55E]/65 bg-[#22C55E]/[0.03]"
              />
            )}
            {(activeStep.params as SelectiveParams).points.map((pt, idx) => {
              const isSelected = pt.id === (activeStep.params as SelectiveParams).activePointId;
              return (
                <div
                  key={pt.id}
                  style={{
                    left: `${pt.x * 100}%`,
                    top: `${pt.y * 100}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                >
                  <div
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-mono font-semibold shadow-md transition-transform ${
                      isSelected
                        ? 'border-[#22C55E] bg-[#22C55E] text-[#051B0C] scale-110'
                        : 'border-[#F4F4F6] bg-[#121216]/85 text-[#F4F4F6]'
                    }`}
                  >
                    {idx + 1}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Split-Screen Wipe Handle */}
        {splitMode && !isComparing && (
          <div
            style={{left: `${splitPos * 100}%`}}
            onPointerDown={(e) => {
              e.stopPropagation();
              setIsDraggingSplit(true);
              (e.currentTarget as Element).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!isDraggingSplit || !displayCanvasRef.current) return;
              const rect = displayCanvasRef.current.getBoundingClientRect();
              const nx = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
              setSplitPos(nx);
            }}
            onPointerUp={(e) => {
              setIsDraggingSplit(false);
              try {
                (e.currentTarget as Element).releasePointerCapture(e.pointerId);
              } catch {
                // ignore
              }
            }}
            className="absolute inset-y-0 -translate-x-1/2 w-5 flex items-center justify-center cursor-ew-resize z-20 touch-none"
          >
            <div className="w-[2px] h-full bg-white/85 shadow" />
            <div className="absolute w-7 h-7 rounded-full bg-[#121216] border border-white/80 flex items-center justify-center shadow-lg text-[10px] font-mono text-white">
              ⇄
            </div>
            <span className="absolute top-2 right-4 px-1.5 py-0.5 bg-black/75 text-[10px] font-mono text-[#D4D4DC] rounded pointer-events-none">
              Original
            </span>
            <span className="absolute top-2 left-4 px-1.5 py-0.5 bg-black/75 text-[10px] font-mono text-[#22C55E] rounded pointer-events-none">
              Edited
            </span>
          </div>
        )}
      </div>

      {/* Bottom Gesture / Mode Hint */}
      <p className="mt-2 text-[11px] sm:text-xs text-[#71717A] text-center line-clamp-1">
        {isMaskBrushMode
          ? 'Mask Brush: paint on photo to reveal or erase this layer'
          : isEyedropper
          ? 'Eyedropper: click any neutral gray/white area on the photo'
          : activeStep?.toolId === 'portrait'
          ? 'Portrait: drag Face Target ring onto face · tune Spotlight, Skin & Eyes'
          : activeStep?.toolId === 'brush'
          ? 'Brush: paint strokes on photo · Opacity & Hardness in inspector'
          : activeStep?.toolId === 'healing'
          ? 'Healing: paint over blemishes to blend surrounding texture'
          : activeStep?.toolId === 'remover'
          ? 'Object Remover: paint cleanly over any unwanted object/person/wire to erase it'
          : activeStep?.toolId === 'enhance'
          ? 'HD Enhance: swipe horizontally to tune clarity, denoise & face restoration'
          : activeStep?.toolId === 'crop'
          ? 'Drag corner handles to crop · Aspect ratio locks automatically when selected'
          : activeStep?.toolId === 'doubleexposure'
          ? 'Drag on canvas to reposition overlay · Blend Mode & Opacity in inspector'
          : supportsVerticalSwipe && currentParamDesc
          ? `Swipe vertically to switch param · horizontally to tune ${currentParamDesc.label} · Pinch to zoom`
          : 'Drag & drop JPEG/PNG/DNG · Hold \\ to compare · Press J for Clipping'}
      </p>

      {/* Drag & Drop File Overlay */}
      {isDragOverFile && (
        <div className="absolute inset-4 rounded-xl border-2 border-dashed border-[#22C55E] bg-[#0B0B0D]/90 z-40 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <Upload className="w-8 h-8 text-[#22C55E]" />
          <p className="font-display text-base font-semibold text-[#F4F4F6]">
            Drop JPEG, PNG or DNG photo to open
          </p>
        </div>
      )}
    </div>
  );
};
