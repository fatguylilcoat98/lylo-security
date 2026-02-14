import React from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  // 1. Get the user data from storage
  const userEmail = localStorage.getItem('userEmail');
  
  // 2. Check if they have a "VIP Pass" (Elite or Beta)
  // These keys are set during the index.html or Assessment.tsx login process
  const isElite = localStorage.getItem('isEliteUser') === 'true';
  const isBeta = localStorage.getItem('isBetaTester') === 'true';

  // 3. The Condition: Must have an email AND be either Elite OR Beta
  const hasAccess = userEmail && (isElite || isBeta);

  if (!hasAccess) {
    console.warn("Unauthorized access attempt by:", userEmail || "Anonymous");
    // Send them back to the Root Gate (Assessment/Login)
    // Using "/" ensures compatibility with your HashRouter setup
    return <Navigate to="/" replace />; 
  }

  // If they pass, show them the page
  return <>{children}</>;
};
