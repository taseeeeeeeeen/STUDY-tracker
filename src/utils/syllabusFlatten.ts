import { MasterSubject } from '../types/syllabus';
import { SyllabusItem } from '../types/wizard';
import { dedupeSyllabusTopics } from './challengeLogic';

/**
 * Converts MasterSubject[] from Firestore into flat, deduplicated SyllabusItem[]
 * with proper chapterId, chapterName, and duration metadata.
 * Ensures consistent topic IDs and attributes across Challenge Wizard and Strategy Planner.
 */
export function flattenAndDedupeMasterSyllabus(subjects: MasterSubject[]): SyllabusItem[] {
  if (!subjects || subjects.length === 0) return [];

  const flattenedItems: SyllabusItem[] = [];
  subjects.forEach((sub) => {
    (sub.chapters || []).forEach((ch) => {
      (ch.topics || []).forEach((top) => {
        flattenedItems.push({
          id: top.id,
          subject: sub.name,
          title: top.title,
          subconcept: top.subconcept || `${ch.name} • Concept synthesis`,
          durationMinutes: top.durationMinutes || 45,
          tag: top.tag || 'Core Concept',
          checked: false,
          chapterId: ch.id,
          chapterName: ch.name,
        });
      });
    });
  });

  const dedupedItems = dedupeSyllabusTopics(flattenedItems).map((item) => {
    const orig = flattenedItems.find((o) => o.id === item.id);
    return {
      ...item,
      subconcept: item.subconcept || 'Concept synthesis',
      tag: item.tag || 'Core Concept',
      checked: false,
      chapterId: orig?.chapterId || '',
      chapterName: orig?.chapterName || '',
    };
  }) as SyllabusItem[];

  return dedupedItems;
}
