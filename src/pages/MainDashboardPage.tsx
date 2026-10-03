import React, { useState } from 'react';
import { useStudyTrack } from '../context/StudyTrackContext';
import { useAuth } from '../context/AuthContext';
import { TopOverviewCards } from '../components/TopOverviewCards';
import { ActionZone } from '../components/ActionZone';
import { WeeklyProgressChart } from '../components/WeeklyProgressChart';
import { FocusTimer } from '../components/FocusTimer';
import { StreakWidget } from '../components/StreakWidget';
import { AddTopicModal } from '../components/AddTopicModal';
import { DetailedBreakdownModal } from '../components/DetailedBreakdownModal';
import { Link } from 'react-router-dom';

export const MainDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const {
    tasks,
    activeChallenge,
    weeklyStats,
    backlog,
    sprint,
    streakDays,
    currentTime,
    timeOffsetHours,
    todayCompletionPercentage,
    completedUnits,
    totalUnits,
    completedTopicsCount,
    toggleDashboardTheory,
    toggleDashboardPractice,
    addDashboardTopic,
    fastForwardTime,
    resetTime,
  } = useStudyTrack();

  const [isAddTopicOpen, setIsAddTopicOpen] = useState(false);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

  // Active topic for Pomodoro widget
  const firstActiveTask = tasks.find(
    (t) => !t.isLocked && !(t.theoryCompleted && t.practiceCompleted)
  );

  const formattedDate = new Date(currentTime).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="w-full">
      <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Sync Awareness Notification Bar */}
        <div className="p-3 bg-[#003820] text-white rounded-xl shadow-xs text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-[#6ffbbe]/40">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-[#6ffbbe]">
              swap_horizontal_circle
            </span>
            <span>
              <strong>Firestore Real-Time onSnapshot Active:</strong> Toggling Theory or Practice instantly syncs to Room{' '}
              <strong className="text-[#6ffbbe] font-mono">{activeChallenge?.code || 'CH-9A2X'}</strong> and updates the Peer Arena leaderboard in real-time.
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/peer-arena"
              className="text-[#6ffbbe] hover:underline font-semibold flex items-center gap-0.5"
            >
              Live Peer Arena <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </Link>
            <Link
              to="/hsc-progress"
              className="text-white/80 hover:text-white hover:underline font-semibold flex items-center gap-0.5"
            >
              HSC Progress <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </Link>
          </div>
        </div>

        {/* Header Greeting & Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl sm:text-4xl text-[#0b1c30] font-bold tracking-tight">
                Welcome back, {user?.name || 'Scholar'}
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#6ffbbe]/30 text-[#003820] text-xs font-semibold font-mono">
                {user?.role === 'admin' ? 'Admin' : 'Scholar'}
              </span>
              {activeChallenge && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#003820] text-[#6ffbbe] text-xs font-mono font-bold border border-[#6ffbbe]/50">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6ffbbe] animate-pulse" />
                  {activeChallenge.code}
                </span>
              )}
            </div>
            <p className="text-sm text-[#404942] flex items-center gap-2">
              <span>Here's what you need to conquer today</span>
              <span className="w-1 h-1 rounded-full bg-[#c0c9c0]" />
              <span className="font-semibold text-[#0b1c30]">{formattedDate}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/challenges"
              className="px-4 py-2 bg-[#eff4ff] hover:bg-[#e5eeff] text-[#003820] text-xs font-semibold rounded-xl shadow-xs border border-[#c0c9c0]/40 transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">military_tech</span>
              <span>Challenge Wizard</span>
            </Link>
            <Link
              to="/peer-arena"
              className="px-4 py-2 bg-white hover:bg-[#eff4ff] text-[#0b1c30] text-xs font-semibold rounded-xl shadow-xs border border-[#c0c9c0]/40 transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">sports_esports</span>
              <span>Peer Arena</span>
            </Link>
          </div>
        </div>

        {/* Top Bento Overview: 3 Metric Cards */}
        <TopOverviewCards
          completionPercentage={todayCompletionPercentage}
          completedUnits={completedUnits}
          totalUnits={totalUnits}
          completedTopicsCount={completedTopicsCount}
          totalTopicsCount={tasks.length}
          weeklyStats={weeklyStats}
          backlog={backlog}
          sprint={sprint}
        />

        {/* Main Grid: 7 Cols (Today's Action Zone) + 5 Cols (Analytics & Widgets) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Today's Action Zone (7 Cols) */}
          <div className="lg:col-span-7">
            <ActionZone
              tasks={tasks}
              currentTime={currentTime}
              timeOffsetHours={timeOffsetHours}
              onToggleTheory={toggleDashboardTheory}
              onTogglePractice={toggleDashboardPractice}
              onOpenAddTopic={() => setIsAddTopicOpen(true)}
              onFastForwardTime={fastForwardTime}
              onResetTime={resetTime}
            />
          </div>

          {/* Right Column: Visualized Data & Extra Bento Cards (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Bento 1: Weekly Progress Chart */}
            <WeeklyProgressChart
              weeklyStats={weeklyStats}
              onOpenBreakdown={() => setIsBreakdownOpen(true)}
            />

            {/* Bento 2: Pomodoro Focus Timer Widget */}
            <FocusTimer
              currentTopicTitle={
                firstActiveTask
                  ? `${firstActiveTask.subject}: ${firstActiveTask.title}`
                  : 'All Planned Sessions Completed!'
              }
            />

            {/* Bento 3: Study Streak & Badges */}
            <StreakWidget streakDays={streakDays} />
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddTopicModal
        isOpen={isAddTopicOpen}
        onClose={() => setIsAddTopicOpen(false)}
        onAddTask={addDashboardTopic}
      />

      <DetailedBreakdownModal
        isOpen={isBreakdownOpen}
        onClose={() => setIsBreakdownOpen(false)}
        weeklyStats={weeklyStats}
      />
    </div>
  );
};
