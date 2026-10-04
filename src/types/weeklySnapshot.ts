export interface WeeklySubjectStat {
  subject: string;
  done: number;   // fully completed topics (theory AND practice)
  total: number;  // topics planned for this subject in the user's own scope
}

export interface WeeklySnapshot {
  uid: string;
  weekKey: string;                 // ISO week, e.g. '2026-W40'
  displayName: string;
  photoURL?: string;
  activeChallengeId: string | null;
  activeChallengeCode?: string;
  subjects: WeeklySubjectStat[];
  topicsCompleted: number;         // fully completed topics in own scope
  totalPlanned: number;            // topics in own scope
  unitsCompleted: number;          // theory points + practice points
  streakDays: number;
  updatedAt: string;               // ISO timestamp
}

export function getIsoWeekKey(date: Date): string {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const year = target.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const weekNo = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const paddedWeek = String(weekNo).padStart(2, '0');
  return `${year}-W${paddedWeek}`;
}
