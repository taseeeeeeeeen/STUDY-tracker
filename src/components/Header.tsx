import React, { useState } from 'react';

interface HeaderProps {
  streakDays: number;
  activeTab: 'dashboard' | 'subjects' | 'weekly-schedule' | 'analytics' | 'hsc-progress' | 'challenges' | 'peer-arena';
  onSelectTab: (tab: 'dashboard' | 'subjects' | 'weekly-schedule' | 'analytics' | 'hsc-progress' | 'challenges' | 'peer-arena') => void;
  onOpenQuickLog: () => void;
  onOpenStudyMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  streakDays,
  activeTab,
  onSelectTab,
  onOpenQuickLog,
  onOpenStudyMode,
}) => {
  const [themeDark, setThemeDark] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <header className="sticky top-0 left-0 right-0 z-40 bg-white border-b border-[#c0c9c0]/40 shadow-xs">
      <div className="h-16 max-w-[1440px] mx-auto px-4 sm:px-8 flex items-center justify-between gap-4">
        {/* Brand & Nav */}
        <div className="flex items-center gap-8">
          <div
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-[#003820] flex items-center justify-center text-[#6ffbbe] shadow-xs">
              <span className="material-symbols-outlined text-xl">school</span>
            </div>
            <span className="font-bold text-lg text-[#003820] tracking-tight font-sans">
              StudyTrack
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-6 h-16 text-sm">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`flex items-center h-full px-1 border-b-2 font-medium transition-colors cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'text-[#003820] font-semibold border-[#003820]'
                  : 'text-[#404942] hover:text-[#0b1c30] border-transparent'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => onSelectTab('subjects')}
              className={`flex items-center h-full px-1 border-b-2 font-medium transition-colors cursor-pointer ${
                activeTab === 'subjects'
                  ? 'text-[#003820] font-semibold border-[#003820]'
                  : 'text-[#404942] hover:text-[#0b1c30] border-transparent'
              }`}
            >
              Subjects
            </button>
            <button
              onClick={() => onSelectTab('weekly-schedule')}
              className={`flex items-center h-full px-1 border-b-2 font-medium transition-colors cursor-pointer ${
                activeTab === 'weekly-schedule'
                  ? 'text-[#003820] font-semibold border-[#003820]'
                  : 'text-[#404942] hover:text-[#0b1c30] border-transparent'
              }`}
            >
              Weekly Schedule
            </button>
            <button
              onClick={() => onSelectTab('analytics')}
              className={`flex items-center h-full px-1 border-b-2 font-medium transition-colors cursor-pointer ${
                activeTab === 'analytics'
                  ? 'text-[#003820] font-semibold border-[#003820]'
                  : 'text-[#404942] hover:text-[#0b1c30] border-transparent'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => onSelectTab('hsc-progress')}
              className={`flex items-center h-full px-1 border-b-2 font-medium transition-colors cursor-pointer ${
                activeTab === 'hsc-progress'
                  ? 'text-[#003820] font-semibold border-[#003820]'
                  : 'text-[#404942] hover:text-[#0b1c30] border-transparent'
              }`}
            >
              HSC Progress
            </button>
            <button
              onClick={() => onSelectTab('challenges')}
              className={`flex items-center h-full px-1 border-b-2 font-medium transition-colors cursor-pointer ${
                activeTab === 'challenges'
                  ? 'text-[#003820] font-semibold border-[#003820]'
                  : 'text-[#404942] hover:text-[#0b1c30] border-transparent'
              }`}
            >
              Challenges
            </button>
            <button
              onClick={() => onSelectTab('peer-arena')}
              className={`flex items-center h-full px-1 border-b-2 font-medium transition-colors cursor-pointer ${
                activeTab === 'peer-arena'
                  ? 'text-[#003820] font-semibold border-[#003820]'
                  : 'text-[#404942] hover:text-[#0b1c30] border-transparent'
              }`}
            >
              Peer Arena
            </button>
          </nav>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3">
          {/* Streak pill */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#6ffbbe]/25 text-[#003820] border border-[#6ffbbe]/80">
            <span className="material-symbols-outlined text-base leading-none text-[#006c49]">
              local_fire_department
            </span>
            <span className="text-xs font-semibold tabular-nums">
              Streak: {streakDays} Days 🔥
            </span>
          </div>

          {/* Quick Actions (mobile visible) */}
          <button
            onClick={onOpenQuickLog}
            className="md:hidden p-2 rounded-lg text-[#404942] hover:bg-[#eff4ff] transition-colors"
            title="Quick Log"
          >
            <span className="material-symbols-outlined text-xl">add</span>
          </button>
          <button
            onClick={onOpenStudyMode}
            className="md:hidden p-2 rounded-lg text-[#003820] hover:bg-[#eff4ff] transition-colors"
            title="Study Mode"
          >
            <span className="material-symbols-outlined text-xl">bolt</span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setThemeDark(!themeDark)}
            aria-label="Toggle Theme"
            className="p-2 rounded-lg text-[#404942] hover:text-[#0b1c30] hover:bg-[#eff4ff] transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-xl">
              {themeDark ? 'dark_mode' : 'light_mode'}
            </span>
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              aria-label="Notifications"
              className="p-2 rounded-lg text-[#404942] hover:text-[#0b1c30] hover:bg-[#eff4ff] transition-colors relative"
              type="button"
            >
              <span className="material-symbols-outlined text-xl">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#ba1a1a]" />
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-[#c0c9c0]/50 p-3 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between pb-2 border-b border-[#e5eeff]">
                  <span className="text-xs font-semibold text-[#0b1c30]">Notifications</span>
                  <span className="text-[10px] text-[#404942]">2 unread</span>
                </div>
                <div className="py-2 space-y-2 text-xs">
                  <div className="p-2 rounded-lg bg-[#eff4ff] text-[#0b1c30]">
                    <p className="font-medium">Midterm review session scheduled</p>
                    <p className="text-[11px] text-[#404942]">Physics: Mechanics problem set in 2 hrs</p>
                  </div>
                  <div className="p-2 rounded-lg bg-[#eff4ff] text-[#0b1c30]">
                    <p className="font-medium">24h Task Expiration Warning</p>
                    <p className="text-[11px] text-[#404942]">Tasks lock automatically 24h after generation</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="flex items-center pl-1">
            <div className="w-8 h-8 rounded-full bg-[#003820] text-[#6ffbbe] flex items-center justify-center font-semibold text-xs border border-[#c0c9c0]">
              EL
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
