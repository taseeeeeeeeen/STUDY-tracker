import React, { useState } from 'react';
import { HSCSubject } from '../../types/hsc';

interface HSCSubjectAccordionProps {
  syllabus: HSCSubject[];
  onToggleTheory: (subjectId: string, chapterId: string, topicId: string) => void;
  onTogglePractice: (subjectId: string, chapterId: string, topicId: string) => void;
}

export const HSCSubjectAccordion: React.FC<HSCSubjectAccordionProps> = ({
  syllabus,
  onToggleTheory,
  onTogglePractice,
}) => {
  // Paper filter: 'all' | '1st' | '2nd'
  const [paperFilter, setPaperFilter] = useState<'all' | '1st' | '2nd'>('all');
  // Sort by: 'completion' | 'weightage' | 'pending'
  const [sortBy, setSortBy] = useState<'completion' | 'weightage' | 'pending'>('completion');
  // Track expanded subject IDs (all subjects start collapsed)
  const [expandedSubjectIds, setExpandedSubjectIds] = useState<string[]>([]);
  // Track expanded chapter IDs
  const [expandedChapterIds, setExpandedChapterIds] = useState<string[]>([]);

  const toggleExpand = (subjectId: string) => {
    setExpandedSubjectIds((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    );
  };

  const toggleChapterExpand = (chapterId: string) => {
    setExpandedChapterIds((prev) =>
      prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId]
    );
  };

  // Helper math for a single subject
  const getSubjectMetrics = (subject: HSCSubject) => {
    const allTopics = subject.chapters.flatMap((c) => c.topics);
    const totalTopics = allTopics.length;
    const completedTheory = allTopics.filter((t) => t.is_theory_done).length;
    const completedPractice = allTopics.filter((t) => t.is_practice_done).length;

    // Requirement 2: Weight rule: Theory = 1 point, Practice = 1 point (Total 2 points per topic)
    // Subject Progress % = ((Total Completed Theory + Total Completed Practice) / (Total Topics * 2)) * 100
    const subjectProgressPercent =
      totalTopics > 0
        ? ((completedTheory + completedPractice) / (totalTopics * 2)) * 100
        : 0;

    // Theory portion width in progress bar
    const theoryBarPercent =
      totalTopics > 0 ? (completedTheory / (totalTopics * 2)) * 100 : 0;
    // Practice portion width in progress bar
    const practiceBarPercent =
      totalTopics > 0 ? (completedPractice / (totalTopics * 2)) * 100 : 0;
    const pendingBarPercent = Math.max(0, 100 - (theoryBarPercent + practiceBarPercent));

    // Chapter counts
    const totalChapters = subject.chapters.length;
    const completedChapters = subject.chapters.filter((c) =>
      c.topics.every((t) => t.is_theory_done && t.is_practice_done)
    ).length;

    return {
      totalTopics,
      completedTheory,
      completedPractice,
      subjectProgressPercent,
      theoryBarPercent,
      practiceBarPercent,
      pendingBarPercent,
      totalChapters,
      completedChapters,
      pendingChapters: totalChapters - completedChapters,
    };
  };

  // Filtered and Sorted subjects
  const processedSubjects = syllabus
    .filter((subject) => {
      if (paperFilter === 'all') return true;
      if (paperFilter === '1st') return subject.paperType === '1st' || subject.paperType === 'both';
      if (paperFilter === '2nd') return subject.paperType === '2nd' || subject.paperType === 'both';
      return true;
    })
    .sort((a, b) => {
      const metricsA = getSubjectMetrics(a);
      const metricsB = getSubjectMetrics(b);
      if (sortBy === 'completion') {
        return metricsB.subjectProgressPercent - metricsA.subjectProgressPercent;
      }
      if (sortBy === 'weightage') {
        return b.totalMarks - a.totalMarks;
      }
      if (sortBy === 'pending') {
        return metricsB.pendingChapters - metricsA.pendingChapters;
      }
      return 0;
    });

  return (
    <div className="flex flex-col gap-4">
      {/* Section Header with Sorting & Filtering Filters */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-[11px] text-[#006c49] font-semibold uppercase tracking-wider font-mono">
            Subject Breakdown
          </span>
          <h2 className="text-xl text-[#0b1c30] font-bold tracking-tight">
            HSC Subject Papers
          </h2>
          <p className="text-xs text-[#404942]">
            View theory progress, practice questions, and chapters for each subject.
          </p>
        </div>

        {/* Filter Controls Deck */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          {/* Paper Filter Segment */}
          <div className="bg-white p-1 rounded-xl flex items-center shadow-xs border border-[#c0c9c0]/30 gap-1 text-xs">
            <button
              type="button"
              onClick={() => setPaperFilter('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                paperFilter === 'all'
                  ? 'bg-[#003820] text-white shadow-xs'
                  : 'text-[#404942] hover:text-[#0b1c30]'
              }`}
            >
              All Papers
            </button>
            <button
              type="button"
              onClick={() => setPaperFilter('1st')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                paperFilter === '1st'
                  ? 'bg-[#003820] text-white shadow-xs'
                  : 'text-[#404942] hover:text-[#0b1c30]'
              }`}
            >
              1st Papers
            </button>
            <button
              type="button"
              onClick={() => setPaperFilter('2nd')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                paperFilter === '2nd'
                  ? 'bg-[#003820] text-white shadow-xs'
                  : 'text-[#404942] hover:text-[#0b1c30]'
              }`}
            >
              2nd Papers
            </button>
          </div>

          {/* Sort Select */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl shadow-xs border border-[#c0c9c0]/30 text-xs">
            <span className="text-[#404942]">Sort by:</span>
            <select
              aria-label="Sort subjects by"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'completion' | 'weightage' | 'pending')
              }
              className="bg-transparent text-[#0b1c30] font-bold focus:outline-none cursor-pointer"
            >
              <option value="completion">Completion %</option>
              <option value="weightage">Marks / Weight</option>
              <option value="pending">Pending Chapters</option>
            </select>
          </div>
        </div>
      </div>

      {/* Subject Cards Stack */}
      <div className="flex flex-col gap-4">
        {processedSubjects.map((subject) => {
          const metrics = getSubjectMetrics(subject);
          const isExpanded = expandedSubjectIds.includes(subject.id);

          return (
            <div
              key={subject.id}
              className="bg-white rounded-2xl shadow-xs border border-[#c0c9c0]/30 overflow-hidden transition-all duration-200"
            >
              {/* Accordion Header */}
              <div
                onClick={() => toggleExpand(subject.id)}
                className={`p-5 cursor-pointer transition-colors ${
                  isExpanded ? 'bg-[#eff4ff]/60 border-b border-[#e5eeff]' : 'hover:bg-[#eff4ff]/40'
                }`}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#eff4ff] text-[#003820] flex items-center justify-center font-bold shrink-0 border border-[#c0c9c0]/30">
                        <span className="material-symbols-outlined">{subject.icon}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-[#0b1c30]">
                            {subject.name}
                          </h3>
                          <span className="bg-[#e5eeff] text-[#003820] px-2 py-0.5 rounded text-[11px] font-mono font-semibold">
                            {subject.totalMarks} Marks Total
                          </span>
                          {isExpanded && (
                            <span className="bg-[#6ffbbe]/30 text-[#002111] px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                              Active Focus
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#404942] mt-0.5">
                          <span className="text-[#006c49] font-medium font-mono">
                            {metrics.completedChapters} Cleared
                          </span>
                          <span>•</span>
                          <span className="font-mono">
                            {metrics.pendingChapters} Pending
                          </span>
                          <span>•</span>
                          <span>
                            ({metrics.completedChapters} of {metrics.totalChapters} Chapters Mastered)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end md:self-auto">
                      <span className="text-lg text-[#003820] font-extrabold font-mono tabular-nums">
                        {Math.round(metrics.subjectProgressPercent)}%
                      </span>
                      <button
                        type="button"
                        aria-label={isExpanded ? 'Collapse subject' : 'Expand subject'}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                          isExpanded
                            ? 'bg-[#003820] text-white'
                            : 'bg-[#eff4ff] text-[#404942] hover:text-[#0b1c30]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-base">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Dual-tone Progress Bar */}
                  <div className="w-full bg-[#e5eeff] h-3 rounded-full flex overflow-hidden">
                    {/* Theory portion in Deep Green */}
                    <div
                      className="bg-[#003820] h-full transition-all duration-500"
                      style={{ width: `${metrics.theoryBarPercent}%` }}
                      title={`Theory: ${Math.round(metrics.theoryBarPercent * 2)}%`}
                    />
                    {/* Practice portion in Secondary Mint */}
                    <div
                      className="bg-[#6ffbbe] h-full transition-all duration-500"
                      style={{ width: `${metrics.practiceBarPercent}%` }}
                      title={`Practice: ${Math.round(metrics.practiceBarPercent * 2)}%`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#404942] font-mono">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#003820] inline-block" />
                      Theory: {Math.round(metrics.theoryBarPercent * 2)}% ({metrics.completedTheory}/{metrics.totalTopics})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#6ffbbe] inline-block" />
                      Practice & CQ: {Math.round(metrics.practiceBarPercent * 2)}% ({metrics.completedPractice}/{metrics.totalTopics})
                    </span>
                    <span>
                      {Math.max(0, 100 - Math.round(metrics.subjectProgressPercent))}% Pending
                    </span>
                  </div>
                </div>
              </div>

              {/* Chapter list under expanded subject */}
              {isExpanded && (
                <div className="p-5 flex flex-col gap-3 bg-[#eff4ff]/20 border-t border-[#e5eeff] animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs">
                    <h4 className="font-bold text-[#0b1c30] uppercase tracking-wider text-[11px]">
                      Chapters & Units ({subject.chapters.length} Total)
                    </h4>
                    <span className="text-[#707971] font-mono text-[11px]">
                      Click a chapter to expand topic breakdown
                    </span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {subject.chapters.map((chapter) => {
                      const isChapterExpanded = expandedChapterIds.includes(chapter.id);
                      const totalTopicsInChapter = chapter.topics.length;
                      const completedTopicsInChapter = chapter.topics.filter(
                        (t) => t.is_theory_done && t.is_practice_done
                      ).length;
                      const theoryDoneCount = chapter.topics.filter((t) => t.is_theory_done).length;
                      const practiceDoneCount = chapter.topics.filter((t) => t.is_practice_done).length;
                      const chapterProgressPercent =
                        totalTopicsInChapter > 0
                          ? ((theoryDoneCount + practiceDoneCount) / (totalTopicsInChapter * 2)) * 100
                          : 0;
                      const isChapterFullyDone =
                        totalTopicsInChapter > 0 &&
                        chapter.topics.every((t) => t.is_theory_done && t.is_practice_done);

                      return (
                        <div
                          key={chapter.id}
                          className="bg-white rounded-xl border border-[#c0c9c0]/30 shadow-2xs overflow-hidden transition-all duration-200"
                        >
                          {/* Chapter Header Row */}
                          <div
                            onClick={() => toggleChapterExpand(chapter.id)}
                            className={`p-4 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                              isChapterExpanded
                                ? 'bg-[#eff4ff]/70 border-b border-[#e5eeff]'
                                : 'hover:bg-[#eff4ff]/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                aria-label={isChapterExpanded ? 'Collapse chapter' : 'Expand chapter'}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                  isChapterExpanded
                                    ? 'bg-[#003820] text-white'
                                    : 'bg-[#eff4ff] text-[#404942]'
                                }`}
                              >
                                <span className="material-symbols-outlined text-sm">
                                  {isChapterExpanded ? 'expand_less' : 'expand_more'}
                                </span>
                              </button>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h5 className="text-xs sm:text-sm font-bold text-[#0b1c30]">
                                    {chapter.title}
                                  </h5>
                                  {isChapterFullyDone && (
                                    <span className="bg-[#6ffbbe]/30 text-[#002111] px-2 py-0.5 rounded text-[10px] font-bold font-mono">
                                      Mastered
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-[#404942] mt-0.5">
                                  {completedTopicsInChapter} of {totalTopicsInChapter} topics mastered • {theoryDoneCount} theory, {practiceDoneCount} practice
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end sm:self-auto">
                              <div className="w-24 sm:w-32 bg-[#e5eeff] h-2 rounded-full overflow-hidden hidden xs:block">
                                <div
                                  className="bg-[#003820] h-full transition-all duration-300"
                                  style={{ width: `${chapterProgressPercent}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold font-mono text-[#003820] tabular-nums min-w-[36px] text-right">
                                {Math.round(chapterProgressPercent)}%
                              </span>
                            </div>
                          </div>

                          {/* Chapter Topics Table */}
                          {isChapterExpanded && (
                            <div className="overflow-x-auto p-4 bg-white animate-in fade-in duration-150">
                              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                                <thead>
                                  <tr className="bg-[#eff4ff] text-[#404942] font-semibold text-[11px]">
                                    <th className="py-2.5 px-3 rounded-l-xl">Topic / Unit</th>
                                    <th className="py-2.5 px-3">Weightage</th>
                                    <th className="py-2.5 px-3">Theory Status (Weight = 1)</th>
                                    <th className="py-2.5 px-3">Practice / CQ (Weight = 1)</th>
                                    <th className="py-2.5 px-3">MCQ Drills</th>
                                    <th className="py-2.5 px-3 text-right rounded-r-xl">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#e5eeff]">
                                  {chapter.topics.map((topic) => {
                                    const isFullyDone = topic.is_theory_done && topic.is_practice_done;
                                    const isPartiallyDone =
                                      !isFullyDone && (topic.is_theory_done || topic.is_practice_done);

                                    const mcqPercent =
                                      topic.mcqTotal > 0
                                        ? Math.round((topic.mcqDone / topic.mcqTotal) * 100)
                                        : 0;

                                    return (
                                      <tr
                                        key={topic.id}
                                        className="hover:bg-[#eff4ff]/40 transition-colors"
                                      >
                                        <td className="py-3 px-3">
                                          <div className="font-bold text-[#0b1c30]">
                                            {topic.title}
                                          </div>
                                          <div className="text-[11px] text-[#404942]">
                                            {topic.subconcept}
                                          </div>
                                        </td>

                                        <td className="py-3 px-3 font-mono font-semibold text-[#0b1c30] whitespace-nowrap">
                                          {topic.weightageMarks} Marks ({topic.cqTarget} CQ)
                                        </td>

                                        {/* Interactive Theory Toggle Button */}
                                        <td className="py-3 px-3">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              onToggleTheory(subject.id, chapter.id, topic.id)
                                            }
                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer shadow-xs ${
                                              topic.is_theory_done
                                                ? 'bg-[#003820] text-white hover:bg-[#0f5132]'
                                                : 'bg-[#e5eeff] text-[#404942] hover:bg-[#dce9ff]'
                                            }`}
                                            title="Click to toggle Theory completion (1 point)"
                                          >
                                            <span className="material-symbols-outlined text-sm leading-none">
                                              {topic.is_theory_done ? 'check' : 'radio_button_unchecked'}
                                            </span>
                                            <span>{topic.is_theory_done ? 'Theory Done' : 'Unread'}</span>
                                          </button>
                                        </td>

                                        {/* Interactive Practice Toggle Button */}
                                        <td className="py-3 px-3">
                                          <div className="flex flex-col gap-1 w-36">
                                            <div className="flex justify-between items-center text-[11px]">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  onTogglePractice(subject.id, chapter.id, topic.id)
                                                }
                                                className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[10px] transition-all cursor-pointer ${
                                                  topic.is_practice_done
                                                    ? 'bg-[#6ffbbe]/40 text-[#002111] hover:bg-[#6ffbbe]/60'
                                                    : 'bg-[#e5eeff] text-[#404942] hover:bg-[#dce9ff]'
                                                }`}
                                                title="Click to toggle Practice/CQ completion (1 point)"
                                              >
                                                <span className="material-symbols-outlined text-xs">
                                                  {topic.is_practice_done
                                                    ? 'check_circle'
                                                    : 'radio_button_unchecked'}
                                                </span>
                                                <span>
                                                  {topic.is_practice_done
                                                    ? `${topic.cqTarget}/${topic.cqTarget} CQ`
                                                    : `${topic.cqDone}/${topic.cqTarget} CQ`}
                                                </span>
                                              </button>
                                              <span
                                                className={`font-mono text-[10px] font-bold ${
                                                  topic.is_practice_done ? 'text-[#006c49]' : 'text-[#707971]'
                                                }`}
                                              >
                                                {topic.is_practice_done ? '100%' : 'Pending'}
                                              </span>
                                            </div>
                                            <div className="w-full bg-[#e5eeff] h-1.5 rounded-full overflow-hidden">
                                              <div
                                                className={`h-full transition-all duration-300 ${
                                                  topic.is_practice_done ? 'bg-[#006c49]' : 'bg-[#c0c9c0]'
                                                }`}
                                                style={{
                                                  width: topic.is_practice_done ? '100%' : '30%',
                                                }}
                                              />
                                            </div>
                                          </div>
                                        </td>

                                        {/* MCQ Drills */}
                                        <td className="py-3 px-3">
                                          <div className="flex flex-col gap-1 w-28">
                                            <div className="flex justify-between text-[11px] font-mono">
                                              <span className="font-semibold text-[#0b1c30]">
                                                {topic.mcqDone}/{topic.mcqTotal}
                                              </span>
                                              <span className="text-[#006c49] font-medium">
                                                {mcqPercent}%
                                              </span>
                                            </div>
                                            <div className="w-full bg-[#e5eeff] h-1.5 rounded-full overflow-hidden">
                                              <div
                                                className="bg-[#006c49] h-full transition-all duration-300"
                                                style={{ width: `${mcqPercent}%` }}
                                              />
                                            </div>
                                          </div>
                                        </td>

                                        {/* Overall Topic Status Badge */}
                                        <td className="py-3 px-3 text-right">
                                          {isFullyDone ? (
                                            <span className="inline-flex items-center gap-1.5 bg-[#6ffbbe]/30 text-[#002111] px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                                              <span className="w-1.5 h-1.5 rounded-full bg-[#006c49]" />
                                              Completed
                                            </span>
                                          ) : isPartiallyDone ? (
                                            <span className="inline-flex items-center gap-1.5 bg-[#e5eeff] text-[#003820] font-semibold px-2.5 py-0.5 rounded-full text-[11px]">
                                              <span className="w-1.5 h-1.5 rounded-full bg-[#003820] animate-pulse" />
                                              In Progress
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 bg-[#eff4ff] text-[#707971] px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-[#c0c9c0]/30">
                                              Pending
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
