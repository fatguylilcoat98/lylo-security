import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Assessment from './pages/Assessment';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
// NEW: Import the Stripe Landing Pages
import Success from './pages/Success';
import Cancel from './pages/Cancel';

export default function App() {
  return (
    <BrowserRouter>
      <div className="bg-slate-950 min-h-screen text-slate-200 font-sans selection:bg-yellow-500/30">
        <Routes>
          {/* Main Entry Points */}
          <Route path="/" element={<Login />} />
          <Route path="/assessment" element={<Assessment />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          
          {/* Stripe Response Routes */}
          <Route path="/success" element={<Success />} />
          <Route path="/cancel" element={<Cancel />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
