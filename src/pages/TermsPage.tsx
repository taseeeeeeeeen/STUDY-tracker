import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft, CheckCircle2, AlertCircle, Scale, ShieldAlert } from 'lucide-react';

export const TermsPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 space-y-8 animate-in fade-in duration-200">
      {/* Navigation Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#404942]">
        <Link to="/" className="hover:text-[#003820] font-medium flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#003820]">Terms and Conditions</span>
      </div>

      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#c0c9c0]/30 shadow-xs flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#6ffbbe]/25 text-[#003820] flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#003820] tracking-tight">
              Terms &amp; Conditions
            </h1>
            <p className="text-xs text-[#707971] font-mono mt-0.5">
              Last Updated: January 1, 2026 • Version 1.1
            </p>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-[#404942] leading-relaxed">
          Please review these Terms and Conditions carefully before using StudyTrack. By accessing our platform, you agree to comply with and be bound by the following terms.
        </p>
      </div>

      {/* Policy Content Sections */}
      <div className="space-y-6 text-xs sm:text-sm text-[#0b1c30]">
        {/* Section 1 */}
        <section className="bg-white rounded-2xl p-6 border border-[#c0c9c0]/30 shadow-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-base text-[#003820]">
            <CheckCircle2 className="w-5 h-5 text-[#006c49]" />
            <h2>1. Acceptance of Terms</h2>
          </div>
          <p className="text-[#404942] leading-relaxed">
            By creating an account, connecting via Google Authentication, or joining study challenge rooms, you acknowledge that you have read, understood, and agreed to these Terms and our Privacy Policy.
          </p>
        </section>

        {/* Section 2 */}
        <section className="bg-white rounded-2xl p-6 border border-[#c0c9c0]/30 shadow-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-base text-[#003820]">
            <Scale className="w-5 h-5 text-[#006c49]" />
            <h2>2. User Accounts &amp; Academic Integrity</h2>
          </div>
          <p className="text-[#404942] leading-relaxed">
            Users are responsible for maintaining the confidentiality of their credentials and all activities occurring under their accounts. Users agree to:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#404942]">
            <li>Log study progress honestly to preserve peer accountability standards.</li>
            <li>Respect fellow students in shared challenge sprint rooms and peer arena channels.</li>
            <li>Refrain from attempting to forge progress timestamps or manipulate leaderboard rankings through automated scripts.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="bg-white rounded-2xl p-6 border border-[#c0c9c0]/30 shadow-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-base text-[#003820]">
            <ShieldAlert className="w-5 h-5 text-[#006c49]" />
            <h2>3. Intellectual Property &amp; Curriculum Rights</h2>
          </div>
          <p className="text-[#404942] leading-relaxed">
            The StudyTrack platform, interface designs, mathematical tracking algorithms, and master syllabus structures are protected by copyright and intellectual property laws. Official HSC curriculum structures are referenced solely for academic guidance.
          </p>
        </section>

        {/* Section 4 */}
        <section className="bg-white rounded-2xl p-6 border border-[#c0c9c0]/30 shadow-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-base text-[#003820]">
            <AlertCircle className="w-5 h-5 text-[#006c49]" />
            <h2>4. Service Availability &amp; Disclaimer</h2>
          </div>
          <p className="text-[#404942] leading-relaxed">
            StudyTrack is provided on an "as-is" and "as-available" basis for educational productivity. While we strive for continuous uptime and real-time cloud data synchronization, we cannot guarantee uninterrupted service during maintenance periods.
          </p>
        </section>
      </div>

      {/* Action Footer */}
      <div className="p-4 rounded-xl bg-[#eff4ff] border border-[#c0c9c0]/30 text-xs text-[#404942] flex flex-col sm:flex-row items-center justify-between gap-3">
        <span>Need clarification on our terms of service?</span>
        <Link to="/contact" className="px-4 py-1.5 rounded-lg bg-[#003820] text-white font-semibold hover:bg-[#004e2d] transition-colors">
          Contact Legal Team
        </Link>
      </div>
    </div>
  );
};
