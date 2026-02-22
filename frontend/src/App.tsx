import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Assessment from './pages/Assessment';
import BetaTesterAdmin from './components/BetaTesterAdmin';

// --- THE GATEKEEPER (Upgraded with URL Handoff & Boot Delay Fix) ---
const Gatekeeper = ({ children, requireRedirect = false }: { children: React.ReactNode, requireRedirect?: boolean }) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [shouldRedirectToDash, setShouldRedirectToDash] = useState<boolean>(false);
  const [isBooting, setIsBooting] = useState<boolean>(true); // NEW: System loading state

  useEffect(() => {
    const initializeGatekeeper = () => {
      // 1. Force-scan URL for credentials (Handoff)
      const fullUrl = window.location.href;
      const getParam = (param: string) => {
        const match = fullUrl.match(new RegExp(`[?&]${param}=([^&]*)`));
        return match ? decodeURIComponent(match[1]) : null;
      };

      const emailFromUrl = getParam('email');
      const tierFromUrl = getParam('tier');
      const nameFromUrl = getParam('name');

      if (emailFromUrl) {
        // Catch the handoff and save it to the APP's local storage
        localStorage.setItem('userEmail', emailFromUrl);
        if (tierFromUrl) localStorage.setItem('userTier', tierFromUrl);
        if (nameFromUrl) localStorage.setItem('userName', nameFromUrl);
        
        // Clear the URL params for a clean look
        const cleanUrl = fullUrl.split('?')[0]; 
        window.history.replaceState({}, document.title, cleanUrl);
        
        setIsAuthorized(true);
        if (requireRedirect) setShouldRedirectToDash(true);
        setIsBooting(false);
        return;
      }

      // 2. CHECK STORAGE (Refresh fix)
      const storedEmail = localStorage.getItem('userEmail');
      if (storedEmail) {
        setIsAuthorized(true);
        // Only redirect to dashboard if we are at the root or assessment
        if (requireRedirect) setShouldRedirectToDash(true);
      } else {
        // No ID found - kick back to landing page
        window.location.assign('https://mylylo.pro');
      }

      // Give the system 300ms to catch its breath from memory to prevent black screen hang
      setTimeout(() => setIsBooting(false), 300);
    };

    initializeGatekeeper();
  }, [requireRedirect]);

  // Show the black screen with a subtle loading spinner ONLY while booting
  if (isBooting || !isAuthorized) {
    return (
      <div style={{ backgroundColor: '#000', height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

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
