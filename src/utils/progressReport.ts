import { HSCProgressSummary, HSCSubject } from '../types/hsc';

export interface SubjectRow {
  subject: string;
  done: number; // topics with both theory and practice done
  total: number; // total topics in the subject
  percent: number; // ((completedTheory + completedPractice) / (total * 2)) * 100
  completedTheory: number;
  completedPractice: number;
}

export interface ReportData {
  grandProgressPercent: number;
  overallTheoryPercent: number;
  overallPracticePercent: number;
  topicsCompleted: number;
  totalTopics: number;
  chaptersCompleted: number;
  totalChapters: number;
  subjectRows: SubjectRow[];
}

/**
 * Builds standard report data matching dashboard computations.
 */
export function buildProgressReportData(
  summary: HSCProgressSummary,
  subjects: HSCSubject[]
): ReportData {
  const subjectRows = subjects.map((subject) => {
    const allTopics = subject.chapters.flatMap((c) => c.topics);
    const total = allTopics.length;
    const completedTheory = allTopics.filter((t) => t.is_theory_done).length;
    const completedPractice = allTopics.filter((t) => t.is_practice_done).length;
    const done = allTopics.filter((t) => t.is_theory_done && t.is_practice_done).length;
    
    // Progress percent matched with dashboard formulas
    const percent = total > 0 ? ((completedTheory + completedPractice) / (total * 2)) * 100 : 0;

    return {
      subject: subject.name,
      done,
      total,
      percent,
      completedTheory,
      completedPractice,
    };
  });

  return {
    grandProgressPercent: summary.grandProgressPercent,
    overallTheoryPercent: summary.overallTheoryPercent,
    overallPracticePercent: summary.overallPracticePercent,
    topicsCompleted: summary.completedTopicsCount,
    totalTopics: summary.totalTopics,
    chaptersCompleted: summary.completedChaptersCount,
    totalChapters: summary.totalChapters,
    subjectRows,
  };
}

/**
 * Renders a pixel-perfect, high-fidelity 1080x1350 canvas image.
 * Uses native Canvas 2D API for 100% self-contained offline capabilities.
 */
