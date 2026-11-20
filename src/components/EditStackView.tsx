import React, {useEffect, useState} from 'react';
import {
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Trash2,
  SlidersHorizontal,
  RotateCcw,
  Paintbrush,
  Download,
  Upload,
  QrCode,
  Copy,
  Check,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import {TOOLS_CATALOG} from '../data/presets';
import {EditStackStep, Lut3DParams} from '../types/editor';

interface EditStackViewProps {
  stack: EditStackStep[];
  activeStepId: string | null;
  onToggleStep: (id: string) => void;
  onMoveStep: (id: string, dir: -1 | 1) => void;
  onEditStep: (id: string, openMaskBrush?: boolean) => void;
  onDeleteStep: (id: string) => void;
  onRevertAll: () => void;
  onImportRecipe: (steps: EditStackStep[]) => void;
}

function encodeUtf8Base64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeUtf8Base64(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function compactStackForQr(stack: EditStackStep[]): EditStackStep[] {
  return stack.map((step) => {
    const cloned = structuredClone(step);
    if (cloned.toolId === 'lut3d') {
      const lp = cloned.params as Lut3DParams;
      if (lp.customTable && lp.customTable.length > 0) {
        delete lp.customTable;
      }
    }
    return cloned;
  });
}

export const EditStackView: React.FC<EditStackViewProps> = ({
  stack,
  activeStepId,
  onToggleStep,
  onMoveStep,
  onEditStep,
  onDeleteStep,
  onRevertAll,
  onImportRecipe,
}) => {
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [shareCode, setShareCode] = useState<string>('');
  const [qrWarning, setQrWarning] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [importCodeText, setImportCodeText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!qrModalOpen || stack.length === 0) return;
    let cancelled = false;
    const compact = compactStackForQr(stack);
    const json = JSON.stringify({v: 1, s: compact});
    const code = `CHITRO1:${encodeUtf8Base64(json)}`;
    setShareCode(code);

    if (code.length > 2200) {
      setQrDataUrl('');
      setQrWarning(
        'This stack contains dense brush/LUT data exceeding QR capacity. Copy the Look Code or Export .json instead.'
      );
      return;
    }

    setQrWarning(null);
    QRCode.toDataURL(code, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {dark: '#09090B', light: '#F4F4F6'},
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl('');
          setQrWarning('Could not generate QR matrix for this recipe.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [qrModalOpen, stack]);

  const handleExportRecipe = () => {
    const payload = JSON.stringify(
      {
        app: 'Chitro Darkroom Recipe',
        version: 1,
        steps: stack,
      },
      null,
      2
    );
    const blob = new Blob([payload], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chitro-look-recipe.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (Array.isArray(parsed?.steps)) {
          onImportRecipe(parsed.steps);
        }
      } catch {
        // Ignore malformed JSON
      }
    };
    reader.readAsText(file);
  };

  const handleCopyShareCode = async () => {
    if (!shareCode) return;
    try {
      await navigator.clipboard.writeText(shareCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleApplyLookCode = () => {
    const trimmed = importCodeText.trim();
    if (!trimmed) return;
    try {
      if (trimmed.startsWith('CHITRO1:')) {
        const decoded = decodeUtf8Base64(trimmed.slice(8));
        const parsed = JSON.parse(decoded);
        if (Array.isArray(parsed?.s)) {
          onImportRecipe(parsed.s);
          setImportCodeText('');
          setImportError(null);
          setQrModalOpen(false);
          return;
        }
      } else {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed?.steps)) {
          onImportRecipe(parsed.steps);
          setImportCodeText('');
          setImportError(null);
          setQrModalOpen(false);
          return;
        }
      }
      setImportError('Unrecognized Look Code format.');
    } catch {
      setImportError('Invalid or corrupted Look Code.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto darkroom-scroll p-6 md:p-8 max-w-[960px] mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#222228] pb-5 mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#F4F4F6]">
            Non-Destructive Edit Stack
          </h1>
          <p className="text-sm text-[#8E8E98] mt-1">
            Reorder, toggle, mask with brush, or share your edit stack via QR code &amp; JSON recipe.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setQrModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#18181D] hover:bg-[#23232A] text-[#E4E4E7] border border-[#2C2C34] rounded-md cursor-pointer whitespace-nowrap"
          >
            <QrCode className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>QR Share / Paste Code</span>
          </button>

          <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#18181D] hover:bg-[#23232A] text-[#E4E4E7] border border-[#2C2C34] rounded-md cursor-pointer whitespace-nowrap">
            <Upload className="w-3.5 h-3.5" />
            <span>Import JSON</span>
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
                e.target.value = '';
              }}
            />
          </label>

          {stack.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportRecipe}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#18181D] hover:bg-[#23232A] text-[#E4E4E7] border border-[#2C2C34] rounded-md cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-[#22C55E]" />
                <span>Export JSON</span>
              </button>
              <button
                type="button"
                onClick={onRevertAll}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#18181D] hover:bg-[#23232A] text-[#E4E4E7] border border-[#2C2C34] rounded-md cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Revert All</span>
              </button>
            </>
          )}
        </div>
      </div>

      {stack.length === 0 ? (
        <div className="border border-[#222228] bg-[#111115] rounded-lg p-10 text-center space-y-2">
          <p className="font-display text-base font-semibold text-[#F4F4F6]">
            Original Negative Intact
          </p>
          <p className="text-sm text-[#8E8E98]">
            No adjustments have been stacked yet. Open the Darkroom or Looks tab to add layers.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-[#222228] bg-[#101014]">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono tabular-nums text-[#71717A] w-6">00</span>
              <div>
                <p className="text-sm font-medium text-[#D4D4DC]">Original Source Image</p>
                <p className="text-xs text-[#71717A]">Immutable base negative · Auto-saved</p>
              </div>
            </div>
            <span className="text-xs font-mono text-[#71717A]">Locked</span>
          </div>

          {stack.map((step, index) => {
            const isSelected = step.id === activeStepId;
            const meta = TOOLS_CATALOG.find((t) => t.id === step.toolId);
            const hasMask = Boolean(
              step.mask && (step.mask.inverted || step.mask.strokes.length > 0)
            );
            return (
              <div
                key={step.id}
                className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 px-4 py-3 rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-[#22C55E] bg-[#151D18]'
                    : 'border-[#222228] bg-[#141418] hover:border-[#32323B]'
                } ${!step.enabled ? 'opacity-55' : ''}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono tabular-nums text-[#71717A] w-6 shrink-0">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#F4F4F6] truncate">
                      {step.label}
                    </p>
                    <p className="text-xs text-[#8E8E98] font-mono truncate">
                      {step.enabled ? 'Active layer' : 'Bypassed'}
                      {hasMask ? ' · Custom brush mask' : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleStep(step.id)}
                    title={step.enabled ? 'Hide layer' : 'Show layer'}
                    className="p-2 text-[#A1A1AA] hover:text-[#F4F4F6] hover:bg-[#1F1F26] rounded cursor-pointer"
                  >
                    {step.enabled ? (
                      <Eye className="w-4 h-4 text-[#22C55E]" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveStep(step.id, -1)}
                    disabled={index === 0}
                    title="Move earlier"
                    className="p-2 text-[#A1A1AA] hover:text-[#F4F4F6] hover:bg-[#1F1F26] rounded disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveStep(step.id, 1)}
                    disabled={index === stack.length - 1}
                    title="Move later"
                    className="p-2 text-[#A1A1AA] hover:text-[#F4F4F6] hover:bg-[#1F1F26] rounded disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  {meta?.supportsLayerMask && (
                    <button
                      type="button"
                      onClick={() => onEditStep(step.id, true)}
                      title="Paint layer mask brush"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-[#1D1D23] hover:bg-[#272730] text-[#D4D4DC] rounded border border-[#2D2D36] cursor-pointer whitespace-nowrap"
                    >
                      <Paintbrush className="w-3.5 h-3.5 text-[#38BDF8]" />
                      <span>Mask</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onEditStep(step.id, false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#1D1D23] hover:bg-[#272730] text-[#F4F4F6] rounded border border-[#2D2D36] cursor-pointer whitespace-nowrap"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#22C55E]" />
                    <span>Tune</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteStep(step.id)}
                    title="Delete step"
                    className="p-2 text-[#8E8E98] hover:text-[#EF4444] hover:bg-[#1F1F26] rounded cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QR Code & Look Code Share/Import Modal */}
      {qrModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setQrModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#121216] border border-[#26262E] rounded-lg shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#222228]">
              <h2 className="font-display text-base font-semibold text-[#F4F4F6]">
                Share &amp; Apply Look Recipe
              </h2>
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                className="p-1 text-[#8E8E98] hover:text-[#F4F4F6] rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto darkroom-scroll">
              {stack.length > 0 && (
                <div className="space-y-3 border-b border-[#222228] pb-4">
                  <span className="block text-xs font-medium text-[#A1A1AA]">
                    Current Stack QR Look
                  </span>

                  {qrDataUrl && (
                    <div className="flex justify-center bg-[#F4F4F6] p-3 rounded-md w-fit mx-auto">
                      <img src={qrDataUrl} alt="Look Recipe QR Code" className="w-44 h-44" />
                    </div>
                  )}

                  {qrWarning && (
                    <p className="text-xs text-[#FACC15] bg-[#221F12] border border-[#3F3818] rounded p-2.5">
                      {qrWarning}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shareCode}
                      className="flex-1 px-2.5 py-1.5 text-[11px] font-mono bg-[#0B0B0D] border border-[#26262E] rounded text-[#A1A1AA]"
                    />
                    <button
                      type="button"
                      onClick={handleCopyShareCode}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#18181D] hover:bg-[#23232A] border border-[#2C2C34] text-[#F4F4F6] rounded cursor-pointer whitespace-nowrap"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                <label className="block text-xs font-medium text-[#A1A1AA]">
                  Apply Shared Look Code (Paste CHITRO1:... or JSON)
                </label>
                <textarea
                  rows={3}
                  value={importCodeText}
                  onChange={(e) => {
                    setImportCodeText(e.target.value);
                    setImportError(null);
                  }}
                  placeholder="Paste CHITRO1:... code here"
                  className="w-full px-3 py-2 text-xs font-mono bg-[#0B0B0D] border border-[#26262E] rounded text-[#F4F4F6] focus:outline-none focus:border-[#22C55E]"
                />
                {importError && <p className="text-xs text-[#EF4444]">{importError}</p>}
                <button
                  type="button"
                  onClick={handleApplyLookCode}
                  disabled={!importCodeText.trim()}
                  className="w-full py-2 text-xs font-semibold bg-[#22C55E] hover:bg-[#1EB054] text-[#051B0C] rounded-md disabled:opacity-40 cursor-pointer"
                >
                  Apply Look Code to Stack
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
