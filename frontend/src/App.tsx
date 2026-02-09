import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Assessment from './pages/Assessment';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Success from './pages/Success';

export default function App() {
  
  useEffect(() => {
    const sessionActive = localStorage.getItem('lylo_session_active');
    const userEmail = localStorage.getItem('lylo_user_email');
    const assessmentDone = localStorage.getItem('lylo_assessment_complete');
    
    // SAFETY CHECK: If they are logged in and already finished the questions
    if (sessionActive === 'true' && userEmail) {
      if (window.location.pathname === '/') {
        // If they already did the assessment, go to dashboard. If not, go to assessment.
        window.location.href = assessmentDone === 'true' ? '/dashboard' : '/assessment';
      }
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
