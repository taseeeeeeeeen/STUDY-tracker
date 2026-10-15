/**
 * Utility functions for UI components.
 */

/**
 * Maps a subject name to a soft, light pastel background Tailwind class string.
 * Uses deterministic hashing so each subject receives a distinct light pastel color.
 */
export function getSubjectColor(subject: string): string {
  if (!subject) return 'bg-slate-50';

  const PASTEL_BG_CLASSES = [
    'bg-purple-50',
    'bg-emerald-50',
    'bg-rose-50',
    'bg-sky-50',
    'bg-amber-50',
    'bg-teal-50',
    'bg-yellow-50',
    'bg-indigo-50',
    'bg-pink-50',
    'bg-cyan-50',
  ];

  let hash = 0;
  const normalized = subject.trim().toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }

  const index = Math.abs(hash) % PASTEL_BG_CLASSES.length;
  return PASTEL_BG_CLASSES[index];
}
