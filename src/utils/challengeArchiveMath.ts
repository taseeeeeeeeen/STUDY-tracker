import { FirestoreChallenge } from '../types/challenge';
import { dedupeSyllabusTopics, DedupableSyllabusTopic } from './challengeLogic';

export interface ChapterArchiveBreakdown {
  chapterId: string;
  chapterName: string;
  completed: number;
  total: number;
  pendingTopics: string[];
}

export interface SubjectArchiveBreakdown {
  subject: string;
  total: number;
  completed: number;
  pending: number;
  chapters: ChapterArchiveBreakdown[];
}

export interface ChallengeArchiveBreakdown {
  status: 'completed' | 'expired_incomplete';
  completionPercent: number;
  completedTopics: number;
  totalTopics: number;
  perSubject: SubjectArchiveBreakdown[];
}

/**
 * Pure calculation helper to evaluate completion and chapter/subject breakdown
 * for an archived study challenge against the user's real topic progress records.
 *
 * Rules:
 * - Dedupes challenge.selected_syllabus using dedupeSyllabusTopics.
 * - A topic is fully completed iff topicProgress[id].theory && topicProgress[id].practice.
 * - completionPercent = ((completedTheory + completedPractice) / (total * 2)) * 100
 * - status = 'completed' when every topic is fully done (and totalTopics > 0), else 'expired_incomplete'.
 * - Pure function: no Firestore calls, no Date.now.
 */
export function computeChallengeArchiveBreakdown(
  challenge: FirestoreChallenge,
  topicProgress: Record<string, { theory: boolean; practice: boolean }> | null | undefined
): ChallengeArchiveBreakdown {
  const safeProgress = topicProgress || {};
  const rawSyllabus = Array.isArray(challenge?.selected_syllabus)
    ? challenge.selected_syllabus
    : [];

  // Build chapter metadata map from selected_syllabus and day_wise_allocation
  const chapterLookup = new Map<
    string,
    { chapterId: string; chapterName: string; originalTitle?: string }
  >();

  rawSyllabus.forEach((item: any) => {
    if (item && item.id) {
      chapterLookup.set(item.id, {
        chapterId: item.chapterId || item.subject || 'general',
        chapterName: item.chapterName || item.subject || 'General',
        originalTitle: item.title,
      });
    }
  });

  if (challenge?.day_wise_allocation && typeof challenge.day_wise_allocation === 'object') {
    Object.values(challenge.day_wise_allocation).forEach((cards) => {
      if (Array.isArray(cards)) {
        cards.forEach((card: any) => {
          const cardChId = card.chapterId || card.id || card.subject || 'general';
          const cardChName = card.chapterName || card.title || card.subject || 'General';
          if (Array.isArray(card.topics)) {
            card.topics.forEach((t: any) => {
              if (t && t.id && !chapterLookup.has(t.id)) {
                chapterLookup.set(t.id, {
                  chapterId: t.chapterId || cardChId,
                  chapterName: t.chapterName || cardChName,
                  originalTitle: t.title,
                });
              }
            });
          }
        });
      }
    });
  }

  // Dedupe topics using existing dedupeSyllabusTopics helper
  const dedupableList: DedupableSyllabusTopic[] = rawSyllabus.map((s) => ({
    id: s.id,
    subject: s.subject || 'General',
    title: s.title || 'Topic',
    subconcept: s.subconcept || '',
    durationMinutes: typeof s.durationMinutes === 'number' ? s.durationMinutes : 30,
    tag: s.tag,
  }));

  const dedupedTopics = dedupeSyllabusTopics(dedupableList);
  const totalTopics = dedupedTopics.length;

  if (totalTopics === 0) {
    return {
      status: 'expired_incomplete',
      completionPercent: 0,
      completedTopics: 0,
      totalTopics: 0,
      perSubject: [],
    };
  }

  let completedTheory = 0;
  let completedPractice = 0;
  let completedTopics = 0;

  // Track subject -> chapters -> topics in order of first appearance
  const subjectsMap = new Map<
    string,
    {
      subject: string;
      total: number;
      completed: number;
      pending: number;
      chaptersMap: Map<
        string,
        {
          chapterId: string;
          chapterName: string;
          completed: number;
          total: number;
          pendingTopics: string[];
        }
      >;
    }
  >();

  dedupedTopics.forEach((topic) => {
    const prog = safeProgress[topic.id];
    const isTheory = Boolean(prog?.theory);
    const isPractice = Boolean(prog?.practice);
    const isDone = isTheory && isPractice;

    if (isTheory) completedTheory += 1;
    if (isPractice) completedPractice += 1;
    if (isDone) completedTopics += 1;

    const subjName = topic.subject || 'General';
    const chMeta = chapterLookup.get(topic.id);
    const chId = chMeta?.chapterId || subjName;
    const chName = chMeta?.chapterName || subjName;
    const topicDisplayTitle = chMeta?.originalTitle || topic.title;

    if (!subjectsMap.has(subjName)) {
      subjectsMap.set(subjName, {
        subject: subjName,
        total: 0,
        completed: 0,
        pending: 0,
        chaptersMap: new Map(),
      });
    }

    const subjData = subjectsMap.get(subjName)!;
    subjData.total += 1;
    if (isDone) {
      subjData.completed += 1;
    } else {
      subjData.pending += 1;
    }

    if (!subjData.chaptersMap.has(chId)) {
      subjData.chaptersMap.set(chId, {
        chapterId: chId,
        chapterName: chName,
        completed: 0,
        total: 0,
        pendingTopics: [],
      });
    }

    const chData = subjData.chaptersMap.get(chId)!;
    chData.total += 1;
    if (isDone) {
      chData.completed += 1;
    } else {
      chData.pendingTopics.push(topicDisplayTitle);
    }
  });

  const rawPercent =
    totalTopics > 0
      ? ((completedTheory + completedPractice) / (totalTopics * 2)) * 100
      : 0;
  const completionPercent = Math.round(rawPercent * 10) / 10;

  const status: 'completed' | 'expired_incomplete' =
    completedTopics === totalTopics && totalTopics > 0
      ? 'completed'
      : 'expired_incomplete';

  const perSubject: SubjectArchiveBreakdown[] = Array.from(subjectsMap.values()).map(
    (subj) => ({
      subject: subj.subject,
      total: subj.total,
      completed: subj.completed,
      pending: subj.pending,
      chapters: Array.from(subj.chaptersMap.values()),
    })
  );

  return {
    status,
    completionPercent,
    completedTopics,
    totalTopics,
    perSubject,
  };
}
