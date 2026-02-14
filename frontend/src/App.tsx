import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Assessment from './pages/Assessment';
import BetaTesterAdmin from './components/BetaTesterAdmin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* SET ASSESSMENT AS THE PRIMARY ROOT GATE */}
        {/* This removes the redirect loop and fixes the Not Found error */}
        <Route path="/" element={<Assessment />} />
        
        {/* APP ROUTES */}
        <Route path="/assessment" element={<Assessment />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin/beta-testers" element={<BetaTesterAdmin />} /> 
      </Routes>
    </BrowserRouter>
  );
}
