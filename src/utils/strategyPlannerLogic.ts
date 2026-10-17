import { SyllabusItem, BoardCard, BoardTopic } from '../types/wizard';

/**
 * Normalizes subject names / IDs into a unified base-subject family
 * to prevent Paper 1 and Paper 2 from colliding on the same study day.
 */
export function getBaseSubjectFamily(subjectName: string = '', subjectId: string = ''): string {
  const combined = `${subjectName} ${subjectId}`.toLowerCase();
  if (combined.includes('physic')) return 'physics';
  if (combined.includes('chem')) return 'chemistry';
  if (combined.includes('math')) return 'math';
  if (combined.includes('bio')) return 'biology';
  if (combined.includes('ict') || combined.includes('computer') || combined.includes('information')) return 'ict';
  if (combined.includes('bangla') || combined.includes('bengali')) return 'bangla';
  if (combined.includes('english')) return 'english';
  if (combined.includes('stat')) return 'statistics';
  if (combined.includes('econ')) return 'economics';
  if (combined.includes('account')) return 'accounting';
  if (combined.includes('finance')) return 'finance';
  if (combined.includes('manage') || combined.includes('business')) return 'business';

  // Fallback: strip paper indicators, numbers, punctuation
  const cleaned = subjectName
    .toLowerCase()
    .replace(/\b(1st|2nd|first|second|paper|part|vol|volume|i|ii)\b/gi, '')
    .replace(/[^a-z]/g, '')
    .trim();
  return cleaned || subjectName.toLowerCase().trim() || 'general';
}

function isComplexSubjectOrChapter(subject: string, chapterName: string): boolean {
  const family = getBaseSubjectFamily(subject);
  if (family === 'physics' || family === 'chemistry' || family === 'math') {
    return true;
  }
  const chLower = chapterName.toLowerCase();
  if (
    chLower.includes('organic') ||
    chLower.includes('calculus') ||
    chLower.includes('trigonometry') ||
    chLower.includes('mechanic') ||
    chLower.includes('vector') ||
    chLower.includes('electricity') ||
    chLower.includes('magnetism') ||
    chLower.includes('optics') ||
    chLower.includes('integration') ||
    chLower.includes('differentiation')
  ) {
    return true;
  }
  return false;
}

export interface BuildStrategicRoutineOptions {
  topics: SyllabusItem[];
  numDays: number;
  dailyCapacityMinutes: number;
  priorityChapterOrder?: string[];
  canonicalChapterOrder?: string[];
  chapterCustomDays?: Record<string, number>;
}

interface InternalChapter {
  chapterKey: string;
  chapterId: string;
  chapterName: string;
  subject: string;
  baseFamily: string;
  tag: string;
  topics: BoardTopic[];
  totalTopics: number;
  remainingTopics: BoardTopic[];
  requestedDays: number;
  allocatedDays: number;
  daysStudied: number;
  firstScheduledDay?: number;
  lastScheduledDay?: number;
  priorityRank: number;
}

interface InternalSubject {
  subject: string;
  baseFamily: string;
  chapters: InternalChapter[];
  activeChapterIdx: number;
  lastScheduledDay?: number;
}

