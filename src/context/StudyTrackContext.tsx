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
import { INITIAL_HSC_MASTER_SYLLABUS, convertMasterToHSC } from '../data/hscMasterSyllabus';
import { subscribeMasterSyllabus } from '../services/syllabusService';
import {
  joinFirestoreChallenge,
  findChallengeByCode,
  toggleTopicProgressInChallenge,
  subscribeChallenge,
  isChallengeActive,
} from '../services/challengeService';
import { dedupeSyllabusTopics } from '../utils/challengeLogic';
import {
  subscribeUserProgress,
  toggleUserTopicProgress,
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
} from '../lib/progressMath';

interface StudyTrackContextType {
  // Main Dashboard State
  tasks: Task[];
  weeklyStats: SubjectWeeklyStat[];
  backlog: WeeklyBacklog;
  sprint: ActiveSprint;
  streakDays: number;
  currentTime: number;
  todayCompletionPercentage: number;
  completedUnits: number;
  totalUnits: number;
  completedTopicsCount: number;

  // HSC Grand Progress State
  hscMasterSyllabus: HSCSubject[];
  hscSummary: HSCProgressSummary;

  // Real-time Firestore Challenge & Peer Arena State
  activeChallenge: FirestoreChallenge | null;
  activeChallengeId: string | null;
  challenge: ActiveSprintChallenge;
  peers: PeerContender[];
  sortedPeers: (PeerContender & {
    scorePercent: number;
    rank: number;
  })[];
  weeklySnapshots: WeeklySnapshot[];

  // Action Dispatchers
  toggleDashboardTheory: (taskId: string) => Promise<void>;
  toggleDashboardPractice: (taskId: string) => Promise<void>;
  toggleHSCTheory: (subjectId: string, chapterId: string, topicId: string) => void;
  toggleHSCPractice: (subjectId: string, chapterId: string, topicId: string) => void;
  addDashboardTopic: (newTask: Omit<Task, 'id' | 'isLocked'>) => void;
  joinChallengeCode: (code: string) => Promise<boolean>;
  setActiveChallenge: (challenge: FirestoreChallenge) => void;
  triggerToast: (msg: string) => void;
  toastMessage: string | null;
  clearToast: () => void;
}

const StudyTrackContext = createContext<StudyTrackContextType | undefined>(undefined);

const ACTIVE_CHALLENGE_STORAGE_KEY = 'studytrack_active_challenge_id';

const HSC_CORE_SUBJECTS = [
  'Physics',
  'Chemistry',
  'Biology',
  'Math',
  'Bangla',
  'English',
  'ICT',
] as const;

function matchSubjectCategory(name: string): (typeof HSC_CORE_SUBJECTS)[number] | null {
  const n = (name || '').toLowerCase();
  if (n.includes('physics') || n.includes('ফিজিক্স')) return 'Physics';
  if (n.includes('chem') || n.includes('কেমিস্ট্রি')) return 'Chemistry';
  if (n.includes('bio') || n.includes('জীব')) return 'Biology';
  if (n.includes('math') || n.includes('ম্যাথ') || n.includes('গণিত') || n.includes('calc')) return 'Math';
  if (n.includes('bangla') || n.includes('বাংলা')) return 'Bangla';
  if (n.includes('english') || n.includes('ইংরেজি')) return 'English';
  if (n.includes('ict') || n.includes('তথ্য')) return 'ICT';
  return null;
}

