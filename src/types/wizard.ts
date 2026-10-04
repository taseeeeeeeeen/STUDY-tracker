export type SprintDuration = 7 | 30;

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
}

export interface DayColumnData {
  dayNumber: number;
  dateLabel: string;
  dayName: string;
  capacityMinutes: number;
}
