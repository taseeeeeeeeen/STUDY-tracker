import { GoogleGenAI, Type } from '@google/genai';
import { AiPlanningPayload } from '../utils/aiPlanningPayload';
import { BoardCard } from '../types/wizard';
import { buildStrategicRoutine } from '../utils/strategyPlannerLogic';
import {
  AiRoutineResponseSchema,
  validateAndEnforceInvariants,
  RawAiRoutineResponse,
} from './aiRoutineValidator';

export interface AiRoutineResult {
  status: 'ok' | 'infeasible_relaxed' | 'infeasible_unsolvable';
  allocation: Record<string, BoardCard[]>;
  warnings: string[];
}

export const MODEL_ID = 'gemini-3.5-flash';
export const CANDIDATE_MODELS = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      enum: ['ok', 'infeasible_relaxed', 'infeasible_unsolvable'],
    },
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dayNumber: { type: Type.INTEGER },
          cards: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                chapterId: { type: Type.STRING },
                topics: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                    },
                    required: ['id'],
                  },
                },
              },
              required: ['chapterId', 'topics'],
            },
          },
        },
        required: ['dayNumber', 'cards'],
      },
    },
  },
  required: ['status', 'days'],
};

function buildSystemInstruction(payload: AiPlanningPayload): string {
  const prepDays = payload.numDays;
  const capacityMins = payload.dailyTimeLimits.totalPerDayMinutes;
  const priorityOrderStr =
    payload.priorityChapterOrder && payload.priorityChapterOrder.length > 0
      ? payload.priorityChapterOrder.join(' -> ')
      : 'Sequential priority order';

  return [
    'You are a high-speed study routine scheduling engine.',
    `Target: ${prepDays} days (Day 1..Day ${prepDays}). Daily capacity limit: ${capacityMins} minutes.`,
    `Global Priority: ${priorityOrderStr}.`,
    '',
    'Core Constraints:',
    '1. Priority Lock: For any subject, schedule 100% of the active chapter before starting its next chapter. Follow priority order strictly.',
    '2. Single Chapter / Subject / Day: At most one chapter per subject per day. Interleave distinct base subjects per day.',
    `3. Full-Horizon Pacing: Distribute topics evenly across all ${prepDays} days. Never leave trailing days empty when topics >= ${prepDays}.`,
    '4. Minified Output: Return strictly minified JSON. Each card only needs { chapterId, topics: [{ id }] }. Do NOT include titles, descriptions, warnings, or verbose text.',
    '5. Multi-day chapter parts are calculated automatically in post-processing. Do NOT output isCarriedOver or backlog flags.',
  ].join('\n');
}

export function fallbackOfflineRoutine(
  payload: AiPlanningPayload,
  reasonWarning?: string
): AiRoutineResult {
  const flattenedTopics: any[] = [];
  const chapterPriorityPairs: { chapterId: string; priorityIndex: number }[] = [];

  payload.subjects.forEach((subj) => {
    subj.chapters.forEach((ch) => {
      if (ch.priorityIndex !== null && ch.priorityIndex !== undefined) {
        chapterPriorityPairs.push({ chapterId: ch.chapterId, priorityIndex: ch.priorityIndex });
      }
      ch.topics.forEach((t) => {
        flattenedTopics.push({
          id: t.id,
          subject: subj.subject,
          title: t.title,
          subconcept: t.subconcept,
          durationMinutes: t.durationMinutes,
          tag: t.tag || 'Core Concept',
          checked: true,
          chapterId: ch.chapterId,
          chapterName: ch.chapterName,
        });
      });
    });
  });

  chapterPriorityPairs.sort((a, b) => a.priorityIndex - b.priorityIndex);
  const orderedIds =
    payload.priorityChapterOrder && payload.priorityChapterOrder.length > 0
      ? payload.priorityChapterOrder
      : chapterPriorityPairs.map((p) => p.chapterId);

  const { allocation, warnings } = buildStrategicRoutine({
    topics: flattenedTopics,
    numDays: payload.numDays,
    dailyCapacityMinutes: payload.dailyTimeLimits.totalPerDayMinutes,
    ...(payload.priorityMode && orderedIds.length > 0 ? { priorityChapterOrder: orderedIds } : {}),
    chapterCustomDays: payload.chapterCustomDays,
  });

  const finalWarnings = reasonWarning ? [reasonWarning, ...warnings] : warnings;

  return {
    status: finalWarnings.length > 0 ? 'infeasible_relaxed' : 'ok',
    allocation,
    warnings: finalWarnings,
  };
}

