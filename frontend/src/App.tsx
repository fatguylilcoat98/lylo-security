import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Assessment from './pages/Assessment';
import BetaTesterAdmin from './components/BetaTesterAdmin';

// --- THE GATEKEEPER (Bulletproof URL Handoff) ---
const Gatekeeper = ({ children, requireRedirect = false }: { children: React.ReactNode, requireRedirect?: boolean }) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [shouldRedirectToDash, setShouldRedirectToDash] = useState<boolean>(false);

  useEffect(() => {
    // 1. Force-scan the entire URL string, ignoring HashRouter confusion
    const fullUrl = window.location.href;
    
    // Custom Regex function to pull the data safely
    const getParam = (param: string) => {
      const match = fullUrl.match(new RegExp(`[?&]${param}=([^&]*)`));
      return match ? decodeURIComponent(match[1]) : null;
    };

    const emailFromUrl = getParam('email');
    const tierFromUrl = getParam('tier');
    const nameFromUrl = getParam('name');

    if (emailFromUrl) {
      // 2. Catch the handoff and save it to the APP's local storage!
      localStorage.setItem('userEmail', emailFromUrl);
      if (tierFromUrl) localStorage.setItem('userTier', tierFromUrl);
      if (nameFromUrl) localStorage.setItem('userName', nameFromUrl);
      
      // 3. Clean the URL so the user's email isn't visible
      const cleanUrl = fullUrl.split('?')[0]; 
      window.history.replaceState({}, document.title, cleanUrl);
      
      setIsAuthorized(true);
      if (requireRedirect) setShouldRedirectToDash(true);
      return;
    }

    // 4. If no URL data, check if they are already logged in locally
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
      // UNAUTHORIZED: Eject back to the landing page
      window.location.assign('https://mylylo.pro');
    } else {
      // AUTHORIZED: Let them pass
      setIsAuthorized(true);
      if (requireRedirect) setShouldRedirectToDash(true);
    }
  }, [requireRedirect]);

  // Render a black screen while calculating to prevent UI flashing
  if (!isAuthorized) {
    return <div style={{ backgroundColor: '#000', height: '100vh', width: '100vw' }} />;
  }

  // If they hit a login/root route with credentials, push them straight to the Dashboard
  if (shouldRedirectToDash) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route 
          path="/" 
          element={
            <Gatekeeper requireRedirect={true}>
              <Assessment />
            </Gatekeeper>
          } 
        />
        
        <Route 
          path="/assessment" 
          element={
            <Gatekeeper requireRedirect={true}>
              <Assessment />
            </Gatekeeper>
          } 
        />
        
        <Route 
          path="/dashboard" 
          element={
            <Gatekeeper>
              <Dashboard />
            </Gatekeeper>
          } 
        />
        
        <Route 
          path="/admin/beta-testers" 
          element={
            <Gatekeeper>
              <BetaTesterAdmin />
            </Gatekeeper>
          } 
        /> 
      </Routes>
    </HashRouter>
  );
}
