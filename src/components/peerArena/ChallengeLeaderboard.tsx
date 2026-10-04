import React, { useState, useMemo } from 'react';
import { FirestoreChallenge, ChallengeParticipant } from '../../types/challenge';
import { PeerContender } from '../../types/peerArena';
import { PeerSyllabusModal } from './PeerSyllabusModal';
import { useAuth } from '../../context/AuthContext';
import { dedupeSyllabusTopics } from '../../utils/challengeLogic';
import { UserProgressDoc } from '../../services/userProgressService';

interface ChallengeLeaderboardProps {
  challenge: FirestoreChallenge | null;
  isOpen: boolean;
  onClose: () => void;
  memberProgress?: Record<string, UserProgressDoc | null>;
}

export const ChallengeLeaderboard: React.FC<ChallengeLeaderboardProps> = ({
  challenge,
  isOpen,
  onClose,
  memberProgress,
}) => {
  const { user } = useAuth();
  const [selectedPeerForModal, setSelectedPeerForModal] = useState<PeerContender | null>(null);

  if (!isOpen || !challenge) return null;

  // Compute sorted peers and rankings for this specific challenge using StudyTrackContext scoring logic
  const sortedPeers: PeerContender[] = useMemo(() => {
    const participants: ChallengeParticipant[] = challenge.participants || [];
    const rawSyllabus = challenge.selected_syllabus || [];
    const dedupedSyllabus = dedupeSyllabusTopics(rawSyllabus);
    const totalSyllabusTopics = dedupedSyllabus.length || 1;
    const startDate = new Date(challenge.start_date).getTime();
    const elapsedDays = Math.max(1, (Date.now() - startDate) / (1000 * 60 * 60 * 24));

    const mapped: PeerContender[] = participants.map((p, index) => {
      const liveDoc = memberProgress ? memberProgress[p.uid] : null;

      let completed: number;
      let total: number = totalSyllabusTopics;
      let progressMap: Record<string, { theory: boolean; practice: boolean }>;

      if (liveDoc && liveDoc.topicProgress) {
        progressMap = {};
        for (const top of dedupedSyllabus) {
          if (liveDoc.topicProgress[top.id]) {
            progressMap[top.id] = liveDoc.topicProgress[top.id];
          }
        }
        completed = dedupedSyllabus.filter((top) => {
          const tp = liveDoc.topicProgress[top.id];
          return tp && tp.theory && tp.practice;
        }).length;
      } else {
        completed = p.completed_topics || 0;
        total = p.total_challenge_topics || totalSyllabusTopics;
        progressMap = p.topic_progress || {};
      }

      const scorePercent = total > 0 ? (completed / total) * 100 : 0;
      const isCurrentUser = user ? p.uid === user.uid : index === 0;

      const firstIncomplete = dedupedSyllabus.find((top) => {
        const prog = progressMap[top.id];
        return !prog || !prog.theory || !prog.practice;
      });

      const activeFocus = firstIncomplete
        ? `${firstIncomplete.subject}: ${firstIncomplete.title}`
        : 'Sprint Completed';

      const velocity = Number((completed / elapsedDays).toFixed(1));

      return {
        id: p.uid,
        uid: p.uid,
        name: p.name,
        photoURL: p.photoURL || '',
        avatarUrl: p.photoURL || '',
        cohort: challenge.code ? `Room ${challenge.code}` : 'HSC Sprint',
        completed_topics: completed,
        total_challenge_topics: total,
        completedTopics: completed,
        totalTopics: total,
        scorePercent: Math.min(100, Math.round(scorePercent)),
        streakDays: Math.min(Math.ceil(elapsedDays), Math.max(0, Math.ceil(completed))),
        velocityPerDay: Math.max(0, velocity),
        rankTrend: 0,
        activeFocus,
        rank: 0, // Assigned after sort
        isCurrentUser,
        isSquad: isCurrentUser || index < 3,
        last_completion_timestamp: p.last_completion_timestamp || Date.now(),
        topic_progress: progressMap,
      };
    });

    mapped.sort((a, b) => {
      const scoreA = a.scorePercent ?? 0;
      const scoreB = b.scorePercent ?? 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return a.last_completion_timestamp - b.last_completion_timestamp;
    });

    return mapped.map((p, idx) => ({ ...p, rank: idx + 1 }));
  }, [challenge, user, memberProgress]);

  const rank1 = sortedPeers[0];
  const rank2 = sortedPeers[1];
  const rank3 = sortedPeers[2];

  // Group Progress metrics
  const totalTopicsInChallenge = (challenge.selected_syllabus || []).length;
  const groupTotalPossibleTopics = sortedPeers.length * totalTopicsInChallenge;
  const groupTotalCompleted = sortedPeers.reduce((acc, p) => acc + (p.completed_topics ?? p.completedTopics ?? 0), 0);
  const groupAverageProgressPercent =
    groupTotalPossibleTopics > 0
      ? Math.round((groupTotalCompleted / groupTotalPossibleTopics) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-[#c0c9c0]/40 flex flex-col">
        {/* Modal Header */}
        <div className="sticky top-0 z-20 bg-white px-6 py-5 border-b border-[#e5eeff] flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#003820] text-[#6ffbbe] flex items-center justify-center font-bold shadow-xs">
              <span className="material-symbols-outlined text-2xl">leaderboard</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0b1c30]">
                {challenge.challenge_name || 'Study Challenge'} Leaderboard
              </h2>
              <p className="text-xs text-[#404942] font-mono">
                Code: {challenge.code} • {sortedPeers.length} active participants
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#707971] hover:text-[#0b1c30] hover:bg-[#eff4ff] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 flex flex-col gap-8">
          {/* Top-3 Podium */}
          {sortedPeers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-4">
              {/* Rank 2 */}
              {rank2 ? (
                <div className="bg-gradient-to-b from-[#eff4ff] to-white rounded-2xl p-5 border border-[#c0c9c0]/30 shadow-xs flex flex-col items-center text-center relative order-2 md:order-1">
                  <div className="absolute -top-4 w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center border-2 border-white shadow-xs">
                    2
                  </div>
                  <div className="w-14 h-14 rounded-full bg-slate-300 text-slate-800 font-bold text-sm flex items-center justify-center mb-3 shadow-inner">
                    {rank2.name.slice(0, 2).toUpperCase()}
                  </div>
                  <h4 className="text-sm font-bold text-[#0b1c30]">{rank2.name}</h4>
                  <span className="text-[11px] text-[#404942]">{rank2.cohort}</span>
                  <div className="mt-3 font-mono font-extrabold text-[#003820] text-lg">
                    {rank2.scorePercent}%
                  </div>
                  <span className="text-[10px] text-[#707971]">
                    {rank2.completedTopics}/{rank2.totalTopics} topics
                  </span>
                </div>
              ) : (
                <div className="hidden md:block" />
              )}

              {/* Rank 1 */}
              {rank1 && (
                <div className="bg-gradient-to-b from-[#6ffbbe]/20 via-[#eff4ff]/40 to-white rounded-2xl p-6 border-2 border-[#003820]/30 shadow-md flex flex-col items-center text-center relative order-1 md:order-2 transform md:-translate-y-4">
                  <div className="absolute -top-5 w-10 h-10 rounded-full bg-[#003820] text-[#6ffbbe] font-black text-sm flex items-center justify-center border-2 border-white shadow-md">
                    👑 1
                  </div>
                  <div className="w-16 h-16 rounded-full bg-[#003820] text-[#6ffbbe] font-extrabold text-base flex items-center justify-center mb-3 shadow-md">
                    {rank1.name.slice(0, 2).toUpperCase()}
                  </div>
                  <h3 className="text-base font-black text-[#0b1c30]">{rank1.name}</h3>
                  <span className="text-xs text-[#006c49] font-semibold">{rank1.cohort}</span>
                  <div className="mt-3 font-mono font-black text-[#003820] text-2xl">
                    {rank1.scorePercent}%
                  </div>
                  <span className="text-xs text-[#404942] font-semibold">
                    {rank1.completedTopics}/{rank1.totalTopics} topics mastered
                  </span>
                </div>
              )}

            {/* Rank 3 */}
            {rank3 ? (
              <div className="bg-gradient-to-b from-[#eff4ff] to-white rounded-2xl p-5 border border-[#c0c9c0]/30 shadow-xs flex flex-col items-center text-center relative order-3">
                <div className="absolute -top-4 w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center border-2 border-white shadow-xs">
                  3
                </div>
                <div className="w-14 h-14 rounded-full bg-amber-200 text-amber-900 font-bold text-sm flex items-center justify-center mb-3 shadow-inner">
                  {rank3.name.slice(0, 2).toUpperCase()}
                </div>
                <h4 className="text-sm font-bold text-[#0b1c30]">{rank3.name}</h4>
                <span className="text-[11px] text-[#404942]">{rank3.cohort}</span>
                <div className="mt-3 font-mono font-extrabold text-[#003820] text-lg">
                  {rank3.scorePercent}%
                </div>
                <span className="text-[10px] text-[#707971]">
                  {rank3.completedTopics}/{rank3.totalTopics} topics
                </span>
              </div>
            ) : (
              <div className="hidden md:block" />
            )}
            </div>
          )}

          {/* Group Progress & Total Completed widgets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-5 shadow-xs border border-[#c0c9c0]/30 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-[#e5eeff]">
                <span className="text-xs font-bold text-[#0b1c30]">Group Progress</span>
                <span className="px-2 py-0.5 rounded bg-[#eff4ff] text-[#003820] text-[11px] font-mono font-bold">
                  Average Mastery
                </span>
              </div>
              <div className="py-4 flex items-center justify-between">
                <div>
                  <span className="text-3xl font-black font-mono text-[#003820]">
                    {groupAverageProgressPercent}%
                  </span>
                  <p className="text-xs text-[#404942] mt-1">
                    Combined cohort completion rate
                  </p>
                </div>
                <div className="w-20 h-20 rounded-full bg-[#eff4ff] flex items-center justify-center text-[#003820] font-bold font-mono text-sm border border-[#003820]/20">
                  {groupAverageProgressPercent}%
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-xs border border-[#c0c9c0]/30 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-[#e5eeff]">
                <span className="text-xs font-bold text-[#0b1c30]">Topics Completed by Group</span>
                <span className="px-2 py-0.5 rounded bg-[#6ffbbe]/30 text-[#002111] text-[11px] font-mono font-bold">
                  Total Drills
                </span>
              </div>
              <div className="py-4 flex items-center justify-between">
                <div>
                  <span className="text-3xl font-black font-mono text-[#0b1c30]">
                    {groupTotalCompleted}
                  </span>
                  <p className="text-xs text-[#404942] mt-1">
                    Out of {groupTotalPossibleTopics} total syllabus units
                  </p>
                </div>
                {sortedPeers.length > 0 && (
                  <div className="flex items-center -space-x-2">
                    {sortedPeers.slice(0, 4).map((p, i) => (
                      <div
                        key={p.id || i}
                        className="w-9 h-9 rounded-full bg-[#003820] text-[#6ffbbe] font-bold text-xs flex items-center justify-center border-2 border-white shadow-xs"
                        title={p.name}
                      >
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                    ))}
                    {sortedPeers.length > 4 && (
                      <div className="w-9 h-9 rounded-full bg-[#eff4ff] text-[#003820] font-bold text-[10px] flex items-center justify-center border-2 border-white shadow-xs">
                        +{sortedPeers.length - 4}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ranking Table */}
          <div className="bg-white rounded-2xl border border-[#c0c9c0]/30 overflow-hidden shadow-xs">
            <div className="px-6 py-4 bg-[#eff4ff]/60 border-b border-[#e5eeff] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0b1c30]">Participant Rankings</h3>
              <span className="text-xs text-[#404942] font-mono">
                Click any participant to inspect syllabus progress
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[650px]">
                <thead>
                  <tr className="bg-[#eff4ff] text-[#404942] font-semibold text-[11px]">
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Participant</th>
                    <th className="py-3 px-4">Completed Topics</th>
                    <th className="py-3 px-4">Mastery %</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5eeff]">
                  {sortedPeers.map((peer) => (
                    <tr
                      key={peer.id}
                      onClick={() => setSelectedPeerForModal(peer)}
                      className={`hover:bg-[#eff4ff]/40 transition-colors cursor-pointer ${
                        peer.isCurrentUser ? 'bg-[#6ffbbe]/10 font-semibold' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-[#003820]">
                        #{peer.rank}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#003820] text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {peer.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-[#0b1c30]">
                              {peer.name} {peer.isCurrentUser && '(You)'}
                            </span>
                            <span className="block text-[10px] text-[#404942]">{peer.cohort}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        {peer.completedTopics} / {peer.totalTopics}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#003820]">
                        {peer.scorePercent}%
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPeerForModal(peer);
                          }}
                          className="px-3 py-1 rounded-xl bg-[#eff4ff] hover:bg-[#e5eeff] text-[#003820] font-semibold text-[11px] border border-[#c0c9c0]/30 transition-colors"
                        >
                          View Syllabus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Peer Syllabus Modal */}
      {selectedPeerForModal && (
        <PeerSyllabusModal
          isOpen={!!selectedPeerForModal}
          challenge={challenge}
          peer={selectedPeerForModal}
          onClose={() => setSelectedPeerForModal(null)}
          memberProgress={
            selectedPeerForModal && memberProgress
              ? memberProgress[selectedPeerForModal.uid || selectedPeerForModal.id]
              : null
          }
        />
      )}
    </div>
  );
};
