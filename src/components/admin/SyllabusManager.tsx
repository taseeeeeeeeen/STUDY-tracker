import React, { useState, useEffect } from 'react';
import { MasterSubject, SyllabusChapter, SyllabusTopic } from '../../types/syllabus';
import {
  subscribeMasterSyllabus,
  saveSubject,
  deleteSubject,
  seedDefaultSyllabus,
} from '../../services/syllabusService';
import { useAuth } from '../../context/AuthContext';

export const SyllabusManager: React.FC = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<MasterSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Modals state
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<MasterSubject | null>(null);
  const [subjectForm, setSubjectForm] = useState({ id: '', name: '', code: '', color: '#003820' });

  const [chapterModalOpen, setChapterModalOpen] = useState(false);
  const [activeSubjectForChapter, setActiveSubjectForChapter] = useState<MasterSubject | null>(null);
  const [editingChapter, setEditingChapter] = useState<SyllabusChapter | null>(null);
  const [chapterForm, setChapterForm] = useState({ name: '', order: 1 });

  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [activeSubjectForTopic, setActiveSubjectForTopic] = useState<MasterSubject | null>(null);
  const [activeChapterForTopic, setActiveChapterForTopic] = useState<SyllabusChapter | null>(null);
  const [editingTopic, setEditingTopic] = useState<SyllabusTopic | null>(null);
  const [topicForm, setTopicForm] = useState({
    title: '',
    subconcept: '',
    durationMinutes: 45,
    tag: 'Core Concept',
  });

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    const unsubscribe = subscribeMasterSyllabus(
      (data) => {
        setSubjects(data);
        setLoading(false);
        if (data.length > 0 && !expandedSubjectId) {
          setExpandedSubjectId(data[0].id);
        }
      },
      () => setLoading(false)
    );
    return () => unsubscribe();
  }, []);

  // Handle Seeding
  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedDefaultSyllabus(user?.uid);
      notify('Official HSC Master Syllabus seeded successfully into Firestore!');
    } catch {
      notify('Failed to seed syllabus.');
    } finally {
      setSeeding(false);
    }
  };

  // SUBJECT CRUD
  const handleOpenAddSubject = () => {
    setEditingSubject(null);
    setSubjectForm({ id: `sub-${Date.now().toString(36)}`, name: '', code: '', color: '#003820' });
    setSubjectModalOpen(true);
  };

  const handleOpenEditSubject = (sub: MasterSubject, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSubject(sub);
    setSubjectForm({ id: sub.id, name: sub.name, code: sub.code, color: sub.color || '#003820' });
    setSubjectModalOpen(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectForm.name.trim() || !subjectForm.code.trim()) return;

    if (editingSubject) {
      const updated: MasterSubject = {
        ...editingSubject,
        name: subjectForm.name.trim(),
        code: subjectForm.code.trim(),
        color: subjectForm.color,
      };
      await saveSubject(updated, user?.uid);
      notify(`Updated subject "${updated.name}"`);
    } else {
      const newSub: MasterSubject = {
        id: subjectForm.id.trim() || `sub-${Date.now()}`,
        name: subjectForm.name.trim(),
        code: subjectForm.code.trim(),
        color: subjectForm.color,
        order: subjects.length + 1,
        chapters: [],
      };
      await saveSubject(newSub, user?.uid);
      notify(`Created subject "${newSub.name}"`);
      setExpandedSubjectId(newSub.id);
    }
    setSubjectModalOpen(false);
  };

  const handleDeleteSubject = async (sub: MasterSubject, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${sub.name}" and all its chapters?`)) {
      await deleteSubject(sub.id);
      notify(`Deleted subject "${sub.name}"`);
    }
  };

  // CHAPTER CRUD
  const handleOpenAddChapter = (sub: MasterSubject, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveSubjectForChapter(sub);
    setEditingChapter(null);
    setChapterForm({ name: '', order: (sub.chapters?.length || 0) + 1 });
    setChapterModalOpen(true);
  };

  const handleOpenEditChapter = (
    sub: MasterSubject,
    ch: SyllabusChapter,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setActiveSubjectForChapter(sub);
    setEditingChapter(ch);
    setChapterForm({ name: ch.name, order: ch.order });
    setChapterModalOpen(true);
  };

  const handleSaveChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubjectForChapter || !chapterForm.name.trim()) return;

    const chapters = [...(activeSubjectForChapter.chapters || [])];

    if (editingChapter) {
      const idx = chapters.findIndex((c) => c.id === editingChapter.id);
      if (idx !== -1) {
        chapters[idx] = {
          ...chapters[idx],
          name: chapterForm.name.trim(),
          order: Number(chapterForm.order) || 1,
        };
      }
    } else {
      chapters.push({
        id: `ch-${Date.now().toString(36)}`,
        name: chapterForm.name.trim(),
        order: Number(chapterForm.order) || chapters.length + 1,
        topics: [],
      });
    }

    const updatedSub = {
      ...activeSubjectForChapter,
      chapters: chapters.sort((a, b) => a.order - b.order),
    };

    await saveSubject(updatedSub, user?.uid);
    notify(`Saved chapter "${chapterForm.name}"`);
    setChapterModalOpen(false);
  };

  const handleDeleteChapter = async (
    sub: MasterSubject,
    chId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (confirm('Delete this chapter and all of its topics?')) {
      const updatedChapters = sub.chapters.filter((c) => c.id !== chId);
      await saveSubject({ ...sub, chapters: updatedChapters }, user?.uid);
      notify('Chapter deleted.');
    }
  };

  // TOPIC CRUD
  const handleOpenAddTopic = (
    sub: MasterSubject,
    ch: SyllabusChapter,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setActiveSubjectForTopic(sub);
    setActiveChapterForTopic(ch);
    setEditingTopic(null);
    setTopicForm({
      title: '',
      subconcept: '',
      durationMinutes: 45,
      tag: 'Core Concept',
    });
    setTopicModalOpen(true);
  };

  const handleOpenEditTopic = (
    sub: MasterSubject,
    ch: SyllabusChapter,
    top: SyllabusTopic,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setActiveSubjectForTopic(sub);
    setActiveChapterForTopic(ch);
    setEditingTopic(top);
    setTopicForm({
      title: top.title,
      subconcept: top.subconcept || '',
      durationMinutes: top.durationMinutes || 45,
      tag: top.tag || 'Core Concept',
    });
    setTopicModalOpen(true);
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubjectForTopic || !activeChapterForTopic || !topicForm.title.trim()) return;

    const chapters = [...activeSubjectForTopic.chapters];
    const chIdx = chapters.findIndex((c) => c.id === activeChapterForTopic.id);
    if (chIdx === -1) return;

    const topics = [...(chapters[chIdx].topics || [])];

    if (editingTopic) {
      const tIdx = topics.findIndex((t) => t.id === editingTopic.id);
      if (tIdx !== -1) {
        topics[tIdx] = {
          ...topics[tIdx],
          title: topicForm.title.trim(),
          subconcept: topicForm.subconcept.trim(),
          durationMinutes: Number(topicForm.durationMinutes) || 45,
          tag: topicForm.tag.trim() || 'Core Concept',
          totalWeight: 2,
        };
      }
    } else {
      topics.push({
        id: `top-${Date.now().toString(36)}`,
        title: topicForm.title.trim(),
        subconcept: topicForm.subconcept.trim(),
        durationMinutes: Number(topicForm.durationMinutes) || 45,
        tag: topicForm.tag.trim() || 'Core Concept',
        totalWeight: 2,
      });
    }

    chapters[chIdx] = { ...chapters[chIdx], topics };
    const updatedSub = { ...activeSubjectForTopic, chapters };

    await saveSubject(updatedSub, user?.uid);
    notify(`Saved topic "${topicForm.title}"`);
    setTopicModalOpen(false);
  };

  const handleDeleteTopic = async (
    sub: MasterSubject,
    chId: string,
    topId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (confirm('Delete this topic from the master syllabus?')) {
      const chapters = sub.chapters.map((ch) => {
        if (ch.id === chId) {
          return {
            ...ch,
            topics: ch.topics.filter((t) => t.id !== topId),
          };
        }
        return ch;
      });
      await saveSubject({ ...sub, chapters }, user?.uid);
      notify('Topic removed from master syllabus.');
    }
  };

  const totalTopics = subjects.reduce(
    (acc, s) => acc + s.chapters.reduce((cAcc, c) => cAcc + (c.topics?.length || 0), 0),
    0
  );

  return (
    <div className="bg-white rounded-3xl border border-[#c0c9c0]/30 shadow-xs overflow-hidden space-y-6">
      {/* Section Header */}
      <div className="p-6 border-b border-[#c0c9c0]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-lg text-[#006c49]">auto_stories</span>
            <h2 className="text-lg font-bold text-[#003820] tracking-tight">
              Master Syllabus Management (CRUD)
            </h2>
          </div>
          <p className="text-xs text-[#707971]">
            Global curriculum stored in <code className="font-mono text-[#003820]">/master_syllabus</code>. Normal users cannot modify this data and fetch directly from here.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#eff4ff] hover:bg-[#e5eeff] text-[#003820] font-bold text-xs border border-[#c0c9c0]/40 transition-colors cursor-pointer disabled:opacity-50"
            title="Populate complete HSC official subjects, chapters, and topics"
          >
            <span className="material-symbols-outlined text-sm">cloud_sync</span>
            <span>{seeding ? 'Seeding...' : 'Seed Default HSC Syllabus'}</span>
          </button>

          <button
            onClick={handleOpenAddSubject}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#003820] hover:bg-[#004e2d] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm text-[#6ffbbe]">add</span>
            <span>Add Subject</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="mx-6 p-3 rounded-xl bg-[#003820] text-white text-xs font-semibold flex items-center justify-between shadow-md border border-[#6ffbbe]/40">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-[#6ffbbe]">check_circle</span>
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-white/70 hover:text-white">
            <span className="material-symbols-outlined text-xs">close</span>
          </button>
        </div>
      )}

      {/* Global Syllabus Quick Stats */}
      <div className="grid grid-cols-3 gap-4 px-6 text-center">
        <div className="p-3.5 rounded-2xl bg-[#f8f9ff] border border-[#c0c9c0]/30">
          <span className="text-[10px] font-mono uppercase font-bold text-[#707971] block">
            Subjects
          </span>
          <span className="text-xl font-black text-[#003820] tabular-nums">
            {subjects.length}
          </span>
        </div>
        <div className="p-3.5 rounded-2xl bg-[#f8f9ff] border border-[#c0c9c0]/30">
          <span className="text-[10px] font-mono uppercase font-bold text-[#707971] block">
            Chapters
          </span>
          <span className="text-xl font-black text-[#0b1c30] tabular-nums">
            {subjects.reduce((acc, s) => acc + (s.chapters?.length || 0), 0)}
          </span>
        </div>
        <div className="p-3.5 rounded-2xl bg-[#f8f9ff] border border-[#c0c9c0]/30">
          <span className="text-[10px] font-mono uppercase font-bold text-[#707971] block">
            Master Topics
          </span>
          <span className="text-xl font-black text-[#006c49] tabular-nums">
            {totalTopics}
          </span>
        </div>
      </div>

      {/* Subject List Accordion */}
      <div className="px-6 pb-6 space-y-4">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#707971]">
            <div className="w-5 h-5 border-2 border-[#003820] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading Master Syllabus from Firestore...
          </div>
        ) : subjects.length === 0 ? (
          <div className="p-10 border-2 border-dashed border-[#c0c9c0]/50 rounded-3xl text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#eff4ff] text-[#003820] flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">menu_book</span>
            </div>
            <div>
              <p className="font-bold text-sm text-[#0b1c30]">The Master Syllabus is currently empty</p>
              <p className="text-xs text-[#707971] mt-0.5">
                Click &quot;Seed Default HSC Syllabus&quot; above to instantly populate standard HSC subjects, or create a new subject manually.
              </p>
            </div>
            <button
              onClick={handleSeed}
              className="px-4 py-2 rounded-xl bg-[#003820] text-white text-xs font-bold shadow-xs hover:bg-[#004e2d] cursor-pointer"
            >
              Seed Official Syllabus
            </button>
          </div>
        ) : (
          subjects.map((sub) => {
            const isSubExpanded = expandedSubjectId === sub.id;
            const subTopicCount = sub.chapters.reduce(
              (acc, c) => acc + (c.topics?.length || 0),
              0
            );

            return (
              <div
                key={sub.id}
                className="rounded-2xl border border-[#c0c9c0]/40 bg-white overflow-hidden shadow-2xs transition-all"
              >
                {/* Subject Header */}
                <div
                  onClick={() => setExpandedSubjectId(isSubExpanded ? null : sub.id)}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#f8f9ff]/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: sub.color || '#003820' }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#0b1c30]">{sub.name}</span>
                        <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-[#eff4ff] text-[#003820] border border-[#c0c9c0]/30">
                          {sub.code}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#707971]">
                        {sub.chapters.length} Chapters • {subTopicCount} Topics
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleOpenAddChapter(sub, e)}
                      className="px-2.5 py-1 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#003820] text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">add</span>
                      <span>Chapter</span>
                    </button>

                    <button
                      onClick={(e) => handleOpenEditSubject(sub, e)}
                      className="p-1.5 rounded-lg text-[#707971] hover:text-[#0b1c30] hover:bg-[#eff4ff] cursor-pointer"
                      title="Edit Subject"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>

                    <button
                      onClick={(e) => handleDeleteSubject(sub, e)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 cursor-pointer"
                      title="Delete Subject"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>

                    <span
                      className={`material-symbols-outlined text-lg text-[#707971] transition-transform ${
                        isSubExpanded ? 'rotate-180' : ''
                      }`}
                    >
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Chapters Container */}
                {isSubExpanded && (
                  <div className="px-5 pb-5 pt-1 space-y-3 bg-[#f8f9ff]/50 border-t border-[#e5eeff]">
                    {sub.chapters.length === 0 ? (
                      <p className="text-xs text-[#707971] italic py-3 text-center">
                        No chapters in this subject yet. Click &quot;+ Chapter&quot; above to add one.
                      </p>
                    ) : (
                      sub.chapters.map((ch) => {
                        const isChExpanded = expandedChapterId === ch.id;

                        return (
                          <div
                            key={ch.id}
                            className="rounded-xl border border-[#c0c9c0]/30 bg-white overflow-hidden shadow-3xs"
                          >
                            {/* Chapter Header */}
                            <div
                              onClick={() => setExpandedChapterId(isChExpanded ? null : ch.id)}
                              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[#eff4ff]/30 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-base text-[#006c49]">
                                  folder_open
                                </span>
                                <span className="font-semibold text-xs text-[#0b1c30]">
                                  {ch.name}
                                </span>
                                <span className="text-[10px] text-[#707971] font-mono">
                                  ({ch.topics?.length || 0} topics)
                                </span>
                              </div>

                              <div
                                className="flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={(e) => handleOpenAddTopic(sub, ch, e)}
                                  className="px-2 py-0.5 rounded bg-[#6ffbbe]/25 text-[#003820] text-[10px] font-bold hover:bg-[#6ffbbe]/40 transition-colors cursor-pointer flex items-center gap-0.5"
                                >
                                  <span className="material-symbols-outlined text-xs">add</span>
                                  <span>Topic</span>
                                </button>

                                <button
                                  onClick={(e) => handleOpenEditChapter(sub, ch, e)}
                                  className="p-1 text-[#707971] hover:text-[#0b1c30] cursor-pointer"
                                  title="Edit Chapter"
                                >
                                  <span className="material-symbols-outlined text-xs">edit</span>
                                </button>

                                <button
                                  onClick={(e) => handleDeleteChapter(sub, ch.id, e)}
                                  className="p-1 text-red-500 hover:text-red-700 cursor-pointer"
                                  title="Delete Chapter"
                                >
                                  <span className="material-symbols-outlined text-xs">delete</span>
                                </button>

                                <span
                                  className={`material-symbols-outlined text-base text-[#707971] transition-transform ${
                                    isChExpanded ? 'rotate-180' : ''
                                  }`}
                                >
                                  arrow_drop_down
                                </span>
                              </div>
                            </div>

                            {/* Topics List */}
                            {isChExpanded && (
                              <div className="p-3 bg-[#f8f9ff] border-t border-[#e5eeff] space-y-2">
                                {(!ch.topics || ch.topics.length === 0) ? (
                                  <p className="text-[11px] text-[#707971] italic text-center py-2">
                                    No topics added yet. Click &quot;+ Topic&quot; to add one.
                                  </p>
                                ) : (
                                  ch.topics.map((top) => (
                                    <div
                                      key={top.id}
                                      className="p-2.5 rounded-lg bg-white border border-[#c0c9c0]/30 flex items-center justify-between gap-3 text-xs"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-[#0b1c30] truncate">
                                            {top.title}
                                          </span>
                                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#eff4ff] text-[#006c49]">
                                            {top.tag}
                                          </span>
                                          <span className="text-[10px] text-[#707971] font-mono">
                                            {top.durationMinutes}m
                                          </span>
                                        </div>
                                        {top.subconcept && (
                                          <p className="text-[10px] text-[#707971] truncate mt-0.5">
                                            {top.subconcept}
                                          </p>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          onClick={(e) => handleOpenEditTopic(sub, ch, top, e)}
                                          className="p-1 text-[#707971] hover:text-[#0b1c30] cursor-pointer"
                                          title="Edit Topic"
                                        >
                                          <span className="material-symbols-outlined text-xs">edit</span>
                                        </button>
                                        <button
                                          onClick={(e) => handleDeleteTopic(sub, ch.id, top.id, e)}
                                          className="p-1 text-red-500 hover:text-red-700 cursor-pointer"
                                          title="Delete Topic"
                                        >
                                          <span className="material-symbols-outlined text-xs">delete</span>
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: ADD / EDIT SUBJECT */}
      {subjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveSubject}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-xl space-y-4 border border-[#c0c9c0]/40"
          >
            <h3 className="font-black text-base text-[#003820]">
              {editingSubject ? 'Edit Subject' : 'Add New Subject'}
            </h3>

            <div>
              <label className="text-[11px] font-mono font-bold text-[#707971] block mb-1">
                Subject Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Physics 1st Paper"
                value={subjectForm.name}
                onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-[#c0c9c0]/60 bg-[#f8f9ff] text-[#0b1c30] focus:outline-none focus:border-[#003820]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono font-bold text-[#707971] block mb-1">
                  Board Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PHY-174"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#c0c9c0]/60 bg-[#f8f9ff] text-[#0b1c30] focus:outline-none focus:border-[#003820]"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono font-bold text-[#707971] block mb-1">
                  Brand Color
                </label>
                <input
                  type="color"
                  value={subjectForm.color}
                  onChange={(e) => setSubjectForm({ ...subjectForm, color: e.target.value })}
                  className="w-full h-10 p-1 rounded-xl border border-[#c0c9c0]/60 bg-[#f8f9ff] cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e5eeff]">
              <button
                type="button"
                onClick={() => setSubjectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#707971] hover:bg-[#eff4ff]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#003820] text-white text-xs font-bold hover:bg-[#004e2d] cursor-pointer"
              >
                {editingSubject ? 'Save Changes' : 'Create Subject'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADD / EDIT CHAPTER */}
      {chapterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveChapter}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-xl space-y-4 border border-[#c0c9c0]/40"
          >
            <h3 className="font-black text-base text-[#003820]">
              {editingChapter ? 'Edit Chapter' : `Add Chapter to ${activeSubjectForChapter?.name}`}
            </h3>

            <div>
              <label className="text-[11px] font-mono font-bold text-[#707971] block mb-1">
                Chapter Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Chapter 2: Vectors"
                value={chapterForm.name}
                onChange={(e) => setChapterForm({ ...chapterForm, name: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-[#c0c9c0]/60 bg-[#f8f9ff] text-[#0b1c30] focus:outline-none focus:border-[#003820]"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono font-bold text-[#707971] block mb-1">
                Order Index
              </label>
              <input
                type="number"
                min="1"
                value={chapterForm.order}
                onChange={(e) => setChapterForm({ ...chapterForm, order: Number(e.target.value) })}
                className="w-full text-xs p-2.5 rounded-xl border border-[#c0c9c0]/60 bg-[#f8f9ff] text-[#0b1c30] focus:outline-none focus:border-[#003820]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e5eeff]">
              <button
                type="button"
                onClick={() => setChapterModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#707971] hover:bg-[#eff4ff]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#003820] text-white text-xs font-bold hover:bg-[#004e2d] cursor-pointer"
              >
                {editingChapter ? 'Save Chapter' : 'Add Chapter'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADD / EDIT TOPIC */}
      {topicModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveTopic}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-xl space-y-4 border border-[#c0c9c0]/40"
          >
            <h3 className="font-black text-base text-[#003820]">
              {editingTopic ? 'Edit Topic' : `Add Topic to ${activeChapterForTopic?.name}`}
            </h3>

            <div>
              <label className="text-[11px] font-mono font-bold text-[#707971] block mb-1">
                Topic Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Dot & Cross Product Mechanics"
                value={topicForm.title}
                onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-[#c0c9c0]/60 bg-[#f8f9ff] text-[#0b1c30] focus:outline-none focus:border-[#003820]"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono font-bold text-[#707971] block mb-1">
                Subconcept / Description
              </label>
              <textarea
                placeholder="e.g. Scalar and vector product properties with angle between vectors"
                rows={2}
                value={topicForm.subconcept}
                onChange={(e) => setTopicForm({ ...topicForm, subconcept: e.target.value })}
                className="w-full text-xs p-2.5 rounded-xl border border-[#c0c9c0]/60 bg-[#f8f9ff] text-[#0b1c30] focus:outline-none focus:border-[#003820]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono font-bold text-[#707971] block mb-1">
                  Estimated Minutes
                </label>
                <input
                  type="number"
                  min="15"
                  step="5"
                  value={topicForm.durationMinutes}
                  onChange={(e) =>
                    setTopicForm({ ...topicForm, durationMinutes: Number(e.target.value) })
                  }
                  className="w-full text-xs p-2.5 rounded-xl border border-[#c0c9c0]/60 bg-[#f8f9ff] text-[#0b1c30] focus:outline-none focus:border-[#003820]"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono font-bold text-[#707971] block mb-1">
                  Category Tag
                </label>
                <input
                  type="text"
                  placeholder="e.g. Core Mechanics"
                  value={topicForm.tag}
                  onChange={(e) => setTopicForm({ ...topicForm, tag: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-[#c0c9c0]/60 bg-[#f8f9ff] text-[#0b1c30] focus:outline-none focus:border-[#003820]"
                />
              </div>
            </div>

            <div className="p-3 bg-[#eff4ff] rounded-xl text-[10px] text-[#003820] font-mono">
              Weight: 2 Points per topic (1 Theory + 1 Practice). Automatically enforced for all mathematical progress calculations.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e5eeff]">
              <button
                type="button"
                onClick={() => setTopicModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#707971] hover:bg-[#eff4ff]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#003820] text-white text-xs font-bold hover:bg-[#004e2d] cursor-pointer"
              >
                {editingTopic ? 'Save Topic' : 'Add Topic'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
