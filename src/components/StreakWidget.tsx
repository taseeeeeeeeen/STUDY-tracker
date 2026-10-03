import React from 'react';

interface StreakWidgetProps {
  streakDays: number;
}

export const StreakWidget: React.FC<StreakWidgetProps> = ({ streakDays }) => {
  const weekDays = [
    { day: 'M', completed: true, isToday: false },
    { day: 'T', completed: true, isToday: false },
    { day: 'W', completed: true, isToday: false },
    { day: 'T', completed: true, isToday: true },
    { day: 'F', completed: false, isToday: false },
    { day: 'S', completed: false, isToday: false },
    { day: 'S', completed: false, isToday: false },
  ];

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xs border border-[#c0c9c0]/30 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#6ffbbe]/30 flex items-center justify-center text-[#006c49]">
            <span className="material-symbols-outlined text-lg">local_fire_department</span>
          </div>
          <div>
            <h4 className="text-sm text-[#0b1c30] font-bold leading-none">
              {streakDays}-Day Streak
            </h4>
            <span className="text-[11px] text-[#404942]">Personal record: 18 days</span>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full bg-[#eff4ff] text-[#0b1c30] text-[11px] font-semibold font-mono">
          Oct 13 - Oct 24
        </span>
      </div>

      {/* 7-Day Dot Week Bar */}
      <div className="flex items-center justify-between pt-1">
        {weekDays.map((item, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span
              className={`text-xs font-mono ${
                item.isToday ? 'text-[#0b1c30] font-bold' : 'text-[#404942]'
              }`}
            >
              {item.day}
            </span>

            {item.isToday ? (
              <div className="w-7 h-7 rounded-full bg-[#003820] text-white flex items-center justify-center font-bold shadow-xs ring-2 ring-[#6ffbbe]">
                <span className="material-symbols-outlined text-xs">local_fire_department</span>
              </div>
            ) : item.completed ? (
              <div className="w-7 h-7 rounded-full bg-[#006c49] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                <span className="material-symbols-outlined text-xs">check</span>
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#eff4ff] text-[#707971] flex items-center justify-center text-xs">
                •
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom Motivational Micro-Banner */}
      <div className="p-2.5 rounded-xl bg-[#eff4ff] flex items-center justify-between text-xs text-[#0b1c30]">
        <span className="flex items-center gap-1.5 text-[#404942]">
          <span className="material-symbols-outlined text-sm text-[#006c49]">verified</span>
          Daily goal met 4/4 days this week
        </span>
        <span className="font-bold text-[#003820]">Top 5%</span>
      </div>
    </div>
  );
};
