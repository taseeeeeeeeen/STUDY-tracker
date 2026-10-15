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
    warnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
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
                chapterName: { type: Type.STRING },
                subject: { type: Type.STRING },
                title: { type: Type.STRING },
                durationMinutes: { type: Type.INTEGER },
                tag: { type: Type.STRING },
                dayNumber: { type: Type.INTEGER },
                topics: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      title: { type: Type.STRING },
                      subconcept: { type: Type.STRING },
                      durationMinutes: { type: Type.INTEGER },
                      tag: { type: Type.STRING },
                      isCarriedOver: { type: Type.BOOLEAN },
                      carriedOverFromDay: { type: Type.INTEGER },
                    },
                    required: ['id', 'title', 'durationMinutes'],
                  },
                },
                isCarriedOver: { type: Type.BOOLEAN },
                carriedOverFromDay: { type: Type.INTEGER },
              },
              required: ['chapterId', 'chapterName', 'subject', 'title', 'durationMinutes', 'dayNumber', 'topics'],
            },
          },
        },
        required: ['dayNumber', 'cards'],
      },
    },
  },
  required: ['status', 'days', 'warnings'],
};

function buildSystemInstruction(payload: AiPlanningPayload): string {
  return [
    'You are an expert study routine planner.',
    `Target days: ${payload.numDays} (Day 1 through Day ${payload.numDays}). Daily total capacity: ${payload.dailyTimeLimits.totalPerDayMinutes} minutes.`,
    'You MUST strictly follow these three core scheduling rules:',
    '1. STRICT INTRA-SUBJECT CHAPTER PROGRESSION (Rule 1): For each subject, its selected chapters must be tackled strictly in priority order. The top selected chapter of a subject MUST be 100% completed (all its topics finished) before ANY subsequent chapter of that same subject can begin. NEVER start or schedule topics from a new chapter of subject X while a previous chapter of subject X has incomplete/pending topics.',
    '2. 6-TOPIC DAILY CHUNKING (Rule 2): When scheduling topics for an active chapter on any given day, assign at most 6 topics of that chapter to that day. If a chapter has more than 6 topics (e.g., 14 topics), schedule its first 6 topics on the first day, the next 6 topics on the next available day, and the remaining 2 topics on the third day. Only once all topics of that chapter are finished does the subject unlock and advance to its next chapter.',
    '3. MULTI-SUBJECT BALANCED INTERLEAVING (Rule 3): A single day CAN and SHOULD include chapters from multiple distinct subjects (e.g. 6 topics of Physics and 6 topics of Chemistry on Day 1). Interleave the highest priority pending chapters across available subjects to balance study workload across the target days based on the remaining days and syllabus volume.',
    `Hard Capacity Constraint: Target daily capacity is ${payload.dailyTimeLimits.totalPerDayMinutes} minutes. Each card durationMinutes MUST equal the exact sum of its topics' durationMinutes. If fitting all topics into ${payload.numDays} days requires exceeding daily limits or is impossible, mark status = 'infeasible_unsolvable' or 'infeasible_relaxed' and document reasons in warnings.`,
    'Output format: Return ONLY a valid JSON object matching the requested schema with all days (Day 1 to Day N) and card structures populated.',
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
  const orderedIds = chapterPriorityPairs.map((p) => p.chapterId);

  const { allocation, warnings } = buildStrategicRoutine({
    topics: flattenedTopics,
    numDays: payload.numDays,
    dailyCapacityMinutes: payload.dailyTimeLimits.totalPerDayMinutes,
    ...(payload.priorityMode && orderedIds.length > 0 ? { priorityChapterOrder: orderedIds } : {}),
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
    import.meta.env.VITE_GEMINI_API_KEY ||
    (import.meta.env.GEMINI_API_KEY as string) ||
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
