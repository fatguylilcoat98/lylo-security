import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Assessment from './pages/Assessment';
import BetaTesterAdmin from './components/BetaTesterAdmin';

// --- THE GATEKEEPER (Reverted to your exact working logic) ---
const Gatekeeper = ({ children }: { children: React.ReactNode }) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

  useEffect(() => {
    // 1. Regex to pull params from anywhere in the URL safely
    const fullUrl = window.location.href;
    
    const getParam = (param: string) => {
      const match = fullUrl.match(new RegExp(`[?&]${param}=([^&#]*)`));
      return match ? decodeURIComponent(match[1]) : null;
    };

    const emailFromUrl = getParam('email');
    const tierFromUrl = getParam('tier');
    const nameFromUrl = getParam('name');

    if (emailFromUrl) {
      // Catch the handoff and save it
      localStorage.setItem('userEmail', emailFromUrl);
      if (tierFromUrl) localStorage.setItem('userTier', tierFromUrl);
      if (nameFromUrl) localStorage.setItem('userName', nameFromUrl);
      
      // Safely wipe the params without destroying the HashRouter map
      const baseUrl = window.location.origin + window.location.pathname;
      const cleanHash = window.location.hash.split('?')[0]; 
      window.history.replaceState({}, document.title, baseUrl + cleanHash);
      
      setIsAuthorized(true);
      return;
    }

    // 2. Standard local storage check
    const userEmail = localStorage.getItem('userEmail');
    
    if (!userEmail) {
      // Eject them immediately
      window.location.assign('https://mylylo.pro');
    } else {
      // Let them pass
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
