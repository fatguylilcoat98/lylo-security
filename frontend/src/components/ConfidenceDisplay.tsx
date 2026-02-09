import React, { useState, useEffect } from 'react';

// Dynamic icon imports
const importIcons = async () => {
  try {
    const icons = await import('lucide-react');
    return icons;
  } catch {
    return null;
  }
};

interface ConfidenceDisplayProps {
  confidence: number;
  explanation?: string;
  scamDetected: boolean;
  indicators?: string[];
  detailedAnalysis?: string;
}

export default function ConfidenceDisplay({ 
  confidence, 
  explanation, 
  scamDetected, 
  indicators = [],
  detailedAnalysis 
}: ConfidenceDisplayProps) {
  const [icons, setIcons] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    importIcons().then(setIcons);
  }, []);

  if (!icons) return null;

  const getConfidenceColor = (conf: number) => {
    if (conf >= 95) return 'text-green-400';
    if (conf >= 80) return 'text-yellow-400';
    if (conf >= 60) return 'text-orange-400';
    return 'text-red-400';
  };

  const getConfidenceIcon = (conf: number) => {
    if (conf >= 95) return icons.CheckCircle;
    if (conf >= 80) return icons.AlertTriangle;
    if (conf >= 60) return icons.HelpCircle;
    return icons.XCircle;
  };

  const ConfidenceIcon = getConfidenceIcon(confidence);

  return (
    <div className={`
      rounded-2xl p-4 border backdrop-blur-xl
      ${scamDetected 
        ? 'bg-red-900/30 border-red-500/50 shadow-red-500/10' 
        : 'bg-black/40 border-white/10'
      }
    `}>
      
      {/* Main Confidence Display */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <ConfidenceIcon className={`w-6 h-6 ${getConfidenceColor(confidence)}`} />
          <div>
            <div className="text-white font-semibold">
              {scamDetected ? '⚠️ Potential Scam Detected' : 'Analysis Complete'}
            </div>
            <div className={`text-sm ${getConfidenceColor(confidence)}`}>
              {confidence}% Confidence
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          {showDetails ? <icons.ChevronUp className="w-5 h-5" /> : <icons.Info className="w-5 h-5" />}
        </button>
      </div>

      {/* Confidence Bar */}
      <div className="mb-3">
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              confidence >= 95 ? 'bg-green-500' :
              confidence >= 80 ? 'bg-yellow-500' :
              confidence >= 60 ? 'bg-orange-500' :
              'bg-red-500'
            }`}
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>

      {/* Quick Explanation */}
      {explanation && (
        <div className="text-sm text-gray-300 mb-3">
          {explanation}
        </div>
      )}

      {/* Expanded Details */}
      {showDetails && (
        <div className="space-y-3 pt-3 border-t border-white/20 animate-in slide-in-from-top duration-200">
          
          {/* Detailed Analysis */}
          {detailedAnalysis && (
            <div>
              <div className="text-sm font-medium text-white mb-2">Analysis Details:</div>
              <div className="text-sm text-gray-300 bg-black/30 rounded-lg p-3">
                {detailedAnalysis}
              </div>
            </div>
          )}

          {/* Scam Indicators */}
          {indicators.length > 0 && (
            <div>
              <div className="text-sm font-medium text-white mb-2">
                Detected Indicators ({indicators.length}):
              </div>
              <div className="space-y-1">
                {indicators.map((indicator, index) => (
                  <div 
                    key={index}
                    className={`text-xs px-2 py-1 rounded-lg ${
                      indicator.includes('HIGH RISK') ? 'bg-red-500/20 text-red-300' :
                      indicator.includes('MEDIUM RISK') ? 'bg-yellow-500/20 text-yellow-300' :
                      'bg-gray-500/20 text-gray-300'
                    }`}
                  >
                    {indicator.replace(/^(HIGH RISK|MEDIUM RISK|LOW RISK): /, '')}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className="bg-white/5 rounded-lg p-3">
            <div className="text-sm font-medium text-white mb-1">Recommendation:</div>
            <div className="text-sm text-gray-300">
              {confidence >= 95 ? "I'm very confident in this analysis." :
               confidence >= 80 ? "Consider getting a second opinion if this is important." :
               confidence >= 60 ? "I recommend verifying this with someone you trust." :
               "Definitely get help from a trusted person or official source."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
