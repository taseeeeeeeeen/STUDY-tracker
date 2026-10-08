/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { StudyTrackProvider } from './context/StudyTrackContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AdminRoute } from './components/auth/AdminRoute';
import { LoginPage } from './pages/LoginPage';
import { MainDashboardPage } from './pages/MainDashboardPage';
import { StrategyPlannerPage } from './pages/StrategyPlannerPage';
import { HSCGrandDashboard } from './components/hsc/HSCGrandDashboard';
import { ChallengeWizard } from './components/wizard/ChallengeWizard';
import { PeerArenaDashboard } from './components/peerArena/PeerArenaDashboard';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsPage } from './pages/TermsPage';
import { CookiePolicyPage } from './pages/CookiePolicyPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StudyTrackProvider>
          <Routes>
            {/* Public Authentication Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Application Routes with Main Navigation Layout */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              {/* Route 1: Main Dashboard */}
              <Route index element={<MainDashboardPage />} />

              {/* Route 2: HSC Grand Progress Dashboard */}
              <Route path="hsc-progress" element={<HSCGrandDashboard />} />

              {/* Route 2b: Strategy Planner Core Module */}
              <Route path="strategy-planner" element={<StrategyPlannerPage />} />

              {/* Route 3: Challenge Setup Wizard (Step 3 DnD Kanban) */}
              <Route path="challenges" element={<ChallengeWizard />} />

              {/* Route 4: Peer Arena & Live Leaderboard */}
              <Route path="peer-arena" element={<PeerArenaDashboard />} />

              {/* Route 5: Legal & Compliance Pages */}
              <Route path="privacy" element={<PrivacyPolicyPage />} />
              <Route path="terms" element={<TermsPage />} />
              <Route path="cookies" element={<CookiePolicyPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="contact" element={<ContactPage />} />

              {/* Route 6: Admin Dashboard (Strictly restricted to Admin role) */}
              <Route
                path="admin-dashboard"
                element={
                  <AdminRoute>
                    <AdminDashboardPage />
                  </AdminRoute>
                }
              />

              {/* Route 7: Custom 404 Not Found Page */}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </StudyTrackProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
