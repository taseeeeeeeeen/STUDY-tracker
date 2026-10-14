import { SyllabusItem, BoardCard } from '../types/wizard';
import { allocateChaptersSequentially } from './challengeLogic';

export function buildStrategicRoutine(options: {
  topics: SyllabusItem[];
  numDays: number;
  dailyCapacityMinutes: number;
}): { allocation: Record<string, BoardCard[]>; warnings: string[] } {
  const { topics, numDays, dailyCapacityMinutes } = options;
  const warnings: string[] = [];

  if (!topics || topics.length === 0 || !numDays || numDays <= 0) {
    const emptyAllocation: Record<string, BoardCard[]> = {};
    for (let d = 1; d <= Math.max(0, numDays); d++) {
      emptyAllocation[`Day ${d}`] = [];
    }
    return { allocation: emptyAllocation, warnings };
  }

  // Derive per-day capacity map from user's declared daily capacity
  const dayCapacities: Record<number, number> = {};
  for (let d = 1; d <= numDays; d++) {
    dayCapacities[d] = dailyCapacityMinutes;
  }

  // Deduce canonical chapter order from selected topics in first-appearance order
  const canonicalChapterOrder: string[] = [];
  topics.forEach((t) => {
    const chId = t.chapterId || t.chapterName || t.subject;
    if (!canonicalChapterOrder.includes(chId)) {
      canonicalChapterOrder.push(chId);
    }
  });

  // Run the canonical schedule generation engine
  const cards = allocateChaptersSequentially({
    topics,
    canonicalChapterOrder,
    numDays,
    firstNonPastDay: 1,
    dayCapacities,
    onWarning: (w) => {
      if (!warnings.includes(w)) {
        warnings.push(w);
      }
    },
  });

  // Group into Record<"Day N", BoardCard[]>
  const allocation: Record<string, BoardCard[]> = {};
  for (let d = 1; d <= numDays; d++) {
    allocation[`Day ${d}`] = cards.filter((c) => c.dayNumber === d);
  }

  // Phase 3: validation and warnings
  const detectedDurations = topics
    .map((t) => t.durationMinutes)
    .filter((d): d is number => typeof d === 'number' && d > 0);
  const runtimeFallbackDuration =
    detectedDurations.length > 0
      ? Math.round(detectedDurations.reduce((sum, d) => sum + d, 0) / detectedDurations.length)
      : 30;

  const totalMinutes = topics.reduce(
    (sum: number, t: SyllabusItem) => sum + (t.durationMinutes || runtimeFallbackDuration),
    0
  );

  // 1. Total minutes > numDays * dailyCapacityMinutes
  if (totalMinutes > numDays * dailyCapacityMinutes) {
    warnings.push(
      `Plan cannot fit even at full capacity (Total ${totalMinutes} mins needed, total target window capacity is ${numDays * dailyCapacityMinutes} mins).`
    );
  }

  // 2. Any day exceeding capacity
  for (let d = 1; d <= numDays; d++) {
    const dayCards = allocation[`Day ${d}`] || [];
    const totalDayMins = dayCards.reduce((sum: number, c: BoardCard) => sum + (c.durationMinutes || 0), 0);
    if (totalDayMins > dailyCapacityMinutes) {
      warnings.push(`Day ${d} exceeds target capacity because the total workload exceeds available prep window limits.`);
    }
  }

  // 3. Chapters sharing a day (completion-rollover)
  for (let d = 1; d <= numDays; d++) {
    const dayCards = allocation[`Day ${d}`] || [];
    const subjectChapters: Record<string, Set<string>> = {};
    dayCards.forEach((c) => {
      if (!subjectChapters[c.subject]) {
        subjectChapters[c.subject] = new Set();
      }
      subjectChapters[c.subject].add(c.chapterId || c.chapterName || c.title);
    });

    for (const [subj, chs] of Object.entries(subjectChapters)) {
      if (chs.size > 1) {
        warnings.push(`Two chapters of ${subj} share Day ${d} because the schedule is tight.`);
      }
    }
  }

  return { allocation, warnings };
}
