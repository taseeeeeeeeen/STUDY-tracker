import React, { useState } from 'react';
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
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen || !challengeData) return null;

  const jsonString = JSON.stringify(challengeData, null, 2);
  const code = (challengeData.code as string) || '';

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

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
      <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-[#c0c9c0]/40 flex flex-col gap-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#e5eeff]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#6ffbbe]/30 text-[#003820] flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-2xl">rocket_launch</span>
            </div>
            <div>
              <h3 className="text-lg text-[#0b1c30] font-extrabold tracking-tight">
                Sprint Successfully Launched!
              </h3>
              <p className="text-xs text-[#006c49] font-medium">
                Saved to Firestore <code className="font-mono bg-[#eff4ff] px-1 py-0.5 rounded text-[11px]">challenges</code> collection
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

        {/* Room Code Share Card */}
        {code && (
          <div className="p-4 bg-gradient-to-r from-[#003820] to-[#005232] rounded-2xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
            <div>
              <span className="text-[10px] font-mono text-[#6ffbbe] uppercase tracking-wider font-bold block">
                Challenge Room Code (Share with Friends)
              </span>
              <span className="text-2xl font-black font-mono tracking-wider text-white">
                {code}
              </span>
            </div>
            <button
              onClick={handleCopyCode}
              className="px-4 py-2 bg-[#6ffbbe] text-[#003820] rounded-xl text-xs font-bold hover:bg-[#8bfdcf] transition-all flex items-center gap-1.5 self-start sm:self-center shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">
                {copiedCode ? 'done' : 'content_copy'}
              </span>
              <span>{copiedCode ? 'Code Copied!' : 'Copy Code'}</span>
            </button>
          </div>
        )}

        {/* JSON Preview container */}
        <div className="flex flex-col gap-1.5 flex-1 overflow-hidden">
          <div className="flex items-center justify-between text-xs text-[#404942]">
            <span className="font-semibold">Firestore Document Payload</span>
            <button
              onClick={handleCopy}
              className="text-[#006c49] hover:underline flex items-center gap-1 font-mono text-[11px] cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">
                {copied ? 'done' : 'content_copy'}
              </span>
              {copied ? 'Copied Payload!' : 'Copy JSON'}
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-[#0b1c30] text-[#6ffbbe] font-mono text-xs overflow-auto flex-1 max-h-[260px] border border-[#213145] leading-relaxed">
            {jsonString}
          </pre>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between pt-3 border-t border-[#e5eeff] gap-2">
          <span className="text-xs text-[#404942]">
            Real-time <code className="font-mono text-[11px]">onSnapshot</code> listener is now active.
          </span>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleGoPeerArena}
              className="px-4 py-2 rounded-xl bg-white hover:bg-[#eff4ff] text-[#0b1c30] text-xs font-bold border border-[#c0c9c0]/40 transition-all cursor-pointer"
            >
              Peer Arena
            </button>
            <button
              onClick={handleGoDashboard}
              className="px-5 py-2 rounded-xl bg-[#003820] hover:bg-[#0f5132] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              Open Main Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
