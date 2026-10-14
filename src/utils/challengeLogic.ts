import { SyllabusItem, BoardCard, BoardTopic } from '../types/wizard';
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

export const ALLOCATION_MAX_SAFE_BYTES = 900000;

/**
 * Validates that an allocation's serialized size is within safe Firestore document limits (under ~900KB).
 */
export function checkAllocationSizeSafe(
  allocation: Record<string, unknown[]> | null | undefined,
  challengeId?: string
): { isSafe: boolean; size: number } {
  if (!allocation) return { isSafe: true, size: 0 };
  try {
    const jsonStr = JSON.stringify(allocation);
    const size = jsonStr ? jsonStr.length : 0;
    if (size > ALLOCATION_MAX_SAFE_BYTES) {
      console.error(
        `[AllocationSizeGuard] Allocation payload size (${size} chars) exceeds safety limit (${ALLOCATION_MAX_SAFE_BYTES} chars) for challenge "${challengeId || 'unknown'}". Write aborted to prevent document corruption.`
      );
      return { isSafe: false, size };
    }
    return { isSafe: true, size };
  } catch (err) {
    console.error(
      `[AllocationSizeGuard] Failed to stringify allocation for challenge "${challengeId}":`,
      err
    );
    return { isSafe: false, size: Infinity };
  }
}

/**
 * Deep-walks an allocation dictionary and recursively strips any `undefined`, function,
 * or non-JSON value, ensuring only plain JSON values are emitted.
 * Preserves the key order of "Day N" keys and never alters valid data.
 */
