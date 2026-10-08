import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MasterSubject } from '../types/syllabus';
import { SyllabusItem, BoardCard } from '../types/wizard';
import { subscribeMasterSyllabus } from '../services/syllabusService';
import { flattenAndDedupeMasterSyllabus } from '../utils/syllabusFlatten';
import { buildStrategicRoutine } from '../utils/strategyPlannerLogic';
import { getLocalDateString, parseLocalDate } from '../utils/dateUtils';

export const StrategyPlannerPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Internal 3-Screen Stepper: 1 = Exam Setup, 2 = Topic Selection, 3 = Plan Preview
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Today in user's local timezone (YYYY-MM-DD)
  const todayDateString = useMemo(() => getLocalDateString(new Date()), []);

  // Default exam date: 21 days from today
  const defaultExamDateString = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return getLocalDateString(d);
  }, []);

  // --- STEP 1 STATE: Exam & Window Setup ---
  const [examName, setExamName] = useState('HSC Board Examination');
  const [prepStartDate, setPrepStartDate] = useState(todayDateString);
  const [examStartDate, setExamStartDate] = useState(defaultExamDateString);
  const [capacityMinutes, setCapacityMinutes] = useState(150); // Wizard default: 150 min/day

  // DATE SEMANTICS:
  // durationDays = number of days from prep start through exam eve, i.e. (examStart - prepStart) in whole days.
  // The wizard's Step 1 start date = prep start date; the challenge's last study day is the day before the exam.
  // Formula: Math.round((examDate.getTime() - prepDate.getTime()) / (1000 * 60 * 60 * 24))
  // To include exam day in the future, change to: Math.round((examDate.getTime() - prepDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const durationDays = useMemo(() => {
    if (!prepStartDate || !examStartDate) return 0;
    const prepObj = parseLocalDate(prepStartDate);
    const examObj = parseLocalDate(examStartDate);
    const diffMs = examObj.getTime() - prepObj.getTime();
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  }, [prepStartDate, examStartDate]);

  // Last prep day = the day BEFORE the exam starts
  const lastPrepDateString = useMemo(() => {
    if (!examStartDate) return '';
    const examObj = parseLocalDate(examStartDate);
    const eveObj = new Date(examObj.getFullYear(), examObj.getMonth(), examObj.getDate() - 1);
    return getLocalDateString(eveObj);
  }, [examStartDate]);

  // Step 1 validation
  const step1Error = useMemo(() => {
    if (!examName.trim()) return 'Please enter an exam title.';
    if (!prepStartDate) return 'Please select a prep start date.';
    if (!examStartDate) return 'Please select an exam date.';
    if (durationDays < 1) return 'Exam date must be after the prep start date (minimum 1 day prep).';
    if (capacityMinutes < 30 || capacityMinutes > 720) return 'Daily capacity must be between 30 and 720 minutes (30 min to 12 hours).';
    return null;
  }, [examName, prepStartDate, examStartDate, durationDays, capacityMinutes]);

  // --- STEP 2 STATE: Syllabus & Topic Selection ---
  const [masterSubjects, setMasterSubjects] = useState<MasterSubject[]>([]);
  const [syllabusItems, setSyllabusItems] = useState<SyllabusItem[]>([]);
  const [loadingSyllabus, setLoadingSyllabus] = useState(true);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [openSubjectNames, setOpenSubjectNames] = useState<string[]>([]);
  const [openChapterIds, setOpenChapterIds] = useState<string[]>([]);

  // Subscribe to the SAME master_syllabus collection using the shared helper
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeMasterSyllabus(
      (subjects) => {
        setMasterSubjects(subjects);
        const flattened = flattenAndDedupeMasterSyllabus(subjects);
        setSyllabusItems(flattened);
        setLoadingSyllabus(false);
        // Expand first subject by default
        if (subjects.length > 0) {
          setOpenSubjectNames([subjects[0].name]);
        }
      },
      (err) => {
        console.error('Failed to load master syllabus:', err);
        setLoadingSyllabus(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // Topic selection toggles
  const handleToggleTopic = (id: string) => {
    setSyllabusItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const handleToggleChapter = (_chapterId: string, chapterTopics: SyllabusItem[], allChecked: boolean) => {
    const topicIdSet = new Set(chapterTopics.map((t) => t.id));
    setSyllabusItems((prev) =>
      prev.map((item) => (topicIdSet.has(item.id) ? { ...item, checked: !allChecked } : item))
    );
  };

  const handleToggleSubject = (_subjectName: string, subjectTopics: SyllabusItem[], allChecked: boolean) => {
    const topicIdSet = new Set(subjectTopics.map((t) => t.id));
    setSyllabusItems((prev) =>
      prev.map((item) => (topicIdSet.has(item.id) ? { ...item, checked: !allChecked } : item))
    );
  };

  const handleSelectAllSyllabus = (selectAll: boolean) => {
    setSyllabusItems((prev) => prev.map((item) => ({ ...item, checked: selectAll })));
  };

  // Selected topics metrics
  const selectedTopics = useMemo(() => syllabusItems.filter((t) => t.checked), [syllabusItems]);
  const totalSelectedMinutes = useMemo(
    () => selectedTopics.reduce((sum, t) => sum + (t.durationMinutes || 45), 0),
    [selectedTopics]
  );
  const projectedAvgDailyMinutes = useMemo(
    () => (durationDays > 0 ? Math.round(totalSelectedMinutes / durationDays) : 0),
    [totalSelectedMinutes, durationDays]
  );

  // --- STEP 3 STATE: Generated Strategic Plan ---
  const [dayWisePlan, setDayWisePlan] = useState<Record<string, BoardCard[]>>({});
  const [planWarnings, setPlanWarnings] = useState<string[]>([]);
  const [planGenerated, setPlanGenerated] = useState(false);

  // Group selected topics by chapter & distribute using buildStrategicRoutine
  const generatePlan = () => {
    if (selectedTopics.length === 0 || durationDays <= 0) return;

    const { allocation, warnings } = buildStrategicRoutine({
      topics: selectedTopics,
      numDays: durationDays,
      dailyCapacityMinutes: capacityMinutes,
    });

    setDayWisePlan(allocation);
    setPlanWarnings(warnings);
    setPlanGenerated(true);
    setCurrentStep(3);
  };

  // Import to Challenge Wizard handler
  const handleImportToChallengeWizard = () => {
    if (!planGenerated || Object.keys(dayWisePlan).length === 0) return;

    navigate('/challenges', {
      state: {
        strategyImport: {
          examName: examName.trim(),
          prepStartDate,
          examStartDate,
          durationDays,
          dayWiseAllocation: dayWisePlan,
          selectedTopicIds: selectedTopics.map((t) => t.id),
        },
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0b1c30] p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e8f0] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#006c49] font-mono font-semibold uppercase tracking-wider mb-1">
            <span>Core Module</span>
            <span>•</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
              Strategic Planning
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0b1c30] tracking-tight flex items-center gap-2.5">
            <span className="material-symbols-outlined text-3xl text-[#003820]">insights</span>
            <span>Strategy Planner</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#404942] mt-1 max-w-2xl leading-relaxed">
            Target your exam date, select your curriculum topics, and automatically balance your daily study workload
            leading up to the exam. Then drop the plan straight into the Challenge Wizard with one click.
          </p>
        </div>

        {/* Stepper Progress Bar */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-white p-2 rounded-2xl border border-[#c0c9c0]/30 shadow-xs">
          {[
            { num: 1, label: 'Exam Setup', icon: 'event' },
            { num: 2, label: 'Topic Scope', icon: 'checklist' },
            { num: 3, label: 'Plan Preview', icon: 'calendar_view_week' },
          ].map((s) => {
            const isActive = currentStep === s.num;
            const isDone = currentStep > s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => {
                  if (s.num === 1) setCurrentStep(1);
                  if (s.num === 2 && !step1Error) setCurrentStep(2);
                  if (s.num === 3 && planGenerated) setCurrentStep(3);
                }}
                disabled={(s.num === 2 && Boolean(step1Error)) || (s.num === 3 && !planGenerated)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                  isActive
                    ? 'bg-[#003820] text-white shadow-xs'
                    : isDone
                    ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : 'text-[#707971] hover:bg-gray-100'
                }`}
              >
                <span className="material-symbols-outlined text-sm">{isDone ? 'check' : s.icon}</span>
                <span className="hidden md:inline">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SCREEN 1: EXAM SETUP & COUNTDOWN WINDOW                                  */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          {/* Form Configuration Card */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-[#c0c9c0]/40 shadow-xs space-y-6">
            <div className="flex items-center gap-3 border-b border-[#e2e8f0] pb-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#003820] flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">event_upcoming</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#0b1c30]">Step 1: Exam &amp; Prep Window</h2>
                <p className="text-xs text-[#707971]">Define your exam date to compute your available study runway</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Exam Name */}
              <div className="space-y-1.5">
                <label className="font-semibold text-[#0b1c30] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-[#006c49]">badge</span>
                  <span>Exam Title or Target Sprint Name</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="e.g. HSC Physics Board Exam, Chemistry Midterm"
                  className="w-full bg-[#f8fafc] border border-[#c0c9c0] rounded-xl p-3 text-xs text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#003820] focus:bg-white shadow-xs"
                />
              </div>

              {/* Date Controls Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Prep Start Date */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-[#0b1c30] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-[#006c49]">play_circle</span>
                    <span>Prep Start Date</span>
                  </label>
                  <input
                    type="date"
                    value={prepStartDate}
                    min={todayDateString}
                    onChange={(e) => setPrepStartDate(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-[#c0c9c0] rounded-xl p-3 text-xs text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#003820] focus:bg-white shadow-xs"
                  />
                  <span className="text-[10px] text-[#707971]">Defaults to Today (local date)</span>
                </div>

                {/* Exam Start Date */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-[#0b1c30] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-red-600">flag</span>
                    <span>Exam Start Date</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={examStartDate}
                    min={prepStartDate || todayDateString}
                    onChange={(e) => setExamStartDate(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-[#c0c9c0] rounded-xl p-3 text-xs text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#003820] focus:bg-white shadow-xs"
                  />
                  <span className="text-[10px] text-[#707971]">Day the exam actually begins</span>
                </div>
              </div>

              {/* Daily Capacity Slider & Input */}
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#0b1c30] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-[#006c49]">timer</span>
                    <span>Daily Study Capacity Target</span>
                  </label>
                  <span className="font-mono text-xs font-bold text-[#003820] px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    {capacityMinutes} min / day ({Math.floor(capacityMinutes / 60)}h {capacityMinutes % 60}m)
                  </span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="720"
                  step="15"
                  value={capacityMinutes}
                  onChange={(e) => setCapacityMinutes(Number(e.target.value))}
                  className="w-full accent-[#003820] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#707971] font-mono">
                  <span>1h (Light)</span>
                  <span>2.5h (Recommended Wizard default: 150m)</span>
                  <span>12h (Intensive)</span>
                </div>
              </div>

              {step1Error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">error</span>
                  <span>{step1Error}</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#e2e8f0] flex justify-end">
              <button
                type="button"
                disabled={Boolean(step1Error)}
                onClick={() => setCurrentStep(2)}
                className="px-6 py-2.5 rounded-xl bg-[#003820] hover:bg-[#0f5132] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Continue to Topic Selection</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* Live Computed Prep Window Breakdown */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#c0c9c0]/40 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#707971] font-mono">
                  Live Prep Window
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-[#003820] text-[#6ffbbe] text-[10px] font-mono font-bold">
                  {durationDays} Days Runway
                </span>
              </div>

              {/* Big Countdown Number */}
              <div className="text-center py-2 bg-gradient-to-br from-emerald-50 to-[#eff4ff] rounded-2xl p-4 border border-emerald-100">
                <span className="text-4xl sm:text-5xl font-black text-[#003820] tracking-tight">
                  {durationDays}
                </span>
                <span className="text-sm font-bold text-[#003820] ml-2">Days Available</span>
                <p className="text-[11px] text-[#404942] mt-1 font-mono">
                  {prepStartDate} → {lastPrepDateString} (Exam Eve)
                </p>
              </div>

              {/* Dates Breakdown List */}
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8fafc] border border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[#404942]">Prep Starts:</span>
                  </div>
                  <span className="font-mono font-bold text-[#0b1c30]">{prepStartDate}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#f8fafc] border border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-[#404942]">Last Study Day (Exam Eve):</span>
                  </div>
                  <span className="font-mono font-bold text-[#0b1c30]">{lastPrepDateString || '—'}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-red-50/50 border border-red-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-red-900 font-semibold">Exam Day:</span>
                  </div>
                  <span className="font-mono font-bold text-red-900">{examStartDate}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100">
                  <span className="text-[#006c49]">Total Study Budget:</span>
                  <span className="font-mono font-bold text-[#003820]">
                    ~{Math.round((durationDays * capacityMinutes) / 60)} hours
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-[#707971] leading-relaxed p-3 rounded-xl bg-[#eff4ff] border border-[#c0c9c0]/30 flex items-start gap-2">
                <span className="material-symbols-outlined text-base text-[#006c49] shrink-0">info</span>
                <span>
                  <strong>Date Semantics:</strong> The wizard's challenge concludes the day before the exam so exam day itself is clear for testing.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 2: TOPIC SELECTION FROM MASTER SYLLABUS                            */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Header & Quick Actions Bar */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#c0c9c0]/40 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold font-mono">
                  {examName}
                </span>
                <span className="text-xs text-[#707971]">•</span>
                <span className="text-xs font-mono text-[#003820] font-semibold">
                  {durationDays} Days Runway
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#0b1c30]">Select Curriculum Topics to Cover</h2>
              <p className="text-xs text-[#404942]">
                Choose the chapters and topics to include in your strategic plan
              </p>
            </div>

            {/* Selection Stats Pill */}
            <div className="flex items-center gap-3">
              <div className="bg-[#f8fafc] border border-[#c0c9c0]/30 rounded-2xl p-3 flex items-center gap-4 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-[#707971] block">Selected Topics</span>
                  <span className="font-bold text-sm text-[#003820]">{selectedTopics.length}</span>
                </div>
                <div className="h-6 w-px bg-gray-200" />
                <div>
                  <span className="text-[10px] text-[#707971] block">Total Duration</span>
                  <span className="font-bold text-sm text-[#003820]">
                    {Math.round(totalSelectedMinutes / 60)}h {totalSelectedMinutes % 60}m
                  </span>
                </div>
                <div className="h-6 w-px bg-gray-200" />
                <div>
                  <span className="text-[10px] text-[#707971] block">Avg Workload</span>
                  <span
                    className={`font-bold text-sm ${
                      projectedAvgDailyMinutes > capacityMinutes ? 'text-amber-600' : 'text-[#003820]'
                    }`}
                  >
                    {projectedAvgDailyMinutes}m / day
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={selectedTopics.length === 0}
                onClick={generatePlan}
                className="px-5 py-3 rounded-2xl bg-[#003820] hover:bg-[#0f5132] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <span>Generate Plan</span>
                <span className="material-symbols-outlined text-sm">insights</span>
              </button>
            </div>
          </div>

          {/* Filter Bar & Quick Select Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#c0c9c0]/30 shadow-xs">
            {/* Subject Filters */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedSubjectFilter('all')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  selectedSubjectFilter === 'all'
                    ? 'bg-[#003820] text-white'
                    : 'bg-gray-100 text-[#404942] hover:bg-gray-200'
                }`}
              >
                All Subjects ({syllabusItems.length})
              </button>
              {masterSubjects.map((sub) => {
                const subTopics = syllabusItems.filter((t) => t.subject === sub.name);
                const subSelected = subTopics.filter((t) => t.checked).length;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setSelectedSubjectFilter(sub.name)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                      selectedSubjectFilter === sub.name
                        ? 'bg-[#003820] text-white'
                        : 'bg-gray-100 text-[#404942] hover:bg-gray-200'
                    }`}
                  >
                    <span>{sub.name}</span>
                    <span className="text-[10px] opacity-75 font-mono">
                      {subSelected}/{subTopics.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Bulk Actions */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search topics..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="px-3 py-1 text-xs bg-[#f8fafc] border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#003820] w-36 sm:w-48"
              />
              <button
                type="button"
                onClick={() => handleSelectAllSyllabus(true)}
                className="px-2.5 py-1 text-xs text-[#006c49] hover:bg-emerald-50 rounded-lg font-semibold transition-colors cursor-pointer"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => handleSelectAllSyllabus(false)}
                className="px-2.5 py-1 text-xs text-[#ba1a1a] hover:bg-red-50 rounded-lg font-semibold transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Syllabus Hierarchical Tree */}
          {loadingSyllabus ? (
            <div className="p-12 text-center text-[#707971] text-xs font-mono bg-white rounded-3xl border border-gray-100">
              Loading master curriculum...
            </div>
          ) : (
            <div className="space-y-4">
              {masterSubjects
                .filter((sub) => selectedSubjectFilter === 'all' || selectedSubjectFilter === sub.name)
                .map((sub) => {
                  const subjectItems = syllabusItems.filter((t) => t.subject === sub.name);
                  const subjectSelectedCount = subjectItems.filter((t) => t.checked).length;
                  const isSubjectAllChecked = subjectItems.length > 0 && subjectSelectedCount === subjectItems.length;
                  const isSubjectOpen = openSubjectNames.includes(sub.name);

                  // Filtered chapters for this subject
                  const chapters = sub.chapters || [];

                  return (
                    <div
                      key={sub.id}
                      className="bg-white rounded-3xl border border-[#c0c9c0]/40 shadow-xs overflow-hidden transition-all"
                    >
                      {/* Subject Level Header */}
                      <div className="p-4 sm:p-5 bg-gradient-to-r from-[#eff4ff]/60 to-white flex items-center justify-between border-b border-[#e2e8f0]">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSubjectAllChecked}
                            ref={(el) => {
                              if (el) {
                                el.indeterminate =
                                  subjectSelectedCount > 0 && subjectSelectedCount < subjectItems.length;
                              }
                            }}
                            onChange={() => handleToggleSubject(sub.name, subjectItems, isSubjectAllChecked)}
                            className="rounded border-[#c0c9c0] text-[#003820] focus:ring-[#003820] w-4 h-4 cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setOpenSubjectNames((prev) =>
                                prev.includes(sub.name) ? prev.filter((n) => n !== sub.name) : [...prev, sub.name]
                              )
                            }
                            className="flex items-center gap-2 text-left cursor-pointer group"
                          >
                            <span className="font-bold text-sm sm:text-base text-[#0b1c30] group-hover:text-[#003820] transition-colors">
                              {sub.name}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#e5eeff] text-[#003820]">
                              {subjectSelectedCount}/{subjectItems.length} selected
                            </span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setOpenSubjectNames((prev) =>
                              prev.includes(sub.name) ? prev.filter((n) => n !== sub.name) : [...prev, sub.name]
                            )
                          }
                          className="p-1 rounded-lg text-[#707971] hover:bg-gray-100 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-lg">
                            {isSubjectOpen ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                      </div>

                      {/* Chapters Accordion Content */}
                      {isSubjectOpen && (
                        <div className="p-4 sm:p-5 space-y-4">
                          {chapters.map((ch) => {
                            const chapterItems = subjectItems.filter((t) => t.chapterId === ch.id);
                            if (chapterItems.length === 0) return null;

                            // Apply optional search filter
                            const matchingItems = chapterItems.filter((item) =>
                              searchFilter ? item.title.toLowerCase().includes(searchFilter.toLowerCase()) : true
                            );
                            if (matchingItems.length === 0 && searchFilter) return null;

                            const chapterSelectedCount = chapterItems.filter((t) => t.checked).length;
                            const isChapterAllChecked =
                              chapterItems.length > 0 && chapterSelectedCount === chapterItems.length;
                            const isChapterOpen = openChapterIds.includes(ch.id);

                            return (
                              <div
                                key={ch.id}
                                className="border border-[#e2e8f0] rounded-2xl overflow-hidden bg-[#f8fafc]/50"
                              >
                                {/* Chapter Level Header */}
                                <div className="p-3 sm:p-3.5 bg-white flex items-center justify-between border-b border-[#e2e8f0]">
                                  <div className="flex items-center gap-2.5">
                                    <input
                                      type="checkbox"
                                      checked={isChapterAllChecked}
                                      ref={(el) => {
                                        if (el) {
                                          el.indeterminate =
                                            chapterSelectedCount > 0 &&
                                            chapterSelectedCount < chapterItems.length;
                                        }
                                      }}
                                      onChange={() =>
                                        handleToggleChapter(ch.id, chapterItems, isChapterAllChecked)
                                      }
                                      className="rounded border-[#c0c9c0] text-[#003820] focus:ring-[#003820] w-3.5 h-3.5 cursor-pointer"
                                    />
                                    <span className="font-semibold text-xs text-[#0b1c30]">{ch.name}</span>
                                    <span className="text-[10px] text-[#707971] font-mono">
                                      ({chapterSelectedCount}/{chapterItems.length})
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenChapterIds((prev) =>
                                        prev.includes(ch.id) ? prev.filter((id) => id !== ch.id) : [...prev, ch.id]
                                      )
                                    }
                                    className="p-1 rounded text-[#707971] hover:bg-gray-100 cursor-pointer text-xs flex items-center gap-1"
                                  >
                                    <span className="text-[10px]">{isChapterOpen ? 'Collapse' : 'Expand'}</span>
                                    <span className="material-symbols-outlined text-sm">
                                      {isChapterOpen ? 'expand_less' : 'expand_more'}
                                    </span>
                                  </button>
                                </div>

                                {/* Topic Rows */}
                                {isChapterOpen && (
                                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {matchingItems.map((top) => (
                                      <label
                                        key={top.id}
                                        className={`flex items-start justify-between p-2.5 rounded-xl text-xs border transition-all cursor-pointer select-none ${
                                          top.checked
                                            ? 'bg-white border-[#003820] shadow-xs'
                                            : 'bg-white/60 border-gray-200 text-[#404942] hover:bg-white'
                                        }`}
                                      >
                                        <div className="flex items-start gap-2 min-w-0 pr-2">
                                          <input
                                            type="checkbox"
                                            checked={top.checked}
                                            onChange={() => handleToggleTopic(top.id)}
                                            className="mt-0.5 rounded border-[#c0c9c0] text-[#003820] focus:ring-[#003820] cursor-pointer"
                                          />
                                          <div className="flex flex-col min-w-0">
                                            <span
                                              className={`font-semibold truncate ${
                                                top.checked ? 'text-[#0b1c30]' : 'text-[#404942]'
                                              }`}
                                            >
                                              {top.title}
                                            </span>
                                            {top.subconcept && (
                                              <span className="text-[10px] text-[#707971] truncate">
                                                {top.subconcept}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <span className="font-mono text-[10px] text-[#707971] shrink-0">
                                          {top.durationMinutes}m
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {/* Bottom Navigation Controls */}
          <div className="p-4 bg-white rounded-2xl border border-[#c0c9c0]/40 shadow-xs flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 rounded-xl text-[#404942] hover:bg-gray-100 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span>Back to Exam Setup</span>
            </button>

            <button
              type="button"
              disabled={selectedTopics.length === 0}
              onClick={generatePlan}
              className="px-6 py-2.5 rounded-xl bg-[#003820] hover:bg-[#0f5132] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Generate Strategic Plan ({selectedTopics.length} topics)</span>
              <span className="material-symbols-outlined text-sm">insights</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 3: PLAN PREVIEW & IMPORT TO CHALLENGE WIZARD                      */}
      {/* ========================================================================= */}
      {currentStep === 3 && planGenerated && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Plan Summary Banner */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#c0c9c0]/40 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold font-mono">
                  Ready for Import
                </span>
                <span className="text-xs text-[#707971]">•</span>
                <span className="text-xs font-mono text-[#006c49]">Auto-balanced</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#0b1c30] tracking-tight">
                {examName} Strategy Schedule
              </h2>
              <p className="text-xs sm:text-sm text-[#404942]">
                Balanced across <strong>{durationDays} days</strong> ({prepStartDate} to {lastPrepDateString}) targeting{' '}
                <strong>{capacityMinutes}m daily capacity</strong>.
              </p>
            </div>

            {/* Import CTA Card */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2.5 rounded-2xl border border-gray-300 hover:bg-gray-50 text-xs font-semibold text-[#404942] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                <span>Adjust Scope</span>
              </button>

              <button
                type="button"
                onClick={handleImportToChallengeWizard}
                className="px-6 py-3 rounded-2xl bg-[#003820] hover:bg-[#0f5132] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <span className="material-symbols-outlined text-base">military_tech</span>
                <span>Import to Challenge Wizard</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </div>

          {/* Amber warnings notice if any */}
          {planWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex gap-3 text-amber-900 animate-in slide-in-from-top-2 duration-150 shadow-xs">
              <span className="material-symbols-outlined text-amber-600 shrink-0 mt-0.5">warning</span>
              <div className="space-y-1.5 min-w-0 flex-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  Plan Warnings & Constraints Realized
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-xs text-amber-900/80">
                  {planWarnings.map((warning, index) => (
                    <li key={index} className="leading-relaxed">{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Quick Re-balance Control Strip */}
          <div className="bg-white p-4 rounded-2xl border border-[#c0c9c0]/30 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#003820] text-lg">tune</span>
              <span className="text-xs font-semibold text-[#0b1c30]">Adjust Daily Target:</span>
              <input
                type="range"
                min="60"
                max="720"
                step="15"
                value={capacityMinutes}
                onChange={(e) => setCapacityMinutes(Number(e.target.value))}
                className="w-32 sm:w-48 accent-[#003820] cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-[#003820]">{capacityMinutes}m / day</span>
            </div>

            <button
              type="button"
              onClick={generatePlan}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              <span>Re-balance Workload</span>
            </button>
          </div>

          {/* Day-by-Day Columns View */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold font-mono text-[#707971] uppercase tracking-wider">
                Day-by-Day Schedule ({durationDays} Days)
              </span>
              <span className="text-[11px] text-[#707971]">
                Exam Eve concludes Day {durationDays}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: durationDays }, (_, i) => {
                const dayNum = i + 1;
                const dayKey = `Day ${dayNum}`;
                const cards = dayWisePlan[dayKey] || [];
                const totalDayMinutes = cards.reduce((sum, c) => sum + c.durationMinutes, 0);
                const totalDayTopics = cards.reduce((sum, c) => sum + (c.topics?.length || 1), 0);

                // Compute calendar date for this day
                const prepObj = parseLocalDate(prepStartDate);
                const dayDate = new Date(prepObj.getFullYear(), prepObj.getMonth(), prepObj.getDate() + i);
                const dateLabel = dayDate.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });

                const isOverCap = totalDayMinutes > capacityMinutes;
                const percentCap = Math.min(100, Math.round((totalDayMinutes / capacityMinutes) * 100));

                return (
                  <div
                    key={dayKey}
                    className="bg-white rounded-2xl p-4 border border-[#c0c9c0]/40 shadow-xs flex flex-col gap-3 transition-all hover:shadow-md"
                  >
                    {/* Day Header */}
                    <div className="flex items-start justify-between border-b border-[#e2e8f0] pb-2.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-[#003820]">Day {dayNum}</span>
                          <span className="text-[11px] text-[#707971]">• {dateLabel}</span>
                        </div>
                        <span className="text-[10px] text-[#707971] font-mono">
                          {totalDayTopics} topic{totalDayTopics === 1 ? '' : 's'}
                        </span>
                      </div>

                      <div className="text-right">
                        <span
                          className={`font-mono text-xs font-bold ${
                            isOverCap ? 'text-amber-600' : 'text-[#003820]'
                          }`}
                        >
                          {totalDayMinutes}m
                        </span>
                        <span className="text-[10px] text-[#707971] block font-mono">
                          / {capacityMinutes}m
                        </span>
                      </div>
                    </div>

                    {/* Mini Capacity Bar */}
                    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isOverCap ? 'bg-amber-500' : 'bg-[#003820]'
                        }`}
                        style={{ width: `${percentCap}%` }}
                      />
                    </div>

                    {/* Chapters & Topics List */}
                    <div className="space-y-2 flex-1 min-h-[100px]">
                      {cards.length === 0 ? (
                        <div className="h-full flex items-center justify-center p-4 border border-dashed border-gray-200 rounded-xl text-center">
                          <span className="text-[11px] text-[#707971]">Rest / Buffer Day</span>
                        </div>
                      ) : (
                        cards.map((card, cIdx) => (
                          <div
                            key={`${card.id}-${cIdx}`}
                            className="p-2.5 rounded-xl bg-[#f8fafc] border border-gray-200/80 space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-[#0b1c30] truncate">
                                {card.chapterName || card.title}
                              </span>
                              <span className="font-mono text-[10px] text-[#707971] shrink-0">
                                {card.durationMinutes}m
                              </span>
                            </div>

                            {/* Topics list inside chapter card */}
                            {card.topics && card.topics.length > 0 && (
                              <div className="space-y-1 pt-1 border-t border-gray-200/60">
                                {card.topics.map((top, tIdx) => (
                                  <div
                                    key={`${top.id}-${tIdx}`}
                                    className="flex items-center justify-between text-[10px] text-[#404942]"
                                  >
                                    <span className="truncate pr-1">• {top.title}</span>
                                    <span className="font-mono text-[9px] text-[#707971] shrink-0">
                                      {top.durationMinutes}m
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Floating Bar */}
          <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-[#c0c9c0]/50 shadow-lg flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 rounded-xl text-[#404942] hover:bg-gray-100 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span>Back to Scope</span>
            </button>

            <button
              type="button"
              onClick={handleImportToChallengeWizard}
              className="px-6 py-2.5 rounded-xl bg-[#003820] hover:bg-[#0f5132] text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">military_tech</span>
              <span>Import to Challenge Wizard</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
