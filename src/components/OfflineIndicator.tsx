import React from 'react';
import {WifiOff} from 'lucide-react';
import {useOnlineStatus} from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-md bg-[#18181D] border border-[#F59E0B]/50 px-3 py-1.5 text-xs font-medium text-[#FCD34D] shadow-lg">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline Mode — Darkroom runs 100% locally</span>
    </div>
  );
};
