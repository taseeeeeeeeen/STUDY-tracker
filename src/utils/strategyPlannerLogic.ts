import { SyllabusItem, BoardCard, BoardTopic } from '../types/wizard';

interface ChapterBucket {
  chapterId: string;
  chapterName: string;
  subject: string;
  topics: SyllabusItem[];
}

interface DayState {
  dayNumber: number;
  remainingCapacity: number;
  placedTopics: SyllabusItem[];
  placedSubjects: Set<string>;
  placedChapters: Set<string>;
  chapterMinutes: Map<string, number>;
  lastSubject?: string;
}

function canAddTopicToDay(day: DayState, topic: SyllabusItem, respectCapacity: boolean): boolean {
  const dur = topic.durationMinutes || 45;
  const chId = topic.chapterId || topic.chapterName || topic.subject;
  const currentChMins = day.chapterMinutes.get(chId) || 0;
  
  // Rule B: Chapter daily cap of 180 minutes
  if (currentChMins + dur > 180) {
    return false;
  }

  // Rule R2: Day capacity
  if (respectCapacity && dur > day.remainingCapacity) {
    return false;
  }

  // Rule A: Daily subject limit (max 3 subjects)
  if (!day.placedSubjects.has(topic.subject) && day.placedSubjects.size >= 3) {
    return false;
  }

  return true;
}

