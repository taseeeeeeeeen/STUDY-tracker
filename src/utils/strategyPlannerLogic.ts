import { SyllabusItem, BoardCard, BoardTopic } from '../types/wizard';

interface ChapterQueueItem {
  chapterId: string;
  chapterName: string;
  subject: string;
  tag: string;
  topics: BoardTopic[];
}

interface SubjectQueue {
  subject: string;
  chapters: ChapterQueueItem[];
  currentChapterIdx: number;
  topicOffset: number; // offset within current chapter
}

export function buildStrategicRoutine(options: {
  topics: SyllabusItem[];
  numDays: number;
  dailyCapacityMinutes: number;
  priorityChapterOrder?: string[];
  canonicalChapterOrder?: string[];
}): { allocation: Record<string, BoardCard[]>; warnings: string[] } {
  const {
    topics,
    numDays,
    dailyCapacityMinutes,
    priorityChapterOrder,
    canonicalChapterOrder: userChapterOrder,
  } = options;
  const warnings: string[] = [];

  const safeNumDays = Math.max(1, numDays || 1);
  const allocation: Record<string, BoardCard[]> = {};
  for (let d = 1; d <= safeNumDays; d++) {
    allocation[`Day ${d}`] = [];
  }

  if (!topics || topics.length === 0 || !numDays || numDays <= 0) {
    return { allocation, warnings };
  }

  // Fallback topic duration
  const detectedDurations = topics
    .map((t) => t.durationMinutes)
    .filter((d): d is number => typeof d === 'number' && d > 0);
  const fallbackDuration =
    detectedDurations.length > 0
      ? Math.round(detectedDurations.reduce((sum, d) => sum + d, 0) / detectedDurations.length)
      : 30;

  // 1. Group topics by Subject -> Chapter
  const subjectMap = new Map<string, Map<string, ChapterQueueItem>>();
  const subjectOrder: string[] = [];

  topics.forEach((t) => {
    const subj = t.subject || 'General';
    if (!subjectMap.has(subj)) {
      subjectMap.set(subj, new Map());
      subjectOrder.push(subj);
    }

    const chId = t.chapterId || t.chapterName || t.subject || 'Chapter';
    const chName = t.chapterName || t.title || 'Chapter';
    const chMap = subjectMap.get(subj)!;

    if (!chMap.has(chId)) {
      chMap.set(chId, {
        chapterId: chId,
        chapterName: chName,
        subject: subj,
        tag: t.tag || 'Core Concept',
        topics: [],
      });
    }

    chMap.get(chId)!.topics.push({
      id: t.id,
      title: t.title,
      subconcept: t.subconcept,
      durationMinutes: t.durationMinutes > 0 ? t.durationMinutes : fallbackDuration,
      tag: t.tag || 'Core Concept',
      subject: subj,
      chapterId: chId,
      chapterName: chName,
    });
  });

  // 2. Order chapters within each subject strictly according to priorityChapterOrder
  const priorityList = priorityChapterOrder && priorityChapterOrder.length > 0
    ? priorityChapterOrder
    : userChapterOrder && userChapterOrder.length > 0
    ? userChapterOrder
    : [];

  const getPriorityScore = (chapterId: string): number => {
    if (priorityList.length === 0) return 999999;
    const idx = priorityList.indexOf(chapterId);
    return idx !== -1 ? idx : 999999;
  };

  const subjectQueues: SubjectQueue[] = [];

  subjectOrder.forEach((subj) => {
    const chMap = subjectMap.get(subj)!;
    const chArray = Array.from(chMap.values());

    // Sort chapters strictly by priority score
    chArray.sort((a, b) => {
      const pA = getPriorityScore(a.chapterId);
      const pB = getPriorityScore(b.chapterId);
      return pA - pB;
    });

    subjectQueues.push({
      subject: subj,
      chapters: chArray,
      currentChapterIdx: 0,
      topicOffset: 0,
    });
  });

  // Track the first day each chapter was scheduled (for isCarriedOver / carriedOverFromDay)
  const chapterStartedDay = new Map<string, number>();

  // Helper to count remaining 6-topic chunks for a subject queue
  const getSubjectRemainingChunks = (sq: SubjectQueue): number => {
    let chunks = 0;
    for (let c = sq.currentChapterIdx; c < sq.chapters.length; c++) {
      const ch = sq.chapters[c];
      const remainingTopicsCount =
        c === sq.currentChapterIdx ? ch.topics.length - sq.topicOffset : ch.topics.length;
      chunks += Math.ceil(Math.max(0, remainingTopicsCount) / 6);
    }
    return chunks;
  };

  let cardCounter = 0;

  // 3. Day-by-Day Scheduling Loop
  for (let d = 1; d <= safeNumDays; d++) {
    const remainingDays = safeNumDays - d + 1;

    // Filter subjects that still have incomplete chapters
    const activeSubjects = subjectQueues.filter((sq) => sq.currentChapterIdx < sq.chapters.length);
    if (activeSubjects.length === 0) break;

    // Total 6-topic chunks remaining across all subjects
    const totalRemainingChunks = activeSubjects.reduce(
      (sum, sq) => sum + getSubjectRemainingChunks(sq),
      0
    );

    // Target chunks to schedule today based on remaining days and syllabus
    // (Rule 3: Multiple random/different subjects can be in one day depending on days left)
    const targetChunksToday = Math.max(1, Math.ceil(totalRemainingChunks / remainingDays));
    const chunksToSchedule = Math.min(targetChunksToday, activeSubjects.length);

    // Sort active subjects so that the subject with the highest priority pending chapter is scheduled first
    activeSubjects.sort((a, b) => {
      const chA = a.chapters[a.currentChapterIdx];
      const chB = b.chapters[b.currentChapterIdx];
      const scoreA = chA ? getPriorityScore(chA.chapterId) : 999999;
      const scoreB = chB ? getPriorityScore(chB.chapterId) : 999999;
      return scoreA - scoreB;
    });

    const dayKey = `Day ${d}`;
    const dayCards: BoardCard[] = [];

    // Schedule 1 chunk (up to 6 topics) from up to chunksToSchedule distinct subjects
    for (let i = 0; i < chunksToSchedule; i++) {
      const sq = activeSubjects[i];
      if (!sq || sq.currentChapterIdx >= sq.chapters.length) continue;

      const currentChapter = sq.chapters[sq.currentChapterIdx];
      const unassignedTopics = currentChapter.topics.slice(sq.topicOffset);

      // Rule 2: Take at most 6 topics of this chapter in one day
      const chunkTopics = unassignedTopics.slice(0, 6);
      if (chunkTopics.length === 0) continue;

      sq.topicOffset += chunkTopics.length;

      // Handle carry-over tagging
      const wasStarted = chapterStartedDay.has(currentChapter.chapterId);
      if (!wasStarted) {
        chapterStartedDay.set(currentChapter.chapterId, d);
      }
      const isCarriedOver = wasStarted && chapterStartedDay.get(currentChapter.chapterId)! < d;
      const carriedOverFromDay = isCarriedOver ? chapterStartedDay.get(currentChapter.chapterId) : undefined;

      const cardDuration = chunkTopics.reduce((acc, t) => acc + t.durationMinutes, 0);

      const card: BoardCard = {
        id: `${currentChapter.chapterId}-d${d}-${cardCounter++}`,
        chapterId: currentChapter.chapterId,
        chapterName: currentChapter.chapterName,
        subject: currentChapter.subject,
        title: currentChapter.chapterName || currentChapter.subject,
        durationMinutes: cardDuration,
        tag: currentChapter.tag || 'Core Concept',
        dayNumber: d,
        topics: chunkTopics.map((top) => ({
          ...top,
          dayNumber: d,
          isCarriedOver,
          carriedOverFromDay,
        })),
        isCarriedOver,
        carriedOverFromDay,
      };

      dayCards.push(card);

      // Rule 1: A new chapter NEVER starts before completing the previous chapter's all topics
      if (sq.topicOffset >= currentChapter.topics.length) {
        sq.currentChapterIdx++;
        sq.topicOffset = 0;
      }
    }

    allocation[dayKey] = dayCards;
  }

  // 4. Overspill / Short Window Handling: If topics remain after Day safeNumDays
  const overflowSubjects = subjectQueues.filter((sq) => sq.currentChapterIdx < sq.chapters.length);
  if (overflowSubjects.length > 0) {
    const lastDayKey = `Day ${safeNumDays}`;
    const lastDayCards = allocation[lastDayKey] || [];

    overflowSubjects.forEach((sq) => {
      while (sq.currentChapterIdx < sq.chapters.length) {
        const currentChapter = sq.chapters[sq.currentChapterIdx];
        const unassignedTopics = currentChapter.topics.slice(sq.topicOffset);
        if (unassignedTopics.length > 0) {
          const wasStarted = chapterStartedDay.has(currentChapter.chapterId);
          if (!wasStarted) {
            chapterStartedDay.set(currentChapter.chapterId, safeNumDays);
          }
          const isCarriedOver = wasStarted && chapterStartedDay.get(currentChapter.chapterId)! < safeNumDays;
          const carriedOverFromDay = isCarriedOver ? chapterStartedDay.get(currentChapter.chapterId) : undefined;

          const cardDuration = unassignedTopics.reduce((acc, t) => acc + t.durationMinutes, 0);

          lastDayCards.push({
            id: `${currentChapter.chapterId}-d${safeNumDays}-overflow-${cardCounter++}`,
            chapterId: currentChapter.chapterId,
            chapterName: currentChapter.chapterName,
            subject: currentChapter.subject,
            title: currentChapter.chapterName || currentChapter.subject,
            durationMinutes: cardDuration,
            tag: currentChapter.tag || 'Core Concept',
            dayNumber: safeNumDays,
            topics: unassignedTopics.map((top) => ({
              ...top,
              dayNumber: safeNumDays,
              isCarriedOver,
              carriedOverFromDay,
            })),
            isCarriedOver,
            carriedOverFromDay,
          });
        }
        sq.currentChapterIdx++;
        sq.topicOffset = 0;
      }
    });

    allocation[lastDayKey] = lastDayCards;
    warnings.push(
      `Plan cannot fit all topics comfortably under the 6-topic daily limit within ${safeNumDays} days. Remaining topics placed on Day ${safeNumDays}.`
    );
  }

  // 5. Capacity and Balance Warnings
  const totalMinutes = topics.reduce(
    (sum: number, t: SyllabusItem) => sum + (t.durationMinutes || fallbackDuration),
    0
  );
  const totalWindowCapacity = safeNumDays * dailyCapacityMinutes;

  if (totalMinutes > totalWindowCapacity) {
    warnings.push(
      `Plan cannot fit even at full capacity (Total ${totalMinutes} mins needed, total target window capacity is ${totalWindowCapacity} mins).`
    );
  }

  for (let d = 1; d <= safeNumDays; d++) {
    const dayCards = allocation[`Day ${d}`] || [];
    const totalDayMins = dayCards.reduce((sum: number, c: BoardCard) => sum + (c.durationMinutes || 0), 0);
    if (totalDayMins > dailyCapacityMinutes) {
      warnings.push(`Day ${d} exceeds target capacity because the total workload exceeds available prep window limits.`);
    }
  }

  return { allocation, warnings };
}
