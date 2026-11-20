import React from 'react';
import {WifiOff} from 'lucide-react';
import {useOnlineStatus} from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-16 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-[#14141B]/95 backdrop-blur-md border border-[#F59E0B]/40 px-3 py-1.5 text-xs font-medium text-[#FCD34D] shadow-xl">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline Mode — Darkroom runs 100% locally</span>
    </div>
  );
};
