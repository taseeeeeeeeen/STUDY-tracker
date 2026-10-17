import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HSCProgressSummary, HSCSubjectProgress } from '../../types/hsc';
import { useStudyTrack } from '../../context/StudyTrackContext';

interface HSCHeroDonutsProps {
  summary: HSCProgressSummary;
}

export const HSCHeroDonuts: React.FC<HSCHeroDonutsProps> = ({ summary }) => {
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const navigate = useNavigate();

  const {
    grandProgressPercent,
    overallTheoryPercent,
    overallPracticePercent,
    totalTopics,
    completedTopicsCount,
    completedTheoryCount,
    completedPracticeCount,
    totalChapters,
    completedChaptersCount,
    totalMCQs,
    completedMCQs,
    totalCQs,
    completedCQs,
  } = summary;

  // Master Radial Gauge (r=70 -> circumference = 439.82)
  const masterCircumference = 439.82;
  const masterOffset = masterCircumference * (1 - grandProgressPercent / 100);

  // Twin Sub-Donuts (r=32 -> circumference = 201.06)
  const subCircumference = 201.06;
  const theoryOffset = subCircumference * (1 - overallTheoryPercent / 100);
  const practiceOffset = subCircumference * (1 - overallPracticePercent / 100);

  // HSC Grading Scale & GPA derivation
  const getGradeAndGPA = (pct: number) => {
    if (pct >= 80) return { grade: 'A+', gpa: 5.0 };
    if (pct >= 70) return { grade: 'A', gpa: 4.0 };
    if (pct >= 60) return { grade: 'A-', gpa: 3.5 };
    if (pct >= 50) return { grade: 'B', gpa: 3.0 };
    if (pct >= 40) return { grade: 'C', gpa: 2.0 };
    if (pct >= 33) return { grade: 'D', gpa: 1.0 };
    return { grade: 'F', gpa: 0.0 };
  };
  const { grade, gpa } = getGradeAndGPA(grandProgressPercent);

  // Group Progress Logic
  type GroupFilterType = 'science' | 'core' | 'custom';
  const [groupFilter, setGroupFilter] = useState<GroupFilterType>('science');
  const [customSelectedIds, setCustomSelectedIds] = useState<string[]>([]);
  const [isCustomExpanded, setIsCustomExpanded] = useState<boolean>(false);

  const { hscMasterSyllabus } = useStudyTrack();

  const allSubjectsList: HSCSubjectProgress[] = useMemo(() => {
    if (summary.perSubject && summary.perSubject.length > 0) {
      return summary.perSubject;
    }
    if (hscMasterSyllabus && hscMasterSyllabus.length > 0) {
      return hscMasterSyllabus.map((sub) => {
        const subTopics = sub.chapters.flatMap((c) => c.topics);
        const total = subTopics.length;
        const compTheory = subTopics.filter((t) => t.is_theory_done).length;
        const compPractice = subTopics.filter((t) => t.is_practice_done).length;
        const compBoth = subTopics.filter((t) => t.is_theory_done && t.is_practice_done).length;
        const pct = total > 0 ? ((compTheory + compPractice) / (total * 2)) * 100 : 0;
        return {
          id: sub.id,
          name: sub.name,
          totalTopics: total,
          completedTopicsCount: compBoth,
          completedTheoryCount: compTheory,
          completedPracticeCount: compPractice,
          progressPercent: pct,
          paperType: sub.paperType,
          icon: sub.icon,
        };
      });
    }
    return [];
  }, [summary.perSubject, hscMasterSyllabus]);

  const isScienceSubject = (name: string): boolean => {
    const lower = name.toLowerCase();
    return (
      lower.includes('physics') ||
      lower.includes('chemistry') ||
      lower.includes('math') ||
      lower.includes('biology') ||
      name.includes('ফিজিক্স') ||
      name.includes('কেমিস্ট্রি') ||
      name.includes('গণিত') ||
      name.includes('ম্যাথ') ||
      name.includes('জীব')
    );
  };

  const isCoreSubject = (name: string): boolean => {
    const lower = name.toLowerCase();
    return (
      lower.includes('bangla') ||
      lower.includes('english') ||
      lower.includes('ict') ||
      name.includes('বাংলা') ||
      name.includes('ইংরেজি') ||
      name.includes('তথ্য')
    );
  };

  const filteredSubjects: HSCSubjectProgress[] = useMemo(() => {
    if (groupFilter === 'science') {
      return allSubjectsList.filter((s) => isScienceSubject(s.name));
    }
    if (groupFilter === 'core') {
      return allSubjectsList.filter((s) => isCoreSubject(s.name));
    }
    // 'custom'
    if (customSelectedIds.length === 0) {
      return allSubjectsList;
    }
    return allSubjectsList.filter((s) => customSelectedIds.includes(s.id));
  }, [groupFilter, allSubjectsList, customSelectedIds]);

  const groupTotalTopics = filteredSubjects.reduce((sum, s) => sum + s.totalTopics, 0);
  const groupCompletedTheory = filteredSubjects.reduce((sum, s) => sum + s.completedTheoryCount, 0);
  const groupCompletedPractice = filteredSubjects.reduce((sum, s) => sum + s.completedPracticeCount, 0);
  const groupCompletedBoth = filteredSubjects.reduce((sum, s) => sum + s.completedTopicsCount, 0);

  // Group Progress % = ((Total Completed Theory + Total Completed Practice) / (Total Topics * 2)) * 100
  const groupProgressPercent =
    groupTotalTopics > 0
      ? ((groupCompletedTheory + groupCompletedPractice) / (groupTotalTopics * 2)) * 100
      : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Left/Center Hero: Total HSC Curriculum Completion (8 cols) */}
      <div className="lg:col-span-8 bg-white rounded-2xl p-6 sm:p-8 shadow-xs border border-[#c0c9c0]/30 flex flex-col justify-between">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-3 border-b border-[#e5eeff]/80">
          <div>
            <span className="text-[11px] text-[#006c49] uppercase tracking-wider font-semibold font-mono">
              Overall Syllabus
            </span>
            <h2 className="text-xl text-[#0b1c30] font-bold tracking-tight">
              HSC Syllabus Completion
            </h2>
          </div>
          <div className="flex items-center gap-1.5 bg-[#6ffbbe]/25 text-[#003820] px-3 py-1 rounded-full self-start sm:self-auto border border-[#6ffbbe]/80">
            <span className="material-symbols-outlined text-sm font-semibold text-[#006c49]">
              trending_up
            </span>
            <span className="text-xs font-semibold font-mono">Weekly progress</span>
          </div>
        </div>

        {/* Main Chart Display & Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 my-6 items-center">
          {/* Master Radial Gauge SVG */}
          <div className="md:col-span-5 flex flex-col items-center justify-center relative">
            <div className="relative w-52 h-52 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                {/* Background track */}
                <circle
                  className="text-[#e5eeff]"
                  cx="80"
                  cy="80"
                  fill="transparent"
                  r="70"
                  stroke="currentColor"
                  strokeWidth="12"
                />
                {/* Master completed ring */}
                <circle
                  className="text-[#003820] transition-all duration-700 ease-out"
                  cx="80"
                  cy="80"
                  fill="transparent"
                  r="70"
                  stroke="currentColor"
                  strokeDasharray={masterCircumference}
                  strokeDashoffset={Math.max(0, masterOffset)}
                  strokeLinecap="round"
                  strokeWidth="12"
                />
                {/* Secondary inner ring: Theory baseline */}
                <circle
                  className="text-[#006c49] opacity-40 transition-all duration-700 ease-out"
                  cx="80"
                  cy="80"
                  fill="transparent"
                  r="56"
                  stroke="currentColor"
                  strokeDasharray="351.86"
                  strokeDashoffset={351.86 * (1 - overallTheoryPercent / 100)}
                  strokeLinecap="round"
                  strokeWidth="4"
                />
              </svg>

              {/* Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
                <span className="text-4xl text-[#003820] font-extrabold tracking-tight font-mono tabular-nums">
                  {Math.round(grandProgressPercent)}%
                </span>
                <span className="text-[11px] text-[#404942] font-semibold uppercase tracking-wider">
                  Overall Progress
                </span>
              </div>
            </div>

            <div className="mt-2 text-center">
              <span className="text-base text-[#0b1c30] font-bold tabular-nums">
                {completedTopicsCount} of {totalTopics} Topics
              </span>
              <p className="text-xs text-[#404942]">Across Physics, Chemistry, Math & Biology</p>
            </div>
          </div>

          {/* Micro Analytics Columns */}
          <div className="md:col-span-7 flex flex-col justify-center gap-3">
            <div className="bg-[#eff4ff] rounded-xl p-3.5 flex items-center justify-between border border-[#c0c9c0]/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#003820] text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">menu_book</span>
                </div>
                <div>
                  <div className="text-xs text-[#0b1c30] font-semibold">
                    Completed Chapters
                  </div>
                  <div className="text-[11px] text-[#404942]">
                    {completedChaptersCount} of {totalChapters} chapters completed
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base text-[#003820] font-bold font-mono tabular-nums">
                  {totalChapters > 0
                    ? ((completedChaptersCount / totalChapters) * 100).toFixed(1)
                    : '0.0'}%
                </span>
              </div>
            </div>

            <div className="bg-[#eff4ff] rounded-xl p-3.5 flex items-center justify-between border border-[#c0c9c0]/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#006c49] text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">quiz</span>
                </div>
                <div>
                  <div className="text-xs text-[#0b1c30] font-semibold">
                    MCQ Practice
                  </div>
                  <div className="text-[11px] text-[#404942]">
                    {completedMCQs.toLocaleString()} of {totalMCQs.toLocaleString()} questions practiced
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base text-[#006c49] font-bold font-mono tabular-nums">
                  {totalMCQs > 0 ? ((completedMCQs / totalMCQs) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
            </div>

            <div className="bg-[#eff4ff] rounded-xl p-3.5 flex items-center justify-between border border-[#c0c9c0]/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#0a503d] text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">draw</span>
                </div>
                <div>
                  <div className="text-xs text-[#0b1c30] font-semibold">
                    CQ Practice
                  </div>
                  <div className="text-[11px] text-[#404942]">
                    {completedCQs} of {totalCQs} creative questions solved
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-base text-[#0a503d] font-bold font-mono tabular-nums">
                  {totalCQs > 0 ? ((completedCQs / totalCQs) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Pair of Side-by-Side Radial Charts: Theory vs Practice */}
        <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#e5eeff]/80">
          {/* Donut 2: Overall Theory Mastery */}
          <div className="bg-[#eff4ff] rounded-xl p-4 flex items-center gap-4 border border-[#c0c9c0]/30">
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                <circle
                  className="text-[#e5eeff]"
                  cx="40"
                  cy="40"
                  fill="transparent"
                  r="32"
                  stroke="currentColor"
                  strokeWidth="7"
                />
                <circle
                  className="text-[#003820] transition-all duration-700 ease-out"
                  cx="40"
                  cy="40"
                  fill="transparent"
                  r="32"
                  stroke="currentColor"
                  strokeDasharray={subCircumference}
                  strokeDashoffset={Math.max(0, theoryOffset)}
                  strokeLinecap="round"
                  strokeWidth="7"
                />
              </svg>
              <span className="absolute text-xs text-[#0b1c30] font-bold font-mono tabular-nums">
                {Math.round(overallTheoryPercent)}%
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-[#0b1c30] font-bold truncate">
                Theory Coverage
              </span>
              <span className="text-[11px] text-[#404942]">
                {completedTheoryCount}/{totalTopics} Topics Completed
              </span>
              <div className="flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#003820]" />
                <span className="text-[10px] text-[#003820] font-medium font-mono">
                  Textbook Concepts
                </span>
              </div>
            </div>
          </div>

          {/* Donut 3: Practice & Test Drills */}
          <div className="bg-[#eff4ff] rounded-xl p-4 flex items-center gap-4 border border-[#c0c9c0]/30">
            <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                <circle
                  className="text-[#e5eeff]"
                  cx="40"
                  cy="40"
                  fill="transparent"
                  r="32"
                  stroke="currentColor"
                  strokeWidth="7"
                />
                <circle
                  className="text-[#006c49] transition-all duration-700 ease-out"
                  cx="40"
                  cy="40"
                  fill="transparent"
                  r="32"
                  stroke="currentColor"
                  strokeDasharray={subCircumference}
                  strokeDashoffset={Math.max(0, practiceOffset)}
                  strokeLinecap="round"
                  strokeWidth="7"
                />
              </svg>
              <span className="absolute text-xs text-[#0b1c30] font-bold font-mono tabular-nums">
                {Math.round(overallPracticePercent)}%
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-[#0b1c30] font-bold truncate">
                Practice Coverage
              </span>
              <span className="text-[11px] text-[#404942]">
                {completedPracticeCount}/{totalTopics} Problem Sets Done
              </span>
              <div className="flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#006c49]" />
                <span className="text-[10px] text-[#006c49] font-medium font-mono">
                  Problem Sets & Drills
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Complementary Card: Subject Group Progress (4 cols) */}
      <div className="lg:col-span-4 bg-white rounded-2xl p-6 sm:p-8 shadow-xs border border-[#c0c9c0]/30 flex flex-col justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#006c49] uppercase tracking-wider font-semibold font-mono">
              Group Progress
            </span>
            <span className="bg-[#eff4ff] text-[#003820] px-2 py-0.5 rounded text-[10px] font-semibold border border-[#c0c9c0]/30 font-mono">
              {filteredSubjects.length} {filteredSubjects.length === 1 ? 'Subject' : 'Subjects'}
            </span>
          </div>

          <div>
            <h2 className="text-lg text-[#0b1c30] font-bold">Subject Group Progress</h2>
            <p className="text-xs text-[#404942] mt-0.5">
              Curriculum tracking by academic track or custom subject selection.
            </p>
          </div>

          {/* Segmented Filter Control */}
          <div className="mt-1 flex items-center p-1 bg-[#eff4ff] rounded-xl border border-[#c0c9c0]/30 text-xs">
            <button
              type="button"
              onClick={() => {
                setGroupFilter('science');
                setIsCustomExpanded(false);
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition-all text-center cursor-pointer ${
                groupFilter === 'science'
                  ? 'bg-[#003820] text-white shadow-xs'
                  : 'text-[#404942] hover:text-[#0b1c30]'
              }`}
            >
              Science
            </button>
            <button
              type="button"
              onClick={() => {
                setGroupFilter('core');
                setIsCustomExpanded(false);
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition-all text-center cursor-pointer ${
                groupFilter === 'core'
                  ? 'bg-[#003820] text-white shadow-xs'
                  : 'text-[#404942] hover:text-[#0b1c30]'
              }`}
            >
              Core Subjects
            </button>
            <button
              type="button"
              onClick={() => {
                setGroupFilter('custom');
                setIsCustomExpanded((prev) => !prev);
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition-all text-center cursor-pointer flex items-center justify-center gap-1 ${
                groupFilter === 'custom'
                  ? 'bg-[#003820] text-white shadow-xs'
                  : 'text-[#404942] hover:text-[#0b1c30]'
              }`}
            >
              <span>Custom</span>
              <span className="material-symbols-outlined text-[14px]">
                {groupFilter === 'custom' && isCustomExpanded ? 'expand_less' : 'tune'}
              </span>
            </button>
          </div>

          {/* Custom Subject Picker Checklist */}
          {groupFilter === 'custom' && isCustomExpanded && (
            <div className="mt-1 p-3 bg-white rounded-xl border border-[#c0c9c0]/40 shadow-xs space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center justify-between text-[11px] pb-1 border-b border-gray-100">
                <span className="font-semibold text-[#0b1c30]">Select Subjects</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCustomSelectedIds(allSubjectsList.map((s) => s.id))}
                    className="text-[#006c49] hover:underline cursor-pointer font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">•</span>
                  <button
                    type="button"
                    onClick={() => setCustomSelectedIds([])}
                    className="text-[#707971] hover:underline cursor-pointer font-medium"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {allSubjectsList.map((s) => {
                  const isChecked =
                    customSelectedIds.length === 0 || customSelectedIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-gray-50 text-xs cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCustomSelectedIds((prev) =>
                                prev.length === 0 ? [s.id] : [...prev, s.id]
                              );
                            } else {
                              const currentSelected =
                                customSelectedIds.length === 0
                                  ? allSubjectsList.map((sub) => sub.id)
                                  : customSelectedIds;
                              setCustomSelectedIds(currentSelected.filter((id) => id !== s.id));
                            }
                          }}
                          className="rounded text-[#003820] focus:ring-[#003820] accent-[#003820]"
                        />
                        <span className="truncate text-[#0b1c30] text-[11px]">{s.name}</span>
                      </div>
                      <span className="font-mono text-[10px] text-[#707971] shrink-0">
                        {Math.round(s.progressPercent)}%
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Main Display Area: Aggregated Percentage Banner */}
        <div className="my-4 p-5 rounded-2xl bg-gradient-to-br from-[#0f5132] via-[#003820] to-[#002111] text-white flex items-center justify-between shadow-sm relative overflow-hidden">
          <div className="flex flex-col relative z-10">
            <span className="text-[11px] text-[#95d4ac] font-semibold uppercase tracking-wider font-mono">
              {groupFilter === 'science'
                ? 'Science Track'
                : groupFilter === 'core'
                ? 'Core Track'
                : 'Custom Track'}{' '}
              Progress
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-4xl font-extrabold tracking-tight font-mono tabular-nums">
                {groupProgressPercent.toFixed(1)}%
              </span>
            </div>
            <span className="text-[11px] text-white/80 mt-1 font-mono">
              {groupCompletedBoth} of {groupTotalTopics} Topics Complete
            </span>
          </div>

          <div className="relative z-10 text-right flex flex-col items-end">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center text-[#6ffbbe] border border-white/10">
              <span className="material-symbols-outlined text-2xl">
                {groupFilter === 'science'
                  ? 'science'
                  : groupFilter === 'core'
                  ? 'auto_stories'
                  : 'tune'}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-[#6ffbbe] mt-1 font-mono">
              {groupCompletedTheory + groupCompletedPractice} / {groupTotalTopics * 2} Pts
            </div>
          </div>

          <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        </div>

        {/* Sub-list detailing specific subjects currently included in that group */}
        <div className="flex-1 space-y-2 min-h-[140px] max-h-[185px] overflow-y-auto pr-1">
          {filteredSubjects.length === 0 ? (
            <div className="h-full flex items-center justify-center p-4 border border-dashed border-gray-200 rounded-xl text-center">
              <span className="text-xs text-[#707971]">No subjects selected</span>
            </div>
          ) : (
            filteredSubjects.map((sub) => {
              const subPercent = Math.round(sub.progressPercent);
              return (
                <div
                  key={sub.id}
                  className="bg-[#eff4ff] p-2.5 rounded-xl border border-[#c0c9c0]/30 space-y-1.5 transition-all hover:border-[#003820]/30"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0b1c30] truncate text-[11px]">
                      {sub.name}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-[#003820] tabular-nums shrink-0 ml-2">
                      {subPercent}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-[#e5eeff] rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-[#003820] transition-all duration-500 rounded-full"
                      style={{ width: `${subPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#404942] font-mono">
                    <span>
                      {sub.completedTopicsCount}/{sub.totalTopics} topics done
                    </span>
                    <span>
                      {sub.completedTheoryCount + sub.completedPracticeCount}/{sub.totalTopics * 2} pts
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Action Button */}
        <div className="pt-3 mt-auto">
          <button
            type="button"
            onClick={() => setIsSimModalOpen(true)}
            className="w-full bg-[#eff4ff] hover:bg-[#e5eeff] text-[#003820] text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors border border-[#c0c9c0]/30 cursor-pointer"
          >
            <span>Simulate Dhaka Board Exam</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* Dhaka Board Exam Simulation Modal */}
      {isSimModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#c0c9c0]/40 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#e5eeff]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#003820] text-[#6ffbbe] flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">school</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0b1c30]">Dhaka Board Exam Simulation</h3>
                  <p className="text-[11px] text-[#404942]">HSC Standard Examination Readiness Model</p>
                </div>
              </div>
              <button
                onClick={() => setIsSimModalOpen(false)}
                className="p-1 rounded-lg text-[#707971] hover:text-[#0b1c30] hover:bg-[#eff4ff] cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Projected Score Overview */}
            <div className="p-4 rounded-xl bg-[#003820] text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[#95d4ac] uppercase font-mono font-semibold">Predicted Outcome</span>
                <div className="text-2xl font-extrabold mt-0.5">Grade {grade} ({gpa.toFixed(2)} GPA)</div>
                <div className="text-xs text-white/80 mt-0.5">
                  Est. Overall Marks: {Math.round(grandProgressPercent)}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono text-[#6ffbbe]">
                  {Math.round(grandProgressPercent)}%
                </div>
                <div className="text-[10px] text-[#6ffbbe]/80 uppercase font-mono">Curriculum Done</div>
              </div>
            </div>

            {/* Sub-components breakdown */}
            <div className="space-y-2.5 text-xs">
              <div className="bg-[#eff4ff] p-3 rounded-xl border border-[#c0c9c0]/30 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#0b1c30]">Theory Knowledge (Textbook Concepts)</div>
                  <div className="text-[11px] text-[#404942]">{completedTheoryCount} of {totalTopics} topics studied</div>
                </div>
                <span className="font-mono font-bold text-[#003820]">{Math.round(overallTheoryPercent)}%</span>
              </div>

              <div className="bg-[#eff4ff] p-3 rounded-xl border border-[#c0c9c0]/30 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#0b1c30]">MCQ Section (30 Marks Weight)</div>
                  <div className="text-[11px] text-[#404942]">{completedMCQs.toLocaleString()} of {totalMCQs.toLocaleString()} questions solved</div>
                </div>
                <span className="font-mono font-bold text-[#006c49]">
                  {totalMCQs > 0 ? ((completedMCQs / totalMCQs) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>

              <div className="bg-[#eff4ff] p-3 rounded-xl border border-[#c0c9c0]/30 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#0b1c30]">CQ Section (70 Marks Weight)</div>
                  <div className="text-[11px] text-[#404942]">{completedCQs} of {totalCQs} creative sets solved</div>
                </div>
                <span className="font-mono font-bold text-[#0a503d]">
                  {totalCQs > 0 ? ((completedCQs / totalCQs) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e5eeff]">
              <button
                type="button"
                onClick={() => setIsSimModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#404942] hover:bg-[#eff4ff] cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSimModalOpen(false);
                  navigate('/challenges');
                }}
                className="px-4 py-2 bg-[#003820] hover:bg-[#0f5132] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <span>Plan Study Sprint</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
