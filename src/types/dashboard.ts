export type SubjectType = string;

export interface Task {
  id: string;
  subject: SubjectType;
  durationMinutes: number;
  title: string;
  description: string;
  theoryCompleted: boolean;
  practiceCompleted: boolean;
  createdAt: number; // Unix timestamp in milliseconds
  isLocked: boolean;
  lockReason?: string;
  isPriority?: boolean;
  isCarriedOver?: boolean;
  carriedOverFromDay?: number;
}

export interface SubjectWeeklyStat {
  subject: SubjectType;
  label: string;
  done: number;
  remaining: number;
  total: number;
  color: string;
  bgColor: string;
}

export interface WeeklyBacklog {
  midtermWeek: number;
  targetDay: string;
  targetTime: string;
  daysRemaining: number;
}

export interface ActiveSprint {
  name: string;
  phase: string;
  daysLeft: number;
  daysCompleted: number;
  totalDays: number;
  rewardBadge: string;
  topicProgressPercent: number;
  completedTopics: number;
  totalTopics: number;
}
