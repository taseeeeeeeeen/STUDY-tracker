import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SprintDuration,
  BoardCard,
  SyllabusItem,
  DayColumnData,
} from '../../types/wizard';
import { MasterSubject } from '../../types/syllabus';
import { subscribeMasterSyllabus, seedDefaultSyllabus } from '../../services/syllabusService';
import { createFirestoreChallenge, updateChallengeDayAllocation } from '../../services/challengeService';
import { dedupeSyllabusTopics } from '../../utils/challengeLogic';
import { useAuth } from '../../context/AuthContext';
import { useStudyTrack } from '../../context/StudyTrackContext';
import { DroppableDayColumn } from './DroppableDayColumn';
import { ShiftTopicModal } from './ShiftTopicModal';
import { StartChallengeModal } from './StartChallengeModal';
import { useNavigate, Link } from 'react-router-dom';

interface ChallengeWizardProps {
  onBackToDashboard?: () => void;
}

export const ChallengeWizard: React.FC<ChallengeWizardProps> = ({
  onBackToDashboard,
}) => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { setActiveChallenge, currentTime } = useStudyTrack();

  const handleBack = () => {
    if (onBackToDashboard) onBackToDashboard();
    else navigate('/');
  };

  // STEP 1: Duration selection (7 or 30 days, null by default - Task 3.2)
  const [duration, setDuration] = useState<SprintDuration | null>(null);
  const [challengeName, setChallengeName] = useState('');
  const [startDate, setStartDate] = useState<string | null>(null);

  // STEP 2: Real-time Master Syllabus directly from Firestore
  const [masterSubjects, setMasterSubjects] = useState<MasterSubject[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusItem[]>([]);
  const [loadingSyllabus, setLoadingSyllabus] = useState(true);
  const [seedingSyllabus, setSeedingSyllabus] = useState(false);
  const [paperFilter, setPaperFilter] = useState<'all' | '1st' | '2nd'>('all');
  const [openSubjectNames, setOpenSubjectNames] = useState<string[]>([]);
  const [openChapterIds, setOpenChapterIds] = useState<string[]>([]);

  // STEP 3: Planning Board & Scientific Validation (Time Travel Prevention)
  const [boardCards, setBoardCards] = useState<BoardCard[]>([]);

  const todayDateString = new Date().toISOString().split('T')[0];

  // Dynamic Day Columns based on duration and startDate (Task 3.5)
  const columns: DayColumnData[] = useMemo(() => {
    const numDays = duration || 7;
    const baseDate = startDate ? new Date(startDate + 'T00:00:00') : new Date();

    return Array.from({ length: numDays }, (_, i) => {
      const dayDate = new Date(baseDate);
      dayDate.setDate(baseDate.getDate() + i);
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

  // Computed End Date (Task 3.2)
  const formattedEndDate = useMemo(() => {
    if (!startDate || !duration) return null;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(start);
    end.setDate(start.getDate() + (duration - 1));
    return end.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [startDate, duration]);

  const computedEndDateIso = useMemo(() => {
    if (!startDate || !duration) return null;
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(start);
    end.setDate(start.getDate() + (duration - 1));
    return end.toISOString();
  }, [startDate, duration]);

  // Drag and Drop active item
  const [activeCard, setActiveCard] = useState<BoardCard | null>(null);

  // Topic Shift Modal state
  const [shiftModalCard, setShiftModalCard] = useState<BoardCard | null>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);

  // Start Challenge Modal & Saving state
  const [isCreatingChallenge, setIsCreatingChallenge] = useState(false);
  const [isChallengeSaved, setIsChallengeSaved] = useState(false);
  const [savedChallengeId, setSavedChallengeId] = useState<string | null>(null);
  const [challengePayload, setChallengePayload] = useState<Record<string, unknown> | null>(null);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);

  const isBoardLocked = !isChallengeSaved;

  // Dynamic Current Day derivation based on real-time clock and start date (Task 3.5)
  const currentDay = useMemo(() => {
    if (!isChallengeSaved || !startDate) return 1;
    const now = currentTime || Date.now();
    const startMs = new Date(startDate + 'T00:00:00').getTime();
    const dayDiff = Math.floor((now - startMs) / 86400000) + 1;
    const maxDays = duration || 7;
    return Math.min(maxDays, Math.max(1, dayDiff));
  }, [isChallengeSaved, startDate, currentTime, duration]);

  // Toast alert
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
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

        setSyllabus((prev) => {
          if (prev.length === 0) return dedupedItems;
          // Preserve checked state if syllabus was already loaded
          const checkedMap = new Map(prev.map((p) => [p.id, p.checked]));
          return dedupedItems.map((item) => ({
            ...item,
            checked: checkedMap.has(item.id) ? Boolean(checkedMap.get(item.id)) : false,
          }));
        });
      },
      (error) => {
        console.error('Error fetching master syllabus:', error);
        setLoadingSyllabus(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Update DnD board cards whenever selected syllabus changes (Task 3.5: no demo randomization)
  useEffect(() => {
    const selected = syllabus.filter((s) => s.checked);
    if (selected.length === 0) {
      setBoardCards([]);
      return;
    }

    // Distribute cards across day columns
    const numCols = columns.length || 7;
    const newBoardCards: BoardCard[] = selected.map((item, idx) => {
      const assignedDay = (idx % numCols) + 1;

      return {
        id: `card-${item.id}`,
        subject: item.subject,
        title: item.title,
        durationMinutes: item.durationMinutes,
        tag: item.tag || 'Core Concept',
        dayNumber: assignedDay,
        isFinished: false,
      };
    });

    setBoardCards(newBoardCards);
  }, [syllabus, columns.length]);

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

  // Instant DB persistence helper for Drag & Drop allocation (Task 3.4)
  const persistAllocation = async (updatedCards: BoardCard[]) => {
    if (!isChallengeSaved || !savedChallengeId || !startDate) return;
    const dayWiseAllocation: Record<string, BoardCard[]> = {};
    columns.forEach((col) => {
      dayWiseAllocation[`Day ${col.dayNumber}`] = updatedCards.filter(
        (c) => c.dayNumber === col.dayNumber
      );
    });
    try {
      await updateChallengeDayAllocation(
        savedChallengeId,
        dayWiseAllocation,
        new Date(startDate + 'T00:00:00').toISOString()
      );
    } catch (err) {
      console.error('Failed to auto-save schedule changes to database:', err);
      showToast('Failed to save schedule change to database.', 'error');
    }
  };

  // DnD Handlers
  const handleDragStart = (event: DragStartEvent) => {
    if (isBoardLocked) return;
    const cardData = event.active.data.current?.card as BoardCard | undefined;
    if (cardData) {
      setActiveCard(cardData);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (isBoardLocked) return;
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const draggedCard = active.data.current?.card as BoardCard | undefined;
    const targetColumn = over.data.current?.column as DayColumnData | undefined;

    if (!draggedCard || !targetColumn) return;

    const originalDay = draggedCard.dayNumber;
    const targetDay = targetColumn.dayNumber;

    if (originalDay === targetDay) return;

    // VALIDATION 1: Prevent dropping ANY card into a past column
    if (targetDay < currentDay) {
      showToast(
        `Day ${targetDay} is in the past, so you cannot schedule topics there.`,
        'error'
      );
      return;
    }

    // VALIDATION 2: Allow dragging an unfinished card from past into future
    if (originalDay < currentDay) {
      showToast(
        `Moved "${draggedCard.title}" from Day ${originalDay} to Day ${targetDay}.`,
        'success'
      );
    } else {
      showToast(
        `Moved "${draggedCard.title}" to Day ${targetDay}.`,
        'info'
      );
    }

    const nextCards = boardCards.map((c) =>
      c.id === draggedCard.id ? { ...c, dayNumber: targetDay } : c
    );
    setBoardCards(nextCards);

    // Auto-save instantly to Firestore if saved (Task 3.4)
    if (isChallengeSaved && savedChallengeId) {
      persistAllocation(nextCards);
    }
  };

  // Topic Shift Modal Logic
  const handleCardClick = (card: BoardCard) => {
    if (isBoardLocked) {
      showToast('Please save the challenge first to unlock schedule changes.', 'info');
      return;
    }
    setShiftModalCard(card);
    setIsShiftModalOpen(true);
  };

  const handleConfirmShift = (targetDay: number) => {
    if (!shiftModalCard) return;

    if (targetDay < currentDay) {
      showToast(
        `Cannot move topics to past days.`,
        'error'
      );
      return;
    }

    const nextCards = boardCards.map((c) =>
      c.id === shiftModalCard.id ? { ...c, dayNumber: targetDay } : c
    );
    setBoardCards(nextCards);

    showToast(
      `Moved "${shiftModalCard.title}" to Day ${targetDay}.`,
      'success'
    );
    setIsShiftModalOpen(false);
    setShiftModalCard(null);

    // Auto-save instantly to Firestore if saved (Task 3.4)
    if (isChallengeSaved && savedChallengeId) {
      persistAllocation(nextCards);
    }
  };

  // Auto-balance workload helper
  const handleAutoBalance = () => {
    if (isBoardLocked) {
      showToast('Please save the challenge first to unlock day balancing.', 'info');
      return;
    }
    const futureCols = columns.filter((c) => c.dayNumber >= currentDay);
    if (futureCols.length === 0) return;

    const nextCards = boardCards.map((c, idx) => {
      if (c.dayNumber < currentDay) return c;
      const assignedCol = futureCols[idx % futureCols.length];
      return { ...c, dayNumber: assignedCol.dayNumber };
    });
    setBoardCards(nextCards);

    if (isChallengeSaved && savedChallengeId) {
      persistAllocation(nextCards);
    }

    showToast('Workload distributed evenly across upcoming days.', 'success');
  };

  // Challenge Saving Logic directly to Firestore `challenges` collection (Task 3.2)
  const handleStartChallenge = async () => {
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

    const selectedSyllabusItems = syllabus.filter((item) => item.checked);
    if (selectedSyllabusItems.length === 0) {
      showToast('Please select at least 1 syllabus topic to create a sprint.', 'error');
      return;
    }

    setIsCreatingChallenge(true);

    // Group cards day-wise
    const dayWiseAllocation: Record<string, BoardCard[]> = {};
    columns.forEach((col) => {
      dayWiseAllocation[`Day ${col.dayNumber}`] = boardCards.filter(
        (c) => c.dayNumber === col.dayNumber
      );
    });

    const totalMinutes = boardCards.reduce((acc, c) => acc + c.durationMinutes, 0);
    const totalEstimatedHours = Number((totalMinutes / 60).toFixed(1));

    // Initialize progress map for the creator
    const initialProgress: Record<string, { theory: boolean; practice: boolean }> = {};
    selectedSyllabusItems.forEach((top) => {
      initialProgress[top.id] = { theory: false, practice: false };
    });

    const structuredPayload = {
      challenge_id: `ch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      challenge_name: challengeName.trim(),
      created_by: user.uid,
      creator_name: user.name,
      duration,
      start_date: new Date(startDate + 'T00:00:00').toISOString(),
      end_date: computedEndDateIso || undefined,
      selected_syllabus: selectedSyllabusItems.map((s) => ({
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
          name: user.name,
          email: user.email,
          photoURL: user.photoURL,
          completed_topics: 0,
          total_challenge_topics: selectedSyllabusItems.length,
          last_completion_timestamp: Date.now(),
          topic_progress: initialProgress,
          joined_at: new Date().toISOString(),
        },
      ],
    };

    try {
      const savedChallenge = await createFirestoreChallenge(structuredPayload);

      // Set as active challenge in global app context
      setActiveChallenge(savedChallenge);
      setSavedChallengeId(savedChallenge.challenge_id);
      setIsChallengeSaved(true);

      setChallengePayload({
        ...savedChallenge,
        totalTopics: boardCards.length,
        totalEstimatedHours,
      });
      setIsStartModalOpen(true);
      showToast('Challenge created and saved to Firestore! Schedule board is now unlocked.', 'success');
    } catch (error) {
      console.error('Failed to save challenge to Firestore:', error);
      showToast('Failed to save challenge to cloud database.', 'error');
    } finally {
      setIsCreatingChallenge(false);
    }
  };

  // Syllabus selection helpers
  const handleToggleSyllabus = (id: string) => {
    setSyllabus((prev) =>
      prev.map((s) => (s.id === id ? { ...s, checked: !s.checked } : s))
    );
  };

  const handleToggleChapterSyllabus = (chapterId: string, chapterTopics: { id: string }[], allChecked: boolean) => {
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

  const handleSelectAllCore = () => {
    setSyllabus((prev) => prev.map((s) => ({ ...s, checked: true })));
  };

  const handleClearSelection = () => {
    setSyllabus((prev) => prev.map((s) => ({ ...s, checked: false })));
  };

  const selectedSyllabusCount = syllabus.filter((s) => s.checked).length;
  const selectedSyllabusMins = syllabus
    .filter((s) => s.checked)
    .reduce((sum, s) => sum + s.durationMinutes, 0);
  const selectedSyllabusHours = (selectedSyllabusMins / 60).toFixed(1);

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

      {/* Top Banner / Navigation */}
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
                  HSC Syllabus
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#003820] tracking-tight">
                Create Study Sprint
              </h1>
            </div>

            {/* Stepper Indicator (Task 3.2: duration ?? '-') */}
            <div className="flex items-center gap-2 bg-[#eff4ff] p-1.5 rounded-2xl shadow-xs border border-[#c0c9c0]/30 text-xs">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white text-[#0b1c30] shadow-xs">
                <span className="w-5 h-5 rounded-full bg-[#003820] text-white text-[10px] flex items-center justify-center font-bold">
                  1
                </span>
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-[11px]">Duration</span>
                  <span className="text-[10px] text-[#707971] font-mono">{duration ?? '-'} Days</span>
                </div>
                {duration !== null && (
                  <span className="material-symbols-outlined text-[#003820] text-sm font-bold">check</span>
                )}
              </div>
              <span className="text-[#c0c9c0]">›</span>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white text-[#0b1c30] shadow-xs">
                <span className="w-5 h-5 rounded-full bg-[#003820] text-white text-[10px] flex items-center justify-center font-bold">
                  2
                </span>
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-[11px]">Topics</span>
                  <span className="text-[10px] text-[#707971] font-mono">
                    {selectedSyllabusCount} Selected
                  </span>
                </div>
                {selectedSyllabusCount > 0 && (
                  <span className="material-symbols-outlined text-[#003820] text-sm font-bold">check</span>
                )}
              </div>
              <span className="text-[#c0c9c0]">›</span>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#003820] text-white shadow-xs">
                <span className="w-5 h-5 rounded-full bg-[#6ffbbe] text-[#002111] text-[10px] flex items-center justify-center font-bold">
                  3
                </span>
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-[11px]">Schedule</span>
                  <span className="text-[10px] text-[#6ffbbe] font-mono">Daily Plan</span>
                </div>
                <span className="material-symbols-outlined text-[#6ffbbe] text-sm">edit_calendar</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Wizard Workspace */}
      <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-8 py-8 flex flex-col gap-10">
        {/* STEP 1: DURATION SELECTION & SPRINT DETAILS (Task 3.2) */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-[#e5eeff] text-[#003820] text-xs font-bold flex items-center justify-center">
                01
              </span>
              <div>
                <h2 className="text-lg font-bold text-[#0b1c30]">Select Sprint Duration</h2>
                <p className="text-xs text-[#404942]">Choose how long you want this sprint to run.</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#6ffbbe]/30 text-[#003820] text-xs font-semibold">
              Recommended: 7 Days
            </span>
          </div>

          {/* Duration Cards: unselected by default */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              onClick={() => setDuration(7)}
              className={`relative bg-white rounded-2xl p-6 cursor-pointer transition-all duration-200 shadow-xs flex flex-col justify-between group ${
                duration === 7
                  ? 'ring-2 ring-blue-600 bg-gradient-to-br from-blue-50/40 via-white to-white shadow-md'
                  : 'hover:shadow-md border border-[#c0c9c0]/30 opacity-80'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">bolt</span>
                </div>
                <div>
                  <h3 className="text-base text-[#0b1c30] font-bold">Weekly Sprint</h3>
                  <span className="text-xs text-blue-700 font-semibold uppercase">
                    7 Days
                  </span>
                </div>
              </div>
              <p className="text-xs text-[#404942]">
                Best for focused chapter revision and exam prep over 1 week.
              </p>
            </div>

            <div
              onClick={() => setDuration(30)}
              className={`relative bg-white rounded-2xl p-6 cursor-pointer transition-all duration-200 shadow-xs flex flex-col justify-between group ${
                duration === 30
                  ? 'ring-2 ring-blue-600 bg-gradient-to-br from-blue-50/40 via-white to-white shadow-md'
                  : 'hover:shadow-md border border-[#c0c9c0]/30 opacity-80'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-[#eff4ff] text-[#404942] flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">event_repeat</span>
                </div>
                <div>
                  <h3 className="text-base text-[#0b1c30] font-bold">Monthly Sprint</h3>
                  <span className="text-xs text-[#404942] font-semibold uppercase">
                    30 Days
                  </span>
                </div>
              </div>
              <p className="text-xs text-[#404942]">
                Covers full chapters and problem sets with steady daily pacing.
              </p>
            </div>
          </div>

          {/* Prompts rendered once duration is picked (Task 3.2) */}
          {duration !== null && (
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#c0c9c0]/30 flex flex-col md:flex-row gap-6 items-stretch animate-in fade-in duration-200">
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-xs font-bold text-[#0b1c30]">
                  Name your challenge <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={challengeName}
                  onChange={(e) => setChallengeName(e.target.value)}
                  placeholder="e.g. Physics Chapter 3 Revision"
                  className="w-full bg-[#eff4ff]/60 hover:bg-[#eff4ff] focus:bg-white border border-[#c0c9c0]/60 focus:border-[#003820] rounded-xl px-4 py-2.5 text-xs text-[#0b1c30] placeholder-[#707971] focus:outline-none focus:ring-2 focus:ring-[#003820]/20 transition-all font-medium"
                />
              </div>

              <div className="flex-1 flex flex-col gap-2">
                <label className="text-xs font-bold text-[#0b1c30]">
                  Select Starting Date <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <input
                    type="date"
                    min={todayDateString}
                    value={startDate || ''}
                    onChange={(e) => setStartDate(e.target.value || null)}
                    className="w-full sm:w-auto bg-[#eff4ff]/60 hover:bg-[#eff4ff] focus:bg-white border border-[#c0c9c0]/60 focus:border-[#003820] rounded-xl px-4 py-2.5 text-xs text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#003820]/20 transition-all font-medium cursor-pointer"
                  />
                  {formattedEndDate && (
                    <div className="px-3.5 py-2 rounded-xl bg-[#eff4ff] text-[#003820] text-xs font-semibold border border-[#c0c9c0]/40 flex items-center gap-1.5 shrink-0">
                      <span className="material-symbols-outlined text-sm text-[#006c49]">event_available</span>
                      <span>Ends: <strong className="font-mono">{formattedEndDate}</strong></span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* STEP 2: SYLLABUS SELECTION (FETCHED DIRECTLY FROM FIRESTORE `master_syllabus`) */}
        <section className="flex flex-col gap-4">
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
              {/* Paper Filter Segment (Task 3.3) */}
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
                onClick={handleSelectAllCore}
                className="px-3 py-1.5 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] text-xs font-semibold transition-colors cursor-pointer"
              >
                Select All
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
            /* Subject -> Chapter -> Topic Cascade (Task 3.3: closed by default) */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredMasterSubjects.map((sub) => {
                const isSubjectOpen = openSubjectNames.includes(sub.name);
                const subTopics = sub.chapters.flatMap((c) => c.topics);
                const subCheckedCount = subTopics.filter((t) => {
                  const item = syllabusMap.get(t.id);
                  return item?.checked;
                }).length;

                return (
                  <div
                    key={sub.id || sub.name}
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
                          aria-label={isSubjectOpen ? 'Collapse subject' : 'Expand subject'}
                          className="w-7 h-7 rounded-lg bg-[#eff4ff] text-[#404942] flex items-center justify-center text-xs"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {isSubjectOpen ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Chapters list (when subject is open) */}
                    {isSubjectOpen && (
                      <div className="flex flex-col gap-3 pt-1 animate-in fade-in duration-150">
                        {sub.chapters.map((ch) => {
                          const isChapterOpen = openChapterIds.includes(ch.id);
                          const chCheckedCount = ch.topics.filter((t) => {
                            const item = syllabusMap.get(t.id);
                            return item?.checked;
                          }).length;

                          const isChapterAllChecked = ch.topics.length > 0 && ch.topics.every((t) => {
                            const item = syllabusMap.get(t.id);
                            return item?.checked;
                          });

                          return (
                            <div
                              key={ch.id}
                              className="rounded-xl border border-[#c0c9c0]/30 overflow-hidden bg-[#eff4ff]/20"
                            >
                              {/* Chapter Header Toggle */}
                              <div
                                onClick={() => toggleChapterOpen(ch.id)}
                                className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                                  isChapterOpen ? 'bg-[#eff4ff]/80 border-b border-[#e5eeff]' : 'hover:bg-[#eff4ff]/40'
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
                                        const someChecked = ch.topics.some((t) => syllabusMap.get(t.id)?.checked);
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
                                  {ch.topics.map((top) => {
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
                                        key={top.id}
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
        </section>

        {/* STEP 3: WORKLOAD DISTRIBUTION & DnD KANBAN BOARD */}
        <section className="flex flex-col gap-5 pt-4">
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
                  Drag topics between days to organize your daily study routine.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAutoBalance}
                disabled={isBoardLocked}
                className="px-3 py-1.5 rounded-xl bg-[#eff4ff] hover:bg-[#e5eeff] text-[#003820] text-xs font-semibold border border-[#c0c9c0]/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title={isBoardLocked ? 'Save challenge first to unlock auto-balancing' : undefined}
              >
                Balance Days
              </button>

              <button
                onClick={handleStartChallenge}
                disabled={isCreatingChallenge || selectedSyllabusCount === 0}
                className="px-5 py-2 rounded-xl bg-[#003820] hover:bg-[#004e2d] text-white text-xs font-bold shadow-md shadow-[#003820]/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm text-[#6ffbbe]">
                  {isChallengeSaved ? 'check_circle' : 'save'}
                </span>
                <span>
                  {isCreatingChallenge
                    ? 'Saving Challenge...'
                    : isChallengeSaved
                    ? 'Challenge Saved'
                    : 'Save Challenge'}
                </span>
              </button>
            </div>
          </div>

          {/* Board Gating Status Banner */}
          {!isChallengeSaved ? (
            <div className="px-3.5 py-2 rounded-xl bg-[#eff4ff] border border-[#c0c9c0]/40 text-xs text-[#404942] flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[#006c49]">lock</span>
                <span>Planning board is locked. Click <strong>Save Challenge</strong> to save your sprint and unlock drag & drop planning.</span>
              </div>
              <span className="text-[10px] font-mono uppercase font-bold text-[#707971] bg-white px-2 py-0.5 rounded border border-[#c0c9c0]/30 shrink-0">
                Locked
              </span>
            </div>
          ) : (
            <div className="px-3.5 py-2 rounded-xl bg-[#eff4ff] border border-[#006c49]/30 text-xs text-[#003820] flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[#006c49]">lock_open</span>
                <span>Challenge saved to Firestore. Planning board is unlocked for drag & drop customization. Changes auto-save instantly.</span>
              </div>
              <span className="text-[10px] font-mono uppercase font-bold text-[#006c49] bg-white px-2 py-0.5 rounded border border-[#006c49]/30 shrink-0">
                Unlocked
              </span>
            </div>
          )}

          {/* DnD Context Board */}
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div
              ref={scrollContainerRef}
              className={`flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin scrollbar-thumb-[#c0c9c0] transition-opacity duration-200 ${
                isBoardLocked ? 'opacity-75' : ''
              }`}
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
                    isBoardLocked={isBoardLocked}
                  />
                );
              })}
            </div>

            {/* Drag Overlay Ghost Card */}
            <DragOverlay>
              {activeCard && (
                <div className="p-3.5 rounded-xl bg-white border-2 border-blue-500 shadow-2xl rotate-2 opacity-95 w-72">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-bold text-blue-700">{activeCard.subject}</span>
                    <span className="text-[#707971] font-mono">{activeCard.durationMinutes}m</span>
                  </div>
                  <h4 className="text-xs font-bold text-[#0b1c30]">{activeCard.title}</h4>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </section>
      </div>

      {/* Modals */}
      <ShiftTopicModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        card={shiftModalCard}
        currentDay={currentDay}
        columns={columns}
        cards={boardCards}
        onConfirmShift={(_cardId, targetDay) => handleConfirmShift(targetDay)}
      />

      <StartChallengeModal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        challengeData={challengePayload}
      />
    </div>
  );
};
