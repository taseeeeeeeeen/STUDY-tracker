# Subject Balancing & Chapter Priority Scheduling Rules

Implement rigorous subject balancing and chapter progression rules across both the Gemini AI routine engine and the offline strategic scheduling fallback:
1. **Intra-Subject Strict Chapter Progression**: For any subject, its highest-priority chapter must be 100% completed before any subsequent chapter of that subject can begin.
2. **6-Topic Daily Chunk Rule**: Each active chapter is assigned at most 6 topics per day. If a chapter has remaining topics, they carry over to subsequent days before the next chapter of that subject can start.
3. **Multi-Subject Daily Interleaving**: Days can include chapters from distinct subjects once a 6-topic chunk is scheduled, interleaving top-priority chapters across different subjects to maintain holistic syllabus pacing over the available days.

> [!IMPORTANT]
> **User Clarifications Incorporated**:
> - **Multi-Subject Days**: Confirmed. Days can feature chapters from distinct subjects to fill daily study slots.
> - **6-Topic Chunking**: Confirmed. Strictly chunk chapters at 6 topics per day per chapter.
> - **Subject Interleaving**: Confirmed. Interleave highest-priority chapters across subjects across the study window.
> - **Zero UI Redesign**: Strictly retain 100% of existing UI elements, styles, Tailwind classes, and color palettes.

---

## 1. Overview & Core Concept

Currently, the schedule engine distributes chapters based on general capacity and sequential order, which could lead to scheduling multiple chapters of the same subject simultaneously, or rushing through an entire subject before others start. 

The updated scheduling logic enforces a structured pedagogical pipeline:
- **Sequential Mastery**: A student never starts Chapter 2 of a subject while Chapter 1 of that same subject has pending topics.
- **Micro-Dosing / Chunking**: Instead of overwhelming students with entire multi-topic chapters in a single day, chapters are parsed in bite-sized chunks of up to 6 topics per day.
- **Balanced Multitasking**: Rather than studying only Physics for a week, students can tackle a 6-topic chunk of Physics and a 6-topic chunk of Chemistry on the same day if days left and daily capacity permit.

---

## 2. Scheduling Architecture & Algorithm Design

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Subject Balancing & Chunking Engine                   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌─────────────────────────────────────┐     ┌─────────────────────────────────────┐
│    Gemini AI Planner (Online)       │     │    Offline Heuristic Routine        │
│ • System instruction with strict    │     │ • Queue-based round-robin scheduler │
│   6-topic chunking constraint       │     │ • Enforces max 6 topics / chapter   │
│ • Intra-subject prerequisite gating │     │ • Locks chapter until 100% complete │
│ • Multi-subject interleaving prompt │     │ • Interleaves active subjects       │
└──────────────────┬──────────────────┘     └──────────────────┬──────────────────┘
                   │                                           │
                   └─────────────────────┬─────────────────────┘
                                         ▼
                   ┌───────────────────────────────────────────┐
                   │    Post-Processing & Invariant Validation │
                   │ • Ensures no skipped topics               │
                   │ • Validates intra-subject order           │
                   │ • Generates standard BoardCard allocation │
                   └───────────────────────────────────────────┘
```

### Key Algorithmic Rules:
1. **Subject Active Queue**:
   - For each subject with selected topics, identify its chapters ordered strictly by user-defined priority (`priorityChapterOrder`).
   - Each subject maintains a cursor pointing to its currently active chapter.
   - Chapter $K+1$ cannot become active until Chapter $K$ has 0 remaining topics.
2. **Daily Allocation Loop**:
   - For each study day (Day 1 to Day $N$):
     - Iterate through active subjects in a balanced rotation.
     - For the active subject's current chapter, take up to $\min(6, \text{remaining topics of chapter})$ topics.
     - Create a `BoardCard` for this day with these topics.
     - If the day has room and other subjects have pending chapters, introduce the next subject's active chapter (also capped at 6 topics).
     - Once all chapters of an active subject are done, that subject is marked completed.
3. **Rollover & Carry-Over Marking**:
   - When a chapter requires multiple days (e.g., 14 topics $\rightarrow$ 6 on Day 1, 6 on Day 2, 2 on Day 3), Day 2 and Day 3 cards are flagged with `isCarriedOver: true` and `carriedOverFromDay: 1`.

---

## 3. Technical Changes & Scope

### 1. `src/services/aiRoutineService.ts`
- Update `buildSystemInstruction(payload)` to explicitly detail:
  - **Constraint 1 (Intra-Subject Priority Rule)**: For each subject, the top selected chapter must be 100% completed before any subsequent chapter of that subject can start.
  - **Constraint 2 (6-Topic Chunking Rule)**: Assign at most 6 topics per chapter on any single day. Remaining topics of that chapter must be completed on subsequent days before the next chapter of that subject begins.
  - **Constraint 3 (Multi-Subject Interleaving)**: Allow chapters from different subjects on the same day to balance coverage across the available study duration.

### 2. `src/utils/strategyPlannerLogic.ts`
- Refactor `buildStrategicRoutine` to implement the round-robin subject interleaving algorithm with strict 6-topic chapter chunking and intra-subject dependency gating.
- This guarantees that both the AI engine and the offline fallback engine produce strictly compliant, high-quality schedules matching the user's rules.

### 3. `src/services/aiRoutineValidator.ts`
- Enhance code-side invariant checks to verify intra-subject chapter ordering and flag any deviations as warnings rather than crashing.

---

## 4. Verification Plan

1. **Unit & Algorithm Verification**:
   - Test a multi-chapter scenario (e.g. Physics Chapter 1 with 14 topics, Physics Chapter 2 with 5 topics, Chemistry Chapter 1 with 8 topics across 5 days):
     - Verify Physics Chapter 1 takes 6 topics on Day 1, 6 on Day 2, 2 on Day 3.
     - Verify Physics Chapter 2 ONLY begins on Day 3 or Day 4 (never before Day 3).
     - Verify Chemistry Chapter 1 is interleaved on Day 1/Day 2 alongside Physics.
2. **Type Safety & Build Verification**:
   - Run `npm run lint` (`tsc --noEmit`) to verify strict typing with zero errors.
   - Run `compile_applet` to confirm successful production build.
3. **UI Preservation**:
   - Verify that all existing styles, buttons, drag-and-drop handles, subject pastel colors, and card layouts in `StrategyPlannerPage.tsx` remain 100% identical and intact.
