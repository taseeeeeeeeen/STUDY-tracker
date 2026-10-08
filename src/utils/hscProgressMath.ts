import { MasterSubject } from '../types/syllabus';

export interface SubjectProgressMetric {
  subjectId: string;
  name: string;
  code?: string;
  percent: number;
  completedTopics: number;
  totalTopics: number;
  completedTheory: number;
  completedPractice: number;
}

export interface HscProgressResult {
  grandPercent: number;
  totalTopics: number;
  completedTopicsCount: number;
  completedTheoryCount: number;
  completedPracticeCount: number;
  perSubject: SubjectProgressMetric[];
}

/**
 * Computes HSC completion metrics consistently across student dashboard and admin console.
 *
 * Weight rule:
 * Each topic has 2 units/points (Theory = 1 point, Practice = 1 point).
 * Total points available for N topics = N * 2.
 * Subject % = ((completedTheory + completedPractice) / (totalTopics * 2)) * 100
 * Grand % = ((totalCompletedTheory + totalCompletedPractice) / (grandTotalTopics * 2)) * 100
 * A topic is considered fully complete if BOTH theory and practice are done.
 */
export function computeHscProgress(
  subjects: MasterSubject[],
  topicProgress: Record<string, { theory?: boolean; practice?: boolean }> | undefined | null
): HscProgressResult {
  const safeProgress = topicProgress || {};

  let grandTotalTopics = 0;
  let grandCompletedTheory = 0;
  let grandCompletedPractice = 0;
  let grandCompletedTopicsCount = 0;

  const perSubject: SubjectProgressMetric[] = (subjects || []).map((subject) => {
    const allTopics = (subject.chapters || []).flatMap((ch) => ch.topics || []);
    const totalTopics = allTopics.length;

    let completedTheory = 0;
    let completedPractice = 0;
    let completedTopics = 0;

    for (const topic of allTopics) {
      const prog = safeProgress[topic.id];
      const isTheory = Boolean(prog?.theory);
      const isPractice = Boolean(prog?.practice);

      if (isTheory) completedTheory += 1;
      if (isPractice) completedPractice += 1;
      if (isTheory && isPractice) completedTopics += 1;
    }

    const percent =
      totalTopics > 0
        ? ((completedTheory + completedPractice) / (totalTopics * 2)) * 100
        : 0;

    grandTotalTopics += totalTopics;
    grandCompletedTheory += completedTheory;
    grandCompletedPractice += completedPractice;
    grandCompletedTopicsCount += completedTopics;

    return {
      subjectId: subject.id,
      name: subject.name,
      code: subject.code,
      percent: Math.round(percent * 10) / 10,
      completedTopics,
      totalTopics,
      completedTheory,
      completedPractice,
    };
  });

  const grandPercent =
    grandTotalTopics > 0
      ? ((grandCompletedTheory + grandCompletedPractice) / (grandTotalTopics * 2)) * 100
      : 0;

  return {
    grandPercent: Math.round(grandPercent * 10) / 10,
    totalTopics: grandTotalTopics,
    completedTopicsCount: grandCompletedTopicsCount,
    completedTheoryCount: grandCompletedTheory,
    completedPracticeCount: grandCompletedPractice,
    perSubject,
  };
}
