import { ParticipantTopicProgress } from './challenge';

export interface PeerContender {
  id: string;
  uid: string;
  name: string;
  cohort: string;
  avatarUrl: string;
  activeFocus: string;
  completed_topics: number;
  total_challenge_topics: number;
  last_completion_timestamp: number; // Unix timestamp in ms
  velocityPerDay: number;
  streakDays: number;
  isCurrentUser?: boolean;
  isSquad?: boolean;
  rankTrend: number; // e.g. +2, 0, -1
  topic_progress?: Record<string, ParticipantTopicProgress>;
  email?: string;
  photoURL?: string;
  completedTopics?: number;
  totalTopics?: number;
  scorePercent?: number;
  rank?: number;
}

export interface ActiveSprintChallenge {
  title: string;
  cohortName: string;
  code: string;
  totalTopics: number;
  activePeersCount: number;
  timeRemainingStr: string;
}
