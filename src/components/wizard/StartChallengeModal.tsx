import React from 'react';
import { useNavigate } from 'react-router-dom';

interface StartChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  challengeData: Record<string, unknown> | null;
}

export const StartChallengeModal: React.FC<StartChallengeModalProps> = ({
  isOpen,
  onClose,
  challengeData,
}) => {
  const navigate = useNavigate();

  if (!isOpen || !challengeData) return null;

  const challengeName = (challengeData.challenge_name as string) || 'Study Sprint';
  const duration = (challengeData.duration as number) || 7;
  const totalTopics = (challengeData.totalTopics as number) || (challengeData.selected_syllabus as unknown[])?.length || 0;
  const totalHours = (challengeData.totalEstimatedHours as number) || 0;

  const handleGoDashboard = () => {
    onClose();
    navigate('/');
  };

  const handleGoPeerArena = () => {
    onClose();
    navigate('/peer-arena');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-[#c0c9c0]/40 flex flex-col gap-5 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#e5eeff]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#6ffbbe]/30 text-[#003820] flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-2xl">rocket_launch</span>
            </div>
            <div>
              <h3 className="text-lg text-[#0b1c30] font-extrabold tracking-tight">
                Sprint Created Successfully
              </h3>
              <p className="text-xs text-[#006c49] font-medium">
                Saved to your study account
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#707971] hover:text-[#0b1c30] hover:bg-[#eff4ff]"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Summary Details */}
        <div className="p-4 bg-[#eff4ff] rounded-2xl border border-[#c0c9c0]/40 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#0b1c30]">{challengeName}</span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#003820] text-white text-[10px] font-mono font-bold">
              {duration} Days
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#c0c9c0]/30 text-xs text-[#404942]">
            <div>
              <span className="block text-[10px] uppercase font-mono text-[#707971]">Topics</span>
              <span className="font-bold text-[#0b1c30]">{totalTopics} Topics</span>
            </div>
            {totalHours > 0 && (
              <div>
                <span className="block text-[10px] uppercase font-mono text-[#707971]">Est. Study Load</span>
                <span className="font-bold text-[#006c49] font-mono">~{totalHours} Hours</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-[#e5eeff] gap-2">
          <span className="text-xs text-[#404942]">
            Your sprint is now active and ready.
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleGoPeerArena}
              className="px-4 py-2 rounded-xl bg-white hover:bg-[#eff4ff] text-[#0b1c30] text-xs font-bold border border-[#c0c9c0]/40 transition-all cursor-pointer"
            >
              Go to Peer Arena
            </button>
            <button
              onClick={handleGoDashboard}
              className="px-5 py-2 rounded-xl bg-[#003820] hover:bg-[#0f5132] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

