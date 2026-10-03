export interface HSCTopic {
  id: string;
  title: string;
  subconcept: string;
  weightageMarks: number;
  cqTarget: number;
  cqDone: number;
  mcqTotal: number;
  mcqDone: number;
  is_theory_done: boolean;
  is_practice_done: boolean;
}

export interface HSCChapter {
  id: string;
  chapterNumber: number;
  title: string;
  topics: HSCTopic[];
}

export interface HSCSubject {
  id: string;
  name: string;
  paperType: '1st' | '2nd' | 'both';
  subtitle: string;
  totalMarks: number;
  icon: string;
  chapters: HSCChapter[];
}

export interface HSCProgressSummary {
  grandProgressPercent: number;
  overallTheoryPercent: number;
  overallPracticePercent: number;
  totalTopics: number;
  completedTopicsCount: number;
  completedTheoryCount: number;
  completedPracticeCount: number;
  totalChapters: number;
  completedChaptersCount: number;
  totalMCQs: number;
  completedMCQs: number;
  totalCQs: number;
  completedCQs: number;
}
