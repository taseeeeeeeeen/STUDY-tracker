import React, { useState } from 'react';
import { Task } from '../types/dashboard';

interface ActionZoneProps {
  tasks: Task[];
  currentTime: number;
  timeOffsetHours: number;
  onToggleTheory: (taskId: string) => void;
  onTogglePractice: (taskId: string) => void;
  onOpenAddTopic: () => void;
  onFastForwardTime: (hours: number) => void;
  onResetTime: () => void;
}

export const ActionZone: React.FC<ActionZoneProps> = ({
  tasks,
  currentTime,
  timeOffsetHours,
  onToggleTheory,
  onTogglePractice,
  onOpenAddTopic,
  onFastForwardTime,
  onResetTime,
}) => {
  const [filter, setFilter] = useState<'all' | 'priority' | 'completed'>('all');

  // Filter tasks based on selected tab
  const filteredTasks = tasks.filter((task) => {
    const isCompleted = task.theoryCompleted && task.practiceCompleted;
    if (filter === 'all') return true;
    if (filter === 'completed') return isCompleted;
    if (filter === 'priority') {
      return task.isPriority || (task.theoryCompleted && !task.practiceCompleted);
    }
    return true;
  });

  // Calculate subject tag style
  const getSubjectBadge = (subject: string) => {
    switch (subject) {
      case 'Physics':
        return 'bg-[#6ffbbe]/30 text-[#003820] border-[#6ffbbe]/60';
      case 'Chemistry':
        return 'bg-[#003820] text-white border-[#003820]';
      case 'Math':
        return 'bg-[#e5eeff] text-[#0b1c30] border-[#c0c9c0]/30';
      case 'Biology':
        return 'bg-[#6cf8bb]/30 text-[#002113] border-[#6cf8bb]/60';
      default:
        return 'bg-[#eff4ff] text-[#404942] border-[#c0c9c0]/30';
    }
  };

  const getSubjectAccent = (subject: string, isLocked: boolean) => {
    if (isLocked) return 'bg-[#707971]';
    switch (subject) {
      case 'Physics':
        return 'bg-[#006c49]';
      case 'Chemistry':
        return 'bg-[#003820]';
      case 'Math':
        return 'bg-[#2d6a48]';
      case 'Biology':
        return 'bg-[#10b981]';
      default:
        return 'bg-[#003820]';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-3">
          <h2 className="text-xl text-[#0b1c30] font-bold tracking-tight">
            Today's Action Zone
          </h2>
          <span className="px-2.5 py-0.5 rounded-full bg-[#e5eeff] text-[#0b1c30] text-xs font-semibold font-mono tabular-nums">
            {tasks.length} Sessions
          </span>
        </div>

        {/* Filter Tabs */}
        <div className="inline-flex p-1 bg-[#e5eeff] rounded-xl gap-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-white text-[#0b1c30] shadow-xs'
                : 'text-[#404942] hover:text-[#0b1c30]'
            }`}
          >
            All Tasks ({tasks.length})
          </button>
          <button
            onClick={() => setFilter('priority')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              filter === 'priority'
                ? 'bg-white text-[#0b1c30] shadow-xs'
                : 'text-[#404942] hover:text-[#0b1c30]'
            }`}
          >
            Priority
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              filter === 'completed'
                ? 'bg-white text-[#0b1c30] shadow-xs'
                : 'text-[#404942] hover:text-[#0b1c30]'
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Time Simulation & Locking Testing Bar */}
      <div className="p-3 bg-white rounded-xl border border-[#c0c9c0]/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#006c49] text-base">timer</span>
          <span className="text-[#404942]">
            <strong className="text-[#0b1c30]">24-Hour Expiration Engine:</strong> Tasks older than 24h automatically lock and disable Theory/Practice handlers.
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-[#404942] font-mono mr-1">
            {timeOffsetHours > 0 ? `+${timeOffsetHours}h simulated` : 'Real-time'}
          </span>
          <button
            onClick={() => onFastForwardTime(24)}
            className="px-2.5 py-1 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#003820] font-medium border border-[#c0c9c0]/30 transition-colors cursor-pointer"
            title="Fast forward simulated time by 24 hours to test automated task locking"
          >
            +24h Fast-Forward
          </button>
          {timeOffsetHours > 0 && (
            <button
              onClick={onResetTime}
              className="px-2 py-1 rounded-lg bg-[#ba1a1a]/10 hover:bg-[#ba1a1a]/20 text-[#ba1a1a] font-medium transition-colors cursor-pointer"
              title="Reset time simulation"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Task List Stack */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-dashed border-[#c0c9c0] text-center space-y-2">
            <span className="material-symbols-outlined text-3xl text-[#707971]">inbox</span>
            <p className="text-sm font-medium text-[#0b1c30]">No tasks found for this filter</p>
            <p className="text-xs text-[#404942]">
              Switch tabs or add a new topic to continue studying.
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isCompleted = task.theoryCompleted && task.practiceCompleted;
            const isInProgress =
              !isCompleted && (task.theoryCompleted || task.practiceCompleted);

            // Compute how many hours ago it was generated
            const hoursOld = Math.floor((currentTime - task.createdAt) / (1000 * 60 * 60));

            // RENDER LOCKED STATE UI
            if (task.isLocked) {
              return (
                <div
                  key={task.id}
                  className="bg-[#eff4ff]/80 opacity-80 p-4 sm:p-5 rounded-2xl border border-[#c0c9c0]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none cursor-not-allowed transition-all"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div
                      className={`w-1.5 h-12 rounded-full shrink-0 mt-0.5 ${getSubjectAccent(
                        task.subject,
                        true
                      )}`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full bg-[#e5eeff] text-[#404942] text-[11px] font-semibold">
                          {task.subject}
                        </span>
                        <span className="text-[11px] text-[#707971] flex items-center gap-1 font-mono">
                          <span className="material-symbols-outlined text-xs">timer</span>{' '}
                          {task.durationMinutes} min
                        </span>
                        <span className="text-[10px] text-[#707971] font-mono">
                          Generated {hoursOld}h ago
                        </span>
                      </div>
                      <h3 className="text-sm text-[#404942] font-semibold truncate">
                        {task.title}
                      </h3>
                      <p className="text-xs text-[#ba1a1a] flex items-center gap-1 mt-1 font-medium">
                        <span className="material-symbols-outlined text-xs">lock</span>
                        <span>
                          {task.lockReason || 'Locked: 24h generation window expired'}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Locked badge indicator with disabled onClick handlers */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <div
                      className="px-3.5 py-1.5 rounded-full bg-[#e5eeff] text-[#404942] text-xs font-semibold flex items-center gap-1.5 border border-[#c0c9c0]/50"
                      title="This task is locked. Progress toggles are disabled."
                    >
                      <span className="material-symbols-outlined text-sm text-[#ba1a1a]">
                        lock
                      </span>
                      <span>Locked</span>
                    </div>

                    {/* Disabled Ghost Toggle pills for visual clarity */}
                    <div className="hidden sm:flex items-center gap-1.5 opacity-40 pointer-events-none">
                      <button
                        disabled={true}
                        className="px-2.5 py-1 rounded-full bg-[#e5eeff] text-[#707971] text-xs cursor-not-allowed"
                      >
                        Theory
                      </button>
                      <button
                        disabled={true}
                        className="px-2.5 py-1 rounded-full bg-[#e5eeff] text-[#707971] text-xs cursor-not-allowed"
                      >
                        Practice
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            // RENDER ACTIVE / UNLOCKED STATE UI
            return (
              <div
                key={task.id}
                className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs hover:shadow-sm border border-[#c0c9c0]/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div
                    className={`w-1.5 h-12 rounded-full shrink-0 mt-0.5 ${getSubjectAccent(
                      task.subject,
                      false
                    )}`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getSubjectBadge(
                          task.subject
                        )}`}
                      >
                        {task.subject}
                      </span>
                      <span className="text-[11px] text-[#404942] flex items-center gap-1 font-mono">
                        <span className="material-symbols-outlined text-xs">timer</span>{' '}
                        {task.durationMinutes} min
                      </span>

                      {isCompleted && (
                        <span className="px-2 py-0.5 rounded bg-[#6ffbbe]/30 text-[#003820] text-[11px] font-semibold">
                          Done
                        </span>
                      )}
                      {isInProgress && (
                        <span className="px-2 py-0.5 rounded bg-[#e5eeff] text-[#006c49] text-[11px] font-semibold">
                          In Progress
                        </span>
                      )}
                      {task.isPriority && !isCompleted && (
                        <span className="px-2 py-0.5 rounded bg-[#eff4ff] text-[#0b1c30] text-[11px] font-medium">
                          Priority
                        </span>
                      )}
                    </div>

                    <h3
                      className={`text-sm font-semibold truncate ${
                        isCompleted
                          ? 'text-[#404942] line-through opacity-85'
                          : 'text-[#0b1c30]'
                      }`}
                    >
                      {task.title}
                    </h3>
                    <p className="text-xs text-[#404942] truncate">{task.description}</p>
                  </div>
                </div>

                {/* Theory / Practice Interactive Toggle Pills */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {/* Theory Button (Weight = 1) */}
                  <button
                    onClick={() => onToggleTheory(task.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                      task.theoryCompleted
                        ? 'bg-[#006c49] text-white hover:bg-[#005236]'
                        : 'bg-[#e5eeff] text-[#404942] hover:bg-[#eff4ff] hover:text-[#0b1c30]'
                    }`}
                    title="Toggle Theory component (Weight = 1)"
                  >
                    <span className="material-symbols-outlined text-sm leading-none">
                      {task.theoryCompleted ? 'check' : 'radio_button_unchecked'}
                    </span>
                    <span>Theory</span>
                  </button>

                  {/* Practice Button (Weight = 1) */}
                  <button
                    onClick={() => onTogglePractice(task.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                      task.practiceCompleted
                        ? 'bg-[#006c49] text-white hover:bg-[#005236]'
                        : 'bg-[#e5eeff] text-[#404942] hover:bg-[#eff4ff] hover:text-[#0b1c30]'
                    }`}
                    title="Toggle Practice component (Weight = 1)"
                  >
                    <span className="material-symbols-outlined text-sm leading-none">
                      {task.practiceCompleted ? 'check' : 'radio_button_unchecked'}
                    </span>
                    <span>Practice</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Task Quick Action Panel */}
      <div className="p-4 rounded-2xl bg-white border border-[#c0c9c0]/30 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#eff4ff] flex items-center justify-center text-[#003820]">
            <span className="material-symbols-outlined text-lg">edit_note</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#0b1c30]">Add extra study session</p>
            <p className="text-[11px] text-[#404942]">Log an unplanned topic or practice set</p>
          </div>
        </div>

        <button
          onClick={onOpenAddTopic}
          className="px-4 py-2 bg-[#eff4ff] hover:bg-[#e5eeff] text-[#003820] text-xs rounded-xl transition-colors font-semibold border border-[#c0c9c0]/30 cursor-pointer"
        >
          + Add Topic
        </button>
      </div>
    </div>
  );
};
