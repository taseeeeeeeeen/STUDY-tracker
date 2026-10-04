import { HSCSubject } from '../types/hsc';
import { MasterSubject } from '../types/syllabus';
import { DEFAULT_HSC_SYLLABUS } from './defaultSyllabusSeed';

export function convertMasterToHSC(
  masterSubs: MasterSubject[],
  userProgress?: Record<string, { theory?: boolean; practice?: boolean }>
): HSCSubject[] {
  return masterSubs.map((sub) => {
    const isFirst = sub.name.includes('1st') || sub.name.includes('১ম');
    const isSecond = sub.name.includes('2nd') || sub.name.includes('২য়');
    const paperType: '1st' | '2nd' | 'both' = isFirst ? '1st' : isSecond ? '2nd' : 'both';

    let icon = 'auto_stories';
    if (sub.name.includes('Physics') || sub.name.includes('ফিজিক্স')) icon = 'speed';
    else if (sub.name.includes('Chemistry') || sub.name.includes('কেমিস্ট্রি')) icon = 'science';
    else if (sub.name.includes('Math') || sub.name.includes('ম্যাথ') || sub.name.includes('গণিত')) icon = 'calculate';
    else if (sub.name.includes('Biology') || sub.name.includes('জীব')) icon = 'biotech';
    else if (sub.name.includes('ICT') || sub.name.includes('তথ্য')) icon = 'computer';

    return {
      id: sub.id,
      name: sub.name,
      paperType,
      subtitle: sub.code || 'Core Syllabus',
      totalMarks: 100,
      icon,
      chapters: (sub.chapters || []).map((ch) => ({
        id: ch.id,
        chapterNumber: ch.order,
        title: ch.name,
        topics: (ch.topics || []).map((t) => {
          const progress = userProgress?.[t.id];
          return {
            id: t.id,
            title: t.title,
            subconcept: t.subconcept || `${ch.name} • Concept`,
            weightageMarks: 2,
            cqTarget: 2,
            cqDone: progress?.practice ? 2 : 0,
            mcqTotal: 25,
            mcqDone: progress?.theory ? 25 : 0,
            is_theory_done: Boolean(progress?.theory),
            is_practice_done: Boolean(progress?.practice),
          };
        }),
      })),
    };
  });
}

export const INITIAL_HSC_MASTER_SYLLABUS: HSCSubject[] = convertMasterToHSC(DEFAULT_HSC_SYLLABUS);
