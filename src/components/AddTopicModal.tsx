import React, { useState } from 'react';
import { SubjectType, Task } from '../types/dashboard';

interface AddTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (newTask: Omit<Task, 'id' | 'isLocked'> & { createdAtOffsetHours?: number }) => void;
}

export const AddTopicModal: React.FC<AddTopicModalProps> = ({
  isOpen,
  onClose,
  onAddTask,
}) => {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<SubjectType>('Physics');
  const [duration, setDuration] = useState(45);
  const [description, setDescription] = useState('');
  const [isPriority, setIsPriority] = useState(false);
  const [creationAge, setCreationAge] = useState<number>(0); // 0 = now, 25 = 25h ago (testing auto-lock)

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const createdAt = Date.now() - creationAge * 60 * 60 * 1000;

    onAddTask({
      title: title.trim(),
      subject,
      durationMinutes: Number(duration),
      description: description.trim() || `${subject} comprehensive study module`,
      theoryCompleted: false,
      practiceCompleted: false,
      createdAt,
      isPriority,
      lockReason:
        creationAge >= 24
          ? 'Locked: 24-hour study completion window expired'
          : undefined,
    });

    setTitle('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#c0c9c0]/40 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#e5eeff]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[#003820]">
              <span className="material-symbols-outlined text-lg">add_task</span>
            </div>
            <h3 className="text-base font-bold text-[#0b1c30]">Add New Study Topic</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#707971] hover:text-[#0b1c30] hover:bg-[#eff4ff] transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[#0b1c30] mb-1">Topic Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Thermodynamics & Heat Transfer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#c0c9c0] bg-white text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#003820]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#0b1c30] mb-1">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value as SubjectType)}
                className="w-full px-3 py-2 rounded-xl border border-[#c0c9c0] bg-white text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#003820]"
              >
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Math">Math</option>
                <option value="Biology">Biology</option>
                <option value="History">History</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#0b1c30] mb-1">Duration (min)</label>
              <input
                type="number"
                min="10"
                max="180"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#c0c9c0] bg-white text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#003820]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#0b1c30] mb-1">Key Sub-concepts</label>
            <input
              type="text"
              placeholder="e.g. Carnot engine, enthalpy, entropy calculations"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#c0c9c0] bg-white text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#003820]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#0b1c30] mb-1">
              Creation Timestamp (Test 24h Lock Logic)
            </label>
            <select
              value={creationAge}
              onChange={(e) => setCreationAge(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-[#c0c9c0] bg-white text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#003820]"
            >
              <option value={0}>Created Just Now (Active, Unlocked)</option>
              <option value={6}>Created 6 hours ago (Active, Unlocked)</option>
              <option value={23}>Created 23 hours ago (Expiring in 1 hour)</option>
              <option value={25}>Created 25 hours ago (&gt; 24h: Auto-Locked!)</option>
            </select>
            <p className="text-[11px] text-[#707971] mt-1">
              Select 25h to verify that tasks exceeding 24 hours render in the locked state.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isPriority"
              checked={isPriority}
              onChange={(e) => setIsPriority(e.target.checked)}
              className="rounded border-[#c0c9c0] text-[#003820] focus:ring-[#003820]"
            />
            <label htmlFor="isPriority" className="text-[#0b1c30] font-medium cursor-pointer">
              Mark as Priority Session
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e5eeff]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[#404942] hover:bg-[#eff4ff] font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#003820] hover:bg-[#0f5132] text-white font-semibold rounded-xl shadow-xs transition-colors"
            >
              Save Topic
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
