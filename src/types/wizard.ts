export type SprintDuration = 7 | 30;

export interface SyllabusItem {
  id: string;
  subject: string;
  title: string;
  subconcept: string;
  durationMinutes: number;
  tag: string;
  checked: boolean;
}

export interface BoardCard {
  id: string;
  subject: string;
  title: string;
  durationMinutes: number;
  tag: string;
  dayNumber: number; // 1 to 7
  isFinished?: boolean;
}

export interface DayColumnData {
  dayNumber: number;
  dateLabel: string;
  dayName: string;
  capacityMinutes: number;
}
