import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStudyTrack } from '../context/StudyTrackContext';
import { FirestoreChallenge } from '../types/challenge';
import { fetchArchivedChallenges } from '../services/challengeArchiveService';
import {
  computeChallengeArchiveBreakdown,
  ChallengeArchiveBreakdown,
} from '../utils/challengeArchiveMath';
import { parseLocalDate, formatSprintEndDate } from '../utils/dateUtils';

export const ChallengeArchiveSection: React.FC = () => {
  const { user } = useAuth();
  const { activeChallenge, activeChallengeId, userProgress } = useStudyTrack();

  const [archivedChallenges, setArchivedChallenges] = useState<FirestoreChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChallenge, setSelectedChallenge] = useState<FirestoreChallenge | null>(null);

  // Effective active challenge id to exclude
  const currentActiveId = activeChallenge?.challenge_id || activeChallengeId;

  useEffect(() => {
    let isCancelled = false;

    if (!user?.uid) {
      setArchivedChallenges([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchArchivedChallenges(user.uid, currentActiveId)
      .then((list) => {
        if (!isCancelled) {
          setArchivedChallenges(list);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load challenge archive:', err);
        if (!isCancelled) {
          setArchivedChallenges([]);
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [user?.uid, currentActiveId]);

  // Format timeframe for a challenge using local date utils
  const formatTimeframe = (challenge: FirestoreChallenge): string => {
    if (challenge.start_date && challenge.duration) {
      const startDateObj = parseLocalDate(challenge.start_date);
      const formattedStart = startDateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      const formattedEnd = formatSprintEndDate(
        challenge.start_date,
        challenge.duration
      );
      return `${formattedStart} – ${formattedEnd}`;
    }
    return `${challenge.duration || 7} Days`;
  };

  // Helper for status badge styling based on breakdown
  const getStatusBadge = (breakdown: ChallengeArchiveBreakdown) => {
    if (breakdown.totalTopics === 0) {
      return {
        className: 'px-2 py-0.5 rounded-full bg-[#eff4ff] text-[#404942] text-[11px] font-semibold',
        label: 'No Topics',
      };
    }
    if (breakdown.status === 'completed') {
      return {
        className: 'px-2 py-0.5 rounded-full bg-[#6ffbbe]/30 text-[#003820] text-[11px] font-semibold',
        label: 'Completed',
      };
    }
    return {
      className: 'px-2 py-0.5 rounded-full bg-[#eff4ff] text-[#ba1a1a] text-[11px] font-semibold',
      label: 'Expired / Incomplete',
    };
  };

  const selectedBreakdown = useMemo(() => {
    if (!selectedChallenge) return null;
    return computeChallengeArchiveBreakdown(selectedChallenge, userProgress);
  }, [selectedChallenge, userProgress]);

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-3 pb-1">
        <h2 className="text-xl text-[#0b1c30] font-bold tracking-tight">
          Challenge Archive
        </h2>
        <span className="px-2.5 py-0.5 rounded-full bg-[#e5eeff] text-[#0b1c30] text-xs font-semibold font-mono tabular-nums">
          {archivedChallenges.length} {archivedChallenges.length === 1 ? 'Sprint' : 'Sprints'}
        </span>
      </div>

      {/* Content States */}
      {loading ? (
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-[#c0c9c0]/30 text-center">
          <p className="text-xs text-[#404942]">Loading archive...</p>
        </div>
      ) : archivedChallenges.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-dashed border-[#c0c9c0] text-center space-y-2">
          <span className="material-symbols-outlined text-3xl text-[#707971]">archive</span>
          <p className="text-sm font-medium text-[#0b1c30]">No archived challenges yet</p>
          <p className="text-xs text-[#404942]">
            Completed or expired study sprints will automatically be preserved here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {archivedChallenges.map((challenge) => {
            const breakdown = computeChallengeArchiveBreakdown(challenge, userProgress);
            const challengeName =
              challenge.challenge_name?.trim() ||
              `${challenge.duration || 7}-Day Study Sprint`;
            const timeframeStr = formatTimeframe(challenge);
            const badge = getStatusBadge(breakdown);

            return (
              <div
                key={challenge.challenge_id}
                onClick={() => setSelectedChallenge(challenge)}
                className="bg-white p-6 rounded-2xl shadow-xs border border-[#c0c9c0]/30 flex flex-col justify-between hover:shadow-sm transition-shadow cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#404942] uppercase tracking-wider font-semibold font-sans truncate">
                      {timeframeStr}
                    </span>
                    <span className={badge.className}>{badge.label}</span>
                  </div>
                  <div className="mt-2">
                    <h3
                      className="text-lg text-[#0b1c30] font-bold tracking-tight truncate"
                      title={challengeName}
                    >
                      {challengeName}
                    </h3>
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#404942]">Preparation</span>
                    <span className="font-bold text-[#003820] tabular-nums">
                      {Math.round(breakdown.completionPercent)}% ({breakdown.completedTopics}/{breakdown.totalTopics} topics)
                    </span>
                  </div>
                  <div className="w-full bg-[#e5eeff] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#003820] h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, Math.max(0, breakdown.completionPercent))}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[#404942] text-xs pt-1">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-[#707971]">schedule</span>
                      <span>{challenge.duration || 0} Days</span>
                    </span>
                    <span className="text-[#006c49] font-semibold text-xs flex items-center gap-0.5">
                      View breakdown
                      <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Breakdown Modal */}
      {selectedChallenge && selectedBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#c0c9c0]/40 space-y-4 max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#e5eeff]">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-[#0b1c30] truncate">
                    {selectedChallenge.challenge_name?.trim() ||
                      `${selectedChallenge.duration || 7}-Day Study Sprint`}
                  </h3>
                  <span className={getStatusBadge(selectedBreakdown).className}>
                    {getStatusBadge(selectedBreakdown).label}
                  </span>
                </div>
                <p className="text-xs text-[#404942] mt-0.5 truncate">
                  {formatTimeframe(selectedChallenge)} • {selectedBreakdown.completedTopics} of{' '}
                  {selectedBreakdown.totalTopics} topics completed (
                  {Math.round(selectedBreakdown.completionPercent)}%)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedChallenge(null)}
                className="p-1 rounded-lg text-[#707971] hover:text-[#0b1c30] hover:bg-[#eff4ff] cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              {selectedBreakdown.perSubject.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#eff4ff] text-center text-xs text-[#404942]">
                  No subject topics recorded for this challenge.
                </div>
              ) : (
                selectedBreakdown.perSubject.map((subj) => {
                  const isSubjCompleted = subj.pending === 0 && subj.total > 0;
                  const subjPercent =
                    subj.total > 0 ? Math.round((subj.completed / subj.total) * 100) : 0;

                  return (
                    <div
                      key={subj.subject}
                      className="p-3 rounded-xl bg-[#eff4ff] border border-[#c0c9c0]/30 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-[#0b1c30] truncate">{subj.subject}</span>
                          {isSubjCompleted && (
                            <span className="px-2 py-0.5 rounded-full bg-[#6ffbbe]/30 text-[#003820] text-[10px] font-semibold">
                              Completed
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[#404942] tabular-nums shrink-0">
                          {subj.completed} done / {subj.pending} remaining ({subjPercent}%)
                        </span>
                      </div>

                      <div className="w-full bg-[#e5eeff] h-2 rounded-full overflow-hidden flex">
                        <div
                          className="bg-[#003820] h-full transition-all duration-500 rounded-full"
                          style={{ width: `${subjPercent}%` }}
                        />
                      </div>

                      {/* Chapters */}
                      <div className="space-y-2 pt-1.5 border-t border-[#c0c9c0]/20">
                        {subj.chapters.map((ch) => (
                          <div key={ch.chapterId} className="text-xs space-y-1">
                            <div className="flex items-center justify-between text-[#0b1c30] font-medium">
                              <span className="truncate">{ch.chapterName}</span>
                              <span className="tabular-nums font-mono text-[#404942] shrink-0 text-[11px]">
                                {ch.completed}/{ch.total}
                              </span>
                            </div>
                            {ch.pendingTopics.length > 0 && (
                              <ul className="pl-3 space-y-0.5 text-[11px] text-[#404942] list-disc">
                                {ch.pendingTopics.map((title, idx) => (
                                  <li key={idx} className="truncate" title={title}>
                                    {title}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2 border-t border-[#e5eeff]">
              <button
                type="button"
                onClick={() => setSelectedChallenge(null)}
                className="px-4 py-2 bg-[#003820] text-white text-xs font-semibold rounded-xl hover:bg-[#004e2d] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
