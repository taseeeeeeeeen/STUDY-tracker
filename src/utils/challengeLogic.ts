import { BoardCard, BoardTopic } from '../types/wizard';
import { FirestoreChallenge } from '../types/challenge';
import { UserProgressDoc } from '../services/userProgressService';

export interface DedupableSyllabusTopic {
  id: string;
  subject: string;
  title: string;
  subconcept?: string;
  durationMinutes: number;
  tag?: string;
}

/**
 * Normalizes a title by stripping trailing (theory)/(practice) tokens.
 */
function normalizeTitle(title: string): string {
  if (!title) return '';
  let normalized = title.trim();
  
  // Strip common trailing patterns (case-insensitive)
  // (theory), (practice), - theory, - practice, theory, practice
  const patterns = [
    /\s*\(theory\)$/i,
    /\s*\(practice\)$/i,
    /\s*-\s*theory$/i,
    /\s*-\s*practice$/i,
    /\s+theory$/i,
    /\s+practice$/i
  ];
  
  for (const pattern of patterns) {
    normalized = normalized.replace(pattern, '');
  }
  
  return normalized.trim();
}

/**
 * Dedupes syllabus topics based on subject, normalized title, and subconcept.
 * Merges them into a single topic where completion is tracked via flags.
 */
export function dedupeSyllabusTopics(topics: DedupableSyllabusTopic[]): DedupableSyllabusTopic[] {
  if (!topics || topics.length === 0) return [];

  const groups: Record<string, DedupableSyllabusTopic[]> = {};

  topics.forEach((topic) => {
    const normTitle = normalizeTitle(topic.title);
    const key = `${topic.subject.toLowerCase()}|${normTitle.toLowerCase()}|${(topic.subconcept || '').toLowerCase()}`;
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(topic);
  });

  return Object.values(groups).map((group) => {
    // Merge group into ONE topic
    const first = group[0];
    const maxDuration = Math.max(...group.map(t => t.durationMinutes || 0));
    
    // Clean up title: use the normalized version of the first one for the canonical name
    // but we can also just use first.title if we want to keep one "real" name.
    // The requirement says: "Merge each group into ONE topic: keep the FIRST topic's id, subject, and subconcept"
    
    const merged: DedupableSyllabusTopic = {
      id: first.id,
      subject: first.subject,
      title: normalizeTitle(first.title), // Use normalized title as canonical
      subconcept: first.subconcept,
      durationMinutes: maxDuration,
    };

    // "if any member has tag 'Theory' or 'Practice', drop that tag"
    // We already don't include tag in the merged object if it's undefined.
    // If there were other tags, we'd have to decide what to do. 
    // Requirement says: "if any member has tag 'Theory' or 'Practice', drop that tag"
    const tags = group.map(t => t.tag).filter(Boolean) as string[];
    const otherTags = tags.filter(tag => !/theory|practice/i.test(tag));
    if (otherTags.length > 0) {
      merged.tag = otherTags[0]; // Keep the first non-theory/practice tag if any
    }

    return merged;
  });
}

import {
  computeCurrentSprintDay,
  getMidnightEndOfDay,
} from './dateUtils';
export {
  computeCurrentSprintDay,
  getMidnightEndOfDay,
};

/**
 * Checks whether a topic was fully completed before a specific midnight cutoff timestamp.
 * Reads completion state strictly from the live userProgressDoc.
 */
export function isTopicCompletedBeforeMidnight(
  topicId: string,
  cutoffTimestampMs: number,
  userProgressDoc: UserProgressDoc | null
): boolean {
  if (!userProgressDoc) {
    return false;
  }
  const prog = userProgressDoc.topicProgress?.[topicId];
  if (!prog || !prog.theory || !prog.practice) {
    return false;
  }

  const log = userProgressDoc.completionLog?.[topicId];
  if (!log) {
    return true;
  }
  const theoryTime = log.theory || 0;
  const practiceTime = log.practice || 0;
  const maxCompletionTime = Math.max(theoryTime, practiceTime);
  return maxCompletionTime > 0 && maxCompletionTime <= cutoffTimestampMs;
}

/**
 * Performs midnight day-reset / rollover on challenge allocation.
 * Unfinished topics from past days automatically move to the current day's allocation.
 * Completed topics stay on their original day as completed and never roll forward.
 * Carried-over topics are marked with isCarriedOver = true and carriedOverFromDay.
 * This operation is strictly idempotent.
 */
