import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Assessment from './pages/Assessment';
import BetaTesterAdmin from './components/BetaTesterAdmin';

// --- THE GATEKEEPER (Upgraded with URL Handoff) ---
const Gatekeeper = ({ children }: { children: React.ReactNode }) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if the landing page is handing us credentials via the URL
    const urlParams = new URLSearchParams(window.location.search);
    const emailFromUrl = urlParams.get('email');
    const tierFromUrl = urlParams.get('tier');
    const nameFromUrl = urlParams.get('name');

    if (emailFromUrl) {
      // Catch the handoff and save it to the APP's local storage
      localStorage.setItem('userEmail', emailFromUrl);
      if (tierFromUrl) localStorage.setItem('userTier', tierFromUrl);
      if (nameFromUrl) localStorage.setItem('userName', nameFromUrl);
      
      // Wipe the URL clean so it looks professional and secure
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      
      setIsAuthorized(true);
      return;
    }

    // 2. If no URL handoff, check if they are already securely logged in
    const userEmail = localStorage.getItem('userEmail');
    
    if (!userEmail) {
      // UNAUTHORIZED: Eject them immediately to the main website
      window.location.assign('https://mylylo.pro');
    } else {
      // AUTHORIZED: Let them pass
      setIsAuthorized(true);
    }
  }, []);

  // Render a black screen while calculating to prevent UI flashing
  if (!isAuthorized) {
    return <div style={{ backgroundColor: '#000', height: '100vh', width: '100vw' }} />;
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
            <Gatekeeper>
              <Assessment />
            </Gatekeeper>
          } 
        />
        
        <Route 
          path="/assessment" 
          element={
            <Gatekeeper>
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
