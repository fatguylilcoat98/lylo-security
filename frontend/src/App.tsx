import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Assessment from './pages/Assessment';
import BetaTesterAdmin from './components/BetaTesterAdmin';

// --- THE GATEKEEPER ---
// This component wraps your routes. If a user is not logged in, 
// it intercepts them and ejects them back to the waitlist.
const Gatekeeper = ({ children }: { children: React.ReactNode }) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);

  useEffect(() => {
    // Check if the user has a valid session in local storage
    const userEmail = localStorage.getItem('userEmail');
    
    if (!userEmail) {
      // UNAUTHORIZED: Eject them immediately to the correct main website
      window.location.assign('https://mylylo.pro');
    } else {
      // AUTHORIZED: Let them pass
      setIsAuthorized(true);
    }
  }, []);

  // If they aren't authorized yet, render a black screen to prevent the UI from flashing
  if (!isAuthorized) {
    return <div style={{ backgroundColor: '#000', height: '100vh', width: '100vw' }} />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* We wrap every single route inside the <Gatekeeper> to ensure total lockdown */}
        
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
