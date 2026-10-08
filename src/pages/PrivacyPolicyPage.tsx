import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Lock, Database, UserCheck, Eye } from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 space-y-8 animate-in fade-in duration-200">
      {/* Navigation Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#404942]">
        <Link to="/" className="hover:text-[#003820] font-medium flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#003820]">Privacy Policy</span>
      </div>

      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#c0c9c0]/30 shadow-xs flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#6ffbbe]/25 text-[#003820] flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#003820] tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-xs text-[#707971] font-mono mt-0.5">
              Effective Date: January 1, 2026 • Version 1.2
            </p>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-[#404942] leading-relaxed">
          At StudyTrack, we respect your privacy and are committed to protecting the personal and academic data you share while using our platform. This Privacy Policy outlines how your data is collected, stored, and utilized.
        </p>
      </div>

      {/* Policy Content Sections */}
      <div className="space-y-6 text-xs sm:text-sm text-[#0b1c30]">
        {/* Section 1 */}
        <section className="bg-white rounded-2xl p-6 border border-[#c0c9c0]/30 shadow-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-base text-[#003820]">
            <UserCheck className="w-5 h-5 text-[#006c49]" />
            <h2>1. Information We Collect</h2>
          </div>
          <p className="text-[#404942] leading-relaxed">
            When you sign in and interact with StudyTrack, we collect the following categories of information:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#404942]">
            <li><strong>Account Profile:</strong> Name, email address, profile picture provided via Google Authentication.</li>
            <li><strong>Academic Progress Data:</strong> Completed syllabus topics, theory/practice completion logs, study durations, and custom study sprint allocations.</li>
            <li><strong>Peer Collaboration Data:</strong> Challenge room memberships, accountability buddy links, and shared leaderboard scores.</li>
            <li><strong>Technical Session Data:</strong> Local browser storage preferences, timestamp logs, and authentication tokens.</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="bg-white rounded-2xl p-6 border border-[#c0c9c0]/30 shadow-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-base text-[#003820]">
            <Database className="w-5 h-5 text-[#006c49]" />
            <h2>2. How We Use Your Data</h2>
          </div>
          <p className="text-[#404942] leading-relaxed">
            Your data is used exclusively to deliver personalized academic progress tracking and peer accountability:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[#404942]">
            <li>Calculating daily completion percentages, chapter mastery rates, and weekly study streak metrics.</li>
            <li>Enabling real-time sprint synchronization across your devices via secure cloud databases.</li>
            <li>Displaying progress on shared peer challenge leaderboards when you opt into group sprint rooms.</li>
            <li>Preventing unauthorized access and ensuring compliance with platform terms.</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="bg-white rounded-2xl p-6 border border-[#c0c9c0]/30 shadow-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-base text-[#003820]">
            <Lock className="w-5 h-5 text-[#006c49]" />
            <h2>3. Data Storage &amp; Security</h2>
          </div>
          <p className="text-[#404942] leading-relaxed">
            All user data is stored within Firebase Firestore instances governed by strict granular Security Rules. We implement end-to-end HTTPS encryption for all network traffic. We never sell, rent, or monetize your study data with third-party advertisers.
          </p>
        </section>

        {/* Section 4 */}
        <section className="bg-white rounded-2xl p-6 border border-[#c0c9c0]/30 shadow-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-base text-[#003820]">
            <Eye className="w-5 h-5 text-[#006c49]" />
            <h2>4. Your Rights &amp; Data Deletion</h2>
          </div>
          <p className="text-[#404942] leading-relaxed">
            You retain complete control over your academic data. You can delete your study sprints, reset your syllabus selection, or request complete account erasure by contacting our administrator or using the in-app challenge management controls.
          </p>
        </section>
      </div>

      {/* Contact Footer Note */}
      <div className="p-4 rounded-xl bg-[#eff4ff] border border-[#c0c9c0]/30 text-xs text-[#404942] flex flex-col sm:flex-row items-center justify-between gap-3">
        <span>Questions regarding our privacy practices?</span>
        <Link to="/contact" className="px-4 py-1.5 rounded-lg bg-[#003820] text-white font-semibold hover:bg-[#004e2d] transition-colors">
          Contact Privacy Team
        </Link>
      </div>
    </div>
  );
};
