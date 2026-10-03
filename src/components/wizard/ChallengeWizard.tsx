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
import { INITIAL_DAY_COLUMNS } from '../../data/wizardData';
import { MasterSubject } from '../../types/syllabus';
import { subscribeMasterSyllabus, seedDefaultSyllabus } from '../../services/syllabusService';
import { createFirestoreChallenge } from '../../services/challengeService';
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
  const { setActiveChallenge } = useStudyTrack();

  const handleBack = () => {
    if (onBackToDashboard) onBackToDashboard();
    else navigate('/');
  };

  // STEP 1: Duration selection (7 or 30 days)
  const [duration, setDuration] = useState<SprintDuration>(7);

  // STEP 2: Real-time Master Syllabus directly from Firestore
  const [masterSubjects, setMasterSubjects] = useState<MasterSubject[]>([]);
  const [syllabus, setSyllabus] = useState<SyllabusItem[]>([]);
  const [loadingSyllabus, setLoadingSyllabus] = useState(true);
  const [seedingSyllabus, setSeedingSyllabus] = useState(false);

  // STEP 3: Planning Board & Scientific Validation (Time Travel Prevention)
  const [currentDay, setCurrentDay] = useState<number>(3);
  const [boardCards, setBoardCards] = useState<BoardCard[]>([]);
  const [columns] = useState<DayColumnData[]>(INITIAL_DAY_COLUMNS);

  // Drag and Drop active item
  const [activeCard, setActiveCard] = useState<BoardCard | null>(null);

  // Topic Shift Modal state
  const [shiftModalCard, setShiftModalCard] = useState<BoardCard | null>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);

  // Start Challenge Modal & Saving state
  const [isCreatingChallenge, setIsCreatingChallenge] = useState(false);
  const [challengePayload, setChallengePayload] = useState<Record<string, unknown> | null>(null);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);

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

  // REQUIREMENT 3: Fetch syllabus directly from `master_syllabus` Firestore collection
  useEffect(() => {
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
                checked: true, // Default to selected
              });
            });
          });
        });

        setSyllabus((prev) => {
          if (prev.length === 0) return flattenedItems;
          // Preserve checked state if syllabus was already loaded
          const checkedMap = new Map(prev.map((p) => [p.id, p.checked]));
          return flattenedItems.map((item) => ({
            ...item,
            checked: checkedMap.has(item.id) ? Boolean(checkedMap.get(item.id)) : true,
          }));
        });
      },
      (error) => {
        console.error('Error fetching master syllabus:', error);
        setLoadingSyllabus(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Update DnD board cards whenever selected syllabus changes
  useEffect(() => {
    const selected = syllabus.filter((s) => s.checked);
    if (selected.length === 0) {
      setBoardCards([]);
      return;
    }

    // Distribute cards across 7 days
    const newBoardCards: BoardCard[] = selected.map((item, idx) => {
      const assignedDay = (idx % columns.length) + 1;
      const isPast = assignedDay < currentDay;

      return {
        id: `card-${item.id}`,
        subject: item.subject,
        title: item.title,
        durationMinutes: item.durationMinutes,
        tag: item.tag || 'Core Concept',
        dayNumber: assignedDay,
        isFinished: isPast ? idx % 2 === 0 : false,
      };
    });

    setBoardCards(newBoardCards);
  }, [syllabus, columns.length, currentDay]);

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

  // DnD Handlers
  const handleDragStart = (event: DragStartEvent) => {
    const cardData = event.active.data.current?.card as BoardCard | undefined;
    if (cardData) {
      setActiveCard(cardData);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
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
        `⛔ Time Travel Prevented! Day ${targetDay} is in the past. Cards cannot be rescheduled to past dates.`,
        'error'
      );
      return;
    }

    // VALIDATION 2: Allow dragging an unfinished card from past into future
    if (originalDay < currentDay) {
      showToast(
        `✓ Rescheduled backlog: Moved "${draggedCard.title}" from Day ${originalDay} to Day ${targetDay}.`,
        'success'
      );
    } else {
      showToast(
        `✓ Reallocated: Moved "${draggedCard.title}" to Day ${targetDay}.`,
        'info'
      );
    }

    setBoardCards((prev) =>
      prev.map((c) => (c.id === draggedCard.id ? { ...c, dayNumber: targetDay } : c))
    );
  };

  // Topic Shift Modal Logic
  const handleCardClick = (card: BoardCard) => {
    setShiftModalCard(card);
    setIsShiftModalOpen(true);
  };

  const handleConfirmShift = (targetDay: number) => {
    if (!shiftModalCard) return;

    if (targetDay < currentDay) {
      showToast(
        `⛔ Invalid Day: Cannot move topic to past Day ${targetDay}.`,
        'error'
      );
      return;
    }

    setBoardCards((prev) =>
      prev.map((c) => (c.id === shiftModalCard.id ? { ...c, dayNumber: targetDay } : c))
    );

    showToast(
      `✓ Successfully shifted "${shiftModalCard.title}" to Day ${targetDay}.`,
      'success'
    );
    setIsShiftModalOpen(false);
    setShiftModalCard(null);
  };

  // Auto-balance workload helper
  const handleAutoBalance = () => {
    const futureCols = columns.filter((c) => c.dayNumber >= currentDay);
    if (futureCols.length === 0) return;

    setBoardCards((prev) =>
      prev.map((c, idx) => {
        if (c.dayNumber < currentDay) return c;
        const assignedCol = futureCols[idx % futureCols.length];
        return { ...c, dayNumber: assignedCol.dayNumber };
      })
    );

    showToast('Auto-balanced workload evenly across upcoming days.', 'success');
  };

  // REQUIREMENT 1: Challenge Saving Logic directly to Firestore `challenges` collection
  const handleStartChallenge = async () => {
    if (!user) {
      showToast('You must be signed in to create and save a challenge.', 'error');
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
      created_by: user.uid,
      creator_name: user.name,
      duration,
      start_date: new Date().toISOString(),
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

      // Console.log the final structured JSON object as explicitly required
      console.log(
        '%c=== START CHALLENGE: FINAL STRUCTURED FIRESTORE OBJECT ===',
        'color: #006c49; font-size: 14px; font-weight: bold;'
      );
      console.log(savedChallenge);

      // Set as active challenge in global app context
      setActiveChallenge(savedChallenge);

      setChallengePayload({
        ...savedChallenge,
        totalTopics: boardCards.length,
        totalEstimatedHours,
      });
      setIsStartModalOpen(true);
      showToast('Challenge created and saved to Firestore!', 'success');
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

  // Group syllabus topics by Subject name
  const subjectsWithTopics = useMemo(() => {
    const map = new Map<string, SyllabusItem[]>();
    syllabus.forEach((item) => {
      const list = map.get(item.subject) || [];
      list.push(item);
      map.set(item.subject, list);
    });
    return Array.from(map.entries()).map(([subjectName, items]) => ({
      name: subjectName,
      items,
    }));
  }, [syllabus]);

  // Carousel scrolling
  const scrollBoard = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
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
                <span className="font-semibold text-[#003820]">Challenge Setup Wizard</span>
                <span>/</span>
                <span className="px-2 py-0.5 rounded-full bg-[#eff4ff] text-[#003820] text-[10px] font-mono font-bold">
                  Firestore Master Syllabus Synced
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#003820] tracking-tight">
                Sprint Configuration & Workload Distribution
              </h1>
            </div>

            {/* Stepper Indicator */}
            <div className="flex items-center gap-2 bg-[#eff4ff] p-1.5 rounded-2xl shadow-xs border border-[#c0c9c0]/30 text-xs">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white text-[#0b1c30] shadow-xs">
                <span className="w-5 h-5 rounded-full bg-[#003820] text-white text-[10px] flex items-center justify-center font-bold">
                  1
                </span>
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-[11px]">Duration</span>
                  <span className="text-[10px] text-[#707971] font-mono">{duration}-Day Sprint</span>
                </div>
                <span className="material-symbols-outlined text-[#003820] text-sm font-bold">check</span>
              </div>
              <span className="text-[#c0c9c0]">›</span>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white text-[#0b1c30] shadow-xs">
                <span className="w-5 h-5 rounded-full bg-[#003820] text-white text-[10px] flex items-center justify-center font-bold">
                  2
                </span>
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-[11px]">Syllabus</span>
                  <span className="text-[10px] text-[#707971] font-mono">
                    {selectedSyllabusCount} Selected
                  </span>
                </div>
                <span className="material-symbols-outlined text-[#003820] text-sm font-bold">check</span>
              </div>
              <span className="text-[#c0c9c0]">›</span>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#003820] text-white shadow-xs">
                <span className="w-5 h-5 rounded-full bg-[#6ffbbe] text-[#002111] text-[10px] flex items-center justify-center font-bold">
                  3
                </span>
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-[11px]">Distribution</span>
                  <span className="text-[10px] text-[#6ffbbe] font-mono">Interactive Board</span>
                </div>
                <span className="material-symbols-outlined text-[#6ffbbe] text-sm">edit_calendar</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Wizard Workspace */}
      <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-8 py-8 flex flex-col gap-10">
        {/* STEP 1: DURATION SELECTION */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-[#e5eeff] text-[#003820] text-xs font-bold flex items-center justify-center">
                01
              </span>
              <div>
                <h2 className="text-lg font-bold text-[#0b1c30]">Select Sprint Duration</h2>
                <p className="text-xs text-[#404942]">Choose operational intensity for your study goals.</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#6ffbbe]/30 text-[#003820] text-xs font-semibold">
              High-Velocity Preset
            </span>
          </div>

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
                    7-Day High Intensity
                  </span>
                </div>
              </div>
              <p className="text-xs text-[#404942]">
                Focused sprint designed for rapid chapter coverage, mock test prep, and tight deadlines.
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
                  <h3 className="text-base text-[#0b1c30] font-bold">Monthly Marathon</h3>
                  <span className="text-xs text-[#404942] font-semibold uppercase">
                    30-Day Curriculum Coverage
                  </span>
                </div>
              </div>
              <p className="text-xs text-[#404942]">
                Steady comprehensive textbook pacing with built-in spaced repetition intervals.
              </p>
            </div>
          </div>
        </section>

        {/* STEP 2: SYLLABUS SELECTION (FETCHED DIRECTLY FROM FIRESTORE `master_syllabus`) */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-[#e5eeff] text-[#003820] text-xs font-bold flex items-center justify-center">
                02
              </span>
              <div>
                <h2 className="text-lg font-bold text-[#0b1c30]">Curate Syllabus Topics</h2>
                <p className="text-xs text-[#404942]">
                  Select topics from the official Firestore Master Syllabus configured by Administrators. Normal users cannot modify the curriculum.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-[#404942] font-semibold pr-2">
                {selectedSyllabusCount} topics selected •{' '}
                <strong className="text-[#003820]">~{selectedSyllabusHours} hrs study load</strong>
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
          ) : subjectsWithTopics.length === 0 ? (
            <div className="p-8 bg-amber-50 rounded-2xl border border-amber-200 text-center space-y-3">
              <span className="material-symbols-outlined text-3xl text-amber-700">warning</span>
              <div>
                <h4 className="font-bold text-sm text-amber-900">
                  Master Syllabus is empty in Firestore
                </h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  The administrator needs to populate the official HSC Master Syllabus.
                </p>
              </div>
              {isAdmin ? (
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
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {subjectsWithTopics.map(({ name: subj, items }) => {
                const checkedCount = items.filter((s) => s.checked).length;

                return (
                  <div
                    key={subj}
                    className="bg-white rounded-2xl p-5 shadow-xs border border-[#c0c9c0]/30 flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-[#e5eeff]">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#003820] text-xl">
                          school
                        </span>
                        <span className="text-sm font-bold text-[#0b1c30]">{subj}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#6ffbbe]/30 text-[#003820] text-xs font-bold font-mono">
                        {checkedCount} / {items.length} selected
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 pt-1 max-h-96 overflow-y-auto pr-1">
                      {items.map((item) => (
                        <label
                          key={item.id}
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
                      ))}
                    </div>
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
                  Distribute Workload Across Days (Drag & Drop)
                </h2>
                <p className="text-xs text-[#404942]">
                  Chronological scheduling guard active. Dropping cards into past days (Day 1 & 2) is strictly blocked.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAutoBalance}
                className="px-3 py-1.5 rounded-xl bg-[#eff4ff] hover:bg-[#e5eeff] text-[#003820] text-xs font-semibold border border-[#c0c9c0]/30 transition-colors cursor-pointer"
              >
                Auto-balance Workload
              </button>

              <button
                onClick={handleStartChallenge}
                disabled={isCreatingChallenge || selectedSyllabusCount === 0}
                className="px-5 py-2 rounded-xl bg-[#003820] hover:bg-[#004e2d] text-white text-xs font-bold shadow-md shadow-[#003820]/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm text-[#6ffbbe]">
                  rocket_launch
                </span>
                <span>{isCreatingChallenge ? 'Saving to Firestore...' : 'Start Challenge & Save'}</span>
              </button>
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
              className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin scrollbar-thumb-[#c0c9c0]"
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
