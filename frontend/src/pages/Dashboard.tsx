import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Shield, Plus, Minus, Volume2, VolumeX } from 'lucide-react';
import ChatInterface from '../components/ChatInterface';

export default function Dashboard() {
  const navigate = useNavigate();
  const [zoomLevel, setZoomLevel] = useState(100);
  const [userProfile, setUserProfile] = useState<any>(null);

  // SECURE SESSION CHECK
  useEffect(() => {
    const sessionActive = localStorage.getItem('lylo_session_active');
    const userEmail = localStorage.getItem('lylo_user_email');
    
    if (sessionActive !== 'true' || !userEmail) {
      navigate('/');
      return;
    }

    // Build the profile for the Chat Engine
    setUserProfile({
      name: userEmail.split('@')[0], // Uses the part before @ as a nickname
      email: userEmail,
      tech_iq: localStorage.getItem('lylo_tech_level') || 'average',
      personality: localStorage.getItem('lylo_personality') || 'protective',
      hardware: localStorage.getItem('lylo_calibration_hardware') || '',
      finances: localStorage.getItem('lylo_calibration_finances') || '',
      access_code: 'BETA-2026'
    });
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('lylo_session_active');
    localStorage.removeItem('lylo_user_email');
    localStorage.removeItem('lylo_assessment_complete');
    navigate('/');
  };

  if (!userProfile) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-blue-500 font-black animate-pulse uppercase tracking-widest text-xs">Accessing Vault...</div>;

  return (
    <div className="h-screen bg-[#050505] overflow-hidden">
      {/* We are putting the ChatInterface directly here. 
         This eliminates the "frozen" redirect issue because the user 
         is already at the destination.
      */}
      <ChatInterface profile={userProfile} />
      
      {/* FLOATING LOGOUT FOR BETA TESTERS */}
      <button 
        onClick={handleLogout}
        className="fixed top-4 right-20 z-[60] p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-red-900/20 transition-all"
        title="Logout"
      >
        <LogOut size={16} className="text-gray-500 hover:text-red-500" />
      </button>
    </div>
  );
}
