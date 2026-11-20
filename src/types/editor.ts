export type WorkspaceTab = 'darkroom' | 'looks' | 'stack' | 'guide';

export type ToolId =
  | 'tune'
  | 'details'
  | 'curves'
  | 'whitebalance'
  | 'crop'
  | 'perspective'
  | 'expand'
  | 'selective'
  | 'brush'
  | 'healing'
  | 'remover'
  | 'portrait'
  | 'enhance'
  | 'vignette'
  | 'lensblur'
  | 'hdrscape'
  | 'tonalcontrast'
  | 'glamourglow'
  | 'drama'
  | 'vintage'
  | 'retrolux'
  | 'noir'
  | 'bw'
  | 'grain'
  | 'lut3d'
  | 'doubleexposure'
  | 'text'
  | 'frames';

export interface TuneParams {
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  ambiance: number; // -100 to 100
  highlights: number; // -100 to 100
  shadows: number; // -100 to 100
  warmth: number; // -100 to 100
}

export interface DetailsParams {
  structure: number; // 0 to 100
  sharpening: number; // 0 to 100
}

export interface CurvePoint {
  x: number; // 0 to 255
  y: number; // 0 to 255
}

export type CurveChannel = 'rgb' | 'r' | 'g' | 'b';

export interface CurvesParams {
  rgb: CurvePoint[];
  r: CurvePoint[];
  g: CurvePoint[];
  b: CurvePoint[];
}

export interface WhiteBalanceParams {
  temperature: number; // -100 to 100
  tint: number; // -100 to 100
  eyedropperActive?: boolean;
}

export type AspectRatioOption = 'free' | '1:1' | '4:3' | '3:2' | '16:9' | '3:4';

export interface CropParams {
  aspectRatio: AspectRatioOption;
  rotation90: number; // 0, 90, 180, 270
  straighten: number; // -45 to 45
  flipH: boolean;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
}

export interface PerspectiveParams {
  verticalTilt: number; // -45 to 45
  horizontalTilt: number; // -45 to 45
  scale: number; // 80 to 140
}

export type ExpandFillMode = 'smart' | 'white' | 'black';

export interface ExpandParams {
  fillMode: ExpandFillMode;
  top: number; // 0 to 30 (%)
  bottom: number; // 0 to 30 (%)
  left: number; // 0 to 30 (%)
  right: number; // 0 to 30 (%)
}

export interface SelectivePoint {
  id: string;
  x: number;
  y: number;
  radius: number;
  tolerance: number;
  brightness: number;
  contrast: number;
  saturation: number;
}

export interface SelectiveParams {
  points: SelectivePoint[];
  activePointId: string | null;
}

export type BrushMode = 'dodgeburn' | 'exposure' | 'temperature' | 'saturation' | 'eraser';

export interface BrushStroke {
  id: string;
  mode: BrushMode;
  strength: number; // -10 to 10
  size: number; // 2 to 20
  opacity: number; // 10 to 100
  hardness: number; // 0 to 100
  points: Array<{x: number; y: number}>;
}

export interface BrushParams {
  activeMode: BrushMode;
  activeStrength: number;
  brushSize: number;
  opacity: number; // 10 to 100
  hardness: number; // 0 to 100
  strokes: BrushStroke[];
}

export interface HealingSpot {
  id: string;
  points: Array<{x: number; y: number}>;
  radius: number;
}

export interface HealingParams {
  brushSize: number;
  spots: HealingSpot[];
}

export interface PortraitParams {
  faceX: number; // 0 to 1
  faceY: number; // 0 to 1
  faceRadius: number; // 15 to 60
  faceSpotlight: number; // -50 to 100
  skinSmoothing: number; // 0 to 100
  eyeClarity: number; // 0 to 100
}

export interface EnhanceParams {
  upscale: '1x' | '2x';
  clarity: number; // 0 to 100
  denoise: number; // 0 to 100
  faceRestore: number; // 0 to 100
}

export interface RemoverRegion {
  id: string;
  size: number; // 3 to 25
  points: Array<{x: number; y: number}>;
}

export interface RemoverParams {
  brushSize: number; // 3 to 25
  feather: number; // 0 to 100
  regions: RemoverRegion[];
}

export interface VignetteParams {
  centerX: number;
  centerY: number;
  radius: number;
  outerBrightness: number;
  innerBrightness: number;
}

export type LensBlurShape = 'circular' | 'linear';

export interface LensBlurParams {
  shape: LensBlurShape;
  centerX: number;
  centerY: number;
  radius: number;
  transition: number;
  blurStrength: number;
  vignetteStrength: number;
}

export type HdrStyle = 'nature' | 'people' | 'fine' | 'strong';

