import { Task, SubjectWeeklyStat, WeeklyBacklog, ActiveSprint } from '../types/dashboard';
import { FirestoreChallenge } from '../types/challenge';

const SUBJECT_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  Physics: { label: 'Phys', color: '#003820', bgColor: '#6ffbbe' },
  Chemistry: { label: 'Chem', color: '#003820', bgColor: '#6ffbbe' },
  Biology: { label: 'Bio', color: '#003820', bgColor: '#6ffbbe' },
  Math: { label: 'Math', color: '#003820', bgColor: '#6ffbbe' },
  Bangla: { label: 'Bang', color: '#003820', bgColor: '#6ffbbe' },
  English: { label: 'Eng', color: '#003820', bgColor: '#6ffbbe' },
  ICT: { label: 'ICT', color: '#003820', bgColor: '#6ffbbe' },
};

/**
 * One row per subject present in tasks;
 * done counts topics with both flags true (theory & practice);
 * remaining = total - done.
 */
export function computeSubjectWeeklyStats(tasks: Task[]): SubjectWeeklyStat[] {
  const uniqueSubjects = Array.from(new Set(tasks.map((t) => t.subject)));

  return uniqueSubjects.map((subject) => {
    const subjectTasks = tasks.filter((t) => t.subject === subject);
    const done = subjectTasks.filter((t) => t.theoryCompleted && t.practiceCompleted).length;
    const total = subjectTasks.length;
    const remaining = Math.max(0, total - done);

    return {
      subject,
      label: SUBJECT_CONFIG[subject]?.label || (subject.length > 8 ? subject.slice(0, 8) : subject),
      done,
      remaining,
      total,
      color: SUBJECT_CONFIG[subject]?.color || '#003820',
      bgColor: SUBJECT_CONFIG[subject]?.bgColor || '#6ffbbe',
    };
  });
}

/**
 * Theory and practice each count as 1 unit of the same topic (never as separate topics).
 */
export function computeSubjectUnitStats(tasks: Task[]): { doneUnits: number; totalUnits: number } {
  let doneUnits = 0;
  for (const t of tasks) {
    if (t.theoryCompleted) doneUnits += 1;
    if (t.practiceCompleted) doneUnits += 1;
  }
  const totalUnits = tasks.length * 2;
  return { doneUnits, totalUnits };
}

/**
 * Backlog calculation: targetDay as Day {duration} and midtermWeek clamped to >= 1.
 */
export function computeBacklog(
  activeChallenge: FirestoreChallenge | null,
  nowMs: number
): WeeklyBacklog {
  const totalDays = activeChallenge?.duration || 7;
  const startDate = activeChallenge?.start_date
    ? new Date(activeChallenge.start_date).getTime()
    : nowMs;
  const daysRemaining = Math.max(
    0,
    totalDays - Math.floor((nowMs - startDate) / (1000 * 60 * 60 * 24))
  );

  return {
    midtermWeek: Math.max(
      1,
      Math.ceil((nowMs - startDate) / (1000 * 60 * 60 * 24 * 7))
    ),
    targetDay: `Day ${totalDays}`,
    targetTime: '23:59',
    daysRemaining,
  };
}

/**
 * Active sprint state calculation matching challenge lifecycle.
 */
export function computeSprint(
  activeChallenge: FirestoreChallenge | null,
  nowMs: number
): ActiveSprint {
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
  const elapsedDays = Math.max(0, Math.floor((nowMs - startDate) / (1000 * 60 * 60 * 24)));
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
}

/**
 * Counts only topic ids in the allow list (pass null to allow all),
 * where a topic is "done this week" if any of its completions (theory or practice)
 * has a timestamp within the last 7 days.
 */
export function computeWeeklyCompletion(
  userProgress: Record<string, { theory: boolean; practice: boolean }>,
  completionLog: Record<string, { theory: number | null; practice: number | null }> | undefined,
  topicIdAllowList: string[] | null,
  nowMs: number
): { topicsDone: number; topicsTotal: number; percent: number } {
  const candidateIds = topicIdAllowList !== null ? topicIdAllowList : Object.keys(userProgress);
  const topicsTotal = candidateIds.length;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  let topicsDone = 0;

  for (const topicId of candidateIds) {
    if (completionLog !== undefined) {
      const log = completionLog[topicId];
      const hasRecentTheory =
        typeof log?.theory === 'number' &&
        log.theory > 0 &&
        nowMs - log.theory <= SEVEN_DAYS_MS &&
        log.theory <= nowMs;
      const hasRecentPractice =
        typeof log?.practice === 'number' &&
        log.practice > 0 &&
        nowMs - log.practice <= SEVEN_DAYS_MS &&
        log.practice <= nowMs;

      if (hasRecentTheory || hasRecentPractice) {
        topicsDone += 1;
      }
    } else {
      const prog = userProgress[topicId];
      if (prog && (prog.theory || prog.practice)) {
        topicsDone += 1;
      }
    }
  }

  const percent = topicsTotal > 0 ? (topicsDone / topicsTotal) * 100 : 0;
  return { topicsDone, topicsTotal, percent };
}

/**
 * Arithmetic for HSC progress summary:
 * (theory + practice) / (totalTopics * 2) * 100
 */
export function computeOverallPercent(
  topics: { is_theory_done: boolean; is_practice_done: boolean }[]
): number {
  const totalTopics = topics.length;
  if (totalTopics === 0) return 0;
  const completedTheoryCount = topics.filter((t) => t.is_theory_done).length;
  const completedPracticeCount = topics.filter((t) => t.is_practice_done).length;
  return ((completedTheoryCount + completedPracticeCount) / (totalTopics * 2)) * 100;
}

export function getDailyActiveDateKeys(
  completionLog: Record<string, { theory: number | null; practice: number | null }> | undefined
): Set<string> {
  const activeKeys = new Set<string>();
  if (!completionLog) return activeKeys;

  for (const log of Object.values(completionLog)) {
    if (log) {
      if (typeof log.theory === 'number' && log.theory > 0) {
        const d = new Date(log.theory);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        activeKeys.add(`${yyyy}-${mm}-${dd}`);
      }
      if (typeof log.practice === 'number' && log.practice > 0) {
        const d = new Date(log.practice);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        activeKeys.add(`${yyyy}-${mm}-${dd}`);
      }
    }
  }
  return activeKeys;
}

export function computeStreakDays(
  completionLog: Record<string, { theory: number | null; practice: number | null }> | undefined,
  nowMs: number
): number {
  if (!completionLog) return 0;
  const activeKeys = getDailyActiveDateKeys(completionLog);
  if (activeKeys.size === 0) return 0;

  const d = new Date(nowMs);
  d.setHours(12, 0, 0, 0); // avoid DST issues by setting to noon

  const formatDate = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayKey = formatDate(d);

  // Yesterday
  const yesterday = new Date(d);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = formatDate(yesterday);

  // If neither today nor yesterday has activity, streak is 0
  if (!activeKeys.has(todayKey) && !activeKeys.has(yesterdayKey)) {
    return 0;
  }

  // If today has no activity but yesterday does, start counting from yesterday
  const startDay = activeKeys.has(todayKey) ? d : yesterday;
  let streak = 0;
  const currentCheck = new Date(startDay);

  while (true) {
    const key = formatDate(currentCheck);
    if (activeKeys.has(key)) {
      streak++;
      currentCheck.setDate(currentCheck.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}