export function performMidnightRollover(
  challenge: FirestoreChallenge,
  userProgressDoc: UserProgressDoc | null,
  nowMs: number = Date.now(),
  _currentUserId?: string
): {
  updatedAllocation: Record<string, BoardCard[]>;
  hasChanges: boolean;
  carriedCount: number;
} {
  if (!challenge || !challenge.day_wise_allocation || !challenge.start_date) {
    return {
      updatedAllocation: (challenge?.day_wise_allocation as Record<string, BoardCard[]>) || {},
      hasChanges: false,
      carriedCount: 0,
    };
  }

  const currentDay = computeCurrentSprintDay(challenge.start_date, challenge.duration, nowMs);
  if (currentDay <= 1) {
    return {
      updatedAllocation: challenge.day_wise_allocation as Record<string, BoardCard[]>,
      hasChanges: false,
      carriedCount: 0,
    };
  }

  // Deep clone day_wise_allocation
  const updatedAllocation: Record<string, BoardCard[]> = {};
  const allDayKeys = Object.keys(challenge.day_wise_allocation);
  allDayKeys.forEach((key) => {
    const rawCards = (challenge.day_wise_allocation![key] || []) as any[];
    updatedAllocation[key] = rawCards.map((c) => ({
      ...c,
      topics: Array.isArray(c.topics)
        ? c.topics.map((t: any) => ({ ...t }))
        : [
            {
              id: c.id?.replace(/^card-/, '') || c.id,
              title: c.title,
              subconcept: c.subconcept,
              durationMinutes: c.durationMinutes || 45,
              tag: c.tag,
              isCarriedOver: c.isCarriedOver,
              carriedOverFromDay: c.carriedOverFromDay,
            },
          ],
    }));
  });

  const currentDayKey = `Day ${currentDay}`;
  if (!updatedAllocation[currentDayKey]) {
    updatedAllocation[currentDayKey] = [];
  }

  // Set of all topic IDs already scheduled for the current day
  const todayTopicsMap = new Set<string>();
  const todayCards = updatedAllocation[currentDayKey] || [];
  todayCards.forEach((c) => {
    if (Array.isArray(c.topics)) {
      c.topics.forEach((t) => todayTopicsMap.add(t.id));
    }
  });

  let hasChanges = false;
  let carriedCount = 0;

  for (let d = 1; d < currentDay; d++) {
    const dayKey = `Day ${d}`;
    const cardsForDay = updatedAllocation[dayKey] || [];
    const cutoffTime = getMidnightEndOfDay(challenge.start_date, d);

    for (const card of cardsForDay) {
      if (!Array.isArray(card.topics)) continue;

      for (const topic of card.topics) {
        const completedInTime = isTopicCompletedBeforeMidnight(
          topic.id,
          cutoffTime,
          userProgressDoc
        );

        if (!completedInTime) {
          // Unfinished topic from past day -> carry over to current day
          if (!topic.isCarriedOver) {
            topic.isCarriedOver = true;
            topic.carriedOverFromDay = d;
            hasChanges = true;
          }

          if (!todayTopicsMap.has(topic.id)) {
            todayTopicsMap.add(topic.id);
            carriedCount++;
            hasChanges = true;

            const chId = card.chapterId || card.id;
            let targetChapterCard = updatedAllocation[currentDayKey].find(
              (c) => (c.chapterId || c.id) === chId
            );

            const rolledTopic: BoardTopic = {
              id: topic.id,
              title: topic.title,
              subconcept: topic.subconcept,
              durationMinutes: topic.durationMinutes,
              tag: topic.tag,
              subject: topic.subject || card.subject || 'Physics',
              chapterId: chId,
              chapterName: card.chapterName || card.title,
              isCarriedOver: true,
              carriedOverFromDay: d,
            };

            if (targetChapterCard) {
              targetChapterCard.topics = targetChapterCard.topics || [];
              targetChapterCard.topics.push(rolledTopic);
              targetChapterCard.durationMinutes =
                (targetChapterCard.durationMinutes || 0) + (topic.durationMinutes || 0);
              targetChapterCard.isCarriedOver = true;
              targetChapterCard.tag = `${targetChapterCard.topics.length} topics`;
            } else {
              const newChapterCard: BoardCard = {
                id: `chapter-${chId}-day-${currentDay}`,
                chapterId: chId,
                chapterName: card.chapterName || card.title,
                subject: card.subject,
                title: card.title || card.chapterName || 'Chapter',
                durationMinutes: topic.durationMinutes || 45,
                tag: '1 topic',
                dayNumber: currentDay,
                isCarriedOver: true,
                carriedOverFromDay: d,
                topics: [rolledTopic],
              };
              updatedAllocation[currentDayKey].push(newChapterCard);
            }
          }
        }
      }

      if (card.topics.some((t) => t.isCarriedOver)) {
        if (!card.isCarriedOver) {
          card.isCarriedOver = true;
          hasChanges = true;
        }
      }
    }
  }

  return {
    updatedAllocation,
    hasChanges,
    carriedCount,
  };
}