export function sanitizeAllocation<T = unknown>(
  allocation: Record<string, T[]> | null | undefined
): Record<string, T[]> {
  if (!allocation || typeof allocation !== 'object') {
    return {};
  }

  const cleanNode = (node: unknown): unknown => {
    if (node === null || node === undefined) return undefined;
    if (typeof node === 'function' || typeof node === 'symbol') return undefined;
    if (typeof node === 'number') {
      return isNaN(node) || !isFinite(node) ? 0 : node;
    }
    if (typeof node === 'string' || typeof node === 'boolean') {
      return node;
    }
    if (node instanceof Date) {
      return node.toISOString();
    }
    if (Array.isArray(node)) {
      return node
        .map(cleanNode)
        .filter((item) => item !== undefined);
    }
    if (typeof node === 'object') {
      const cleanObj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        const cleaned = cleanNode(v);
        if (cleaned !== undefined) {
          cleanObj[k] = cleaned;
        }
      }
      return cleanObj;
    }
    return undefined;
  };

  const result: Record<string, T[]> = {};
  for (const [key, list] of Object.entries(allocation)) {
    if (Array.isArray(list)) {
      result[key] = list
        .map((item) => cleanNode(item))
        .filter((item): item is T => item !== undefined);
    } else {
      result[key] = [];
    }
  }

  return result;
}

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

  // Derive runtime fallback duration from existing cards
  const detectedRolloverDurations: number[] = [];
  let detectedRolloverSubject = '';
  Object.values(challenge.day_wise_allocation).forEach((cards) => {
    if (Array.isArray(cards)) {
      cards.forEach((c: any) => {
        if (!detectedRolloverSubject && c?.subject) detectedRolloverSubject = c.subject;
        if (typeof c?.durationMinutes === 'number' && c.durationMinutes > 0) {
          detectedRolloverDurations.push(c.durationMinutes);
        }
        if (Array.isArray(c?.topics)) {
          c.topics.forEach((t: any) => {
            if (!detectedRolloverSubject && t?.subject) detectedRolloverSubject = t.subject;
            if (typeof t?.durationMinutes === 'number' && t.durationMinutes > 0) {
              detectedRolloverDurations.push(t.durationMinutes);
            }
          });
        }
      });
    }
  });
  const runtimeFallbackDuration =
    detectedRolloverDurations.length > 0
      ? Math.round(detectedRolloverDurations.reduce((a, b) => a + b, 0) / detectedRolloverDurations.length)
      : 30;

  // Deep clone day_wise_allocation
  const updatedAllocation: Record<string, BoardCard[]> = {};
  const allDayKeys = Object.keys(challenge.day_wise_allocation);
  allDayKeys.forEach((key) => {
    const rawCards = (challenge.day_wise_allocation![key] || []) as any[];
    const dayNumFromKey = parseInt(key.replace(/\D/g, ''), 10) || 1;
    updatedAllocation[key] = rawCards.map((c) => {
      const cardDay = typeof c.dayNumber === 'number' ? c.dayNumber : dayNumFromKey;

      let chId = c.chapterId;
      if (!chId && c.id) {
        const lastDayIdx = c.id.lastIndexOf('-day-');
        if (lastDayIdx !== -1) {
          chId = c.id.slice(0, lastDayIdx).replace(/^chapter-/, '');
        } else {
          chId = c.id.replace(/^chapter-/, '');
        }
      }
      chId = chId || c.chapterName || c.title || '';
      const chapterName = c.chapterName || c.title || 'Chapter';

      const cardTopics: BoardTopic[] = Array.isArray(c.topics) && c.topics.length > 0
        ? c.topics.map((t: any) => {
            const top: BoardTopic = {
              id: t.id,
              title: t.title || 'Topic',
              durationMinutes: typeof t.durationMinutes === 'number' && t.durationMinutes > 0
                ? t.durationMinutes
                : (typeof c.durationMinutes === 'number' && c.durationMinutes > 0 ? c.durationMinutes : runtimeFallbackDuration),
              subject: t.subject || c.subject || detectedRolloverSubject || '',
              chapterId: t.chapterId || chId,
              chapterName: t.chapterName || chapterName,
              dayNumber: typeof t.dayNumber === 'number' ? t.dayNumber : cardDay,
              tag: t.tag || c.tag || 'Core Concept',
            };
            if (t.subconcept) top.subconcept = t.subconcept;
            if (t.isCarriedOver) {
              top.isCarriedOver = true;
              if (typeof t.carriedOverFromDay === 'number') {
                top.carriedOverFromDay = t.carriedOverFromDay;
              }
            }
            return top;
          })
        : [
            {
              id: c.id?.replace(/^card-/, '') || c.id || `topic-${key}`,
              title: c.title || chapterName,
              durationMinutes: typeof c.durationMinutes === 'number' && c.durationMinutes > 0
                ? c.durationMinutes
                : runtimeFallbackDuration,
              subject: c.subject || detectedRolloverSubject || '',
              chapterId: chId,
              chapterName,
              dayNumber: cardDay,
              tag: c.tag || 'Core Concept',
              ...(c.subconcept ? { subconcept: c.subconcept } : {}),
              ...(c.isCarriedOver ? { isCarriedOver: true } : {}),
              ...(typeof c.carriedOverFromDay === 'number' ? { carriedOverFromDay: c.carriedOverFromDay } : {}),
            },
          ];

      const cardObj: BoardCard = {
        id: c.id,
        chapterId: chId,
        chapterName,
        subject: c.subject || detectedRolloverSubject || '',
        title: c.title || chapterName,
        durationMinutes: typeof c.durationMinutes === 'number' ? c.durationMinutes : cardTopics.reduce((s, t) => s + t.durationMinutes, 0),
        tag: c.tag || `${cardTopics.length} ${cardTopics.length === 1 ? 'topic' : 'topics'}`,
        dayNumber: cardDay,
        topics: cardTopics,
        ...(c.isCarriedOver ? { isCarriedOver: true } : {}),
        ...(typeof c.carriedOverFromDay === 'number' ? { carriedOverFromDay: c.carriedOverFromDay } : {}),
      };
      return cardObj;
    });
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
    let dayHadMoves = false;

    for (const card of cardsForDay) {
      if (!Array.isArray(card.topics)) continue;

      const remainingTopics: BoardTopic[] = [];

      for (const topic of card.topics) {
        const completedInTime = isTopicCompletedBeforeMidnight(
          topic.id,
          cutoffTime,
          userProgressDoc
        );

        if (!completedInTime) {
          // Unfinished topic from past day -> move to current day
          hasChanges = true;
          dayHadMoves = true;

          const carriedFrom = typeof topic.carriedOverFromDay === 'number' && topic.carriedOverFromDay > 0
            ? topic.carriedOverFromDay
            : d;

          if (!todayTopicsMap.has(topic.id)) {
            todayTopicsMap.add(topic.id);
            carriedCount++;

            const chId = card.chapterId || card.id;
            let targetChapterCard = updatedAllocation[currentDayKey].find(
              (c) => (c.chapterId || c.id) === chId
            );

            const rolledTopic: BoardTopic = {
              id: topic.id,
              title: topic.title,
              durationMinutes: topic.durationMinutes || runtimeFallbackDuration,
              tag: topic.tag || 'Core Concept',
              subject: topic.subject || card.subject || detectedRolloverSubject || '',
              chapterId: chId,
              chapterName: card.chapterName || card.title || 'Chapter',
              dayNumber: currentDay,
              isCarriedOver: true,
              carriedOverFromDay: carriedFrom,
              ...(topic.subconcept ? { subconcept: topic.subconcept } : {}),
            };

            if (targetChapterCard) {
              targetChapterCard.topics = targetChapterCard.topics || [];
              targetChapterCard.topics.push(rolledTopic);
              targetChapterCard.durationMinutes =
                (targetChapterCard.durationMinutes || 0) + rolledTopic.durationMinutes;
              targetChapterCard.isCarriedOver = true;
              targetChapterCard.tag = `${targetChapterCard.topics.length} ${targetChapterCard.topics.length === 1 ? 'topic' : 'topics'}`;
            } else {
              const newChapterCard: BoardCard = {
                id: `chapter-${chId}-day-${currentDay}`,
                chapterId: chId,
                chapterName: card.chapterName || card.title || 'Chapter',
                subject: card.subject || topic.subject || detectedRolloverSubject || '',
                title: card.title || card.chapterName || 'Chapter',
                durationMinutes: rolledTopic.durationMinutes,
                tag: '1 topic',
                dayNumber: currentDay,
                isCarriedOver: true,
                carriedOverFromDay: carriedFrom,
                topics: [rolledTopic],
              };
              updatedAllocation[currentDayKey].push(newChapterCard);
            }
          }
          // Do not push to remainingTopics -> moves out of past day
        } else {
          // Completed in time -> remains on original day
          remainingTopics.push(topic);
        }
      }

      card.topics = remainingTopics;
      card.durationMinutes = remainingTopics.reduce((s, t) => s + (t.durationMinutes || 0), 0);
      card.tag = `${remainingTopics.length} ${remainingTopics.length === 1 ? 'topic' : 'topics'}`;
    }

    if (dayHadMoves) {
      // Prune cards with empty topics list from the past day
      updatedAllocation[dayKey] = cardsForDay.filter(
        (c) => Array.isArray(c.topics) && c.topics.length > 0
      );
    }
  }

  const finalSanitized = sanitizeAllocation(updatedAllocation) as Record<string, BoardCard[]>;

  return {
    updatedAllocation: finalSanitized,
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

  // Detect runtime fallback values from allocation data to prevent magic numbers
  let fallbackSubject = '';
  const detectedDurations: number[] = [];
  Object.values(dayWiseAllocation).forEach((cards) => {
    if (Array.isArray(cards)) {
      cards.forEach((c: any) => {
        if (!fallbackSubject && c?.subject) fallbackSubject = c.subject;
        if (typeof c?.durationMinutes === 'number' && c.durationMinutes > 0) {
          detectedDurations.push(c.durationMinutes);
        }
        if (Array.isArray(c?.topics)) {
          c.topics.forEach((t: any) => {
            if (!fallbackSubject && t?.subject) fallbackSubject = t.subject;
            if (typeof t?.durationMinutes === 'number' && t.durationMinutes > 0) {
              detectedDurations.push(t.durationMinutes);
            }
          });
        }
      });
    }
  });

  const runtimeFallbackDuration =
    detectedDurations.length > 0
      ? Math.round(detectedDurations.reduce((a, b) => a + b, 0) / detectedDurations.length)
      : 30;

  Object.entries(dayWiseAllocation).forEach(([dayKey, cards]) => {
    result[dayKey] = [];
    if (!Array.isArray(cards)) return;
    const dayNum = parseInt(dayKey.replace(/\D/g, ''), 10) || 1;

    cards.forEach((card: any) => {
      const cardSubject = card.subject || fallbackSubject || '';
      const cardChId = card.chapterId || card.id?.replace(/^chapter-/, '') || '';
      const cardChName = card.chapterName || card.title || 'Chapter';

      if (Array.isArray(card.topics) && card.topics.length > 0) {
        card.topics.forEach((t: any) => {
          const topicDuration =
            typeof t.durationMinutes === 'number' && t.durationMinutes > 0
              ? t.durationMinutes
              : typeof card.durationMinutes === 'number' && card.durationMinutes > 0
              ? card.durationMinutes
              : runtimeFallbackDuration;

          const flattenedTopic: BoardTopic = {
            id: t.id,
            title: t.title || 'Topic',
            durationMinutes: topicDuration,
            tag: t.tag || card.tag || 'Core Concept',
            subject: t.subject || cardSubject,
            chapterId: t.chapterId || cardChId,
            chapterName: t.chapterName || cardChName,
            dayNumber: typeof t.dayNumber === 'number' ? t.dayNumber : dayNum,
            isCarriedOver: Boolean(t.isCarriedOver || card.isCarriedOver),
            ...(t.subconcept ? { subconcept: t.subconcept } : {}),
            ...((t.isCarriedOver || card.isCarriedOver) && (typeof t.carriedOverFromDay === 'number' || typeof card.carriedOverFromDay === 'number')
              ? { carriedOverFromDay: t.carriedOverFromDay || card.carriedOverFromDay }
              : {}),
          };
          result[dayKey].push(flattenedTopic);
        });
      } else {
        const cardDuration =
          typeof card.durationMinutes === 'number' && card.durationMinutes > 0
            ? card.durationMinutes
            : runtimeFallbackDuration;

        const fallbackTopic: BoardTopic = {
          id: card.id?.replace(/^card-/, '') || card.id || `topic-${dayNum}`,
          title: card.title || cardChName,
          durationMinutes: cardDuration,
          tag: card.tag || 'Core Concept',
          subject: cardSubject,
          chapterId: cardChId,
          chapterName: cardChName,
          dayNumber: dayNum,
          isCarriedOver: Boolean(card.isCarriedOver),
          ...(card.subconcept ? { subconcept: card.subconcept } : {}),
          ...(card.isCarriedOver && typeof card.carriedOverFromDay === 'number'
            ? { carriedOverFromDay: card.carriedOverFromDay }
            : {}),
        };
        result[dayKey].push(fallbackTopic);
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

export interface SequentialAllocationOptions extends Omit<BalanceCardsOptions, 'cards'> {
  cards?: BoardCard[];
  topics?: (SyllabusItem | BoardTopic)[];
  canonicalChapterOrder?: string[];
  onWarning?: (warning: string) => void;
}

interface SchedulableTopic {
  id: string;
  title: string;
  subconcept: string;
  durationMinutes: number;
  tag: string;
  subject: string;
  chapterId: string;
  chapterName: string;
  isCarriedOver?: boolean;
  carriedOverFromDay?: number;
}

/**
 * Re-engineered schedule-generation engine:
 * - STEP 0: User-driven daily capacity with full-utilization fallback
 * - STEP 1: Inputs and canonical ordering (subjects in first-appearance order, chapters in canonical order)
 * - STEP 2: Full-utilization smoothing across ALL days (dayQuota = min(capacity(d), ceil(remainingTotal / remainingDays)))
 * - STEP 3: Subject time-blocking inside a day with exact quota distribution and redistribution
 * - STEP 4: Sequential subject lock + mid-block rollover (topic-level)
 * - STEP 5: Output shape byte-compatible with existing BoardCard / BoardTopic renderers
 * - STEP 6: Pure, deterministic, zero UI changes
 */
export function allocateChaptersSequentially(options: SequentialAllocationOptions): BoardCard[] {
  const {
    cards = [],
    topics,
    canonicalChapterOrder,
    numDays,
    firstNonPastDay = 1,
    dayCapacities = {},
    fixedCardIds = new Set<string>(),
    onWarning,
  } = options;

  if ((!cards.length && !topics?.length) || !numDays || numDays <= 0) {
    return cards || [];
  }

  const validFirstDay = Math.min(numDays, Math.max(1, firstNonPastDay));

  // STEP 1 — Separate pinned/fixed cards (past days < validFirstDay or explicitly fixed)
  const fixedCards: BoardCard[] = [];
  const fixedTopicIds = new Set<string>();

  cards.forEach((card) => {
    const isPast = card.dayNumber < validFirstDay;
    const isExplicitlyFixed = fixedCardIds.has(card.id);
    if (isPast || isExplicitlyFixed) {
      const clampedDay = Math.min(numDays, Math.max(1, card.dayNumber));
      const fixedCard: BoardCard = {
        ...card,
        dayNumber: clampedDay,
        topics: card.topics?.map((t) => ({ ...t, dayNumber: clampedDay })),
      };
      fixedCards.push(fixedCard);
      fixedCard.topics?.forEach((t) => fixedTopicIds.add(t.id));
    }
  });

  // Derive average topic duration at runtime from input topics/cards to eliminate magic numbers
  const detectedDurations: number[] = [];
  if (topics && topics.length > 0) {
    topics.forEach((t) => {
      if (typeof t.durationMinutes === 'number' && t.durationMinutes > 0) {
        detectedDurations.push(t.durationMinutes);
      }
    });
  }
  if (cards && cards.length > 0) {
    cards.forEach((c) => {
      if (c.topics && c.topics.length > 0) {
        c.topics.forEach((t) => {
          if (typeof t.durationMinutes === 'number' && t.durationMinutes > 0) {
            detectedDurations.push(t.durationMinutes);
          }
        });
      } else if (typeof c.durationMinutes === 'number' && c.durationMinutes > 0) {
        detectedDurations.push(c.durationMinutes);
      }
    });
  }
  const runtimeFallbackDuration =
    detectedDurations.length > 0
      ? Math.round(detectedDurations.reduce((sum, d) => sum + d, 0) / detectedDurations.length)
      : 30;

  // Extract all movable topics from topics array or cards array
  const rawMovableTopics: SchedulableTopic[] = [];

  if (topics && topics.length > 0) {
    topics.forEach((t) => {
      if (!fixedTopicIds.has(t.id)) {
        rawMovableTopics.push({
          id: t.id,
          title: t.title,
          subconcept: t.subconcept || '',
          durationMinutes:
            typeof t.durationMinutes === 'number' && t.durationMinutes > 0
              ? t.durationMinutes
              : runtimeFallbackDuration,
          tag: t.tag || 'Core Concept',
          subject: t.subject || 'General',
          chapterId: t.chapterId || t.chapterName || t.subject || 'general-chapter',
          chapterName: t.chapterName || t.title || 'General',
          isCarriedOver: (t as any).isCarriedOver || false,
          carriedOverFromDay: (t as any).carriedOverFromDay,
        });
      }
    });
  } else {
    cards.forEach((card) => {
      const isPast = card.dayNumber < validFirstDay;
      const isExplicitlyFixed = fixedCardIds.has(card.id);
      if (!isPast && !isExplicitlyFixed) {
        if (card.topics && card.topics.length > 0) {
          card.topics.forEach((t) => {
            if (!fixedTopicIds.has(t.id)) {
              rawMovableTopics.push({
                id: t.id,
                title: t.title,
                subconcept: t.subconcept || '',
                durationMinutes:
                  typeof t.durationMinutes === 'number' && t.durationMinutes > 0
                    ? t.durationMinutes
                    : runtimeFallbackDuration,
                tag: t.tag || 'Core Concept',
                subject: t.subject || card.subject || 'General',
                chapterId: t.chapterId || card.chapterId || card.chapterName || 'chapter',
                chapterName: t.chapterName || card.chapterName || card.title || 'Chapter',
                isCarriedOver: t.isCarriedOver || card.isCarriedOver || false,
                carriedOverFromDay: t.carriedOverFromDay || card.carriedOverFromDay,
              });
            }
          });
        } else {
          rawMovableTopics.push({
            id: card.id,
            title: card.title,
            subconcept: '',
            durationMinutes:
              typeof card.durationMinutes === 'number' && card.durationMinutes > 0
                ? card.durationMinutes
                : runtimeFallbackDuration,
            tag: card.tag || 'Core Concept',
            subject: card.subject || 'General',
            chapterId: card.chapterId || card.chapterName || 'chapter',
            chapterName: card.chapterName || card.title || 'Chapter',
            isCarriedOver: card.isCarriedOver || false,
            carriedOverFromDay: card.carriedOverFromDay,
          });
        }
      }
    });
  }

  if (rawMovableTopics.length === 0) {
    return fixedCards;
  }

  // Deduce canonical chapter order
  const orderList: string[] = [];
  if (canonicalChapterOrder && canonicalChapterOrder.length > 0) {
    canonicalChapterOrder.forEach((id) => {
      if (!orderList.includes(id)) orderList.push(id);
    });
  }
  rawMovableTopics.forEach((t) => {
    if (!orderList.includes(t.chapterId)) {
      orderList.push(t.chapterId);
    }
  });

  const chapterInfoMap = new Map<string, { chapterId: string; chapterName: string; subject: string }>();
  rawMovableTopics.forEach((t) => {
    if (!chapterInfoMap.has(t.chapterId)) {
      chapterInfoMap.set(t.chapterId, {
        chapterId: t.chapterId,
        chapterName: t.chapterName,
        subject: t.subject,
      });
    }
  });

  // Canonical subject order: first-appearance order of the canonical chapter order
  const canonicalSubjectOrder: string[] = [];
  const subjectChaptersMap = new Map<string, string[]>();
  for (const chId of orderList) {
    const info = chapterInfoMap.get(chId);
    if (!info) continue;
    if (!canonicalSubjectOrder.includes(info.subject)) {
      canonicalSubjectOrder.push(info.subject);
    }
    if (!subjectChaptersMap.has(info.subject)) {
      subjectChaptersMap.set(info.subject, []);
    }
    const chList = subjectChaptersMap.get(info.subject)!;
    if (!chList.includes(chId)) {
      chList.push(chId);
    }
  }

  // Chapter topics map: chapterId -> list of topics in canonical order
  const chapterTopicsMap = new Map<string, SchedulableTopic[]>();
  orderList.forEach((chId) => chapterTopicsMap.set(chId, []));
  rawMovableTopics.forEach((t) => {
    if (!chapterTopicsMap.has(t.chapterId)) {
      chapterTopicsMap.set(t.chapterId, []);
    }
    chapterTopicsMap.get(t.chapterId)!.push(t);
  });

  // STEP 0 — Canonical capacity resolution:
  // Defer strictly to passed-in dayCapacities. If not provided or <= 0, derive full-utilization capacity:
  // clamp(ceil(totalSelectedMinutes / numDays), maxLargestTopicDuration, 720)
  const totalMovableMinutes = rawMovableTopics.reduce(
    (sum, t) => sum + (t.durationMinutes || runtimeFallbackDuration),
    0
  );
  const maxLargestTopicDuration = rawMovableTopics.reduce(
    (max, t) => Math.max(max, t.durationMinutes || runtimeFallbackDuration),
    runtimeFallbackDuration
  );
  const availableDayCount = Math.max(1, numDays - validFirstDay + 1);
  const fallbackCapacity = Math.max(
    maxLargestTopicDuration,
    Math.min(720, Math.ceil(totalMovableMinutes / availableDayCount))
  );

  const resolvedCapacities: Record<number, number> = {};
  for (let d = validFirstDay; d <= numDays; d++) {
    resolvedCapacities[d] =
      dayCapacities[d] && dayCapacities[d] > 0 ? dayCapacities[d] : fallbackCapacity;
  }

  // EDGE CASE 1: Syllabus exceeds total capacity
  // When totalSelectedMinutes > totalCapacity across available days: produce full schedule across ALL days,
  // fill every day to capacity, keep continuity rules intact, allow overflow past nominal capacity,
  // and push a warning through onWarning with runtime-computed numbers.
  const totalSprintCapacity = Object.values(resolvedCapacities).reduce((sum, cap) => sum + cap, 0);
  if (totalMovableMinutes > totalSprintCapacity && onWarning) {
    onWarning(
      `Total study workload (${totalMovableMinutes} mins) exceeds available schedule capacity (${totalSprintCapacity} mins across ${availableDayCount} days). Schedule filled to capacity with overflow allowed.`
    );
  }

  // EDGE CASE 3: Hard iteration ceiling
  const maxIterations = rawMovableTopics.length * numDays + 64;

  const generatedCards: BoardCard[] = [];

  // STEP 2 — Full-utilization smoothing across ALL days
  let dayWalkIterations = 0;
  for (let d = validFirstDay; d <= numDays; d++) {
    dayWalkIterations++;
    if (dayWalkIterations > maxIterations) {
      console.error(
        `[allocateChaptersSequentially] Day walk iteration ceiling breached (${dayWalkIterations} > ${maxIterations}) at Day ${d}. Exiting loop gracefully.`
      );
      break;
    }

    const dayCap = resolvedCapacities[d];

    const fixedMinsOnDay = fixedCards
      .filter((c) => c.dayNumber === d)
      .reduce((sum, c) => sum + (c.durationMinutes || 0), 0);

    const unplacedTopics: SchedulableTopic[] = [];
    for (const subj of canonicalSubjectOrder) {
      const chIds = subjectChaptersMap.get(subj) || [];
      for (const chId of chIds) {
        const list = chapterTopicsMap.get(chId) || [];
        unplacedTopics.push(...list);
      }
    }

    if (unplacedTopics.length === 0) {
      break;
    }

    const remainingTotal = unplacedTopics.reduce(
      (sum, t) => sum + (t.durationMinutes || runtimeFallbackDuration),
      0
    );
    const remainingDays = numDays - d + 1;
    const remainingCapacity = Object.entries(resolvedCapacities)
      .filter(([dayStr]) => Number(dayStr) >= d)
      .reduce((sum, [, cap]) => sum + cap, 0);

    // If remaining work exceeds remaining capacity, distribute overflow evenly across remaining days
    const smoothedDayTarget =
      remainingTotal > remainingCapacity
        ? Math.max(dayCap, Math.ceil(remainingTotal / remainingDays))
        : Math.min(dayCap, Math.ceil(remainingTotal / remainingDays));

    let dayQuota = Math.max(0, smoothedDayTarget - fixedMinsOnDay);

    // If on the last day, or if dayQuota is 0 but work remains, allow quota up to capacity
    if (d === numDays && remainingTotal > 0 && dayQuota === 0) {
      dayQuota = Math.max(0, dayCap - fixedMinsOnDay);
    }

    // STEP 3 — Subject time-blocking inside a day
    const activeSubjects = canonicalSubjectOrder.filter((subj) => {
      const chIds = subjectChaptersMap.get(subj) || [];
      return chIds.some((chId) => (chapterTopicsMap.get(chId)?.length || 0) > 0);
    });

    if (activeSubjects.length === 0) continue;

    const activeSubjectCount = activeSubjects.length;
    const baseShare = Math.floor(dayQuota / activeSubjectCount);
    let leftover = dayQuota % activeSubjectCount;

    const shares: Record<string, number> = {};
    for (const subj of activeSubjects) {
      shares[subj] = baseShare + (leftover > 0 ? 1 : 0);
      if (leftover > 0) leftover--;
    }

    // Subject remaining minutes
    const subjectRemaining: Record<string, number> = {};
    for (const subj of activeSubjects) {
      const chIds = subjectChaptersMap.get(subj) || [];
      let sTotal = 0;
      for (const chId of chIds) {
        const list = chapterTopicsMap.get(chId) || [];
        sTotal += list.reduce((sum, t) => sum + (t.durationMinutes || runtimeFallbackDuration), 0);
      }
      subjectRemaining[subj] = sTotal;
    }

    // Redistribution: cap each share at that subject's remaining minutes and redistribute freed minutes
    let redistIterations = 0;
    while (true) {
      redistIterations++;
      if (redistIterations > maxIterations) {
        console.error(
          `[allocateChaptersSequentially] Subject-block redistribution iteration ceiling breached (${redistIterations} > ${maxIterations}) on Day ${d}. Breaking redistribution.`
        );
        break;
      }

      let freed = 0;
      for (const subj of activeSubjects) {
        if (shares[subj] > subjectRemaining[subj]) {
          freed += shares[subj] - subjectRemaining[subj];
          shares[subj] = subjectRemaining[subj];
        }
      }
      if (freed === 0) break;

      const eligible = activeSubjects.filter((subj) => shares[subj] < subjectRemaining[subj]);
      if (eligible.length === 0) break;

      let distributedAny = false;
      for (const subj of eligible) {
        if (freed > 0 && shares[subj] < subjectRemaining[subj]) {
          shares[subj]++;
          freed--;
          distributedAny = true;
        }
      }
      if (!distributedAny) break;
    }

    // STEP 4 — Sequential subject lock + mid-block rollover (topic-level)
    const daySegments: Array<{
      chapterId: string;
      chapterName: string;
      subject: string;
      topics: SchedulableTopic[];
    }> = [];

    let daySpentMovable = 0;

    for (const subj of activeSubjects) {
      if (daySpentMovable >= dayQuota && d < numDays) {
        break;
      }

      const blockQuota = shares[subj];
      if (blockQuota <= 0 && d < numDays) continue;

      let spentInBlock = 0;
      const chIds = subjectChaptersMap.get(subj) || [];

      for (const chId of chIds) {
        const chTopics = chapterTopicsMap.get(chId);
        if (!chTopics || chTopics.length === 0) continue;

        const segmentTopics: SchedulableTopic[] = [];

        let topicConsumptionIterations = 0;
        while (chTopics.length > 0) {
          topicConsumptionIterations++;
          if (topicConsumptionIterations > maxIterations) {
            console.error(
              `[allocateChaptersSequentially] Within-block topic consumption iteration ceiling breached (${topicConsumptionIterations} > ${maxIterations}) on Day ${d}, Chapter ${chId}. Breaking topic loop.`
            );
            break;
          }

          const nextTopic = chTopics[0];
          const dur = nextTopic.durationMinutes || runtimeFallbackDuration;

          // EDGE CASE 2: Single topic whose duration exceeds the day's remaining quota AND day's total capacity
          // Place it WHOLE on the day where its subject's sequential pointer sits, let that day overflow,
          // and push warning with runtime-computed numbers.
          const remainingDayQuota = Math.max(0, dayQuota - daySpentMovable);
          const isOversizedTopic = dur > dayCap && dur > remainingDayQuota;

          const canPlace =
            isOversizedTopic ||
            (spentInBlock === 0 && (daySpentMovable < dayQuota || daySpentMovable === 0)) ||
            (spentInBlock + dur <= blockQuota && (daySpentMovable + dur <= dayQuota || daySpentMovable === 0)) ||
            (d === numDays);

          if (canPlace) {
            if (isOversizedTopic && onWarning) {
              onWarning(
                `Topic "${nextTopic.title}" (${dur} mins) exceeds Day ${d} capacity (${dayCap} mins) and was placed whole with overflow.`
              );
            }
            chTopics.shift();
            segmentTopics.push(nextTopic);
            spentInBlock += dur;
            daySpentMovable += dur;
          } else {
            break;
          }
        }

        if (segmentTopics.length > 0) {
          const info = chapterInfoMap.get(chId)!;
          daySegments.push({
            chapterId: chId,
            chapterName: info.chapterName,
            subject: info.subject,
            topics: segmentTopics,
          });
        }

        if ((spentInBlock >= blockQuota || daySpentMovable >= dayQuota) && d < numDays) {
          break;
        }
      }
    }

    // STEP 5 — Output shape (byte-compatible with existing renderers)
    let segmentIndex = 1;
    daySegments.forEach((seg) => {
      const totalDuration = seg.topics.reduce(
        (acc, t) => acc + (t.durationMinutes || runtimeFallbackDuration),
        0
      );
      const count = seg.topics.length;
      const boardTopics: BoardTopic[] = seg.topics.map((t) => ({
        id: t.id,
        title: t.title,
        durationMinutes: t.durationMinutes || runtimeFallbackDuration,
        tag: t.tag || 'Core Concept',
        subject: t.subject || seg.subject,
        chapterId: seg.chapterId,
        chapterName: seg.chapterName,
        dayNumber: d,
        ...(t.subconcept ? { subconcept: t.subconcept } : {}),
        ...(t.isCarriedOver
          ? {
              isCarriedOver: true,
              ...(typeof t.carriedOverFromDay === 'number'
                ? { carriedOverFromDay: t.carriedOverFromDay }
                : {}),
            }
          : {}),
      }));

      const hasCarried = seg.topics.some((t) => t.isCarriedOver);
      const minFromDay = seg.topics
        .map((t) => t.carriedOverFromDay)
        .find((fd): fd is number => typeof fd === 'number');

      generatedCards.push({
        id: `chapter-${seg.chapterId}-day-${d}-${segmentIndex++}`,
        chapterId: seg.chapterId,
        chapterName: seg.chapterName,
        subject: seg.subject,
        title: seg.chapterName,
        durationMinutes: totalDuration,
        tag: `${count} ${count === 1 ? 'topic' : 'topics'}`,
        dayNumber: d,
        topics: boardTopics,
        ...(hasCarried ? { isCarriedOver: true } : {}),
        ...(hasCarried && typeof minFromDay === 'number' ? { carriedOverFromDay: minFromDay } : {}),
      });
    });
  }

  // Combine fixed cards and generated cards; order by dayNumber, canonical subject order, canonical chapter order
  const allCards = [...fixedCards, ...generatedCards];
  allCards.sort((a, b) => {
    if (a.dayNumber !== b.dayNumber) {
      return a.dayNumber - b.dayNumber;
    }
    const subjA = canonicalSubjectOrder.indexOf(a.subject);
    const subjB = canonicalSubjectOrder.indexOf(b.subject);
    if (subjA !== subjB) {
      return (subjA === -1 ? 999 : subjA) - (subjB === -1 ? 999 : subjB);
    }
    const chA = orderList.indexOf(a.chapterId || '');
    const chB = orderList.indexOf(b.chapterId || '');
    return (chA === -1 ? 999 : chA) - (chB === -1 ? 999 : chB);
  });

  return allCards;
}

/**
 * Backward-compatible wrapper around allocateChaptersSequentially.
 */
export function balanceCardsAcrossDays(options: BalanceCardsOptions): BoardCard[] {
  return allocateChaptersSequentially(options);
}