export const StudyTrackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Active Challenge in Firestore (ID resolution: Firestore -> LocalState -> localStorage)
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null);
  const activeChallengeIdRef = useRef<string | null>(null);
  const [activeChallenge, setActiveChallengeState] = useState<FirestoreChallenge | null>(null);
  const isExpiringRef = useRef<string | null>(null);
  const [weeklySnapshots, setWeeklySnapshots] = useState<WeeklySnapshot[]>([]);
  const lastSnapshotPayloadRef = useRef<string>('');

  // Sync ref to state
  useEffect(() => {
    activeChallengeIdRef.current = activeChallengeId;
  }, [activeChallengeId]);

  // Boot-time optimistic cache (only once per user session)
  useEffect(() => {
    if (user && !activeChallengeId) {
      const cached = localStorage.getItem(ACTIVE_CHALLENGE_STORAGE_KEY);
      if (cached) setActiveChallengeId(cached);
    }
  }, [user]);

  // Per-user global HSC progress from Firestore
  const [userProgress, setUserProgress] = useState<Record<string, UserTopicProgress>>({});
  const [globalMasterSyllabus, setGlobalMasterSyllabus] = useState<MasterSubject[]>([]);

  // Real tasks from active challenge (empty by default if no active challenge)
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hscMasterSyllabus, setHscMasterSyllabus] =
    useState<HSCSubject[]>(INITIAL_HSC_MASTER_SYLLABUS);

  // Real-time clock for time-based locks (updates every 10s)
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const clearToast = () => setToastMessage(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Real-Time Firestore onSnapshot Listener for Master Syllabus
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeMasterSyllabus((masterSubs) => {
      if (masterSubs && masterSubs.length > 0) {
        setGlobalMasterSyllabus(masterSubs);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Real-Time Firestore onSnapshot Listener for User Progress
  useEffect(() => {
    if (!user) {
      setUserProgress({});
      setActiveChallengeId(null);
      localStorage.removeItem(ACTIVE_CHALLENGE_STORAGE_KEY);
      return;
    }

    const unsubscribe = subscribeUserProgress(
      user.uid,
      (progressDoc: UserProgressDoc | null) => {
        if (progressDoc) {
          setUserProgress(progressDoc.topicProgress || {});
          
          const fsId = progressDoc.activeChallengeId || null;
          // Single Source of Truth check using Ref to avoid stale closure
          if (fsId !== activeChallengeIdRef.current) {
            setActiveChallengeId(fsId);
            if (fsId) {
              localStorage.setItem(ACTIVE_CHALLENGE_STORAGE_KEY, fsId);
            } else {
              localStorage.removeItem(ACTIVE_CHALLENGE_STORAGE_KEY);
            }
          }
        } else {
          setUserProgress({});
          setActiveChallengeId(null);
          localStorage.removeItem(ACTIVE_CHALLENGE_STORAGE_KEY);
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
      localStorage.removeItem(ACTIVE_CHALLENGE_STORAGE_KEY);
      updateActiveChallengeId(user.uid, null).catch(console.error);
    } else {
      // If it IS active, clear the ref so we can catch the next one
      isExpiringRef.current = null;
    }
  }, [activeChallenge, user]);

  // Sync hscMasterSyllabus whenever global syllabus or user progress changes
  useEffect(() => {
    if (globalMasterSyllabus.length > 0) {
      setHscMasterSyllabus(convertMasterToHSC(globalMasterSyllabus, userProgress));
    }
  }, [globalMasterSyllabus, userProgress]);

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
          localStorage.removeItem(ACTIVE_CHALLENGE_STORAGE_KEY);
          setActiveChallengeId(null);
          return;
        }

        setActiveChallengeState(challengeDoc);

        // Map challenge topics & current user's progress into Main Dashboard tasks
        // REQUIREMENT 5: Use ONLY current user's participant record, no fallback
        const currentUserParticipant = challengeDoc.participants.find((p) => p.uid === user.uid);
        const userTopicProgress = currentUserParticipant?.topic_progress || {};
        
        const challengeCreatedAt = new Date(challengeDoc.start_date).getTime() || Date.now();

        // STEP 2 - Apply dedupeSyllabusTopics before mapping
        const rawSyllabus = challengeDoc.selected_syllabus || [];
        const dedupedSyllabus = dedupeSyllabusTopics(rawSyllabus);

        const mappedTasks: Task[] = dedupedSyllabus.map((top, idx) => {
          const prog = userTopicProgress[top.id] || { theory: false, practice: false };

          // Replace hardcoded substring guessing with exact/prefix matching
          const subjectStr = top.subject || 'Physics';
          const sLower = subjectStr.toLowerCase().trim();
          
          let sub: string = subjectStr;
          if (sLower.startsWith('phys') || sLower.includes('ফিজিক্স')) sub = 'Physics';
          else if (sLower.startsWith('chem') || sLower.includes('কেমিস্ট্রি')) sub = 'Chemistry';
          else if (sLower.startsWith('math') || sLower.includes('গণিত')) sub = 'Math';
          else if (sLower.startsWith('bio') || sLower.includes('জীব')) sub = 'Biology';
          else if (sLower.startsWith('bang') || sLower.includes('বাংলা')) sub = 'Bangla';
          else if (sLower.startsWith('eng') || sLower.includes('ইংরেজি')) sub = 'English';
          else if (sLower.startsWith('ict') || sLower.includes('তথ্য')) sub = 'ICT';

          const timeElapsed = Date.now() - challengeCreatedAt;
          const isExpired = timeElapsed >= 24 * 60 * 60 * 1000;

          return {
            id: top.id || `task-${idx + 1}`,
            subject: sub,
            title: top.title,
            description: top.subconcept || `${top.subject} core problem set and fundamentals`,
            durationMinutes: top.durationMinutes || 45,
            theoryCompleted: Boolean(prog.theory),
            practiceCompleted: Boolean(prog.practice),
            createdAt: challengeCreatedAt,
            isLocked: isExpired && !(prog.theory && prog.practice),
            lockReason: isExpired ? 'Locked: 24-hour study completion window expired' : undefined,
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
          localStorage.removeItem(ACTIVE_CHALLENGE_STORAGE_KEY);
        }
      }
    );

    return () => unsubscribe();
  }, [activeChallengeId, user]);

  // Time-based task locking logic (24h expiration from createdAt)
  useEffect(() => {
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    setTasks((prevTasks) =>
      prevTasks.map((task) => {
        const timeElapsed = currentTime - task.createdAt;
        const hasExpired = timeElapsed >= TWENTY_FOUR_HOURS_MS;
        if (hasExpired && !task.isLocked && !(task.theoryCompleted && task.practiceCompleted)) {
          return {
            ...task,
            isLocked: true,
            lockReason: task.lockReason || 'Locked: 24-hour study completion window expired',
          };
        }
        return task;
      })
    );
  }, [currentTime]);

  // Instantly update Firestore document on Theory or Practice toggle
  const toggleDashboardTheory = async (taskId: string) => {
    if (!user) return;
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask || targetTask.isLocked) return;

    // Optimistic UI update
    const prevTasks = [...tasks];
    const prevUserProgress = { ...userProgress };

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

    const promises = [];
    if (activeChallengeId) {
      promises.push(toggleTopicProgressInChallenge(activeChallengeId, user.uid, taskId, 'theory'));
    }
    promises.push(toggleUserTopicProgress(user.uid, taskId, 'theory'));

    try {
      await Promise.all(promises);
    } catch (err) {
      console.error('Failed to sync theory toggle to Firestore:', err);
      // Rollback
      setTasks(prevTasks);
      setUserProgress(prevUserProgress);
      triggerToast('Sync failed. Please check your connection.');
    }
  };

  const toggleDashboardPractice = async (taskId: string) => {
    if (!user) return;
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask || targetTask.isLocked) return;

    // Optimistic UI update
    const prevTasks = [...tasks];
    const prevUserProgress = { ...userProgress };

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

    const promises = [];
    if (activeChallengeId) {
      promises.push(toggleTopicProgressInChallenge(activeChallengeId, user.uid, taskId, 'practice'));
    }
    promises.push(toggleUserTopicProgress(user.uid, taskId, 'practice'));

    try {
      await Promise.all(promises);
    } catch (err) {
      console.error('Failed to sync practice toggle to Firestore:', err);
      // Rollback
      setTasks(prevTasks);
      setUserProgress(prevUserProgress);
      triggerToast('Sync failed. Please check your connection.');
    }
  };

  // HSC Syllabus Toggles (Now persisted to Firestore)
  const toggleHSCTheory = async (subjectId: string, chapterId: string, topicId: string) => {
    if (!user) return;

    // Optimistic update
    const prevUserProgress = { ...userProgress };
    const prevTasks = [...tasks];

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

    const promises = [];
    promises.push(toggleUserTopicProgress(user.uid, topicId, 'theory'));
    
    // Sync with challenge if applicable
    if (activeChallengeId && tasks.some(t => t.id === topicId)) {
      promises.push(toggleTopicProgressInChallenge(activeChallengeId, user.uid, topicId, 'theory'));
    }

    try {
      await Promise.all(promises);
    } catch (err) {
      console.error('Failed to toggle HSC theory:', err);
      setUserProgress(prevUserProgress);
      setTasks(prevTasks);
      triggerToast('Failed to save progress.');
    }
  };

  const toggleHSCPractice = async (subjectId: string, chapterId: string, topicId: string) => {
    if (!user) return;

    // Optimistic update
    const prevUserProgress = { ...userProgress };
    const prevTasks = [...tasks];

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

    const promises = [];
    promises.push(toggleUserTopicProgress(user.uid, topicId, 'practice'));

    // Sync with challenge if applicable
    if (activeChallengeId && tasks.some(t => t.id === topicId)) {
      promises.push(toggleTopicProgressInChallenge(activeChallengeId, user.uid, topicId, 'practice'));
    }

    try {
      await Promise.all(promises);
    } catch (err) {
      console.error('Failed to toggle HSC practice:', err);
      setUserProgress(prevUserProgress);
      setTasks(prevTasks);
      triggerToast('Failed to save progress.');
    }
  };

  const addDashboardTopic = (newTask: Omit<Task, 'id' | 'isLocked'>) => {
    const id = `task-${Date.now()}`;
    const task: Task = {
      ...newTask,
      id,
      isLocked: false,
      createdAt: Date.now(),
    };
    setTasks((prev) => [task, ...prev]);
    triggerToast(`Added topic: "${task.title}"`);
  };

  // Join Challenge by Code
  const joinChallengeCode = async (code: string): Promise<boolean> => {
    if (!user) return false;
    const cleanCode = code.toUpperCase().trim();
    try {
      const challengeDoc = await findChallengeByCode(cleanCode);
      if (!challengeDoc) {
        triggerToast(`No challenge found with code: ${cleanCode}`);
        return false;
      }

      await joinFirestoreChallenge(challengeDoc.challenge_id, {
        uid: user.uid,
        name: user.name,
        email: user.email,
        photoURL: user.photoURL,
      });

      setActiveChallengeId(challengeDoc.challenge_id);
      localStorage.setItem(ACTIVE_CHALLENGE_STORAGE_KEY, challengeDoc.challenge_id);
      await updateActiveChallengeId(user.uid, challengeDoc.challenge_id);
      
      triggerToast(`Successfully joined Challenge: ${cleanCode}!`);
      return true;
    } catch {
      triggerToast(`Failed to join challenge ${cleanCode}.`);
      return false;
    }
  };

  const setActiveChallenge = async (newChallenge: FirestoreChallenge) => {
    setActiveChallengeId(newChallenge.challenge_id);
    setActiveChallengeState(newChallenge);
    localStorage.setItem(ACTIVE_CHALLENGE_STORAGE_KEY, newChallenge.challenge_id);
    
    if (user) {
      try {
        await updateActiveChallengeId(user.uid, newChallenge.challenge_id);
      } catch (err) {
        console.error('Failed to persist active challenge ID to user profile:', err);
      }
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

  // Real Weekly stats computed from deduped challenge tasks
  const weeklyStats: SubjectWeeklyStat[] = useMemo(() => {
    return computeSubjectWeeklyStats(tasks);
  }, [tasks]);

  // Real Streak calculated from user's first login date (createdAt in users/{uid})
  const streakDays = useMemo(() => {
    if (!user?.createdAt) return 1;
    const createdTime = new Date(user.createdAt).getTime();
    if (isNaN(createdTime)) return 1;
    const now = Date.now();
    const diffMs = Math.max(0, now - createdTime);
    return Math.max(1, Math.floor(diffMs / 86400000) + 1);
  }, [user?.createdAt]);

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
    if (!activeChallenge || !activeChallenge.participants) return [];

    const totalSyllabusTopics = activeChallenge.selected_syllabus?.length || 1;
    const startDate = new Date(activeChallenge.start_date).getTime();
    const elapsedDays = Math.max(1, (Date.now() - startDate) / (1000 * 60 * 60 * 24));

    return activeChallenge.participants.map((p) => {
      const isCurrentUser = p.uid === user?.uid;
      const completedTopics = p.completed_topics || 0;
      const progressMap = p.topic_progress || {};

      // Determine active focus from first unfinished topic
      const firstIncomplete = activeChallenge.selected_syllabus.find((top) => {
        const prog = progressMap[top.id];
        return !prog || !prog.theory || !prog.practice;
      });

      const activeFocus = firstIncomplete
        ? `${firstIncomplete.subject}: ${firstIncomplete.title}`
        : 'Sprint Completed';

      const velocity = Number((completedTopics / elapsedDays).toFixed(1));

      return {
        id: p.uid,
        uid: p.uid,
        name: p.name || 'Student',
        email: p.email,
        photoURL: p.photoURL,
        cohort: activeChallenge.code ? `Room ${activeChallenge.code}` : 'HSC Sprint',
        avatarUrl: p.photoURL || '',
        activeFocus,
        completed_topics: completedTopics,
        total_challenge_topics: totalSyllabusTopics,
        last_completion_timestamp: p.last_completion_timestamp || 0,
        topic_progress: progressMap,
        velocityPerDay: Math.max(0, velocity),
        streakDays: Math.min(Math.ceil(elapsedDays), Math.max(0, Math.ceil(completedTopics))),
        rankTrend: 0,
        isCurrentUser,
        isSquad: true,
      };
    });
  }, [activeChallenge, user]);

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
      return a.last_completion_timestamp - b.last_completion_timestamp;
    });

    return listWithScore.map((peer, index) => ({
      ...peer,
      rank: index + 1,
    }));
  }, [peers]);

  // Active Challenge representation
  const challenge: ActiveSprintChallenge = useMemo(() => {
    return {
      title: activeChallenge ? `${activeChallenge.duration}-Day Sprint Challenge` : 'No Active Sprint',
      cohortName: activeChallenge ? `Room ${activeChallenge.code}` : 'None',
      code: activeChallenge?.code || '',
      totalTopics: activeChallenge?.selected_syllabus?.length || 0,
      activePeersCount: activeChallenge?.participants?.length || 0,
      timeRemainingStr: activeChallenge ? `${sprint.daysLeft} Days Left` : 'N/A',
    };
  }, [activeChallenge, sprint]);

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

  return (
    <StudyTrackContext.Provider
      value={{
        tasks,
        weeklyStats,
        backlog,
        sprint,
        streakDays,
        currentTime,
        todayCompletionPercentage,
        completedUnits,
        totalUnits,
        completedTopicsCount,
        hscMasterSyllabus,
        hscSummary,
        activeChallenge,
        activeChallengeId,
        challenge,
        peers,
        sortedPeers,
        weeklySnapshots,
        toggleDashboardTheory,
        toggleDashboardPractice,
        toggleHSCTheory,
        toggleHSCPractice,
        addDashboardTopic,
        joinChallengeCode,
        setActiveChallenge,
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
