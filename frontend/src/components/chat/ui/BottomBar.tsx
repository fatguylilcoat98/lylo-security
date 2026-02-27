/**
 * LYLO OS — chat/ui/BottomBar.tsx
 * - Walkie-talkie mic: click to start, click again to send
 * - Camera button: opens device camera to capture photo
 * - Gallery button: pick from photo library
 * - Larger mic button
 * - AI disclaimer
 */
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
  input, isLoading, isRecording, isSpeaking,
  imagePreview, onInputChange, onSend,
  onImageSelect, onImageClear,
  onVoiceStart, onVoiceStop, onKeyDown,
  personaColor, lang,
}) => {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef  = useRef<HTMLInputElement>(null);
  const [micActive, setMicActive] = useState(false);

  // Walkie-talkie: click to toggle. Second click = stop + send.
  const handleMicClick = useCallback(() => {
    if (micActive) {
      // Stop recording and send
      setMicActive(false);
      onVoiceStop();
    } else {
      // Start recording
      setMicActive(true);
      onVoiceStart();
    }
  }, [micActive, onVoiceStart, onVoiceStop]);

  const placeholder = micActive
    ? (lang === 'es' ? '🔴 Escuchando... toca de nuevo para enviar' : '🔴 Listening... tap again to send')
    : isSpeaking
      ? (lang === 'es' ? 'LYLO está hablando...' : 'LYLO is speaking...')
      : (lang === 'es' ? 'Escríbeme algo...' : 'Type something...');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { onImageSelect(f); e.target.value = ''; }
  };

  return (
    <div className="px-3 pb-4 pt-2 border-t border-white/5">

      {/* Image preview */}
      {imagePreview && (
        <div className="relative mb-2 inline-block">
          <img src={imagePreview} alt="preview" className="h-16 w-16 rounded-xl object-cover border border-white/20" />
          <button
            onClick={onImageClear}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow"
          >×</button>
        </div>
      )}

      {/* Main input row */}
      <div className="flex items-end gap-2">

        {/* Camera capture button */}
        <button
          onClick={() => cameraRef.current?.click()}
          title="Take a photo"
          className="shrink-0 w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:border-white/30 transition-all text-lg"
        >
          📷
        </button>
        {/* Camera input — capture="environment" opens rear camera */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Gallery / file picker */}
        <button
          onClick={() => galleryRef.current?.click()}
          title="Upload from gallery"
          className="shrink-0 w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:border-white/30 transition-all text-lg"
        >
          🖼️
        </button>
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Text input */}
        <textarea
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={isLoading || micActive || isSpeaking}
          rows={1}
          className="
            flex-1 resize-none rounded-2xl bg-white/5 border border-white/10
            text-white placeholder-white/30 text-sm px-4 py-3
            focus:outline-none focus:border-white/30
            disabled:opacity-50 transition-all
            min-h-[44px] max-h-[120px]
          "
          style={{ lineHeight: '1.5' }}
        />

        {/* Walkie-talkie mic — bigger, toggle on/off */}
        <button
          onClick={handleMicClick}
          disabled={isLoading || isSpeaking}
          title={micActive ? 'Tap to send' : 'Tap to speak'}
          className={`
            shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl
            transition-all duration-200 border shadow-lg
            ${micActive
              ? 'bg-red-500/40 border-red-400 scale-110 shadow-red-500/40 animate-pulse'
              : 'bg-white/5 border-white/20 hover:border-white/40 hover:bg-white/10'
            }
            disabled:opacity-30
          `}
        >
          {micActive ? '⏹️' : '🎙️'}
        </button>

        {/* Send */}
        <button
          onClick={onSend}
          disabled={isLoading || (!input.trim() && !imagePreview) || micActive}
          className="
            shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center
            transition-all duration-200 disabled:opacity-30
          "
          style={{
            backgroundColor: personaColor + '33',
            borderColor:     personaColor + '66',
            border:          '1px solid',
          }}
        >
          {isLoading
            ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            : '➤'}
        </button>

      </div>

      {/* AI disclaimer */}
      <p className="text-center text-white/20 text-[10px] mt-2 leading-tight">
        {lang === 'es'
          ? 'LYLO puede cometer errores. Verifica información importante con un profesional.'
          : 'LYLO can make mistakes. Always verify important information with a qualified professional.'}
      </p>

    </div>
  );
};
