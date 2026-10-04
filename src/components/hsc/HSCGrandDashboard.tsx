import React from 'react';
import { useStudyTrack } from '../../context/StudyTrackContext';
import { HSCHeroDonuts } from './HSCHeroDonuts';
import { HSCSubjectAccordion } from './HSCSubjectAccordion';
import { Link } from 'react-router-dom';

export const HSCGrandDashboard: React.FC = () => {
  // REQUIREMENT: Global State Simulation through Context API
  // Changes made in Main Dashboard instantly reflect here, and vice versa!
  const {
    hscMasterSyllabus,
    hscSummary,
    toggleHSCTheory,
    toggleHSCPractice,
    triggerToast,
  } = useStudyTrack();

  // Export Matrix Action
  const handleExportMatrix = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(hscMasterSyllabus, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `hsc_master_syllabus_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerToast('Exported HSC Master Syllabus Matrix JSON!');
  };

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
                  Session 2024-25 • Science Division
                </span>
              </div>
              <button
                type="button"
                onClick={handleExportMatrix}
                className="bg-[#003820] text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 hover:bg-[#0f5132] transition-colors shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">download</span>
                <span>Export Syllabus</span>
              </button>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="bg-white rounded-2xl p-5 shadow-xs border border-[#c0c9c0]/30 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#eff4ff] flex items-center justify-center text-[#003820] shrink-0 border border-[#c0c9c0]/30">
                <span className="material-symbols-outlined text-2xl">event_available</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-[#404942]">HSC Final Exam Countdown</span>
                <span className="text-base text-[#0b1c30] font-bold font-mono">
                  78 Days Remaining
                </span>
                <span className="text-[11px] text-[#006c49] font-medium">
                  Estimated 218 study hours needed
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
                  4.2 / 5.0 Chapters
                </span>
                <span className="text-[11px] text-[#003820] font-medium">
                  84% of weekly syllabus on track
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-xs border border-[#c0c9c0]/30 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#eff4ff] flex items-center justify-center text-[#003820] shrink-0 border border-[#c0c9c0]/30">
                <span className="material-symbols-outlined text-2xl">verified</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-[#404942]">Test Paper Verification</span>
                <span className="text-base text-[#0b1c30] font-bold">
                  Notre Dame & RAJUK
                </span>
                <span className="text-[11px] text-[#006c49] font-medium">
                  Next Test Paper: Cadet Colleges Set
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
