import React from 'react';
import { NavLink } from 'react-router-dom';
import { useStudyTrack } from '../../context/StudyTrackContext';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { todayCompletionPercentage, hscSummary, challenge } = useStudyTrack();
  const { user, isAdmin, logout } = useAuth();

  const navItems = [
    {
      to: '/',
      label: 'Main Dashboard',
      icon: 'dashboard',
      badge: `${Math.round(todayCompletionPercentage)}% Goal`,
      badgeColor: 'bg-[#6ffbbe]/25 text-[#003820]',
    },
    {
      to: '/hsc-progress',
      label: 'HSC Grand Progress',
      icon: 'school',
      badge: `${Math.round(hscSummary.grandProgressPercent)}% Macro`,
      badgeColor: 'bg-[#e5eeff] text-[#003820]',
    },
    {
      to: '/strategy-planner',
      label: 'Strategy Planner',
      icon: 'insights',
      badge: 'New',
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      to: '/challenges',
      label: 'Challenge Wizard',
      icon: 'military_tech',
      badge: 'Step 3 DnD',
      badgeColor: 'bg-[#eff4ff] text-[#006c49]',
    },
    {
      to: '/peer-arena',
      label: 'Peer Arena',
      icon: 'sports_esports',
      badge: challenge.code,
      badgeColor: 'bg-amber-100 text-amber-900',
    },
    ...(isAdmin
      ? [
          {
            to: '/admin-dashboard',
            label: 'Admin Console',
            icon: 'admin_panel_settings',
            badge: 'Admin',
            badgeColor: 'bg-purple-100 text-purple-800',
          },
        ]
      : []),
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-[#c0c9c0]/30 shadow-xs flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Brand Section */}
        <div>
          <div className="h-16 px-6 flex items-center justify-between border-b border-[#e5eeff]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#003820] flex items-center justify-center text-[#6ffbbe] shadow-xs">
                <span className="material-symbols-outlined text-xl">school</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base text-[#003820] tracking-tight font-sans">
                  StudyTrack
                </span>
                <span className="text-[10px] text-[#404942] font-mono -mt-1">
                  HSC Study Tracker
                </span>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={onClose}
              className="lg:hidden p-1 rounded-lg text-[#707971] hover:text-[#0b1c30]"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5 text-xs">
            <span className="px-3 text-[10px] uppercase font-bold text-[#707971] tracking-wider font-mono">
              Core Modules
            </span>

            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-xl font-semibold transition-all group ${
                    isActive
                      ? 'bg-[#003820] text-white shadow-xs'
                      : 'text-[#404942] hover:bg-[#eff4ff] hover:text-[#0b1c30]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`material-symbols-outlined text-lg leading-none ${
                          isActive
                            ? 'text-[#6ffbbe]'
                            : item.to === '/admin-dashboard' && isAdmin
                            ? 'text-purple-600'
                            : 'text-[#707971] group-hover:text-[#003820]'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        isActive
                          ? 'bg-[#6ffbbe]/25 text-[#6ffbbe]'
                          : item.badgeColor
                      }`}
                    >
                      {item.badge}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Bottom Section: Global Sync Indicator & Profile */}
        <div className="p-4 space-y-3 border-t border-[#e5eeff]">
          {/* User Profile Pill & Sign Out */}
          {user ? (
            <div className="p-2.5 rounded-2xl bg-white border border-[#c0c9c0]/40 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-full bg-[#003820] text-[#6ffbbe] flex items-center justify-center font-bold text-xs overflow-hidden">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        user.name?.slice(0, 2).toUpperCase() || 'ST'
                      )}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#10b981] border-2 border-white" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-[#0b1c30] truncate">
                      {user.name}
                    </span>
                    <span className="text-[10px] text-[#707971] font-mono truncate" title={user.email}>
                      {user.email}
                    </span>
                  </div>
                </div>

                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase shrink-0 ${
                    isAdmin
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : 'bg-[#6ffbbe]/30 text-[#003820]'
                  }`}
                >
                  {isAdmin ? 'ADMIN' : 'STUDENT'}
                </span>
              </div>

              {/* Sign Out Button */}
              <button
                onClick={() => logout()}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl border border-red-200/80 hover:bg-red-50 text-red-600 text-[11px] font-semibold transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm leading-none">
                  logout
                </span>
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#003820] text-white text-xs font-bold shadow-xs hover:bg-[#004e2d] transition-colors"
            >
              <span className="material-symbols-outlined text-sm">login</span>
              <span>Sign in with Google</span>
            </NavLink>
          )}
        </div>
      </aside>
    </>
  );
};
