import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ADMIN_EMAILS } from '../firebase';

export const LoginPage: React.FC = () => {
  const { user, signInWithGoogle, loading, authError, clearAuthError } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Destination after login
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  // If already logged in, offer quick jump
  React.useEffect(() => {
    if (user && !loading) {
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, from]);

  const handleGoogleLogin = async () => {
    try {
      setSubmitting(true);
      clearAuthError();
      await signInWithGoogle();
      navigate(from, { replace: true });
    } catch {
      // Error handled in AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] flex flex-col justify-between selection:bg-[#6ffbbe] selection:text-[#003820]">
      {/* Top minimal bar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-[#e5eeff] bg-white/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#003820] flex items-center justify-center text-[#6ffbbe] shadow-xs">
            <span className="material-symbols-outlined text-2xl">school</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg text-[#003820] tracking-tight">StudyTrack</span>
            <span className="text-[10px] text-[#404942] font-mono -mt-1">Academic Performance & Progress</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#e5eeff] text-[#003820]">
            <span className="w-2 h-2 rounded-full bg-[#006c49] animate-pulse" />
            Firebase Auth Active
          </span>
        </div>
      </header>

      {/* Main card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-white rounded-3xl border border-[#c0c9c0]/30 shadow-xl p-8 sm:p-10 relative overflow-hidden">
          {/* Subtle decorative background gradient */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#6ffbbe]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#003820]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Card Header */}
          <div className="text-center space-y-3 mb-8 relative z-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#003820] text-[#6ffbbe] shadow-md shadow-[#003820]/20 mx-auto">
              <span className="material-symbols-outlined text-3xl">lock_open</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#003820] tracking-tight font-sans">
                Welcome to StudyTrack
              </h1>
              <p className="text-xs text-[#404942] mt-1.5 max-w-xs mx-auto leading-relaxed">
                Sign in to synchronize your HSC syllabus mastery, daily sprint backlog, and real-time cohort ranks.
              </p>
            </div>
          </div>

          {/* Auth Error Notification */}
          {authError && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <span className="material-symbols-outlined text-base mt-0.5 shrink-0 text-red-600">
                error
              </span>
              <div className="flex-1">
                <span className="font-semibold block">Authentication Error</span>
                <span className="text-[11px] leading-tight text-red-600">{authError}</span>
              </div>
              <button
                onClick={clearAuthError}
                className="text-red-400 hover:text-red-700 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}

          {/* Google Sign In Button */}
          <div className="space-y-4 relative z-10">
            <button
              onClick={handleGoogleLogin}
              disabled={submitting || loading}
              className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl bg-white border-2 border-[#c0c9c0]/50 hover:border-[#003820] text-[#0b1c30] hover:bg-[#eff4ff]/50 font-bold text-sm shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group active:scale-[0.99]"
            >
              {submitting || loading ? (
                <div className="w-5 h-5 border-2 border-[#003820] border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
              )}
              <span>{submitting ? 'Signing in...' : 'Sign in with Google'}</span>
            </button>

            {/* Role & Privileges Notice */}
            <div className="p-3.5 rounded-xl bg-[#eff4ff] border border-[#c0c9c0]/30 text-[11px] text-[#404942] space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-[#003820]">
                <span className="material-symbols-outlined text-sm text-[#006c49]">
                  verified_user
                </span>
                <span>Role-Based Access Control (RBAC)</span>
              </div>
              <p className="leading-relaxed">
                Standard Google accounts receive <code className="px-1 py-0.5 rounded bg-white font-mono text-[10px] text-[#003820] font-bold">role: "user"</code> with full access to Dashboards, Challenge Wizards, and Peer Arenas.
              </p>
              <p className="leading-relaxed text-[10px] text-[#707971] pt-0.5 border-t border-[#c0c9c0]/30">
                Primary administrator (<code className="font-mono text-[#003820] font-semibold">{ADMIN_EMAILS[0]}</code>) is automatically detected and provisioned with <code className="px-1 py-0.5 rounded bg-white font-mono text-[10px] text-purple-700 font-bold">role: "admin"</code>.
              </p>
            </div>
          </div>

          {/* Academic Features List */}
          <div className="mt-8 pt-6 border-t border-[#e5eeff] grid grid-cols-2 gap-3 text-left">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-base text-[#006c49] mt-0.5">
                check_circle
              </span>
              <div>
                <span className="font-bold text-[11px] block text-[#0b1c30]">2-Point Topics</span>
                <span className="text-[10px] text-[#707971]">Theory (1) + Practice (1)</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-base text-[#006c49] mt-0.5">
                check_circle
              </span>
              <div>
                <span className="font-bold text-[11px] block text-[#0b1c30]">Anti-Time Travel</span>
                <span className="text-[10px] text-[#707971]">Draggable Day Validation</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-base text-[#006c49] mt-0.5">
                check_circle
              </span>
              <div>
                <span className="font-bold text-[11px] block text-[#0b1c30]">Cohort Rankings</span>
                <span className="text-[10px] text-[#707971]">Mathematical Tie-Breaker</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-base text-[#006c49] mt-0.5">
                check_circle
              </span>
              <div>
                <span className="font-bold text-[11px] block text-[#0b1c30]">Cloud Persistence</span>
                <span className="text-[10px] text-[#707971]">Secure Firestore Store</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-[#707971] border-t border-[#e5eeff] bg-white/60">
        StudyTrack • Firebase Modular SDK v9+ with Role-Based Access Control
      </footer>
    </div>
  );
};
