import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { AppUser } from '../../types/auth';
import { MasterSubject } from '../../types/syllabus';
import { UserProgressDoc } from '../../services/userProgressService';
import { subscribeMasterSyllabus } from '../../services/syllabusService';
import { computeHscProgress, SubjectProgressMetric } from '../../utils/hscProgressMath';

interface AdminStudentProgressProps {
  users: AppUser[];
}

interface UserProgressState {
  progressDoc: UserProgressDoc | null;
  loaded: boolean;
  error?: string;
}

export const AdminStudentProgress: React.FC<AdminStudentProgressProps> = ({ users }) => {
  const [masterSyllabus, setMasterSyllabus] = useState<MasterSubject[]>([]);
  const [syllabusLoading, setSyllabusLoading] = useState(true);
  const [progressCache, setProgressCache] = useState<Record<string, UserProgressState>>({});
  const [fetchingProgress, setFetchingProgress] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | 'name'>('desc');
  const [expandedUserUids, setExpandedUserUids] = useState<Set<string>>(new Set());

  // Subscribe once to master_syllabus for computing progress metrics
  useEffect(() => {
    setSyllabusLoading(true);
    const unsubscribe = subscribeMasterSyllabus(
      (subs) => {
        setMasterSyllabus(subs);
        setSyllabusLoading(false);
      },
      (err) => {
        console.error('Failed to subscribe master syllabus in AdminStudentProgress:', err);
        setSyllabusLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch each user's user_progress/{uid} ONCE via getDoc (Promise.all)
  const fetchAllProgress = useCallback(async () => {
    if (users.length === 0) return;
    setFetchingProgress(true);

    try {
      const results = await Promise.all(
        users.map(async (u) => {
          try {
            const snap = await getDoc(doc(db, 'user_progress', u.uid));
            if (snap.exists()) {
              return {
                uid: u.uid,
                state: {
                  progressDoc: snap.data() as UserProgressDoc,
                  loaded: true,
                },
              };
            }
            return {
              uid: u.uid,
              state: {
                progressDoc: null,
                loaded: true,
              },
            };
          } catch (err) {
            console.warn(`Failed to fetch user_progress for ${u.uid}:`, err);
            return {
              uid: u.uid,
              state: {
                progressDoc: null,
                loaded: true,
                error: err instanceof Error ? err.message : 'Fetch error',
              },
            };
          }
        })
      );

      const nextCache: Record<string, UserProgressState> = {};
      results.forEach((r) => {
        nextCache[r.uid] = r.state;
      });
      setProgressCache(nextCache);
    } finally {
      setFetchingProgress(false);
    }
  }, [users]);

  // Initial fetch when tab mounts or user list changes
  useEffect(() => {
    fetchAllProgress();
  }, [fetchAllProgress]);

  const toggleExpand = (uid: string) => {
    setExpandedUserUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  };

  // Compute computed metrics for all users
  const userMetricsList = useMemo(() => {
    return users.map((u) => {
      const state = progressCache[u.uid];
      const progDoc = state?.progressDoc;
      const metrics = progDoc
        ? computeHscProgress(masterSyllabus, progDoc.topicProgress)
        : null;

      return {
        user: u,
        state,
        metrics,
        hasData: Boolean(progDoc),
        updatedAt: progDoc?.updatedAt,
      };
    });
  }, [users, progressCache, masterSyllabus]);

  // Filter & sort
  const filteredAndSortedList = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = userMetricsList.filter(({ user }) => {
      if (!query) return true;
      return (
        (user.name && user.name.toLowerCase().includes(query)) ||
        (user.email && user.email.toLowerCase().includes(query)) ||
        user.uid.toLowerCase().includes(query)
      );
    });

    return filtered.sort((a, b) => {
      if (sortOrder === 'name') {
        const nameA = (a.user.name || a.user.email || '').toLowerCase();
        const nameB = (b.user.name || b.user.email || '').toLowerCase();
        return nameA.localeCompare(nameB);
      }
      const scoreA = a.metrics?.grandPercent ?? -1;
      const scoreB = b.metrics?.grandPercent ?? -1;
      if (sortOrder === 'asc') {
        return scoreA - scoreB;
      }
      // default: 'desc'
      return scoreB - scoreA;
    });
  }, [userMetricsList, searchQuery, sortOrder]);

  const totalRegistered = users.length;
  const withProgressData = userMetricsList.filter((m) => m.hasData).length;
  const avgCompletion =
    withProgressData > 0
      ? Math.round(
          userMetricsList.reduce((sum, m) => sum + (m.metrics?.grandPercent || 0), 0) /
            withProgressData
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Top Controls & Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-[#c0c9c0]/30 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase font-bold text-[#707971]">
              Students Tracked
            </span>
            <div className="text-2xl font-black text-[#0b1c30] tabular-nums">
              {totalRegistered}
            </div>
            <span className="text-[10px] text-[#006c49] font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">group</span>
              {withProgressData} with active progress
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#eff4ff] text-[#003820] flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">monitoring</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#c0c9c0]/30 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase font-bold text-[#707971]">
              Average HSC Completion
            </span>
            <div className="text-2xl font-black text-[#006c49] tabular-nums">
              {avgCompletion}%
            </div>
            <span className="text-[10px] text-[#707971] font-medium">
              Across active study tracks
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#006c49] flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">percent</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#c0c9c0]/30 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase font-bold text-[#707971]">
              Master Syllabus
            </span>
            <div className="text-2xl font-black text-purple-700 tabular-nums">
              {syllabusLoading ? '...' : masterSyllabus.length}
            </div>
            <span className="text-[10px] text-purple-600 font-medium">
              Official HSC subjects loaded
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">menu_book</span>
          </div>
        </div>
      </div>

      {/* Filter, Search & Refresh Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-[#c0c9c0]/30 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1 w-full md:w-auto relative">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search students by name, email, or UID..."
            className="w-full pl-10 pr-4 py-2 bg-[#f8f9ff] border border-[#c0c9c0]/40 rounded-xl text-xs text-[#0b1c30] placeholder-[#707971] focus:outline-none focus:ring-2 focus:ring-[#003820]/20 focus:border-[#003820]"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {/* Sort control */}
          <div className="flex items-center gap-1 bg-[#f8f9ff] border border-[#c0c9c0]/40 rounded-xl p-1 text-xs">
            <span className="text-[11px] font-mono font-bold text-[#707971] px-2">Sort:</span>
            <button
              onClick={() => setSortOrder('desc')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                sortOrder === 'desc'
                  ? 'bg-[#003820] text-white'
                  : 'text-[#404942] hover:bg-white'
              }`}
            >
              Highest %
            </button>
            <button
              onClick={() => setSortOrder('asc')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                sortOrder === 'asc'
                  ? 'bg-[#003820] text-white'
                  : 'text-[#404942] hover:bg-white'
              }`}
            >
              Lowest %
            </button>
            <button
              onClick={() => setSortOrder('name')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                sortOrder === 'name'
                  ? 'bg-[#003820] text-white'
                  : 'text-[#404942] hover:bg-white'
              }`}
            >
              Name
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchAllProgress}
            disabled={fetchingProgress}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#003820] text-white hover:bg-[#002817] font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            title="Fetch latest student progress docs"
          >
            <span
              className={`material-symbols-outlined text-base ${
                fetchingProgress ? 'animate-spin' : ''
              }`}
            >
              refresh
            </span>
            <span>{fetchingProgress ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Main Student Progress Table / Cards */}
      <div className="bg-white rounded-2xl border border-[#c0c9c0]/30 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#c0c9c0]/30 flex items-center justify-between bg-[#f8f9ff]/50">
          <div>
            <h3 className="font-black text-[#003820] text-sm sm:text-base flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">insights</span>
              Student HSC Completion Matrix (View Only)
            </h3>
            <p className="text-[11px] text-[#707971] mt-0.5">
              Read-only aggregate metrics derived from live master syllabus & student progress docs.
            </p>
          </div>
          <span className="text-[11px] font-mono text-[#707971]">
            Showing {filteredAndSortedList.length} of {users.length}
          </span>
        </div>

        {fetchingProgress && Object.keys(progressCache).length === 0 ? (
          // Loading Skeleton
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="animate-pulse p-4 rounded-xl bg-gray-50 border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200" />
                  <div className="space-y-2">
                    <div className="w-36 h-3 bg-gray-200 rounded" />
                    <div className="w-48 h-2 bg-gray-100 rounded" />
                  </div>
                </div>
                <div className="w-full md:w-1/3 space-y-2">
                  <div className="w-full h-3 bg-gray-200 rounded" />
                  <div className="w-2/3 h-2 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredAndSortedList.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#707971]">
            <span className="material-symbols-outlined text-4xl text-gray-300 mb-2 block">
              person_search
            </span>
            No student records match the search criteria.
          </div>
        ) : (
          <div className="divide-y divide-[#c0c9c0]/20">
            {filteredAndSortedList.map(({ user, metrics, hasData, updatedAt }) => {
              const isExpanded = expandedUserUids.has(user.uid);
              const grandPct = metrics?.grandPercent ?? 0;

              return (
                <div key={user.uid} className="transition-colors hover:bg-[#f8f9ff]/40">
                  {/* Primary Row Header */}
                  <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* User Profile */}
                    <div className="flex items-center gap-3 min-w-[240px]">
                      <div className="w-10 h-10 rounded-full bg-[#003820] text-[#6ffbbe] flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                        {user.photoURL ? (
                          <img
                            src={user.photoURL}
                            alt={user.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (user.name || user.email || 'ST').slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[#0b1c30] truncate max-w-[160px] sm:max-w-[220px]">
                            {user.name || 'Unnamed Student'}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                              user.role === 'admin'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {user.role}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#707971] font-mono truncate max-w-[220px]">
                          {user.email || user.uid}
                        </div>
                        {updatedAt && (
                          <div className="text-[10px] text-[#707971] font-mono mt-0.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">schedule</span>
                            Last active: {new Date(updatedAt).toLocaleDateString()} {new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar & Percent */}
                    <div className="flex-1 max-w-md w-full">
                      {hasData && metrics ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="font-bold text-[#003820]">
                              Overall HSC Progress
                            </span>
                            <span className="font-bold text-[#003820] text-sm tabular-nums">
                              {grandPct}%
                            </span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#003820] to-[#006c49] transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(0, grandPct))}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-[#707971] font-mono">
                            <span>
                              {metrics.completedTopicsCount} / {metrics.totalTopics} topics fully done
                            </span>
                            <span>
                              Theory: {metrics.completedTheoryCount} • Practice: {metrics.completedPracticeCount}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 border border-gray-200/60 text-[#707971] text-xs font-mono">
                          <span className="material-symbols-outlined text-base text-gray-400">
                            hourglass_empty
                          </span>
                          <span>No progress data logged yet</span>
                        </div>
                      )}
                    </div>

                    {/* Action toggle for Subject details */}
                    <div className="flex items-center justify-end">
                      {hasData && metrics ? (
                        <button
                          onClick={() => toggleExpand(user.uid)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#c0c9c0]/60 hover:bg-[#eff4ff] text-xs font-bold text-[#003820] transition-colors cursor-pointer"
                        >
                          <span>{isExpanded ? 'Hide Subjects' : 'View Subjects'}</span>
                          <span className="material-symbols-outlined text-sm">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-400 font-mono px-3 py-1.5">
                          No breakdown
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded Per-Subject Details */}
                  {isExpanded && metrics && (
                    <div className="px-5 pb-5 pt-1 bg-[#f8f9ff]/70 border-t border-[#c0c9c0]/15">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold text-[#006c49] uppercase tracking-wider">
                          Per-Subject Breakdown
                        </span>
                        <span className="text-[10px] text-[#707971] font-mono">
                          Formula: (Theory + Practice) / (Topics * 2) * 100
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {metrics.perSubject.map((sub: SubjectProgressMetric) => (
                          <div
                            key={sub.subjectId}
                            className="p-3.5 rounded-xl bg-white border border-[#c0c9c0]/30 shadow-2xs space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-xs text-[#0b1c30] truncate">
                                {sub.name}
                              </span>
                              <span className="text-xs font-black font-mono text-[#003820] tabular-nums">
                                {sub.percent}%
                              </span>
                            </div>

                            <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className="h-full bg-[#006c49] rounded-full transition-all duration-200"
                                style={{ width: `${Math.min(100, Math.max(0, sub.percent))}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-[#707971] font-mono">
                              <span>
                                {sub.completedTopics}/{sub.totalTopics} topics
                              </span>
                              <span>
                                T: {sub.completedTheory} • P: {sub.completedPractice}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