export async function generateAiRoutine(payload: AiPlanningPayload): Promise<AiRoutineResult> {
  const apiKey =
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      (import.meta.env.VITE_GEMINI_API_KEY || (import.meta.env.GEMINI_API_KEY as string))) ||
    (typeof process !== 'undefined' &&
      process.env &&
      (process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY)) ||
    '';

  if (!apiKey || !apiKey.trim()) {
    return fallbackOfflineRoutine(
      payload,
      'AI API key is missing or not configured. Routine generated using fallback offline planner.'
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = buildSystemInstruction(payload);

    let rawResponseText = '';
    let selectedModel = MODEL_ID;
    let lastError: unknown = null;

    // Attempt generation across candidate models if one is unavailable or fails
    for (const candidateModel of CANDIDATE_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: candidateModel,
          contents: JSON.stringify(payload),
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.2,
          },
        });
        if (response.text) {
          rawResponseText = response.text;
          selectedModel = candidateModel;
          break;
        }
      } catch (candidateErr) {
        lastError = candidateErr;
        console.warn(`Gemini generation with ${candidateModel} failed, trying candidate fallback:`, candidateErr);
      }
    }

    if (!rawResponseText) {
      console.warn('All Gemini candidate models failed or returned empty response:', lastError);
      return fallbackOfflineRoutine(
        payload,
        'AI service request was unable to complete. Routine generated using fallback offline planner.'
      );
    }

    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(rawResponseText);
    } catch {
      parsedJson = null;
    }

    let parseResult = parsedJson ? AiRoutineResponseSchema.safeParse(parsedJson) : null;

    // Retry once if Zod schema parse failed or JSON parse failed
    if (!parseResult || !parseResult.success) {
      const errorDetails =
        parseResult && !parseResult.success
          ? parseResult.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n')
          : 'Invalid JSON formatting';

      const retryPrompt = [
        'The previous JSON output failed validation with the following errors:',
        errorDetails,
        'Please fix all formatting issues and return a valid JSON matching the schema.',
        'Payload:',
        JSON.stringify(payload),
      ].join('\n');

      try {
        const retryResponse = await ai.models.generateContent({
          model: selectedModel,
          contents: retryPrompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.1,
          },
        });
        const retryText = retryResponse.text || '';
        const retryJson = JSON.parse(retryText);
        parseResult = AiRoutineResponseSchema.safeParse(retryJson);
      } catch (retryErr) {
        console.warn('Gemini API retry failed:', retryErr);
        return fallbackOfflineRoutine(
          payload,
          'AI output format validation failed after retry. Routine generated using fallback offline planner.'
        );
      }
    }

    if (!parseResult || !parseResult.success) {
      return fallbackOfflineRoutine(
        payload,
        'AI output did not conform to schema after repair attempt. Routine generated using fallback offline planner.'
      );
    }

    // Pass valid raw response through code-side invariant checks
    return validateAndEnforceInvariants(parseResult.data as RawAiRoutineResponse, payload);
  } catch (err) {
    console.warn('Unexpected error in generateAiRoutine:', err);
    return fallbackOfflineRoutine(
      payload,
      'An unexpected error occurred during AI planning. Routine generated using fallback offline planner.'
    );
  }
}
