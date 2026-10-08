import React, { useState } from 'react';
import { useStudyTrack } from '../../context/StudyTrackContext';
import { useAuth } from '../../context/AuthContext';
import { HSCHeroDonuts } from './HSCHeroDonuts';
import { HSCSubjectAccordion } from './HSCSubjectAccordion';
import { Link } from 'react-router-dom';
import { buildProgressReportData, renderProgressReportImage } from '../../utils/progressReport';
import { resetAllHscProgress } from '../../services/userProgressService';

export const HSCGrandDashboard: React.FC = () => {
  // Global State Synchronization through Context API
  const {
    hscMasterSyllabus,
    hscSummary,
    toggleHSCTheory,
    toggleHSCPractice,
    triggerToast,
  } = useStudyTrack();
  const { user } = useAuth();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleConfirmReset = async () => {
    if (!user || !user.uid) {
      triggerToast('You must be signed in to reset progress.');
      setIsResetModalOpen(false);
      return;
    }

    if (isResetting) return;
    setIsResetting(true);

    try {
      // Per-user isolation guarantee: writes strictly to user_progress/{user.uid}
      await resetAllHscProgress(user.uid);
      setIsResetModalOpen(false);
      triggerToast('All progress has been reset. Starting fresh at 0%.');
    } catch (err) {
      console.error('Failed to reset HSC progress in database:', err);
      triggerToast('Failed to reset progress. Please try again.');
      // Do NOT clear local state if the write failed (the database is the source of truth)
    } finally {
      setIsResetting(false);
    }
  };

  const handleShareProgress = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const data = buildProgressReportData(hscSummary, hscMasterSyllabus);
      const blob = await renderProgressReportImage(data);
      const file = new File([blob], 'hsc-study-progress.png', { type: 'image/png' });

      // Check if browser has native social file sharing API capabilities
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'HSC Study Progress Report',
          text: `My overall HSC syllabus completion is at ${Math.round(data.grandProgressPercent)}%! I've completed ${data.topicsCompleted} of ${data.totalTopics} topics. Keep tracking with StudyTrack Academic!`,
        });
        triggerToast('Progress report shared successfully!');
      } else {
        // Desktop / unsupportive fallback: Direct download + text summary copy
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'hsc-study-progress.png';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);

        // Generate matching formatted text summary
        let txt = `📚 *HSC BOARD PREP REPORT* 📚\n`;
        txt += `==============================\n`;
        txt += `Overall Completion: ${Math.round(data.grandProgressPercent)}%\n`;
        txt += `Theory Read: ${Math.round(data.overallTheoryPercent)}%\n`;
        txt += `Practice Done: ${Math.round(data.overallPracticePercent)}%\n`;
        txt += `Topics Mastered: ${data.topicsCompleted} / ${data.totalTopics}\n`;
        txt += `Chapters Mastered: ${data.chaptersCompleted} / ${data.totalChapters}\n\n`;
        txt += `*Subject Breakdown:*\n`;
        data.subjectRows.forEach((row) => {
          txt += `• ${row.subject}: ${Math.round(row.percent)}% (${row.done}/${row.total} topics fully done)\n`;
        });
        txt += `\nGenerated via StudyTrack Academic.`;

        await navigator.clipboard.writeText(txt);
        triggerToast('Progress report downloaded & text summary copied to clipboard!');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Failed to generate/share progress report:', err);
        triggerToast('Failed to share progress report. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

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

            <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                disabled={isResetting || isGenerating}
                className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 active:scale-95 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Reset all HSC syllabus progress to 0%"
              >
                <span className="material-symbols-outlined text-[15px] leading-none text-red-600">
                  restart_alt
                </span>
                <span>{isResetting ? 'Resetting...' : 'Reset All Progress'}</span>
              </button>

              <button
                type="button"
                onClick={handleShareProgress}
                disabled={isGenerating || isResetting}
                className="bg-[#003820] hover:bg-[#002111] active:scale-95 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[15px] leading-none">
                  {isGenerating ? 'sync' : 'share'}
                </span>
                <span>{isGenerating ? 'Generating...' : 'Share Progress'}</span>
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

      {/* Confirmation Modal for Resetting All HSC Progress */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-red-300 flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">restart_alt</span>
              </div>
              <div>
                <h3 className="text-base text-[#0b1c30] font-bold">
                  Reset All HSC Progress?
                </h3>
                <p className="text-xs text-[#404942]">
                  Start fresh from 0% curriculum completion
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-[#0b1c30] space-y-2">
              <p className="leading-relaxed">
                All theory/practice marks, MCQ/CQ progress, and completion dates will be{' '}
                <strong>PERMANENTLY deleted</strong> from <strong>YOUR account only</strong>.
              </p>
              <p className="leading-relaxed text-[#404942]">
                Other users are not affected, and the syllabus will be fully unselected to re-select from 0%.
              </p>
              <p className="text-[11px] font-semibold text-red-700">
                ⚠️ This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e5eeff]">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 rounded-xl text-[#404942] hover:bg-[#eff4ff] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleConfirmReset}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isResetting ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">
                      progress_activity
                    </span>
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">restart_alt</span>
                    <span>Yes, Reset Everything</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
