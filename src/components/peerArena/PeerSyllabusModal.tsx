import React from 'react';
import { ChallengeParticipant, FirestoreChallenge } from '../../types/challenge';
import { UserProgressDoc } from '../../services/userProgressService';
import { dedupeSyllabusTopics } from '../../utils/challengeLogic';

interface PeerSyllabusModalProps {
  isOpen: boolean;
  onClose: () => void;
  peer: (ChallengeParticipant & { rank?: number; scorePercent?: number; id?: string }) | null;
  challenge: FirestoreChallenge | null;
  memberProgress?: UserProgressDoc | null;
}

export const PeerSyllabusModal: React.FC<PeerSyllabusModalProps> = ({
  isOpen,
  onClose,
  peer,
  challenge,
  memberProgress,
}) => {
  if (!isOpen || !peer || !challenge) return null;

  // Resolve the participant record from challenge snapshot
  const peerIdentifier = peer.uid || peer.id;
  const participant =
    challenge.participants.find((p) => p.uid === peerIdentifier) || peer;

  const rawSyllabus = challenge.selected_syllabus || [];
  const dedupedSyllabus = dedupeSyllabusTopics(rawSyllabus);
  const totalTopics = dedupedSyllabus.length || rawSyllabus.length || 1;

  let completedTopics = 0;
  let scorePercent = 0;
  let topicProgressMap: Record<string, { theory: boolean; practice: boolean }> = {};
  let lastActiveTimestamp: number | null = null;

  if (memberProgress) {
    topicProgressMap = memberProgress.topicProgress || {};
    completedTopics = dedupedSyllabus.filter((top) => {
      const prog = topicProgressMap[top.id];
      return prog && prog.theory && prog.practice;
    }).length;
    scorePercent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

    // Resolve max completion timestamp from completionLog
    let maxTimestamp: number | null = null;
    if (memberProgress.completionLog) {
      for (const log of Object.values(memberProgress.completionLog)) {
        if (log?.theory && (maxTimestamp === null || log.theory > maxTimestamp)) {
          maxTimestamp = log.theory;
        }
        if (log?.practice && (maxTimestamp === null || log.practice > maxTimestamp)) {
          maxTimestamp = log.practice;
        }
      }
    }
    lastActiveTimestamp = maxTimestamp ?? participant.last_completion_timestamp ?? null;
  } else {
    completedTopics = participant.completed_topics || 0;
    scorePercent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
    topicProgressMap = participant.topic_progress || {};
    lastActiveTimestamp = participant.last_completion_timestamp ?? null;
  }

  const avatarImage =
    participant.photoURL || ('avatarUrl' in peer ? (peer as { avatarUrl?: string }).avatarUrl : undefined);

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-[#c0c9c0]/40 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-[#003820] to-[#005232] text-white flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border-2 border-white/20 overflow-hidden flex items-center justify-center text-xl font-bold text-[#6ffbbe] shadow-md">
              {avatarImage ? (
                <img
                  src={avatarImage}
                  alt={participant.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                participant.name?.slice(0, 2).toUpperCase() || 'ST'
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black tracking-tight">{participant.name}</h3>
                {peer.rank && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#6ffbbe] text-[#003820]">
                    Rank #{peer.rank}
                  </span>
                )}
              </div>
              <p className="text-xs text-white/80 font-mono mt-0.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#6ffbbe] animate-pulse" />
                <span>Room: <strong className="text-[#6ffbbe]">{challenge.code}</strong> • {challenge.duration}-Day Sprint</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Overview Stats Bar */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-[#f8f9ff] border-b border-[#e5eeff] text-center">
          <div className="p-3 bg-white rounded-xl border border-[#c0c9c0]/30 shadow-3xs">
            <span className="text-[10px] uppercase font-mono font-bold text-[#707971] block">
              Overall Score
            </span>
            <span className="text-xl font-black text-[#003820] tabular-nums">
              {scorePercent}%
            </span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-[#c0c9c0]/30 shadow-3xs">
            <span className="text-[10px] uppercase font-mono font-bold text-[#707971] block">
              Completed Topics
            </span>
            <span className="text-xl font-black text-[#0b1c30] tabular-nums">
              {completedTopics} / {totalTopics}
            </span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-[#c0c9c0]/30 shadow-3xs">
            <span className="text-[10px] uppercase font-mono font-bold text-[#707971] block">
              Last Active
            </span>
            <span className="text-xs font-mono font-semibold text-[#006c49] block mt-1.5">
              {lastActiveTimestamp
                ? new Date(lastActiveTimestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Recent'}
            </span>
          </div>
        </div>

        {/* Selected Syllabus & Peer Progress List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#003820] uppercase font-mono tracking-wider">
              Assigned Syllabus Topics ({challenge.selected_syllabus.length})
            </span>
            <span className="text-[11px] text-[#707971]">
              Read-Only Peer Inspection
            </span>
          </div>

          <div className="space-y-2">
            {challenge.selected_syllabus.map((topic, idx) => {
              const prog = topicProgressMap[topic.id] || { theory: false, practice: false };
              const isFullyDone = prog.theory && prog.practice;
              const isPartiallyDone = (prog.theory || prog.practice) && !isFullyDone;

              return (
                <div
                  key={topic.id || idx}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isFullyDone
                      ? 'bg-[#eff4ff]/60 border-[#6ffbbe]/80'
                      : isPartiallyDone
                      ? 'bg-amber-50/40 border-amber-200'
                      : 'bg-white border-[#c0c9c0]/30'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.2 rounded font-mono text-[9px] font-bold bg-[#eff4ff] text-[#003820] border border-[#c0c9c0]/30">
                        {topic.subject}
                      </span>
                      {topic.tag && (
                        <span className="text-[10px] text-[#707971] font-mono">
                          • {topic.tag}
                        </span>
                      )}
                      <span className="text-[10px] text-[#707971] font-mono">
                        ({topic.durationMinutes}m)
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-[#0b1c30] truncate">
                      {topic.title}
                    </h4>
                    {topic.subconcept && (
                      <p className="text-[10px] text-[#707971] truncate mt-0.5">
                        {topic.subconcept}
                      </p>
                    )}
                  </div>

                  {/* Progress Badges for Peer */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Theory Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                        prog.theory
                          ? 'bg-[#6ffbbe]/30 text-[#003820] border border-[#6ffbbe]'
                          : 'bg-gray-100 text-gray-500 border border-gray-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs">
                        {prog.theory ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <span>Theory</span>
                    </span>

                    {/* Practice Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                        prog.practice
                          ? 'bg-[#6ffbbe]/30 text-[#003820] border border-[#6ffbbe]'
                          : 'bg-gray-100 text-gray-500 border border-gray-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs">
                        {prog.practice ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <span>Practice</span>
                    </span>

                    {/* Mastered status */}
                    <span
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold uppercase ${
                        isFullyDone
                          ? 'bg-[#003820] text-[#6ffbbe]'
                          : isPartiallyDone
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {isFullyDone ? '100%' : isPartiallyDone ? '50%' : '0%'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#f8f9ff] border-t border-[#e5eeff] flex items-center justify-between text-xs">
          <span className="text-[#707971] text-[11px]">
            Real-time peer progress dynamically synced via Google Cloud Firestore.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#003820] text-white font-bold text-xs hover:bg-[#004e2d] transition-colors cursor-pointer"
          >
            Close View
          </button>
        </div>
      </div>
    </div>
  );
};
