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
    todayCompletionPercentage,
    completedUnits,
    totalUnits,
    completedTopicsCount,
    toggleDashboardTheory,
    toggleDashboardPractice,
    addDashboardTopic,
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
    timeZone: 'Asia/Dhaka',
  });

  return (
    <div className="w-full">
      <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* No Active Study Sprint fallback card */}
        {!activeChallenge && (
          <div className="p-4 bg-white rounded-xl shadow-xs text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-[#c0c9c0]/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#eff4ff] rounded-full flex items-center justify-center text-[#003820] shrink-0">
                <span className="material-symbols-outlined">rocket_launch</span>
              </div>
              <div>
                <p className="font-bold text-[#0b1c30]">No Active Study Sprint</p>
                <p className="text-[#404942]">Create a challenge or join a room to start tracking your progress with friends.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/challenges"
                className="px-4 py-2 bg-[#003820] text-white rounded-xl font-bold hover:bg-[#0f5132] transition-colors"
              >
                Create Challenge
              </Link>
              <Link
                to="/peer-arena"
                className="px-4 py-2 bg-[#eff4ff] text-[#003820] rounded-xl font-bold hover:bg-[#e5eeff] transition-colors"
              >
                Join Room
              </Link>
            </div>
          </div>
        )}

        {/* Header Greeting & Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl sm:text-4xl text-[#0b1c30] font-bold tracking-tight">
                Welcome back, {user?.name || 'Student'}
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#6ffbbe]/30 text-[#003820] text-xs font-semibold font-mono">
                {user?.role === 'admin' ? 'Admin' : 'Student'}
              </span>
            </div>
            <p className="text-sm text-[#404942] flex items-center gap-2">
              <span>Here is your study plan for today</span>
              <span className="w-1 h-1 rounded-full bg-[#c0c9c0]" />
              <span className="font-semibold text-[#0b1c30]">{formattedDate}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/challenges"
              className="px-4 py-2 bg-[#003820] hover:bg-[#004e2d] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-base text-[#6ffbbe]">add_task</span>
              <span>Create Challenge</span>
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
            {activeChallenge ? (
              <ActionZone
                tasks={tasks}
                currentTime={currentTime}
                onToggleTheory={toggleDashboardTheory}
                onTogglePractice={toggleDashboardPractice}
                onOpenAddTopic={() => setIsAddTopicOpen(true)}
              />
            ) : (
              <div className="bg-white p-12 rounded-3xl border border-dashed border-[#c0c9c0] text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 bg-[#eff4ff] rounded-2xl flex items-center justify-center mx-auto text-[#003820]">
                  <span className="material-symbols-outlined text-3xl">task_alt</span>
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-[#0b1c30]">Start Your Study Journey</h3>
                  <p className="text-sm text-[#404942] max-w-sm mx-auto">
                    You haven't setup a study sprint yet. Plan your topics and schedule to see your daily tasks here.
                  </p>
                </div>
                <Link
                  to="/challenges"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#003820] text-white rounded-2xl font-bold shadow-md hover:bg-[#0f5132] transition-all"
                >
                  <span className="material-symbols-outlined text-base">add_circle</span>
                  Create My First Sprint
                </Link>
              </div>
            )}
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
            <StreakWidget streakDays={streakDays} userCreatedAt={user?.createdAt} />
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
