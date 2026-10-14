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

  // Derive runtime constraints (Absolute Guardrail 2: No Hardcoding)
  const totalMinutes = topics.reduce((sum: number, t: SyllabusItem) => sum + (t.durationMinutes || 45), 0);
  const distinctSubjects = new Set(topics.map((t) => t.subject));
  const totalDistinctSubjects = distinctSubjects.size;
  const maxSubjectsPerDay = Math.max(
    1,
    Math.min(
      totalDistinctSubjects,
      Math.max(
        Math.ceil(totalDistinctSubjects / Math.max(1, numDays)),
        Math.min(totalDistinctSubjects, 3)
      )
    )
  );
  const chapterDailyCap = Math.max(
    dailyCapacityMinutes,
    Math.ceil(totalMinutes / Math.max(1, numDays))
  );

  // Phase 1: Sequential Chapter Allocation with Single-Day Preference & Non-Splitting Priority
  let currentDayNum = 1;

  for (let bIndex = 0; bIndex < bucketsList.length; bIndex++) {
    const bucket = bucketsList[bIndex];
    // Create a copy of topics to avoid mutating
    const bucketTopics = [...bucket.topics];

    while (bucketTopics.length > 0) {
      let placedSome = false;

      for (let d = currentDayNum; d <= numDays; d++) {
        const day = dayStates[d];

        const chunk: SyllabusItem[] = [];
        let chunkDuration = 0;
        let subjectLimitExceeded = false;
        let capacityExceeded = false;

        for (let i = 0; i < bucketTopics.length; i++) {
          const topic = bucketTopics[i];
          const dur = topic.durationMinutes || 45;
          const chId = topic.chapterId || topic.chapterName || topic.subject;
          const currentChMins = (day.chapterMinutes.get(chId) || 0) + chunkDuration;

          // Rule B: Chapter daily cap (derived at runtime)
          if (currentChMins + dur > chapterDailyCap) {
            break;
          }

          // Rule A: Daily subject limit (derived at runtime)
          const wouldExceedSubjectLimit = !day.placedSubjects.has(topic.subject) && day.placedSubjects.size >= maxSubjectsPerDay;
          if (wouldExceedSubjectLimit) {
            subjectLimitExceeded = true;
            break;
          }

          // Rule R2: Day capacity
          if (dur > day.remainingCapacity - chunkDuration) {
            capacityExceeded = true;
            break;
          }

          chunk.push(topic);
          chunkDuration += dur;
        }

        // Smart Non-Splitting Heuristic:
        // If we can only place SOME topics of this chapter because of capacity (capacityExceeded === true),
        // and we are NOT on the last day, and the remaining topics can fit entirely on a single day,
        // then we defer this chapter to the next day to keep it intact.
        if (capacityExceeded && d < numDays) {
          const totalRemainingChDur = bucketTopics.reduce((sum: number, t: SyllabusItem) => sum + (t.durationMinutes || 45), 0);
          if (totalRemainingChDur <= dailyCapacityMinutes && totalRemainingChDur <= chapterDailyCap) {
            currentDayNum = d + 1;
            continue; // Go to next day
          }
        }

        if (subjectLimitExceeded && d < numDays) {
          currentDayNum = d + 1;
          continue; // Go to next day
        }

        if (chunk.length > 0) {
          day.placedTopics.push(...chunk);
          day.remainingCapacity -= chunkDuration;
          day.placedSubjects.add(bucket.subject);
          day.placedChapters.add(bucket.chapterId);
          day.lastSubject = bucket.subject;

          const currentMins = day.chapterMinutes.get(bucket.chapterId) || 0;
          day.chapterMinutes.set(bucket.chapterId, currentMins + chunkDuration);

          bucketTopics.splice(0, chunk.length);
          placedSome = true;
          currentDayNum = d;
          break; // re-evaluate remaining topics of this chapter
        } else {
          // If chunk is empty and we're not on the last day, move forward
          if (d < numDays) {
            currentDayNum = d + 1;
          } else {
            // Last day fallback: force-place what can fit respecting Rule A and Rule B
            const forceChunk: SyllabusItem[] = [];
            let forceDuration = 0;

            for (let i = 0; i < bucketTopics.length; i++) {
              const topic = bucketTopics[i];
              const dur = topic.durationMinutes || 45;
              const chId = topic.chapterId || topic.chapterName || topic.subject;
              const currentChMins = (day.chapterMinutes.get(chId) || 0) + forceDuration;

              if (currentChMins + dur > chapterDailyCap) break;
              const wouldExceedSubjectLimit = !day.placedSubjects.has(topic.subject) && day.placedSubjects.size >= maxSubjectsPerDay;
              if (wouldExceedSubjectLimit) break;

              forceChunk.push(topic);
              forceDuration += dur;
            }

            if (forceChunk.length > 0) {
              day.placedTopics.push(...forceChunk);
              day.remainingCapacity -= forceDuration;
              day.placedSubjects.add(bucket.subject);
              day.placedChapters.add(bucket.chapterId);
              day.lastSubject = bucket.subject;

              const currentMins = day.chapterMinutes.get(bucket.chapterId) || 0;
              day.chapterMinutes.set(bucket.chapterId, currentMins + forceDuration);

              bucketTopics.splice(0, forceChunk.length);
              placedSome = true;
            } else {
              // Try any day from 1..numDays
              let fallbackDayFound = false;
              for (let fd = 1; fd <= numDays; fd++) {
                const fday = dayStates[fd];
                const hasSubjectOrSlot = fday.placedSubjects.has(bucket.subject) || fday.placedSubjects.size < maxSubjectsPerDay;
                if (hasSubjectOrSlot) {
                  const fChunk: SyllabusItem[] = [];
                  let fDuration = 0;
                  for (let i = 0; i < bucketTopics.length; i++) {
                    const topic = bucketTopics[i];
                    const dur = topic.durationMinutes || 45;
                    const chId = topic.chapterId || topic.chapterName || topic.subject;
                    const currentChMins = (fday.chapterMinutes.get(chId) || 0) + fDuration;

                    if (currentChMins + dur > chapterDailyCap) break;

                    fChunk.push(topic);
                    fDuration += dur;
                  }

                  if (fChunk.length > 0) {
                    fday.placedTopics.push(...fChunk);
                    fday.remainingCapacity -= fDuration;
                    fday.placedSubjects.add(bucket.subject);
                    fday.placedChapters.add(bucket.chapterId);
                    fday.lastSubject = bucket.subject;

                    const currentMins = fday.chapterMinutes.get(bucket.chapterId) || 0;
                    fday.chapterMinutes.set(bucket.chapterId, currentMins + fDuration);

                    bucketTopics.splice(0, fChunk.length);
                    placedSome = true;
                    fallbackDayFound = true;
                    break;
                  }
                }
              }

              if (!fallbackDayFound) {
                // Last absolute fallback: Day 1
                const fday = dayStates[1];
                const t = bucketTopics[0];
                const dur = t.durationMinutes || 45;
                fday.placedTopics.push(t);
                fday.remainingCapacity -= dur;
                fday.placedSubjects.add(bucket.subject);
                fday.placedChapters.add(bucket.chapterId);
                fday.lastSubject = bucket.subject;
                
                bucketTopics.splice(0, 1);
                placedSome = true;
              }
            }
            break;
          }
        }
      }

      if (!placedSome) {
        if (currentDayNum < numDays) {
          currentDayNum++;
        } else {
          // Force consume first topic to guarantee termination
          const day = dayStates[numDays];
          const t = bucketTopics[0];
          const dur = t.durationMinutes || 45;
          day.placedTopics.push(t);
          day.remainingCapacity -= dur;
          day.placedSubjects.add(t.subject);
          day.placedChapters.add(bucket.chapterId);
          day.lastSubject = t.subject;
          bucketTopics.splice(0, 1);
        }
      }
    }
  }

  // Phase 3: validation and warnings
  // 1. Total minutes > numDays * dailyCapacityMinutes
  if (totalMinutes > numDays * dailyCapacityMinutes) {
    warnings.push(
      `Plan cannot fit even at full capacity (Total ${totalMinutes} mins needed, total target window capacity is ${numDays * dailyCapacityMinutes} mins).`
    );
  }

  // 2. Any day exceeding capacity
  for (let d = 1; d <= numDays; d++) {
    const day = dayStates[d];
    const totalDayMins = day.placedTopics.reduce((sum: number, t: SyllabusItem) => sum + (t.durationMinutes || 45), 0);
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
      const cardTotalMins = group.topics.reduce((sum: number, t: SyllabusItem) => sum + (t.durationMinutes || 45), 0);
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
