import React, { useState, useEffect } from 'react';
import { SubjectType, Task } from '../types/dashboard';
import { MasterSubject, SyllabusChapter, SyllabusTopic } from '../types/syllabus';
import { subscribeMasterSyllabus } from '../services/syllabusService';
import { useAuth } from '../context/AuthContext';
import { useStudyTrack } from '../context/StudyTrackContext';

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
  const { user } = useAuth();
  const { hiddenSubjectIds } = useStudyTrack();
  const [masterSubjects, setMasterSubjects] = useState<MasterSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<SubjectType>('Physics');
  const [duration, setDuration] = useState(45);
  const [description, setDescription] = useState('');
  const [isPriority, setIsPriority] = useState(false);
  const [creationAge, setCreationAge] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) return;
    if (!user) {
      setMasterSubjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeMasterSyllabus(
      (subs) => {
        setMasterSubjects(subs || []);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [isOpen, user]);

  const visibleSubjects = masterSubjects.filter(
    (s) => !hiddenSubjectIds.includes(s.id)
  );

  // Initialize selected subject/chapter/topic when modal opens or subjects load
  useEffect(() => {
    if (isOpen && visibleSubjects.length > 0) {
      const existingSub = visibleSubjects.find((s) => s.id === selectedSubjectId);
      const targetSub = existingSub || visibleSubjects[0];
      setSelectedSubjectId(targetSub.id);

      const existingCh = targetSub.chapters?.find((c) => c.id === selectedChapterId);
      const targetCh = existingCh || targetSub.chapters?.[0];
      if (targetCh) {
        setSelectedChapterId(targetCh.id);
        const existingTop = targetCh.topics?.find((t) => t.id === selectedTopicId);
        const targetTop = existingTop || targetCh.topics?.[0];
        if (targetTop) {
          setSelectedTopicId(targetTop.id);
          applyTopicData(targetSub, targetCh, targetTop);
        }
      }
    } else if (isOpen && !loading && visibleSubjects.length === 0) {
      setSelectedSubjectId('');
      setSelectedChapterId('');
      setSelectedTopicId('');
      setTitle('');
    }
  }, [isOpen, visibleSubjects, loading]);

  const mapSubjectNameToType = (subName: string): SubjectType => {
    if (subName.includes('Physics') || subName.includes('ফিজিক্স')) return 'Physics';
    if (subName.includes('Chemistry') || subName.includes('কেমিস্ট্রি')) return 'Chemistry';
    if (subName.includes('Math') || subName.includes('ম্যাথ') || subName.includes('গণিত')) return 'Math';
    if (subName.includes('Biology') || subName.includes('জীব')) return 'Biology';
    return 'Physics';
  };

  const applyTopicData = (sub: MasterSubject, ch: SyllabusChapter, top: SyllabusTopic) => {
    setTitle(top.title);
    setSubject(mapSubjectNameToType(sub.name));
    setDuration(top.durationMinutes || 45);
    setDescription(top.subconcept || `${sub.name} • ${ch.name}`);
  };

  const handleSubjectChange = (subId: string) => {
    setSelectedSubjectId(subId);
    const targetSub = visibleSubjects.find((s) => s.id === subId);
    if (targetSub && targetSub.chapters.length > 0) {
      const firstCh = targetSub.chapters[0];
      setSelectedChapterId(firstCh.id);
      if (firstCh.topics.length > 0) {
        const firstTop = firstCh.topics[0];
        setSelectedTopicId(firstTop.id);
        applyTopicData(targetSub, firstCh, firstTop);
      }
    }
  };

  const handleChapterChange = (chId: string) => {
    setSelectedChapterId(chId);
    const targetSub = visibleSubjects.find((s) => s.id === selectedSubjectId);
    if (targetSub) {
      const targetCh = targetSub.chapters.find((c) => c.id === chId);
      if (targetCh && targetCh.topics.length > 0) {
        const firstTop = targetCh.topics[0];
        setSelectedTopicId(firstTop.id);
        applyTopicData(targetSub, targetCh, firstTop);
      }
    }
  };

  const handleTopicChange = (topId: string) => {
    setSelectedTopicId(topId);
    const targetSub = visibleSubjects.find((s) => s.id === selectedSubjectId);
    if (targetSub) {
      const targetCh = targetSub.chapters.find((c) => c.id === selectedChapterId);
      if (targetCh) {
        const targetTop = targetCh.topics.find((t) => t.id === topId);
        if (targetTop) {
          applyTopicData(targetSub, targetCh, targetTop);
        }
      }
    }
  };

  if (!isOpen) return null;

  const currentSub = visibleSubjects.find((s) => s.id === selectedSubjectId) || visibleSubjects[0];
  const currentChapters = currentSub?.chapters || [];
  const currentCh = currentChapters.find((c) => c.id === selectedChapterId) || currentChapters[0];
  const currentTopics = currentCh?.topics || [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const createdAt = Date.now() - creationAge * 60 * 60 * 1000;

    onAddTask({
      title: title.trim(),
      subject,
      durationMinutes: Number(duration),
      description: description.trim() || `${subject} syllabus session`,
      theoryCompleted: false,
      practiceCompleted: false,
      createdAt,
      isPriority,
      lockReason:
        creationAge >= 24
          ? 'Locked: 24-hour study completion window expired'
          : undefined,
    });

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
            <div>
              <h3 className="text-base font-bold text-[#0b1c30]">Select Study Topic</h3>
              <span className="text-[10px] text-[#006c49] font-mono">From Global Master Syllabus</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#707971] hover:text-[#0b1c30] hover:bg-[#eff4ff] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#707971] text-xs">
            <div className="w-6 h-6 border-2 border-[#003820] border-t-transparent rounded-full animate-spin" />
            <span>Loading syllabus...</span>
          </div>
        ) : visibleSubjects.length === 0 ? (
          <div className="py-8 text-center space-y-3 bg-[#f8f9ff] rounded-xl border border-[#c0c9c0]/30 p-6">
            <div className="w-10 h-10 rounded-xl bg-[#eff4ff] text-[#003820] flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">menu_book</span>
            </div>
            <div>
              <p className="font-bold text-sm text-[#0b1c30]">No syllabus subjects available</p>
              <p className="text-xs text-[#707971] mt-0.5">
                {masterSubjects.length > 0
                  ? 'All subjects are currently hidden. You can unhide them in the HSC Syllabus view.'
                  : 'The master syllabus is currently empty.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#003820] text-white font-semibold rounded-xl text-xs hover:bg-[#0f5132] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Syllabus Cascading Selectors */}
            <div className="space-y-3 p-3 bg-[#f8f9ff] rounded-xl border border-[#c0c9c0]/30">
              <div>
                <label className="block font-semibold text-[#0b1c30] mb-1">1. Master Subject</label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#c0c9c0] bg-white text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#003820]"
                >
                  {visibleSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#0b1c30] mb-1">2. Chapter</label>
                <select
                  value={selectedChapterId}
                  onChange={(e) => handleChapterChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#c0c9c0] bg-white text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#003820]"
                >
                  {currentChapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#0b1c30] mb-1">3. Topic</label>
                <select
                  value={selectedTopicId}
                  onChange={(e) => handleTopicChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#c0c9c0] bg-white text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#003820]"
                >
                  {currentTopics.map((top) => (
                    <option key={top.id} value={top.id}>
                      {top.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
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

              <div>
                <label className="block font-semibold text-[#0b1c30] mb-1">
                  Schedule Time
                </label>
                <select
                  value={creationAge}
                  onChange={(e) => setCreationAge(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[#c0c9c0] bg-white text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#003820]"
                >
                  <option value={0}>Today (Active)</option>
                  <option value={6}>6 hours ago (Active)</option>
                  <option value={23}>23 hours ago (Expiring soon)</option>
                  <option value={25}>Yesterday (Locked after 24 hours)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#0b1c30] mb-1">Sub-concept / Summary</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#c0c9c0] bg-white text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#003820]"
              />
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
                className="px-4 py-2 rounded-xl text-[#404942] hover:bg-[#eff4ff] font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#003820] hover:bg-[#0f5132] text-white font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Add to Plan
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

