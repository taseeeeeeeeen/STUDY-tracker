import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send, CheckCircle2, MessageSquare, MapPin } from 'lucide-react';

export const ContactPage: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '', subject: 'Support' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 space-y-8 animate-in fade-in duration-200">
      {/* Navigation Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#404942]">
        <Link to="/" className="hover:text-[#003820] font-medium flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <span>/</span>
        <span className="font-semibold text-[#003820]">Contact Us</span>
      </div>

      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#c0c9c0]/30 shadow-xs flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#6ffbbe]/25 text-[#003820] flex items-center justify-center">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#003820] tracking-tight">
              Contact &amp; Support
            </h1>
            <p className="text-xs text-[#707971] font-mono mt-0.5">
              We're here to help you excel in your academic journey
            </p>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-[#404942] leading-relaxed">
          Have questions regarding syllabus customizations, feature suggestions, or account assistance? Reach out to our team using the form below.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Contact Information Cards */}
        <div className="space-y-4 text-xs text-[#404942]">
          <div className="bg-white rounded-2xl p-5 border border-[#c0c9c0]/30 shadow-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-[#003820]">
              <Mail className="w-4 h-4 text-[#006c49]" />
              <span>Email Support</span>
            </div>
            <p className="font-mono text-[#0b1c30]">support@studytrack.academy</p>
            <p className="text-[11px] text-[#707971]">Response within 24 hours.</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#c0c9c0]/30 shadow-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-[#003820]">
              <MessageSquare className="w-4 h-4 text-[#006c49]" />
              <span>Community &amp; Peers</span>
            </div>
            <p className="text-[#0b1c30]">Join the StudyTrack student discord &amp; peer network.</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#c0c9c0]/30 shadow-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-[#003820]">
              <MapPin className="w-4 h-4 text-[#006c49]" />
              <span>Location</span>
            </div>
            <p className="text-[#0b1c30]">Dhaka, Bangladesh</p>
            <p className="text-[11px] text-[#707971]">Dedicated to HSC &amp; Admission aspirants.</p>
          </div>
        </div>

        {/* Contact Form */}
        <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-[#c0c9c0]/30 shadow-xs">
          {submitted ? (
            <div className="py-12 flex flex-col items-center text-center space-y-3 animate-in fade-in">
              <div className="w-12 h-12 rounded-full bg-[#6ffbbe]/30 text-[#003820] flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-[#003820]">Message Received!</h3>
              <p className="text-xs text-[#404942] max-w-sm">
                Thank you for reaching out. An academic advisor will get back to you shortly at <strong className="font-mono">{formData.email}</strong>.
              </p>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="mt-4 px-4 py-2 rounded-xl bg-[#eff4ff] text-[#003820] text-xs font-semibold hover:bg-[#e5eeff] transition-colors"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-[#0b1c30]">Your Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Tanvir Ahmed"
                    className="w-full bg-[#eff4ff]/60 border border-[#c0c9c0]/60 rounded-xl px-3.5 py-2 text-[#0b1c30] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003820]/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-[#0b1c30]">Your Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. tanvir@gmail.com"
                    className="w-full bg-[#eff4ff]/60 border border-[#c0c9c0]/60 rounded-xl px-3.5 py-2 text-[#0b1c30] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003820]/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-[#0b1c30]">Subject</label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full bg-[#eff4ff]/60 border border-[#c0c9c0]/60 rounded-xl px-3.5 py-2 text-[#0b1c30] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003820]/20"
                >
                  <option value="Support">General Support &amp; Assistance</option>
                  <option value="Syllabus">Syllabus Topic Request</option>
                  <option value="Bug">Bug Report &amp; Technical Feedback</option>
                  <option value="Feature">Feature Suggestion</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-[#0b1c30]">Message *</label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="How can we assist your study routine?"
                  className="w-full bg-[#eff4ff]/60 border border-[#c0c9c0]/60 rounded-xl px-3.5 py-2 text-[#0b1c30] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#003820]/20"
                />
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#003820] hover:bg-[#004e2d] text-white font-bold shadow-md shadow-[#003820]/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4 text-[#6ffbbe]" />
                <span>Send Message</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