export interface HdrScapeParams {
  style: HdrStyle;
  strength: number;
  brightness: number;
  saturation: number;
}

export interface TonalContrastParams {
  highTones: number;
  midTones: number;
  lowTones: number;
  protectShadows: number;
  protectHighlights: number;
}

export interface GlamourGlowParams {
  glow: number;
  saturation: number;
  warmth: number;
}

export interface DramaParams {
  strength: number;
  saturation: number;
}

export type VintageStyle = 'warm70' | 'coolfuji' | 'retrofade' | 'kodachrome';

export interface VintageParams {
  style: VintageStyle;
  strength: number;
  brightness: number;
  saturation: number;
  vignette: number;
}

export type RetroluxStyle = 'sunnyleak' | 'amberburn' | 'duststrip' | 'vintage70';

export interface RetroluxParams {
  style: RetroluxStyle;
  brightness: number;
  saturation: number;
  contrast: number;
  styleStrength: number;
  scratches: number;
  lightLeaks: number;
}

export type NoirStyle = 'silver' | 'contrast' | 'wash' | 'deep';

export interface NoirParams {
  style: NoirStyle;
  brightness: number;
  wash: number;
  grain: number;
  filterStrength: number;
}

export type BWFilter = 'neutral' | 'red' | 'orange' | 'yellow' | 'green';

export interface BWParams {
  filter: BWFilter;
  brightness: number;
  contrast: number;
  grain: number;
}

export interface GrainParams {
  grain: number;
  styleStrength: number;
}

export type BuiltInLutId = 'tealorange' | 'kodak2383' | 'fujieterna' | 'bleachbypass' | 'custom';

export interface Lut3DParams {
  preset: BuiltInLutId;
  customName?: string;
  customSize?: number;
  customTable?: number[]; // flattened RGB triplets [0..1]
  strength: number; // 0 to 100
}

export type DoubleExposureBlend = 'add' | 'multiply' | 'screen' | 'overlay' | 'lighten' | 'darken';

export interface DoubleExposureParams {
  overlaySrc: string;
  blendMode: DoubleExposureBlend;
  opacity: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export type TextStylePreset = 'clean' | 'editorial' | 'badge' | 'stamp';

export interface TextParams {
  content: string;
  style: TextStylePreset;
  color: string;
  size: number;
  opacity: number;
  x: number;
  y: number;
}

export type FrameStyle = 'none' | 'thin-black' | 'gallery-white' | 'polaroid' | 'film';

export interface FramesParams {
  style: FrameStyle;
  width: number;
}

export type ToolParamsMap = {
  tune: TuneParams;
  details: DetailsParams;
  curves: CurvesParams;
  whitebalance: WhiteBalanceParams;
  crop: CropParams;
  perspective: PerspectiveParams;
  expand: ExpandParams;
  selective: SelectiveParams;
  brush: BrushParams;
  healing: HealingParams;
  remover: RemoverParams;
  portrait: PortraitParams;
  enhance: EnhanceParams;
  vignette: VignetteParams;
  lensblur: LensBlurParams;
  hdrscape: HdrScapeParams;
  tonalcontrast: TonalContrastParams;
  glamourglow: GlamourGlowParams;
  drama: DramaParams;
  vintage: VintageParams;
  retrolux: RetroluxParams;
  noir: NoirParams;
  bw: BWParams;
  grain: GrainParams;
  lut3d: Lut3DParams;
  doubleexposure: DoubleExposureParams;
  text: TextParams;
  frames: FramesParams;
};

export interface MaskStroke {
  id: string;
  points: Array<{x: number; y: number}>;
  size: number;
  opacity?: number; // 10..100
  hardness?: number; // 0..100
  erase: boolean;
}

export interface LayerMask {
  inverted: boolean;
  strokes: MaskStroke[];
}

export interface EditStackStep<T extends ToolId = ToolId> {
  id: string;
  toolId: T;
  label: string;
  enabled: boolean;
  params: ToolParamsMap[T];
  mask?: LayerMask;
}

export interface LookPreset {
  id: string;
  name: string;
  description: string;
  steps: Array<{
    toolId: ToolId;
    label: string;
    params: ToolParamsMap[ToolId];
  }>;
}

export interface SamplePhoto {
  id: string;
  title: string;
  category: string;
  src: string;
  cameraMeta: string;
}

export interface ExifMetadata {
  camera?: string;
  iso?: string;
  aperture?: string;
  shutter?: string;
  focalLength?: string;
  dateTaken?: string;
  isRaw?: boolean;
}

export interface HistogramData {
  r: number[];
  g: number[];
  b: number[];
  l: number[];
  shadowClipPct?: number;
  highlightClipPct?: number;
}

export interface ParameterDescriptor {
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
}