export function buildStrategicRoutine(options: {
  topics: SyllabusItem[];
  numDays: number;
  dailyCapacityMinutes: number;
}): { allocation: Record<string, BoardCard[]>; warnings: string[] } {
  const { topics, numDays, dailyCapacityMinutes } = options;
  const warnings: string[] = [];

  // Phase 0: group topics into chapter buckets, preserving canonical order.
  const bucketsMap = new Map<string, ChapterBucket>();
  const bucketsList: ChapterBucket[] = [];

  topics.forEach((topic) => {
    const chId = topic.chapterId || topic.chapterName || topic.subject;
    let bucket = bucketsMap.get(chId);
    if (!bucket) {
      bucket = {
        chapterId: chId,
        chapterName: topic.chapterName || topic.title,
        subject: topic.subject,
        topics: [],
      };
      bucketsMap.set(chId, bucket);
      bucketsList.push(bucket);
    }
    bucket.topics.push(topic);
  });

  // Track the last day a chapter chunk was placed during Phase 1
  const lastPlacedDay: Record<string, number> = {};
  bucketsList.forEach((b) => {
    lastPlacedDay[b.chapterId] = 0;
  });

  // Initialize day states (1-indexed for convenience)
  const dayStates: Record<number, DayState> = {};
  for (let d = 1; d <= numDays; d++) {
    dayStates[d] = {
      dayNumber: d,
      remainingCapacity: dailyCapacityMinutes,
      placedTopics: [],
      placedSubjects: new Set<string>(),
      placedChapters: new Set<string>(),
      chapterMinutes: new Map<string, number>(),
    };
  }

  // Phase 1: main placement (R1-R6)
  let d = 1;
  let scanStartIndex = 0;
  let consecutiveSkips = 0;

  // We loop until we have scanned all days consecutively and placed nothing, or all buckets are empty
  while (consecutiveSkips < numDays) {
    // Check if all buckets are empty
    const allEmpty = bucketsList.every((b) => b.topics.length === 0);
    if (allEmpty) {
      break;
    }

    const day = dayStates[d];

    // Find the best eligible bucket for Day d
    let bestBucketIndex = -1;
    let bestScore = -1;

    for (let offset = 0; offset < bucketsList.length; offset++) {
      const idx = (scanStartIndex + offset) % bucketsList.length;
      const bucket = bucketsList[idx];

      if (bucket.topics.length === 0) continue;

      // Rule check: must not have been placed on Day d yet
      if (lastPlacedDay[bucket.chapterId] >= d) continue;

      // Rule A check: Day may contain AT MOST 3 distinct subjects
      const isEligibleSubject = day.placedSubjects.has(bucket.subject) || day.placedSubjects.size < 3;
      if (!isEligibleSubject) continue;

      // Rule check: first topic must fit and respect all rules
      if (!canAddTopicToDay(day, bucket.topics[0], true)) continue;

      // Evaluate preference score for soft constraints (R3, R4)
      const isNewSubjectOnDay = !day.placedSubjects.has(bucket.subject); // R3
      const alternatesWithinDay = day.lastSubject === undefined || day.lastSubject !== bucket.subject; // R4
      
      const prevDay = dayStates[d - 1];
      const alternatesConsecutiveDays = prevDay === undefined || prevDay.lastSubject === undefined || prevDay.lastSubject !== bucket.subject; // R4

      // Assign scores in strict priority order:
      // R3 (Single-chapter rule) is the highest priority soft constraint
      // R4 (Subject variation: alternate within day and alternate consecutive days)
      let score = 0;
      if (isNewSubjectOnDay) {
        score += 10;
      }
      if (alternatesWithinDay) {
        score += 5;
      }
      if (alternatesConsecutiveDays) {
        score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestBucketIndex = idx;
      }
    }

    if (bestBucketIndex !== -1) {
      // Place a chunk from this bucket
      const bucket = bucketsList[bestBucketIndex];
      const chunk: SyllabusItem[] = [];
      let chunkDuration = 0;

      for (const topic of bucket.topics) {
        const dur = topic.durationMinutes || 45;
        const chId = topic.chapterId || topic.chapterName || topic.subject;
        const currentChMins = (day.chapterMinutes.get(chId) || 0) + chunkDuration;

        // Rule B: Chapter daily cap (180 min)
        if (currentChMins + dur > 180) break;
        // Rule R2: Day capacity
        if (dur > day.remainingCapacity - chunkDuration) break;
        // Rule A: Daily subject limit
        if (!day.placedSubjects.has(topic.subject) && day.placedSubjects.size >= 3) break;

        chunk.push(topic);
        chunkDuration += dur;
      }

      if (chunk.length > 0) {
        // Append chunk to Day d
        day.placedTopics.push(...chunk);
        day.remainingCapacity -= chunkDuration;
        day.placedSubjects.add(bucket.subject);
        day.placedChapters.add(bucket.chapterId);
        day.lastSubject = bucket.subject;

        const currentMins = day.chapterMinutes.get(bucket.chapterId) || 0;
        day.chapterMinutes.set(bucket.chapterId, currentMins + chunkDuration);

        // Remove placed topics from the bucket
        bucket.topics = bucket.topics.slice(chunk.length);

        // Mark last placed day
        lastPlacedDay[bucket.chapterId] = d;

        // Rotate scanStartIndex
        scanStartIndex = (bestBucketIndex + 1) % bucketsList.length;

        // Reset consecutive skips since we successfully placed a chunk
        consecutiveSkips = 0;
      } else {
        consecutiveSkips++;
      }

      // Move to next day (R6 wrap-around)
      d = (d % numDays) + 1;
    } else {
      // No eligible bucket can be placed on Day d right now
      consecutiveSkips++;
      d = (d % numDays) + 1;
    }
  }

  // Phase 2: leftovers (R7)
  const leftoverTopics: SyllabusItem[] = [];
  bucketsList.forEach((bucket) => {
    if (bucket.topics.length > 0) {
      leftoverTopics.push(...bucket.topics);
    }
  });

  let currentDayForLeftover = 1;
  for (const topic of leftoverTopics) {
    let placed = false;
    let attempts = 0;

    // First pass: try to place topic where it fits capacity AND respects Rule A and Rule B
    while (!placed && attempts < numDays) {
      const day = dayStates[currentDayForLeftover];
      if (canAddTopicToDay(day, topic, true)) {
        const dur = topic.durationMinutes || 45;
        day.placedTopics.push(topic);
        day.remainingCapacity -= dur;
        day.placedSubjects.add(topic.subject);
        day.placedChapters.add(topic.chapterId || topic.chapterName || topic.subject);
        day.lastSubject = topic.subject;

        const chId = topic.chapterId || topic.chapterName || topic.subject;
        const currentMins = day.chapterMinutes.get(chId) || 0;
        day.chapterMinutes.set(chId, currentMins + dur);

        placed = true;
        currentDayForLeftover = (currentDayForLeftover % numDays) + 1;
      } else {
        currentDayForLeftover = (currentDayForLeftover % numDays) + 1;
        attempts++;
      }
    }

    // Second pass: force-place by ignoring capacity, but still respecting Rule A (subjects <= 3) and Rule B (chapter cap <= 180)
    if (!placed) {
      let bestDay: DayState | null = null;
      for (let d = 1; d <= numDays; d++) {
        const day = dayStates[d];
        if (canAddTopicToDay(day, topic, false)) {
          if (!bestDay) {
            bestDay = day;
          } else {
            const countBest = bestDay.placedSubjects.size;
            const countCurr = day.placedSubjects.size;
            if (countCurr < countBest) {
              bestDay = day;
            } else if (countCurr === countBest) {
              const workloadBest = dailyCapacityMinutes - bestDay.remainingCapacity;
              const workloadCurr = dailyCapacityMinutes - day.remainingCapacity;
              if (workloadCurr < workloadBest) {
                bestDay = day;
              }
            }
          }
        }
      }

      // If no day found respecting both, fallback to just respecting subjects <= 3 (hard invariant)
      if (!bestDay) {
        for (let d = 1; d <= numDays; d++) {
          const day = dayStates[d];
          const hasSubjectOrFreeSlot = day.placedSubjects.has(topic.subject) || day.placedSubjects.size < 3;
          if (hasSubjectOrFreeSlot) {
            if (!bestDay) {
              bestDay = day;
            } else {
              const countBest = bestDay.placedSubjects.size;
              const countCurr = day.placedSubjects.size;
              if (countCurr < countBest) {
                bestDay = day;
              } else if (countCurr === countBest) {
                const workloadBest = dailyCapacityMinutes - bestDay.remainingCapacity;
                const workloadCurr = dailyCapacityMinutes - day.remainingCapacity;
                if (workloadCurr < workloadBest) {
                  bestDay = day;
                }
              }
            }
          }
        }
      }

      // If still no day found (which is theoretically impossible unless numDays is 0 or all days have 3 different subjects none of which is topic.subject),
      // we fallback to the currentDayForLeftover day as absolute last resort
      if (!bestDay) {
        bestDay = dayStates[currentDayForLeftover];
      }

      const dur = topic.durationMinutes || 45;
      bestDay.placedTopics.push(topic);
      bestDay.remainingCapacity -= dur;
      bestDay.placedSubjects.add(topic.subject);
      bestDay.placedChapters.add(topic.chapterId || topic.chapterName || topic.subject);
      bestDay.lastSubject = topic.subject;
      
      const chId = topic.chapterId || topic.chapterName || topic.subject;
      const currentMins = bestDay.chapterMinutes.get(chId) || 0;
      bestDay.chapterMinutes.set(chId, currentMins + dur);
      
      placed = true;
      currentDayForLeftover = (bestDay.dayNumber % numDays) + 1;
    }
  }

  // Phase 3: validation and warnings
  // 1. Total minutes > numDays * dailyCapacityMinutes
  const totalMinutes = topics.reduce((sum, t) => sum + (t.durationMinutes || 45), 0);
  if (totalMinutes > numDays * dailyCapacityMinutes) {
    warnings.push(
      `Plan cannot fit even at full capacity (Total ${totalMinutes} mins needed, total target window capacity is ${numDays * dailyCapacityMinutes} mins).`
    );
  }

  // 2. Any day exceeding capacity
  for (let d = 1; d <= numDays; d++) {
    const day = dayStates[d];
    const totalDayMins = day.placedTopics.reduce((sum, t) => sum + (t.durationMinutes || 45), 0);
    if (totalDayMins > dailyCapacityMinutes) {
      warnings.push(`Day ${d} exceeds target capacity because the total workload exceeds available prep window limits.`);
    }
  }

  // 3. Chapters sharing a day (R3 check)
  for (let d = 1; d <= numDays; d++) {
    const day = dayStates[d];
    const subjectChapters: Record<string, Set<string>> = {};
    day.placedTopics.forEach((t) => {
      const chId = t.chapterId || t.chapterName || t.subject;
      if (!subjectChapters[t.subject]) {
        subjectChapters[t.subject] = new Set();
      }
      subjectChapters[t.subject].add(chId);
    });

    for (const [subj, chs] of Object.entries(subjectChapters)) {
      if (chs.size > 1) {
        warnings.push(`Two chapters of ${subj} share Day ${d} because the schedule is tight.`);
      }
    }
  }

  // Phase 4: Construct the final day-by-day allocation matching Record<"Day N", BoardCard[]>
  const allocation: Record<string, BoardCard[]> = {};

  for (let d = 1; d <= numDays; d++) {
    const dayKey = `Day ${d}`;
    const day = dayStates[d];

    // Group the day's placed topics by chapter
    const dayGroupsMap = new Map<string, { chapterId: string; chapterName: string; subject: string; topics: SyllabusItem[] }>();
    day.placedTopics.forEach((t) => {
      const chId = t.chapterId || t.chapterName || t.subject;
      let group = dayGroupsMap.get(chId);
      if (!group) {
        group = {
          chapterId: chId,
          chapterName: t.chapterName || t.title,
          subject: t.subject,
          topics: [],
        };
        dayGroupsMap.set(chId, group);
      }
      group.topics.push(t);
    });

    const dayCards: BoardCard[] = [];
    let cardIndex = 1;
    dayGroupsMap.forEach((group) => {
      const cardTotalMins = group.topics.reduce((sum, t) => sum + (t.durationMinutes || 45), 0);
      const boardTopics: BoardTopic[] = group.topics.map((t) => ({
        id: t.id,
        title: t.title,
        subconcept: t.subconcept,
        durationMinutes: t.durationMinutes || 45,
        tag: t.tag || 'Core Concept',
        subject: t.subject,
        chapterId: group.chapterId,
        chapterName: group.chapterName,
        dayNumber: d,
      }));

      dayCards.push({
        id: `chapter-${group.chapterId}-day-${d}-${cardIndex++}`,
        chapterId: group.chapterId,
        chapterName: group.chapterName,
        subject: group.subject,
        title: group.chapterName,
        durationMinutes: cardTotalMins,
        tag: `${group.topics.length} topic${group.topics.length === 1 ? '' : 's'}`,
        dayNumber: d,
        topics: boardTopics,
      });
    });

    allocation[dayKey] = dayCards;
  }

  return { allocation, warnings };
}
