import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Assessment from './pages/Assessment';
import BetaTesterAdmin from './components/BetaTesterAdmin';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* SET ASSESSMENT AS THE PRIMARY ROOT GATE */}
        {/* Using HashRouter ensures that the /#/ routes from index.html are caught by React */}
        <Route path="/" element={<Assessment />} />
        
        {/* APP ROUTES */}
        <Route path="/assessment" element={<Assessment />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin/beta-testers" element={<BetaTesterAdmin />} /> 
      </Routes>
    </HashRouter>
  );
}
