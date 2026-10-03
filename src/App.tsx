/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { StudyTrackProvider } from './context/StudyTrackContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AdminRoute } from './components/auth/AdminRoute';
import { LoginPage } from './pages/LoginPage';
import { MainDashboardPage } from './pages/MainDashboardPage';
import { HSCGrandDashboard } from './components/hsc/HSCGrandDashboard';
import { ChallengeWizard } from './components/wizard/ChallengeWizard';
import { PeerArenaDashboard } from './components/peerArena/PeerArenaDashboard';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StudyTrackProvider>
          <Routes>
            {/* Public Authentication Route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Routes for Authenticated Users */}
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

              {/* Route 3: Challenge Setup Wizard (Step 3 DnD Kanban) */}
              <Route path="challenges" element={<ChallengeWizard />} />

              {/* Route 4: Peer Arena & Live Leaderboard */}
              <Route path="peer-arena" element={<PeerArenaDashboard />} />

              {/* Route 5: Admin Dashboard (Strictly restricted to Admin role) */}
              <Route
                path="admin-dashboard"
                element={
                  <AdminRoute>
                    <AdminDashboardPage />
                  </AdminRoute>
                }
              />

              {/* Fallback to Main Dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </StudyTrackProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
