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

  const handleMicClick = useCallback(() => {
    if (micActive) {
      setMicActive(false);
      onVoiceStop();
      // small delay so transcript lands before send
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
    ? (lang === 'es' ? '🔴 Escuchando...' : '🔴 Listening...')
    : isSpeaking
      ? (lang === 'es' ? 'LYLO está hablando...' : 'LYLO is speaking...')
      : (lang === 'es' ? 'Escríbeme algo...' : 'Type something...');

  return (
    <div className="px-3 pb-4 pt-3 border-t border-white/5 bg-[#080808]">

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

      {/* Text + send row */}
      <div className="flex items-end gap-2 mb-3">

        {/* Camera */}
        <button onClick={() => cameraRef.current?.click()} title="Take photo"
          className="shrink-0 w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-lg text-white/50 hover:text-white hover:border-white/30 transition-all">
          📷
        </button>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

        {/* Gallery */}
        <button onClick={() => galleryRef.current?.click()} title="Upload photo"
          className="shrink-0 w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-lg text-white/50 hover:text-white hover:border-white/30 transition-all">
          🖼️
        </button>
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

        {/* Text input */}
        <textarea
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={isLoading || micActive || isSpeaking}
          rows={1}
          className="flex-1 resize-none rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm px-4 py-3 focus:outline-none focus:border-white/30 disabled:opacity-50 transition-all min-h-[44px] max-h-[120px]"
          style={{ lineHeight: '1.5' }}
        />

        {/* Send */}
        <button
          onClick={onSend}
          disabled={isLoading || (!input.trim() && !imagePreview) || micActive}
          className="shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 disabled:opacity-30 text-white"
          style={{ backgroundColor: personaColor + '33', border: `1px solid ${personaColor}66` }}
        >
          {isLoading
            ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            : '➤'}
        </button>
      </div>

      {/* ── Big mic button ── */}
      <button
        onClick={handleMicClick}
        disabled={isLoading || isSpeaking}
        className={`
          w-full h-14 rounded-2xl flex items-center justify-center gap-3
          font-black text-sm uppercase tracking-widest
          transition-all duration-200 border
          disabled:opacity-30
          ${micActive
            ? 'animate-pulse scale-[1.02] shadow-lg'
            : 'hover:scale-[1.01]'
          }
        `}
        style={micActive ? {
          backgroundColor: '#FF000033',
          borderColor: '#FF4444',
          color: '#FF6666',
          boxShadow: '0 0 24px rgba(255,0,0,0.25)',
        } : {
          backgroundColor: personaColor + '15',
          borderColor: personaColor + '50',
          color: personaColor,
        }}
      >
        {/* Mic icon */}
        <span className="text-xl">{micActive ? '⏹' : '🎙'}</span>
        {/* Label */}
        <span>{micActive ? 'TAP TO SEND' : 'RECORD'}</span>
        {/* Pulse rings when active */}
        {micActive && (
          <span className="flex gap-0.5">
            {[0,1,2,3].map(i => (
              <span key={i} className="w-1 bg-red-400 rounded-full animate-bounce"
                style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 100}ms` }} />
            ))}
          </span>
        )}
      </button>

      {/* Disclaimer */}
      <p className="text-center text-white/20 text-[10px] mt-2 leading-tight">
        {lang === 'es'
          ? 'LYLO puede cometer errores. Verifica con un profesional.'
          : 'LYLO can make mistakes. Always verify with a qualified professional.'}
      </p>
    </div>
  );
};
