import React, { useState, useEffect } from 'react';

interface FocusTimerProps {
  currentTopicTitle?: string;
}

export const FocusTimer: React.FC<FocusTimerProps> = ({
  currentTopicTitle = 'Physics: Classical Mechanics',
}) => {
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [sprintCount, setSprintCount] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isRunning) {
      timer = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer!);
            setIsRunning(false);
            setSprintCount((c) => c + 1);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning]);

  const toggleTimer = () => {
    if (secondsLeft === 0) {
      setSecondsLeft(25 * 60);
      setIsRunning(true);
    } else {
      setIsRunning(!isRunning);
    }
  };

  const resetTimer = () => {
    setIsRunning(false);
    setSecondsLeft(25 * 60);
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xs border border-[#c0c9c0]/30 flex flex-col justify-between relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isRunning ? 'bg-[#10b981] animate-pulse ring-4 ring-[#10b981]/20' : 'bg-[#006c49]'
            }`}
          />
          <span className="text-xs text-[#0b1c30] font-semibold tracking-wider uppercase font-sans">
            Study Timer
          </span>
        </div>

        <button
          onClick={() => setSoundOn(!soundOn)}
          className="p-1.5 rounded-lg text-[#404942] hover:text-[#0b1c30] hover:bg-[#eff4ff] transition-colors"
          title={soundOn ? 'Mute ambient sound' : 'Unmute ambient sound'}
        >
          <span className="material-symbols-outlined text-lg">
            {soundOn ? 'volume_up' : 'volume_off'}
          </span>
        </button>
      </div>

      {/* Main Counter */}
      <div className="my-5 flex flex-col items-center justify-center text-center">
        <span className="text-5xl font-extrabold tracking-tight text-[#0b1c30] font-mono tabular-nums">
          {formattedTime}
        </span>
        <p className="text-sm font-medium text-[#0b1c30] mt-2 truncate max-w-xs">
          {currentTopicTitle}
        </p>
        <span className="text-xs text-[#404942] mt-0.5">
          {sprintCount === 0
            ? '0 sessions completed'
            : `${sprintCount} session${sprintCount > 1 ? 's' : ''} completed`}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleTimer}
          className="flex-1 py-2.5 bg-[#003820] hover:bg-[#0f5132] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">
            {isRunning ? 'pause' : secondsLeft === 0 ? 'replay' : 'play_arrow'}
          </span>
          <span>
            {isRunning ? 'Pause' : secondsLeft === 0 ? 'Restart' : 'Start Timer'}
          </span>
        </button>

        <button
          onClick={resetTimer}
          className="p-2.5 rounded-xl bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] transition-colors cursor-pointer"
          title="Reset Session"
        >
          <span className="material-symbols-outlined text-base">refresh</span>
        </button>
      </div>
    </div>
  );
};
