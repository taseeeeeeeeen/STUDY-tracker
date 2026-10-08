import React, { useState, useMemo } from 'react';
import { Task } from '../types/dashboard';

interface ActionZoneProps {
  tasks: Task[];
  currentTime: number;
  onToggleTheory: (taskId: string) => void;
  onTogglePractice: (taskId: string) => void;
  onOpenAddTopic: () => void;
}

export const ActionZone: React.FC<ActionZoneProps> = ({
  tasks,
  currentTime: _currentTime,
  onToggleTheory,
  onTogglePractice,
  onOpenAddTopic,
}) => {
  const [filter, setFilter] = useState<'all' | 'priority' | 'completed'>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('All');

  // Derive distinct subjects actually present in tasks
  const distinctSubjects = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.subject && t.subject.trim()) {
        set.add(t.subject.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  // Filter tasks based on selected tab and subject dropdown and sort backlog first
  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (subjectFilter !== 'All' && task.subject.toLowerCase() !== subjectFilter.toLowerCase()) {
        return false;
      }
      const isCompleted = task.theoryCompleted && task.practiceCompleted;
      if (filter === 'all') return true;
      if (filter === 'completed') return isCompleted;
      if (filter === 'priority') {
        return task.isPriority || (task.theoryCompleted && !task.practiceCompleted);
      }
      return true;
    });

    // Stable sort: task.isCarriedOver tasks first
    return [...filtered].sort((a, b) => {
      const aVal = a.isCarriedOver ? 1 : 0;
      const bVal = b.isCarriedOver ? 1 : 0;
      return bVal - aVal;
    });
  }, [tasks, filter, subjectFilter]);

  const subjectTasks = subjectFilter === 'All'
    ? tasks
    : tasks.filter((t) => t.subject.toLowerCase() === subjectFilter.toLowerCase());

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
      case 'Bangla':
        return 'bg-[#eff4ff] text-[#003820] border-[#c0c9c0]/30';
      case 'English':
        return 'bg-[#e5eeff] text-[#0b1c30] border-[#c0c9c0]/30';
      case 'ICT':
        return 'bg-[#6ffbbe]/30 text-[#003820] border-[#6ffbbe]/60';
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
      case 'Bangla':
      case 'English':
      case 'ICT':
        return 'bg-[#003820]';
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
            Today's Study Plan
          </h2>
          <span className="px-2.5 py-0.5 rounded-full bg-[#e5eeff] text-[#0b1c30] text-xs font-semibold font-mono tabular-nums">
            {subjectTasks.length} Topics
          </span>
        </div>

        {/* Filter Toolbar: Subject Dropdown + Filter Tabs */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#404942] font-semibold">Subject</span>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="text-xs bg-[#e5eeff] text-[#0b1c30] font-semibold py-1 px-2.5 rounded-xl border border-[#c0c9c0]/30 outline-none cursor-pointer focus:bg-white focus:border-[#003820] transition-colors"
            >
              <option value="All">All</option>
              {distinctSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
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
              All Topics ({subjectTasks.length})
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
      </div>

      {/* Task List Stack */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-dashed border-[#c0c9c0] text-center space-y-2">
            <span className="material-symbols-outlined text-3xl text-[#707971]">inbox</span>
            <p className="text-sm font-medium text-[#0b1c30]">No topics found</p>
            <p className="text-xs text-[#404942]">
              Switch tabs or add a new topic to plan your study session.
            </p>
          </div>
        ) : (
          filteredTasks.map((task, taskIdx) => {
            const isCompleted = task.theoryCompleted && task.practiceCompleted;
            const isInProgress =
              !isCompleted && (task.theoryCompleted || task.practiceCompleted);

            // RENDER LOCKED STATE UI
            if (task.isLocked) {
              return (
                <div
                  key={`${task.id}-${taskIdx}`}
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
                key={`${task.id}-${taskIdx}`}
                className={`bg-white p-4 sm:p-5 rounded-2xl shadow-xs hover:shadow-sm border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  task.isCarriedOver
                    ? 'border-red-400 ring-2 ring-red-400/25 bg-red-50/10'
                    : 'border-[#c0c9c0]/30'
                }`}
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div
                    className={`w-1.5 h-12 rounded-full shrink-0 mt-0.5 ${
                      task.isCarriedOver ? 'bg-[#ba1a1a]' : getSubjectAccent(task.subject, false)
                    }`}
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

                      {task.isCarriedOver && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 text-[11px] font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                          Backlog {task.carriedOverFromDay ? `(from Day ${task.carriedOverFromDay})` : ''}
                        </span>
                      )}

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
            <p className="text-xs font-semibold text-[#0b1c30]">Add a study topic</p>
            <p className="text-[11px] text-[#404942]">Add an extra topic or problem set to today's plan</p>
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
