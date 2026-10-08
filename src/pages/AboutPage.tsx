import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft, Target, Award, Users, BookOpen } from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 space-y-8 animate-in fade-in duration-200">
      {/* Navigation Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#404942]">
        <Link to="/" className="hover:text-[#003820] font-medium flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#003820]">About StudyTrack</span>
      </div>

      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#c0c9c0]/30 shadow-xs flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#6ffbbe]/25 text-[#003820] flex items-center justify-center">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#003820] tracking-tight">
              About StudyTrack
            </h1>
            <p className="text-xs text-[#707971] font-mono mt-0.5">
              Precision Academic Analytics &amp; Sprint Planning
            </p>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-[#404942] leading-relaxed">
          StudyTrack was engineered specifically to solve the pacing, backlog, and accountability hurdles faced by Higher Secondary Certificate (HSC) students preparing for board and admission examinations.
        </p>
      </div>

      {/* Pillars Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
        <div className="bg-white rounded-2xl p-5 border border-[#c0c9c0]/30 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center mb-1">
            <Target className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-[#003820]">Capacity-Aware Sprints</h3>
          <p className="text-[#404942] text-xs leading-relaxed">
            Our scheduling algorithm uses Longest Processing Time (LPT) bin-packing to distribute syllabus topics evenly across sprint days respecting daily stamina limits.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#c0c9c0]/30 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center mb-1">
            <BookOpen className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-[#003820]">Complete HSC Syllabus</h3>
          <p className="text-[#404942] text-xs leading-relaxed">
            Complete syllabus coverage across Physics, Chemistry, Higher Math, Biology, and ICT.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#c0c9c0]/30 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center mb-1">
            <Users className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-[#003820]">Peer Arena &amp; Rooms</h3>
          <p className="text-[#404942] text-xs leading-relaxed">
            Study with classmates, share sprint room codes, and stay motivated through live study streaks and leaderboards.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#c0c9c0]/30 shadow-xs space-y-2">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center mb-1">
            <Award className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-[#003820]">Dual-Flag Mastery</h3>
          <p className="text-[#404942] text-xs leading-relaxed">
            Separately track theoretical conceptual grasp and problem-solving practice for every chapter topic.
          </p>
        </div>
      </div>
    </div>
  );
};
