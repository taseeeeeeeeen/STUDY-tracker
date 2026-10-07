import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { Task, SubjectWeeklyStat, WeeklyBacklog, ActiveSprint } from '../types/dashboard';
import { HSCSubject, HSCProgressSummary } from '../types/hsc';
import { PeerContender, ActiveSprintChallenge } from '../types/peerArena';
import { FirestoreChallenge } from '../types/challenge';
import { MasterSubject } from '../types/syllabus';
import { convertMasterToHSC } from '../data/hscMasterSyllabus';
import { subscribeMasterSyllabus } from '../services/syllabusService';
import {
  joinFirestoreChallenge,
  findChallengeByCode,
  subscribeChallenge,
  isChallengeActive,
  updateChallengeDayAllocation,
  archiveChallenge,
  deleteFirestoreChallenge,
} from '../services/challengeService';
import {
  dedupeSyllabusTopics,
  performMidnightRollover,
  computeCurrentSprintDay,
  flattenAllocationToTopics,
} from '../utils/challengeLogic';
import { getMidnightEndOfDay } from '../utils/dateUtils';
import {
  subscribeUserProgress,
  subscribeMemberProgress,
  toggleUserTopicProgress,
  setUserTopicProgressBatch,
  resetTopicsProgress,
  toggleHideSubject as toggleHideSubjectService,
  setHiddenSubjectIds as setHiddenSubjectIdsService,
  UserTopicProgress,
  UserProgressDoc,
  updateActiveChallengeId,
  addJoinedChallengeId,
} from '../services/userProgressService';
import { WeeklySnapshot, getIsoWeekKey } from '../types/weeklySnapshot';
import {
  upsertMyWeeklySnapshot,
  subscribeWeeklySnapshots,
} from '../services/weeklySnapshotService';
import {
  computeSubjectWeeklyStats,
  computeBacklog,
  computeSprint,
  computeOverallPercent,
  computeStreakDays,
  getDailyActiveDateKeys,
} from '../lib/progressMath';

interface StudyTrackContextType {
  // Main Dashboard State
  tasks: Task[];
  weeklyStats: SubjectWeeklyStat[];
  backlog: WeeklyBacklog;
  sprint: ActiveSprint;
  streakDays: number;
  dailyActiveDateKeys: Set<string>;
  currentTime: number;
  todayCompletionPercentage: number;
  completedUnits: number;
  totalUnits: number;
  completedTopicsCount: number;

  // HSC Grand Progress State
  hscMasterSyllabus: HSCSubject[];
  hscSummary: HSCProgressSummary;
  hiddenSubjectIds: string[];
  toggleHideSubject: (subjectId: string) => Promise<void>;
  setHiddenSubjects: (subjectIds: string[]) => Promise<void>;

  // Real-time Firestore Challenge & Peer Arena State
  activeChallenge: FirestoreChallenge | null;
  activeChallengeId: string | null;
  challenge: ActiveSprintChallenge;
  peers: PeerContender[];
  sortedPeers: (PeerContender & {
    scorePercent: number;
    rank: number;
  })[];
  memberProgressMap: Record<string, UserProgressDoc | null>;
  weeklySnapshots: WeeklySnapshot[];

  // Action Dispatchers
  toggleDashboardTheory: (taskId: string) => Promise<void>;
  toggleDashboardPractice: (taskId: string) => Promise<void>;
  toggleHSCTheory: (subjectId: string, chapterId: string, topicId: string) => void;
  toggleHSCPractice: (subjectId: string, chapterId: string, topicId: string) => void;
  setChapterProgress: (
    subjectId: string,
    chapterId: string,
    type: 'theory' | 'practice',
    done: boolean
  ) => Promise<void>;
  addDashboardTopic: (newTask: Omit<Task, 'id' | 'isLocked'>) => void;
  joinChallengeCode: (code: string) => Promise<boolean>;
  setActiveChallenge: (challenge: FirestoreChallenge) => void;
  resetActiveChallenge: () => Promise<void>;
  archiveActiveChallenge: () => Promise<void>;
  deleteActiveChallenge: () => Promise<void>;
  triggerToast: (msg: string) => void;
  toastMessage: string | null;
  clearToast: () => void;
}

const StudyTrackContext = createContext<StudyTrackContextType | undefined>(undefined);

const getActiveChallengeStorageKey = (uid: string) => `studytrack_active_challenge_id_${uid}`;

