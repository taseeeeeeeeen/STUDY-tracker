import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from 'react';
import {
  collection,
  query,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { Task, SubjectWeeklyStat, WeeklyBacklog, ActiveSprint } from '../types/dashboard';
import { HSCSubject, HSCProgressSummary } from '../types/hsc';
import { PeerContender, ActiveSprintChallenge } from '../types/peerArena';
import { FirestoreChallenge } from '../types/challenge';
import { INITIAL_TASKS, INITIAL_WEEKLY_STATS, INITIAL_BACKLOG, INITIAL_SPRINT } from '../data/mockData';
import { INITIAL_HSC_MASTER_SYLLABUS } from '../data/hscMasterSyllabus';
import {
  createFirestoreChallenge,
  joinFirestoreChallenge,
  findChallengeByCode,
  toggleTopicProgressInChallenge,
  subscribeChallenge,
} from '../services/challengeService';

interface StudyTrackContextType {
  // Main Dashboard State
  tasks: Task[];
  weeklyStats: SubjectWeeklyStat[];
  backlog: WeeklyBacklog;
  sprint: ActiveSprint;
  streakDays: number;
  currentTime: number;
  timeOffsetHours: number;
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
  fastForwardTime: (hours: number) => void;
  resetTime: () => void;
  generateNewChallengeCode: () => void;
  updateUserPeerTopics: (delta: number) => void;
  joinChallengeCode: (code: string) => Promise<boolean>;
  setActiveChallenge: (challenge: FirestoreChallenge) => void;
  triggerToast: (msg: string) => void;
  toastMessage: string | null;
  clearToast: () => void;
}

const StudyTrackContext = createContext<StudyTrackContextType | undefined>(undefined);

const ACTIVE_CHALLENGE_STORAGE_KEY = 'studytrack_active_challenge_id';

export const StudyTrackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Active Challenge in Firestore
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(() => {
    return localStorage.getItem(ACTIVE_CHALLENGE_STORAGE_KEY) || null;
  });
  const [activeChallenge, setActiveChallengeState] = useState<FirestoreChallenge | null>(null);

  // Fallback states
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [hscMasterSyllabus, setHscMasterSyllabus] =
    useState<HSCSubject[]>(INITIAL_HSC_MASTER_SYLLABUS);
  const [backlog] = useState<WeeklyBacklog>(INITIAL_BACKLOG);
  const [sprint] = useState<ActiveSprint>(INITIAL_SPRINT);
  const [streakDays] = useState(14);

  // Time controller
  const [timeOffsetHours, setTimeOffsetHours] = useState(0);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const clearToast = () => setToastMessage(null);

  // Sync current time with offset
  useEffect(() => {
    setCurrentTime(Date.now() + timeOffsetHours * 60 * 60 * 1000);
    const interval = setInterval(() => {
      setCurrentTime(Date.now() + timeOffsetHours * 60 * 60 * 1000);
    }, 5000);
    return () => clearInterval(interval);
  }, [timeOffsetHours]);

  // Ensure an active challenge exists or initialize one when user logs in
  useEffect(() => {
    if (!user) return;

    const currentUserUid = user.uid;
    const currentUserName = user.name || 'Scholar';
    const currentUserEmail = user.email || '';
    const currentUserPhoto = user.photoURL || '';

    let isMounted = true;

    async function initChallenge() {
      if (!activeChallengeId) {
        try {
          const q = query(collection(db, 'challenges'));
          const snap = await getDocs(q);
          if (!snap.empty && isMounted) {
            const firstChallenge = snap.docs[0].data() as FirestoreChallenge;
            setActiveChallengeId(firstChallenge.challenge_id);
            localStorage.setItem(ACTIVE_CHALLENGE_STORAGE_KEY, firstChallenge.challenge_id);
            return;
          }
        } catch {
          // Ignore
        }

        try {
          const defaultChallenge = await createFirestoreChallenge({
            code: 'CH-9A2X',
            created_by: currentUserUid,
            creator_name: currentUserName,
            duration: 7,
            start_date: new Date().toISOString(),
            selected_syllabus: [
              {
                id: 'phy-top-1',
                subject: 'Physics',
                title: 'Vector Addition & Analytical Laws',
                subconcept: 'Resultant magnitude & angle calculation using analytical laws',
                durationMinutes: 45,
                tag: 'Mechanics',
              },
              {
                id: 'che-top-1',
                subject: 'Chemistry',
                title: 'Quantum Numbers & Electron Configurations',
                subconcept: 'Aufbau, Hund, Pauli Exclusion principles & exceptions',
                durationMinutes: 45,
                tag: 'Atomic Structure',
              },
              {
                id: 'mth-top-1',
                subject: 'Math',
                title: 'Matrix Multiplication & Inverses',
                subconcept: 'Cofactor expansion, Adjoint matrices, Cramers rule',
                durationMinutes: 45,
                tag: 'Linear Algebra',
              },
              {
                id: 'bio-top-1',
                subject: 'Biology',
                title: 'Fluid Mosaic Model & Organelle Function',
                subconcept: 'Plasma membrane structure, mitochondria, ribosomes',
                durationMinutes: 40,
                tag: 'Cell Biology',
              },
            ],
            participants: [
              {
                uid: currentUserUid,
                name: currentUserName,
                email: currentUserEmail,
                photoURL: currentUserPhoto,
                completed_topics: 1.5,
                total_challenge_topics: 4,
                last_completion_timestamp: Date.now() - 3600000,
                topic_progress: {
                  'phy-top-1': { theory: true, practice: true },
                  'che-top-1': { theory: true, practice: false },
                  'mth-top-1': { theory: false, practice: false },
                  'bio-top-1': { theory: false, practice: false },
                },
              },
              {
                uid: 'demo-peer-nusrat',
                name: 'Nusrat Jahan',
                email: 'nusrat@hsc.edu',
                completed_topics: 2,
                total_challenge_topics: 4,
                last_completion_timestamp: Date.now() - 7200000,
                topic_progress: {
                  'phy-top-1': { theory: true, practice: true },
                  'che-top-1': { theory: true, practice: true },
                },
              },
              {
                uid: 'demo-peer-tanvir',
                name: 'Tanvir Ahmed',
                email: 'tanvir@hsc.edu',
                completed_topics: 1,
                total_challenge_topics: 4,
                last_completion_timestamp: Date.now() - 10800000,
                topic_progress: {
                  'phy-top-1': { theory: true, practice: false },
                  'che-top-1': { theory: true, practice: false },
                },
              },
            ],
          });

          if (isMounted) {
            setActiveChallengeId(defaultChallenge.challenge_id);
            localStorage.setItem(ACTIVE_CHALLENGE_STORAGE_KEY, defaultChallenge.challenge_id);
          }
        } catch (err) {
          console.warn('Could not bootstrap default challenge:', err);
        }
      }
    }

    initChallenge();

    return () => {
      isMounted = false;
    };
  }, [user, activeChallengeId]);

  // Real-Time Firestore onSnapshot Listener for Active Challenge
  useEffect(() => {
    if (!activeChallengeId) return;

    const unsubscribe = subscribeChallenge(
      activeChallengeId,
      (challengeDoc) => {
        if (!challengeDoc) return;
        setActiveChallengeState(challengeDoc);

        // Auto-join current user to participants array if not already present
        if (user && !challengeDoc.participants.some((p) => p.uid === user.uid)) {
          joinFirestoreChallenge(challengeDoc.challenge_id, {
            uid: user.uid,
            name: user.name,
            email: user.email,
            photoURL: user.photoURL,
          }).catch(console.error);
        }

        // Map challenge topics & current user's progress into Main Dashboard `tasks`
        const currentUserParticipant =
          challengeDoc.participants.find((p) => p.uid === user?.uid) ||
          challengeDoc.participants[0];

        const userProgress = currentUserParticipant?.topic_progress || {};

        const mappedTasks: Task[] = challengeDoc.selected_syllabus.map((top, idx) => {
          const prog = userProgress[top.id] || { theory: false, practice: false };
          const createdAt = new Date(challengeDoc.start_date).getTime() || Date.now() - 3600000;

          let sub: 'Physics' | 'Chemistry' | 'Math' | 'Biology' = 'Physics';
          if (top.subject?.toLowerCase().includes('chem')) sub = 'Chemistry';
          else if (top.subject?.toLowerCase().includes('math')) sub = 'Math';
          else if (top.subject?.toLowerCase().includes('bio')) sub = 'Biology';

          return {
            id: top.id || `task-${idx + 1}`,
            subject: sub,
            title: top.title,
            description: top.subconcept || `${top.subject} core problem set and fundamentals`,
            durationMinutes: top.durationMinutes || 45,
            theoryCompleted: Boolean(prog.theory),
            practiceCompleted: Boolean(prog.practice),
            createdAt,
            isLocked: false,
          };
        });

        if (mappedTasks.length > 0) {
          setTasks(mappedTasks);
        }
      },
      (error) => {
        console.warn('Real-time challenge onSnapshot error:', error);
      }
    );

    return () => unsubscribe();
  }, [activeChallengeId, user]);

  // Time-based task locking logic
  useEffect(() => {
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    setTasks((prevTasks) =>
      prevTasks.map((task) => {
        const timeElapsed = currentTime - task.createdAt;
        const hasExpired = timeElapsed >= TWENTY_FOUR_HOURS_MS;
        if (hasExpired && !task.isLocked) {
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

  // Instantly update Firestore document on "Theory" or "Practice" toggle
  const toggleDashboardTheory = async (taskId: string) => {
    if (!user) return;
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask || targetTask.isLocked) return;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, theoryCompleted: !t.theoryCompleted } : t))
    );

    if (activeChallengeId) {
      try {
        await toggleTopicProgressInChallenge(activeChallengeId, user.uid, taskId, 'theory');
      } catch (err) {
        console.error('Failed to sync theory toggle to Firestore:', err);
      }
    }
  };

  const toggleDashboardPractice = async (taskId: string) => {
    if (!user) return;
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask || targetTask.isLocked) return;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, practiceCompleted: !t.practiceCompleted } : t))
    );

    if (activeChallengeId) {
      try {
        await toggleTopicProgressInChallenge(activeChallengeId, user.uid, taskId, 'practice');
      } catch (err) {
        console.error('Failed to sync practice toggle to Firestore:', err);
      }
    }
  };

  // HSC Syllabus Toggles
  const toggleHSCTheory = (subjectId: string, chapterId: string, topicId: string) => {
    setHscMasterSyllabus((prev) =>
      prev.map((sub) => {
        if (sub.id !== subjectId) return sub;
        return {
          ...sub,
          chapters: sub.chapters.map((ch) => {
            if (ch.id !== chapterId) return ch;
            return {
              ...ch,
              topics: ch.topics.map((top) => {
                if (top.id !== topicId) return top;
                return { ...top, is_theory_done: !top.is_theory_done };
              }),
            };
          }),
        };
      })
    );
  };

  const toggleHSCPractice = (subjectId: string, chapterId: string, topicId: string) => {
    setHscMasterSyllabus((prev) =>
      prev.map((sub) => {
        if (sub.id !== subjectId) return sub;
        return {
          ...sub,
          chapters: sub.chapters.map((ch) => {
            if (ch.id !== chapterId) return ch;
            return {
              ...ch,
              topics: ch.topics.map((top) => {
                if (top.id !== topicId) return top;
                return { ...top, is_practice_done: !top.is_practice_done };
              }),
            };
          }),
        };
      })
    );
  };

  const addDashboardTopic = (newTask: Omit<Task, 'id' | 'isLocked'>) => {
    const id = `task-${Date.now()}`;
    const task: Task = {
      ...newTask,
      id,
      isLocked: false,
    };
    setTasks((prev) => [task, ...prev]);
    triggerToast(`Added topic: "${task.title}"`);
  };

  const fastForwardTime = (hours: number) => {
    setTimeOffsetHours((prev) => prev + hours);
    triggerToast(`Simulated +${hours}h offset`);
  };

  const resetTime = () => {
    setTimeOffsetHours(0);
    triggerToast('Reset time simulation');
  };

  const generateNewChallengeCode = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const newCode = `CH-${rand}`;
    triggerToast(`Created Challenge: ${newCode}`);
  };

  const updateUserPeerTopics = (delta: number) => {
    if (activeChallenge && user) {
      const topic = activeChallenge.selected_syllabus[0];
      if (topic) {
        toggleDashboardTheory(topic.id);
      }
    }
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
      triggerToast(`Successfully joined Challenge: ${cleanCode}!`);
      return true;
    } catch {
      triggerToast(`Failed to join challenge ${cleanCode}.`);
      return false;
    }
  };

  const setActiveChallenge = (newChallenge: FirestoreChallenge) => {
    setActiveChallengeId(newChallenge.challenge_id);
    setActiveChallengeState(newChallenge);
    localStorage.setItem(ACTIVE_CHALLENGE_STORAGE_KEY, newChallenge.challenge_id);
  };

  // Main Dashboard Math Calculations
  const totalTodayTopics = tasks.length;
  const completedTheory = tasks.filter((t) => t.theoryCompleted).length;
  const completedPractice = tasks.filter((t) => t.practiceCompleted).length;
  const completedUnits = completedTheory + completedPractice;
  const totalUnits = totalTodayTopics * 2;
  const todayCompletionPercentage = totalUnits > 0 ? (completedUnits / totalUnits) * 100 : 0;
  const completedTopicsCount = tasks.filter((t) => t.theoryCompleted && t.practiceCompleted).length;

  // Real-time Weekly stats
  const weeklyStats = useMemo(() => {
    return INITIAL_WEEKLY_STATS.map((base) => {
      const currentCompletedForSubject = tasks.filter(
        (t) => t.subject === base.subject && t.theoryCompleted && t.practiceCompleted
      ).length;
      return {
        ...base,
        done: currentCompletedForSubject,
        remaining: Math.max(0, base.total - currentCompletedForSubject),
      };
    });
  }, [tasks]);

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

  // Real-Time Peer Arena Leaderboard from Firestore Participants
  const peers: PeerContender[] = useMemo(() => {
    if (!activeChallenge) return [];

    return activeChallenge.participants.map((p, index) => {
      const isCurrentUser = p.uid === user?.uid;
      const cohortNames = ["HSC '25 Alpha", "BUET Sprint", "Dhaka College Cohort", "Notre Dame Squad"];
      const focusNames = ["Vector Mechanics", "Qualitative Chemistry", "Calculus Limits", "Cell Structure"];

      return {
        id: p.uid,
        uid: p.uid,
        name: p.name,
        email: p.email,
        photoURL: p.photoURL,
        cohort: cohortNames[index % cohortNames.length],
        avatarUrl:
          p.photoURL ||
          `https://images.unsplash.com/photo-${1534528741775 + index * 1000}?w=150&auto=format&fit=crop&q=80`,
        activeFocus: focusNames[index % focusNames.length],
        completed_topics: p.completed_topics || 0,
        total_challenge_topics: p.total_challenge_topics || activeChallenge.selected_syllabus.length || 1,
        last_completion_timestamp: p.last_completion_timestamp || Date.now(),
        topic_progress: p.topic_progress || {},
        velocityPerDay: 2.8,
        streakDays: 12 + index,
        rankTrend: index === 0 ? 0 : 1,
        isCurrentUser,
        isSquad: index < 4,
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
      title: activeChallenge ? `${activeChallenge.duration}-Day Sprint Challenge` : '7-Day Sprint',
      cohortName: "HSC '25 Alpha Cohort",
      code: activeChallenge?.code || 'CH-9A2X',
      totalTopics: activeChallenge?.selected_syllabus.length || 4,
      activePeersCount: activeChallenge?.participants.length || 1,
      timeRemainingStr: `${activeChallenge?.duration || 7} Days Left`,
    };
  }, [activeChallenge]);

  return (
    <StudyTrackContext.Provider
      value={{
        tasks,
        weeklyStats,
        backlog,
        sprint,
        streakDays,
        currentTime,
        timeOffsetHours,
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
        fastForwardTime,
        resetTime,
        generateNewChallengeCode,
        joinChallengeCode,
        setActiveChallenge,
        updateUserPeerTopics,
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
