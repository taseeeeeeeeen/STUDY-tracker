# STUDY-tracker

A comprehensive study tracking and sprint planning application built with React 19, TypeScript, Tailwind CSS, and Firebase Firestore & Authentication.

## Core Modules

1. **Main Dashboard (`/`)**
   - Daily syllabus sprint progress tracking, completion percentages, and daily study goal monitoring.
2. **HSC Grand Progress (`/hsc-progress`)**
   - Macro curriculum view across all subjects, tracking grand completion percentages and chapter milestones.
3. **Strategy Planner (`/strategy-planner`)**
   - Exam setup with target date countdown and prep window computation.
   - Comprehensive topic scoping directly from the master syllabus.
   - Intelligent capacity-aware auto-balancing across prep days.
   - One-click import into Challenge Wizard preserving custom duration, start date, and day-wise allocation.
4. **Challenge Wizard (`/challenges`)**
   - 3-step sprint creation (configuration, topic selection, and Kanban-style interactive planning board).
   - Drag-and-drop planning with per-chapter and per-topic shifting across days.
   - Capacity overflow warnings and midnight rollover support.
5. **Peer Arena (`/peer-arena`)**
   - Group challenge codes, live peer leaderboards, and collaborative study sprints.
6. **Admin Console (`/admin-dashboard`)**
   - Role management and master syllabus curriculum editor.
   - Protected client-side and enforced server-side via Firestore security rules.
