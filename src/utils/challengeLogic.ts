export interface DedupableSyllabusTopic {
  id: string;
  subject: string;
  title: string;
  subconcept?: string;
  durationMinutes: number;
  tag?: string;
}

/**
 * Normalizes a title by stripping trailing (theory)/(practice) tokens.
 */
function normalizeTitle(title: string): string {
  if (!title) return '';
  let normalized = title.trim();
  
  // Strip common trailing patterns (case-insensitive)
  // (theory), (practice), - theory, - practice, theory, practice
  const patterns = [
    /\s*\(theory\)$/i,
    /\s*\(practice\)$/i,
    /\s*-\s*theory$/i,
    /\s*-\s*practice$/i,
    /\s+theory$/i,
    /\s+practice$/i
  ];
  
  for (const pattern of patterns) {
    normalized = normalized.replace(pattern, '');
  }
  
  return normalized.trim();
}

/**
 * Dedupes syllabus topics based on subject, normalized title, and subconcept.
 * Merges them into a single topic where completion is tracked via flags.
 */
export function dedupeSyllabusTopics(topics: DedupableSyllabusTopic[]): DedupableSyllabusTopic[] {
  if (!topics || topics.length === 0) return [];

  const groups: Record<string, DedupableSyllabusTopic[]> = {};

  topics.forEach((topic) => {
    const normTitle = normalizeTitle(topic.title);
    const key = `${topic.subject.toLowerCase()}|${normTitle.toLowerCase()}|${(topic.subconcept || '').toLowerCase()}`;
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(topic);
  });

  return Object.values(groups).map((group) => {
    // Merge group into ONE topic
    const first = group[0];
    const maxDuration = Math.max(...group.map(t => t.durationMinutes || 0));
    
    // Clean up title: use the normalized version of the first one for the canonical name
    // but we can also just use first.title if we want to keep one "real" name.
    // The requirement says: "Merge each group into ONE topic: keep the FIRST topic's id, subject, and subconcept"
    
    const merged: DedupableSyllabusTopic = {
      id: first.id,
      subject: first.subject,
      title: normalizeTitle(first.title), // Use normalized title as canonical
      subconcept: first.subconcept,
      durationMinutes: maxDuration,
    };

    // "if any member has tag 'Theory' or 'Practice', drop that tag"
    // We already don't include tag in the merged object if it's undefined.
    // If there were other tags, we'd have to decide what to do. 
    // Requirement says: "if any member has tag 'Theory' or 'Practice', drop that tag"
    const tags = group.map(t => t.tag).filter(Boolean) as string[];
    const otherTags = tags.filter(tag => !/theory|practice/i.test(tag));
    if (otherTags.length > 0) {
      merged.tag = otherTags[0]; // Keep the first non-theory/practice tag if any
    }

    return merged;
  });
}
