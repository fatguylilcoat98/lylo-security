import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Assessment from './pages/Assessment';
import BetaTesterAdmin from './components/BetaTesterAdmin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* If someone hits the App directly, send them straight to Login/Assessment */}
        <Route path="/" element={<Navigate to="/assessment" replace />} />
        
        {/* App Routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/assessment" element={<Assessment />} />
        
        {/* Admin */}
        <Route path="/admin/beta-testers" element={<BetaTesterAdmin />} /> 
      </Routes>
    </BrowserRouter>
  );
}
