import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Assessment from './pages/Assessment';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root to Dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* The Dashboard handles Zoom, Layout, and Personas now */}
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* The Assessment Page */}
        <Route path="/assessment" element={<Assessment />} />
      </Routes>
    </BrowserRouter>
  );
}
