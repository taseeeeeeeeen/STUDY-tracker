import { z } from 'zod';
import { AiPlanningPayload } from '../utils/aiPlanningPayload';
import { BoardCard, BoardTopic } from '../types/wizard';

export const AiRoutineTopicSchema = z.object({
  id: z.string(),
  title: z.string().optional().default(''),
  subconcept: z.string().optional().default(''),
  durationMinutes: z.coerce.number().optional().default(0),
  tag: z.string().optional().default('Core Concept'),
  isCarriedOver: z.boolean().optional().default(false),
  carriedOverFromDay: z.coerce.number().optional(),
});

export const AiRoutineCardSchema = z.object({
  id: z.string().optional(),
  chapterId: z.string().optional().default(''),
  chapterName: z.string().optional().default(''),
  subject: z.string().optional().default(''),
  title: z.string().optional().default(''),
  durationMinutes: z.coerce.number().optional(),
  tag: z.string().optional().default('Core Concept'),
  dayNumber: z.coerce.number().optional(),
  topics: z.array(AiRoutineTopicSchema).optional().default([]),
  isCarriedOver: z.boolean().optional().default(false),
  carriedOverFromDay: z.coerce.number().optional(),
});

export const AiRoutineDaySchema = z.object({
  dayNumber: z.coerce.number().int(),
  cards: z.array(AiRoutineCardSchema).optional().default([]),
});

export const AiRoutineResponseSchema = z.object({
  status: z.enum(['ok', 'infeasible_relaxed', 'infeasible_unsolvable']).optional().default('ok'),
  warnings: z.array(z.string()).optional().default([]),
  days: z.array(AiRoutineDaySchema).optional().default([]),
});

export type RawAiRoutineResponse = z.infer<typeof AiRoutineResponseSchema>;

export interface EnforceInvariantsResult {
  status: 'ok' | 'infeasible_relaxed' | 'infeasible_unsolvable';
  allocation: Record<string, BoardCard[]>;
  warnings: string[];
}

