export interface SyllabusTopic {
  id: string;
  title: string;
  subconcept: string;
  durationMinutes: number;
  tag: string;
  totalWeight?: number;
}

export interface SyllabusChapter {
  id: string;
  name: string;
  order: number;
  topics: SyllabusTopic[];
}

export interface MasterSubject {
  id: string;
  name: string;
  code: string;
  color?: string;
  order: number;
  chapters: SyllabusChapter[];
  updatedAt?: string;
  updatedBy?: string;
}
