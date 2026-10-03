import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex flex-col items-center justify-center gap-4 text-[#003820]">
        <div className="w-12 h-12 rounded-2xl bg-[#003820] flex items-center justify-center text-[#6ffbbe] shadow-lg animate-bounce">
          <span className="material-symbols-outlined text-2xl">school</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs font-semibold text-[#404942]">
          <div className="w-4 h-4 border-2 border-[#003820] border-t-transparent rounded-full animate-spin" />
          <span>Verifying Firebase Authentication...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : null;
};
