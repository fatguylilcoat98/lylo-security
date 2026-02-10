import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage, getUserStats, Message, UserStats } from '../lib/api';
import { PersonaConfig } from '../types';

interface ChatInterfaceProps {
  currentPersona: PersonaConfig;
  userEmail: string;
  zoomLevel: number;
  onZoomChange: (zoom: number) => void;
  onPersonaChange: (persona: PersonaConfig) => void;
  onLogout: () => void;
  onUsageUpdate?: () => void;
}

const PERSONAS: PersonaConfig[] = [
  { id: 'guardian', name: 'The Guardian', description: 'Protective Security Expert', color: 'blue' },
  { id: 'roast', name: 'The Roast Master', description: 'Witty but Helpful', color: 'orange' },
  { id: 'friend', name: 'The Friend', description: 'Caring Best Friend', color: 'green' },
  { id: 'chef', name: 'The Chef', description: 'Food & Cooking Expert', color: 'red' },
  { id: 'techie', name: 'The Techie', description: 'Technology Expert', color: 'purple' },
  { id: 'lawyer', name: 'The Lawyer', description: 'Legal Advisor', color: 'yellow' }
];

export default function ChatInterface({ 
  currentPersona, 
  userEmail,
  zoomLevel,
  onZoomChange,
  onPersonaChange,
  onLogout,
  onUsageUpdate
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoTTS, setAutoTTS] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [micSupported, setMicSupported] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [showCameraOptions, setShowCameraOptions] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [transcript, setTranscript] = useState(''); // Real-time transcript
   
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadUserStats();
  }, [userEmail]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // FIXED: CONTINUOUS VOICE RECOGNITION LIKE CLAUDE
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      // CLAUDE-STYLE SETTINGS
      recognition.continuous = true;        // Keep listening
      recognition.interimResults = true;    // Show real-time results
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log('🎤 Continuous recording started');
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        // Process all results
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + ' ';
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        // Update transcript in real-time (like Claude)
        const currentText = input + finalTranscript + interimTranscript;
        setTranscript(currentText);
        setInput(input + finalTranscript); // Only add final results to input
        
        console.log('🎤 Real-time transcript:', currentText);
      };

      recognition.onend = () => {
        console.log('🎤 Recognition ended');
        setIsListening(false);
        setTranscript('');
      };

      recognition.onerror = (event: any) => {
        console.error('🎤 Speech error:', event.error);
        if (event.error !== 'no-speech') {
          setIsListening(false);
          setTranscript('');
        }
      };
      
      recognitionRef.current = recognition;
      setMicSupported(true);
      console.log('✅ Continuous speech recognition ready');
    } else {
      setMicSupported(false);
    }
  }, [input]);

  const loadUserStats = async () => {
    try {
      const stats = await getUserStats(userEmail);
      setUserStats(stats);
      if (onUsageUpdate) onUsageUpdate();
    } catch (error) {
      console.error('Failed to load user stats:', error);
    }
  };

  const speakText = (text: string) => {
    if (!autoTTS || !text || isSpeaking) return;
    const cleanText = text.replace(/\([^)]*\)/g, '').replace(/\*\*/g, '').trim();
    if (window.speechSynthesis && cleanText) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 0.9;
      setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.sender === 'bot' && autoTTS) {
      setTimeout(() => speakText(lastMessage.content), 500);
    }
  }, [messages, autoTTS]);

  // TOGGLE CONTINUOUS RECORDING
  const toggleListening = () => {
    if (!micSupported) {
      alert('Speech recognition not supported');
      return;
    }

    if (isListening) {
      // Stop recording
      recognitionRef.current?.stop();
      setIsListening(false);
      setTranscript('');
    } else {
      // Start continuous recording
      if (isSpeaking) {
        window.speechSynthesis?.cancel();
        setIsSpeaking(false);
      }
      try {
        recognitionRef.current?.start();
      } catch (error) {
        console.error('🎤 Start error:', error);
      }
    }
  };

  const toggleTTS = () => {
    if (autoTTS && isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    }
    setAutoTTS(!autoTTS);
  };

  const cycleFontSize = () => {
    if (zoomLevel < 100) onZoomChange(100);
    else if (zoomLevel < 125) onZoomChange(125);
    else onZoomChange(85);
  };

  const openCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: 'environment'
        }
      });
      
      setStream(mediaStream);
      setIsCameraOpen(true);
      setShowCameraOptions(false);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Camera error:', error);
      alert('Camera access denied. Check permissions.');
    }
  };

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
            setSelectedImage(file);
            closeCamera();
            console.log('📸 Photo captured');
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };

  const handleSend = async () => {
    const textToSend = input.trim();
    
    if ((!textToSend && !selectedImage) || loading) return;

    console.log('📤 Sending:', textToSend);

    let previewContent = textToSend;
    if (selectedImage) {
      previewContent = textToSend ? `${textToSend} [Image: ${selectedImage.name}]` : `[Image: ${selectedImage.name}]`;
    }

    const userMsg: Message = { 
      id: Date.now().toString(), 
      content: previewContent, 
      sender: 'user', 
      timestamp: new Date() 
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendChatMessage(
        textToSend || "Analyze this image", 
        [], 
        currentPersona.id,
        userEmail,
        selectedImage
      );
      
      const botMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        content: response.answer, 
        sender: 'bot', 
        timestamp: new Date(),
        confidenceScore: response.confidence_score,
        scamDetected: response.scam_detected,
        scamIndicators: [] 
      };
      
      setMessages(prev => [...prev, botMsg]);
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadUserStats();
      
    } catch (error) {
      console.error('❌ Send error:', error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        content: "Connection error. Please try again.", 
        sender: 'bot', 
        timestamp: new Date() 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setShowDropdown(false);
      setShowUserDetails(false);
      setShowCameraOptions(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getUserDisplayName = () => {
    if (userEmail.toLowerCase().includes('stangman')) return 'Christopher';
    return userEmail.split('@')[0];
  };

  // Display text: show real-time transcript when listening, otherwise input
  const displayText = isListening ? transcript : input;

  return (
    <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        backgroundColor: '#050505',
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        width: '100vw',
        overflow: 'hidden',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont'
    }}>
      
      {/* CAMERA MODAL */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[100010] bg-black flex flex-col">
          <div className="flex justify-between items-center p-4 bg-black/90">
            <button
              onClick={closeCamera}
              className="text-white text-xl font-bold px-4 py-2 bg-red-600 rounded-lg"
            >
              ✕ Close
            </button>
            <h3 className="text-white text-lg font-bold">Take Photo</h3>
            <button
              onClick={capturePhoto}
              className="text-white text-lg font-bold px-6 py-3 bg-blue-600 rounded-lg"
            >
              📸 Capture
            </button>
          </div>
          
          <div className="flex-1 flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="max-w-full max-h-full"
            />
          </div>
          
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* HEADER */}
      <div className="bg-black/95 backdrop-blur-xl border-b border-white/5 p-3 flex-shrink-0 relative z-[100002]">
        <div className="flex items-center justify-between">
          
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
              className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <div className="space-y-1">
                <div className="w-4 h-0.5 bg-white"></div>
                <div className="w-4 h-0.5 bg-white"></div>
                <div className="w-4 h-0.5 bg-white"></div>
              </div>
            </button>

            {showDropdown && (
              <div className="absolute top-12 left-0 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 min-w-[200px] z-[100003] max-h-[80vh] overflow-y-auto shadow-2xl">
                
                <div className="mb-3">
                  <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-1">AI Personality</h3>
                  <div className="space-y-1">
                    {PERSONAS.map(persona => (
                      <button
                        key={persona.id}
                        onClick={() => {
                          onPersonaChange(persona);
                          setShowDropdown(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg transition-colors ${
                          currentPersona.id === persona.id 
                            ? 'bg-[#3b82f6] text-white' 
                            : 'bg-white/5 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        <div className="font-medium text-xs">{persona.name}</div>
                        <div className="text-xs opacity-70">{persona.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-1">Text Size</h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onZoomChange(Math.max(50, zoomLevel - 25))}
                      className="w-6 h-6 bg-white/10 hover:bg-white/20 rounded text-white font-bold text-xs"
                    >
                      -
                    </button>
                    <span className="text-white font-bold text-xs min-w-[40px] text-center">
                      {zoomLevel}%
                    </span>
                    <button 
                      onClick={() => onZoomChange(Math.min(200, zoomLevel + 25))}
                      className="w-6 h-6 bg-white/10 hover:bg-white/20 rounded text-white font-bold text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onLogout();
                    setShowDropdown(false);
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
          </div>

          <div className="text-center flex-1 px-2">
            <h1 className="text-white font-black text-lg uppercase tracking-[0.2em]" style={{ fontSize: `${zoomLevel / 100}rem` }}>
              L<span className="text-[#3b82f6]">Y</span>LO
            </h1>
            <p className="text-gray-500 text-xs uppercase tracking-[0.3em] font-bold">
              Digital Bodyguard
            </p>
          </div>

          <div className="flex items-center gap-2 relative">
            <div 
              className="text-right cursor-pointer hover:bg-white/10 rounded p-2 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setShowUserDetails(!showUserDetails);
              }}
            >
              <div className="text-white font-bold text-xs" style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}>
                {getUserDisplayName()}
              </div>
              <div className="flex items-center gap-1 justify-end">
                <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-gray-400 text-xs uppercase font-bold">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>

            {showUserDetails && (
              <div className="absolute top-16 right-0 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-4 min-w-[250px] z-[100003] shadow-2xl">
                <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-2">Account Details</h3>
                {userStats && (
                  <div className="space-y-2 text-xs text-gray-300">
                    <div className="flex justify-between">
                      <span>Tier:</span>
                      <span className="text-[#3b82f6] font-bold">{userStats.tier.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Today:</span>
                      <span className="text-white">{userStats.conversations_today}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total:</span>
                      <span className="text-white">{userStats.total_conversations}</span>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Usage:</span>
                        <span>{userStats.usage.current}/{userStats.usage.limit}</span>
                      </div>
                      <div className="bg-gray-800 rounded-full h-2">
                        <div 
                          className="h-2 bg-[#3b82f6] rounded-full transition-all"
                          style={{ width: `${Math.min(100, userStats.usage.percentage)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MESSAGES AREA */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-3 relative z-[100000]"
        style={{ 
          paddingBottom: '160px', 
          minHeight: 0,
          fontSize: `${zoomLevel / 100}rem`
        }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <div className="w-16 h-16 bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
              <span className="text-white font-black text-xl">L</span>
            </div>
            
            <h2 className="text-lg font-black text-white uppercase tracking-[0.1em] mb-2">
              {currentPersona.name}
            </h2>
            <p className="text-gray-400 text-sm max-w-sm uppercase tracking-[0.1em] font-medium">
              Your AI Security System is Ready
            </p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            
            <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[85%] p-3 rounded-xl backdrop-blur-xl border transition-all
                ${msg.sender === 'user' 
                  ? 'bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] border-[#3b82f6]/30 text-white shadow-lg shadow-blue-500/10'
                  : 'bg-black/60 border-white/10 text-gray-100'
                }
              `}>
                <div className="leading-relaxed font-medium">
                  {msg.content}
                </div>
                
                <div className={`text-xs mt-2 opacity-70 font-bold uppercase tracking-wider ${
                  msg.sender === 'user' ? 'text-right text-blue-100' : 'text-left text-gray-400'
                }`}>
                  {msg.timestamp.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </div>

            {msg.sender === 'bot' && msg.confidenceScore && (
              <div className="max-w-[85%]">
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-black uppercase text-xs tracking-[0.1em]">
                      Truth Confidence
                    </span>
                    <span className="text-[#3b82f6] font-black text-sm">
                      {msg.confidenceScore}%
                    </span>
                  </div>
                  
                  <div className="bg-gray-800/50 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] transition-all duration-1000"
                      style={{ width: `${msg.confidenceScore}%` }}
                    />
                  </div>
                  
                  {msg.scamDetected && (
                    <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-xs font-bold">
                      ⚠️ SCAM DETECTED
                      {msg.scamIndicators && msg.scamIndicators.length > 0 && (
                        <div className="mt-1 text-xs opacity-80 font-normal">
                          {msg.scamIndicators.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-3 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
                <span className="text-gray-300 font-medium uppercase tracking-wider text-sm">
                  {currentPersona.name} analyzing...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FIXED BOTTOM INPUT */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/5 p-3 z-[100002]">
        <div className="bg-black/70 backdrop-blur-xl rounded-xl border border-white/10 p-3">
          
          <div className="flex items-center justify-between mb-3">
            {/* CONTINUOUS MIC TOGGLE */}
            <button
              onClick={toggleListening}
              disabled={loading || !micSupported}
              className={`
                px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-[0.1em] transition-all
                ${isListening 
                  ? 'bg-red-600 text-white animate-pulse' 
                  : micSupported 
                    ? 'bg-white/10 text-gray-300 hover:bg-white/20'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }
                disabled:opacity-50
              `}
              style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}
            >
              Mic {isListening ? 'ON' : 'OFF'}
            </button>

            <button 
               onClick={cycleFontSize} 
               className="text-xs px-3 py-1 rounded bg-zinc-800 text-blue-400 font-bold border border-blue-500/30 hover:bg-blue-900/20 active:scale-95 transition-all uppercase tracking-wide"
             >
               Text Size: {zoomLevel}%
             </button>

            <button
              onClick={toggleTTS}
              className={`
                px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-[0.1em] transition-all relative
                ${autoTTS 
                  ? 'bg-[#3b82f6] text-white' 
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }
              `}
              style={{ fontSize: `${zoomLevel / 100 * 0.8}rem` }}
            >
              Voice {autoTTS ? 'ON' : 'OFF'}
              {isSpeaking && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              )}
            </button>
          </div>
          
          <div className="flex items-end gap-3">
             <input 
               type="file" 
               ref={fileInputRef} 
               className="hidden" 
               accept="image/*" 
               onChange={handleImageSelect}
             />

             <div className="relative">
               <button
                 onClick={(e) => {
                   e.stopPropagation();
                   setShowCameraOptions(!showCameraOptions);
                 }}
                 className={`
                   w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg transition-all
                   ${selectedImage 
                     ? 'bg-green-600 text-white shadow-lg shadow-green-500/20' 
                     : 'bg-white/10 text-gray-400 hover:bg-white/20'
                   }
                 `}
                 title="Camera Options"
               >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
               </button>

               {showCameraOptions && (
                 <div className="absolute bottom-12 left-0 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-2 min-w-[160px] z-[100005] shadow-2xl">
                   <button
                     onClick={() => {
                       openCamera();
                       setShowCameraOptions(false);
                     }}
                     className="w-full text-left p-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors mb-1"
                   >
                     <div className="font-medium text-xs">📸 Take Photo</div>
                     <div className="text-xs opacity-70">Use device camera</div>
                   </button>
                   
                   <button
                     onClick={() => {
                       fileInputRef.current?.click();
                       setShowCameraOptions(false);
                     }}
                     className="w-full text-left p-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
                   >
                     <div className="font-medium text-xs">📁 Upload Photo</div>
                     <div className="text-xs opacity-70">Choose from device</div>
                   </button>
                 </div>
               )}
             </div>

            <div className="flex-1">
              <textarea 
                ref={inputRef}
                value={displayText} // Shows real-time transcript when listening
                onChange={(e) => !isListening && setInput(e.target.value)} // Only editable when not listening
                onKeyDown={handleKeyPress}
                placeholder={
                  isListening ? "🎤 Listening... (speak now)" 
                  : selectedImage ? `Image selected: ${selectedImage.name}. Add context...` 
                  : `Message ${currentPersona.name}...`
                }
                disabled={loading}
                className={`w-full bg-transparent text-white placeholder-gray-500 focus:outline-none resize-none min-h-[40px] max-h-[80px] font-medium pt-2 ${
                  isListening ? 'text-yellow-300' : ''
                }`}
                style={{ fontSize: `${zoomLevel / 100}rem` }}
                rows={1}
              />
            </div>
            
            <button 
              onClick={handleSend}
              disabled={loading || (!input.trim() && !selectedImage)}
              className={`
                px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-[0.1em] transition-all
                ${(input.trim() || selectedImage) && !loading
                  ? 'bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] text-white hover:shadow-lg hover:shadow-blue-500/20'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }
              `}
              style={{ fontSize: `${zoomLevel / 100 * 0.9}rem` }}
            >
              {loading ? 'Sending' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

