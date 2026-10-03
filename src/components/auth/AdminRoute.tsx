import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_EMAILS } from '../../firebase';

interface AdminRouteProps {
  children?: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, loading, isAdmin, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex flex-col items-center justify-center gap-4 text-[#003820]">
        <div className="w-12 h-12 rounded-2xl bg-[#003820] flex items-center justify-center text-[#6ffbbe] shadow-lg animate-bounce">
          <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs font-semibold text-[#404942]">
          <div className="w-4 h-4 border-2 border-[#003820] border-t-transparent rounded-full animate-spin" />
          <span>Verifying Admin Authorization...</span>
        </div>
      </div>
    );
  }

  // Not signed in -> send to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Signed in but not admin -> 403 Forbidden screen
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white rounded-3xl border border-red-200 shadow-xl p-8 sm:p-10 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto shadow-sm">
            <span className="material-symbols-outlined text-3xl">gpp_bad</span>
          </div>

          <div>
            <div className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-800 text-[11px] font-mono font-bold uppercase tracking-wider mb-2">
              403 • Access Denied
            </div>
            <h1 className="text-2xl font-black text-[#0b1c30] tracking-tight">
              Admin Privileges Required
            </h1>
            <p className="text-xs text-[#404942] mt-2 leading-relaxed">
              The route <code className="px-1.5 py-0.5 rounded bg-gray-100 font-mono text-[11px] font-bold text-red-600">/admin-dashboard</code> is strictly restricted to accounts with the <code className="font-mono font-bold text-purple-700">admin</code> role.
            </p>
          </div>

          {/* User profile card */}
          <div className="p-4 rounded-2xl bg-[#f8f9ff] border border-[#c0c9c0]/40 text-left space-y-2 text-xs">
            <div className="flex items-center justify-between border-b border-[#c0c9c0]/30 pb-2">
              <span className="text-[#707971] text-[11px]">Logged in as:</span>
              <span className="font-bold text-[#0b1c30]">{user.name}</span>
            </div>
            <div className="flex items-center justify-between border-b border-[#c0c9c0]/30 pb-2">
              <span className="text-[#707971] text-[11px]">Email address:</span>
              <span className="font-mono text-[#404942]">{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#707971] text-[11px]">Assigned Role:</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#eff4ff] text-[#006c49] border border-[#c0c9c0]/40 uppercase">
                {user.role}
              </span>
            </div>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 text-left leading-relaxed">
            <span className="font-bold block mb-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">info</span>
              Admin Account Requirement
            </span>
            Only designated administrator emails (such as <code className="font-mono font-semibold">{ADMIN_EMAILS[0]}</code>) or accounts elevated in Firestore can access this panel.
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Link
              to="/"
              className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[#003820] text-white font-bold text-xs hover:bg-[#004e2d] transition-colors shadow-xs text-center cursor-pointer"
            >
              Return to Main Dashboard
            </Link>
            <button
              onClick={() => logout()}
              className="w-full sm:flex-1 py-3 px-4 rounded-xl border border-[#c0c9c0]/60 text-[#404942] font-semibold text-xs hover:bg-[#eff4ff] transition-colors cursor-pointer"
            >
              Sign Out & Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children ? <>{children}</> : null;
};
