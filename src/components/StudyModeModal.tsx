import React, { useState, useEffect } from 'react';
import { Task } from '../types/dashboard';

interface StudyModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTask?: Task;
  onToggleTheory: (taskId: string) => void;
  onTogglePractice: (taskId: string) => void;
}

export const StudyModeModal: React.FC<StudyModeModalProps> = ({
  isOpen,
  onClose,
  activeTask,
  onToggleTheory,
  onTogglePractice,
}) => {
  const [seconds, setSeconds] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setSeconds(25 * 60);
      setIsActive(false);
    } else {
      setIsActive(false);
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isOpen && isActive && seconds > 0) {
      interval = setInterval(() => {
        setSeconds((s) => {
          if (s <= 1) {
            setIsActive(false);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, isActive, seconds]);

  if (!isOpen) return null;

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 bg-[#003820] text-white flex flex-col items-center justify-between p-8 sm:p-12 animate-in fade-in select-none">
      {/* Top Header */}
      <div className="w-full max-w-4xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-[#6ffbbe] animate-pulse" />
          <span className="text-sm tracking-widest font-mono uppercase text-[#6ffbbe]">
            Study Timer
          </span>
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold tracking-wide transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-base">close</span> Exit
        </button>
      </div>

      {/* Main Focus Area */}
      <div className="flex flex-col items-center text-center space-y-6 max-w-xl">
        <span className="text-7xl sm:text-9xl font-mono font-black tracking-tight tabular-nums text-white">
          {timeFormatted}
        </span>

        {activeTask && (
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-[#6ffbbe]/20 text-[#6ffbbe] text-xs font-mono font-semibold">
              {activeTask.subject} • {activeTask.durationMinutes} min
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {activeTask.title}
            </h2>
            <p className="text-sm text-white/70">{activeTask.description}</p>
          </div>
        )}

        {/* Task progress buttons */}
        {activeTask && !activeTask.isLocked && (
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => onToggleTheory(activeTask.id)}
              className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTask.theoryCompleted
                  ? 'bg-[#10b981] text-white'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {activeTask.theoryCompleted ? 'check' : 'radio_button_unchecked'}
              </span>
              Theory Done
            </button>
            <button
              onClick={() => onTogglePractice(activeTask.id)}
              className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTask.practiceCompleted
                  ? 'bg-[#10b981] text-white'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {activeTask.practiceCompleted ? 'check' : 'radio_button_unchecked'}
              </span>
              Practice Done
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3 pt-4">
          <button
            onClick={() => setIsActive(!isActive)}
            className="px-6 py-3 rounded-2xl bg-[#6ffbbe] hover:bg-[#95d4ac] text-[#002111] font-bold text-sm shadow-lg flex items-center gap-2 transition-all"
          >
            <span className="material-symbols-outlined text-xl">
              {isActive ? 'pause' : 'play_arrow'}
            </span>
            <span>{isActive ? 'Pause' : 'Start'}</span>
          </button>
          <button
            onClick={() => {
              setIsActive(false);
              setSeconds(25 * 60);
            }}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all"
            title="Reset Timer"
          >
            <span className="material-symbols-outlined text-xl">refresh</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-xs text-white/50 font-mono">
        StudyTrack • Stay focused on one topic at a time
      </div>
    </div>
  );
};
