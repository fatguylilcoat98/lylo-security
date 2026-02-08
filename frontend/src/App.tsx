import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Assessment from './pages/Assessment';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Success from './pages/Success';

export default function App() {
  
  useEffect(() => {
    // Check if a session already exists in the browser
    const sessionActive = localStorage.getItem('lylo_session_active');
    const userEmail = localStorage.getItem('lylo_user_email');
    
    // If they have a key and are trying to look at the login page, 
    // bypass it and send them straight into the Vault.
    if (sessionActive === 'true' && userEmail && window.location.pathname === '/') {
      window.location.href = '/assessment'; 
    }
  }, []);

  return (
    <BrowserRouter>
      <div className="bg-[#02040a] min-h-screen text-slate-200 font-sans">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/assessment" element={<Assessment />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/success" element={<Success />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
