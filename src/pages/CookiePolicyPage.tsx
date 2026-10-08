import React from 'react';
import { Link } from 'react-router-dom';
import { Cookie, ArrowLeft, CheckCircle, Info, Settings } from 'lucide-react';

export const CookiePolicyPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 space-y-8 animate-in fade-in duration-200">
      {/* Navigation Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#404942]">
        <Link to="/" className="hover:text-[#003820] font-medium flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#003820]">Cookie Policy</span>
      </div>

      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#c0c9c0]/30 shadow-xs flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#6ffbbe]/25 text-[#003820] flex items-center justify-center">
            <Cookie className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#003820] tracking-tight">
              Cookie Policy
            </h1>
            <p className="text-xs text-[#707971] font-mono mt-0.5">
              Effective Date: January 1, 2026 • Version 1.0
            </p>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-[#404942] leading-relaxed">
          This Cookie Policy explains how StudyTrack utilizes cookies and browser local storage technologies to provide seamless session management and persistent study tracking.
        </p>
      </div>

      {/* Cookie Categories */}
      <div className="space-y-6 text-xs sm:text-sm text-[#0b1c30]">
        {/* Strictly Necessary */}
        <section className="bg-white rounded-2xl p-6 border border-[#c0c9c0]/30 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-base text-[#003820]">
              <CheckCircle className="w-5 h-5 text-[#006c49]" />
              <h2>1. Strictly Necessary Storage</h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#6ffbbe]/30 text-[#003820] text-[11px] font-bold font-mono">
              Always Active
            </span>
          </div>
          <p className="text-[#404942] leading-relaxed">
            These items are essential for authenticating your Google identity and securing database requests with Firebase Firestore:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse mt-2 text-xs">
              <thead>
                <tr className="border-b border-[#e5eeff] text-[#707971] font-mono">
                  <th className="py-2 pr-4 font-semibold">Key / Cookie Name</th>
                  <th className="py-2 pr-4 font-semibold">Type</th>
                  <th className="py-2 font-semibold">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eff4ff] text-[#404942]">
                <tr>
                  <td className="py-2.5 pr-4 font-mono font-bold text-[#003820]">firebase:authUser:*</td>
                  <td className="py-2.5 pr-4">Local Storage</td>
                  <td className="py-2.5">Maintains your authenticated session token across page reloads.</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-mono font-bold text-[#003820]">studytrack_active_challenge_id_*</td>
                  <td className="py-2.5 pr-4">Local Storage</td>
                  <td className="py-2.5">Stores the active user-scoped challenge ID for instantaneous dashboard hydration.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Functional & Preference Cookies */}
        <section className="bg-white rounded-2xl p-6 border border-[#c0c9c0]/30 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-base text-[#003820]">
              <Settings className="w-5 h-5 text-[#006c49]" />
              <h2>2. Functional &amp; Preference Storage</h2>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#eff4ff] text-[#003820] text-[11px] font-bold font-mono">
              Functional
            </span>
          </div>
          <p className="text-[#404942] leading-relaxed">
            These cookies remember your personalized interface state such as sidebar expansion and cookie consent dismissal:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse mt-2 text-xs">
              <thead>
                <tr className="border-b border-[#e5eeff] text-[#707971] font-mono">
                  <th className="py-2 pr-4 font-semibold">Key Name</th>
                  <th className="py-2 pr-4 font-semibold">Type</th>
                  <th className="py-2 font-semibold">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eff4ff] text-[#404942]">
                <tr>
                  <td className="py-2.5 pr-4 font-mono font-bold text-[#003820]">studytrack_cookie_consent</td>
                  <td className="py-2.5 pr-4">Local Storage</td>
                  <td className="py-2.5">Remembers whether you have acknowledged the cookie consent banner.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* How to Manage */}
        <section className="bg-white rounded-2xl p-6 border border-[#c0c9c0]/30 shadow-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-base text-[#003820]">
            <Info className="w-5 h-5 text-[#006c49]" />
            <h2>3. How to Manage Browser Storage</h2>
          </div>
          <p className="text-[#404942] leading-relaxed">
            You can clear or disable cookies via your browser settings at any time. Note that clearing authentication storage will require you to sign in again to access your dashboard.
          </p>
        </section>
      </div>

      {/* Footer link */}
      <div className="p-4 rounded-xl bg-[#eff4ff] border border-[#c0c9c0]/30 text-xs text-[#404942] flex flex-col sm:flex-row items-center justify-between gap-3">
        <span>Review our data handling practices:</span>
        <Link to="/privacy" className="px-4 py-1.5 rounded-lg bg-[#003820] text-white font-semibold hover:bg-[#004e2d] transition-colors">
          View Privacy Policy
        </Link>
      </div>
    </div>
  );
};
