import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SprintDuration,
  BoardCard,
  BoardTopic,
  SyllabusItem,
  DayColumnData,
} from '../../types/wizard';
import { MasterSubject } from '../../types/syllabus';
import { subscribeMasterSyllabus, seedDefaultSyllabus } from '../../services/syllabusService';
import {
  createFirestoreChallenge,
  updateChallengeDayAllocation,
  updateChallengeSyllabus,
  removeTopicFromChallenge,
  findActivePersonalChallenge,
  archiveChallenge,
  deleteFirestoreChallenge,
} from '../../services/challengeService';
import { FirestoreChallenge } from '../../types/challenge';
import { dedupeSyllabusTopics, balanceCardsAcrossDays } from '../../utils/challengeLogic';
import {
  getLocalDateString,
  parseLocalDate,
  formatSprintEndDate,
  getLocalSprintEndDateIso,
  getLocalMidnightIso,
  computeCurrentSprintDay,
} from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';
import { useStudyTrack } from '../../context/StudyTrackContext';
import { DroppableDayColumn } from './DroppableDayColumn';
import { ShiftTopicModal } from './ShiftTopicModal';
import { StartChallengeModal } from './StartChallengeModal';
import { Link, useLocation, useNavigate } from 'react-router-dom';

interface ChallengeWizardProps {
  onBackToDashboard?: () => void;
}

