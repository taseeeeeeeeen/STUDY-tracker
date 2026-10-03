import React, { useState } from 'react';
import { useStudyTrack } from '../../context/StudyTrackContext';
import { useNavigate, Link } from 'react-router-dom';
import { PeerSyllabusModal } from './PeerSyllabusModal';

interface PeerArenaDashboardProps {
  onBackToDashboard?: () => void;
}

export const PeerArenaDashboard: React.FC<PeerArenaDashboardProps> = ({
  onBackToDashboard,
}) => {
  const navigate = useNavigate();
  const handleBack = () => {
    if (onBackToDashboard) onBackToDashboard();
    else navigate('/');
  };

  // Consume from StudyTrackContext for unified global state!
  const {
    challenge,
    activeChallenge,
    peers,
    sortedPeers,
    generateNewChallengeCode,
    updateUserPeerTopics,
    joinChallengeCode,
    triggerToast,
  } = useStudyTrack();

  // Local UI States
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'squad' | 'top10'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [joinInputCode, setJoinInputCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [selectedPeerForModal, setSelectedPeerForModal] = useState<any | null>(null);

  // REQUIREMENT 1: Challenge Code Generator & Clipboard Copy
  const handleCopyCode = () => {
    navigator.clipboard
      .writeText(challenge.code)
      .then(() => {
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      })
      .catch(() => {
        triggerToast(`Challenge Code: ${challenge.code}`);
      });
  };

  const handleJoinChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInputCode.trim()) return;
    setJoining(true);
    await joinChallengeCode(joinInputCode.trim());
    setJoinInputCode('');
    setJoining(false);
  };

  // Top 3 Podium dynamically bound from sortedPeers
  const rank1 = sortedPeers[0];
  const rank2 = sortedPeers[1];
  const rank3 = sortedPeers[2];

  // Current user item in sorted list
  const currentUser = sortedPeers.find((p) => p.isCurrentUser);

  // Filtered and Searched list
  const displayPeers = sortedPeers.filter((peer) => {
    if (filterTab === 'squad' && !peer.isSquad) return false;
    if (filterTab === 'top10' && peer.rank > 10) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        peer.name.toLowerCase().includes(q) ||
        peer.cohort.toLowerCase().includes(q) ||
        peer.activeFocus.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleSimulateTieBreaker = () => {
    const nusrat = peers.find((p) => p.name === 'Nusrat Jahan');
    if (nusrat && currentUser) {
      const diff = nusrat.completed_topics - currentUser.completed_topics;
      updateUserPeerTopics(diff);
      triggerToast(
        `Tie-Breaker Demo: Elena & Nusrat both have 24 topics (80%). Nusrat finished earlier, so Nusrat holds the higher rank!`
      );
    }
  };

  return (
    <div className="w-full flex flex-col font-sans">
      {/* Main Container */}
      <main className="w-full flex-1">
        <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-8 flex flex-col gap-8">
          {/* Top Action & Hub Bar */}
          <section className="w-full flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[#6ffbbe]/25 text-[#003820] text-xs font-semibold font-mono border border-[#6ffbbe]/60">
                  <span className="material-symbols-outlined text-sm mr-1">bolt</span>
                  LIVE SPRINT ARENA
                </span>
                <span className="text-xs text-[#404942] flex items-center gap-1 font-mono">
                  <span className="w-2 h-2 rounded-full bg-[#006c49] animate-pulse" />
                  {challenge.activePeersCount} online contenders
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl text-[#0b1c30] font-bold tracking-tight">
                Peer Arena & Live Leaderboard
              </h1>
              <p className="text-xs text-[#404942]">
                Compete with study squads, track real-time chapter sprints, and climb the academic ladder with instant tie-breaker math.
              </p>
            </div>

            {/* Quick Join Input Control */}
            <form
              onSubmit={handleJoinChallenge}
              className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-xs border border-[#c0c9c0]/30 shrink-0"
            >
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-[#707971] text-base">
                  key
                </span>
                <input
                  type="text"
                  value={joinInputCode}
                  onChange={(e) => setJoinInputCode(e.target.value)}
                  placeholder="Enter Challenge Code (e.g. CH-9A2X)"
                  className="pl-9 pr-3 py-2 text-xs bg-[#eff4ff] text-[#0b1c30] placeholder:text-[#707971] rounded-xl outline-none w-56 sm:w-64 focus:bg-white border border-transparent focus:border-[#003820] transition-all font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={joining}
                className="bg-[#003820] hover:bg-[#0f5132] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">group_add</span>
                <span>{joining ? 'Joining...' : 'Join Challenge'}</span>
              </button>
            </form>
          </section>

          {/* Active Challenge Banner Hub */}
          <section className="w-full bg-white rounded-2xl shadow-xs p-6 border border-[#c0c9c0]/30 relative overflow-hidden">
            <div className="absolute -right-16 -top-16 w-56 h-56 bg-[#6ffbbe]/15 rounded-full blur-2xl pointer-events-none" />
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-0.5 bg-[#003820] text-white text-[11px] font-semibold rounded-full font-mono">
                    Active Event
                  </span>
                  <span className="text-xs text-[#404942] flex items-center gap-1 font-medium">
                    <span className="material-symbols-outlined text-sm text-[#006c49]">
                      verified
                    </span>
                    {challenge.cohortName}
                  </span>
                </div>
                <h2 className="text-lg text-[#0b1c30] font-bold">
                  {challenge.title}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#404942] pt-1">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-[#006c49]">
                      groups
                    </span>
                    {peers.length} Active Peers
                  </span>
                  <span className="text-[#c0c9c0]">•</span>
                  <span className="flex items-center gap-1 font-semibold text-[#ba1a1a]">
                    <span className="material-symbols-outlined text-sm">timer</span>
                    Sprint closes in: {challenge.timeRemainingStr}
                  </span>
                  <span className="text-[#c0c9c0]">•</span>
                  <span className="font-mono">Target: {challenge.totalTopics} Master Topics</span>
                </div>
              </div>

              {/* Challenge Code Box & Share Controls */}
              <div className="flex flex-wrap items-center gap-3 bg-[#eff4ff] p-3 rounded-2xl border border-[#c0c9c0]/30">
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#404942] uppercase tracking-wider font-semibold font-mono">
                    Your Active Challenge Code
                  </span>
                  <span
                    id="challengeCodeText"
                    className="text-xl font-extrabold text-[#003820] font-mono tracking-widest tabular-nums"
                  >
                    {challenge.code}
                  </span>
                </div>

                <div className="flex items-center gap-2 pl-2 border-l border-[#c0c9c0]/40">
                  {/* REQUIREMENT 1: Copy Button with Clipboard Function */}
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-3 py-2 bg-white text-[#0b1c30] text-xs font-semibold rounded-xl hover:bg-[#e5eeff] shadow-xs border border-[#c0c9c0]/30 transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Copy active challenge code to clipboard"
                  >
                    <span className="material-symbols-outlined text-base">
                      {copyFeedback ? 'check' : 'content_copy'}
                    </span>
                    <span>{copyFeedback ? 'Copied!' : 'Copy'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={generateNewChallengeCode}
                    className="px-3 py-2 bg-white text-[#003820] text-xs font-semibold rounded-xl hover:bg-[#e5eeff] shadow-xs border border-[#c0c9c0]/30 transition-all flex items-center gap-1 cursor-pointer"
                    title="Generate a new random 6-character challenge code"
                  >
                    <span className="material-symbols-outlined text-base">refresh</span>
                    <span>New Code</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Interactive Tester Simulation Strip */}
          <section className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-blue-600 text-xl">
                calculate
              </span>
              <div>
                <p className="font-bold text-[#0b1c30]">
                  Live Math Simulator: Test Sorting & Tie-Breaker Logic
                </p>
                <p className="text-[11px] text-[#404942]">
                  Elena Vance has <strong>{currentUser?.completed_topics || 0} / 30</strong> topics ({Math.round(currentUser?.scorePercent || 0)}%) — Currently Rank #{currentUser?.rank || 4}.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                onClick={() => updateUserPeerTopics(1)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                <span>Complete +1 Topic</span>
              </button>
              <button
                onClick={() => updateUserPeerTopics(-1)}
                className="px-3 py-1.5 bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] font-semibold rounded-xl transition-colors cursor-pointer border border-[#c0c9c0]/30"
              >
                <span>-1 Topic</span>
              </button>
              <button
                onClick={handleSimulateTieBreaker}
                className="px-3 py-1.5 bg-[#e5eeff] hover:bg-[#dce9ff] text-[#003820] font-semibold rounded-xl transition-colors cursor-pointer"
                title="Set Elena's topics equal to Nusrat (24 topics) to verify tie-breaker logic"
              >
                ⚖️ Test Tie-Breaker
              </button>
            </div>
          </section>

          {/* REQUIREMENT 3: Top 3 Gamified Podium (Dynamically bound to sorted array) */}
          <section className="w-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#0b1c30]">Sprint Podium</h3>
                <p className="text-xs text-[#404942]">
                  Top scoring sprint leaders sorted by Score % and completion timestamp
                </p>
              </div>
              <span className="text-xs text-[#006c49] font-mono flex items-center gap-1 bg-[#eff4ff] px-3 py-1 rounded-full border border-[#c0c9c0]/30">
                <span className="material-symbols-outlined text-xs">sync</span> Auto-refreshed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              {/* Rank 2: Silver (Left) */}
              {rank2 && (
                <div
                  onClick={() => setSelectedPeerForModal(rank2)}
                  className="order-2 md:order-1 bg-white rounded-2xl p-6 shadow-xs border border-[#c0c9c0]/30 flex flex-col items-center text-center transition-all hover:-translate-y-1 hover:shadow-md hover:border-slate-400 duration-200 relative overflow-hidden cursor-pointer group"
                  title="Click to inspect this peer's syllabus progress"
                >
                  <div className="w-full flex justify-between items-center mb-3">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#e5eeff] text-[#0b1c30] text-xs font-bold font-mono flex items-center gap-1 border border-[#c0c9c0]/40">
                      <span>🥈</span> Rank #2
                    </span>
                    <span className="text-xs text-[#006c49] font-semibold flex items-center gap-1 font-mono">
                      <span className="material-symbols-outlined text-sm">local_fire_department</span>
                      {rank2.streakDays}d
                    </span>
                  </div>

                  <div className="relative mb-3">
                    <img
                      src={rank2.avatarUrl}
                      alt={rank2.name}
                      className="w-20 h-20 rounded-full object-cover shadow-xs ring-4 ring-slate-300 group-hover:scale-105 transition-transform"
                    />
                    <span className="absolute -bottom-1 -right-1 bg-slate-200 text-[#0b1c30] text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-xs">
                      2
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-[#0b1c30] group-hover:text-[#003820] group-hover:underline flex items-center gap-1">
                    <span>{rank2.name}</span>
                    <span className="material-symbols-outlined text-xs opacity-0 group-hover:opacity-100 text-[#006c49]">visibility</span>
                  </h4>
                  <span className="text-xs text-[#404942]">{rank2.cohort}</span>

                  <div className="w-full mt-4 pt-3 bg-[#eff4ff] rounded-xl p-3 border border-[#c0c9c0]/20">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-[#404942]">Completion</span>
                      <span className="font-bold text-[#0b1c30] font-mono">
                        {Math.round(rank2.scorePercent)}%
                      </span>
                    </div>
                    <div className="w-full bg-[#e5eeff] rounded-full h-2 overflow-hidden mb-2">
                      <div
                        className="bg-[#006c49] h-2 rounded-full transition-all duration-500"
                        style={{ width: `${rank2.scorePercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[11px] font-mono text-[#404942]">
                      <span>
                        {rank2.completed_topics} / {rank2.total_challenge_topics} Topics
                      </span>
                      <span className="text-[#003820] font-semibold">
                        {rank2.velocityPerDay} top/d
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Rank 1: Gold (Center / Elevated) */}
              {rank1 && (
                <div
                  onClick={() => setSelectedPeerForModal(rank1)}
                  className="order-1 md:order-2 bg-white rounded-2xl p-7 shadow-md border-2 border-amber-300 flex flex-col items-center text-center transition-all hover:-translate-y-1 hover:shadow-xl hover:border-amber-400 duration-200 relative overflow-hidden -mt-0 md:-mt-4 cursor-pointer group"
                  title="Click to inspect this peer's syllabus progress"
                >
                  <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500" />
                  <div className="w-full flex justify-between items-center mb-4">
                    <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold font-mono flex items-center gap-1 shadow-xs border border-amber-300">
                      <span>🏆</span> Sprint Champion
                    </span>
                    <span className="text-xs text-[#ba1a1a] font-bold flex items-center gap-1 font-mono">
                      <span className="material-symbols-outlined text-sm">local_fire_department</span>
                      {rank1.streakDays}d Streak
                    </span>
                  </div>

                  <div className="relative mb-3">
                    <img
                      src={rank1.avatarUrl}
                      alt={rank1.name}
                      className="w-24 h-24 rounded-full object-cover shadow-md ring-4 ring-amber-400 group-hover:scale-105 transition-transform"
                    />
                    <span className="absolute -bottom-2 -right-1 bg-amber-400 text-[#002111] text-sm font-extrabold w-8 h-8 rounded-full flex items-center justify-center shadow-sm">
                      1
                    </span>
                  </div>

                  <h4 className="text-xl font-extrabold text-[#0b1c30] tracking-tight group-hover:text-[#003820] group-hover:underline flex items-center gap-1">
                    <span>{rank1.name}</span>
                    <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-100 text-[#006c49]">visibility</span>
                  </h4>
                  <span className="text-xs text-[#003820] font-medium">{rank1.cohort}</span>

                  <div className="w-full mt-4 pt-3 bg-[#eff4ff] rounded-2xl p-4 border border-[#c0c9c0]/30">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-[#404942] font-medium">Sprint Mastery</span>
                      <span className="font-bold text-[#003820] text-sm font-mono">
                        {Math.round(rank1.scorePercent)}%
                      </span>
                    </div>
                    <div className="w-full bg-[#e5eeff] rounded-full h-2.5 overflow-hidden mb-2">
                      <div
                        className="bg-gradient-to-r from-[#006c49] to-[#003820] h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${rank1.scorePercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-xs font-mono text-[#404942]">
                      <span className="text-[#0b1c30] font-semibold">
                        {rank1.completed_topics} / {rank1.total_challenge_topics} Topics Done
                      </span>
                      <span className="text-[#006c49] font-bold">
                        {rank1.velocityPerDay} topics/day
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Rank 3: Bronze (Right) */}
              {rank3 && (
                <div
                  onClick={() => setSelectedPeerForModal(rank3)}
                  className="order-3 bg-white rounded-2xl p-6 shadow-xs border border-[#c0c9c0]/30 flex flex-col items-center text-center transition-all hover:-translate-y-1 hover:shadow-md hover:border-amber-700/50 duration-200 relative overflow-hidden cursor-pointer group"
                  title="Click to inspect this peer's syllabus progress"
                >
                  <div className="w-full flex justify-between items-center mb-3">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-xs font-bold font-mono flex items-center gap-1 border border-amber-200">
                      <span>🥉</span> Rank #3
                    </span>
                    <span className="text-xs text-[#006c49] font-semibold flex items-center gap-1 font-mono">
                      <span className="material-symbols-outlined text-sm">local_fire_department</span>
                      {rank3.streakDays}d
                    </span>
                  </div>

                  <div className="relative mb-3">
                    <img
                      src={rank3.avatarUrl}
                      alt={rank3.name}
                      className="w-20 h-20 rounded-full object-cover shadow-xs ring-4 ring-amber-700/40 group-hover:scale-105 transition-transform"
                    />
                    <span className="absolute -bottom-1 -right-1 bg-amber-700/60 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-xs">
                      3
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-[#0b1c30] group-hover:text-[#003820] group-hover:underline flex items-center gap-1">
                    <span>{rank3.name}</span>
                    <span className="material-symbols-outlined text-xs opacity-0 group-hover:opacity-100 text-[#006c49]">visibility</span>
                  </h4>
                  <span className="text-xs text-[#404942]">{rank3.cohort}</span>

                  <div className="w-full mt-4 pt-3 bg-[#eff4ff] rounded-xl p-3 border border-[#c0c9c0]/20">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-[#404942]">Completion</span>
                      <span className="font-bold text-[#0b1c30] font-mono">
                        {Math.round(rank3.scorePercent)}%
                      </span>
                    </div>
                    <div className="w-full bg-[#e5eeff] rounded-full h-2 overflow-hidden mb-2">
                      <div
                        className="bg-[#006c49] h-2 rounded-full transition-all duration-500"
                        style={{ width: `${rank3.scorePercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[11px] font-mono text-[#404942]">
                      <span>
                        {rank3.completed_topics} / {rank3.total_challenge_topics} Topics
                      </span>
                      <span className="text-[#003820] font-semibold">
                        {rank3.velocityPerDay} top/d
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Live Leaderboard Section */}
          <section className="w-full bg-white rounded-2xl shadow-xs p-6 border border-[#c0c9c0]/30">
            {/* Filter and Search Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#e5eeff]/80">
              <div className="flex items-center gap-1.5 bg-[#eff4ff] p-1 rounded-xl border border-[#c0c9c0]/30">
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    filterTab === 'all'
                      ? 'bg-white text-[#0b1c30] shadow-xs'
                      : 'text-[#404942] hover:text-[#0b1c30]'
                  }`}
                >
                  All Peers ({sortedPeers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('squad')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    filterTab === 'squad'
                      ? 'bg-white text-[#0b1c30] shadow-xs'
                      : 'text-[#404942] hover:text-[#0b1c30]'
                  }`}
                >
                  My Squad
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('top10')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    filterTab === 'top10'
                      ? 'bg-white text-[#0b1c30] shadow-xs'
                      : 'text-[#404942] hover:text-[#0b1c30]'
                  }`}
                >
                  Top 10
                </button>
              </div>

              <div className="relative w-full md:w-80">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#707971] text-base">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by student or batch..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#eff4ff] text-[#0b1c30] placeholder:text-[#707971] rounded-xl outline-none focus:bg-white border border-transparent focus:border-[#003820] shadow-xs transition-all"
                />
              </div>
            </div>

            {/* Table Container */}
            <div className="w-full overflow-x-auto pt-3">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="text-[11px] text-[#404942] uppercase tracking-wider font-semibold font-mono bg-[#eff4ff]/60">
                    <th className="py-2.5 px-3 rounded-l-xl">Rank</th>
                    <th className="py-2.5 px-3">Student & Cohort</th>
                    <th className="py-2.5 px-3">Active Focus</th>
                    <th className="py-2.5 px-3">Completed</th>
                    <th className="py-2.5 px-3 w-48">Score %</th>
                    <th className="py-2.5 px-3">Velocity</th>
                    <th className="py-2.5 px-3 text-right rounded-r-xl">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5eeff] text-xs">
                  {displayPeers.map((peer) => {
                    const isRank1 = peer.rank === 1;
                    const isRank2 = peer.rank === 2;
                    const isRank3 = peer.rank === 3;
                    const isUser = peer.isCurrentUser;

                    return (
                      <tr
                        key={peer.id}
                        className={`transition-colors ${
                          isUser
                            ? 'bg-blue-50/70 border-l-4 border-blue-600 font-medium'
                            : 'hover:bg-[#eff4ff]/40'
                        }`}
                      >
                        {/* Rank with Trophy / Badge Icons */}
                        <td className="py-3 px-3 font-bold">
                          {isRank1 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-800 text-xs shadow-xs font-mono">
                              🏆 1
                            </span>
                          ) : isRank2 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 text-[#0b1c30] text-xs shadow-xs font-mono">
                              🥈 2
                            </span>
                          ) : isRank3 ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-50 text-amber-900 text-xs shadow-xs font-mono">
                              🥉 3
                            </span>
                          ) : isUser ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold shadow-xs font-mono">
                              {peer.rank}
                            </span>
                          ) : (
                            <span className="text-[#404942] font-mono pl-2">
                              #{peer.rank}
                            </span>
                          )}
                        </td>

                        {/* Student & Cohort */}
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() => setSelectedPeerForModal(peer)}
                            className="flex items-center gap-2.5 text-left group cursor-pointer"
                            title="Click to view peer's syllabus progress"
                          >
                            <div className="relative">
                              <img
                                src={peer.avatarUrl}
                                alt={peer.name}
                                className={`w-9 h-9 rounded-full object-cover transition-transform group-hover:scale-105 ${
                                  isRank1
                                    ? 'ring-2 ring-amber-400'
                                    : isUser
                                    ? 'ring-2 ring-blue-500'
                                    : 'border border-[#c0c9c0]/30'
                                }`}
                              />
                              {isUser && (
                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 rounded-full border-2 border-white" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`font-bold truncate transition-colors group-hover:underline ${
                                    isUser
                                      ? 'text-blue-950 group-hover:text-blue-700'
                                      : 'text-[#0b1c30] group-hover:text-[#003820]'
                                  }`}
                                >
                                  {peer.name}
                                </span>
                                {isUser && (
                                  <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] rounded font-extrabold uppercase tracking-wide">
                                    YOU
                                  </span>
                                )}
                                <span className="opacity-0 group-hover:opacity-100 text-[9px] text-[#006c49] font-mono transition-opacity flex items-center gap-0.5 shrink-0">
                                  <span className="material-symbols-outlined text-xs">visibility</span>
                                  <span>View</span>
                                </span>
                              </div>
                              <div
                                className={`text-[11px] ${
                                  isUser ? 'text-blue-900' : 'text-[#404942]'
                                }`}
                              >
                                {peer.cohort}
                              </div>
                            </div>
                          </button>
                        </td>

                        {/* Active Focus */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] ${
                              isUser
                                ? 'bg-blue-100 text-blue-900 font-semibold'
                                : 'bg-[#e5eeff] text-[#003820]'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isUser ? 'bg-blue-600 animate-pulse' : 'bg-[#006c49]'
                              }`}
                            />
                            {peer.activeFocus}
                          </span>
                        </td>

                        {/* Completed Ratio */}
                        <td className="py-3 px-3 font-mono font-semibold tabular-nums">
                          {peer.completed_topics} / {peer.total_challenge_topics}
                        </td>

                        {/* Score % and Progress Bar */}
                        <td className="py-3 px-3">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-mono">
                              <span
                                className={`font-bold tabular-nums ${
                                  isUser ? 'text-blue-700' : 'text-[#003820]'
                                }`}
                              >
                                {peer.scorePercent.toFixed(1)}%
                              </span>
                            </div>
                            <div className="w-full bg-[#e5eeff] rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full transition-all duration-500 ${
                                  isUser ? 'bg-blue-600' : 'bg-[#003820]'
                                }`}
                                style={{ width: `${peer.scorePercent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Velocity */}
                        <td className="py-3 px-3 font-mono text-[11px] tabular-nums">
                          {peer.velocityPerDay} / day
                        </td>

                        {/* Trend */}
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          {peer.rankTrend > 0 ? (
                            <span className="flex items-center justify-end gap-0.5 text-[#006c49]">
                              <span className="material-symbols-outlined text-sm">
                                arrow_drop_up
                              </span>
                              +{peer.rankTrend}
                            </span>
                          ) : peer.rankTrend < 0 ? (
                            <span className="flex items-center justify-end gap-0.5 text-[#ba1a1a]">
                              <span className="material-symbols-outlined text-sm">
                                arrow_drop_down
                              </span>
                              {peer.rankTrend}
                            </span>
                          ) : (
                            <span className="flex items-center justify-end gap-0.5 text-[#707971]">
                              <span className="material-symbols-outlined text-sm">
                                remove
                              </span>
                              0
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Live Sprint Footer */}
            <div className="mt-4 pt-3 border-t border-[#e5eeff] flex flex-col sm:flex-row items-center justify-between text-xs text-[#404942] gap-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#006c49]">
                  check_circle
                </span>
                <span>
                  Tie-breaker formula: Equal Score % resolves ascending by completion timestamp.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onBackToDashboard}
                  className="px-3 py-1 rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] transition-colors cursor-pointer font-medium"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </section>

          {/* Bottom Competitive Widgets & Insights */}
          <section className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Widget 1: Next Rank Gap */}
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#c0c9c0]/30 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-blue-700 font-bold uppercase tracking-wider flex items-center gap-1 font-mono">
                    <span className="material-symbols-outlined text-sm">trending_up</span>
                    Target Gap
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[11px] font-bold">
                    Rank #{currentUser?.rank || 4} ➔ #{Math.max(1, (currentUser?.rank || 4) - 1)}
                  </span>
                </div>
                <h4 className="text-base text-[#0b1c30] font-bold">
                  {currentUser && rank3 && currentUser.completed_topics < rank3.completed_topics
                    ? `${rank3.completed_topics - currentUser.completed_topics} Topics to Podium Overtake`
                    : 'Podium Secured!'}
                </h4>
                <p className="text-xs text-[#404942]">
                  You are tracking close to the leaders. Complete your next scheduled problem set before 10:00 PM to improve your standing.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#e5eeff]/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="font-mono text-[#0b1c30]">Velocity: +0.4 top/d faster</span>
                </div>
                <button
                  type="button"
                  onClick={() => updateUserPeerTopics(1)}
                  className="text-blue-700 hover:text-blue-900 font-bold flex items-center gap-0.5 cursor-pointer font-mono"
                >
                  Solve Next <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Widget 2: Squad Average */}
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#c0c9c0]/30 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#006c49] font-bold uppercase tracking-wider flex items-center gap-1 font-mono">
                    <span className="material-symbols-outlined text-sm">analytics</span> Cohort
                    Pulse
                  </span>
                  <span className="text-xs text-[#006c49] font-semibold font-mono">
                    +4.2% this week
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <h4 className="text-3xl text-[#0b1c30] font-extrabold tracking-tight font-mono tabular-nums">
                    {(
                      peers.reduce((s, p) => s + (p.completed_topics / p.total_challenge_topics) * 100, 0) /
                      peers.length
                    ).toFixed(1)}%
                  </h4>
                  <span className="text-xs text-[#404942]">Squad Average Completion</span>
                </div>
                <p className="text-xs text-[#404942]">
                  Your squad is outperforming the Dhaka Regional Benchmark (62.8%) by 8.6 percentage points.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#e5eeff]/80">
                <div className="w-full bg-[#e5eeff] rounded-full h-2 overflow-hidden mb-1">
                  <div
                    className="bg-[#006c49] h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${(
                        peers.reduce((s, p) => s + (p.completed_topics / p.total_challenge_topics) * 100, 0) /
                        peers.length
                      ).toFixed(1)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#404942] font-mono">
                  <span>0%</span>
                  <span>Benchmark: 62.8%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* Widget 3: Total Topics Mastered by Squad */}
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#c0c9c0]/30 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#003820] font-bold uppercase tracking-wider flex items-center gap-1 font-mono">
                    <span className="material-symbols-outlined text-sm">menu_book</span>
                    Collective Mastery
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#e5eeff] text-[#0b1c30] font-mono text-[10px] font-semibold">
                    {peers.length} Squad Members
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <h4 className="text-3xl text-[#003820] font-extrabold tracking-tight font-mono tabular-nums">
                    {peers.reduce((acc, p) => acc + p.completed_topics, 0)}
                  </h4>
                  <span className="text-xs text-[#404942]">Topics Solved & Mastered</span>
                </div>
                <p className="text-xs text-[#404942]">
                  Cumulative syllabus breakthroughs across Organic Chemistry, Vectors, Complex Numbers, and Dynamics.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#e5eeff]/80 flex items-center justify-between text-xs">
                <div className="flex -space-x-1.5 overflow-hidden">
                  <div className="inline-block h-6 w-6 rounded-full bg-[#003820] text-white text-[10px] font-bold flex items-center justify-center">
                    RC
                  </div>
                  <div className="inline-block h-6 w-6 rounded-full bg-[#006c49] text-white text-[10px] font-bold flex items-center justify-center">
                    TH
                  </div>
                  <div className="inline-block h-6 w-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                    EV
                  </div>
                  <div className="inline-block h-6 w-6 rounded-full bg-amber-700 text-white text-[10px] font-bold flex items-center justify-center">
                    +15
                  </div>
                </div>
                <span className="text-[11px] font-mono text-[#003820] font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-[#006c49]">star</span>
                  96% Accuracy Rate
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Peer Syllabus Progress Inspection Modal */}
      <PeerSyllabusModal
        isOpen={Boolean(selectedPeerForModal)}
        onClose={() => setSelectedPeerForModal(null)}
        peer={selectedPeerForModal}
        challenge={activeChallenge}
      />
    </div>
  );
};
