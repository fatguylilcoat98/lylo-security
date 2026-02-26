/**
 * LYLO OS — chat/ui/BottomBar.tsx
 * The main input bar at the bottom of the chat.
 * Contains text input, image attach, voice hold-to-speak, and send button.
 */
import React, { useRef } from 'react';

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
  const fileRef = useRef<HTMLInputElement>(null);

  const placeholder = isRecording
    ? (lang === 'es' ? 'Escuchando...' : 'Listening...')
    : isSpeaking
      ? (lang === 'es' ? 'LYLO está hablando...' : 'LYLO is speaking...')
      : (lang === 'es' ? 'Escríbeme algo...' : 'Type something...');

  return (
    <div className="px-4 pb-6 pt-3 border-t border-white/5">

      {/* Image preview strip */}
      {imagePreview && (
        <div className="relative mb-2 inline-block">
          <img src={imagePreview} alt="preview" className="h-16 w-16 rounded-xl object-cover" />
          <button
            onClick={onImageClear}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center"
          >×</button>
        </div>
      )}

      <div className="flex items-end gap-2">

        {/* Image attach */}
        <button
          onClick={() => fileRef.current?.click()}
          className="shrink-0 w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:border-white/30 transition-all"
        >
          📎
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) { onImageSelect(f); e.target.value = ''; }
          }}
        />

        {/* Text input */}
        <textarea
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={isLoading || isRecording || isSpeaking}
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

        {/* Voice hold-to-speak */}
        <button
          onPointerDown={onVoiceStart}
          onPointerUp={onVoiceStop}
          onPointerLeave={onVoiceStop}
          disabled={isLoading || isSpeaking}
          className={`
            shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-lg
            transition-all duration-200 border
            ${isRecording
              ? 'bg-red-500/30 border-red-500 scale-110 shadow-lg shadow-red-500/30'
              : 'bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10'
            }
            disabled:opacity-30
          `}
        >
          {isRecording ? '🔴' : '🎤'}
        </button>

        {/* Send */}
        <button
          onClick={onSend}
          disabled={isLoading || (!input.trim() && !imagePreview) || isRecording}
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
          {isLoading ? (
            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : '➤'}
        </button>

      </div>
    </div>
  );
};
