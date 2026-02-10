import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import QuickQuiz from './components/QuickQuiz';
import { PersonaConfig } from './components/Layout';

function App() {
  const [currentUser, setCurrentUser] = useState<{
    email: string;
    name: string;
    quizCompleted: boolean;
    currentPersonality: string;
  } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const personalities: PersonaConfig[] = [
    { id: 'guardian', name: 'Guardian', color: 'blue', description: 'Protective and security-focused' },
    { id: 'friend', name: 'Friend', color: 'green', description: 'Warm and supportive' },
    { id: 'roast', name: 'Roast Master', color: 'red', description: 'Witty and sarcastic' },
    { id: 'chef', name: 'Chef', color: 'orange', description: 'Food and cooking expert' },
    { id: 'techie', name: 'Techie', color: 'purple', description: 'Technology specialist' },
    { id: 'lawyer', name: 'Lawyer', color: 'yellow', description: 'Legal and professional' }
  ];

  useEffect(() => {
    // Auto-login for demo (replace with real auth)
    const demoUser = {
      email: 'stangman9898@gmail.com',
      name: 'Christopher',
      quizCompleted: true,
      currentPersonality: 'roast'
    };
    
    setCurrentUser(demoUser);
    setIsAuthenticated(true);
    
    // Load saved zoom level
    const savedZoom = localStorage.getItem('lylo_zoom_level');
    if (savedZoom) {
      setZoomLevel(parseInt(savedZoom));
    }
  }, []);

  const handleQuizComplete = () => {
    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        quizCompleted: true
      });
    }
  };

  const handlePersonalityChange = async (personalityId: string) => {
    if (currentUser) {
      try {
        const formData = new FormData();
        formData.append('user_email', currentUser.email);
        formData.append('personality', personalityId);
        
        await fetch('https://lylo-backend.onrender.com/update-profile', {
          method: 'POST',
          body: formData
        });
        
        setCurrentUser({
          ...currentUser,
          currentPersonality: personalityId
        });
      } catch (error) {
        console.error('Failed to update personality:', error);
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.clear();
  };

  const handleZoomChange = (newZoom: number) => {
    setZoomLevel(newZoom);
    localStorage.setItem('lylo_zoom_level', newZoom.toString());
  };

  if (!isAuthenticated || !currentUser) {
    return (
      <div className="h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-white text-xl">Loading LYLO...</div>
      </div>
    );
  }

  if (!currentUser.quizCompleted) {
    return (
      <QuickQuiz 
        userEmail={currentUser.email}
        onComplete={handleQuizComplete}
      />
    );
  }

  const currentPersonality = personalities.find(p => p.id === currentUser.currentPersonality) || personalities[0];

  return (
    <div className="h-screen overflow-hidden">
      {/* Zoom Controls - Fixed Position */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-black/90 backdrop-blur-xl border border-white/20 rounded-lg p-2">
        <button
          onClick={() => handleZoomChange(Math.max(50, zoomLevel - 25))}
          className="w-8 h-8 bg-white/10 text-white rounded text-lg font-bold hover:bg-white/20 transition-colors"
        >
          A-
        </button>
        <span className="text-white text-sm font-bold min-w-[50px] text-center">
          {zoomLevel}%
        </span>
        <button
          onClick={() => handleZoomChange(Math.min(200, zoomLevel + 25))}
          className="w-8 h-8 bg-white/10 text-white rounded text-lg font-bold hover:bg-white/20 transition-colors"
        >
          A+
        </button>
      </div>

      <ChatInterface
        currentPersona={currentPersonality}
        userEmail={currentUser.email}
        userName={currentUser.name}
        zoomLevel={zoomLevel}
        onPersonalityChange={handlePersonalityChange}
        onLogout={handleLogout}
      />
    </div>
  );
}

export default App;
