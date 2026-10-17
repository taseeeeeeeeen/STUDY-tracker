import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MasterSubject } from '../types/syllabus';
import { SyllabusItem, BoardCard } from '../types/wizard';
import { subscribeMasterSyllabus } from '../services/syllabusService';
import { flattenAndDedupeMasterSyllabus } from '../utils/syllabusFlatten';
import { buildStrategicRoutine, getBaseSubjectFamily } from '../utils/strategyPlannerLogic';
import { getLocalDateString, parseLocalDate } from '../utils/dateUtils';
import { buildAiPlanningPayload, AiPlanningPayload } from '../utils/aiPlanningPayload';
import { generateAiRoutine } from '../services/aiRoutineService';
import { getSubjectColor } from '../utils/uiHelpers';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortablePriorityChapterRowProps {
  ch: {
    chapterId: string;
    chapterName: string;
    subject: string;
    totalMinutes: number;
    topics?: SyllabusItem[];
  };
  idx: number;
  customDays?: number;
  onSetDays: (days: number) => void;
}

const SortablePriorityChapterRow: React.FC<SortablePriorityChapterRowProps> = ({
  ch,
  idx,
  customDays,
  onSetDays,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ch.chapterId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.75 : 1,
  };

  const topicCount = ch.topics ? ch.topics.length : 1;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-2.5 rounded-xl border border-gray-200 ${getSubjectColor(ch.subject)} ${
        isDragging ? 'shadow-md ring-2 ring-[#003820]/30 scale-[1.01]' : ''
      }`}
    >
      {/* Left side: Drag Handle, Priority Number, and 2-line Subject + Chapter Title */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-[#707971] hover:text-[#0b1c30] rounded hover:bg-black/5 flex items-center justify-center shrink-0 transition-colors"
          style={{ touchAction: 'none' }}
          aria-label={`Drag to reorder priority for ${ch.chapterName}`}
          title="Drag to reorder"
        >
          <span className="material-symbols-outlined text-base">drag_indicator</span>
        </button>
        <span className="font-mono text-[10px] text-[#707971] w-4 text-right shrink-0">
          {idx + 1}.
        </span>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-mono font-bold text-[10px] text-[#707971] uppercase truncate leading-tight">
            {ch.subject}
          </span>
          <span className="font-bold text-xs text-[#0b1c30] leading-tight line-clamp-2">
            {ch.chapterName}
          </span>
        </div>
      </div>

      {/* Right side: Micro-label + Fixed-Width Stepper + Reserved Reset Icon slot */}
      <div
        className="flex items-center gap-2 shrink-0"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Micro-label: topic count & pace preview */}
        <div className="hidden sm:flex flex-col items-end text-right mr-1">
          <span className="font-mono text-[10px] text-[#707971]">
            {topicCount} topic{topicCount === 1 ? '' : 's'} • {ch.totalMinutes}m
          </span>
          <span className="font-mono text-[9px] text-[#006c49]">
            {customDays && customDays > 0
              ? `~${Math.max(1, Math.ceil(topicCount / customDays))} top/day`
              : 'Smart Auto Pace'}
          </span>
        </div>

        {/* Strictly Fixed-Width Stepper Pill [ - ] [ Xd ] [ + ] */}
        <div className="w-28 flex items-center justify-between bg-white/90 border border-gray-200 rounded-lg p-0.5 shadow-2xs shrink-0">
          <button
            type="button"
            onClick={() => onSetDays(customDays && customDays > 1 ? customDays - 1 : 0)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-[#404942] text-xs font-bold cursor-pointer transition-colors shrink-0"
            title="Decrease target days (minimum 1 day or Auto)"
            aria-label="Decrease target days"
          >
            -
          </button>
          <span className="font-mono text-[11px] font-semibold text-[#0b1c30] text-center flex-1 select-none">
            {customDays && customDays > 0 ? `${customDays}d` : 'Auto'}
          </span>
          <button
            type="button"
            onClick={() => onSetDays(customDays ? Math.min(15, customDays + 1) : 1)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-[#404942] text-xs font-bold cursor-pointer transition-colors shrink-0"
            title="Increase target days (up to 15 days)"
            aria-label="Increase target days"
          >
            +
          </button>
        </div>

        {/* Reserved slot for Reset icon OUTSIDE the fixed stepper wrapper */}
        <div className="w-6 h-6 flex items-center justify-center shrink-0">
          {customDays && customDays > 0 ? (
            <button
              type="button"
              onClick={() => onSetDays(0)}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/5 text-[#707971] hover:text-[#0b1c30] transition-colors cursor-pointer"
              title="Reset this chapter to Auto"
              aria-label="Reset target days to Auto"
            >
              <span className="material-symbols-outlined text-[14px]">restart_alt</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};



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

  // --- CHUNK 1: PRIORITY MODE STATE & DERIVATIONS ---
  const [isPriorityMode, setIsPriorityMode] = useState(false);
  const [priorityChapterOrder, setPriorityChapterOrder] = useState<string[]>([]);
  const [chapterCustomDays, setChapterCustomDays] = useState<Record<string, number>>({});
  const [planPayload, setPlanPayload] = useState<AiPlanningPayload | null>(null);

  const handleSetChapterDays = (chapterId: string, days: number) => {
    setChapterCustomDays((prev) => {
      const next = { ...prev };
      if (days <= 0) {
        delete next[chapterId];
      } else {
        next[chapterId] = Math.min(15, Math.max(1, days));
      }
      return next;
    });
  };

  const handleSmartEstimateDays = () => {
    const estimates: Record<string, number> = {};
    selectedChapters.forEach((ch) => {
      const family = getBaseSubjectFamily(ch.subject);
      const isComplex =
        family === 'physics' ||
        family === 'chemistry' ||
        family === 'math' ||
        ch.chapterName.toLowerCase().includes('organic') ||
        ch.chapterName.toLowerCase().includes('calculus');
      const topicCount = ch.topics.length;
      estimates[ch.chapterId] = isComplex
        ? Math.max(1, Math.ceil(topicCount / 3))
        : Math.max(1, Math.ceil(topicCount / 4));
    });
    setChapterCustomDays(estimates);
  };

  const handleResetAllDaysToAuto = () => {
    setChapterCustomDays({});
  };

  // Derive the selected-chapter list (Step 1.2)
  const selectedChapters = useMemo(() => {
    const map = new Map<
      string,
      {
        chapterId: string;
        chapterName: string;
        subject: string;
        topics: SyllabusItem[];
        totalMinutes: number;
      }
    >();

    selectedTopics.forEach((topic) => {
      const chId = topic.chapterId || topic.chapterName || topic.subject;
      const chName = topic.chapterName || topic.title || topic.subject;
      const dur = topic.durationMinutes || 45;
      const existing = map.get(chId);
      if (!existing) {
        map.set(chId, {
          chapterId: chId,
          chapterName: chName,
          subject: topic.subject,
          topics: [topic],
          totalMinutes: dur,
        });
      } else {
        existing.topics.push(topic);
        existing.totalMinutes += dur;
      }
    });

    return Array.from(map.values());
  }, [selectedTopics]);

  // Real-time student-friendly pacing & compression advisor
  const pacingAdvice = useMemo(() => {
    if (durationDays <= 0 || selectedChapters.length === 0) return null;

    const familyTotals = new Map<string, { family: string; label: string; requestedDays: number }>();

    selectedChapters.forEach((ch) => {
      const family = getBaseSubjectFamily(ch.subject);
      const customVal = chapterCustomDays[ch.chapterId] || 0;
      let chDays = customVal;
      if (chDays <= 0) {
        const isComplex =
          family === 'physics' ||
          family === 'chemistry' ||
          family === 'math' ||
          ch.chapterName.toLowerCase().includes('organic');
        chDays = isComplex
          ? Math.max(1, Math.ceil(ch.topics.length / 3))
          : Math.max(1, Math.ceil(ch.topics.length / 4));
      }

      if (!familyTotals.has(family)) {
        familyTotals.set(family, {
          family,
          label: ch.subject,
          requestedDays: chDays,
        });
      } else {
        familyTotals.get(family)!.requestedDays += chDays;
      }
    });

    let maxFamily: { family: string; label: string; requestedDays: number } | null = null;
    for (const info of familyTotals.values()) {
      if (!maxFamily || info.requestedDays > (maxFamily as { requestedDays: number }).requestedDays) {
        maxFamily = info;
      }
    }

    const currentMax: { family: string; label: string; requestedDays: number } | null = maxFamily;

    if (currentMax && currentMax.requestedDays > durationDays) {
      return {
        type: 'crunch' as const,
        requestedDays: currentMax.requestedDays,
        subject: currentMax.label,
        message: `⏱️ Exam Crunch Mode: You requested ${currentMax.requestedDays} days for ${currentMax.label}, but only ${durationDays} days remain before your exam. AI will proportionally compress daily pacing so 100% of your syllabus finishes on time.`,
      };
    }

    return {
      type: 'smooth' as const,
      requestedDays: currentMax ? currentMax.requestedDays : durationDays,
      subject: '',
      message: `✨ Smooth Full-Window Pacing: Topics will be balanced evenly across all ${durationDays} days with 1 chapter per subject per day in strict priority order.`,
    };
  }, [selectedChapters, chapterCustomDays, durationDays]);

  // Derive orderedSelectedChapters (Step 1.2)
  const orderedSelectedChapters = useMemo(() => {
    if (!isPriorityMode) {
      return selectedChapters;
    }
    return [...selectedChapters].sort((a, b) => {
      const indexA = priorityChapterOrder.indexOf(a.chapterId);
      const indexB = priorityChapterOrder.indexOf(b.chapterId);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return 0;
    });
  }, [selectedChapters, isPriorityMode, priorityChapterOrder]);

  // Synchronize membership (Step 1.2)
  useEffect(() => {
    setPriorityChapterOrder((prev) => {
      const activeChapterIds = new Set(selectedChapters.map((c) => c.chapterId));
      const kept = prev.filter((id) => activeChapterIds.has(id));
      const keptSet = new Set(kept);

      const added: string[] = [];
      selectedChapters.forEach((c) => {
        if (!keptSet.has(c.chapterId)) {
          added.push(c.chapterId);
        }
      });

      const next = [...kept, ...added];
      if (
        next.length === prev.length &&
        next.every((id, idx) => id === prev[idx])
      ) {
        return prev;
      }
      return next;
    });
  }, [selectedChapters]);

  // Sensors & handler for Priority Mode drag-and-drop
  const prioritySensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handlePriorityDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPriorityChapterOrder((prev) => {
        const currentOrder = orderedSelectedChapters.map((c) => c.chapterId);
        const oldIndex = currentOrder.indexOf(String(active.id));
        const newIndex = currentOrder.indexOf(String(over.id));
        if (oldIndex !== -1 && newIndex !== -1) {
          return arrayMove(currentOrder, oldIndex, newIndex);
        }
        return prev;
      });
    }
  };

  // --- STEP 3 STATE: Generated Strategic Plan ---
  const [dayWisePlan, setDayWisePlan] = useState<Record<string, BoardCard[]>>({});
  const [planWarnings, setPlanWarnings] = useState<string[]>([]);
  const [planGenerated, setPlanGenerated] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [lastGeneratedInputHash, setLastGeneratedInputHash] = useState<string>('');

  // Track canonical input state to detect stale generated plans
  const currentInputHash = useMemo(() => {
    return JSON.stringify({
      prepStartDate,
      examStartDate,
      durationDays,
      capacityMinutes,
      isPriorityMode,
      priorityChapterOrder,
      chapterCustomDays,
      selectedTopicIds: selectedTopics.map((t) => t.id).sort(),
    });
  }, [
    prepStartDate,
    examStartDate,
    durationDays,
    capacityMinutes,
    isPriorityMode,
    priorityChapterOrder,
    chapterCustomDays,
    selectedTopics,
  ]);

  const isPlanStale = Boolean(
    planGenerated && lastGeneratedInputHash && lastGeneratedInputHash !== currentInputHash
  );

  // Map chapter IDs and names to 1-indexed priority rank when Priority Mode is enabled
  const chapterPriorityRankMap = useMemo(() => {
    const map = new Map<string, number>();
    if (isPriorityMode && priorityChapterOrder && priorityChapterOrder.length > 0) {
      priorityChapterOrder.forEach((id, idx) => {
        map.set(id, idx + 1);
      });
      // Also index by chapter name for matching
      selectedChapters.forEach((ch) => {
        const orderIdx = priorityChapterOrder.indexOf(ch.chapterId);
        if (orderIdx !== -1) {
          map.set(ch.chapterName, orderIdx + 1);
        }
      });
    }
    return map;
  }, [isPriorityMode, priorityChapterOrder, selectedChapters]);

  // Track multi-day spans & day index per chapter across the generated plan
  const chapterDayOccurrences = useMemo(() => {
    const map = new Map<string, number[]>();
    for (let d = 1; d <= durationDays; d++) {
      const dayKey = `Day ${d}`;
      const cards = dayWisePlan[dayKey] || [];
      cards.forEach((c) => {
        const key = c.chapterId || c.chapterName || c.title;
        if (!key) return;
        const list = map.get(key) || [];
        if (!list.includes(d)) {
          list.push(d);
          map.set(key, list);
        }
      });
    }
    return map;
  }, [dayWisePlan, durationDays]);

  // Group selected topics by chapter & distribute using generateAiRoutine (Gemini AI Engine with offline fallback)
  const generatePlan = async () => {
    if (selectedTopics.length === 0 || durationDays <= 0 || isGeneratingPlan) return;

    setIsGeneratingPlan(true);

    const payload = buildAiPlanningPayload({
      prepStartDate,
      lastPrepDateString,
      durationDays,
      capacityMinutes,
      isPriorityMode,
      selectedTopics,
      priorityChapterOrder,
      chapterCustomDays,
    });
    setPlanPayload(payload);

    try {
      const result = await generateAiRoutine(payload);
      setDayWisePlan(result.allocation);
      setPlanWarnings(result.warnings);
      setPlanGenerated(true);
      setLastGeneratedInputHash(currentInputHash);
      setCurrentStep(3);
    } catch (err) {
      console.error('Failed to generate plan:', err);
      // Fallback to deterministic algorithm if error occurs
      const { allocation, warnings } = buildStrategicRoutine({
        topics: selectedTopics,
        numDays: durationDays,
        dailyCapacityMinutes: capacityMinutes,
        ...(isPriorityMode && priorityChapterOrder.length > 0
          ? { priorityChapterOrder }
          : {}),
        chapterCustomDays,
      });
      setDayWisePlan(allocation);
      setPlanWarnings(warnings);
      setPlanGenerated(true);
      setLastGeneratedInputHash(currentInputHash);
      setCurrentStep(3);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Import to Challenge Wizard handler
  const handleImportToChallengeWizard = () => {
    if (!planGenerated || Object.keys(dayWisePlan).length === 0) return;

    // Enriched dayWiseAllocation preserving all card micro-metadata
    const enrichedAllocation: Record<string, BoardCard[]> = {};
    const scheduledTopicIdsSet = new Set<string>();

    Object.entries(dayWisePlan).forEach(([dayKey, cards]) => {
      enrichedAllocation[dayKey] = (cards || []).map((card) => {
        const chKey = card.chapterId || card.chapterName || card.title;
        const daysList = chKey ? chapterDayOccurrences.get(chKey) || [] : [];
        const totalParts = daysList.length;
        const currentPartIndex = card.dayNumber ? daysList.indexOf(card.dayNumber) + 1 : 0;
        const priorityRank =
          (card.chapterId && chapterPriorityRankMap.get(card.chapterId)) ||
          (card.chapterName && chapterPriorityRankMap.get(card.chapterName)) ||
          (card.title && chapterPriorityRankMap.get(card.title));

        const cardTopics = (card.topics || []).map((t) => {
          scheduledTopicIdsSet.add(t.id);
          return {
            ...t,
            isMultiDayPart: card.isMultiDayPart || totalParts > 1,
            partInfo:
              card.partInfo ||
              (totalParts > 1 && currentPartIndex > 0 ? `Part ${currentPartIndex}/${totalParts}` : undefined),
            isCarriedOver: false,
          };
        });

        return {
          ...card,
          chapterTitle: card.chapterName || card.title,
          subjectColor: card.subject ? getSubjectColor(card.subject) : undefined,
          topicIds: cardTopics.map((t) => t.id),
          topics: cardTopics,
          priorityRank: priorityRank !== undefined ? priorityRank : undefined,
          isMultiDayPart: card.isMultiDayPart || totalParts > 1,
          partInfo:
            card.partInfo ||
            (totalParts > 1 && currentPartIndex > 0 ? `Part ${currentPartIndex}/${totalParts}` : undefined),
          isCarriedOver: false,
        };
      });
    });

    // Ensure all user-selected topics are tracked so Challenge Wizard selects them 100%
    selectedTopics.forEach((t) => scheduledTopicIdsSet.add(t.id));
    const allSelectedTopicIds = Array.from(scheduledTopicIdsSet);

    const importStrategy = {
      examName: examName.trim() || 'Board Prep',
      challengeName: examName.trim() ? `${examName.trim()} Challenge` : 'Board Prep Challenge',
      prepStartDate,
      startDate: prepStartDate,
      examStartDate,
      examDate: examStartDate,
      durationDays,
      prepDays: durationDays,
      dailyCapacityMinutes: capacityMinutes,
      dayWiseAllocation: enrichedAllocation,
      selectedTopicIds: allSelectedTopicIds,
      selectedTopics,
      payload: planPayload,
    };

    try {
      localStorage.setItem('pendingChallengeImport', JSON.stringify(importStrategy));
    } catch (e) {
      console.warn('Could not cache pendingChallengeImport in localStorage', e);
    }

    navigate('/challenges', {
      state: {
        strategyImport: importStrategy,
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

          {/* Priority Mode Card (Moved Below Curriculum Subjects List) */}
          <div className="bg-white rounded-2xl border border-[#c0c9c0]/30 shadow-xs p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-[#003820]">checklist</span>
                <span className="font-bold text-xs text-[#0b1c30]">Priority Mode</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer" htmlFor="isPriority">
                <input
                  type="checkbox"
                  id="isPriority"
                  checked={isPriorityMode}
                  onChange={(e) => setIsPriorityMode(e.target.checked)}
                  className="rounded border-[#c0c9c0] text-[#003820] focus:ring-[#003820] cursor-pointer"
                />
              </label>
            </div>

            {isPriorityMode && selectedTopics.length > 0 && (
              <div className="mt-3 space-y-2.5 pt-3 border-t border-[#e2e8f0]">
                {/* Header Description & Quick Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] text-[#707971]">
                    Top of this list = studied first. Customize target study days per chapter below.
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleSmartEstimateDays}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-semibold bg-[#eff4ff] text-[#003820] border border-[#003820]/20 hover:bg-[#6ffbbe]/20 cursor-pointer transition-colors shadow-2xs"
                      title="Automatically estimate realistic days based on topic counts and subject complexity"
                    >
                      <span className="material-symbols-outlined text-xs">auto_fix_high</span>
                      <span>Smart Auto-Estimate</span>
                    </button>
                    {Object.keys(chapterCustomDays).length > 0 && (
                      <button
                        type="button"
                        onClick={handleResetAllDaysToAuto}
                        className="px-2 py-1 rounded-xl text-[10px] font-semibold text-[#707971] hover:text-[#0b1c30] hover:bg-gray-100 cursor-pointer transition-colors"
                        title="Reset all chapters back to AI Smart Pace (Auto)"
                      >
                        Reset to Auto
                      </button>
                    )}
                  </div>
                </div>

                {/* Real-time Student-Friendly Pacing & Compression Advisor Banner */}
                {pacingAdvice && (
                  <div
                    className={`flex items-start gap-2 p-2.5 rounded-xl text-xs leading-relaxed transition-all ${
                      pacingAdvice.type === 'crunch'
                        ? 'bg-amber-50/90 border border-amber-200 text-amber-900'
                        : 'bg-[#eff4ff] border border-[#003820]/15 text-[#003820]'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-base shrink-0 ${
                        pacingAdvice.type === 'crunch' ? 'text-amber-700' : 'text-[#006c49]'
                      }`}
                    >
                      {pacingAdvice.type === 'crunch' ? 'timer' : 'auto_awesome'}
                    </span>
                    <p className="font-medium">{pacingAdvice.message}</p>
                  </div>
                )}

                <DndContext
                  sensors={prioritySensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handlePriorityDragEnd}
                >
                  <SortableContext
                    items={orderedSelectedChapters.map((c) => c.chapterId)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-1.5">
                      {orderedSelectedChapters.map((ch, idx) => (
                        <SortablePriorityChapterRow
                          key={ch.chapterId}
                          ch={ch}
                          idx={idx}
                          customDays={chapterCustomDays[ch.chapterId]}
                          onSetDays={(days) => handleSetChapterDays(ch.chapterId, days)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>

          {/* Centered loader-card during plan generation */}
          {isGeneratingPlan && (
            <div className="p-12 text-center text-[#707971] text-xs font-mono bg-white rounded-3xl border border-gray-100 animate-pulse">
              Generating AI-balanced routine...
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
              disabled={selectedTopics.length === 0 || isGeneratingPlan}
              onClick={generatePlan}
              className="px-6 py-2.5 rounded-xl bg-[#003820] hover:bg-[#0f5132] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>
                {isGeneratingPlan
                  ? 'Generating Strategic Plan...'
                  : isPlanStale
                  ? `Update Strategic Plan (${selectedTopics.length} topics)`
                  : `Generate Strategic Plan (${selectedTopics.length} topics)`}
              </span>
              <span className="material-symbols-outlined text-sm">{isGeneratingPlan ? 'progress_activity' : 'insights'}</span>
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

          {/* Stale Plan Notice if user modified scope or timeline after generation */}
          {isPlanStale && (
            <div className="bg-sky-50 border border-sky-200 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sky-900 animate-in slide-in-from-top-1 duration-150 shadow-xs">
              <div className="flex items-center gap-3 min-w-0">
                <span className="material-symbols-outlined text-sky-600 shrink-0 text-xl">update</span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-sky-800">
                    Syllabus Scope or Timeline Modified
                  </h4>
                  <p className="text-xs text-sky-900/80 mt-0.5">
                    Your parameters changed after generating this schedule. Click Re-balance Workload to refresh the routine before importing.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isGeneratingPlan}
                onClick={generatePlan}
                className="px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold shrink-0 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">{isGeneratingPlan ? 'progress_activity' : 'refresh'}</span>
                <span>{isGeneratingPlan ? 'Updating...' : 'Update Schedule'}</span>
              </button>
            </div>
          )}

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
              disabled={isGeneratingPlan}
              onClick={generatePlan}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">{isGeneratingPlan ? 'progress_activity' : 'refresh'}</span>
              <span>{isGeneratingPlan ? 'Re-balancing...' : 'Re-balance Workload'}</span>
            </button>
          </div>

          {/* Centered loader-card during plan generation */}
          {isGeneratingPlan && (
            <div className="p-12 text-center text-[#707971] text-xs font-mono bg-white rounded-3xl border border-gray-100 animate-pulse">
              Generating AI-balanced routine...
            </div>
          )}

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
                        cards.map((card, cIdx) => {
                          const chKey = card.chapterId || card.chapterName || card.title;
                          const daysList = chKey ? chapterDayOccurrences.get(chKey) || [] : [];
                          const totalParts = daysList.length;
                          const currentPartIndex = daysList.indexOf(dayNum) + 1;
                          const priorityRank =
                            (card.chapterId && chapterPriorityRankMap.get(card.chapterId)) ||
                            (card.chapterName && chapterPriorityRankMap.get(card.chapterName)) ||
                            (card.title && chapterPriorityRankMap.get(card.title));

                          return (
                            <div
                              key={`${card.id}-${cIdx}`}
                              className={`p-2.5 rounded-xl border border-gray-200/80 space-y-1.5 transition-colors ${
                                card.subject ? getSubjectColor(card.subject) : 'bg-[#f8fafc]'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-1.5 text-[11px]">
                                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                  {isPriorityMode && priorityRank !== undefined && (
                                    <span
                                      className="px-1.5 py-0.5 rounded-md bg-[#003820] text-white text-[9px] font-mono font-bold shrink-0 shadow-2xs"
                                      title={`Priority #${priorityRank}`}
                                    >
                                      Priority #{priorityRank}
                                    </span>
                                  )}
                                  <span className="font-bold text-[#0b1c30] truncate">
                                    {card.chapterName || card.title}
                                  </span>
                                  {((card.isMultiDayPart && card.partInfo) || (totalParts > 1 && currentPartIndex > 0)) && (
                                    <span
                                      className="px-1.5 py-0.5 rounded-md bg-white/90 border border-gray-200 text-[#006c49] text-[9px] font-mono font-semibold shrink-0"
                                      title={card.partInfo || `Part ${currentPartIndex} of ${totalParts}`}
                                    >
                                      {card.partInfo || `Part ${currentPartIndex}/${totalParts}`}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0 font-mono text-[10px] text-[#707971]">
                                  {card.topics && card.topics.length > 0 && (
                                    <span>{card.topics.length}t •</span>
                                  )}
                                  <span className="font-semibold text-[#003820]">{card.durationMinutes}m</span>
                                </div>
                              </div>

                              {/* Topics list inside chapter card */}
                              {card.topics && card.topics.length > 0 && (
                                <div className="space-y-1 pt-1 border-t border-gray-200/60">
                                  {card.topics.map((top, tIdx) => (
                                    <div
                                      key={`${top.id}-${tIdx}`}
                                      className="flex items-start justify-between gap-1 text-[10px] text-[#404942]"
                                    >
                                      <span className="line-clamp-2 leading-tight pr-1">• {top.title}</span>
                                      <span className="font-mono text-[9px] text-[#707971] shrink-0 font-medium">
                                        {top.durationMinutes}m
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
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
