import React, { useState } from 'react';
import { SubjectWeeklyStat } from '../types/dashboard';

interface WeeklyProgressChartProps {
  weeklyStats: SubjectWeeklyStat[];
  onOpenBreakdown?: () => void;
}

export const WeeklyProgressChart: React.FC<WeeklyProgressChartProps> = ({
  weeklyStats,
  onOpenBreakdown,
}) => {
  const [hoveredSubject, setHoveredSubject] = useState<string | null>(null);

  // Overall calculations
  const totalDone = weeklyStats.reduce((sum, s) => sum + s.done, 0);
  const totalTopics = weeklyStats.reduce((sum, s) => sum + s.done + s.remaining, 0);
  const overallPercentage = totalTopics > 0 ? Math.round((totalDone / totalTopics) * 100) : 0;

  // Chart layout geometry
  const chartHeight = 160;
  const baselineY = 125;
  const maxBarHeight = 90;
  // Maximum possible value for scale normalization
  const maxScaleValue = Math.max(15, ...weeklyStats.map((s) => s.done + s.remaining));

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xs border border-[#c0c9c0]/30 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base text-[#0b1c30] font-semibold tracking-tight">
            Weekly Progress
          </h3>
          <p className="text-xs text-[#404942]">Topics Done vs. Remaining</p>
        </div>

        {/* Chart Legend */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#003820]" />
            <span className="text-[#404942]">Done</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#6ffbbe] border border-[#006c49]/20" />
            <span className="text-[#404942]">Remaining</span>
          </div>
        </div>
      </div>

      {/* SVG Vertical Bar Chart */}
      <div className="pt-2 relative">
        <svg
          className="w-full h-44 transition-all duration-300 select-none"
          preserveAspectRatio="none"
          viewBox="0 0 320 160"
        >
          {/* Subtle Grid horizontal guide lines */}
          <line
            className="text-[#e5eeff]"
            stroke="currentColor"
            strokeDasharray="2 2"
            strokeWidth="1"
            x1="0"
            x2="320"
            y1="30"
            y2="30"
          />
          <line
            className="text-[#e5eeff]"
            stroke="currentColor"
            strokeDasharray="2 2"
            strokeWidth="1"
            x1="0"
            x2="320"
            y1="75"
            y2="75"
          />
          <line
            className="text-[#e5eeff]"
            stroke="currentColor"
            strokeDasharray="2 2"
            strokeWidth="1"
            x1="0"
            x2="320"
            y1="120"
            y2="120"
          />

          {/* Render Subject Vertical Stacked Bars */}
          {weeklyStats.map((item, index) => {
            const barWidth = 20;
            // 7 bars evenly spaced across 320px
            const startX = 18;
            const stepX = 42;
            const x = startX + index * stepX;
            const centerX = x + barWidth / 2;

            // Mathematical calculation of heights
            const doneHeight = (item.done / maxScaleValue) * maxBarHeight;
            const remainingHeight = (item.remaining / maxScaleValue) * maxBarHeight;

            const doneY = baselineY - doneHeight;
            const remainingY = doneY - remainingHeight;
            const textY = Math.max(12, remainingY - 5);

            const isHovered = hoveredSubject === item.subject;

            return (
              <g
                key={item.subject}
                onMouseEnter={() => setHoveredSubject(item.subject)}
                onMouseLeave={() => setHoveredSubject(null)}
                className="cursor-pointer transition-opacity"
                opacity={hoveredSubject && !isHovered ? 0.6 : 1}
              >
                {/* Done Bar (Bottom segment) */}
                <rect
                  className="fill-[#003820] transition-all duration-500 ease-out"
                  height={Math.max(2, doneHeight)}
                  rx="3"
                  width={barWidth}
                  x={x}
                  y={doneY}
                />

                {/* Remaining Bar (Top segment stacked above Done) */}
                {item.remaining > 0 && (
                  <rect
                    className="fill-[#6ffbbe] transition-all duration-500 ease-out"
                    height={Math.max(2, remainingHeight)}
                    rx="3"
                    width={barWidth}
                    x={x}
                    y={remainingY}
                  />
                )}

                {/* Subject Label below baseline */}
                <text
                  className="fill-[#404942] font-mono text-[10px] font-medium"
                  textAnchor="middle"
                  x={centerX}
                  y="142"
                >
                  {item.label}
                </text>

                {/* Metric text above stacked bar: Done / Remaining */}
                <text
                  className="fill-[#003820] font-mono font-bold text-[9px] transition-all duration-500"
                  textAnchor="middle"
                  x={centerX}
                  y={textY}
                >
                  {item.done}/{item.remaining}
                </text>
              </g>
            );
          })}
        </svg>

        {hoveredSubject && (
          <div className="absolute top-0 right-2 bg-[#003820] text-white text-[11px] px-2.5 py-1 rounded-md shadow-md animate-in fade-in">
            {weeklyStats.find((s) => s.subject === hoveredSubject)?.subject}:{' '}
            {weeklyStats.find((s) => s.subject === hoveredSubject)?.done} done,{' '}
            {weeklyStats.find((s) => s.subject === hoveredSubject)?.remaining} remaining
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-[#e5eeff]/80 flex items-center justify-between text-xs text-[#404942]">
        <span className="tabular-nums font-medium">
          Overall subject completion:{' '}
          <strong className="text-[#003820]">{overallPercentage}%</strong> ({totalDone}/{totalTopics})
        </span>
        <button
          onClick={onOpenBreakdown}
          className="text-[#006c49] font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
        >
          Detailed Breakdown{' '}
          <span className="material-symbols-outlined text-xs">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};
