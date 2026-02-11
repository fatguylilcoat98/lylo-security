
import React from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  // Logic: Check if the user is actually authorized.
  // We check for a saved email and if they are marked as 'elite' (like Laura)
  const userEmail = localStorage.getItem('userEmail');
  const isElite = localStorage.getItem('isEliteUser') === 'true';

  // If there is no email OR they aren't authorized, kick them back to Login
  if (!userEmail || !isElite) {
    console.warn("Unauthorized access attempt. Redirecting to login.");
    return <Navigate to="/dashboard" replace />; 
  }

  return <>{children}</>;
};
