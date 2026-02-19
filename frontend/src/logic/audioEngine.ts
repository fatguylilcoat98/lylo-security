import { useState, useRef } from 'react';

export const useAudioEngine = (apiUrl: string) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micSupported, setMicSupported] = useState(false);

  // Hardware state refs
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const shouldSendRef = useRef(false);
  const accumulatedRef = useRef<string>('');
  const inputTextRef = useRef<string>('');

  // --- TEXT TO SPEECH (TTS) ---
  const quickStopAllAudio = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const speakText = async (text: string, voiceId: string, onEnd?: () => void) => {
    quickStopAllAudio();
    setIsSpeaking(true);

    try {
      const formData = new FormData();
      formData.append('text', text);
      formData.append('voice', voiceId);
      
      const response = await fetch(`${apiUrl}/generate-audio`, { method: 'POST', body: formData });
      const data = await response.json();
      
      if (data.audio_b64) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio_b64}`);
        audio.onended = () => {
          setIsSpeaking(false);
          if (onEnd) onEnd();
        };
        await audio.play();
        return;
      }
    } catch (e) {
      // Fallback to browser TTS if backend fails
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => {
        setIsSpeaking(false);
        if (onEnd) onEnd();
      };
      window.speechSynthesis.speak(utterance);
    }
  };

  // --- SPEECH TO TEXT (STT) - THE BULLETPROOF MIC ---
  const initMic = (onResultCallback: (text: string) => void, onSendCallback: (text: string) => void) => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      // Android Echo Bug Fix: continuous MUST be false
      recognition.continuous = false; 
      recognition.interimResults = true; 
      recognition.lang = 'en-US';
      
      recognition.onresult = (event: any) => {
        let interim = '', final = '';
        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
          else interim += event.results[i][0].transcript;
        }
        
        // Master Buffer
        if (final) { accumulatedRef.current += final + ' '; }
        const fullText = (accumulatedRef.current + interim).replace(/\s+/g, ' ').trim();
        inputTextRef.current = fullText;
        onResultCallback(fullText); // Sends live text back to the UI
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed' || event.error === 'audio-capture') {
          setIsRecording(false);
          isRecordingRef.current = false;
          shouldSendRef.current = false;
        }
      };

      recognition.onend = () => {
        // If user clicked stop, it sends. If browser timed out, it instantly restarts to keep listening.
        if (isRecordingRef.current && !shouldSendRef.current) {
          setTimeout(() => { try { recognition.start(); } catch(e) {} }, 10);
        } else if (shouldSendRef.current) {
          shouldSendRef.current = false;
          if (inputTextRef.current.trim().length > 0) {
            onSendCallback(inputTextRef.current.trim());
          }
        }
      };
      
      recognitionRef.current = recognition;
      setMicSupported(true);
    }
  };

  const handleWalkieTalkieMic = () => {
    if (!micSupported) return alert('Mic not supported on this browser.');
    
    if (isRecording) {
      // User triggers Stop & Send
      isRecordingRef.current = false;
      setIsRecording(false);
      shouldSendRef.current = true; // Signals the onend function to send
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch(e) {} }
    } else {
      // User triggers Start
      quickStopAllAudio();
      setIsRecording(true);
      isRecordingRef.current = true;
      shouldSendRef.current = false;
      accumulatedRef.current = '';
      inputTextRef.current = '';
      if (recognitionRef.current) { try { recognitionRef.current.start(); } catch(e) {} }
    }
  };

  const clearMicBuffer = () => {
    accumulatedRef.current = '';
    inputTextRef.current = '';
  };

  return {
    isRecording,
    isSpeaking,
    micSupported,
    quickStopAllAudio,
    speakText,
    initMic,
    handleWalkieTalkieMic,
    clearMicBuffer,
    inputTextRef
  };
};
