import React from 'react';
import { SubjectWeeklyStat } from '../types/dashboard';

interface DetailedBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  weeklyStats: SubjectWeeklyStat[];
}

export const DetailedBreakdownModal: React.FC<DetailedBreakdownModalProps> = ({
  isOpen,
  onClose,
  weeklyStats,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#c0c9c0]/40 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#e5eeff]">
          <div>
            <h3 className="text-base font-bold text-[#0b1c30]">Weekly Subject Breakdown</h3>
            <p className="text-xs text-[#404942]">Topics completed and remaining for each subject</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#707971] hover:text-[#0b1c30] hover:bg-[#eff4ff]"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="space-y-3">
          {weeklyStats.map((stat) => {
            const total = stat.done + stat.remaining;
            const percent = total > 0 ? Math.round((stat.done / total) * 100) : 0;

            return (
              <div
                key={stat.subject}
                className="p-3 rounded-xl bg-[#eff4ff] border border-[#c0c9c0]/30 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#0b1c30]">{stat.subject}</span>
                  <span className="font-mono text-[#404942] tabular-nums">
                    {stat.done} done / {stat.remaining} remaining ({percent}%)
                  </span>
                </div>

                <div className="w-full bg-[#e5eeff] h-2.5 rounded-full overflow-hidden flex">
                  <div
                    className="bg-[#003820] h-full transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                  <div
                    className="bg-[#6ffbbe] h-full transition-all duration-500"
                    style={{ width: `${100 - percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2 border-t border-[#e5eeff]">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#003820] text-white text-xs font-semibold rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
