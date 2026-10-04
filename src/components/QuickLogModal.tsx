import React, { useState } from 'react';

interface QuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogCompleted: (message: string) => void;
}

export const QuickLogModal: React.FC<QuickLogModalProps> = ({
  isOpen,
  onClose,
  onLogCompleted,
}) => {
  const [subject, setSubject] = useState('Physics');
  const [minutes, setMinutes] = useState(30);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogCompleted(`Logged ${minutes} minutes of ${subject}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-[#c0c9c0]/40 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#e5eeff]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006c49]">bolt</span>
            <h3 className="text-base font-bold text-[#0b1c30]">Quick Study Log</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#707971] hover:text-[#0b1c30] hover:bg-[#eff4ff]"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-[#0b1c30] mb-1">Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#c0c9c0] bg-white text-[#0b1c30]"
            >
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Math">Math</option>
              <option value="Biology">Biology</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#0b1c30] mb-1">Duration (minutes)</label>
            <input
              type="number"
              min="5"
              max="240"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-[#c0c9c0] bg-white text-[#0b1c30]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#0b1c30] mb-1">Session Notes</label>
            <textarea
              rows={3}
              placeholder="Solved 15 problems on vectors and momentum..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#c0c9c0] bg-white text-[#0b1c30]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e5eeff]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[#404942] hover:bg-[#eff4ff]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#003820] hover:bg-[#0f5132] text-white font-semibold rounded-xl"
            >
              Save Log
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
