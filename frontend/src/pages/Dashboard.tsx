import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Shield } from 'lucide-react';
import ChatInterface from '../components/ChatInterface';
import Assessment from './Assessment'; // We will use your existing component

export default function Dashboard() {
  const navigate = useNavigate();
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    // 1. Check if they are actually logged in
    const sessionActive = localStorage.getItem('lylo_session_active');
    const userEmail = localStorage.getItem('lylo_user_email');
    const assessmentDone = localStorage.getItem('lylo_assessment_complete');

    if (sessionActive !== 'true' || !userEmail) {
      navigate('/'); // Go back to login if they aren't legit
      return;
    }

    if (assessmentDone === 'true') {
      setIsCalibrated(true);
      setUserProfile({
        name: userEmail.split('@')[0],
        email: userEmail,
        tech_iq: localStorage.getItem('lylo_tech_level') || 'average',
        personality: localStorage.getItem('lylo_personality') || 'protective',
        hardware: localStorage.getItem('lylo_calibration_hardware') || '',
        finances: localStorage.getItem('lylo_calibration_finances') || '',
        access_code: 'BETA-2026'
      });
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  // IF THEY ARE NOT DONE: Show them the questions on this same page
  if (!isCalibrated) {
    return <Assessment />;
  }

  // IF THEY ARE DONE: Open the Vault instantly
  return (
    <div className="h-screen bg-[#050505] overflow-hidden">
      <ChatInterface profile={userProfile} />
      {/* Stealth Logout Button for Testers */}
      <button 
        onClick={handleLogout}
        className="fixed top-4 right-4 z-[100] p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-red-900/20 transition-all"
      >
        <LogOut size={16} className="text-gray-500" />
      </button>
    </div>
  );
}