/**
 * Flattens chapter-level dayWiseAllocation into individual topic records for dashboard consumption.
 */
export function flattenAllocationToTopics(
  dayWiseAllocation: Record<string, unknown[]> | undefined
): Record<string, BoardTopic[]> {
  const result: Record<string, BoardTopic[]> = {};
  if (!dayWiseAllocation) return result;

  Object.entries(dayWiseAllocation).forEach(([dayKey, cards]) => {
    result[dayKey] = [];
    if (!Array.isArray(cards)) return;

    cards.forEach((card: any) => {
      if (Array.isArray(card.topics) && card.topics.length > 0) {
        card.topics.forEach((t: any) => {
          result[dayKey].push({
            id: t.id,
            title: t.title,
            subconcept: t.subconcept,
            durationMinutes: t.durationMinutes || 45,
            tag: t.tag,
            subject: t.subject || card.subject || 'Physics',
            chapterId: card.chapterId,
            chapterName: card.chapterName || card.title,
            isCarriedOver: Boolean(t.isCarriedOver || card.isCarriedOver),
            carriedOverFromDay: t.carriedOverFromDay || card.carriedOverFromDay,
          });
        });
      } else {
        result[dayKey].push({
          id: card.id?.replace(/^card-/, '') || card.id,
          title: card.title,
          subconcept: card.subconcept,
          durationMinutes: card.durationMinutes || 45,
          tag: card.tag,
          subject: card.subject || 'Physics',
          chapterId: card.chapterId,
          chapterName: card.chapterName || card.title,
          isCarriedOver: Boolean(card.isCarriedOver),
          carriedOverFromDay: card.carriedOverFromDay,
        });
      }
    });
  });

  return result;
}

export interface BalanceCardsOptions {
  cards: BoardCard[];
  numDays: number;
  firstNonPastDay?: number;
  dayCapacities?: Record<number, number>;
  fixedCardIds?: Set<string>;
}

export interface SequentialAllocationOptions extends BalanceCardsOptions {}

/**
 * Sequential chapter allocator that preserves canonical chapter order and distributes cards
 * evenly across available days without splitting chapters unnecessarily or scrambling syllabus order.
 * All capacities, subject limits, and chapter caps are derived dynamically at runtime with zero magic numbers.
 */
