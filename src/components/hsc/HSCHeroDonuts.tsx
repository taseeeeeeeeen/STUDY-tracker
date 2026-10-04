import React from 'react';
import { HSCProgressSummary } from '../../types/hsc';

interface HSCHeroDonutsProps {
  summary: HSCProgressSummary;
}

export const HSCHeroDonuts: React.FC<HSCHeroDonutsProps> = ({ summary }) => {
  const {
    grandProgressPercent,
    overallTheoryPercent,
    overallPracticePercent,
    totalTopics,
    completedTopicsCount,
    completedTheoryCount,
    completedPracticeCount,
    totalChapters,
    completedChaptersCount,
    totalMCQs,
    completedMCQs,
    totalCQs,
    completedCQs,
  } = summary;

  // Master Radial Gauge (r=70 -> circumference = 439.82)
  const masterCircumference = 439.82;
  const masterOffset = masterCircumference * (1 - grandProgressPercent / 100);

  // Twin Sub-Donuts (r=32 -> circumference = 201.06)
  const subCircumference = 201.06;
  const theoryOffset = subCircumference * (1 - overallTheoryPercent / 100);
  const practiceOffset = subCircumference * (1 - overallPracticePercent / 100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Left/Center Hero: Total HSC Curriculum Completion (8 cols) */}
      <div className="lg:col-span-8 bg-white rounded-2xl p-6 sm:p-8 shadow-xs border border-[#c0c9c0]/30 flex flex-col justify-between">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-3 border-b border-[#e5eeff]/80">
          <div>
            <span className="text-[11px] text-[#006c49] uppercase tracking-wider font-semibold font-mono">
              Overall Syllabus
            </span>
            <h2 className="text-xl text-[#0b1c30] font-bold tracking-tight">
              HSC Syllabus Completion
            </h2>
          </div>
          <div className="flex items-center gap-1.5 bg-[#6ffbbe]/25 text-[#003820] px-3 py-1 rounded-full self-start sm:self-auto border border-[#6ffbbe]/80">
            <span className="material-symbols-outlined text-sm font-semibold text-[#006c49]">
              trending_up
            </span>
            <span className="text-xs font-semibold font-mono">Weekly progress</span>
          </div>
        </div>

        {/* Main Chart Display & Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 my-6 items-center">
          {/* Master Radial Gauge SVG */}
          <div className="md:col-span-5 flex flex-col items-center justify-center relative">
            <div className="relative w-52 h-52 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                {/* Background track */}
                <circle
                  className="text-[#e5eeff]"
                  cx="80"
                  cy="80"
                  fill="transparent"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                />
                {/* Master completed ring */}
                <circle
                  className="text-[#003820] transition-all duration-700 ease-out"
                  cx="80"
                  cy="80"
                  fill="transparent"
                  r="70"
                  stroke="currentColor"
                  strokeDasharray={masterCircumference}
                  strokeDashoffset={Math.max(0, masterOffset)}
                  strokeLinecap="round"
                  strokeWidth="12"
                />
                {/* Secondary inner ring: Theory baseline */}
                <circle
                  className="text-[#006c49] opacity-40 transition-all duration-700 ease-out"
                  cx="80"
                  cy="80"
                  fill="transparent"
                  r="56"
                  stroke="currentColor"
                  strokeDasharray="351.86"
                  strokeDashoffset={351.86 * (1 - overallTheoryPercent / 100)}
                  strokeLinecap="round"
                  strokeWidth="4"
                />
              </svg>

              {/* Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
                <span className="text-4xl text-[#003820] font-extrabold tracking-tight font-mono tabular-nums">
                  {Math.round(grandProgressPercent)}%
                </span>
                <span className="text-[11px] text-[#404942] font-semibold uppercase tracking-wider">
                  Overall Progress
                </span>
              </div>
            </div>

            <div className="mt-2 text-center">
              <span className="text-base text-[#0b1c30] font-bold tabular-nums">
                {completedTopicsCount} of {totalTopics} Topics
              </span>
              <p className="text-xs text-[#404942]">Across Physics, Chemistry, Math & Biology</p>
            </div>
          </div>

          {/* Micro Analytics Columns */}
          <div className="md:col-span-7 flex flex-col justify-center gap-3">
            <div className="bg-[#eff4ff] rounded-xl p-3.5 flex items-center justify-between border border-[#c0c9c0]/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#003820] text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">menu_book</span>
                </div>
                <div>
                  <div className="text-xs text-[#0b1c30] font-semibold">
                    Completed Chapters
                  </div>
                  <div className="text-[11px] text-[#404942]">
                    {completedChaptersCount} of {totalChapters} chapters completed
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base text-[#003820] font-bold font-mono tabular-nums">
                  {totalChapters > 0
                    ? ((completedChaptersCount / totalChapters) * 100).toFixed(1)
                    : '0.0'}%
                </span>
              </div>
            </div>

            <div className="bg-[#eff4ff] rounded-xl p-3.5 flex items-center justify-between border border-[#c0c9c0]/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#006c49] text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">quiz</span>
                </div>
                <div>
                  <div className="text-xs text-[#0b1c30] font-semibold">
                    MCQ Practice
                  </div>
                  <div className="text-[11px] text-[#404942]">
                    {completedMCQs.toLocaleString()} of {totalMCQs.toLocaleString()} questions practiced
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base text-[#006c49] font-bold font-mono tabular-nums">
                  {totalMCQs > 0 ? ((completedMCQs / totalMCQs) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
            </div>

            <div className="bg-[#eff4ff] rounded-xl p-3.5 flex items-center justify-between border border-[#c0c9c0]/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#0a503d] text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">draw</span>
                </div>
                <div>
                  <div className="text-xs text-[#0b1c30] font-semibold">
                    CQ Practice
                  </div>
                  <div className="text-[11px] text-[#404942]">
                    {completedCQs} of {totalCQs} creative questions solved
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base text-[#0a503d] font-bold font-mono tabular-nums">
                  {totalCQs > 0 ? ((completedCQs / totalCQs) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pair of Side-by-Side Radial Charts: Theory vs Practice */}
        <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#e5eeff]/80">
          {/* Donut 2: Overall Theory Mastery */}
          <div className="bg-[#eff4ff] rounded-xl p-4 flex items-center gap-4 border border-[#c0c9c0]/30">
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                <circle
                  className="text-[#e5eeff]"
                  cx="40"
                  cy="40"
                  fill="transparent"
                  r="32"
                  stroke="currentColor"
                  strokeWidth="7"
                />
                <circle
                  className="text-[#003820] transition-all duration-700 ease-out"
                  cx="40"
                  cy="40"
                  fill="transparent"
                  r="32"
                  stroke="currentColor"
                  strokeDasharray={subCircumference}
                  strokeDashoffset={Math.max(0, theoryOffset)}
                  strokeLinecap="round"
                  strokeWidth="7"
                />
              </svg>
              <span className="absolute text-xs text-[#0b1c30] font-bold font-mono tabular-nums">
                {Math.round(overallTheoryPercent)}%
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-[#0b1c30] font-bold truncate">
                Theory Coverage
              </span>
              <span className="text-[11px] text-[#404942]">
                {completedTheoryCount}/{totalTopics} Topics Completed
              </span>
              <div className="flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#003820]" />
                <span className="text-[10px] text-[#003820] font-medium font-mono">
                  Textbook Concepts
                </span>
              </div>
            </div>
          </div>

          {/* Donut 3: Practice & Test Drills */}
          <div className="bg-[#eff4ff] rounded-xl p-4 flex items-center gap-4 border border-[#c0c9c0]/30">
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                <circle
                  className="text-[#e5eeff]"
                  cx="40"
                  cy="40"
                  fill="transparent"
                  r="32"
                  stroke="currentColor"
                  strokeWidth="7"
                />
                <circle
                  className="text-[#006c49] transition-all duration-700 ease-out"
                  cx="40"
                  cy="40"
                  fill="transparent"
                  r="32"
                  stroke="currentColor"
                  strokeDasharray={subCircumference}
                  strokeDashoffset={Math.max(0, practiceOffset)}
                  strokeLinecap="round"
                  strokeWidth="7"
                />
              </svg>
              <span className="absolute text-xs text-[#0b1c30] font-bold font-mono tabular-nums">
                {Math.round(overallPracticePercent)}%
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-[#0b1c30] font-bold truncate">
                Practice Coverage
              </span>
              <span className="text-[11px] text-[#404942]">
                {completedPracticeCount}/{totalTopics} Problem Sets Done
              </span>
              <div className="flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#006c49]" />
                <span className="text-[10px] text-[#006c49] font-medium font-mono">
                  Problem Sets & Drills
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Complementary Card: Board Exam Readiness (4 cols) */}
      <div className="lg:col-span-4 bg-white rounded-2xl p-6 sm:p-8 shadow-xs border border-[#c0c9c0]/30 flex flex-col justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#404942] uppercase tracking-wider font-semibold font-mono">
              Estimated Readiness
            </span>
            <span className="bg-[#eff4ff] text-[#003820] px-2 py-0.5 rounded text-[11px] font-semibold border border-[#c0c9c0]/30 font-mono">
              HSC Standard
            </span>
          </div>
          <h2 className="text-lg text-[#0b1c30] font-bold">Board Exam Readiness</h2>
          <p className="text-xs text-[#404942]">
            Based on your syllabus completion and practice question coverage.
          </p>
        </div>

        {/* Grade Display Banner */}
        <div className="my-5 p-5 rounded-2xl bg-gradient-to-br from-[#0f5132] via-[#003820] to-[#002111] text-white flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="flex flex-col relative z-10">
            <span className="text-[11px] text-[#95d4ac] font-semibold uppercase tracking-wider font-mono">
              Target Range
            </span>
            <span className="text-4xl font-extrabold tracking-tight">
              Grade {grandProgressPercent >= 80 ? 'A+' : grandProgressPercent >= 70 ? 'A' : 'A-'}
            </span>
            <span className="text-xs text-white/90 mt-1">
              {(85 + (grandProgressPercent / 100) * 14).toFixed(1)}th Percentile
            </span>
          </div>
          <div className="relative z-10 text-right">
            <span className="material-symbols-outlined text-4xl text-[#6ffbbe]">
              workspace_premium
            </span>
            <div className="text-xs font-semibold text-[#6ffbbe] mt-1 font-mono">
              GPA 5.00 GOAL
            </div>
          </div>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        </div>

        {/* Metric Checklist Rows */}
        <div className="flex flex-col gap-2.5 text-xs">
          <div className="flex items-center justify-between py-1 border-b border-[#e5eeff]/80">
            <div className="flex items-center gap-2 text-[#404942]">
              <span className="material-symbols-outlined text-base text-[#006c49]">schedule</span>
              <span className="text-[#0b1c30]">Daily Study Time</span>
            </div>
            <span className="font-bold text-[#0b1c30] font-mono">2.8 hrs/day</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-[#e5eeff]/80">
            <div className="flex items-center gap-2 text-[#404942]">
              <span className="material-symbols-outlined text-base text-[#006c49]">
                assignment_turned_in
              </span>
              <span className="text-[#0b1c30]">Past Papers Solved</span>
            </div>
            <span className="font-bold text-[#0b1c30] font-mono">12 Papers</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-[#e5eeff]/80">
            <div className="flex items-center gap-2 text-[#404942]">
              <span className="material-symbols-outlined text-base text-[#006c49]">
                check_circle
              </span>
              <span className="text-[#0b1c30]">CQ Practice Accuracy</span>
            </div>
            <span className="font-bold text-[#0b1c30] font-mono">88.5%</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 text-[#404942]">
              <span className="material-symbols-outlined text-base text-[#006c49]">
                history_toggle_off
              </span>
              <span className="text-[#0b1c30]">Avg. Time per MCQ</span>
            </div>
            <span className="font-bold text-[#0b1c30] font-mono">48 sec</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 mt-2">
          <button
            type="button"
            className="w-full bg-[#eff4ff] hover:bg-[#e5eeff] text-[#003820] text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-[#c0c9c0]/30 cursor-pointer"
          >
            <span>Simulate Dhaka Board Exam</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};
