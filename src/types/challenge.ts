export interface ParticipantTopicProgress {
  theory: boolean;
  practice: boolean;
}

export interface ChallengeParticipant {
  uid: string;
  name: string;
  photoURL?: string;
  email?: string;
  completed_topics: number;
  total_challenge_topics: number;
  last_completion_timestamp: number;
  topic_progress?: Record<string, ParticipantTopicProgress>;
  joined_at?: string;
}

export interface FirestoreChallenge {
  challenge_id: string;
  code: string;
  challenge_name?: string;
  created_by: string;
  creator_name?: string;
  duration: number;
  start_date: string;
  end_date?: string;
  status?: 'active' | 'archived' | 'completed';
  archivedAt?: string;
  selected_syllabus: {
    id: string;
    subject: string;
    title: string;
    subconcept?: string;
    durationMinutes: number;
    tag?: string;
  }[];
  day_wise_allocation?: Record<string, unknown[]>;
  participants: ChallengeParticipant[];
  updatedAt: string;
}