export function validateAndEnforceInvariants(
  raw: RawAiRoutineResponse,
  payload: AiPlanningPayload
): EnforceInvariantsResult {
  const warnings: string[] = [...(raw.warnings || [])];

  // 1. Index all payload topics by ID
  const payloadTopicMap = new Map<
    string,
    {
      id: string;
      title: string;
      subconcept: string;
      durationMinutes: number;
      tag: string;
      chapterId: string;
      chapterName: string;
      subject: string;
    }
  >();

  payload.subjects.forEach((subj) => {
    subj.chapters.forEach((ch) => {
      ch.topics.forEach((top) => {
        payloadTopicMap.set(top.id, {
          id: top.id,
          title: top.title,
          subconcept: top.subconcept,
          durationMinutes: top.durationMinutes,
          tag: top.tag && top.tag.trim() ? top.tag : 'Core Concept',
          chapterId: ch.chapterId,
          chapterName: ch.chapterName,
          subject: subj.subject,
        });
      });
    });
  });

  const seenTopicIds = new Set<string>();
  const numDays = Math.max(1, payload.numDays);

  // Initialize allocation map for all days 1..numDays
  const allocation: Record<string, BoardCard[]> = {};
  for (let d = 1; d <= numDays; d++) {
    allocation[`Day ${d}`] = [];
  }

  // Map AI response days
  if (Array.isArray(raw.days)) {
    raw.days.forEach((dayObj) => {
      const dayNum = dayObj.dayNumber;
      if (dayNum < 1 || dayNum > numDays) {
        return; // Ignore invalid day numbers outside 1..numDays
      }
      const dayKey = `Day ${dayNum}`;

      if (Array.isArray(dayObj.cards)) {
        dayObj.cards.forEach((card, cardIndex) => {
          const validCardTopics: BoardTopic[] = [];

          if (Array.isArray(card.topics)) {
            card.topics.forEach((t) => {
              // Check if topic belongs to payload
              if (!payloadTopicMap.has(t.id)) {
                warnings.push(
                  `Unknown topic ID "${t.id}" (${t.title || 'Untitled'}) was removed from generated plan.`
                );
                return;
              }

              // Check if topic was already seen
              if (seenTopicIds.has(t.id)) {
                warnings.push(
                  `Duplicate topic "${t.title || t.id}" removed from Day ${dayNum}.`
                );
                return;
              }

              seenTopicIds.add(t.id);
              const payloadMeta = payloadTopicMap.get(t.id)!;

              validCardTopics.push({
                id: t.id,
                title: t.title || payloadMeta.title,
                subconcept: t.subconcept || payloadMeta.subconcept,
                durationMinutes: t.durationMinutes > 0 ? t.durationMinutes : payloadMeta.durationMinutes,
                tag: t.tag && t.tag.trim() ? t.tag : payloadMeta.tag,
                subject: card.subject || payloadMeta.subject,
                chapterId: card.chapterId || payloadMeta.chapterId,
                chapterName: card.chapterName || payloadMeta.chapterName,
                isCarriedOver: Boolean(t.isCarriedOver),
                carriedOverFromDay: t.carriedOverFromDay,
                dayNumber: dayNum,
              });
            });
          }

          if (validCardTopics.length === 0) {
            return; // Skip empty cards
          }

          const cardTag =
            card.tag && card.tag.trim()
              ? card.tag
              : validCardTopics[0]?.tag || 'Core Concept';

          const cardChapterId = card.chapterId || validCardTopics[0]?.chapterId || '';
          const cardChapterName =
            card.chapterName || validCardTopics[0]?.chapterName || '';
          const cardSubject = card.subject || validCardTopics[0]?.subject || '';

          // Card duration = exact sum of topics
          const computedDuration = validCardTopics.reduce(
            (sum, top) => sum + top.durationMinutes,
            0
          );

          // Derived stable ID
          const stableCardId =
            card.id && card.id.trim()
              ? card.id
              : `${cardChapterId || 'ch'}-d${dayNum}-${cardIndex}`;

          const finalCard: BoardCard = {
            id: stableCardId,
            chapterId: cardChapterId,
            chapterName: cardChapterName,
            subject: cardSubject,
            title: card.title || cardChapterName || 'Chapter Review',
            durationMinutes: computedDuration,
            tag: cardTag,
            dayNumber: dayNum,
            topics: validCardTopics,
            isCarriedOver: Boolean(card.isCarriedOver),
            carriedOverFromDay: card.carriedOverFromDay,
          };

          allocation[dayKey].push(finalCard);
        });
      }
    });
  }

  // 2. Attach any missing payload topics to allocation
  const missingTopicIds: string[] = [];
  payloadTopicMap.forEach((_meta, id) => {
    if (!seenTopicIds.has(id)) {
      missingTopicIds.push(id);
    }
  });

  if (missingTopicIds.length > 0) {
    warnings.push(
      `Re-allocated ${missingTopicIds.length} missing topic(s) into available plan days.`
    );

    missingTopicIds.forEach((id) => {
      const meta = payloadTopicMap.get(id)!;
      // Find day with lowest total duration
      let bestDay = 1;
      let minDuration = Infinity;

      for (let d = 1; d <= numDays; d++) {
        const dKey = `Day ${d}`;
        const dayDuration = allocation[dKey].reduce(
          (sum, card) => sum + card.durationMinutes,
          0
        );
        if (dayDuration < minDuration) {
          minDuration = dayDuration;
          bestDay = d;
        }
      }

      const bestDayKey = `Day ${bestDay}`;
      const topicObj: BoardTopic = {
        id: meta.id,
        title: meta.title,
        subconcept: meta.subconcept,
        durationMinutes: meta.durationMinutes,
        tag: meta.tag,
        subject: meta.subject,
        chapterId: meta.chapterId,
        chapterName: meta.chapterName,
        dayNumber: bestDay,
      };

      // Check if card for this chapter exists on bestDay
      const existingCard = allocation[bestDayKey].find(
        (c) => c.chapterId === meta.chapterId
      );

      if (existingCard) {
        existingCard.topics = existingCard.topics || [];
        existingCard.topics.push(topicObj);
        existingCard.durationMinutes += meta.durationMinutes;
      } else {
        allocation[bestDayKey].push({
          id: `${meta.chapterId}-d${bestDay}-missing-${id}`,
          chapterId: meta.chapterId,
          chapterName: meta.chapterName,
          subject: meta.subject,
          title: meta.chapterName || meta.title,
          durationMinutes: meta.durationMinutes,
          tag: meta.tag,
          dayNumber: bestDay,
          topics: [topicObj],
        });
      }
    });
  }

  // 3. Check daily capacity invariant for each day
  const dailyCap = payload.dailyTimeLimits.totalPerDayMinutes;
  let capacityViolation = false;

  for (let d = 1; d <= numDays; d++) {
    const dKey = `Day ${d}`;
    const dayTotal = allocation[dKey].reduce(
      (sum, card) => sum + card.durationMinutes,
      0
    );

    if (dayTotal > dailyCap) {
      capacityViolation = true;
      warnings.push(
        `Day ${d} scheduled workload (${dayTotal}m) exceeds daily capacity limit of ${dailyCap}m.`
      );
    }
  }

  // 4. Check intra-subject chapter priority progression
  const subjectChapterDays = new Map<string, Map<string, { startDay: number; endDay: number; priorityIndex: number }>>();
  payload.subjects.forEach((subj) => {
    const chMap = new Map<string, { startDay: number; endDay: number; priorityIndex: number }>();
    subj.chapters.forEach((ch, idx) => {
      chMap.set(ch.chapterId, {
        startDay: Infinity,
        endDay: -1,
        priorityIndex: ch.priorityIndex !== null && ch.priorityIndex !== undefined ? ch.priorityIndex : idx,
      });
    });
    subjectChapterDays.set(subj.subject, chMap);
  });

  for (let d = 1; d <= numDays; d++) {
    const dayCards = allocation[`Day ${d}`] || [];
    dayCards.forEach((card) => {
      const chMap = subjectChapterDays.get(card.subject);
      if (chMap && card.chapterId && chMap.has(card.chapterId)) {
        const info = chMap.get(card.chapterId)!;
        info.startDay = Math.min(info.startDay, d);
        info.endDay = Math.max(info.endDay, d);
      }

      // Check 6-topic chunking
      if (card.topics && card.topics.length > 6) {
        warnings.push(
          `Day ${d}: "${card.chapterName || card.title}" contains ${card.topics.length} topics (max recommended: 6 topics per day).`
        );
      }
    });
  }

  // Validate that for any subject, lower priority chapter does not start before higher priority finishes
  subjectChapterDays.forEach((chMap, subj) => {
    const chapters = Array.from(chMap.entries())
      .filter(([, info]) => info.startDay !== Infinity)
      .sort((a, b) => a[1].priorityIndex - b[1].priorityIndex);

    for (let i = 0; i < chapters.length - 1; i++) {
      const [chIdA, infoA] = chapters[i];
      const [chIdB, infoB] = chapters[i + 1];
      if (infoB.startDay < infoA.endDay) {
        warnings.push(
          `Subject ${subj}: Chapter "${chIdB}" started on Day ${infoB.startDay} before prior chapter "${chIdA}" completed (Day ${infoA.endDay}).`
        );
      }
    }
  });

  let finalStatus: 'ok' | 'infeasible_relaxed' | 'infeasible_unsolvable' = raw.status || 'ok';
  if (capacityViolation || warnings.length > 0) {
    if (finalStatus === 'ok') {
      finalStatus = 'infeasible_relaxed';
    }
  }

  return {
    status: finalStatus,
    allocation,
    warnings,
  };
}
