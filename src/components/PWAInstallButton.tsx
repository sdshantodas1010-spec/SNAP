import React, {useState} from 'react';
import {Download, Smartphone, X} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        title="Install Chitro Darkroom as an offline app"
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#15151C] hover:bg-[#1E1E27] text-[#F4F4F6] border border-white/[0.08] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
      >
        <Download className="w-3.5 h-3.5 text-[#22C55E]" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#15151C] hover:bg-[#1E1E27] text-[#F4F4F6] border border-white/[0.08] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#22C55E]" />
          <span>Install</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-lg bg-[#121216] border border-[#26262E] p-5 shadow-2xl space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-semibold text-[#F4F4F6]">
                  Install on iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-[#8E8E98] hover:text-white rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-[#A1A1AA] leading-relaxed">
                1. Tap the <strong className="text-[#F4F4F6]">Share</strong> icon in Safari&apos;s toolbar.
                <br />
                2. Scroll down and tap <strong className="text-[#F4F4F6]">Add to Home Screen</strong>.
                <br />
                3. Launch <strong className="text-[#22C55E]">Chitro</strong> anytime offline.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-md bg-[#22C55E] py-2 text-xs font-semibold text-[#051B0C] hover:bg-[#1EB054] cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
