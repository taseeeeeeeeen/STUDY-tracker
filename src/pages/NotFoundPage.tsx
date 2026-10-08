import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home, BookOpen } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 animate-in fade-in duration-200">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#c0c9c0]/40 shadow-xl text-center space-y-6">
        {/* Icon Emblem */}
        <div className="w-20 h-20 rounded-2xl bg-[#eff4ff] text-[#003820] flex items-center justify-center mx-auto border border-[#c0c9c0]/30 shadow-xs">
          <Compass className="w-10 h-10 text-[#006c49] animate-spin" style={{ animationDuration: '12s' }} />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 text-[11px] font-mono font-bold tracking-wider uppercase">
            Error 404 • Page Not Found
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#003820] tracking-tight">
            Lost in the Syllabus?
          </h1>
          <p className="text-xs sm:text-sm text-[#404942] leading-relaxed">
            The study page, challenge room, or module you are looking for does not exist or has been moved.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            to="/"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#003820] hover:bg-[#004e2d] text-white text-xs font-bold shadow-md shadow-[#003820]/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Home className="w-4 h-4 text-[#6ffbbe]" />
            <span>Go to Dashboard</span>
          </Link>

          <Link
            to="/hsc-progress"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#eff4ff] hover:bg-[#e5eeff] text-[#003820] text-xs font-bold border border-[#c0c9c0]/30 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span>View Syllabus</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