export function buildStrategicRoutine(options: BuildStrategicRoutineOptions): {
  allocation: Record<string, BoardCard[]>;
  warnings: string[];
} {
  const {
    topics,
    numDays,
    dailyCapacityMinutes,
    priorityChapterOrder,
    canonicalChapterOrder: userChapterOrder,
    chapterCustomDays = {},
  } = options;

  const warnings: string[] = [];
  const safeNumDays = Math.max(1, numDays || 1);

  // Initialize allocation structure
  const allocation: Record<string, BoardCard[]> = {};
  for (let d = 1; d <= safeNumDays; d++) {
    allocation[`Day ${d}`] = [];
  }

  if (!topics || topics.length === 0 || !numDays || numDays <= 0) {
    return { allocation, warnings };
  }

  // Calculate fallback topic duration
  const detectedDurations = topics
    .map((t) => t.durationMinutes)
    .filter((d): d is number => typeof d === 'number' && d > 0);
  const fallbackDuration =
    detectedDurations.length > 0
      ? Math.round(detectedDurations.reduce((sum, d) => sum + d, 0) / detectedDurations.length)
      : 30;

  // 1. Group topics by Subject -> Chapter
  const priorityList =
    priorityChapterOrder && priorityChapterOrder.length > 0
      ? priorityChapterOrder
      : userChapterOrder && userChapterOrder.length > 0
      ? userChapterOrder
      : [];

  const getPriorityScore = (chapterId: string, chapterKey: string, chapterName: string): number => {
    if (priorityList.length === 0) return 999999;
    const matchIdx = priorityList.findIndex(
      (p) => p === chapterId || p === chapterKey || p === chapterName
    );
    return matchIdx !== -1 ? matchIdx : 999999;
  };

  const subjectMap = new Map<string, Map<string, InternalChapter>>();
  const subjectOrder: string[] = [];

  topics.forEach((t) => {
    const subj = t.subject || 'General';
    if (!subjectMap.has(subj)) {
      subjectMap.set(subj, new Map());
      subjectOrder.push(subj);
    }

    const chId = t.chapterId || t.chapterName || t.subject || 'Chapter';
    const chName = t.chapterName || t.title || 'Chapter';
    const chapterKey = `${subj}::${chId}`;
    const chMap = subjectMap.get(subj)!;

    if (!chMap.has(chId)) {
      const baseFamily = getBaseSubjectFamily(subj);
      chMap.set(chId, {
        chapterKey,
        chapterId: chId,
        chapterName: chName,
        subject: subj,
        baseFamily,
        tag: t.tag || 'Core Concept',
        topics: [],
        totalTopics: 0,
        remainingTopics: [],
        requestedDays: 1,
        allocatedDays: 1,
        daysStudied: 0,
        priorityRank: getPriorityScore(chId, chapterKey, chName),
      });
    }

    const chObj = chMap.get(chId)!;
    const topicItem: BoardTopic = {
      id: t.id,
      title: t.title,
      subconcept: t.subconcept,
      durationMinutes: t.durationMinutes > 0 ? t.durationMinutes : fallbackDuration,
      tag: t.tag || 'Core Concept',
      subject: subj,
      chapterId: chId,
      chapterName: chName,
    };

    chObj.topics.push(topicItem);
    chObj.remainingTopics.push({ ...topicItem });
    chObj.totalTopics = chObj.topics.length;
  });

  // 2. Compute Raw Requested Days (R_i) for each chapter & order chapters within subjects
  const subjectList: InternalSubject[] = [];

  subjectOrder.forEach((subj) => {
    const chMap = subjectMap.get(subj)!;
    const chapters = Array.from(chMap.values());

    // Sort chapters strictly by priority rank
    chapters.sort((a, b) => a.priorityRank - b.priorityRank);

    chapters.forEach((ch) => {
      // Check user custom days
      const customDayVal =
        chapterCustomDays[ch.chapterKey] ||
        chapterCustomDays[ch.chapterId] ||
        chapterCustomDays[ch.chapterName] ||
        chapterCustomDays[`${ch.subject}::${ch.chapterName}`] ||
        0;

      if (customDayVal > 0) {
        ch.requestedDays = customDayVal;
      } else {
        // Smart Auto Default based on subject complexity and topic count
        const isComplex = isComplexSubjectOrChapter(ch.subject, ch.chapterName);
        if (isComplex) {
          ch.requestedDays = Math.max(1, Math.ceil(ch.totalTopics / 3));
        } else {
          ch.requestedDays = Math.max(1, Math.ceil(ch.totalTopics / 4));
        }
      }
    });

    subjectList.push({
      subject: subj,
      baseFamily: getBaseSubjectFamily(subj),
      chapters,
      activeChapterIdx: 0,
    });
  });

  // 3. Elastic Horizon Scaling (Compression / Expansion per Base-Subject Family)
  // Chapters within the same base-subject family (e.g. Physics 1st Paper + Physics 2nd Paper)
  // run sequentially without colliding, so their sum of allocated days must fit the horizon.
  const familyChaptersMap = new Map<string, InternalChapter[]>();
  subjectList.forEach((subjObj) => {
    if (!familyChaptersMap.has(subjObj.baseFamily)) {
      familyChaptersMap.set(subjObj.baseFamily, []);
    }
    subjObj.chapters.forEach((c) => {
      familyChaptersMap.get(subjObj.baseFamily)!.push(c);
    });
  });

  familyChaptersMap.forEach((chapters) => {
    if (chapters.length === 0) return;

    const totalRequested = chapters.reduce((sum, c) => sum + c.requestedDays, 0);
    const totalTopicsInFamily = chapters.reduce((sum, c) => sum + c.totalTopics, 0);
    const maxPossibleDays = Math.min(safeNumDays, totalTopicsInFamily);

    if (totalRequested > safeNumDays) {
      // Compression: proportionally compress days so sum of chapters in family <= safeNumDays
      const scale = safeNumDays / totalRequested;
      let allocatedSum = 0;

      chapters.forEach((c) => {
        c.allocatedDays = Math.max(1, Math.floor(c.requestedDays * scale));
        allocatedSum += c.allocatedDays;
      });

      // Distribute remaining day slots if any
      let deficit = safeNumDays - allocatedSum;
      while (deficit > 0) {
        let added = false;
        for (const c of chapters) {
          if (deficit > 0 && c.allocatedDays < c.totalTopics) {
            c.allocatedDays++;
            deficit--;
            added = true;
          }
        }
        if (!added) break;
      }

      // If still over safeNumDays (more chapters in family than days), clamp down
      let surplus = allocatedSum - safeNumDays;
      while (surplus > 0) {
        let reduced = false;
        for (const c of chapters) {
          if (surplus > 0 && c.allocatedDays > 1) {
            c.allocatedDays--;
            surplus--;
            reduced = true;
          }
        }
        if (!reduced) break; // Emergency crunch handles chapter count > days
      }
    } else if (totalRequested < maxPossibleDays) {
      // Expansion / Stretch: smoothly stretch chapters so family spans full horizon
      const scale = maxPossibleDays / totalRequested;
      let allocatedSum = 0;

      chapters.forEach((c) => {
        const stretched = Math.round(c.requestedDays * scale);
        c.allocatedDays = Math.min(c.totalTopics, Math.max(c.requestedDays, stretched));
        allocatedSum += c.allocatedDays;
      });

      // Adjust to hit maxPossibleDays exactly if possible
      let deficit = maxPossibleDays - allocatedSum;
      while (deficit > 0) {
        let added = false;
        for (const c of chapters) {
          if (deficit > 0 && c.allocatedDays < c.totalTopics) {
            c.allocatedDays++;
            deficit--;
            added = true;
          }
        }
        if (!added) break;
      }
    } else {
      chapters.forEach((c) => {
        c.allocatedDays = Math.min(c.totalTopics, c.requestedDays);
      });
    }
  });

  // 4. Daily Allocation Loop
  let cardCounter = 0;

  for (let d = 1; d <= safeNumDays; d++) {
    const daysRemaining = safeNumDays - d + 1;
    const dayKey = `Day ${d}`;
    const dayCards: BoardCard[] = [];

    // Identify which subjects are available to schedule on Day d
    const activeSubjects = subjectList.filter((s) => s.activeChapterIdx < s.chapters.length);
    if (activeSubjects.length === 0) break;

    // Calculate total remaining chapter-days across all incomplete chapters
    const totalRemainingChapterDays = activeSubjects.reduce((acc, s) => {
      let subjDays = 0;
      for (let i = s.activeChapterIdx; i < s.chapters.length; i++) {
        const ch = s.chapters[i];
        subjDays += Math.max(1, ch.allocatedDays - ch.daysStudied);
      }
      return acc + subjDays;
    }, 0);

    // Determine target concurrent subjects/chapters for Day d
    const targetConcurrency = Math.max(
      1,
      Math.min(
        activeSubjects.length,
        Math.ceil(totalRemainingChapterDays / daysRemaining)
      )
    );

    // Filter eligible candidate chapters for today
    // Rule 2: A subject can only have 1 chapter per day UNLESS emergency crunch applies
    const eligibleChapters: { chapter: InternalChapter; subjectObj: InternalSubject }[] = [];

    activeSubjects.forEach((s) => {
      const remainingChaptersForSubj = s.chapters.length - s.activeChapterIdx;
      const isEmergencyCrunch = remainingChaptersForSubj > daysRemaining;

      // Has this subject already scheduled a chapter today?
      if (s.lastScheduledDay === d && !isEmergencyCrunch) {
        return; // Subject must wait for next day
      }

      const activeCh = s.chapters[s.activeChapterIdx];
      if (activeCh && activeCh.remainingTopics.length > 0) {
        eligibleChapters.push({ chapter: activeCh, subjectObj: s });
      }
    });

    // Sort eligible chapters by priority rank (highest priority first)
    eligibleChapters.sort((a, b) => a.chapter.priorityRank - b.chapter.priorityRank);

    // Select chapters for Day d, strictly prioritizing distinct Base-Subject Families
    const selectedForToday: { chapter: InternalChapter; subjectObj: InternalSubject }[] = [];
    const usedFamilies = new Set<string>();

    // Pass 1: Select distinct base-subject families in priority order
    for (const item of eligibleChapters) {
      if (!usedFamilies.has(item.chapter.baseFamily)) {
        selectedForToday.push(item);
        usedFamilies.add(item.chapter.baseFamily);
        if (selectedForToday.length >= targetConcurrency) break;
      }
    }

    // Pass 2: Add additional chapter from an already-represented family ONLY if forced by Emergency Crunch
    // (Never allow Paper 1 and Paper 2 of the same base family on the same day unless emergency crunch forces it)
    if (selectedForToday.length < targetConcurrency) {
      for (const item of eligibleChapters) {
        if (!selectedForToday.includes(item)) {
          const family = item.chapter.baseFamily;
          const familyRemainingChapters = activeSubjects
            .filter((s) => s.baseFamily === family)
            .reduce((sum, s) => sum + (s.chapters.length - s.activeChapterIdx), 0);
          const isFamilyCrunch = familyRemainingChapters > daysRemaining;

          if (isFamilyCrunch || usedFamilies.size === 0) {
            selectedForToday.push(item);
            usedFamilies.add(family);
            if (selectedForToday.length >= targetConcurrency) break;
          }
        }
      }
    }

    // Allocate topics for each selected chapter today
    for (const { chapter, subjectObj } of selectedForToday) {
      const remTopics = chapter.remainingTopics.length;
      if (remTopics === 0) continue;

      const remAllocatedDays = Math.max(1, chapter.allocatedDays - chapter.daysStudied);

      let topicsCountToday: number;
      if (d === safeNumDays || daysRemaining === 1) {
        // Last day: complete all remaining topics
        topicsCountToday = remTopics;
      } else {
        // Smoothly pace topics: ceil(remTopics / remAllocatedDays)
        topicsCountToday = Math.min(remTopics, Math.max(1, Math.ceil(remTopics / remAllocatedDays)));
      }

      const chunkTopics = chapter.remainingTopics.splice(0, topicsCountToday);
      chapter.daysStudied++;

      // Day tracking
      const wasStarted = chapter.firstScheduledDay !== undefined;
      if (!wasStarted) {
        chapter.firstScheduledDay = d;
      }
      chapter.lastScheduledDay = d;
      subjectObj.lastScheduledDay = d;

      const cardDuration = chunkTopics.reduce((acc, t) => acc + t.durationMinutes, 0);

      const card: BoardCard = {
        id: `${chapter.chapterId}-d${d}-${cardCounter++}`,
        chapterId: chapter.chapterId,
        chapterName: chapter.chapterName,
        subject: chapter.subject,
        title: chapter.chapterName || chapter.subject,
        durationMinutes: cardDuration,
        tag: chapter.tag || 'Core Concept',
        dayNumber: d,
        topics: chunkTopics.map((top) => ({
          ...top,
          dayNumber: d,
          isCarriedOver: false,
        })),
        isCarriedOver: false,
      };

      dayCards.push(card);

      // Rule 1: Advance to next chapter ONLY when current chapter has 0 remaining topics
      if (chapter.remainingTopics.length === 0) {
        subjectObj.activeChapterIdx++;
      }
    }

    allocation[dayKey] = dayCards;
  }

  // 5. Overflow / Emergency Cleanup: Ensure 100% of topics are allocated within safeNumDays
  const remainingIncompleteSubjects = subjectList.filter((s) => s.activeChapterIdx < s.chapters.length);
  if (remainingIncompleteSubjects.length > 0) {
    const lastDayKey = `Day ${safeNumDays}`;
    const lastDayCards = allocation[lastDayKey] || [];

    remainingIncompleteSubjects.forEach((s) => {
      while (s.activeChapterIdx < s.chapters.length) {
        const ch = s.chapters[s.activeChapterIdx];
        if (ch.remainingTopics.length > 0) {
          const unassigned = ch.remainingTopics.splice(0, ch.remainingTopics.length);
          const wasStarted = ch.firstScheduledDay !== undefined;
          if (!wasStarted) {
            ch.firstScheduledDay = safeNumDays;
          }

          const cardDuration = unassigned.reduce((acc, t) => acc + t.durationMinutes, 0);

          lastDayCards.push({
            id: `${ch.chapterId}-d${safeNumDays}-overflow-${cardCounter++}`,
            chapterId: ch.chapterId,
            chapterName: ch.chapterName,
            subject: ch.subject,
            title: ch.chapterName || ch.subject,
            durationMinutes: cardDuration,
            tag: ch.tag || 'Core Concept',
            dayNumber: safeNumDays,
            topics: unassigned.map((top) => ({
              ...top,
              dayNumber: safeNumDays,
              isCarriedOver: false,
            })),
            isCarriedOver: false,
          });
        }
        s.activeChapterIdx++;
      }
    });

    allocation[lastDayKey] = lastDayCards;
    warnings.push(
      `Plan compressed all topics within ${safeNumDays} days to guarantee full exam readiness.`
    );
  }

  // 5.5 Multi-Day Part Decoration: Assign isMultiDayPart & partInfo ("Part 1/3") without fake backlog flags
  const chapterDayAppearances = new Map<string, number[]>();
  for (let d = 1; d <= safeNumDays; d++) {
    const dayKey = `Day ${d}`;
    const dayCards = allocation[dayKey] || [];
    dayCards.forEach((c) => {
      const chId = c.chapterId || c.title;
      if (!chId) return;
      const list = chapterDayAppearances.get(chId) || [];
      if (!list.includes(d)) {
        list.push(d);
        chapterDayAppearances.set(chId, list);
      }
    });
  }

  for (let d = 1; d <= safeNumDays; d++) {
    const dayKey = `Day ${d}`;
    const dayCards = allocation[dayKey] || [];
    dayCards.forEach((c) => {
      const chId = c.chapterId || c.title;
      const days = chId ? chapterDayAppearances.get(chId) || [d] : [d];
      const totalParts = days.length;
      const partIndex = days.indexOf(d) + 1;

      // Cleanly clear fake backlog flags
      c.isCarriedOver = false;
      c.carriedOverFromDay = undefined;

      if (totalParts > 1 && partIndex > 0) {
        c.isMultiDayPart = true;
        c.partInfo = `Part ${partIndex}/${totalParts}`;
      } else {
        c.isMultiDayPart = false;
        c.partInfo = undefined;
      }

      if (Array.isArray(c.topics)) {
        c.topics.forEach((top) => {
          top.isCarriedOver = false;
          top.carriedOverFromDay = undefined;
          top.isMultiDayPart = c.isMultiDayPart;
          top.partInfo = c.partInfo;
        });
      }
    });
  }

  // 6. Capacity and Workload Warnings
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
