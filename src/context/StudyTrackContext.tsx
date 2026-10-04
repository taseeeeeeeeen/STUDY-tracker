import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
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
} from '../services/challengeService';
import {
  subscribeUserProgress,
  toggleUserTopicProgress,
  UserTopicProgress,
  UserProgressDoc,
  updateActiveChallengeId,
  addJoinedChallengeId,
} from '../services/userProgressService';

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

  // Active Challenge in Firestore (loaded from localStorage key or set by wizard/join)
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(() => {
    return localStorage.getItem(ACTIVE_CHALLENGE_STORAGE_KEY) || null;
  });
  const [activeChallenge, setActiveChallengeState] = useState<FirestoreChallenge | null>(null);

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
      return;
    }

    const unsubscribe = subscribeUserProgress(
      user.uid,
      (progressDoc: UserProgressDoc | null) => {
        if (progressDoc) {
          setUserProgress(progressDoc.topicProgress || {});
          
          // Sync active challenge ID from Firestore profile if it's different from local state
          if (progressDoc.activeChallengeId && progressDoc.activeChallengeId !== activeChallengeId) {
            setActiveChallengeId(progressDoc.activeChallengeId);
            localStorage.setItem(ACTIVE_CHALLENGE_STORAGE_KEY, progressDoc.activeChallengeId);
          }
        } else {
          setUserProgress({});
        }
      },
      (err) => {
        console.error('Failed to subscribe to user progress:', err);
      }
    );

    return () => unsubscribe();
  }, [user]);

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
          return;
        }

        setActiveChallengeState(challengeDoc);

        // Map challenge topics & current user's progress into Main Dashboard tasks
        const currentUserParticipant =
          challengeDoc.participants.find((p) => p.uid === user?.uid) ||
          challengeDoc.participants[0];

        const userProgress = currentUserParticipant?.topic_progress || {};
        const challengeCreatedAt = new Date(challengeDoc.start_date).getTime() || Date.now();

        const mappedTasks: Task[] = (challengeDoc.selected_syllabus || []).map((top, idx) => {
          const prog = userProgress[top.id] || { theory: false, practice: false };

          let sub: (typeof HSC_CORE_SUBJECTS)[number] = 'Physics';
          const subLower = (top.subject || '').toLowerCase();
          if (subLower.includes('bangla') || subLower.includes('বাংলা')) sub = 'Bangla';
          else if (subLower.includes('english') || subLower.includes('ইংরেজি')) sub = 'English';
          else if (subLower.includes('ict') || subLower.includes('তথ্য')) sub = 'ICT';
          else if (subLower.includes('chem') || subLower.includes('কেমিস্ট্রি')) sub = 'Chemistry';
          else if (subLower.includes('math') || subLower.includes('ম্যাথ') || subLower.includes('গণিত') || subLower.includes('calc')) sub = 'Math';
          else if (subLower.includes('bio') || subLower.includes('জীব')) sub = 'Biology';
          else if (subLower.includes('phys') || subLower.includes('ফিজিক্স')) sub = 'Physics';
          else sub = 'Physics';

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

  // Real Weekly stats computed from user's persisted progress in hscMasterSyllabus across all 7 core subjects
  const weeklyStats: SubjectWeeklyStat[] = useMemo(() => {
    const subjectConfig: Record<string, { label: string; color: string; bgColor: string }> = {
      Physics: { label: 'Phys', color: '#003820', bgColor: '#6ffbbe' },
      Chemistry: { label: 'Chem', color: '#003820', bgColor: '#6ffbbe' },
      Biology: { label: 'Bio', color: '#003820', bgColor: '#6ffbbe' },
      Math: { label: 'Math', color: '#003820', bgColor: '#6ffbbe' },
      Bangla: { label: 'Bang', color: '#003820', bgColor: '#6ffbbe' },
      English: { label: 'Eng', color: '#003820', bgColor: '#6ffbbe' },
      ICT: { label: 'ICT', color: '#003820', bgColor: '#6ffbbe' },
    };

    return HSC_CORE_SUBJECTS.map((subject) => {
      const matchingSubjects = hscMasterSyllabus.filter(
        (s) => matchSubjectCategory(s.name) === subject
      );

      const allTopics = matchingSubjects.flatMap((s) => s.chapters.flatMap((c) => c.topics));
      const done = allTopics.filter((t) => t.is_theory_done && t.is_practice_done).length;
      const total = allTopics.length;
      const remaining = Math.max(0, total - done);

      return {
        subject,
        label: subjectConfig[subject]?.label || subject.slice(0, 4),
        done,
        remaining,
        total,
        color: subjectConfig[subject]?.color || '#003820',
        bgColor: subjectConfig[subject]?.bgColor || '#6ffbbe',
      };
    });
  }, [hscMasterSyllabus]);

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
    if (!activeChallenge) {
      return {
        name: 'No Active Sprint',
        phase: 'Setup a Sprint',
        daysLeft: 0,
        daysCompleted: 0,
        totalDays: 7,
        rewardBadge: 'Launch in Challenge Wizard',
      };
    }
    const startDate = new Date(activeChallenge.start_date).getTime();
    const totalDays = activeChallenge.duration || 7;
    const elapsedDays = Math.max(0, Math.floor((Date.now() - startDate) / (1000 * 60 * 60 * 24)));
    const daysCompleted = Math.min(totalDays, elapsedDays);
    const daysLeft = Math.max(0, totalDays - daysCompleted);

    return {
      name: `${totalDays}-Day Study Sprint`,
      phase: daysLeft === 0 ? 'Sprint Completed' : `Day ${daysCompleted + 1} of ${totalDays}`,
      daysLeft,
      daysCompleted,
      totalDays,
      rewardBadge: daysLeft === 0 ? '🏆 Sprint Completed!' : 'Mastery Badge at finish',
    };
  }, [activeChallenge]);

  // Real Weekly Backlog computed from remaining challenge tasks
  const backlog: WeeklyBacklog = useMemo(() => {
    const totalDays = activeChallenge?.duration || 7;
    const startDate = activeChallenge?.start_date
      ? new Date(activeChallenge.start_date).getTime()
      : Date.now();
    const daysRemaining = Math.max(
      0,
      totalDays - Math.floor((Date.now() - startDate) / (1000 * 60 * 60 * 24))
    );

    return {
      midtermWeek: Math.max(
        1,
        Math.ceil((Date.now() - (startDate || Date.now())) / (1000 * 60 * 60 * 24 * 7))
      ),
      targetDay: `Day ${totalDays}`,
      targetTime: '23:59',
      daysRemaining,
    };
  }, [activeChallenge]);

  // HSC Summary Math
  const hscSummary: HSCProgressSummary = useMemo(() => {
    const allTopics = hscMasterSyllabus.flatMap((s) => s.chapters.flatMap((c) => c.topics));
    const allChapters = hscMasterSyllabus.flatMap((s) => s.chapters);

    const totalTopics = allTopics.length;
    const completedTheoryCount = allTopics.filter((t) => t.is_theory_done).length;
    const completedPracticeCount = allTopics.filter((t) => t.is_practice_done).length;

    const grandProgressPercent =
      totalTopics > 0 ? ((completedTheoryCount + completedPracticeCount) / (totalTopics * 2)) * 100 : 0;
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
