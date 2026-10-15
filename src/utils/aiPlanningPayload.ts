import { SyllabusItem } from '../types/wizard';

export interface AiPlanningPayloadTopic {
  id: string;
  title: string;
  subconcept: string;
  durationMinutes: number;
  tag: string;
}

export interface AiPlanningPayloadChapter {
  chapterId: string;
  chapterName: string;
  priorityIndex: number | null;
  topics: AiPlanningPayloadTopic[];
}

export interface AiPlanningPayloadSubject {
  subject: string;
  chapters: AiPlanningPayloadChapter[];
}

export interface AiPlanningPayload {
  startDate: string;
  endDate: string;
  numDays: number;
  dailyTimeLimits: {
    totalPerDayMinutes: number;
    perSubjectMinutes: Record<string, number> | null;
  };
  priorityMode: boolean;
  subjects: AiPlanningPayloadSubject[];
}

export interface BuildAiPlanningPayloadInput {
  prepStartDate: string;
  lastPrepDateString: string;
  durationDays: number;
  capacityMinutes: number;
  isPriorityMode: boolean;
  selectedTopics: SyllabusItem[];
  priorityChapterOrder: string[];
}

export function buildAiPlanningPayload(input: BuildAiPlanningPayloadInput): AiPlanningPayload {
  const {
    prepStartDate,
    lastPrepDateString,
    durationDays,
    capacityMinutes,
    isPriorityMode,
    selectedTopics,
    priorityChapterOrder,
  } = input;

  // Group topics by subject -> chapter in first-appearance order
  const subjectMap = new Map<
    string,
    Map<
      string,
      {
        chapterName: string;
        topics: SyllabusItem[];
      }
    >
  >();

  selectedTopics.forEach((topic) => {
    const subName = topic.subject || 'Unassigned Subject';
    const chId = topic.chapterId || topic.chapterName || subName;
    const chName = topic.chapterName || topic.title || subName;

    if (!subjectMap.has(subName)) {
      subjectMap.set(subName, new Map());
    }
    const chaptersInSub = subjectMap.get(subName)!;

    if (!chaptersInSub.has(chId)) {
      chaptersInSub.set(chId, {
        chapterName: chName,
        topics: [],
      });
    }
    chaptersInSub.get(chId)!.topics.push(topic);
  });

  const subjectsPayload: AiPlanningPayloadSubject[] = [];

  subjectMap.forEach((chaptersInSub, subjectName) => {
    const chaptersPayload: AiPlanningPayloadChapter[] = [];

    chaptersInSub.forEach((chData, chapterId) => {
      let priorityIndex: number | null = null;
      if (isPriorityMode) {
        const orderIdx = priorityChapterOrder.indexOf(chapterId);
        if (orderIdx !== -1) {
          priorityIndex = orderIdx + 1; // 1-based index
        }
      }

      const topicsPayload: AiPlanningPayloadTopic[] = chData.topics.map((t) => ({
        id: t.id,
        title: t.title,
        subconcept: t.subconcept || '',
        durationMinutes: t.durationMinutes || 45,
        tag: t.tag || '',
      }));

      chaptersPayload.push({
        chapterId,
        chapterName: chData.chapterName,
        priorityIndex,
        topics: topicsPayload,
      });
    });

    subjectsPayload.push({
      subject: subjectName,
      chapters: chaptersPayload,
    });
  });

  return {
    startDate: prepStartDate,
    endDate: lastPrepDateString,
    numDays: durationDays,
    dailyTimeLimits: {
      totalPerDayMinutes: capacityMinutes,
      perSubjectMinutes: null,
    },
    priorityMode: isPriorityMode,
    subjects: subjectsPayload,
  };
}