export const StudyTrackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const prevUserUidRef = useRef<string | null>(user?.uid || null);

  // Active Challenge in Firestore (ID resolution: Firestore -> LocalState -> localStorage)
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const activeChallengeIdRef = useRef<string | null>(null);
  const [activeChallenge, setActiveChallengeState] = useState<FirestoreChallenge | null>(null);
  const isExpiringRef = useRef<string | null>(null);

  // Attached Room (Peer Arena membership only)
  const [attachedRoomId, setAttachedRoomId] = useState<string | null>(null);
  const [attachedRoomChallenge, setAttachedRoomChallenge] = useState<FirestoreChallenge | null>(null);

  const [weeklySnapshots, setWeeklySnapshots] = useState<WeeklySnapshot[]>([]);
  const lastSnapshotPayloadRef = useRef<string>('');

  // Sync ref to state
  useEffect(() => {
    activeChallengeIdRef.current = activeChallengeId;
  }, [activeChallengeId]);

  // Boot-time optimistic cache (only once per user session)
  useEffect(() => {
    if (user && !activeChallengeId) {
      const cached = localStorage.getItem(getActiveChallengeStorageKey(user.uid));
      if (cached) setActiveChallengeId(cached);
    }
  }, [user]);

  // Per-user global HSC progress from Firestore
  const [userProgressDoc, setUserProgressDoc] = useState<UserProgressDoc | null>(null);
  const [userProgress, setUserProgress] = useState<Record<string, UserTopicProgress>>({});
  const userProgressRef = useRef<Record<string, UserTopicProgress>>({});
  const completionLogRef = useRef<Record<string, { theory: number | null; practice: number | null }> | undefined>(undefined);
  const [memberProgressMap, setMemberProgressMap] = useState<Record<string, UserProgressDoc | null>>({});

  useEffect(() => {
    userProgressRef.current = userProgress;
  }, [userProgress]);

  useEffect(() => {
    completionLogRef.current = userProgressDoc?.completionLog;
  }, [userProgressDoc]);

  const [globalMasterSyllabus, setGlobalMasterSyllabus] = useState<MasterSubject[]>([]);
  const [hiddenSubjectIds, setHiddenSubjectIds] = useState<string[]>([]);

  // Real tasks from active challenge (empty by default if no active challenge)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hscMasterSyllabus, setHscMasterSyllabus] = useState<HSCSubject[]>([]);

  // Real-time clock for time-based locks (updates every 10s)
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerToast = (msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, 3500);
  };

  const clearToast = () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToastMessage(null);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Real-Time Firestore onSnapshot Listener for Master Syllabus
  useEffect(() => {
    if (!user) {
      setGlobalMasterSyllabus([]);
      return;
    }

    const unsubscribe = subscribeMasterSyllabus((masterSubs) => {
      setGlobalMasterSyllabus(masterSubs || []);
    });
    return () => unsubscribe();
  }, [user]);

  // Real-Time Firestore onSnapshot Listener for User Progress
  useEffect(() => {
    if (!user) {
      setUserProgressDoc(null);
      setUserProgress({});
      setHiddenSubjectIds([]);
      setActiveChallengeId(null);
      if (prevUserUidRef.current) {
        localStorage.removeItem(getActiveChallengeStorageKey(prevUserUidRef.current));
        prevUserUidRef.current = null;
      }
      return;
    }

    prevUserUidRef.current = user.uid;

    const unsubscribe = subscribeUserProgress(
      user.uid,
      (progressDoc: UserProgressDoc | null) => {
        setUserProgressDoc(progressDoc);
        if (progressDoc) {
          setUserProgress(progressDoc.topicProgress || {});
          setHiddenSubjectIds(progressDoc.hiddenSubjectIds || []);
          
          const fsId = progressDoc.activeChallengeId || null;
          // Single Source of Truth check using Ref to avoid stale closure
          if (fsId !== activeChallengeIdRef.current) {
            setActiveChallengeId(fsId);
            if (fsId) {
              localStorage.setItem(getActiveChallengeStorageKey(user.uid), fsId);
            } else {
              localStorage.removeItem(getActiveChallengeStorageKey(user.uid));
            }
          }
        } else {
          setUserProgress({});
          setHiddenSubjectIds([]);
          setActiveChallengeId(null);
          localStorage.removeItem(getActiveChallengeStorageKey(user.uid));
        }
      },
      (err) => {
        console.error('Failed to subscribe to user progress:', err);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Expiry Reconciliation: Clear challenge if it's no longer active
  useEffect(() => {
    if (!user || !activeChallenge) return;

    if (!isChallengeActive(activeChallenge)) {
      // Prevent recursion loops
      if (isExpiringRef.current === activeChallenge.challenge_id) return;
      isExpiringRef.current = activeChallenge.challenge_id;

      console.log('Challenge expired, clearing session:', activeChallenge.challenge_id);
      setActiveChallengeId(null);
      setActiveChallengeState(null);
      setTasks([]);
      localStorage.removeItem(getActiveChallengeStorageKey(user.uid));
      updateActiveChallengeId(user.uid, null).catch(console.error);
    } else {
      // If it IS active, clear the ref so we can catch the next one
      isExpiringRef.current = null;
    }
  }, [activeChallenge, user]);

  // Sync hscMasterSyllabus whenever global syllabus, hidden subjects, or user progress changes
  useEffect(() => {
    const visibleSubjects = globalMasterSyllabus.filter(
      (s) => !hiddenSubjectIds.includes(s.id)
    );
    setHscMasterSyllabus(convertMasterToHSC(visibleSubjects, userProgress));
  }, [globalMasterSyllabus, userProgress, hiddenSubjectIds]);

function getTopicAllocatedDayMap(
  challenge: FirestoreChallenge | null | undefined
): Map<string, number> {
  const map = new Map<string, number>();
  if (!challenge || !challenge.day_wise_allocation) return map;

  Object.entries(challenge.day_wise_allocation).forEach(([dayKey, cards]) => {
    const match = dayKey.match(/Day\s+(\d+)/i);
    const dayNum = match ? parseInt(match[1], 10) : parseInt(dayKey.replace(/\D/g, ''), 10);
    if (!dayNum || isNaN(dayNum)) return;

    if (Array.isArray(cards)) {
      cards.forEach((card: any) => {
        if (card.id) {
          const rawId = card.id;
          const strippedId = card.id.replace(/^chapter-/, '');
          map.set(rawId, Math.max(map.get(rawId) || 0, dayNum));
          map.set(strippedId, Math.max(map.get(strippedId) || 0, dayNum));
        }
        if (card.chapterId) {
          map.set(card.chapterId, Math.max(map.get(card.chapterId) || 0, dayNum));
        }
        if (Array.isArray(card.topics)) {
          card.topics.forEach((t: any) => {
            if (t.id) {
              map.set(t.id, Math.max(map.get(t.id) || 0, dayNum));
            }
          });
        }
      });
    }
  });

  return map;
}

  // Real-Time Firestore onSnapshot Listener for Active Challenge
  useEffect(() => {
    if (!user || !activeChallengeId) {
      setActiveChallengeState(null);
      setTasks([]);
      return;
    }

    const unsubscribe = subscribeChallenge(
      activeChallengeId,
      (challengeDoc) => {
        if (!challengeDoc) {
          setActiveChallengeState(null);
          setTasks([]);
          if (user) {
            localStorage.removeItem(getActiveChallengeStorageKey(user.uid));
          }
          setActiveChallengeId(null);
          return;
        }

        setActiveChallengeState(challengeDoc);

        // Map challenge topics & current user's personal progress into Main Dashboard tasks
        const challengeCreatedAt = new Date(challengeDoc.start_date).getTime() || Date.now();

        // Apply dedupeSyllabusTopics before mapping
        const rawSyllabus = challengeDoc.selected_syllabus || [];
        const dedupedSyllabus = dedupeSyllabusTopics(rawSyllabus);

        // Derive today's allocated topics from day_wise_allocation if present
        const currentSprintDay = computeCurrentSprintDay(
          challengeDoc.start_date,
          challengeDoc.duration,
          Date.now()
        );
        const dayKey = `Day ${currentSprintDay}`;
        const hasDayAllocation = Boolean(
          challengeDoc.day_wise_allocation &&
          Object.keys(challengeDoc.day_wise_allocation).length > 0
        );
        const flattened = hasDayAllocation
          ? flattenAllocationToTopics(challengeDoc.day_wise_allocation)
          : null;

        const targetTopics = flattened
          ? (flattened[dayKey] || [])
          : dedupedSyllabus;

        const allocatedDayMap = getTopicAllocatedDayMap(challengeDoc);

        const mappedTasks: Task[] = targetTopics.map((top: any, idx: number) => {
          const prog = userProgressRef.current[top.id] || { theory: false, practice: false };

          // Replace hardcoded substring guessing with exact/prefix matching; fallback to topic's own subject
          const rawSubject = (top.subject || '').trim();
          const sLower = rawSubject.toLowerCase();
          
          let sub: string = top.subject || rawSubject;
          if (sLower.startsWith('phys') || sLower.includes('ফিজিক্স')) sub = 'Physics';
          else if (sLower.startsWith('chem') || sLower.includes('কেমিস্ট্রি')) sub = 'Chemistry';
          else if (sLower.startsWith('math') || sLower.includes('গণিত')) sub = 'Math';
          else if (sLower.startsWith('bio') || sLower.includes('জীব')) sub = 'Biology';
          else if (sLower.startsWith('bang') || sLower.includes('বাংলা')) sub = 'Bangla';
          else if (sLower.startsWith('eng') || sLower.includes('ইংরেজি')) sub = 'English';
          else if (sLower.startsWith('ict') || sLower.includes('তথ্য')) sub = 'ICT';

          const allocatedDay =
            allocatedDayMap.get(top.id) ||
            (top.chapterId ? allocatedDayMap.get(top.chapterId) : undefined) ||
            challengeDoc.duration ||
            7;
          const cutoffMs = getMidnightEndOfDay(challengeDoc.start_date, allocatedDay);
          const isExpired = !isNaN(cutoffMs) && Date.now() > cutoffMs;
          const isCompleted = Boolean(prog.theory && prog.practice);

          return {
            id: top.id || `task-${idx + 1}`,
            subject: sub,
            title: top.title,
            description: top.subconcept || `${top.subject || sub} core problem set and fundamentals`,
            durationMinutes: top.durationMinutes || 45,
            theoryCompleted: Boolean(prog.theory),
            practiceCompleted: Boolean(prog.practice),
            createdAt: challengeCreatedAt,
            isLocked: isExpired && !isCompleted,
            lockReason: isExpired ? 'Locked: 24-hour study completion window expired' : undefined,
            isCarriedOver: Boolean(top.isCarriedOver),
            carriedOverFromDay: top.carriedOverFromDay,
          };
        });

        setTasks(mappedTasks);
      },
      (error: any) => {
        console.warn('Real-time challenge onSnapshot error:', error);
        // If permission denied or not found, clear the active challenge
        if (error?.code === 'permission-denied' || error?.code === 'not-found') {
          setActiveChallengeState(null);
          setTasks([]);
          setActiveChallengeId(null);
          if (user) {
            localStorage.removeItem(getActiveChallengeStorageKey(user.uid));
          }
        }
      }
    );

    return () => unsubscribe();
  }, [activeChallengeId, user]);

  // Real-Time Firestore onSnapshot Listener for Attached Room (Peer Arena membership)
  useEffect(() => {
    if (!user || !attachedRoomId) {
      setAttachedRoomChallenge(null);
      return;
    }

    if (attachedRoomId === activeChallengeId) {
      setAttachedRoomChallenge(activeChallenge);
      return;
    }

    const unsubscribe = subscribeChallenge(
      attachedRoomId,
      (roomDoc) => {
        if (!roomDoc) {
          setAttachedRoomChallenge(null);
          setAttachedRoomId(null);
          return;
        }
        setAttachedRoomChallenge(roomDoc);
      },
      (err) => {
        console.warn('Real-time attached room onSnapshot error:', err);
      }
    );

    return () => unsubscribe();
  }, [attachedRoomId, activeChallengeId, activeChallenge, user]);

  // The active room for Peer Arena is the joined room, or the user's personal active challenge
  const roomChallenge = attachedRoomChallenge || activeChallenge;

  // Stable set of participant uids (sorted, comma-joined)
  const participantUids = useMemo(() => {
    if (!roomChallenge?.participants) return '';
    const uids = Array.from(
      new Set(
        roomChallenge.participants
          .map((p) => p.uid)
          .filter((uid): uid is string => Boolean(uid))
      )
    );
    return uids.sort().join(',');
  }, [roomChallenge?.participants]);

  // Real-Time onSnapshot Listener for all Room Challenge Members' personal progress
  useEffect(() => {
    const currentUids = participantUids ? participantUids.split(',').filter(Boolean) : [];
    const currentUidSet = new Set(currentUids);

    // Clear memberProgressMap entries that are not in the current participant set
    setMemberProgressMap((prev) => {
      const next: Record<string, UserProgressDoc | null> = {};
      for (const [uid, doc] of Object.entries(prev)) {
        if (currentUidSet.has(uid)) {
          next[uid] = doc;
        }
      }
      return next;
    });

    if (currentUids.length === 0) {
      return;
    }

    const unsubs: (() => void)[] = [];

    for (const uid of currentUids) {
      const unsub = subscribeMemberProgress(
        uid,
        (doc) => {
          setMemberProgressMap((prev) => ({
            ...prev,
            [uid]: doc,
          }));
        },
        (err) => {
          console.warn(`Failed to subscribe to member progress for ${uid}:`, err);
        }
      );
      unsubs.push(unsub);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [participantUids]);

  // Sync tasks completion flags when userProgress updates
  useEffect(() => {
    setTasks((prevTasks) =>
      prevTasks.map((t) => {
        const prog = userProgress[t.id] || { theory: false, practice: false };
        const theoryCompleted = Boolean(prog.theory);
        const practiceCompleted = Boolean(prog.practice);
        const isCompleted = theoryCompleted && practiceCompleted;

        // Completed tasks (theory && practice) are never locked
        const nextLocked = isCompleted ? false : t.isLocked;
        const nextLockReason = isCompleted ? undefined : t.lockReason;

        if (
          t.theoryCompleted === theoryCompleted &&
          t.practiceCompleted === practiceCompleted &&
          t.isLocked === nextLocked &&
          t.lockReason === nextLockReason
        ) {
          return t;
        }
        return {
          ...t,
          theoryCompleted,
          practiceCompleted,
          isLocked: nextLocked,
          lockReason: nextLockReason,
        };
      })
    );
  }, [userProgress]);

  // Time-based task locking logic (day-aware expiration)
  useEffect(() => {
    if (!activeChallenge || !activeChallenge.start_date) return;
    const allocatedDayMap = getTopicAllocatedDayMap(activeChallenge);

    setTasks((prevTasks) => {
      let hasChanges = false;
      const nextTasks = prevTasks.map((task) => {
        const isCompleted = task.theoryCompleted && task.practiceCompleted;
        const allocatedDay =
          allocatedDayMap.get(task.id) ||
          activeChallenge.duration ||
          7;
        const cutoffMs = getMidnightEndOfDay(activeChallenge.start_date, allocatedDay);
        const hasExpired = !isNaN(cutoffMs) && currentTime > cutoffMs;

        const nextLocked = hasExpired && !isCompleted;
        const nextLockReason = hasExpired
          ? (task.lockReason || 'Locked: 24-hour study completion window expired')
          : undefined;

        if (task.isLocked !== nextLocked || task.lockReason !== nextLockReason) {
          hasChanges = true;
          return {
            ...task,
            isLocked: nextLocked,
            lockReason: nextLockReason,
          };
        }
        return task;
      });

      return hasChanges ? nextTasks : prevTasks;
    });
  }, [currentTime, activeChallenge]);

  // Automatic midnight day-reset / rollover
  const isRollingOverRef = useRef(false);

  useEffect(() => {
    if (
      !user ||
      !activeChallenge ||
      activeChallenge.created_by !== user.uid ||
      !activeChallenge.day_wise_allocation ||
      !activeChallenge.start_date
    ) {
      return;
    }

    if (isRollingOverRef.current) return;

    const { updatedAllocation, hasChanges, carriedCount } = performMidnightRollover(
      activeChallenge,
      userProgressDoc,
      currentTime,
      user.uid
    );

    if (hasChanges) {
      isRollingOverRef.current = true;
      updateChallengeDayAllocation(
        activeChallenge.challenge_id,
        updatedAllocation,
        activeChallenge.start_date
      )
        .then(() => {
          if (carriedCount > 0) {
            triggerToast(
              `${carriedCount} unfinished topic${carriedCount > 1 ? 's' : ''} carried over to today.`
            );
          }
        })
        .catch((err) => {
          console.error('Failed to auto-save midnight rollover:', err);
        })
        .finally(() => {
          isRollingOverRef.current = false;
        });
    }
  }, [activeChallenge, userProgressDoc, currentTime, user]);

  // Helper to verify if a task is persisted in the active challenge
  const isTaskPersisted = (taskId: string): boolean => {
    if (!activeChallenge) return false;
    if (activeChallenge.selected_syllabus?.some((s) => s.id === taskId)) return true;
    if (activeChallenge.day_wise_allocation) {
      for (const cards of Object.values(activeChallenge.day_wise_allocation)) {
        if (Array.isArray(cards)) {
          for (const card of cards as any[]) {
            if (!card) continue;
            if (card.id === taskId || card.id === `card-${taskId}`) return true;
            if (Array.isArray(card.topics) && card.topics.some((t: any) => t && t.id === taskId)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  };

  // Instantly update Firestore document on Theory or Practice toggle
  const toggleDashboardTheory = async (taskId: string) => {
    if (!user || !activeChallenge) return;
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask || targetTask.isLocked || !isTaskPersisted(taskId)) return;

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, theoryCompleted: !t.theoryCompleted } : t))
    );
    setUserProgress((prev) => {
      const current = prev[taskId] || { theory: false, practice: false };
      return {
        ...prev,
        [taskId]: { ...current, theory: !current.theory },
      };
    });

    try {
      await toggleUserTopicProgress(user.uid, taskId, 'theory');
    } catch (err) {
      console.error('Failed to sync theory toggle to Firestore:', err);
      // Functional rollback
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, theoryCompleted: !t.theoryCompleted } : t))
      );
      setUserProgress((prev) => {
        const current = prev[taskId] || { theory: false, practice: false };
        return {
          ...prev,
          [taskId]: { ...current, theory: !current.theory },
        };
      });
      triggerToast('Sync failed. Please check your connection.');
    }
  };

  const toggleDashboardPractice = async (taskId: string) => {
    if (!user || !activeChallenge) return;
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask || targetTask.isLocked || !isTaskPersisted(taskId)) return;

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, practiceCompleted: !t.practiceCompleted } : t))
    );
    setUserProgress((prev) => {
      const current = prev[taskId] || { theory: false, practice: false };
      return {
        ...prev,
        [taskId]: { ...current, practice: !current.practice },
      };
    });

    try {
      await toggleUserTopicProgress(user.uid, taskId, 'practice');
    } catch (err) {
      console.error('Failed to sync practice toggle to Firestore:', err);
      // Functional rollback
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, practiceCompleted: !t.practiceCompleted } : t))
      );
      setUserProgress((prev) => {
        const current = prev[taskId] || { theory: false, practice: false };
        return {
          ...prev,
          [taskId]: { ...current, practice: !current.practice },
        };
      });
      triggerToast('Sync failed. Please check your connection.');
    }
  };

  // HSC Syllabus Toggles (Now persisted to Firestore)
  const toggleHSCTheory = async (_subjectId: string, _chapterId: string, topicId: string) => {
    if (!user) return;

    // Optimistic update
    setUserProgress((prev) => {
      const current = prev[topicId] || { theory: false, practice: false };
      return {
        ...prev,
        [topicId]: { ...current, theory: !current.theory },
      };
    });

    // Also update tasks if the topic is in the active challenge
    setTasks((prev) =>
      prev.map((t) => (t.id === topicId ? { ...t, theoryCompleted: !t.theoryCompleted } : t))
    );

    try {
      await toggleUserTopicProgress(user.uid, topicId, 'theory');
    } catch (err) {
      console.error('Failed to toggle HSC theory:', err);
      // Functional rollback
      setUserProgress((prev) => {
        const current = prev[topicId] || { theory: false, practice: false };
        return {
          ...prev,
          [topicId]: { ...current, theory: !current.theory },
        };
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === topicId ? { ...t, theoryCompleted: !t.theoryCompleted } : t))
      );
      triggerToast('Failed to save progress.');
    }
  };

  const toggleHSCPractice = async (_subjectId: string, _chapterId: string, topicId: string) => {
    if (!user) return;

    // Optimistic update
    setUserProgress((prev) => {
      const current = prev[topicId] || { theory: false, practice: false };
      return {
        ...prev,
        [topicId]: { ...current, practice: !current.practice },
      };
    });

    // Also update tasks if the topic is in the active challenge
    setTasks((prev) =>
      prev.map((t) => (t.id === topicId ? { ...t, practiceCompleted: !t.practiceCompleted } : t))
    );

    try {
      await toggleUserTopicProgress(user.uid, topicId, 'practice');
    } catch (err) {
      console.error('Failed to toggle HSC practice:', err);
      // Functional rollback
      setUserProgress((prev) => {
        const current = prev[topicId] || { theory: false, practice: false };
        return {
          ...prev,
          [topicId]: { ...current, practice: !current.practice },
        };
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === topicId ? { ...t, practiceCompleted: !t.practiceCompleted } : t))
      );
      triggerToast('Failed to save progress.');
    }
  };

  const setChapterProgress = async (
    subjectId: string,
    chapterId: string,
    type: 'theory' | 'practice',
    done: boolean
  ) => {
    if (!user) return;

    const subject = hscMasterSyllabus.find((s) => s.id === subjectId);
    const chapter = subject?.chapters.find((c) => c.id === chapterId);
    if (!chapter) return;

    const topicIds = chapter.topics.map((t) => t.id);
    if (topicIds.length === 0) return;

    // Build the updates object and capture previous state of target topics
    const previousTopicStates: Record<string, boolean> = {};
    const batchUpdates: Record<string, { theory: boolean; practice: boolean }> = {};
    topicIds.forEach((topicId) => {
      const current = userProgress[topicId] || { theory: false, practice: false };
      previousTopicStates[topicId] = Boolean(current[type]);
      batchUpdates[topicId] = {
        ...current,
        [type]: done,
      };
    });

    // Optimistic local state update
    setUserProgress((prev) => {
      const next = { ...prev };
      topicIds.forEach((topicId) => {
        const current = prev[topicId] || { theory: false, practice: false };
        next[topicId] = {
          ...current,
          [type]: done,
        };
      });
      return next;
    });

    // Update tasks state
    setTasks((prev) =>
      prev.map((t) => {
        if (topicIds.includes(t.id)) {
          return {
            ...t,
            [type === 'theory' ? 'theoryCompleted' : 'practiceCompleted']: done,
          };
        }
        return t;
      })
    );

    try {
      await setUserTopicProgressBatch(user.uid, batchUpdates);
    } catch (err) {
      console.error('Failed to set chapter progress batch:', err);
      // Functional rollback for only the specific topics touched by this call
      setUserProgress((prev) => {
        const next = { ...prev };
        topicIds.forEach((topicId) => {
          const current = prev[topicId] || { theory: false, practice: false };
          next[topicId] = {
            ...current,
            [type]: previousTopicStates[topicId] ?? !done,
          };
        });
        return next;
      });
      setTasks((prev) =>
        prev.map((t) => {
          if (topicIds.includes(t.id)) {
            return {
              ...t,
              [type === 'theory' ? 'theoryCompleted' : 'practiceCompleted']:
                previousTopicStates[t.id] ?? !done,
            };
          }
          return t;
        })
      );
      triggerToast('Failed to sync chapter progress. Please try again.');
    }
  };

  const addDashboardTopic = (newTask: Omit<Task, 'id' | 'isLocked'>) => {
    if (!user || !activeChallenge) return;

    const currentSprintDay = computeCurrentSprintDay(
      activeChallenge.start_date,
      activeChallenge.duration,
      currentTime
    );
    const dayKey = `Day ${currentSprintDay}`;
    const id = (newTask as any).id || `topic-${Date.now()}`;

    const newTopic = {
      id,
      title: newTask.title,
      subconcept: newTask.description || `${newTask.subject} session`,
      durationMinutes: newTask.durationMinutes || 45,
      subject: newTask.subject,
      theoryCompleted: false,
      practiceCompleted: false,
      isPriority: Boolean(newTask.isPriority),
    };

    const newCard = {
      id,
      title: newTask.title,
      subconcept: newTask.description || `${newTask.subject} session`,
      durationMinutes: newTask.durationMinutes || 45,
      subject: newTask.subject,
      topics: [newTopic],
    };

    const currentAllocation: Record<string, unknown[]> = {
      ...(activeChallenge.day_wise_allocation || {}),
    };
    const todayCards = Array.isArray(currentAllocation[dayKey])
      ? [...currentAllocation[dayKey]]
      : [];
    todayCards.push(newCard);
    currentAllocation[dayKey] = todayCards;

    const task: Task = {
      ...newTask,
      id,
      isLocked: false,
      createdAt: Date.now(),
    };
    setTasks((prev) => [task, ...prev]);
    setActiveChallengeState({
      ...activeChallenge,
      day_wise_allocation: currentAllocation,
    });

    updateChallengeDayAllocation(
      activeChallenge.challenge_id,
      currentAllocation,
      activeChallenge.start_date
    )
      .then(() => {
        triggerToast(`Added topic: "${task.title}"`);
      })
      .catch((err) => {
        console.error('Failed to persist added topic to challenge:', err);
        setTasks((prev) => prev.filter((t) => t.id !== id));
        setActiveChallengeState(activeChallenge);
        triggerToast('Failed to save topic to challenge.');
      });
  };

  // Join Challenge by Code (Room membership only - does NOT rewrite personal dashboard display source)
  const joinChallengeCode = async (code: string): Promise<boolean> => {
    if (!user) return false;
    const cleanCode = code.toUpperCase().trim();
    try {
      const challengeDoc = await findChallengeByCode(cleanCode);
      if (!challengeDoc) {
        triggerToast(`No challenge found with code: ${cleanCode}`);
        return false;
      }

      if (!isChallengeActive(challengeDoc)) {
        triggerToast(`This challenge has ended.`);
        return false;
      }

      const currentRoomId = attachedRoomId || attachedRoomChallenge?.challenge_id;
      if (currentRoomId && currentRoomId !== challengeDoc.challenge_id) {
        const currentRoomName = attachedRoomChallenge?.challenge_name || 'another challenge';
        const targetRoomName = challengeDoc.challenge_name || cleanCode;
        const confirmed = window.confirm(
          `You are currently participating in "${currentRoomName}". Do you want to switch your Peer Arena membership to "${targetRoomName}"?`
        );
        if (!confirmed) return false;
      }

      await joinFirestoreChallenge(challengeDoc.challenge_id, {
        uid: user.uid,
        name: user.name,
        email: user.email,
        photoURL: user.photoURL,
      });

      await addJoinedChallengeId(user.uid, challengeDoc.challenge_id);

      const hasPersonalActiveChallenge = Boolean(
        activeChallenge ? isChallengeActive(activeChallenge) : (activeChallengeId || activeChallengeIdRef.current)
      );

      // Only set as active challenge if user has no active personal challenge
      if (!hasPersonalActiveChallenge) {
        // Persist the change to user_progress FIRST (await the write)
        await updateActiveChallengeId(user.uid, challengeDoc.challenge_id);

        // Settle path / fallback: update local state after write resolves so stale snapshot cannot revert
        if (activeChallengeIdRef.current !== challengeDoc.challenge_id) {
          setActiveChallengeId(challengeDoc.challenge_id);
          localStorage.setItem(getActiveChallengeStorageKey(user.uid), challengeDoc.challenge_id);
        }
      }

      setAttachedRoomId(challengeDoc.challenge_id);
      setAttachedRoomChallenge(challengeDoc);

      triggerToast(`Successfully joined Challenge: ${cleanCode}!`);
      return true;
    } catch {
      triggerToast(`Failed to join challenge ${cleanCode}.`);
      return false;
    }
  };

  const setActiveChallenge = async (newChallenge: FirestoreChallenge) => {
    if (user) {
      try {
        await updateActiveChallengeId(user.uid, newChallenge.challenge_id);
      } catch (err) {
        console.error('Failed to persist active challenge ID to user profile:', err);
      }
    }
    setActiveChallengeId(newChallenge.challenge_id);
    setActiveChallengeState(newChallenge);
    setAttachedRoomId(null);
    setAttachedRoomChallenge(null);
    if (user) {
      localStorage.setItem(getActiveChallengeStorageKey(user.uid), newChallenge.challenge_id);
    }
  };

  // Main Dashboard Calculations
  const totalTodayTopics = tasks.length;
  const completedTheory = tasks.filter((t) => t.theoryCompleted).length;
  const completedPractice = tasks.filter((t) => t.practiceCompleted).length;
  const completedUnits = completedTheory + completedPractice;
  const totalUnits = totalTodayTopics * 2;
  const todayCompletionPercentage = totalUnits > 0 ? (completedUnits / totalUnits) * 100 : 0;
  const completedTopicsCount = tasks.filter((t) => t.theoryCompleted && t.practiceCompleted).length;

  // Real Weekly stats computed from full sprint syllabus tasks
  const allSprintTasks: Task[] = useMemo(() => {
    if (!activeChallenge) return tasks;
    const deduped = dedupeSyllabusTopics(activeChallenge.selected_syllabus || []);
    if (deduped.length === 0) return tasks;
    return deduped.map((top, idx) => {
      const prog = userProgress[top.id] || { theory: false, practice: false };
      const rawSubject = (top.subject || '').trim();
      const sLower = rawSubject.toLowerCase();
      let sub = top.subject || rawSubject;
      if (sLower.startsWith('phys') || sLower.includes('ফিজিক্স')) sub = 'Physics';
      else if (sLower.startsWith('chem') || sLower.includes('কেমিস্ট্রি')) sub = 'Chemistry';
      else if (sLower.startsWith('math') || sLower.includes('গণিত')) sub = 'Math';
      else if (sLower.startsWith('bio') || sLower.includes('জীব')) sub = 'Biology';
      else if (sLower.startsWith('bang') || sLower.includes('বাংলা')) sub = 'Bangla';
      else if (sLower.startsWith('eng') || sLower.includes('ইংরেজি')) sub = 'English';
      else if (sLower.startsWith('ict') || sLower.includes('তথ্য')) sub = 'ICT';

      return {
        id: top.id || `sprint-${idx + 1}`,
        subject: sub,
        title: top.title,
        description: top.subconcept || `${top.subject || sub} core problem set`,
        durationMinutes: top.durationMinutes || 45,
        theoryCompleted: Boolean(prog.theory),
        practiceCompleted: Boolean(prog.practice),
        createdAt: new Date(activeChallenge.start_date).getTime() || Date.now(),
        isLocked: false,
      };
    });
  }, [activeChallenge, userProgress, tasks]);

  // Real Weekly stats computed from full sprint challenge tasks
  const weeklyStats: SubjectWeeklyStat[] = useMemo(() => {
    return computeSubjectWeeklyStats(allSprintTasks.length > 0 ? allSprintTasks : tasks);
  }, [allSprintTasks, tasks]);

  // Real Streak calculated from real completion events
  const streakDays = useMemo(() => {
    return computeStreakDays(userProgressDoc?.completionLog, Date.now());
  }, [userProgressDoc]);

  // Set of daily active date keys (local YYYY-MM-DD keys)
  const dailyActiveDateKeys = useMemo(() => {
    return getDailyActiveDateKeys(userProgressDoc?.completionLog);
  }, [userProgressDoc]);

  // Real Active Sprint state computed from active challenge
  const sprint: ActiveSprint = useMemo(() => {
    return computeSprint(activeChallenge, Date.now());
  }, [activeChallenge]);

  // Real Weekly Backlog computed from remaining challenge tasks
  const backlog: WeeklyBacklog = useMemo(() => {
    return computeBacklog(activeChallenge, Date.now());
  }, [activeChallenge]);

  // HSC Summary Math
  const hscSummary: HSCProgressSummary = useMemo(() => {
    const allTopics = hscMasterSyllabus.flatMap((s) => s.chapters.flatMap((c) => c.topics));
    const allChapters = hscMasterSyllabus.flatMap((s) => s.chapters);

    const totalTopics = allTopics.length;
    const completedTheoryCount = allTopics.filter((t) => t.is_theory_done).length;
    const completedPracticeCount = allTopics.filter((t) => t.is_practice_done).length;

    const grandProgressPercent = computeOverallPercent(allTopics);
    const overallTheoryPercent = totalTopics > 0 ? (completedTheoryCount / totalTopics) * 100 : 0;
    const overallPracticePercent = totalTopics > 0 ? (completedPracticeCount / totalTopics) * 100 : 0;

    const completedTopics = allTopics.filter((t) => t.is_theory_done && t.is_practice_done).length;
    const totalChapters = allChapters.length;
    const completedChapters = allChapters.filter((c) =>
      c.topics.every((t) => t.is_theory_done && t.is_practice_done)
    ).length;

    return {
      grandProgressPercent,
      overallTheoryPercent,
      overallPracticePercent,
      totalTopics,
      completedTopicsCount: completedTopics,
      completedTheoryCount,
      completedPracticeCount,
      totalChapters,
      completedChaptersCount: completedChapters,
      totalMCQs: allTopics.reduce((sum, t) => sum + t.mcqTotal, 0),
      completedMCQs: allTopics.reduce((sum, t) => sum + t.mcqDone, 0),
      totalCQs: allTopics.reduce((sum, t) => sum + t.cqTarget, 0),
      completedCQs: allTopics.reduce((sum, t) => sum + t.cqDone, 0),
    };
  }, [hscMasterSyllabus]);

  // Real-Time Peer Arena Leaderboard from ONLY real Firestore Participants
  const peers: PeerContender[] = useMemo(() => {
    const targetChallenge = roomChallenge;
    if (!targetChallenge || !targetChallenge.participants) return [];

    const rawSyllabus = targetChallenge.selected_syllabus || [];
    const dedupedSyllabus = dedupeSyllabusTopics(rawSyllabus);
    const totalSyllabusTopics = dedupedSyllabus.length || 1;
    const startDate = new Date(targetChallenge.start_date).getTime();
    const elapsedDays = Math.max(1, (Date.now() - startDate) / (1000 * 60 * 60 * 24));

    return targetChallenge.participants.map((p) => {
      const isCurrentUser = p.uid === user?.uid;
      const liveDoc = memberProgressMap[p.uid];

      let completedTopics: number;
      let progressMap: Record<string, UserTopicProgress>;
      let totalChallengeTopics: number = totalSyllabusTopics;

      if (liveDoc && liveDoc.topicProgress) {
        // Overlay live doc
        progressMap = {};
        for (const top of dedupedSyllabus) {
          if (liveDoc.topicProgress[top.id]) {
            progressMap[top.id] = liveDoc.topicProgress[top.id];
          }
        }
        completedTopics = dedupedSyllabus.filter((top) => {
          const tp = liveDoc.topicProgress[top.id];
          return tp && tp.theory && tp.practice;
        }).length;
      } else {
        // Fall back to stored participant fields with consistent deduped denominator
        progressMap = p.topic_progress || {};
        completedTopics = dedupedSyllabus.filter((top) => {
          const tp = progressMap[top.id];
          return tp && tp.theory && tp.practice;
        }).length;
        totalChallengeTopics = totalSyllabusTopics;
      }

      // Determine active focus from first unfinished topic
      const firstIncomplete = dedupedSyllabus.find((top) => {
        const prog = progressMap[top.id];
        return !prog || !prog.theory || !prog.practice;
      });

      const activeFocus = firstIncomplete
        ? `${firstIncomplete.subject}: ${firstIncomplete.title}`
        : 'Sprint Completed';

      const velocity = Number((completedTopics / elapsedDays).toFixed(1));

      // Derive peer completionLog (for current user, use local ref/doc; for other members, use liveDoc)
      const peerLog = isCurrentUser
        ? (completionLogRef.current || userProgressDoc?.completionLog)
        : liveDoc?.completionLog;

      let earliestActualCompletion: number | null = null;
      if (peerLog) {
        for (const entry of Object.values(peerLog)) {
          if (entry) {
            if (typeof entry.theory === 'number' && entry.theory > 0) {
              if (earliestActualCompletion === null || entry.theory < earliestActualCompletion) {
                earliestActualCompletion = entry.theory;
              }
            }
            if (typeof entry.practice === 'number' && entry.practice > 0) {
              if (earliestActualCompletion === null || entry.practice < earliestActualCompletion) {
                earliestActualCompletion = entry.practice;
              }
            }
          }
        }
      }

      const effectiveCompletionTimestamp =
        earliestActualCompletion !== null
          ? earliestActualCompletion
          : (p.last_completion_timestamp || 0);

      const peerStreak = peerLog ? computeStreakDays(peerLog, Date.now()) : 0;

      return {
        id: p.uid,
        uid: p.uid,
        name: p.name || 'Student',
        email: p.email,
        photoURL: p.photoURL,
        cohort: targetChallenge.code ? `Room ${targetChallenge.code}` : 'HSC Sprint',
        avatarUrl: p.photoURL || '',
        activeFocus,
        completed_topics: completedTopics,
        total_challenge_topics: totalChallengeTopics,
        last_completion_timestamp: effectiveCompletionTimestamp,
        earliest_completion_timestamp: effectiveCompletionTimestamp,
        topic_progress: progressMap,
        velocityPerDay: Math.max(0, velocity),
        streakDays: peerStreak,
        rankTrend: 0,
        isCurrentUser,
        isSquad: true,
      };
    });
  }, [roomChallenge, user, memberProgressMap, userProgressDoc]);

  // Peer Arena Sorting Algorithm & Tie-Breaker Math
  const sortedPeers = useMemo(() => {
    const listWithScore = peers.map((peer) => {
      const totalTopics = peer.total_challenge_topics || 1;
      const scorePercent = totalTopics > 0 ? (peer.completed_topics / totalTopics) * 100 : 0;
      return {
        ...peer,
        scorePercent,
      };
    });

    listWithScore.sort((a, b) => {
      if (Math.abs(b.scorePercent - a.scorePercent) > 0.0001) {
        return b.scorePercent - a.scorePercent;
      }
      const aTime = a.earliest_completion_timestamp ?? a.last_completion_timestamp;
      const bTime = b.earliest_completion_timestamp ?? b.last_completion_timestamp;
      return aTime - bTime;
    });

    return listWithScore.map((peer, index) => ({
      ...peer,
      rank: index + 1,
    }));
  }, [peers]);

  // Active Challenge representation
  const challenge: ActiveSprintChallenge = useMemo(() => {
    const targetChallenge = roomChallenge;
    const targetSprint = targetChallenge === activeChallenge ? sprint : computeSprint(targetChallenge, Date.now());
    return {
      title: targetChallenge ? `${targetChallenge.duration}-Day Sprint Challenge` : 'No Active Sprint',
      cohortName: targetChallenge ? `Room ${targetChallenge.code}` : 'None',
      code: targetChallenge?.code || '',
      totalTopics: targetChallenge?.selected_syllabus?.length || 0,
      activePeersCount: targetChallenge?.participants?.length || 0,
      timeRemainingStr: targetChallenge ? `${targetSprint.daysLeft} Days Left` : 'N/A',
    };
  }, [roomChallenge, activeChallenge, sprint]);

  // Real-Time Weekly Snapshots Listener
  useEffect(() => {
    if (!user) {
      setWeeklySnapshots([]);
      return;
    }

    const weekKey = getIsoWeekKey(new Date());
    const unsubscribe = subscribeWeeklySnapshots(
      weekKey,
      (snapshots) => {
        setWeeklySnapshots(snapshots);
      },
      (err) => {
        console.error('Failed to subscribe to weekly snapshots:', err);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Automatic Weekly Snapshot Upsert
  useEffect(() => {
    if (!user) return;

    const timer = setTimeout(async () => {
      const weekKey = getIsoWeekKey(new Date());
      
      const snapshot: WeeklySnapshot = {
        uid: user.uid,
        weekKey,
        displayName: user.name || 'Student',
        photoURL: user.photoURL,
        activeChallengeId,
        activeChallengeCode: activeChallenge?.code,
        subjects: weeklyStats.map(s => ({
          subject: s.subject,
          done: s.done,
          total: s.total
        })),
        topicsCompleted: completedTopicsCount,
        totalPlanned: tasks.length,
        unitsCompleted: completedUnits,
        streakDays,
        updatedAt: new Date().toISOString()
      };

      // Shallow compare to avoid redundant writes
      const payloadString = JSON.stringify({
        ...snapshot,
        updatedAt: '' // ignore timestamp for comparison
      });

      if (payloadString !== lastSnapshotPayloadRef.current) {
        lastSnapshotPayloadRef.current = payloadString;
        try {
          await upsertMyWeeklySnapshot(snapshot);
        } catch (err) {
          console.error('Failed to upsert weekly snapshot:', err);
        }
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    user,
    activeChallengeId,
    activeChallenge?.code,
    weeklyStats,
    completedTopicsCount,
    tasks.length,
    completedUnits,
    streakDays
  ]);

  // Reset active challenge (wipe personal DB progress for sprint scope)
  const resettingRef = useRef(false);
  const resetActiveChallenge = async () => {
    if (resettingRef.current) return;
    if (!user || !activeChallenge) return;

    resettingRef.current = true;
    try {
      const deduped = dedupeSyllabusTopics(activeChallenge.selected_syllabus || []);
      const topicIds = deduped.map((t) => t.id);

      await resetTopicsProgress(user.uid, topicIds);

      triggerToast('Challenge progress reset.');
    } catch (err) {
      console.error('Failed to reset active challenge:', err);
      triggerToast('Failed to reset challenge. Please try again.');
    } finally {
      resettingRef.current = false;
    }
  };

  // Archive active personal challenge
  const archiveActiveChallenge = async () => {
    if (!user || !activeChallenge) return;
    try {
      await archiveChallenge(activeChallenge.challenge_id);
      await updateActiveChallengeId(user.uid, null);
      if (attachedRoomId === activeChallenge.challenge_id) {
        setAttachedRoomId(null);
        setAttachedRoomChallenge(null);
      }
      setActiveChallengeId(null);
      setActiveChallengeState(null);
      setTasks([]);
      localStorage.removeItem(getActiveChallengeStorageKey(user.uid));
      triggerToast('Sprint challenge archived.');
    } catch (err) {
      console.error('Failed to archive challenge:', err);
      triggerToast('Failed to archive challenge. Please try again.');
    }
  };

  const toggleHideSubject = async (subjectId: string) => {
    if (!user) return;
    const isCurrentlyHidden = hiddenSubjectIds.includes(subjectId);
    const next = isCurrentlyHidden
      ? hiddenSubjectIds.filter((id) => id !== subjectId)
      : [...hiddenSubjectIds, subjectId];
    setHiddenSubjectIds(next);

    try {
      await toggleHideSubjectService(user.uid, subjectId);
      triggerToast(isCurrentlyHidden ? 'Subject unhidden.' : 'Subject hidden from your view.');
    } catch (err) {
      console.error('Failed to toggle hide subject:', err);
      setHiddenSubjectIds(hiddenSubjectIds);
      triggerToast('Failed to update hidden subject preference.');
    }
  };

  const setHiddenSubjects = async (subjectIds: string[]) => {
    if (!user) return;
    const prev = [...hiddenSubjectIds];
    setHiddenSubjectIds(subjectIds);

    try {
      await setHiddenSubjectIdsService(user.uid, subjectIds);
      triggerToast('Subject visibility updated.');
    } catch (err) {
      console.error('Failed to set hidden subjects:', err);
      setHiddenSubjectIds(prev);
      triggerToast('Failed to update hidden subjects.');
    }
  };

  // Delete active personal challenge
  const deleteActiveChallenge = async () => {
    if (!user || !activeChallenge) return;
    try {
      await deleteFirestoreChallenge(activeChallenge.challenge_id);
      await updateActiveChallengeId(user.uid, null);
      if (attachedRoomId === activeChallenge.challenge_id) {
        setAttachedRoomId(null);
        setAttachedRoomChallenge(null);
      }
      setActiveChallengeId(null);
      setActiveChallengeState(null);
      setTasks([]);
      localStorage.removeItem(getActiveChallengeStorageKey(user.uid));
      triggerToast('Sprint challenge deleted.');
    } catch (err) {
      console.error('Failed to delete challenge:', err);
      triggerToast('Failed to delete challenge. Please try again.');
    }
  };

  return (
    <StudyTrackContext.Provider
      value={{
        tasks,
        weeklyStats,
        backlog,
        sprint,
        streakDays,
        dailyActiveDateKeys,
        currentTime,
        todayCompletionPercentage,
        completedUnits,
        totalUnits,
        completedTopicsCount,
        hscMasterSyllabus,
        hscSummary,
        hiddenSubjectIds,
        toggleHideSubject,
        setHiddenSubjects,
        activeChallenge,
        activeChallengeId,
        challenge,
        peers,
        sortedPeers,
        memberProgressMap,
        weeklySnapshots,
        toggleDashboardTheory,
        toggleDashboardPractice,
        toggleHSCTheory,
        toggleHSCPractice,
        setChapterProgress,
        addDashboardTopic,
        joinChallengeCode,
        setActiveChallenge,
        resetActiveChallenge,
        archiveActiveChallenge,
        deleteActiveChallenge,
        triggerToast,
        toastMessage,
        clearToast,
      }}
    >
      {children}
    </StudyTrackContext.Provider>
  );
};

export const useStudyTrack = () => {
  const context = useContext(StudyTrackContext);
  if (!context) {
    throw new Error('useStudyTrack must be used within a StudyTrackProvider');
  }
  return context;
};
