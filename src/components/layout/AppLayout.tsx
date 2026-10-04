import React, { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import {
  Flame,
  Plus,
  Zap,
  Shield,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  X,
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useStudyTrack } from '../../context/StudyTrackContext';
import { useAuth } from '../../context/AuthContext';
import { QuickLogModal } from '../QuickLogModal';
import { StudyModeModal } from '../StudyModeModal';
import { ScrollToTopButton } from '../ScrollToTopButton';

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);
  const [isStudyModeOpen, setIsStudyModeOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const {
    streakDays,
    toastMessage,
    clearToast,
    tasks,
    toggleDashboardTheory,
    toggleDashboardPractice,
  } = useStudyTrack();

  const { user, isAdmin, logout } = useAuth();
  const location = useLocation();

  // Find active task for study mode
  const activeTask = tasks.find((t) => !t.isLocked && !(t.theoryCompleted && t.practiceCompleted));

  // Breadcrumb label based on route
  const getBreadcrumb = () => {
    switch (location.pathname) {
      case '/hsc-progress':
        return 'HSC Progress • Complete Syllabus';
      case '/challenges':
        return 'Challenges • Study Sprint Setup';
      case '/peer-arena':
        return 'Peer Arena • Study Group';
      case '/admin-dashboard':
        return 'Admin Console • User Management';
      default:
        return 'Dashboard • Today\'s Plan';
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-xl shadow-xl bg-[#003820] text-white text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 border border-[#6ffbbe]/40 max-w-md">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-[#6ffbbe] animate-spin" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={clearToast}
            className="text-white/70 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area (offset by sidebar width on desktop lg:pl-64) */}
      <div className="flex-1 flex flex-col lg:pl-64 transition-all duration-200">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-[#c0c9c0]/30 shadow-xs px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-[#404942] hover:bg-[#eff4ff] transition-colors cursor-pointer"
              title="Open Navigation Menu"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>

            {/* Breadcrumb Indicator */}
            <div className="flex items-center gap-2 text-xs text-[#404942]">
              <Link to="/" className="hover:text-[#003820] font-medium hidden sm:inline">
                StudyTrack
              </Link>
              <span className="text-[#c0c9c0] hidden sm:inline">/</span>
              <span className="font-semibold text-[#003820]">{getBreadcrumb()}</span>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            {/* Streak Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#6ffbbe]/25 text-[#003820] border border-[#6ffbbe]/80">
              <Flame className="w-4 h-4 text-[#006c49]" />
              <span className="text-xs font-semibold tabular-nums">
                Streak: {streakDays} Days
              </span>
            </div>

            {/* Quick Actions */}
            <button
              onClick={() => setIsQuickLogOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#eff4ff] hover:bg-[#e5eeff] text-[#0b1c30] text-xs font-semibold border border-[#c0c9c0]/30 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Quick Log</span>
            </button>

            <button
              onClick={() => setIsStudyModeOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#003820] hover:bg-[#0f5132] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-[#6ffbbe]" />
              <span>Study Mode</span>
            </button>

            {/* Admin Quick Link if admin */}
            {isAdmin && (
              <Link
                to="/admin-dashboard"
                className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold hover:bg-purple-200 transition-colors"
                title="Go to Admin Console"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </Link>
            )}

            {/* Profile Avatar & Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-[#003820]/20 transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-[#003820] text-[#6ffbbe] flex items-center justify-center font-bold text-xs border border-[#c0c9c0]/50 shrink-0 overflow-hidden">
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user?.name?.slice(0, 2).toUpperCase() || 'ST'
                  )}
                </div>
              </button>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <>
                  <div
                    onClick={() => setProfileDropdownOpen(false)}
                    className="fixed inset-0 z-40"
                  />
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white border border-[#c0c9c0]/40 shadow-xl py-2 z-50 animate-in fade-in">
                    <div className="px-4 py-2 border-b border-[#e5eeff]">
                      <div className="font-bold text-xs text-[#0b1c30] truncate">
                        {user?.name || 'Guest User'}
                      </div>
                      <div className="text-[10px] text-[#707971] font-mono truncate">
                        {user?.email || 'No email attached'}
                      </div>
                      <div className="mt-1.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                            isAdmin
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-[#eff4ff] text-[#006c49]'
                          }`}
                        >
                          Role: {user?.role || 'user'}
                        </span>
                      </div>
                    </div>

                    <div className="py-1 text-xs">
                      {isAdmin && (
                        <Link
                          to="/admin-dashboard"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-[#0b1c30] hover:bg-[#eff4ff] transition-colors"
                        >
                          <Shield className="w-4 h-4 text-purple-700" />
                          <span>Admin Console</span>
                        </Link>
                      )}

                      <Link
                        to="/"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-[#0b1c30] hover:bg-[#eff4ff] transition-colors"
                      >
                        <LayoutDashboard className="w-4 h-4 text-[#707971]" />
                        <span>Main Dashboard</span>
                      </Link>

                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-red-600 hover:bg-red-50 transition-colors text-left cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Nested Route Content */}
        <div className="flex-1">
          <Outlet />
        </div>

        <ScrollToTopButton />

        {/* Global Footer */}
        <footer className="w-full bg-white border-t border-[#c0c9c0]/30 py-6 mt-12">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#404942]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#003820] text-sm">StudyTrack</span>
              <span>— HSC Study Tracker</span>
            </div>
            <p className="text-[11px] text-[#707971]">
              © 2026 StudyTrack. Built for HSC Students.
            </p>
          </div>
        </footer>
      </div>

      {/* Global Modals */}
      <QuickLogModal
        isOpen={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
        onLogCompleted={(msg) => alert(msg)}
      />

      <StudyModeModal
        isOpen={isStudyModeOpen}
        onClose={() => setIsStudyModeOpen(false)}
        activeTask={activeTask}
        onToggleTheory={toggleDashboardTheory}
        onTogglePractice={toggleDashboardPractice}
      />
    </div>
  );
};
