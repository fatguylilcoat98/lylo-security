import React, { useRef, useState, useCallback } from 'react';

interface BottomBarProps {
  input:         string;
  isLoading:     boolean;
  isRecording:   boolean;
  isSpeaking:    boolean;
  imagePreview:  string | null;
  onInputChange: (val: string) => void;
  onSend:        () => void;
  onImageSelect: (file: File) => void;
  onImageClear:  () => void;
  onVoiceStart:  () => void;
  onVoiceStop:   () => void;
  onKeyDown:     (e: React.KeyboardEvent) => void;
  personaColor:  string;
  lang:          'en' | 'es';
}

export const BottomBar: React.FC<BottomBarProps> = ({
  input, isLoading, isSpeaking,
  imagePreview, onInputChange, onSend,
  onImageSelect, onImageClear,
  onVoiceStart, onVoiceStop, onKeyDown,
  personaColor, lang,
}) => {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef  = useRef<HTMLInputElement>(null);
  const [micActive, setMicActive] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const handleMicClick = useCallback(() => {
    if (micActive) {
      setMicActive(false);
      onVoiceStop();
      setTimeout(() => onSend(), 350);
    } else {
      setMicActive(true);
      onVoiceStart();
    }
  }, [micActive, onVoiceStart, onVoiceStop, onSend]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { onImageSelect(f); e.target.value = ''; }
  };

  const placeholder = micActive
    ? '🔴 Listening... tap SEND to send'
    : isSpeaking ? 'LYLO is speaking...' : 'Type something...';

  return (
    <div className="px-3 pb-4 pt-3 border-t flex-shrink-0" style={{ borderTopColor: personaColor + '22' }}>

      {/* Image preview */}
      {imagePreview && (
        <div className="relative mb-3 inline-block">
          <img src={imagePreview} alt="preview" className="h-20 w-20 rounded-xl object-cover border border-white/20" />
          <button onClick={onImageClear}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
            ×
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2 mb-3">

        {/* Camera */}
        <button onClick={() => cameraRef.current?.click()}
          className="shrink-0 w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-lg text-white/40 hover:text-white hover:border-white/30 transition-all">
          📷
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

        {/* Gallery */}
        <button onClick={() => galleryRef.current?.click()}
          className="shrink-0 w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-lg text-white/40 hover:text-white hover:border-white/30 transition-all">
          🖼️
        </button>
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

        {/* Text input — glows persona color on focus */}
        <textarea
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder={placeholder}
          disabled={isLoading || micActive || isSpeaking}
          rows={1}
          className="flex-1 resize-none rounded-2xl bg-white/5 text-white text-sm px-4 py-3 focus:outline-none disabled:opacity-50 transition-all min-h-[44px] max-h-[120px] border"
          style={{
            lineHeight: '1.5',
            borderColor: inputFocused ? personaColor + '88' : 'rgba(255,255,255,0.08)',
            boxShadow: inputFocused ? `0 0 12px ${personaColor}22` : 'none',
          }}
        />

        {/* Send */}
        <button onClick={onSend}
          disabled={isLoading || (!input.trim() && !imagePreview) || micActive}
          className="shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 disabled:opacity-30 text-white font-bold border"
          style={{ backgroundColor: personaColor + '25', borderColor: personaColor + '60' }}>
          {isLoading
            ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            : '➤'}
        </button>
      </div>

      {/* ── Big RECORD / SEND button ── */}
      <button
        onClick={handleMicClick}
        disabled={isLoading || isSpeaking}
        className={`w-full h-14 rounded-2xl flex items-center justify-center gap-3 font-black text-sm uppercase tracking-widest transition-all duration-200 border disabled:opacity-30 ${micActive ? 'animate-pulse' : 'hover:scale-[1.01]'}`}
        style={micActive ? {
          backgroundColor: '#FF000025',
          borderColor: '#FF4444',
          color: '#FF6666',
          boxShadow: '0 0 20px rgba(255,0,0,0.2)',
        } : {
          backgroundColor: personaColor + '18',
          borderColor: personaColor + '55',
          color: personaColor,
        }}
      >
        <span className="text-xl">{micActive ? '⏹' : '🎙'}</span>
        <span>{micActive ? 'TAP TO SEND' : 'RECORD'}</span>
        {micActive && (
          <span className="flex items-end gap-0.5 h-5">
            {[6,10,14,10,6].map((h, i) => (
              <span key={i} className="w-1 rounded-full animate-bounce"
                style={{ height: h, backgroundColor: '#FF6666', animationDelay: `${i * 80}ms` }} />
            ))}
          </span>
        )}
      </button>

      {/* Disclaimer */}
      <p className="text-center text-[10px] mt-2 leading-tight" style={{ color: 'rgba(255,255,255,0.15)' }}>
        LYLO can make mistakes. Always verify with a qualified professional.
      </p>
    </div>
  );
};
