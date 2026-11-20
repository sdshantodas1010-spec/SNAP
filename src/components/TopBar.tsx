import React from 'react';
import {WorkspaceTab} from '../types/editor';
import {PWAInstallButton} from './PWAInstallButton';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onOpenExport: () => void;
  hasImage: boolean;
}

const NAV_ITEMS: {id: WorkspaceTab; label: string}[] = [
  {id: 'darkroom', label: 'Darkroom'},
  {id: 'looks', label: 'Looks'},
  {id: 'stack', label: 'Edit Stack'},
  {id: 'guide', label: 'Build Guide'},
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenExport,
  hasImage,
}) => {
  return (
    <header className="h-14 shrink-0 border-b border-[#222228] bg-[#0E0E11] px-5 flex items-center justify-between gap-8">
      {/* Zone 1: Single-element Brand Wordmark */}
      <button
        type="button"
        onClick={() => onSelectTab('darkroom')}
        className="font-display text-lg font-bold tracking-tight text-[#F4F4F6] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] rounded-sm"
      >
        Chitro
      </button>

      {/* Zone 2: Clean single-line navigation links */}
      <nav className="flex items-center gap-6 overflow-x-auto no-scrollbar" aria-label="Workspace navigation">
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E] rounded-sm ${
                active ? 'text-[#F4F4F6]' : 'text-[#8E8E98] hover:text-[#D4D4DC]'
              }`}
            >
              {item.label}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-[15px] h-[2px] bg-[#22C55E]"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Actions */}
      <div className="shrink-0 flex items-center gap-2">
        <PWAInstallButton />
        <button
          type="button"
          onClick={onOpenExport}
          disabled={!hasImage}
          className="px-4 py-2 text-xs font-semibold bg-[#22C55E] text-[#051B0C] rounded-md hover:bg-[#1EB054] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C55E]"
        >
          Export Photo
        </button>
      </div>
    </header>
  );
};
