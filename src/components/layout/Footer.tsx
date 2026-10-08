import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ShieldCheck, FileText, Cookie, Mail, Info, Heart, ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer role="contentinfo" className="w-full bg-white border-t border-[#c0c9c0]/30 py-10 mt-16 text-xs text-[#404942]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 space-y-8">
        {/* Main 4-Column Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Column 1: Brand & Overview */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#003820] flex items-center justify-center text-[#6ffbbe] shadow-xs">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base text-[#003820] tracking-tight font-sans">
                  StudyTrack
                </span>
                <span className="text-[10px] text-[#707971] font-mono -mt-1">
                  Academic Performance Engine
                </span>
              </div>
            </div>
            <p className="text-[11px] text-[#707971] leading-relaxed">
              Designed specifically for Higher Secondary Certificate (HSC) students to master complex syllabi, pace custom study sprints, and collaborate with peer study groups.
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-[#006c49] font-mono font-semibold pt-1">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
              <span>All Systems Operational • Real-time Cloud Sync</span>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#0b1c30] font-mono">
              Core Modules
            </h4>
            <ul className="space-y-2 text-[11px]">
              <li>
                <Link to="/" className="hover:text-[#003820] transition-colors flex items-center gap-1.5">
                  <span>Main Dashboard</span>
                </Link>
              </li>
              <li>
                <Link to="/hsc-progress" className="hover:text-[#003820] transition-colors flex items-center gap-1.5">
                  <span>HSC Grand Progress Matrix</span>
                </Link>
              </li>
              <li>
                <Link to="/challenges" className="hover:text-[#003820] transition-colors flex items-center gap-1.5">
                  <span>Sprint Setup &amp; Kanban</span>
                </Link>
              </li>
              <li>
                <Link to="/peer-arena" className="hover:text-[#003820] transition-colors flex items-center gap-1.5">
                  <span>Peer Arena &amp; Leaderboards</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Legal & Compliance */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#0b1c30] font-mono">
              Legal &amp; Policies
            </h4>
            <ul className="space-y-2 text-[11px]">
              <li>
                <Link to="/privacy" className="hover:text-[#003820] transition-colors flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#006c49]" />
                  <span>Privacy Policy</span>
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-[#003820] transition-colors flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#006c49]" />
                  <span>Terms and Conditions</span>
                </Link>
              </li>
              <li>
                <Link to="/cookies" className="hover:text-[#003820] transition-colors flex items-center gap-1.5">
                  <Cookie className="w-3.5 h-3.5 text-[#006c49]" />
                  <span>Cookie Policy</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Resources & Support */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#0b1c30] font-mono">
              Resources &amp; Support
            </h4>
            <ul className="space-y-2 text-[11px]">
              <li>
                <Link to="/about" className="hover:text-[#003820] transition-colors flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[#006c49]" />
                  <span>About StudyTrack</span>
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-[#003820] transition-colors flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#006c49]" />
                  <span>Contact Support</span>
                </Link>
              </li>
              <li>
                <a
                  href="https://studytrack.academy/sitemap.xml"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#003820] transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#707971]" />
                  <span>Sitemap XML</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright Strip */}
        <div className="pt-6 border-t border-[#e5eeff] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#707971]">
          <p>© {new Date().getFullYear()} StudyTrack Academy. All rights reserved.</p>
          <div className="flex items-center gap-1">
            <span>Built with precision for HSC &amp; University Admission Candidates</span>
            <Heart className="w-3 h-3 text-red-500 fill-red-500 inline ml-0.5" />
          </div>
        </div>
      </div>
    </footer>
  );
};
