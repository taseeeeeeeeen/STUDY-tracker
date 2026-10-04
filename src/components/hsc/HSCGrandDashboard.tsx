import React from 'react';
import { useStudyTrack } from '../../context/StudyTrackContext';
import { HSCHeroDonuts } from './HSCHeroDonuts';
import { HSCSubjectAccordion } from './HSCSubjectAccordion';
import { Link } from 'react-router-dom';

export const HSCGrandDashboard: React.FC = () => {
  // Global State Synchronization through Context API
  const {
    hscMasterSyllabus,
    hscSummary,
    toggleHSCTheory,
    toggleHSCPractice,
  } = useStudyTrack();

  // Milestone 1: Live countdown to HSC 2027 Final Exam (June 6, 2027, Bangladesh Time)
  const hscTargetTime = new Date('2027-06-06T00:00:00+06:00').getTime();
  const daysRemaining = Math.max(0, Math.ceil((hscTargetTime - Date.now()) / 86400000));
  const remainingTopics = Math.max(0, hscSummary.totalTopics - hscSummary.completedTopicsCount);
  const estimatedHours = Math.round((remainingTopics * 45) / 60);

  // Milestone 2: Dynamic Pace to Finish calculation (May 1, 2027 target)
  const daysUntilPace = Math.max(
    1,
    Math.ceil((new Date('2027-05-01T00:00:00+06:00').getTime() - Date.now()) / 86400000)
  );
  const remainingChapters = Math.max(
    0,
    hscSummary.totalChapters - hscSummary.completedChaptersCount
  );
  const chaptersPerDay = remainingChapters / daysUntilPace;
  const chaptersPerWeek = chaptersPerDay * 7;

  return (
    <div className="w-full flex flex-col font-sans">
      {/* Main Viewport Container */}
      <main className="w-full flex-1">
        <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-8 flex flex-col gap-8">
          {/* Synchronized State Banner */}
          <div className="p-3 bg-[#eff4ff] text-[#0b1c30] rounded-xl shadow-xs text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-[#c0c9c0]/40">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-[#006c49]">
                cloud_sync
              </span>
              <span>
                <strong>Syllabus Sync:</strong> Progress updated in the dashboard or in the syllabus list below updates your overall progress automatically.
              </span>
            </div>

            <Link
              to="/"
              className="text-[#003820] hover:underline font-semibold flex items-center gap-1 shrink-0"
            >
              <span>Back to Dashboard</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </Link>
          </div>

          {/* Breadcrumb & Top Bar Metadata */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs text-[#404942]">
                <Link to="/" className="hover:text-[#003820] transition-colors">
                  StudyTrack
                </Link>
                <span className="material-symbols-outlined text-xs text-[#c0c9c0]">
                  chevron_right
                </span>
                <span className="text-[#0b1c30] font-semibold">HSC Syllabus</span>
                <span className="material-symbols-outlined text-xs text-[#c0c9c0]">
                  chevron_right
                </span>
                <span className="text-[#003820] font-semibold">
                  Full Curriculum
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl text-[#0b1c30] font-bold tracking-tight">
                HSC Syllabus Progress
              </h1>
              <p className="text-xs text-[#404942]">
                Track your complete HSC syllabus across all subjects, chapters, and topics.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <div className="bg-[#eff4ff] px-3.5 py-1.5 rounded-xl flex items-center gap-2 border border-[#c0c9c0]/30 text-xs">
                <span className="w-2 h-2 rounded-full bg-[#006c49]" />
                <span className="text-[#0b1c30] font-medium font-mono">
                  Session 2025-2026 • Science Division
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: Hero Donut & Metric Deck (Grand Total Math dynamically bound) */}
          <HSCHeroDonuts summary={hscSummary} />

          {/* Section 2: Subject-wise Breakdown & Interactive Accordion */}
          <HSCSubjectAccordion
            syllabus={hscMasterSyllabus}
            onToggleTheory={toggleHSCTheory}
            onTogglePractice={toggleHSCPractice}
          />

          {/* Section 3: Study Rhythm & Board Exam Milestones Quick View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="bg-white rounded-2xl p-5 shadow-xs border border-[#c0c9c0]/30 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#eff4ff] flex items-center justify-center text-[#003820] shrink-0 border border-[#c0c9c0]/30">
                <span className="material-symbols-outlined text-2xl">event_available</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-[#404942]">HSC Final Exam Countdown</span>
                <span className="text-base text-[#0b1c30] font-bold font-mono">
                  {daysRemaining} Days Remaining
                </span>
                <span className="text-[11px] text-[#006c49] font-medium">
                  Estimated {estimatedHours} study hours needed
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-xs border border-[#c0c9c0]/30 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#eff4ff] flex items-center justify-center text-[#003820] shrink-0 border border-[#c0c9c0]/30">
                <span className="material-symbols-outlined text-2xl">trending_up</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-[#404942]">Weekly Target Completion</span>
                <span className="text-base text-[#0b1c30] font-bold font-mono">
                  {chaptersPerWeek.toFixed(1)} Chapters / Week
                </span>
                <span className="text-[11px] text-[#003820] font-medium">
                  Based on remaining {remainingChapters} chapters
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
