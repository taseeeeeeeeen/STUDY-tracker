import { Task, SubjectWeeklyStat, ActiveSprint, WeeklyBacklog } from '../types/dashboard';

// Current time reference point
const NOW = Date.now();
const ONE_HOUR = 60 * 60 * 1000;

export const INITIAL_TASKS: Task[] = [
  {
    id: 'task-1',
    subject: 'Physics',
    durationMinutes: 45,
    title: 'Classical Mechanics & Gravitational Fields',
    description: "Kepler's laws and angular momentum conservation",
    theoryCompleted: true,
    practiceCompleted: false,
    createdAt: NOW - 3 * ONE_HOUR, // 3 hours ago -> Within 24 hours (Unlocked)
    isLocked: false,
    isPriority: true,
  },
  {
    id: 'task-2',
    subject: 'Chemistry',
    durationMinutes: 60,
    title: 'Organic Synthesis & Reaction Mechanisms',
    description: 'Nucleophilic acyl substitution & carbonyl additions',
    theoryCompleted: true,
    practiceCompleted: true,
    createdAt: NOW - 6 * ONE_HOUR, // 6 hours ago -> Within 24 hours (Unlocked)
    isLocked: false,
    isPriority: false,
  },
  {
    id: 'task-3',
    subject: 'Math',
    durationMinutes: 50,
    title: "Multivariable Calculus: Stokes' Theorem",
    description: 'Vector line integrals, curl fields, surface orientation',
    theoryCompleted: true,
    practiceCompleted: false,
    createdAt: NOW - 10 * ONE_HOUR, // 10 hours ago -> Within 24 hours (Unlocked)
    isLocked: false,
    isPriority: true,
  },
  {
    id: 'task-4',
    subject: 'Physics',
    durationMinutes: 55,
    title: 'Quantum Entanglement & Spin Dynamics',
    description: 'Bell inequalities, state vectors and quantum teleportation basics',
    theoryCompleted: false,
    practiceCompleted: false,
    createdAt: NOW - 26 * ONE_HOUR, // 26 hours ago (> 24h) -> Locked!
    isLocked: true,
    lockReason: 'Prerequisite: Complete Classical Mechanics (24h window closed)',
    isPriority: false,
  },
  {
    id: 'task-5',
    subject: 'Biology',
    durationMinutes: 40,
    title: 'Molecular Genetics & CRISPR-Cas9',
    description: 'Guide RNA mechanism, Cas-9 endonuclease cleavage & DNA repair',
    theoryCompleted: false,
    practiceCompleted: false,
    createdAt: NOW - 28 * ONE_HOUR, // 28 hours ago (> 24h) -> Locked!
    lockReason: 'Unlocks tomorrow at 08:00 AM (24h generation window expired)',
    isLocked: true,
    isPriority: false,
  },
];

export const INITIAL_WEEKLY_STATS: SubjectWeeklyStat[] = [
  {
    subject: 'Physics',
    label: 'Phys',
    done: 8,
    remaining: 6,
    total: 14,
    color: '#003820', // primary dark green
    bgColor: '#6ffbbe', // secondary mint
  },
  {
    subject: 'Chemistry',
    label: 'Chem',
    done: 6,
    remaining: 5,
    total: 11,
    color: '#003820',
    bgColor: '#6ffbbe',
  },
  {
    subject: 'Math',
    label: 'Math',
    done: 10,
    remaining: 3,
    total: 13,
    color: '#003820',
    bgColor: '#6ffbbe',
  },
  {
    subject: 'Biology',
    label: 'Bio',
    done: 4,
    remaining: 1,
    total: 5,
    color: '#003820',
    bgColor: '#6ffbbe',
  },
  {
    subject: 'History',
    label: 'Hist',
    done: 7,
    remaining: 1,
    total: 8,
    color: '#003820',
    bgColor: '#6ffbbe',
  },
];

export const INITIAL_SPRINT: ActiveSprint = {
  name: '30-Day Deep Work Sprint',
  phase: 'Sprint Phase 2',
  daysLeft: 5,
  daysCompleted: 25,
  totalDays: 30,
  rewardBadge: 'Gold Badge unlock on Sunday',
};

export const INITIAL_BACKLOG: WeeklyBacklog = {
  midtermWeek: 8,
  targetDay: 'Sunday',
  targetTime: '23:59',
  daysRemaining: 3,
};
