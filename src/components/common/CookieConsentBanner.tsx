import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X, Check, ShieldCheck } from 'lucide-react';

const COOKIE_CONSENT_KEY = 'studytrack_cookie_consent';

export const CookieConsentBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Delay display slightly to avoid interrupting initial render
      const timer = setTimeout(() => setIsVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'all');
    setIsVisible(false);
  };

  const handleAcceptEssential = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'essential');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      role="region"
      aria-label="Cookie consent banner"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-lg z-50 bg-white/95 backdrop-blur-md rounded-2xl p-5 border border-[#c0c9c0]/50 shadow-2xl animate-in slide-in-from-bottom-6 fade-in duration-300 flex flex-col gap-4 text-xs font-sans text-[#0b1c30]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 font-bold text-sm text-[#003820]">
          <div className="w-8 h-8 rounded-xl bg-[#6ffbbe]/30 text-[#003820] flex items-center justify-center shrink-0">
            <Cookie className="w-4 h-4" />
          </div>
          <h3>Cookie &amp; Storage Preferences</h3>
        </div>
        <button
          onClick={handleAcceptEssential}
          className="text-[#707971] hover:text-[#0b1c30] p-1 rounded-lg transition-colors cursor-pointer"
          aria-label="Close cookie consent banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[#404942] text-[11px] leading-relaxed">
        StudyTrack uses essential browser local storage to maintain your authenticated Google session, synchronize study sprint records in real-time, and store dashboard preferences. We do not track you with third-party advertising cookies.
      </p>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-[#e5eeff]">
        <Link
          to="/cookies"
          className="text-[11px] text-[#006c49] hover:underline font-semibold flex items-center gap-1 self-start sm:self-auto"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Cookie Policy</span>
        </Link>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleAcceptEssential}
            className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl bg-[#eff4ff] hover:bg-[#e5eeff] text-[#003820] font-semibold text-[11px] border border-[#c0c9c0]/30 transition-colors cursor-pointer text-center"
          >
            Essential Only
          </button>
          <button
            type="button"
            onClick={handleAcceptAll}
            className="flex-1 sm:flex-none px-4 py-1.5 rounded-xl bg-[#003820] hover:bg-[#004e2d] text-white font-bold text-[11px] shadow-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 text-[#6ffbbe]" />
            <span>Accept All</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
