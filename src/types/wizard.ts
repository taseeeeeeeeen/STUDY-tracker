export type SprintDuration = 7 | 14 | 21 | 30 | number;

export interface SyllabusItem {
  id: string;
  subject: string;
  title: string;
  subconcept: string;
  durationMinutes: number;
  tag: string;
  checked: boolean;
  chapterId: string;
  chapterName: string;
}

export interface BoardTopic {
  id: string;
  title: string;
  subconcept?: string;
  durationMinutes: number;
  tag?: string;
  subject?: string;
  chapterId?: string;
  chapterName?: string;
  isCarriedOver?: boolean;
  carriedOverFromDay?: number;
  isMultiDayPart?: boolean;
  partInfo?: string;
  dayNumber?: number;
}

export interface BoardCard {
  id: string;
  chapterId?: string;
  chapterName?: string;
  subject: string;
  title: string;
  durationMinutes: number;
  tag: string;
  dayNumber: number; // 1 to 7 or 1 to 30
  topics?: BoardTopic[];
  isCarriedOver?: boolean;
  carriedOverFromDay?: number;
  isMultiDayPart?: boolean;
  partInfo?: string;
}

export interface DayColumnData {
  dayNumber: number;
  dateLabel: string;
  dayName: string;
  capacityMinutes: number;
}

export interface ChapterPriorityEntry {
  chapterId: string;
  chapterName: string;
  subject: string;
  totalMinutes?: number;
  topicCount?: number;
}