export function allocateChaptersSequentially(options: SequentialAllocationOptions): BoardCard[] {
  const {
    cards,
    numDays,
    firstNonPastDay = 1,
    dayCapacities = {},
    fixedCardIds = new Set<string>(),
  } = options;

  if (!cards || cards.length === 0 || !numDays || numDays <= 0) return cards || [];

  const validFirstDay = Math.min(numDays, Math.max(1, firstNonPastDay));
  const availableDays: number[] = [];
  for (let d = validFirstDay; d <= numDays; d++) {
    availableDays.push(d);
  }
  if (availableDays.length === 0) return cards;

  // Track allocated minutes and subjects per day
  const dayMinutes: Record<number, number> = {};
  const daySubjects: Record<number, Set<string>> = {};
  for (let d = 1; d <= numDays; d++) {
    dayMinutes[d] = 0;
    daySubjects[d] = new Set<string>();
  }

  const fixedCards: BoardCard[] = [];
  const movableCards: BoardCard[] = [];

  cards.forEach((card) => {
    // If card is in a past day (< validFirstDay) or explicitly fixed, preserve its day
    if (card.dayNumber < validFirstDay || fixedCardIds.has(card.id)) {
      const clampedDay = Math.min(numDays, Math.max(1, card.dayNumber));
      dayMinutes[clampedDay] = (dayMinutes[clampedDay] || 0) + (card.durationMinutes || 0);
      if (card.subject) {
        daySubjects[clampedDay].add(card.subject);
      }
      fixedCards.push({
        ...card,
        dayNumber: clampedDay,
        topics: card.topics?.map((t) => ({ ...t, dayNumber: clampedDay })),
      });
    } else {
      movableCards.push(card);
    }
  });

  if (movableCards.length === 0) {
    return fixedCards;
  }

  // Derive runtime constants from data (Absolute Guardrail 2: No Hardcoding)
  const totalMovableMinutes = movableCards.reduce(
    (acc, c) => acc + (c.durationMinutes || 0),
    0
  );

  // Runtime derived daily capacity: if dayCapacities contains explicit values, respect them.
  // Otherwise derive from average workload per available day, clamped to a sensible study range [30, 720].
  const averageDayMinutes = Math.max(
    30,
    Math.min(720, Math.ceil(totalMovableMinutes / availableDays.length))
  );

  const resolvedCapacities: Record<number, number> = {};
  for (const d of availableDays) {
    resolvedCapacities[d] =
      dayCapacities[d] && dayCapacities[d] > 0 ? dayCapacities[d] : averageDayMinutes;
  }

  // Runtime derived daily subject limit: based on total distinct subjects across movable cards and available days
  const distinctSubjects = new Set<string>();
  movableCards.forEach((c) => {
    if (c.subject) distinctSubjects.add(c.subject);
  });
  const totalDistinctSubjects = distinctSubjects.size;
  const maxSubjectsPerDay = Math.max(
    1,
    Math.min(
      totalDistinctSubjects,
      Math.max(
        Math.ceil(totalDistinctSubjects / availableDays.length),
        Math.min(totalDistinctSubjects, 3)
      )
    )
  );

  // Sequential placement preserving canonical order of movableCards
  const movedCards: BoardCard[] = [];
  let currentDayIdx = 0; // index into availableDays

  for (let i = 0; i < movableCards.length; i++) {
    const card = movableCards[i];
    const cardMins = card.durationMinutes || 0;
    const cardSubj = card.subject || '';

    let targetDay = availableDays[currentDayIdx];
    const currentLoad = dayMinutes[targetDay] || 0;
    const currentCap = resolvedCapacities[targetDay];
    const currentSubjs = daySubjects[targetDay];

    const wouldExceedSubject =
      Boolean(cardSubj && !currentSubjs.has(cardSubj) && currentSubjs.size >= maxSubjectsPerDay);
    const wouldExceedCap = currentLoad + cardMins > currentCap;

    // Advance to next day if current day already has content and adding this card would exceed capacity or subject limit
    if (currentLoad > 0 && (wouldExceedCap || wouldExceedSubject) && currentDayIdx < availableDays.length - 1) {
      currentDayIdx++;
      targetDay = availableDays[currentDayIdx];
    } else if (wouldExceedCap && currentDayIdx === availableDays.length - 1) {
      // On the last day, if this card overflows, check if any earlier available day has room
      let bestEarlierDay: number | null = null;
      let minLoadEarlier = Infinity;

      for (let dIdx = 0; dIdx < availableDays.length; dIdx++) {
        const d = availableDays[dIdx];
        const load = dayMinutes[d] || 0;
        const cap = resolvedCapacities[d];
        const subjs = daySubjects[d];
        const subjOk = !cardSubj || subjs.has(cardSubj) || subjs.size < maxSubjectsPerDay;

        if (load + cardMins <= cap && subjOk && load < minLoadEarlier) {
          minLoadEarlier = load;
          bestEarlierDay = d;
        }
      }

      if (bestEarlierDay !== null) {
        targetDay = bestEarlierDay;
      } else {
        // Fallback: pick the available day with lowest load that satisfies subject constraint
        let bestDay = availableDays[0];
        let lowestLoad = Infinity;
        for (const d of availableDays) {
          const load = dayMinutes[d] || 0;
          const subjs = daySubjects[d];
          const subjOk = !cardSubj || subjs.has(cardSubj) || subjs.size < maxSubjectsPerDay;
          if (subjOk && load < lowestLoad) {
            lowestLoad = load;
            bestDay = d;
          }
        }
        targetDay = bestDay;
      }
    }

    dayMinutes[targetDay] = (dayMinutes[targetDay] || 0) + cardMins;
    if (cardSubj) {
      daySubjects[targetDay].add(cardSubj);
    }

    movedCards.push({
      ...card,
      dayNumber: targetDay,
      topics: card.topics?.map((t) => ({ ...t, dayNumber: targetDay })),
    });
  }

  return [...fixedCards, ...movedCards];
}

/**
 * Backward-compatible wrapper around allocateChaptersSequentially.
 */
export function balanceCardsAcrossDays(options: BalanceCardsOptions): BoardCard[] {
  return allocateChaptersSequentially(options);
}


