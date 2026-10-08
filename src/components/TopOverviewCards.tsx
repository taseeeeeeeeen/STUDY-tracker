import React, { useState, useRef, useEffect } from 'react';
import { SubjectWeeklyStat, ActiveSprint, WeeklyBacklog } from '../types/dashboard';

interface TopOverviewCardsProps {
  completionPercentage: number;
  completedUnits: number;
  totalUnits: number;
  completedTopicsCount: number;
  totalTopicsCount: number;
  weeklyStats: SubjectWeeklyStat[];
  backlog: WeeklyBacklog;
  sprint: ActiveSprint;
  onReset?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

export const TopOverviewCards: React.FC<TopOverviewCardsProps> = ({
  completionPercentage,
  completedUnits,
  totalUnits,
  completedTopicsCount,
  totalTopicsCount,
  weeklyStats,
  backlog,
  sprint,
  onReset,
  onArchive,
  onDelete,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [confirmArchive, setConfirmArchive] = useState(false);
  const archiveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (archiveTimerRef.current) clearTimeout(archiveTimerRef.current);
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  const handleResetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onReset) return;

    if (!confirmReset) {
      setConfirmReset(true);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setConfirmReset(false);
      }, 4000);
    } else {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      setConfirmReset(false);
      onReset();
    }
  };

  const handleArchiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onArchive) return;

    if (!confirmArchive) {
      setConfirmArchive(true);
      if (archiveTimerRef.current) clearTimeout(archiveTimerRef.current);
      archiveTimerRef.current = setTimeout(() => {
        setConfirmArchive(false);
      }, 4000);
    } else {
      if (archiveTimerRef.current) clearTimeout(archiveTimerRef.current);
      setConfirmArchive(false);
      onArchive();
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;

    if (!confirmDelete) {
      setConfirmDelete(true);
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = setTimeout(() => {
        setConfirmDelete(false);
      }, 4000);
    } else {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      setConfirmDelete(false);
      onDelete();
    }
  };
  // Total remaining topics across all subjects
  const totalRemainingWeekly = weeklyStats.reduce((acc, s) => acc + s.remaining, 0);

  // Rounded completion percentage for clean typography
  const roundedPercent = Math.round(completionPercentage);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Card 1: Today's Task Completion */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-[#c0c9c0]/30 flex flex-col justify-between relative overflow-hidden group hover:shadow-sm transition-shadow">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-xs text-[#404942] uppercase tracking-wider font-semibold font-sans">
              Today's Goal
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl text-[#0b1c30] font-bold tracking-tight tabular-nums">
                {roundedPercent}%
              </span>
            </div>
            <p className="text-[11px] text-[#404942]">
              {completedUnits} of {totalUnits} study units completed
            </p>
          </div>

          {/* Circular Progress Ring */}
          <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
              {/* Background circle */}
              <path
                className="text-[#e5eeff]"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
              />
              {/* Progress stroke */}
              <path
                className="text-[#006c49] transition-all duration-700 ease-out"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeDasharray={`${Math.min(100, Math.max(0, roundedPercent))}, 100`}
                strokeLinecap="round"
                strokeWidth="3.5"
              />
            </svg>
            <span className="absolute text-xs font-bold text-[#0b1c30] tabular-nums">
              {completedTopicsCount}/{totalTopicsCount}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[#e5eeff]/80 flex items-center justify-between text-xs text-[#404942]">
          <span>
            {completedTopicsCount} of {totalTopicsCount} topics finished today
          </span>
          {completedTopicsCount === totalTopicsCount && totalTopicsCount > 0 ? (
            <span className="text-[#006c49] font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">check_circle</span> Completed
            </span>
          ) : completedTopicsCount > 0 ? (
            <span className="text-[#006c49] font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">trending_up</span> In Progress
            </span>
          ) : (
            <span className="text-[#707971] font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">schedule</span> Pending
            </span>
          )}
        </div>
      </div>

      {/* Card 2: Remaining Topics for this week */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-[#c0c9c0]/30 flex flex-col justify-between hover:shadow-sm transition-shadow">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#404942] uppercase tracking-wider font-semibold font-sans">
              Weekly Backlog
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#e5eeff] text-[#0b1c30] text-[11px] font-medium font-mono">
              Midterm Wk {backlog.midtermWeek}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl text-[#0b1c30] font-bold tracking-tight tabular-nums">
              {totalRemainingWeekly}
            </span>
            <span className="text-sm text-[#404942]">topics remaining</span>
          </div>
        </div>

        <div className="space-y-3 mt-3">
          {/* Dynamic Subject breakdown chips */}
          <div className="flex flex-wrap gap-1.5">
            {weeklyStats.map((stat) => (
              <span
                key={stat.subject}
                className="px-2 py-0.5 rounded-md bg-[#eff4ff] text-[#003820] text-xs font-medium tabular-nums border border-[#c0c9c0]/20"
              >
                {stat.remaining} {stat.subject}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between text-[#404942] text-xs pt-1 border-t border-[#e5eeff]/80">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-[#707971]">schedule</span>
              Target: {backlog.targetDay} {backlog.targetTime}
            </span>
            <span className="font-medium text-[#0b1c30]">{backlog.daysRemaining} days remaining</span>
          </div>
        </div>
      </div>

      {/* Card 3: Active Challenge Name & Days Left */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-[#c0c9c0]/30 flex flex-col justify-between hover:shadow-sm transition-shadow">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#404942] uppercase tracking-wider font-semibold font-sans">
              Active Sprint
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#6ffbbe]/30 text-[#003820] text-[11px] font-semibold">
              {sprint.phase}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg text-[#0b1c30] font-bold tracking-tight">
              {sprint.name}
            </span>
            <span className="text-sm text-[#006c49] font-bold tabular-nums">
              {sprint.daysLeft} Days Left
            </span>
          </div>
        </div>

        <div className="space-y-2 mt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#404942]">Progress</span>
            <span className="font-bold text-[#003820] tabular-nums">
              {Math.round((sprint.daysCompleted / sprint.totalDays) * 100)}% ({sprint.daysCompleted}/{sprint.totalDays} d)
            </span>
          </div>
          <div className="w-full bg-[#e5eeff] h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#003820] h-full rounded-full transition-all duration-700"
              style={{ width: `${(sprint.daysCompleted / sprint.totalDays) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[#006c49] text-xs pt-1">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">workspace_premium</span>
              <span>{sprint.rewardBadge}</span>
            </div>
            <div className="flex items-center gap-3">
              {onReset && (
                <button
                  type="button"
                  onClick={handleResetClick}
                  className={`text-xs font-semibold cursor-pointer transition-colors ${
                    confirmReset ? 'text-amber-700 font-bold' : 'text-[#707971] hover:text-[#0b1c30]'
                  }`}
                  title="Reset challenge topic progress and restart Day 1"
                >
                  {confirmReset ? 'Confirm reset?' : 'Reset'}
                </button>
              )}
              {onArchive && (
                <button
                  type="button"
                  onClick={handleArchiveClick}
                  className={`text-xs font-semibold cursor-pointer transition-colors ${
                    confirmArchive ? 'text-red-700 font-bold' : 'text-[#707971] hover:text-red-600'
                  }`}
                  title="Archive this sprint so you can start a new one"
                >
                  {confirmArchive ? 'Confirm archive?' : 'Archive'}
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className={`text-xs font-semibold cursor-pointer transition-colors ${
                    confirmDelete ? 'text-red-700 font-bold' : 'text-[#707971] hover:text-red-600'
                  }`}
                  title="Delete this sprint permanently"
                >
                  {confirmDelete ? 'Confirm delete?' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