export function parseCardsFromAllocation(
  dayWiseAllocation: Record<string, unknown[]> | null | undefined
): { cards: BoardCard[]; order: string[] } {
  if (!dayWiseAllocation) return { cards: [], order: [] };
  const restored: BoardCard[] = [];
  const orderedChapterIds: string[] = [];
  const seenCardIds = new Set<string>();

  const sortedDayEntries = Object.entries(dayWiseAllocation).sort(([a], [b]) => {
    const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  sortedDayEntries.forEach(([dayKey, dayCards]) => {
    const match = dayKey.match(/Day\s+(\d+)/i);
    const dayNum = match ? parseInt(match[1], 10) : 1;
    if (Array.isArray(dayCards)) {
      dayCards.forEach((c: any, cIdx: number) => {
        const chId =
          c.chapterId ||
          (c.id ? c.id.replace(/^chapter-/, '').replace(/-day-\d+.*$/, '') : '') ||
          c.chapterName ||
          c.title ||
          '';
        let cardId =
          c.id && c.id.startsWith('chapter-')
            ? c.id
            : chId
            ? `chapter-${chId}`
            : c.id || `chapter-${Math.random().toString(36).substring(2, 6)}`;

        if (seenCardIds.has(cardId)) {
          cardId = `${cardId}-day-${dayNum}-${cIdx + 1}`;
        }
        seenCardIds.add(cardId);

        const chapterName = c.chapterName || c.title || 'Chapter';
        const cardTitle = c.title || chapterName;

        const cardTopics = Array.isArray(c.topics)
          ? c.topics.map((t: any) => ({
              ...t,
              dayNumber: dayNum,
              chapterId: t.chapterId || chId,
              chapterName: t.chapterName || chapterName,
            }))
          : undefined;

        restored.push({
          ...c,
          id: cardId,
          chapterId: chId,
          chapterName,
          title: cardTitle,
          dayNumber: dayNum,
          topics: cardTopics,
        });

        if (chId && !orderedChapterIds.includes(chId)) {
          orderedChapterIds.push(chId);
        }
      });
    }
  });

  return { cards: restored, order: orderedChapterIds };
}

export const ChallengeWizard: React.FC<ChallengeWizardProps> = ({
  onBackToDashboard: _onBackToDashboard,
}) => {
  const { user, isAdmin } = useAuth();
  const { activeChallenge, setActiveChallenge, currentTime } = useStudyTrack();

  const location = useLocation();
  const navigate = useNavigate();

  // Strategy Planner Import Hydration
  const strategyImportData = (location.state as any)?.strategyImport as
    | {
        examName: string;
        prepStartDate: string;
        examStartDate: string;
        durationDays: number;
        dayWiseAllocation: Record<string, unknown[]>;
        selectedTopicIds: string[];
      }
    | undefined;

  const parsedImport = useMemo(() => {
    if (!strategyImportData?.dayWiseAllocation) return null;
    return parseCardsFromAllocation(strategyImportData.dayWiseAllocation);
  }, [strategyImportData]);

  // 3-Step Wizard Flow State: 1 = Config, 2 = Topics, 3 = Schedule
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // When strategyImportData is present, it takes over the wizard as a fresh challenge (do not auto-load saved active challenge)
  const initialChallenge =
    strategyImportData
      ? null
      : activeChallenge && activeChallenge.status !== 'archived'
      ? activeChallenge
      : null;

  const initialRestored = parsedImport
    ? parsedImport
    : initialChallenge?.day_wise_allocation
    ? parseCardsFromAllocation(initialChallenge.day_wise_allocation as Record<string, unknown[]>)
    : { cards: [], order: [] };

  // STEP 1: Duration selection (7, 14, 21, 30 or custom 5-60 days)
  const [duration, setDuration] = useState<SprintDuration | null>(
    strategyImportData
      ? (strategyImportData.durationDays as SprintDuration)
      : (initialChallenge?.duration as SprintDuration) || null
  );
  const [isCustomDuration, setIsCustomDuration] = useState<boolean>(
    Boolean(
      strategyImportData ||
        (initialChallenge?.duration &&
          ![7, 14, 21, 30].includes(Number(initialChallenge.duration)))
    )
  );
  const [customDurationInput, setCustomDurationInput] = useState<string>(
    strategyImportData
      ? String(strategyImportData.durationDays)
      : initialChallenge?.duration &&
        ![7, 14, 21, 30].includes(Number(initialChallenge.duration))
      ? String(initialChallenge.duration)
      : ''
  );
  const [challengeName, setChallengeName] = useState(
    strategyImportData
      ? `${strategyImportData.examName} Prep`
      : initialChallenge?.challenge_name || ''
  );
  const [startDate, setStartDate] = useState<string | null>(
    strategyImportData
      ? strategyImportData.prepStartDate
      : initialChallenge?.start_date
      ? getLocalDateString(parseLocalDate(initialChallenge.start_date))
      : null
  );

  // STEP 2: Real-time Master Syllabus directly from Firestore
  const [masterSubjects, setMasterSubjects] = useState<MasterSubject[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusItem[]>([]);
  const [loadingSyllabus, setLoadingSyllabus] = useState(true);
  const [seedingSyllabus, setSeedingSyllabus] = useState(false);
  const [paperFilter, setPaperFilter] = useState<'all' | '1st' | '2nd'>('all');
  const [openSubjectNames, setOpenSubjectNames] = useState<string[]>([]);
  const [openChapterIds, setOpenChapterIds] = useState<string[]>([]);

  // STEP 3: Planning Board & Scientific Validation (Time Travel Prevention)
  const [boardCards, setBoardCards] = useState<BoardCard[]>(initialRestored.cards);

  // Strict local date string in browser's local timezone for HTML min attribute & validation
  const todayDateString = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Dynamic Day Columns based on duration and startDate in user's local timezone - no fallback to 7
  const columns: DayColumnData[] = useMemo(() => {
    if (!duration || duration <= 0) return [];
    const numDays = duration;
    const baseDate = startDate ? parseLocalDate(startDate) : new Date();

    return Array.from({ length: numDays }, (_, i) => {
      const dayDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + i);
      const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
      const monthStr = dayDate.toLocaleDateString('en-US', { month: 'short' });
      const dayNum = dayDate.getDate();
      return {
        dayNumber: i + 1,
        dateLabel: `Day ${i + 1}: ${monthStr} ${dayNum}`,
        dayName,
        capacityMinutes: 150,
      };
    });
  }, [startDate, duration]);

  // Computed End Date formatted in local timezone
  const formattedEndDate = useMemo(() => {
    if (!startDate || !duration) return null;
    return formatSprintEndDate(startDate, duration);
  }, [startDate, duration]);

  // Computed End Date ISO with local offset
  const computedEndDateIso = useMemo(() => {
    if (!startDate || !duration) return null;
    return getLocalSprintEndDateIso(startDate, duration);
  }, [startDate, duration]);

  // Drag and Drop active item
  const [activeCard, setActiveCard] = useState<BoardCard | null>(null);
  const [activeTopic, setActiveTopic] = useState<BoardTopic | null>(null);

  // Topic Shift Modal state
  const [shiftModalCard, setShiftModalCard] = useState<BoardCard | null>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);

  // Start Challenge Modal & Saving state
  const [isCreatingChallenge, setIsCreatingChallenge] = useState(false);
  const [isChallengeSaved, setIsChallengeSaved] = useState(Boolean(initialChallenge));
  const [savedChallengeId, setSavedChallengeId] = useState<string | null>(
    initialChallenge?.challenge_id || null
  );
  const [challengePayload, setChallengePayload] = useState<any | null>(initialChallenge);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);

  // Capacity Warning Modal state
  const [capacityWarning, setCapacityWarning] = useState<{
    isOpen: boolean;
    card: BoardCard;
    targetDay: number;
    currentMinutes: number;
    newTotal: number;
    capacity: number;
    onConfirm: () => void;
  } | null>(null);

  // Active Challenge Conflict Modal state (enforcing 1 active personal challenge)
  const [activeChallengeConflict, setActiveChallengeConflict] = useState<FirestoreChallenge | null>(null);

  // Dynamic Current Day derivation based on local midnight boundaries
  const currentDay = useMemo(() => {
    if (!startDate || !duration) return 1;
    return computeCurrentSprintDay(startDate, duration, currentTime || Date.now());
  }, [startDate, currentTime, duration]);

  // Step 1 & 2 validation states
  const isDurationValid = typeof duration === 'number' && duration >= 5 && duration <= 60;
  const isNameValid = challengeName.trim().length > 0;
  const isStartDateValid = Boolean(startDate && startDate >= todayDateString);
  const isStep1Valid = isDurationValid && isNameValid && isStartDateValid;
  const isStep2Valid = syllabus.some((s) => s.checked);

  const step1MissingReasons = useMemo(() => {
    const reasons: string[] = [];
    if (!isDurationValid) reasons.push('duration (5–60 days)');
    if (!isNameValid) reasons.push('challenge name');
    if (!isStartDateValid) reasons.push('valid start date');
    return reasons;
  }, [isDurationValid, isNameValid, isStartDateValid]);

  // Toast alert
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Enhanced sensors for touch & pointer with jitter suppression
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    })
  );

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage({ text, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 4000);
  };

  // Fetch syllabus directly from `master_syllabus` Firestore collection (Task 3.1)
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeMasterSyllabus(
      (subjects) => {
        setMasterSubjects(subjects);
        setLoadingSyllabus(false);

        // Convert master subjects, chapters, and topics into selectable SyllabusItems
        const flattenedItems: SyllabusItem[] = [];
        subjects.forEach((sub) => {
          sub.chapters.forEach((ch) => {
            ch.topics.forEach((top) => {
              flattenedItems.push({
                id: top.id,
                subject: sub.name,
                title: top.title,
                subconcept: top.subconcept || `${ch.name} • Concept synthesis`,
                durationMinutes: top.durationMinutes || 45,
                tag: top.tag || 'Core Concept',
                checked: false, // Default to unselected (Task 3.1)
                chapterId: ch.id,
                chapterName: ch.name,
              });
            });
          });
        });

        // Apply dedupeSyllabusTopics so Theory/Practice rows collapse into one selectable topic
        const dedupedItems = dedupeSyllabusTopics(flattenedItems).map((item) => {
          const orig = flattenedItems.find(o => o.id === item.id);
          return {
            ...item,
            subconcept: item.subconcept || 'Concept synthesis',
            tag: item.tag || 'Core Concept',
            checked: false,
            chapterId: orig?.chapterId || '',
            chapterName: orig?.chapterName || '',
          };
        }) as SyllabusItem[];

        if (userEditedSyllabusRef.current) {
          // Keep user's local selection state intact; do not overwrite with remote challenge state
          setSyllabus((prev) => {
            const prevMap = new Map(prev.map((p) => [p.id, p.checked]));
            return dedupedItems.map((item) => ({
              ...item,
              checked: prevMap.has(item.id) ? Boolean(prevMap.get(item.id)) : false,
            }));
          });
          return;
        }

        if (importedTopicIdsRef.current) {
          const importSet = importedTopicIdsRef.current;
          setSyllabus(
            dedupedItems.map((item) => ({
              ...item,
              checked: importSet.has(item.id),
            }))
          );
          return;
        }

        const challengeToUse =
          loadedChallenge && loadedChallenge.status !== 'archived'
            ? loadedChallenge
            : activeChallenge && activeChallenge.status !== 'archived'
            ? activeChallenge
            : null;
        const activeIds = new Set(
          (challengeToUse?.selected_syllabus || []).map((s: { id: string }) => s.id)
        );

        setSyllabus((_prev) => {
          if (activeIds.size > 0) {
            return dedupedItems.map((item) => ({
              ...item,
              checked: activeIds.has(item.id),
            }));
          }
          // When activeIds is empty (fresh sprint), set every item unchecked regardless of previous state
          return dedupedItems.map((item) => ({
            ...item,
            checked: false,
          }));
        });
      },
      (error) => {
        console.error('Error fetching master syllabus:', error);
        setLoadingSyllabus(false);
      }
    );

    return () => unsubscribe();
  }, [user, activeChallenge]);

  // Track order in which chapters were selected
  const chapterOrderRef = useRef<string[]>(initialRestored.order);
  const userEditedSyllabusRef = useRef(Boolean(strategyImportData));
  const hasPromptedResumeRef = useRef(Boolean(strategyImportData));
  const importedTopicIdsRef = useRef<Set<string> | null>(
    strategyImportData?.selectedTopicIds ? new Set(strategyImportData.selectedTopicIds) : null
  );
  const isImportedBoardRef = useRef<boolean>(Boolean(strategyImportData));
  const savedAllocationRef = useRef<Record<string, BoardCard[]> | null>(
    (initialChallenge?.day_wise_allocation as Record<string, BoardCard[]>) || null
  );
  const [loadingChallenge, setLoadingChallenge] = useState(!initialChallenge && !strategyImportData);
  const [loadedChallenge, setLoadedChallenge] = useState<FirestoreChallenge | null>(initialChallenge);

  // Strategy Planner Import Hydration & Router State Cleanup
  useEffect(() => {
    if (strategyImportData) {
      // DATE SEMANTICS:
      // durationDays = number of days from prep start through exam eve, i.e. (examStart - prepStart) in whole days.
      // The wizard's Step 1 start date = prep start date; the challenge's last study day is the day before the exam.
      // Note: to include exam day in the future, change formula to: (examStart - prepStart) + 1.

      // If syllabus was already loaded, mark selected topics checked:
      if (syllabus.length > 0 && strategyImportData.selectedTopicIds?.length > 0) {
        const idSet = new Set(strategyImportData.selectedTopicIds);
        setSyllabus((prev) =>
          prev.map((item) => ({
            ...item,
            checked: idSet.has(item.id),
          }))
        );
      }

      // Clear the router state after hydrating so a page refresh does not re-import
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, []);

  // Sync active challenge from context or Firestore: prompt user instead of silently auto-loading
  useEffect(() => {
    if (!user) {
      setLoadingChallenge(false);
      return;
    }

    if (initialChallenge) {
      loadChallengeIntoWizard(initialChallenge, true);
      setLoadingChallenge(false);
      return;
    }

    if (hasPromptedResumeRef.current) return;

    if (activeChallenge && activeChallenge.status !== 'archived') {
      setLoadedChallenge(activeChallenge);
      setLoadingChallenge(false);
      hasPromptedResumeRef.current = true;
      setActiveChallengeConflict(activeChallenge);
      return;
    }

    let isMounted = true;
    findActivePersonalChallenge(user.uid)
      .then((doc) => {
        if (isMounted) {
          if (doc && doc.status !== 'archived') {
            setLoadedChallenge(doc);
            hasPromptedResumeRef.current = true;
            setActiveChallengeConflict(doc);
          } else {
            setLoadedChallenge(null);
          }
          setLoadingChallenge(false);
        }
      })
      .catch((err) => {
        console.error('Error finding active personal challenge:', err);
        if (isMounted) setLoadingChallenge(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user, activeChallenge, initialChallenge]);

  // Helper to load an existing active challenge into the wizard
  const loadChallengeIntoWizard = (challengeDoc: FirestoreChallenge, isExplicitAction = false) => {
    if (isExplicitAction) {
      userEditedSyllabusRef.current = false;
    }
    setChallengeName(challengeDoc.challenge_name || '');
    if (challengeDoc.duration) {
      const dur = challengeDoc.duration as SprintDuration;
      setDuration(dur);
      if (![7, 14, 21, 30].includes(Number(dur))) {
        setIsCustomDuration(true);
        setCustomDurationInput(String(dur));
      } else {
        setIsCustomDuration(false);
      }
    }
    if (challengeDoc.start_date) {
      setStartDate(getLocalDateString(parseLocalDate(challengeDoc.start_date)));
    }
    setSavedChallengeId(challengeDoc.challenge_id);
    setIsChallengeSaved(true);
    setChallengePayload(challengeDoc as any);

    if (challengeDoc.day_wise_allocation) {
      const { cards, order } = parseCardsFromAllocation(
        challengeDoc.day_wise_allocation as Record<string, unknown[]>
      );
      if (cards.length > 0) {
        setBoardCards(cards);
        savedAllocationRef.current = challengeDoc.day_wise_allocation as Record<string, BoardCard[]>;
      }
      if (order.length > 0) {
        chapterOrderRef.current = order;
      }
    }

    const selectedIds = new Set(
      (challengeDoc.selected_syllabus || []).map((s) => s.id)
    );
    setSyllabus((prev) =>
      prev.map((item) => ({
        ...item,
        checked: selectedIds.has(item.id),
      }))
    );
  };

  // Gated Hydration: Only run when an explicit initialChallenge was passed
  useEffect(() => {
    if (!user) return;
    if (loadingSyllabus || loadingChallenge) return;

    if (initialChallenge && initialChallenge.status !== 'archived') {
      loadChallengeIntoWizard(initialChallenge, true);
    }
  }, [user, loadingSyllabus, loadingChallenge, initialChallenge]);

  // Update DnD board cards whenever selected syllabus changes: chapter-level grouping with capacity-aware allocation
  useEffect(() => {
    const selected = syllabus.filter((s) => s.checked);
    if (selected.length === 0) {
      setBoardCards([]);
      chapterOrderRef.current = [];
      return;
    }

    // Group selected topics by chapterId
    const groupsMap = new Map<
      string,
      {
        chapterId: string;
        chapterName: string;
        subject: string;
        topics: SyllabusItem[];
      }
    >();

    selected.forEach((item) => {
      const chId = item.chapterId || item.chapterName || item.subject;
      if (!groupsMap.has(chId)) {
        groupsMap.set(chId, {
          chapterId: chId,
          chapterName: item.chapterName || item.title,
          subject: item.subject,
          topics: [],
        });
      }
      groupsMap.get(chId)!.topics.push(item);
    });

    const numCols = columns.length || (typeof duration === 'number' && duration > 0 ? duration : 7);
    const firstNonPastDay = isChallengeSaved ? Math.min(numCols, Math.max(1, currentDay)) : 1;

    // Once isChallengeSaved is true, boardCards are preserved and updated explicitly via handleAddSyllabusTopicsToSavedChallenge or removals
    if (isChallengeSaved) {
      return;
    }

    // Do not re-balance the imported board on entry (imported day assignments are intentional)
    if (isImportedBoardRef.current) {
      return;
    }

    // Maintain stable order of chapters as selected
    const currentChapterIds = Array.from(groupsMap.keys());
    const updatedOrder = Array.from(
      new Set(chapterOrderRef.current.filter((id) => groupsMap.has(id)))
    );
    currentChapterIds.forEach((id) => {
      if (!updatedOrder.includes(id)) {
        updatedOrder.push(id);
      }
    });
    chapterOrderRef.current = updatedOrder;

    // Existing cards map by chapterId or id to preserve day assignments
    const existingCardsMap = new Map<string, BoardCard>();
    boardCards.forEach((c) => {
      if (c.chapterId) {
        existingCardsMap.set(c.chapterId, c);
        existingCardsMap.set(`chapter-${c.chapterId}`, c);
      }
      if (c.id) {
        existingCardsMap.set(c.id, c);
        existingCardsMap.set(c.id.replace(/^chapter-/, ''), c);
      }
      if (c.chapterName) existingCardsMap.set(c.chapterName, c);
      if (c.title) existingCardsMap.set(c.title, c);
    });

    const dayCapacities: Record<number, number> = {};
    columns.forEach((c) => {
      dayCapacities[c.dayNumber] = c.capacityMinutes || 150;
    });

    const fixedCardIds = new Set<string>();
    const seenNewCardIds = new Set<string>();

    const rawPreparedCards: BoardCard[] = updatedOrder.map((chId, orderIdx) => {
      const group = groupsMap.get(chId)!;
      const existing =
        existingCardsMap.get(chId) ||
        existingCardsMap.get(`chapter-${chId}`) ||
        existingCardsMap.get(group.chapterName) ||
        (group.chapterId ? existingCardsMap.get(group.chapterId) : undefined);

      const totalDuration = group.topics.reduce((acc, t) => acc + (t.durationMinutes || 45), 0);

      const boardTopics: BoardTopic[] = group.topics.map((t) => {
        const existingTopic = existing?.topics?.find((top) => top.id === t.id);
        return {
          id: t.id,
          title: t.title,
          subconcept: t.subconcept,
          durationMinutes: t.durationMinutes || 45,
          tag: t.tag || 'Core Concept',
          subject: t.subject || group.subject,
          chapterId: group.chapterId,
          chapterName: group.chapterName,
          isCarriedOver: existingTopic?.isCarriedOver || false,
          carriedOverFromDay: existingTopic?.carriedOverFromDay,
        };
      });

      let cardId = `chapter-${group.chapterId}`;
      if (seenNewCardIds.has(cardId)) {
        cardId = `chapter-${group.chapterId}-${orderIdx + 1}`;
      }
      seenNewCardIds.add(cardId);

      const isPositionFixed = Boolean(existing && existing.dayNumber >= 1 && existing.dayNumber <= numCols);
      const assignedDay = isPositionFixed ? existing!.dayNumber : 1;
      if (isPositionFixed) {
        fixedCardIds.add(cardId);
      }

      return {
        id: cardId,
        chapterId: group.chapterId,
        chapterName: group.chapterName,
        subject: group.subject,
        title: group.chapterName,
        durationMinutes: totalDuration,
        tag: `${group.topics.length} ${group.topics.length === 1 ? 'topic' : 'topics'}`,
        dayNumber: assignedDay,
        isCarriedOver: Boolean(existing?.isCarriedOver || boardTopics.some((t) => t.isCarriedOver)),
        carriedOverFromDay: existing?.carriedOverFromDay,
        topics: boardTopics,
      };
    });

    const balancedCards = balanceCardsAcrossDays({
      cards: rawPreparedCards,
      numDays: numCols,
      firstNonPastDay,
      dayCapacities,
      fixedCardIds,
    });

    setBoardCards(balancedCards);
  }, [syllabus, columns.length, currentDay, isChallengeSaved, loadingSyllabus, duration]);

  // Seed handler if admin notices empty syllabus
  const handleSeedSyllabus = async () => {
    setSeedingSyllabus(true);
    try {
      await seedDefaultSyllabus(user?.uid);
      showToast('Master syllabus seeded from official HSC curriculum!', 'success');
    } catch {
      showToast('Failed to seed master syllabus.', 'error');
    } finally {
      setSeedingSyllabus(false);
    }
  };

  // Instant DB persistence helper for Drag & Drop allocation in local timezone
  const persistAllocation = async (updatedCards: BoardCard[]) => {
    if (!isChallengeSaved || !savedChallengeId || !startDate) return;
    const dayWiseAllocation: Record<string, BoardCard[]> = {};
    columns.forEach((col) => {
      dayWiseAllocation[`Day ${col.dayNumber}`] = updatedCards.filter(
        (c) => c.dayNumber === col.dayNumber
      );
    });
    savedAllocationRef.current = dayWiseAllocation;
    try {
      await updateChallengeDayAllocation(
        savedChallengeId,
        dayWiseAllocation,
        getLocalMidnightIso(startDate)
      );
    } catch (err) {
      console.error('Failed to auto-save schedule changes to database:', err);
      showToast('Failed to save schedule change to database.', 'error');
    }
  };

  // moveTopicsToDay algorithm (mirrors performMidnightRollover's single-topic pattern)
  const moveTopicsToDay = (
    topicsToMove: BoardTopic[],
    sourceCard: BoardCard,
    targetDay: number
  ) => {
    if (!topicsToMove || topicsToMove.length === 0) return;
    const originalDay = sourceCard.dayNumber;
    if (originalDay === targetDay) return;

    const topicIdsToMove = new Set(topicsToMove.map((t) => t.id));
    const chapterId = sourceCard.chapterId || sourceCard.id;
    const chapterName = sourceCard.chapterName || sourceCard.title;

    const movedTopics: BoardTopic[] = topicsToMove.map((t) => ({
      ...t,
      dayNumber: targetDay,
      chapterId,
      chapterName,
      subject: t.subject || sourceCard.subject,
    }));

    // Find current source card from latest boardCards state
    const currentSource = boardCards.find((c) => c.id === sourceCard.id) || sourceCard;
    const remainingTopics = (currentSource.topics || []).filter(
      (t) => !topicIdsToMove.has(t.id)
    );

    const nextCards: BoardCard[] = [];
    let foundTarget = false;

    for (const c of boardCards) {
      if (c.id === sourceCard.id) {
        if (remainingTopics.length > 0) {
          const remainingDuration = remainingTopics.reduce(
            (sum, t) => sum + (t.durationMinutes || 0),
            0
          );
          nextCards.push({
            ...c,
            topics: remainingTopics,
            durationMinutes: remainingDuration,
            tag: `${remainingTopics.length} ${
              remainingTopics.length === 1 ? 'topic' : 'topics'
            }`,
            isCarriedOver: remainingTopics.some((t) => t.isCarriedOver),
          });
        }
        // If remainingTopics is empty, card is omitted entirely from nextCards
      } else if (
        c.dayNumber === targetDay &&
        (c.chapterId || c.id) === chapterId &&
        !foundTarget
      ) {
        foundTarget = true;
        const existingTopics = (c.topics || []).filter(
          (t) => !topicIdsToMove.has(t.id)
        );
        const combinedTopics = [...existingTopics, ...movedTopics];
        const combinedDuration = combinedTopics.reduce(
          (sum, t) => sum + (t.durationMinutes || 0),
          0
        );
        nextCards.push({
          ...c,
          topics: combinedTopics,
          durationMinutes: combinedDuration,
          tag: `${combinedTopics.length} ${
            combinedTopics.length === 1 ? 'topic' : 'topics'
          }`,
          isCarriedOver: Boolean(c.isCarriedOver || combinedTopics.some((t) => t.isCarriedOver)),
        });
      } else {
        nextCards.push(c);
      }
    }

    if (!foundTarget) {
      const totalMins = movedTopics.reduce(
        (sum, t) => sum + (t.durationMinutes || 0),
        0
      );
      const newCard: BoardCard = {
        id: `chapter-${chapterId}-day-${targetDay}`,
        chapterId,
        chapterName,
        subject: sourceCard.subject,
        title: chapterName,
        dayNumber: targetDay,
        topics: movedTopics,
        durationMinutes: totalMins,
        tag: `${movedTopics.length} ${
          movedTopics.length === 1 ? 'topic' : 'topics'
        }`,
        isCarriedOver: movedTopics.some((t) => t.isCarriedOver),
      };
      nextCards.push(newCard);
    }

    setBoardCards(nextCards);

    // Auto-save instantly to Firestore if challenge is saved
    if (isChallengeSaved && savedChallengeId) {
      persistAllocation(nextCards);
    }
  };

  const moveTopicToDay = (
    topic: BoardTopic,
    sourceCard: BoardCard,
    targetDay: number
  ) => {
    moveTopicsToDay([topic], sourceCard, targetDay);
  };

  // DnD Handlers - Unlocked pre-save
  const handleDragStart = (event: DragStartEvent) => {
    const topicData = event.active.data.current?.topic as BoardTopic | undefined;
    if (topicData) {
      setActiveTopic(topicData);
      setActiveCard(null);
      return;
    }
    const cardData = event.active.data.current?.card as BoardCard | undefined;
    if (cardData) {
      setActiveCard(cardData);
      setActiveTopic(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    setActiveTopic(null);

    if (!over) return;

    const targetColumn: DayColumnData | undefined =
      (over.data.current?.column as DayColumnData | undefined) ||
      (over.data.current?.dayNumber !== undefined
        ? columns.find((c) => c.dayNumber === over.data.current?.dayNumber)
        : undefined) ||
      (String(over.id).startsWith('column-')
        ? columns.find((c) => c.dayNumber === parseInt(String(over.id).replace('column-', ''), 10))
        : undefined);

    if (!targetColumn) return;
    const targetDay = targetColumn.dayNumber;

    // BRANCH 1: Topic-level drag and drop
    const draggedTopic = active.data.current?.topic as BoardTopic | undefined;
    const sourceCard = active.data.current?.sourceCard as BoardCard | undefined;

    if (draggedTopic && sourceCard) {
      const originalDay = sourceCard.dayNumber;
      if (originalDay === targetDay) return;

      // VALIDATION 1: Prevent dropping ANY item into a past column for ongoing challenges
      if (isChallengeSaved && targetDay < currentDay) {
        showToast(
          `Academic records for Day ${targetDay} are sealed. You can only schedule for Day ${currentDay} (Today) or upcoming days.`,
          'error'
        );
        return;
      }

      const targetCol = columns.find((c) => c.dayNumber === targetDay);
      const capacity = targetCol?.capacityMinutes || 150;
      const currentMinutes = boardCards
        .filter((c) => c.dayNumber === targetDay)
        .reduce((sum, c) => sum + c.durationMinutes, 0);
      const newTotal = currentMinutes + draggedTopic.durationMinutes;

      const executeTopicDrop = () => {
        if (isChallengeSaved && originalDay < currentDay) {
          showToast(
            `Moved "${draggedTopic.title}" from Day ${originalDay} to Day ${targetDay}.`,
            'success'
          );
        } else {
          showToast(
            `Moved "${draggedTopic.title}" to Day ${targetDay}.`,
            'info'
          );
        }
        moveTopicToDay(draggedTopic, sourceCard, targetDay);
      };

      // Capacity enforcement with deliberate override
      if (newTotal > capacity) {
        setCapacityWarning({
          isOpen: true,
          card: {
            id: `topic-${draggedTopic.id}`,
            chapterId: sourceCard.chapterId || sourceCard.id,
            chapterName: sourceCard.chapterName || sourceCard.title,
            subject: draggedTopic.subject || sourceCard.subject,
            title: draggedTopic.title,
            durationMinutes: draggedTopic.durationMinutes,
            dayNumber: targetDay,
            tag: '1 topic',
          },
          targetDay,
          currentMinutes,
          newTotal,
          capacity,
          onConfirm: () => {
            executeTopicDrop();
            setCapacityWarning(null);
          },
        });
        return;
      }

      executeTopicDrop();
      return;
    }

    // BRANCH 2: Card-level drag and drop (kept unchanged)
    const draggedCard = active.data.current?.card as BoardCard | undefined;
    if (!draggedCard) return;

    const originalDay = draggedCard.dayNumber;
    if (originalDay === targetDay) return;

    // VALIDATION 1: Prevent dropping ANY card into a past column for ongoing challenges
    if (isChallengeSaved && targetDay < currentDay) {
      showToast(
        `Academic records for Day ${targetDay} are sealed. You can only schedule for Day ${currentDay} (Today) or upcoming days.`,
        'error'
      );
      return;
    }

    const targetCol = columns.find((c) => c.dayNumber === targetDay);
    const capacity = targetCol?.capacityMinutes || 150;
    const currentMinutes = boardCards
      .filter((c) => c.dayNumber === targetDay && c.id !== draggedCard.id)
      .reduce((sum, c) => sum + c.durationMinutes, 0);
    const newTotal = currentMinutes + draggedCard.durationMinutes;

    const executeDrop = () => {
      // VALIDATION 2: Allow dragging an unfinished card from past into future
      if (isChallengeSaved && originalDay < currentDay) {
        showToast(
          `Moved "${draggedCard.chapterName || draggedCard.title}" from Day ${originalDay} to Day ${targetDay}.`,
          'success'
        );
      } else {
        showToast(
          `Moved "${draggedCard.chapterName || draggedCard.title}" to Day ${targetDay}.`,
          'info'
        );
      }

      const nextCards = boardCards.map((c) => {
        if (c.id === draggedCard.id) {
          return {
            ...c,
            dayNumber: targetDay,
            topics: (c.topics || []).map((t) => ({ ...t, dayNumber: targetDay })),
          };
        }
        return c;
      });
      setBoardCards(nextCards);

      // Auto-save instantly to Firestore if saved
      if (isChallengeSaved && savedChallengeId) {
        persistAllocation(nextCards);
      }
    };

    // Capacity enforcement with deliberate override
    if (newTotal > capacity) {
      setCapacityWarning({
        isOpen: true,
        card: draggedCard,
        targetDay,
        currentMinutes,
        newTotal,
        capacity,
        onConfirm: () => {
          executeDrop();
          setCapacityWarning(null);
        },
      });
      return;
    }

    executeDrop();
  };

  // Topic Shift Modal Logic - Unlocked pre-save
  const handleCardClick = (card: BoardCard) => {
    if (isChallengeSaved && card.dayNumber < currentDay) {
      showToast(`Day ${card.dayNumber} is in the past and cannot be modified.`, 'info');
      return;
    }
    setShiftModalCard(card);
    setIsShiftModalOpen(true);
  };

  const handleConfirmShift = (
    targetDay: number,
    overrideCapacity = false,
    selectedTopicIds?: string[]
  ) => {
    if (!shiftModalCard) return;

    if (isChallengeSaved && targetDay < currentDay) {
      showToast('Cannot move chapters to past days.', 'error');
      return;
    }

    if (shiftModalCard.dayNumber === targetDay) {
      setIsShiftModalOpen(false);
      setShiftModalCard(null);
      return;
    }

    const cardTopics = shiftModalCard.topics || [];
    const isSubset = Boolean(
      selectedTopicIds &&
      cardTopics.length > 1 &&
      selectedTopicIds.length < cardTopics.length
    );

    const topicsToMove = isSubset
      ? cardTopics.filter((t) => selectedTopicIds!.includes(t.id))
      : cardTopics;

    const movingMinutes = isSubset
      ? topicsToMove.reduce((sum, t) => sum + (t.durationMinutes || 0), 0)
      : shiftModalCard.durationMinutes;

    const targetCol = columns.find((c) => c.dayNumber === targetDay);
    const capacity = targetCol?.capacityMinutes || 150;
    const currentMinutes = boardCards
      .filter((c) => c.dayNumber === targetDay && c.id !== shiftModalCard.id)
      .reduce((sum, c) => sum + c.durationMinutes, 0);
    const newTotal = currentMinutes + movingMinutes;

    const executeShift = () => {
      if (isSubset) {
        // Shift only the checked topics using moveTopicsToDay
        moveTopicsToDay(topicsToMove, shiftModalCard, targetDay);
        if (topicsToMove.length === 1) {
          showToast(`Moved "${topicsToMove[0].title}" to Day ${targetDay}.`, 'success');
        } else {
          showToast(
            `Moved ${topicsToMove.length} topics from "${shiftModalCard.chapterName || shiftModalCard.title}" to Day ${targetDay}.`,
            'success'
          );
        }
      } else {
        // Keep whole-chapter behavior when all are checked
        const nextCards = boardCards.map((c) => {
          if (c.id === shiftModalCard.id) {
            return {
              ...c,
              dayNumber: targetDay,
              topics: (c.topics || []).map((t) => ({ ...t, dayNumber: targetDay })),
            };
          }
          return c;
        });
        setBoardCards(nextCards);

        showToast(
          `Moved "${shiftModalCard.chapterName || shiftModalCard.title}" to Day ${targetDay}.`,
          'success'
        );

        // Auto-save instantly to Firestore if saved
        if (isChallengeSaved && savedChallengeId) {
          persistAllocation(nextCards);
        }
      }

      setIsShiftModalOpen(false);
      setShiftModalCard(null);
    };

    // Capacity enforcement with deliberate override
    if (newTotal > capacity && !overrideCapacity) {
      setCapacityWarning({
        isOpen: true,
        card: isSubset
          ? {
              id: `subset-${shiftModalCard.id}`,
              title: `${topicsToMove.length} topics from ${shiftModalCard.chapterName || shiftModalCard.title}`,
              chapterName: shiftModalCard.chapterName || shiftModalCard.title,
              subject: shiftModalCard.subject,
              durationMinutes: movingMinutes,
              dayNumber: targetDay,
              tag: `${topicsToMove.length} topics`,
            }
          : shiftModalCard,
        targetDay,
        currentMinutes,
        newTotal,
        capacity,
        onConfirm: () => {
          executeShift();
          setCapacityWarning(null);
        },
      });
      return;
    }

    executeShift();
  };

  // Auto-balance workload helper: capacity-aware greedy balancing across available columns
  const handleAutoBalance = () => {
    if (!duration || duration <= 0) return;
    const numCols = columns.length || duration;
    const firstNonPast = isChallengeSaved ? Math.min(numCols, Math.max(1, currentDay)) : 1;
    const dayCapacities: Record<number, number> = {};
    columns.forEach((c) => {
      dayCapacities[c.dayNumber] = c.capacityMinutes || 150;
    });

    const nextCards = balanceCardsAcrossDays({
      cards: boardCards,
      numDays: numCols,
      firstNonPastDay: firstNonPast,
      dayCapacities,
    });

    setBoardCards(nextCards);

    if (isChallengeSaved && savedChallengeId) {
      persistAllocation(nextCards);
    }

    showToast('Workload balanced evenly across days.', 'success');
  };

  const handleResetSelectedSyllabus = async () => {
    const confirmed = window.confirm(
      "Reset all selected syllabus topics for this challenge? You'll pick new topics in Step 2."
    );
    if (!confirmed) return;

    userEditedSyllabusRef.current = true;

    // 1. Local state update
    setSyllabus((prev) => prev.map((item) => ({ ...item, checked: false })));
    setBoardCards([]);
    chapterOrderRef.current = [];
    savedAllocationRef.current = null;

    // 2. Persistence strictly per-user: if the challenge was created by this user
    const creatorUid =
      challengePayload?.created_by ||
      activeChallenge?.created_by ||
      loadedChallenge?.created_by;

    if (isChallengeSaved && savedChallengeId && user && creatorUid === user.uid) {
      try {
        const numCols =
          columns.length || (typeof duration === 'number' && duration > 0 ? duration : 7);
        const emptyAllocation: Record<string, BoardCard[]> = {};
        for (let i = 1; i <= numCols; i++) {
          emptyAllocation[`Day ${i}`] = [];
        }

        const existingParticipants =
          challengePayload?.participants ||
          activeChallenge?.participants ||
          loadedChallenge?.participants ||
          [];
        const updatedParticipants = existingParticipants.map((p: any) => ({
          ...p,
          total_challenge_topics: 0,
        }));

        await updateChallengeSyllabus(
          savedChallengeId,
          [],
          updatedParticipants,
          emptyAllocation
        );

        savedAllocationRef.current = emptyAllocation;
        const updatedPayload = {
          ...(challengePayload || activeChallenge || loadedChallenge),
          selected_syllabus: [],
          participants: updatedParticipants,
          day_wise_allocation: emptyAllocation,
          totalTopics: 0,
        };
        setChallengePayload(updatedPayload as any);
        setLoadedChallenge(updatedPayload as any);
        if (activeChallenge && activeChallenge.challenge_id === savedChallengeId) {
          setActiveChallenge({
            ...activeChallenge,
            selected_syllabus: [],
            participants: updatedParticipants,
            day_wise_allocation: emptyAllocation,
          });
        }
      } catch (err) {
        console.error('Failed to persist syllabus reset to database:', err);
        showToast('Failed to save syllabus reset to database.', 'error');
        return;
      }
    }

    showToast("Syllabus reset. Go to Step 2 to select new topics.", 'success');
  };

  // Helper to execute challenge persistence once uniqueness check passes
  const executeCreateChallenge = async (selectedSyllabusItems: SyllabusItem[]) => {
    setIsCreatingChallenge(true);
    try {
      if (!user || !user.uid) {
        showToast('Pre-flight check failed: You must be signed in to create a challenge.', 'error');
        setIsCreatingChallenge(false);
        return;
      }

      const numDuration = Number(duration);
      if (isNaN(numDuration) || numDuration < 1 || numDuration > 365) {
        showToast('Pre-flight check failed: Duration must be a number between 1 and 365 days.', 'error');
        setIsCreatingChallenge(false);
        return;
      }

      const trimmedName = challengeName.trim();
      if (!trimmedName || trimmedName.length > 128) {
        showToast('Pre-flight check failed: Challenge name must be between 1 and 128 characters.', 'error');
        setIsCreatingChallenge(false);
        return;
      }

      if (!startDate || typeof startDate !== 'string' || startDate.length > 64) {
        showToast('Pre-flight check failed: Valid start date is required.', 'error');
        setIsCreatingChallenge(false);
        return;
      }

      const strictlyCheckedItems = selectedSyllabusItems.filter((item) => item.checked);
      if (strictlyCheckedItems.length === 0) {
        showToast('Pre-flight check failed: Please select at least 1 topic.', 'error');
        setIsCreatingChallenge(false);
        return;
      }

      if (strictlyCheckedItems.length > 200) {
        showToast('Pre-flight check failed: Syllabus cannot exceed 200 topics.', 'error');
        setIsCreatingChallenge(false);
        return;
      }

      const dayWiseAllocation: Record<string, BoardCard[]> = {};
      columns.forEach((col) => {
        dayWiseAllocation[`Day ${col.dayNumber}`] = boardCards.filter(
          (c) => c.dayNumber === col.dayNumber
        );
      });

      const totalMinutes = boardCards.reduce((acc, c) => acc + c.durationMinutes, 0);
      const totalEstimatedHours = Number((totalMinutes / 60).toFixed(1));

      const challengeIdToUse =
        savedChallengeId || `ch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const structuredPayload = {
        challenge_id: challengeIdToUse,
        challenge_name: trimmedName,
        created_by: user.uid,
        creator_name: user.name || 'Student',
        duration: numDuration,
        start_date: getLocalMidnightIso(startDate),
        end_date: computedEndDateIso || undefined,
        code: savedChallengeId && typeof challengePayload?.code === 'string' ? challengePayload.code : undefined,
        selected_syllabus: strictlyCheckedItems.map((s) => ({
          id: s.id,
          subject: s.subject,
          title: s.title,
          subconcept: s.subconcept,
          durationMinutes: s.durationMinutes,
          tag: s.tag,
        })),
        day_wise_allocation: dayWiseAllocation,
        participants: [
          {
            uid: user.uid,
            name: user.name || 'Student',
            email: user.email || '',
            photoURL: user.photoURL || undefined,
            completed_topics: 0,
            total_challenge_topics: strictlyCheckedItems.length,
            last_completion_timestamp: Date.now(),
            joined_at: (savedChallengeId && challengePayload?.participants?.[0]?.joined_at) || new Date().toISOString(),
          },
        ],
      };

      const savedChallenge = await createFirestoreChallenge(structuredPayload);

      // Set as active challenge in global app context
      try {
        await setActiveChallenge(savedChallenge);
      } catch (ctxErr) {
        console.warn('Warning: Could not sync active challenge id to profile:', ctxErr);
      }

      setSavedChallengeId(savedChallenge.challenge_id);
      setIsChallengeSaved(true);
      savedAllocationRef.current = dayWiseAllocation;

      setChallengePayload({
        ...savedChallenge,
        totalTopics: strictlyCheckedItems.length,
        totalEstimatedHours,
      });
      setLoadedChallenge(savedChallenge);
      userEditedSyllabusRef.current = false;
      setIsStartModalOpen(true);
      showToast(`Challenge "${savedChallenge.challenge_name}" created! Code: ${savedChallenge.code}`, 'success');
    } catch (error) {
      console.error('Failed to save challenge to Firestore:', error);
      let errorDetails = 'Failed to save challenge to cloud database.';
      if (error instanceof Error) {
        try {
          const parsed = JSON.parse(error.message);
          const rawErr = parsed.error || '';
          if (rawErr.includes('permission-denied') || rawErr.includes('PERMISSION_DENIED')) {
            errorDetails = 'Permission denied by database security rules. Please check your challenge details.';
          } else if (rawErr.includes('not-found')) {
            errorDetails = 'Database path not found.';
          } else if (rawErr.includes('unavailable')) {
            errorDetails = 'Database connection unavailable. Please check your network.';
          } else if (rawErr) {
            errorDetails = `Database error: ${rawErr}`;
          }
        } catch {
          errorDetails = error.message;
        }
      }
      showToast(errorDetails, 'error');
    } finally {
      setIsCreatingChallenge(false);
    }
  };

  const handleAddSyllabusTopicsToSavedChallenge = async () => {
    if (!savedChallengeId || !user) return;

    const currentSavedSyllabus =
      challengePayload?.selected_syllabus ||
      activeChallenge?.selected_syllabus ||
      loadedChallenge?.selected_syllabus ||
      [];
    const savedIds = new Set(currentSavedSyllabus.map((s: { id: string }) => s.id));
    const currentlyChecked = syllabus.filter((item) => item.checked);
    const currentlyCheckedIds = new Set(currentlyChecked.map((s) => s.id));

    const newlyChecked = currentlyChecked.filter((item) => !savedIds.has(item.id));
    const removedIds = new Set(
      currentSavedSyllabus
        .filter((s: { id: string }) => !currentlyCheckedIds.has(s.id))
        .map((s: { id: string }) => s.id)
    );

    // If there are no additions and no removals, no-op
    if (newlyChecked.length === 0 && removedIds.size === 0) {
      return;
    }

    setIsCreatingChallenge(true);
    try {
      const numCols = columns.length || (typeof duration === 'number' && duration > 0 ? duration : 7);
      const firstNonPastDay = Math.min(numCols, Math.max(1, currentDay));

      // 1. Filter existing boardCards to remove unchecked topics/cards
      let updatedCards: BoardCard[] = [];
      boardCards.forEach((c) => {
        if (c.topics && c.topics.length > 0) {
          const remainingTopics = c.topics.filter((t) => !removedIds.has(t.id));
          if (remainingTopics.length > 0) {
            const remainingDuration = remainingTopics.reduce(
              (sum, t) => sum + (t.durationMinutes || 0),
              0
            );
            updatedCards.push({
              ...c,
              topics: remainingTopics,
              durationMinutes: remainingDuration,
              tag: `${remainingTopics.length} ${remainingTopics.length === 1 ? 'topic' : 'topics'}`,
            });
          }
        } else {
          const cardTopicId = c.id?.replace(/^card-/, '') || c.id;
          if (!removedIds.has(cardTopicId) && !removedIds.has(c.id)) {
            updatedCards.push(c);
          }
        }
      });

      // 2. Allocate newly checked topics into updatedCards if any
      if (newlyChecked.length > 0) {
        const dayAllocatedMinutes: Record<number, number> = {};
        for (let d = 1; d <= numCols; d++) {
          dayAllocatedMinutes[d] = 0;
        }
        updatedCards.forEach((c) => {
          if (c.dayNumber >= 1 && c.dayNumber <= numCols) {
            dayAllocatedMinutes[c.dayNumber] =
              (dayAllocatedMinutes[c.dayNumber] || 0) + (c.durationMinutes || 0);
          }
        });

        const findDayForNewTopic = (neededMinutes: number): number => {
          for (let d = firstNonPastDay; d <= numCols; d++) {
            const col = columns.find((c) => c.dayNumber === d);
            const cap = col?.capacityMinutes || 150;
            const currentLoad = dayAllocatedMinutes[d] || 0;
            if (currentLoad + neededMinutes <= cap) {
              dayAllocatedMinutes[d] = currentLoad + neededMinutes;
              return d;
            }
          }
          let minDay = firstNonPastDay;
          let minLoad = dayAllocatedMinutes[firstNonPastDay] || 0;
          for (let d = firstNonPastDay + 1; d <= numCols; d++) {
            const currentLoad = dayAllocatedMinutes[d] || 0;
            if (currentLoad < minLoad) {
              minLoad = currentLoad;
              minDay = d;
            }
          }
          dayAllocatedMinutes[minDay] = (dayAllocatedMinutes[minDay] || 0) + neededMinutes;
          return minDay;
        };

        const newGroups = new Map<
          string,
          { chapterId: string; chapterName: string; subject: string; topics: SyllabusItem[] }
        >();

        newlyChecked.forEach((item) => {
          const chId = item.chapterId || item.chapterName || item.subject;
          if (!newGroups.has(chId)) {
            newGroups.set(chId, {
              chapterId: item.chapterId || chId,
              chapterName: item.chapterName || item.title,
              subject: item.subject,
              topics: [],
            });
          }
          newGroups.get(chId)!.topics.push(item);
        });

        newGroups.forEach((group) => {
          const groupDuration = group.topics.reduce((acc, t) => acc + (t.durationMinutes || 45), 0);
          const targetDay = findDayForNewTopic(groupDuration);
          const boardTopics: BoardTopic[] = group.topics.map((t) => ({
            id: t.id,
            title: t.title,
            subconcept: t.subconcept || '',
            durationMinutes: t.durationMinutes || 45,
            dayNumber: targetDay,
            tag: t.tag,
          }));

          const existingCardIdx = updatedCards.findIndex(
            (c) =>
              c.dayNumber === targetDay &&
              (c.chapterId === group.chapterId || c.chapterName === group.chapterName)
          );

          if (existingCardIdx >= 0) {
            const existingCard = updatedCards[existingCardIdx];
            const mergedTopics = [...(existingCard.topics || []), ...boardTopics];
            const mergedDuration = mergedTopics.reduce(
              (acc, t) => acc + (t.durationMinutes || 0),
              0
            );
            updatedCards[existingCardIdx] = {
              ...existingCard,
              topics: mergedTopics,
              durationMinutes: mergedDuration,
              tag: `${mergedTopics.length} ${mergedTopics.length === 1 ? 'topic' : 'topics'}`,
            };
          } else {
            const newCard: BoardCard = {
              id: `chapter-${group.chapterId}-${targetDay}-${Date.now()}`,
              chapterId: group.chapterId,
              chapterName: group.chapterName,
              subject: group.subject,
              title: group.chapterName,
              tag: `${boardTopics.length} ${boardTopics.length === 1 ? 'topic' : 'topics'}`,
              dayNumber: targetDay,
              durationMinutes: groupDuration,
              topics: boardTopics,
            };
            updatedCards.push(newCard);
          }
        });
      }

      // 3. Rebuild dayWiseAllocation
      const dayWiseAllocation: Record<string, BoardCard[]> = {};
      columns.forEach((col) => {
        dayWiseAllocation[`Day ${col.dayNumber}`] = updatedCards.filter(
          (c) => c.dayNumber === col.dayNumber
        );
      });

      // 4. Format updated syllabus matching exactly the currently checked topics
      const updatedSyllabus = currentlyChecked.map((s) => ({
        id: s.id,
        subject: s.subject,
        title: s.title,
        subconcept: s.subconcept,
        durationMinutes: s.durationMinutes,
        tag: s.tag,
      }));

      const existingParticipants =
        challengePayload?.participants ||
        activeChallenge?.participants ||
        loadedChallenge?.participants ||
        [];
      const updatedParticipants = existingParticipants.map((p: any) => ({
        ...p,
        total_challenge_topics: updatedSyllabus.length,
      }));

      await updateChallengeSyllabus(
        savedChallengeId,
        updatedSyllabus,
        updatedParticipants,
        dayWiseAllocation
      );

      setBoardCards(updatedCards);
      savedAllocationRef.current = dayWiseAllocation;
      const updatedPayload = {
        ...(challengePayload || activeChallenge || loadedChallenge),
        selected_syllabus: updatedSyllabus,
        participants: updatedParticipants,
        day_wise_allocation: dayWiseAllocation,
        totalTopics: updatedSyllabus.length,
      };
      setChallengePayload(updatedPayload as any);
      setLoadedChallenge(updatedPayload as any);
      if (activeChallenge && activeChallenge.challenge_id === savedChallengeId) {
        setActiveChallenge({
          ...activeChallenge,
          selected_syllabus: updatedSyllabus,
          participants: updatedParticipants,
          day_wise_allocation: dayWiseAllocation,
        });
      }
      userEditedSyllabusRef.current = false;

      const changeSummary: string[] = [];
      if (newlyChecked.length > 0) {
        changeSummary.push(`added ${newlyChecked.length} topic${newlyChecked.length > 1 ? 's' : ''}`);
      }
      if (removedIds.size > 0) {
        changeSummary.push(`removed ${removedIds.size} topic${removedIds.size > 1 ? 's' : ''}`);
      }
      showToast(`Challenge saved: ${changeSummary.join(', ')}!`, 'success');
    } catch (error) {
      console.error('Failed to update challenge syllabus:', error);
      showToast('Failed to save changes to challenge.', 'error');
    } finally {
      setIsCreatingChallenge(false);
    }
  };

  const handleRemoveTopic = async (topicId: string, topicTitle?: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove "${topicTitle || 'this topic'}" from your sprint?`
    );
    if (!confirmed) return;

    userEditedSyllabusRef.current = true;

    // 1. Uncheck in syllabus
    setSyllabus((prev) =>
      prev.map((item) => (item.id === topicId ? { ...item, checked: false } : item))
    );

    // 2. Remove from boardCards
    const nextBoardCards: BoardCard[] = [];
    boardCards.forEach((c) => {
      if (c.topics && c.topics.length > 0) {
        const remainingTopics = c.topics.filter((t) => t.id !== topicId);
        if (remainingTopics.length > 0) {
          const remainingDuration = remainingTopics.reduce(
            (sum, t) => sum + (t.durationMinutes || 0),
            0
          );
          nextBoardCards.push({
            ...c,
            topics: remainingTopics,
            durationMinutes: remainingDuration,
          });
        }
      } else if (c.id !== topicId && c.chapterId !== topicId) {
        nextBoardCards.push(c);
      }
    });

    // 3. Compute day_wise_allocation
    const nextAllocation: Record<string, BoardCard[]> = {};
    columns.forEach((col) => {
      nextAllocation[`Day ${col.dayNumber}`] = nextBoardCards.filter(
        (c) => c.dayNumber === col.dayNumber
      );
    });

    // 4. Update selected_syllabus
    const currentSavedSyllabus =
      challengePayload?.selected_syllabus ||
      activeChallenge?.selected_syllabus ||
      loadedChallenge?.selected_syllabus ||
      [];
    const updatedSyllabus = currentSavedSyllabus.filter((s: { id: string }) => s.id !== topicId);

    // 5. Update participants
    const existingParticipants =
      challengePayload?.participants ||
      activeChallenge?.participants ||
      loadedChallenge?.participants ||
      [];
    const updatedParticipants = existingParticipants.map((p: any) => ({
      ...p,
      total_challenge_topics: updatedSyllabus.length,
    }));

    // 6. If saved, persist to Firestore
    if (isChallengeSaved && savedChallengeId) {
      try {
        await removeTopicFromChallenge(
          savedChallengeId,
          topicId,
          currentSavedSyllabus,
          existingParticipants,
          nextAllocation
        );
      } catch (err) {
        console.error('Failed to remove topic from Firestore:', err);
        showToast('Failed to save topic removal to database.', 'error');
        return;
      }
    }

    // 7. Update state
    setBoardCards(nextBoardCards);
    savedAllocationRef.current = nextAllocation;
    const updatedPayload = {
      ...(challengePayload || activeChallenge || loadedChallenge),
      selected_syllabus: updatedSyllabus,
      participants: updatedParticipants,
      day_wise_allocation: nextAllocation,
      totalTopics: updatedSyllabus.length,
    };
    setChallengePayload(updatedPayload as any);
    if (activeChallenge && activeChallenge.challenge_id === savedChallengeId) {
      setActiveChallenge({
        ...activeChallenge,
        selected_syllabus: updatedSyllabus,
        participants: updatedParticipants,
        day_wise_allocation: nextAllocation,
      });
    }

    showToast(`Removed "${topicTitle || 'topic'}" from sprint.`, 'info');
  };

  const handleRemoveCard = async (card: BoardCard) => {
    const cardTitle = card.chapterName || card.title;
    const topicIds =
      card.topics && card.topics.length > 0 ? card.topics.map((t) => t.id) : [card.id];
    const topicIdSet = new Set(topicIds);

    const confirmed = window.confirm(
      `Are you sure you want to remove "${cardTitle}" from your sprint?`
    );
    if (!confirmed) return;

    userEditedSyllabusRef.current = true;

    // 1. Uncheck in syllabus
    setSyllabus((prev) =>
      prev.map((item) => (topicIdSet.has(item.id) ? { ...item, checked: false } : item))
    );

    // 2. Remove from boardCards
    const nextBoardCards = boardCards.filter((c) => c.id !== card.id);

    // 3. Compute day_wise_allocation
    const nextAllocation: Record<string, BoardCard[]> = {};
    columns.forEach((col) => {
      nextAllocation[`Day ${col.dayNumber}`] = nextBoardCards.filter(
        (c) => c.dayNumber === col.dayNumber
      );
    });

    // 4. Update selected_syllabus
    const currentSavedSyllabus =
      challengePayload?.selected_syllabus ||
      activeChallenge?.selected_syllabus ||
      loadedChallenge?.selected_syllabus ||
      [];
    const updatedSyllabus = currentSavedSyllabus.filter(
      (s: { id: string }) => !topicIdSet.has(s.id)
    );

    // 5. Update participants
    const existingParticipants =
      challengePayload?.participants ||
      activeChallenge?.participants ||
      loadedChallenge?.participants ||
      [];
    const updatedParticipants = existingParticipants.map((p: any) => ({
      ...p,
      total_challenge_topics: updatedSyllabus.length,
    }));

    // 6. If saved, persist to Firestore
    if (isChallengeSaved && savedChallengeId) {
      try {
        await updateChallengeSyllabus(
          savedChallengeId,
          updatedSyllabus,
          updatedParticipants,
          nextAllocation
        );
      } catch (err) {
        console.error('Failed to remove chapter from Firestore:', err);
        showToast('Failed to save removal to database.', 'error');
        return;
      }
    }

    // 7. Update state
    setBoardCards(nextBoardCards);
    savedAllocationRef.current = nextAllocation;
    const updatedPayload = {
      ...(challengePayload || activeChallenge || loadedChallenge),
      selected_syllabus: updatedSyllabus,
      participants: updatedParticipants,
      day_wise_allocation: nextAllocation,
      totalTopics: updatedSyllabus.length,
    };
    setChallengePayload(updatedPayload as any);
    if (activeChallenge && activeChallenge.challenge_id === savedChallengeId) {
      setActiveChallenge({
        ...activeChallenge,
        selected_syllabus: updatedSyllabus,
        participants: updatedParticipants,
        day_wise_allocation: nextAllocation,
      });
    }

    showToast(`Removed "${cardTitle}" from sprint.`, 'info');
  };

  // ENFORCE ONE ACTIVE PERSONAL CHALLENGE PER ACCOUNT (Task 3.3)
  const handleStartChallenge = async () => {
    if (isChallengeSaved) {
      await handleAddSyllabusTopicsToSavedChallenge();
      return;
    }

    if (!user) {
      showToast('You must be signed in to create and save a challenge.', 'error');
      return;
    }

    if (duration === null) {
      showToast('Please select a sprint duration (7 or 30 days).', 'error');
      return;
    }

    if (!challengeName.trim()) {
      showToast('Please provide a name for your challenge.', 'error');
      return;
    }

    if (!startDate) {
      showToast('Please select a starting date for your sprint.', 'error');
      return;
    }

    if (startDate < todayDateString) {
      showToast('Start date cannot be in the past.', 'error');
      return;
    }

    const selectedSyllabusItems = syllabus.filter((item) => item.checked);
    if (selectedSyllabusItems.length === 0) {
      showToast('Please select at least 1 syllabus topic to create a sprint.', 'error');
      return;
    }

    setIsCreatingChallenge(true);

    try {
      const existingActive = await findActivePersonalChallenge(user.uid);
      if (existingActive && existingActive.challenge_id !== savedChallengeId) {
        setActiveChallengeConflict(existingActive);
        setIsCreatingChallenge(false);
        return;
      }

      await executeCreateChallenge(selectedSyllabusItems);
    } catch (error) {
      console.error('Failed to check existing challenges:', error);
      showToast('Failed to verify challenge status. Please try again.', 'error');
      setIsCreatingChallenge(false);
    }
  };

  // Conflict Modal Handlers
  const handleKeepExistingChallenge = () => {
    if (!activeChallengeConflict) return;
    loadChallengeIntoWizard(activeChallengeConflict);
    setActiveChallengeConflict(null);
    showToast(`Loaded active challenge: "${activeChallengeConflict.challenge_name}".`, 'info');
  };

  const handleArchiveAndStartNew = async () => {
    if (!activeChallengeConflict) return;
    const oldName = activeChallengeConflict.challenge_name || 'Previous challenge';
    const oldId = activeChallengeConflict.challenge_id;

    try {
      await archiveChallenge(oldId);
      showToast(`Archived previous challenge "${oldName}".`, 'info');
      setActiveChallengeConflict(null);
    } catch (err) {
      console.error('Failed to archive existing challenge:', err);
      showToast(`Failed to archive challenge "${oldName}".`, 'error');
      return;
    }

    try {
      const selected = syllabus.filter((s) => s.checked);
      await executeCreateChallenge(selected);
    } catch (err) {
      console.error('Failed to create new challenge after archiving:', err);
      showToast(
        `Your old challenge "${oldName}" was archived, but the new challenge failed to save. Please try saving again.`,
        'error'
      );
    }
  };

  const handleDeleteAndStartNew = async () => {
    if (!activeChallengeConflict) return;

    const otherParticipants = (activeChallengeConflict.participants || []).filter(
      (p) => p.uid !== user?.uid
    );
    const otherCount = otherParticipants.length;

    if (otherCount > 0) {
      const countText = `${otherCount} other member${otherCount > 1 ? 's' : ''} will lose access`;
      const confirmed = window.confirm(
        `Warning: Deleting "${activeChallengeConflict.challenge_name || 'this challenge'}" cannot be undone. ${countText}. Are you sure you want to delete it?`
      );
      if (!confirmed) return;
    }

    try {
      await deleteFirestoreChallenge(activeChallengeConflict.challenge_id);
      showToast(`Deleted previous challenge "${activeChallengeConflict.challenge_name || 'Previous challenge'}".`, 'info');
      setActiveChallengeConflict(null);
      const selected = syllabus.filter((s) => s.checked);
      await executeCreateChallenge(selected);
    } catch (err) {
      console.error('Failed to delete existing challenge:', err);
      showToast('Failed to delete existing challenge.', 'error');
    }
  };

  // Syllabus selection helpers
  const handleToggleSyllabus = (id: string) => {
    userEditedSyllabusRef.current = true;
    isImportedBoardRef.current = false;
    importedTopicIdsRef.current = null;
    setSyllabus((prev) =>
      prev.map((s) => (s.id === id ? { ...s, checked: !s.checked } : s))
    );
  };

  const handleToggleChapterSyllabus = (_chapterId: string, chapterTopics: { id: string }[], allChecked: boolean) => {
    userEditedSyllabusRef.current = true;
    isImportedBoardRef.current = false;
    importedTopicIdsRef.current = null;
    const topicIds = chapterTopics.map((t) => t.id);
    setSyllabus((prev) =>
      prev.map((s) => {
        if (topicIds.includes(s.id)) {
          return { ...s, checked: !allChecked };
        }
        return s;
      })
    );
  };

  const handleToggleSubjectSyllabus = (topicIds: string[], targetChecked: boolean) => {
    userEditedSyllabusRef.current = true;
    isImportedBoardRef.current = false;
    importedTopicIdsRef.current = null;
    const idSet = new Set(topicIds);
    setSyllabus((prev) =>
      prev.map((s) => {
        if (idSet.has(s.id)) {
          return { ...s, checked: targetChecked };
        }
        return s;
      })
    );
  };

  const handleSelectAllFiltered = () => {
    userEditedSyllabusRef.current = true;
    isImportedBoardRef.current = false;
    importedTopicIdsRef.current = null;
    setSyllabus((prev) =>
      prev.map((s) => (visibleTopicIds.has(s.id) ? { ...s, checked: true } : s))
    );
  };

  const handleClearSelection = () => {
    userEditedSyllabusRef.current = true;
    isImportedBoardRef.current = false;
    importedTopicIdsRef.current = null;
    setSyllabus((prev) => prev.map((s) => ({ ...s, checked: false })));
  };

  const selectedSyllabusCount = syllabus.filter((s) => s.checked).length;
  const selectedSyllabusMins = syllabus
    .filter((s) => s.checked)
    .reduce((sum, s) => sum + s.durationMinutes, 0);
  const selectedSyllabusHours = (selectedSyllabusMins / 60).toFixed(1);

  const hasNewUnsavedTopics = useMemo(() => {
    if (!isChallengeSaved) return false;
    const currentSavedSyllabus =
      challengePayload?.selected_syllabus ||
      activeChallenge?.selected_syllabus ||
      loadedChallenge?.selected_syllabus ||
      [];
    const savedIds = new Set(currentSavedSyllabus.map((s: { id: string }) => s.id));
    const checkedItems = syllabus.filter((item) => item.checked);
    if (checkedItems.length !== savedIds.size) return true;
    return checkedItems.some((item) => !savedIds.has(item.id));
  }, [isChallengeSaved, challengePayload, activeChallenge, loadedChallenge, syllabus]);

  const syllabusMap = useMemo(() => {
    return new Map(syllabus.map((s) => [s.id, s]));
  }, [syllabus]);

  // Filter master subjects based on paper filter (Task 3.3)
  const filteredMasterSubjects = useMemo(() => {
    return masterSubjects.filter((sub) => {
      const isFirst = sub.name.includes('1st') || sub.name.includes('১ম');
      const isSecond =
        sub.name.includes('2nd') || sub.name.includes('২য়') || sub.name.includes('২য়');
      const paperType: '1st' | '2nd' | 'both' = isFirst ? '1st' : isSecond ? '2nd' : 'both';
      if (paperFilter === 'all') return true;
      if (paperFilter === '1st') return paperType === '1st' || paperType === 'both';
      if (paperFilter === '2nd') return paperType === '2nd' || paperType === 'both';
      return true;
    });
  }, [masterSubjects, paperFilter]);

  const visibleTopicIds = useMemo(() => {
    const ids = new Set<string>();
    filteredMasterSubjects.forEach((sub) => {
      sub.chapters.forEach((ch) => {
        ch.topics.forEach((t) => {
          ids.add(t.id);
        });
      });
    });
    return ids;
  }, [filteredMasterSubjects]);

  const toggleSubjectOpen = (subjectName: string) => {
    setOpenSubjectNames((prev) =>
      prev.includes(subjectName) ? prev.filter((s) => s !== subjectName) : [...prev, subjectName]
    );
  };

  const toggleChapterOpen = (chapterId: string) => {
    setOpenChapterIds((prev) =>
      prev.includes(chapterId) ? prev.filter((c) => c !== chapterId) : [...prev, chapterId]
    );
  };

  return (
    <div className="w-full min-h-screen bg-[#f8f9ff] text-[#0b1c30] flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-6 z-50 p-4 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-3 border animate-in fade-in slide-in-from-top-4 max-w-md ${
            toastMessage.type === 'error'
              ? 'bg-red-900 text-white border-red-500'
              : toastMessage.type === 'success'
              ? 'bg-[#003820] text-white border-[#6ffbbe]/40'
              : 'bg-blue-900 text-white border-blue-400'
          }`}
        >
          <span className="material-symbols-outlined text-base">
            {toastMessage.type === 'error'
              ? 'error'
              : toastMessage.type === 'success'
              ? 'check_circle'
              : 'info'}
          </span>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Banner / Navigation with Stepper */}
      <section className="w-full bg-white border-b border-[#c0c9c0]/30 shadow-xs">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-5 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#404942] mb-1">
                <Link to="/" className="hover:text-[#003820] font-medium">
                  Dashboard
                </Link>
                <span>/</span>
                <span className="font-semibold text-[#003820]">Sprint Setup</span>
                <span>/</span>
                <span className="px-2 py-0.5 rounded-full bg-[#eff4ff] text-[#003820] text-[10px] font-mono font-bold">
                  Step {currentStep} of 3: {currentStep === 1 ? 'Sprint Config' : currentStep === 2 ? 'Choose Topics' : 'Plan Schedule'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#003820] tracking-tight">
                {currentStep === 1
                  ? 'Step 1: Sprint Configuration'
                  : currentStep === 2
                  ? 'Step 2: Choose Syllabus Topics'
                  : 'Step 3: Plan Schedule (Drag & Drop)'}
              </h1>
            </div>

            {/* Stepper Navigation Indicator */}
            <div className="flex items-center gap-2 bg-[#eff4ff] p-1.5 rounded-2xl shadow-xs border border-[#c0c9c0]/30 text-xs">
              {/* Step 1 Chip */}
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  currentStep === 1
                    ? 'bg-[#003820] text-white shadow-xs'
                    : isStep1Valid
                    ? 'bg-white text-[#0b1c30] hover:bg-[#e5eeff]'
                    : 'bg-white/60 text-[#707971]'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${
                    currentStep === 1 ? 'bg-white text-[#003820]' : 'bg-[#003820] text-white'
                  }`}
                >
                  1
                </span>
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-[11px]">1. Config</span>
                  <span
                    className={`text-[10px] font-mono ${
                      currentStep === 1 ? 'text-white/80' : 'text-[#707971]'
                    }`}
                  >
                    {duration ? `${duration} Days` : 'Not set'}
                  </span>
                </div>
                {isStep1Valid && currentStep !== 1 && (
                  <span className="material-symbols-outlined text-[#006c49] text-sm font-bold">
                    check
                  </span>
                )}
              </button>

              <span className="text-[#c0c9c0]">›</span>

              {/* Step 2 Chip */}
              <button
                type="button"
                disabled={!isStep1Valid}
                onClick={() => isStep1Valid && setCurrentStep(2)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${
                  !isStep1Valid
                    ? 'opacity-50 cursor-not-allowed bg-white/40 text-[#707971]'
                    : currentStep === 2
                    ? 'bg-[#003820] text-white shadow-xs cursor-pointer'
                    : isStep2Valid
                    ? 'bg-white text-[#0b1c30] hover:bg-[#e5eeff] cursor-pointer'
                    : 'bg-white/60 text-[#707971] cursor-pointer'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${
                    currentStep === 2 ? 'bg-white text-[#003820]' : 'bg-[#003820] text-white'
                  }`}
                >
                  2
                </span>
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-[11px]">2. Topics</span>
                  <span
                    className={`text-[10px] font-mono ${
                      currentStep === 2 ? 'text-white/80' : 'text-[#707971]'
                    }`}
                  >
                    {selectedSyllabusCount} Selected
                  </span>
                </div>
                {isStep2Valid && currentStep !== 2 && (
                  <span className="material-symbols-outlined text-[#006c49] text-sm font-bold">
                    check
                  </span>
                )}
              </button>

              <span className="text-[#c0c9c0]">›</span>

              {/* Step 3 Chip */}
              <button
                type="button"
                disabled={!isStep1Valid || !isStep2Valid}
                onClick={() => isStep1Valid && isStep2Valid && setCurrentStep(3)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${
                  !isStep1Valid || !isStep2Valid
                    ? 'opacity-50 cursor-not-allowed bg-white/40 text-[#707971]'
                    : currentStep === 3
                    ? 'bg-[#003820] text-white shadow-xs cursor-pointer'
                    : 'bg-white text-[#0b1c30] hover:bg-[#e5eeff] cursor-pointer'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${
                    currentStep === 3 ? 'bg-white text-[#003820]' : 'bg-[#003820] text-white'
                  }`}
                >
                  3
                </span>
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-[11px]">3. Schedule</span>
                  <span
                    className={`text-[10px] font-mono ${
                      currentStep === 3 ? 'text-white/80' : 'text-[#707971]'
                    }`}
                  >
                    {columns.length > 0 ? `${columns.length} Days` : 'Plan'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Wizard Workspace */}
      <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-8 py-8 flex flex-col gap-8 flex-1">
        {/* STEP 1: DURATION SELECTION & SPRINT DETAILS */}
        {currentStep === 1 && (
          <section className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-[#e5eeff] text-[#003820] text-xs font-bold flex items-center justify-center">
                  01
                </span>
                <div>
                  <h2 className="text-lg font-bold text-[#0b1c30]">Select Sprint Duration</h2>
                  <p className="text-xs text-[#404942]">
                    Choose how long you want this sprint to run (5 to 60 days).
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#6ffbbe]/30 text-[#003820] text-xs font-semibold">
                Preset or Custom
              </span>
            </div>

            {/* Duration Preset Cards (7, 14, 21, 30 Days + Custom) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 7 Days */}
              <div
                onClick={() => {
                  if (isChallengeSaved) {
                    showToast('Sprint duration cannot be changed after saving.', 'info');
                    return;
                  }
                  setIsCustomDuration(false);
                  setCustomDurationInput('');
                  setDuration(7);
                }}
                title={isChallengeSaved ? 'Sprint duration cannot be changed after saving' : undefined}
                className={`relative bg-white rounded-2xl p-5 transition-all duration-200 shadow-xs flex flex-col justify-between group ${
                  isChallengeSaved ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-md'
                } ${
                  duration === 7 && !isCustomDuration
                    ? 'ring-2 ring-[#003820] bg-gradient-to-br from-[#eff4ff]/60 via-white to-white shadow-md'
                    : 'border border-[#c0c9c0]/30 opacity-85'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">bolt</span>
                  </div>
                  <div>
                    <h3 className="text-sm text-[#0b1c30] font-bold">Weekly Sprint</h3>
                    <span className="text-xs text-blue-700 font-semibold uppercase font-mono">
                      7 Days
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-[#404942]">
                  Focused chapter revision and exam prep over 1 week.
                </p>
              </div>

              {/* 14 Days */}
              <div
                onClick={() => {
                  if (isChallengeSaved) {
                    showToast('Sprint duration cannot be changed after saving.', 'info');
                    return;
                  }
                  setIsCustomDuration(false);
                  setCustomDurationInput('');
                  setDuration(14);
                }}
                title={isChallengeSaved ? 'Sprint duration cannot be changed after saving' : undefined}
                className={`relative bg-white rounded-2xl p-5 transition-all duration-200 shadow-xs flex flex-col justify-between group ${
                  isChallengeSaved ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-md'
                } ${
                  duration === 14 && !isCustomDuration
                    ? 'ring-2 ring-[#003820] bg-gradient-to-br from-[#eff4ff]/60 via-white to-white shadow-md'
                    : 'border border-[#c0c9c0]/30 opacity-85'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">date_range</span>
                  </div>
                  <div>
                    <h3 className="text-sm text-[#0b1c30] font-bold">2-Week Sprint</h3>
                    <span className="text-xs text-emerald-700 font-semibold uppercase font-mono">
                      14 Days
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-[#404942]">
                  Balanced 2-week mastery cycle across core subjects.
                </p>
              </div>

              {/* 21 Days */}
              <div
                onClick={() => {
                  if (isChallengeSaved) {
                    showToast('Sprint duration cannot be changed after saving.', 'info');
                    return;
                  }
                  setIsCustomDuration(false);
                  setCustomDurationInput('');
                  setDuration(21);
                }}
                title={isChallengeSaved ? 'Sprint duration cannot be changed after saving' : undefined}
                className={`relative bg-white rounded-2xl p-5 transition-all duration-200 shadow-xs flex flex-col justify-between group ${
                  isChallengeSaved ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-md'
                } ${
                  duration === 21 && !isCustomDuration
                    ? 'ring-2 ring-[#003820] bg-gradient-to-br from-[#eff4ff]/60 via-white to-white shadow-md'
                    : 'border border-[#c0c9c0]/30 opacity-85'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">view_timeline</span>
                  </div>
                  <div>
                    <h3 className="text-sm text-[#0b1c30] font-bold">3-Week Sprint</h3>
                    <span className="text-xs text-purple-700 font-semibold uppercase font-mono">
                      21 Days
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-[#404942]">
                  Comprehensive chapter breakdown and problem solving sets.
                </p>
              </div>

              {/* 30 Days */}
              <div
                onClick={() => {
                  if (isChallengeSaved) {
                    showToast('Sprint duration cannot be changed after saving.', 'info');
                    return;
                  }
                  setIsCustomDuration(false);
                  setCustomDurationInput('');
                  setDuration(30);
                }}
                title={isChallengeSaved ? 'Sprint duration cannot be changed after saving' : undefined}
                className={`relative bg-white rounded-2xl p-5 transition-all duration-200 shadow-xs flex flex-col justify-between group ${
                  isChallengeSaved ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-md'
                } ${
                  duration === 30 && !isCustomDuration
                    ? 'ring-2 ring-[#003820] bg-gradient-to-br from-[#eff4ff]/60 via-white to-white shadow-md'
                    : 'border border-[#c0c9c0]/30 opacity-85'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">event_repeat</span>
                  </div>
                  <div>
                    <h3 className="text-sm text-[#0b1c30] font-bold">Monthly Sprint</h3>
                    <span className="text-xs text-amber-700 font-semibold uppercase font-mono">
                      30 Days
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-[#404942]">
                  Full chapter coverage with steady daily pacing.
                </p>
              </div>
            </div>

            {/* Custom Duration Input Card */}
            <div className="bg-white rounded-2xl p-5 shadow-xs border border-[#c0c9c0]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#eff4ff] text-[#003820] flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">tune</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[#0b1c30]">Custom Sprint Duration</h3>
                  <p className="text-[11px] text-[#404942]">
                    Specify any duration between 5 and 60 days for your custom study plan.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex items-center">
                  <input
                    type="number"
                    min={5}
                    max={60}
                    disabled={isChallengeSaved}
                    value={customDurationInput}
                    onChange={(e) => {
                      if (isChallengeSaved) return;
                      const raw = e.target.value;
                      setCustomDurationInput(raw);
                      setIsCustomDuration(true);
                      const parsed = parseInt(raw, 10);
                      if (!isNaN(parsed) && parsed >= 5 && parsed <= 60) {
                        setDuration(parsed);
                      } else {
                        setDuration(null);
                      }
                    }}
                    placeholder="5 – 60"
                    className="w-28 bg-[#eff4ff]/60 border border-[#c0c9c0]/60 rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#0b1c30] placeholder-[#707971] focus:bg-white focus:border-[#003820] focus:outline-none focus:ring-2 focus:ring-[#003820]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="text-xs font-semibold text-[#707971] ml-2">Days</span>
                </div>
                {isCustomDuration && duration && (
                  <span className="px-2 py-0.5 rounded-md bg-[#6ffbbe]/30 text-[#002111] text-[11px] font-bold font-mono">
                    {duration}d Active
                  </span>
                )}
              </div>
            </div>

            {/* Challenge Name & Starting Date Inputs */}
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#c0c9c0]/30 flex flex-col md:flex-row gap-6 items-stretch">
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-xs font-bold text-[#0b1c30]">
                  Name your challenge <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={challengeName}
                  onChange={(e) => setChallengeName(e.target.value)}
                  placeholder="e.g. Physics & Math 2-Week Sprint"
                  className="w-full bg-[#eff4ff]/60 hover:bg-[#eff4ff] focus:bg-white border border-[#c0c9c0]/60 focus:border-[#003820] rounded-xl px-4 py-2.5 text-xs text-[#0b1c30] placeholder-[#707971] focus:outline-none focus:ring-2 focus:ring-[#003820]/20 transition-all font-medium"
                />
                {!isNameValid && (
                  <span className="text-[11px] text-amber-700 font-medium">
                    Please provide a descriptive name for your sprint.
                  </span>
                )}
              </div>

              <div className="flex-1 flex flex-col gap-2">
                <label className="text-xs font-bold text-[#0b1c30]">
                  Select Starting Date <span className="text-red-500">*</span>
                </label>
                <div
                  className="flex flex-col sm:flex-row sm:items-center gap-3"
                  onClick={() => {
                    if (isChallengeSaved) {
                      showToast('Start date cannot be changed after saving.', 'info');
                    }
                  }}
                  title={isChallengeSaved ? 'Start date cannot be changed after saving' : undefined}
                >
                  <input
                    type="date"
                    disabled={isChallengeSaved}
                    min={todayDateString}
                    value={startDate || ''}
                    onChange={(e) => {
                      if (isChallengeSaved) return;
                      const selected = e.target.value;
                      if (selected && selected < todayDateString) {
                        showToast('Start date cannot be in the past.', 'error');
                        setStartDate(todayDateString);
                        return;
                      }
                      setStartDate(selected || null);
                    }}
                    className={`w-full sm:w-auto bg-[#eff4ff]/60 border border-[#c0c9c0]/60 rounded-xl px-4 py-2.5 text-xs text-[#0b1c30] transition-all font-medium ${
                      isChallengeSaved
                        ? 'cursor-not-allowed opacity-60 bg-gray-50'
                        : 'hover:bg-[#eff4ff] focus:bg-white focus:border-[#003820] focus:outline-none focus:ring-2 focus:ring-[#003820]/20 cursor-pointer'
                    }`}
                  />
                  {formattedEndDate && (
                    <div className="px-3.5 py-2 rounded-xl bg-[#eff4ff] text-[#003820] text-xs font-semibold border border-[#c0c9c0]/40 flex items-center gap-1.5 shrink-0">
                      <span className="material-symbols-outlined text-sm text-[#006c49]">
                        event_available
                      </span>
                      <span>
                        Ends: <strong className="font-mono">{formattedEndDate}</strong>
                      </span>
                    </div>
                  )}
                </div>
                {!isStartDateValid && (
                  <span className="text-[11px] text-amber-700 font-medium">
                    Start date cannot be in the past.
                  </span>
                )}
              </div>
            </div>

            {/* Step 1 Footer Navigation & Validation Reason */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-[#c0c9c0]/30 shadow-xs">
              <div>
                {!isStep1Valid ? (
                  <div className="flex items-center gap-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-xl">
                    <span className="material-symbols-outlined text-sm text-amber-700">info</span>
                    <span>
                      Required to continue:{' '}
                      <strong className="font-semibold">{step1MissingReasons.join(', ')}</strong>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-medium text-[#003820] bg-[#6ffbbe]/20 border border-[#006c49]/30 px-3 py-1.5 rounded-xl">
                    <span className="material-symbols-outlined text-sm text-[#006c49]">check_circle</span>
                    <span>Configuration valid. Ready to choose syllabus topics.</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={!isStep1Valid}
                onClick={() => setCurrentStep(2)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#003820] hover:bg-[#004e2d] text-white text-xs font-bold shadow-md shadow-[#003820]/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Next: Choose Topics</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </section>
        )}

        {/* STEP 2: SYLLABUS SELECTION */}
        {currentStep === 2 && (
          <section className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-[#e5eeff] text-[#003820] text-xs font-bold flex items-center justify-center">
                  02
                </span>
                <div>
                  <h2 className="text-lg font-bold text-[#0b1c30]">Choose Topics</h2>
                  <p className="text-xs text-[#404942]">
                    Pick the HSC chapters and topics you want to include in this sprint.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
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
                    All
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
                    1st Paper
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
                    2nd Paper
                  </button>
                </div>

                <span className="text-xs text-[#404942] font-semibold pr-2">
                  {selectedSyllabusCount} topics selected •{' '}
                  <strong className="text-[#003820]">~{selectedSyllabusHours} hours total</strong>
                </span>
                <button
                  onClick={handleSelectAllFiltered}
                  className="px-3 py-1.5 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] text-xs font-semibold transition-colors cursor-pointer"
                >
                  Select All (filtered)
                </button>
                <button
                  onClick={handleClearSelection}
                  className="px-3 py-1.5 rounded-lg text-[#404942] hover:text-[#0b1c30] hover:bg-[#eff4ff] text-xs font-semibold transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Master Syllabus Cards Container */}
            {loadingSyllabus ? (
              <div className="p-12 text-center text-xs text-[#707971] bg-white rounded-2xl border border-[#c0c9c0]/30">
                <div className="w-6 h-6 border-2 border-[#003820] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Fetching official syllabus directly from Firestore /master_syllabus...
              </div>
            ) : filteredMasterSubjects.length === 0 ? (
              <div className="p-8 bg-amber-50 rounded-2xl border border-amber-200 text-center space-y-3">
                <span className="material-symbols-outlined text-3xl text-amber-700">warning</span>
                <div>
                  <h4 className="font-bold text-sm text-amber-900">
                    {masterSubjects.length === 0
                      ? 'Master Syllabus is empty in Firestore'
                      : 'No subjects match the selected paper filter'}
                  </h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {masterSubjects.length === 0
                      ? 'The administrator needs to populate the official HSC Master Syllabus.'
                      : 'Try selecting "All" to view all available syllabus subjects.'}
                  </p>
                </div>
                {masterSubjects.length === 0 && (
                  isAdmin ? (
                    <button
                      onClick={handleSeedSyllabus}
                      disabled={seedingSyllabus}
                      className="px-4 py-2 rounded-xl bg-[#003820] text-white text-xs font-bold hover:bg-[#004e2d] cursor-pointer"
                    >
                      {seedingSyllabus ? 'Seeding...' : 'Seed Master Syllabus Now (Admin)'}
                    </button>
                  ) : (
                    <p className="text-[11px] text-[#707971]">
                      Please contact the administrator ({user?.email}) to seed the syllabus.
                    </p>
                  )
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredMasterSubjects.map((sub, subIdx) => {
                  const isSubjectOpen = openSubjectNames.includes(sub.name);
                  const subTopics = sub.chapters.flatMap((c) => c.topics);
                  const subCheckedCount = subTopics.filter((t) => {
                    const item = syllabusMap.get(t.id);
                    return item?.checked;
                  }).length;

                  return (
                    <div
                      key={`${sub.id || sub.name}-${subIdx}`}
                      className="bg-white rounded-2xl p-5 shadow-xs border border-[#c0c9c0]/30 flex flex-col gap-3 transition-all"
                    >
                      {/* Subject Header Accordion Toggle */}
                      <div
                        onClick={() => toggleSubjectOpen(sub.name)}
                        className="flex items-center justify-between pb-3 border-b border-[#e5eeff] cursor-pointer hover:opacity-90 transition-opacity"
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#003820] text-xl">
                            school
                          </span>
                          <span className="text-sm font-bold text-[#0b1c30]">{sub.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-[#6ffbbe]/30 text-[#003820] text-xs font-bold font-mono">
                            {subCheckedCount} / {subTopics.length} selected
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSubjectSyllabus(
                                subTopics.map((t) => t.id),
                                subCheckedCount < subTopics.length
                              );
                            }}
                            className="px-2.5 py-0.5 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#003820] text-[11px] font-semibold transition-colors cursor-pointer border border-[#c0c9c0]/30"
                          >
                            {subCheckedCount === subTopics.length ? 'Clear' : 'Select All'}
                          </button>
                          <button
                            type="button"
                            aria-label={isSubjectOpen ? 'Collapse subject' : 'Expand subject'}
                            className="w-7 h-7 rounded-lg bg-[#eff4ff] text-[#404942] flex items-center justify-center text-xs"
                          >
                            <span className="material-symbols-outlined text-sm">
                              {isSubjectOpen ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Chapters list */}
                      {isSubjectOpen && (
                        <div className="flex flex-col gap-3 pt-1 animate-in fade-in duration-150">
                          {sub.chapters.map((ch, chIdx) => {
                            const isChapterOpen = openChapterIds.includes(ch.id);
                            const chCheckedCount = ch.topics.filter((t) => {
                              const item = syllabusMap.get(t.id);
                              return item?.checked;
                            }).length;

                            const isChapterAllChecked =
                              ch.topics.length > 0 &&
                              ch.topics.every((t) => {
                                const item = syllabusMap.get(t.id);
                                return item?.checked;
                              });

                            return (
                              <div
                                key={`${sub.id || sub.name}-${ch.id}-${chIdx}`}
                                className="rounded-xl border border-[#c0c9c0]/30 overflow-hidden bg-[#eff4ff]/20"
                              >
                                {/* Chapter Header Toggle */}
                                <div
                                  onClick={() => toggleChapterOpen(ch.id)}
                                  className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                                    isChapterOpen
                                      ? 'bg-[#eff4ff]/80 border-b border-[#e5eeff]'
                                      : 'hover:bg-[#eff4ff]/40'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      aria-label={isChapterOpen ? 'Collapse chapter' : 'Expand chapter'}
                                      className="w-6 h-6 rounded-md bg-[#eff4ff] text-[#003820] flex items-center justify-center text-xs"
                                    >
                                      <span className="material-symbols-outlined text-sm">
                                        {isChapterOpen ? 'expand_less' : 'expand_more'}
                                      </span>
                                    </button>
                                    <input
                                      type="checkbox"
                                      checked={isChapterAllChecked}
                                      ref={(el) => {
                                        if (el) {
                                          const someChecked = ch.topics.some(
                                            (t) => syllabusMap.get(t.id)?.checked
                                          );
                                          el.indeterminate = someChecked && !isChapterAllChecked;
                                        }
                                      }}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleToggleChapterSyllabus(ch.id, ch.topics, isChapterAllChecked);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-4 h-4 accent-[#003820] rounded cursor-pointer shrink-0"
                                    />
                                    <span className="text-xs font-bold text-[#0b1c30]">{ch.name}</span>
                                  </div>
                                  <span className="text-[11px] font-mono text-[#707971]">
                                    {chCheckedCount} / {ch.topics.length} topics
                                  </span>
                                </div>

                                {/* Topics List in Chapter */}
                                {isChapterOpen && (
                                  <div className="p-3 flex flex-col gap-2 bg-white animate-in fade-in duration-150">
                                    {ch.topics.map((top, topIdx) => {
                                      const item = syllabusMap.get(top.id) || {
                                        id: top.id,
                                        subject: sub.name,
                                        title: top.title,
                                        subconcept: top.subconcept || `${ch.name} • Concept synthesis`,
                                        durationMinutes: top.durationMinutes || 45,
                                        tag: top.tag || 'Core Concept',
                                        checked: false,
                                      };

                                      return (
                                        <label
                                          key={`${ch.id}-${top.id}-${topIdx}`}
                                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors cursor-pointer group ${
                                            item.checked
                                              ? 'bg-[#eff4ff] border-[#c0c9c0]/40 hover:bg-[#e5eeff]'
                                              : 'border-transparent hover:bg-[#eff4ff]/60 opacity-60'
                                          }`}
                                        >
                                          <div className="flex items-center gap-3">
                                            <input
                                              type="checkbox"
                                              checked={item.checked}
                                              onChange={() => handleToggleSyllabus(item.id)}
                                              className="w-4 h-4 accent-[#003820] rounded cursor-pointer"
                                            />
                                            <div className="flex flex-col">
                                              <span className="text-xs font-semibold text-[#0b1c30] group-hover:text-[#003820]">
                                                {item.title}
                                              </span>
                                              <span className="text-[10px] text-[#404942]">
                                                {item.subconcept}
                                              </span>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="px-2 py-0.5 rounded bg-white text-[#404942] text-[10px] font-mono border border-[#c0c9c0]/30">
                                              {item.durationMinutes}m
                                            </span>
                                            <span className="px-2 py-0.5 rounded bg-[#6ffbbe]/30 text-[#002111] text-[10px] font-semibold">
                                              {item.tag}
                                            </span>
                                          </div>
                                        </label>
                                      );
                                    })}
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

            {/* Step 2 Footer Navigation */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-[#c0c9c0]/30 shadow-xs">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[#c0c9c0] hover:bg-[#eff4ff] text-[#0b1c30] text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>Back: Configuration</span>
              </button>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                {selectedSyllabusCount === 0 && (
                  <span className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-xl">
                    Select at least 1 topic to continue.
                  </span>
                )}
                <button
                  type="button"
                  disabled={selectedSyllabusCount === 0}
                  onClick={() => setCurrentStep(3)}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#003820] hover:bg-[#004e2d] text-white text-xs font-bold shadow-md shadow-[#003820]/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Next: Plan Schedule</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* STEP 3: WORKLOAD DISTRIBUTION & DnD KANBAN BOARD */}
        {currentStep === 3 && (
          <section className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-[#003820] text-[#6ffbbe] text-xs font-bold flex items-center justify-center">
                  03
                </span>
                <div>
                  <h2 className="text-lg font-bold text-[#0b1c30]">
                    Plan Your Schedule (Drag & Drop)
                  </h2>
                  <p className="text-xs text-[#404942]">
                    Drag topics between days to organize your daily study routine. Everything works before saving!
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="px-3 py-1.5 rounded-xl border border-[#c0c9c0] hover:bg-[#eff4ff] text-[#0b1c30] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  <span>Edit Topics</span>
                </button>

                <button
                  type="button"
                  onClick={handleAutoBalance}
                  className="px-3.5 py-1.5 rounded-xl bg-[#eff4ff] hover:bg-[#e5eeff] text-[#003820] text-xs font-semibold border border-[#c0c9c0]/30 transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Evenly distribute workload across available days based on capacity"
                >
                  <span className="material-symbols-outlined text-sm">balance</span>
                  <span>Balance Days</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetSelectedSyllabus}
                  disabled={selectedSyllabusCount === 0 || isCreatingChallenge}
                  className="px-3.5 py-1.5 rounded-xl bg-[#eff4ff] hover:bg-[#e5eeff] text-[#003820] text-xs font-semibold border border-[#c0c9c0]/30 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Reset all selected syllabus topics and empty the board"
                >
                  <span className="material-symbols-outlined text-sm">restart_alt</span>
                  <span>Reset Selected Syllabus</span>
                </button>

                <div className="flex items-center gap-2">
                  {!isChallengeSaved && selectedSyllabusCount === 0 && (
                    <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200/60 px-2.5 py-1 rounded-lg">
                      Select at least 1 topic
                    </span>
                  )}
                  <button
                    onClick={handleStartChallenge}
                    disabled={
                      isCreatingChallenge ||
                      selectedSyllabusCount === 0 ||
                      (isChallengeSaved && !hasNewUnsavedTopics)
                    }
                    className="px-5 py-2 rounded-xl bg-[#003820] hover:bg-[#004e2d] text-white text-xs font-bold shadow-md shadow-[#003820]/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-sm text-[#6ffbbe]">
                      {isChallengeSaved && !hasNewUnsavedTopics ? 'check_circle' : 'save'}
                    </span>
                    <span>
                      {isCreatingChallenge
                        ? 'Saving Challenge...'
                        : isChallengeSaved
                        ? hasNewUnsavedTopics
                          ? 'Save Changes'
                          : 'Challenge Saved'
                        : 'Start Challenge'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Status Bar */}
            <div className="px-4 py-2.5 rounded-xl bg-white border border-[#c0c9c0]/30 text-xs flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-4 text-[#404942]">
                <span>
                  Sprint:{' '}
                  <strong className="text-[#0b1c30]">
                    {challengeName || 'Custom Sprint'} ({duration} Days)
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Topics: <strong className="text-[#003820]">{selectedSyllabusCount}</strong>
                </span>
                <span>•</span>
                <span>
                  Total Load:{' '}
                  <strong className="text-[#003820]">~{selectedSyllabusHours} hours</strong>
                </span>
              </div>
              <div className="text-[11px] text-[#707971]">
                {isChallengeSaved
                  ? 'Active sprint saved in database. Changes auto-save on drag.'
                  : 'Pre-save planning mode. Drag & balance freely before starting.'}
              </div>
            </div>

            {/* DnD Context Board */}
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div
                ref={scrollContainerRef}
                className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin scrollbar-thumb-[#c0c9c0] transition-opacity duration-200"
              >
                {columns.map((column) => {
                  const columnCards = boardCards.filter((c) => c.dayNumber === column.dayNumber);

                  return (
                    <DroppableDayColumn
                      key={column.dayNumber}
                      column={column}
                      cards={columnCards}
                      currentDay={currentDay}
                      activeCard={activeCard}
                      onCardClick={handleCardClick}
                      isBoardLocked={false}
                      onRemoveTopic={handleRemoveTopic}
                      onRemoveCard={handleRemoveCard}
                    />
                  );
                })}
              </div>

              {/* Drag Overlay Ghost Card */}
              <DragOverlay>
                {activeTopic ? (
                  <div className="p-2.5 rounded-lg bg-white border-2 border-emerald-500 shadow-2xl rotate-2 opacity-95 w-60">
                    <div className="flex items-center justify-between text-[11px] mb-0.5">
                      <span className="font-bold text-[#0b1c30] truncate">{activeTopic.title}</span>
                      <span className="text-[#707971] font-mono shrink-0 ml-1">{activeTopic.durationMinutes}m</span>
                    </div>
                    {activeTopic.subconcept && (
                      <div className="text-[10px] text-[#707971] truncate">{activeTopic.subconcept}</div>
                    )}
                  </div>
                ) : activeCard ? (
                  <div className="p-3.5 rounded-xl bg-white border-2 border-blue-500 shadow-2xl rotate-2 opacity-95 w-72">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-bold text-blue-700">{activeCard.subject}</span>
                      <span className="text-[#707971] font-mono">{activeCard.durationMinutes}m</span>
                    </div>
                    <h4 className="text-xs font-bold text-[#0b1c30]">
                      {activeCard.chapterName || activeCard.title}
                    </h4>
                    <div className="text-[10px] text-[#707971] mt-1 font-mono">
                      {activeCard.topics?.length || 1}{' '}
                      {(activeCard.topics?.length || 1) === 1 ? 'topic' : 'topics'}
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </section>
        )}
      </div>

      {/* Modals */}
      <ShiftTopicModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        card={shiftModalCard}
        currentDay={currentDay}
        columns={columns}
        cards={boardCards}
        onConfirmShift={(_cardId, targetDay, selectedTopicIds) =>
          handleConfirmShift(targetDay, false, selectedTopicIds)
        }
      />

      <StartChallengeModal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        challengeData={challengePayload}
      />

      {/* Capacity Warning Confirmation Modal */}
      {capacityWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-amber-300 flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <div>
                <h3 className="text-base text-[#0b1c30] font-bold">
                  Daily Capacity Warning
                </h3>
                <p className="text-xs text-[#404942]">
                  Target day load exceeds recommended limit
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-[#0b1c30] space-y-2">
              <p>
                <strong>Day {capacityWarning.targetDay}</strong> currently has{' '}
                <span className="font-mono font-bold">{capacityWarning.currentMinutes} min</span>.
                Adding "<strong>{capacityWarning.card.chapterName || capacityWarning.card.title}</strong>" ({capacityWarning.card.durationMinutes} min) brings total workload to{' '}
                <span className="font-mono font-bold text-amber-900">{capacityWarning.newTotal} min</span> (standard capacity: {capacityWarning.capacity} min).
              </p>
              <p className="text-[11px] text-[#404942]">
                Overloading study sessions may increase burnout. You can override deliberately if you wish to proceed.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e5eeff]">
              <button
                type="button"
                onClick={() => setCapacityWarning(null)}
                className="px-4 py-2 rounded-xl text-[#404942] hover:bg-[#eff4ff] text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={capacityWarning.onConfirm}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">check</span>
                Override &amp; Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Personal Challenge Conflict Modal */}
      {activeChallengeConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-[#c0c9c0]/50 flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">info</span>
              </div>
              <div>
                <h3 className="text-base text-[#0b1c30] font-bold">
                  Active Challenge Already in Progress
                </h3>
                <p className="text-xs text-[#404942]">
                  Each account can maintain only one active personal sprint
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#eff4ff] border border-[#c0c9c0]/30 text-xs text-[#0b1c30] space-y-2">
              <p>
                You already have an ongoing personal challenge:{' '}
                <strong className="text-[#003820]">"{activeChallengeConflict.challenge_name}"</strong> ({activeChallengeConflict.duration}-day sprint).
              </p>
              <p className="text-[#404942] text-[11px] leading-relaxed">
                To create a new challenge, you can archive or delete your existing sprint so your academic records are properly maintained without orphaned database entries.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-[#e5eeff]">
              <button
                type="button"
                onClick={() => setActiveChallengeConflict(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-[#404942] hover:bg-[#eff4ff] text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleKeepExistingChallenge}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white border border-[#c0c9c0] hover:bg-[#eff4ff] text-[#0b1c30] text-xs font-semibold transition-colors cursor-pointer"
              >
                Keep Existing
              </button>
              <button
                type="button"
                onClick={handleArchiveAndStartNew}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Archive Old &amp; Start New
              </button>
              <button
                type="button"
                onClick={handleDeleteAndStartNew}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Delete Old &amp; Start New
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
