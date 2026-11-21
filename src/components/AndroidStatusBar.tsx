import React, { useState, useEffect } from 'react';
import { Wifi, BatteryMedium, Signal } from 'lucide-react';

export const AndroidStatusBar: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const [time, setTime] = useState<string>('09:41');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const mins = now.getMinutes().toString().padStart(2, '0');
      setTime(`${hours}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`h-7 px-5 flex items-center justify-between text-xs font-medium select-none tracking-tight transition-colors ${
        isDark ? 'bg-zinc-950 text-zinc-300' : 'bg-slate-100 text-slate-700'
      }`}
    >
      <span className="font-semibold">{time}</span>
      <div className="flex items-center gap-1.5 opacity-90">
        <Signal className="w-3.5 h-3.5" />
        <Wifi className="w-3.5 h-3.5" />
        <span className="text-[10px] ml-0.5 font-bold">5G</span>
        <BatteryMedium className="w-4 h-4 ml-1" />
      </div>
    </div>
  );
};
