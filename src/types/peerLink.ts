export type PeerLinkStatus = 'requested' | 'active' | 'rejected';

export interface PeerLink {
  id: string; // sortedUidA_sortedUidB
  uids: string[];
  status: PeerLinkStatus;
  requestedBy: string;
  requesterName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PeerComparisonWeeklyStats {
  topicsDone: number;
  topicsTotal: number;
  percent: number;
}

export interface PeerComparisonResult {
  myWeek: PeerComparisonWeeklyStats;
  peerWeek: PeerComparisonWeeklyStats;
  myOverallPercent: number;
  peerOverallPercent: number;
}
