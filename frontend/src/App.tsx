import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Assessment from './pages/Assessment';
import BetaTesterAdmin from './components/BetaTesterAdmin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root to Dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* The Dashboard handles all the heavy lifting now */}
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* The Onboarding Wizard */}
        <Route path="/assessment" element={<Assessment />} />

        <Route path="/admin/beta-testers" element={<BetaTesterAdmin />} /> 
      </Routes>
    </BrowserRouter>
  );
}