export function renderProgressReportImage(data: ReportData): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1350;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas 2D context not supported');
      }

      // Smooth font rendering setup
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 1. Off-white Elegant Background
      ctx.fillStyle = '#fafbfb';
      ctx.fillRect(0, 0, 1080, 1350);

      // 2. Header Band (App primary dark green #003820)
      ctx.fillStyle = '#003820';
      ctx.fillRect(0, 0, 1080, 210);

      // Header Brand Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('StudyTrack Academic', 60, 95);

      ctx.fillStyle = '#6ffbbe';
      ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('HSC SYLLABUS PERFORMANCE PORTAL', 60, 145);

      // Right-side Date Label
      const formattedDate = new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      ctx.fillStyle = '#a3b899';
      ctx.font = '500 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formattedDate, 1020, 125);
      ctx.textAlign = 'left'; // Reset alignment

      // 3. Central Grand Progress Ring (x: 540, y: 440, r: 105)
      const centerX = 540;
      const centerY = 440;
      const mainRadius = 105;
      const ringWidth = 22;

      // Background Track
      ctx.beginPath();
      ctx.arc(centerX, centerY, mainRadius, 0, 2 * Math.PI);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = ringWidth;
      ctx.stroke();

      // Active Track
      const grandAngle = (data.grandProgressPercent / 100) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(centerX, centerY, mainRadius, -Math.PI / 2, -Math.PI / 2 + grandAngle);
      ctx.strokeStyle = '#003820';
      ctx.lineWidth = ringWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Center Percentage Text
      ctx.fillStyle = '#0b1c30';
      ctx.font = 'bold 62px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(data.grandProgressPercent)}%`, centerX, centerY + 10);

      ctx.fillStyle = '#475569';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('GRAND PROGRESS', centerX, centerY + 50);

      // 4. Left Secondary Ring (Theory Reading Progress)
      const leftX = 240;
      const leftY = 440;
      const subRadius = 72;
      const subRingWidth = 14;

      // Theory Track Background
      ctx.beginPath();
      ctx.arc(leftX, leftY, subRadius, 0, 2 * Math.PI);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = subRingWidth;
      ctx.stroke();

      // Theory Active Track
      const theoryAngle = (data.overallTheoryPercent / 100) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(leftX, leftY, subRadius, -Math.PI / 2, -Math.PI / 2 + theoryAngle);
      ctx.strokeStyle = '#006c49';
      ctx.lineWidth = subRingWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Theory Percentage Text
      ctx.fillStyle = '#0b1c30';
      ctx.font = 'bold 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${Math.round(data.overallTheoryPercent)}%`, leftX, leftY + 8);

      ctx.fillStyle = '#475569';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('THEORY READ', leftX, leftY + 42);

      // 5. Right Secondary Ring (Practice & CQ Progress)
      const rightX = 840;
      const rightY = 440;

      // Practice Track Background
      ctx.beginPath();
      ctx.arc(rightX, rightY, subRadius, 0, 2 * Math.PI);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = subRingWidth;
      ctx.stroke();

      // Practice Active Track
      const practiceAngle = (data.overallPracticePercent / 100) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(rightX, rightY, subRadius, -Math.PI / 2, -Math.PI / 2 + practiceAngle);
      ctx.strokeStyle = '#10b981'; // High-contrast emerald
      ctx.lineWidth = subRingWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Practice Percentage Text
      ctx.fillStyle = '#0b1c30';
      ctx.font = 'bold 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${Math.round(data.overallPracticePercent)}%`, rightX, rightY + 8);

      ctx.fillStyle = '#475569';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('PRACTICE DONE', rightX, rightY + 42);

      ctx.textAlign = 'left'; // Reset

      // 6. Metrics Summary Panel Card
      const cardX = 60;
      const cardY = 590;
      const cardW = 960;
      const cardH = 110;
      const cardRadius = 16;

      ctx.fillStyle = '#eff4ff';
      ctx.strokeStyle = 'rgba(192, 201, 192, 0.3)';
      ctx.lineWidth = 1.5;

      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, cardRadius);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(cardX, cardY, cardW, cardH);
      }

      // Write Summary Columns
      ctx.fillStyle = '#0b1c30';
      ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Topics Completed', 100, 632);
      ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${data.topicsCompleted} / ${data.totalTopics}`, 100, 672);

      ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Chapters Mastered', 580, 632);
      ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${data.chaptersCompleted} / ${data.totalChapters}`, 580, 672);

      // 7. Subject Breakdown Header Section
      ctx.fillStyle = '#003820';
      ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('SUBJECT-WISE ACADEMIC BREAKDOWN', 60, 755);

      // Hairline Accent Divider
      ctx.beginPath();
      ctx.moveTo(60, 770);
      ctx.lineTo(1020, 770);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 8. Render Subject List (max 8 rows)
      let startY = 805;
      data.subjectRows.slice(0, 8).forEach((row, index) => {
        const rowY = startY + index * 58;

        // Subject Title
        ctx.fillStyle = '#0b1c30';
        ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(row.subject, 60, rowY + 20);

        // Topic Counts
        ctx.fillStyle = '#475569';
        ctx.font = '500 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`${row.done} / ${row.total} topics fully completed`, 500, rowY + 20);

        // Percentage Text (right-aligned)
        ctx.fillStyle = '#003820';
        ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.round(row.percent)}%`, 1020, rowY + 20);
        ctx.textAlign = 'left'; // Reset

        // Dual-tone Progress Bar
        const barX = 60;
        const barY = rowY + 30;
        const barW = 960;
        const barH = 10;
        const barRadius = 5;

        // Progress Track Background
        ctx.fillStyle = '#e2e8f0';
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(barX, barY, barW, barH, barRadius);
          ctx.fill();
        } else {
          ctx.fillRect(barX, barY, barW, barH);
        }

        // Mathematical Width calculations
        const totalPoints = row.total * 2;
        const theoryW = totalPoints > 0 ? (row.completedTheory / totalPoints) * barW : 0;
        const practiceW = totalPoints > 0 ? (row.completedPractice / totalPoints) * barW : 0;

        // Render Theory Segment (Deep Green #003820)
        if (theoryW > 0) {
          ctx.fillStyle = '#003820';
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(barX, barY, theoryW, barH, barRadius);
            ctx.fill();
          } else {
            ctx.fillRect(barX, barY, theoryW, barH);
          }
        }

        // Render Practice Segment (Emerald Green #10b981)
        if (practiceW > 0) {
          ctx.fillStyle = '#10b981';
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(barX + theoryW, barY, practiceW, barH, barRadius);
            ctx.fill();
          } else {
            ctx.fillRect(barX + theoryW, barY, practiceW, barH);
          }
        }
      });

      // 9. Standardized Footer branding
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Generated natively via StudyTrack Board Prep Portal. No student left behind.', 540, 1315);

      // Return Blob
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create canvas Blob'));
        }
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}
