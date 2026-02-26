/**
 * LYLO OS — chat/ui/EmergencyOverlay.tsx
 * Full-screen emergency protocol overlay.
 * Shown when /chat returns an emergency_protocol object.
 */
import React from 'react';

interface EmergencyStep {
  step: number;
  action: string;
  detail?: string;
}

interface EmergencyProtocol {
  type:     string;
  title:    string;
  message:  string;
  steps:    EmergencyStep[];
  hotline?: string;
  hotline_label?: string;
}

interface EmergencyOverlayProps {
  protocol: EmergencyProtocol;
  onDismiss: () => void;
}

export const EmergencyOverlay: React.FC<EmergencyOverlayProps> = ({
  protocol, onDismiss,
}) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="w-full max-w-sm rounded-3xl border border-red-500/60 bg-[#0a0000] p-6 shadow-2xl shadow-red-500/20">

        {/* Header */}
        <div className="text-center mb-5">
          <div className="text-5xl mb-2">🚨</div>
          <h2 className="text-red-400 font-bold text-xl tracking-wide">{protocol.title}</h2>
          <p className="text-white/70 text-sm mt-2">{protocol.message}</p>
        </div>

        {/* Steps */}
        {protocol.steps?.length > 0 && (
          <div className="space-y-3 mb-5">
            {protocol.steps.map((s, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="shrink-0 w-7 h-7 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 text-sm font-bold">
                  {s.step}
                </div>
                <div>
                  <div className="text-white text-sm font-medium">{s.action}</div>
                  {s.detail && <div className="text-white/50 text-xs mt-0.5">{s.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Hotline */}
        {protocol.hotline && (
          <a
            href={`tel:${protocol.hotline}`}
            className="block w-full text-center py-3 rounded-2xl bg-red-500 text-white font-bold text-lg mb-3 hover:bg-red-400 transition-colors"
          >
            📞 Call {protocol.hotline_label ?? protocol.hotline}
          </a>
        )}

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="w-full text-center py-2 text-white/40 text-sm hover:text-white/70 transition-colors"
        >
          I'm safe — dismiss
        </button>
      </div>
    </div>
  );
};
