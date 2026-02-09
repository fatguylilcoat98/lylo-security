import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Assessment() {
  const [step, setStep] = useState(1);
  const [techLevel, setTechLevel] = useState('');
  const [personality, setPersonality] = useState('');
  const [hardware, setHardware] = useState<string[]>([]);
  const [finances, setFinances] = useState<string[]>([]);
  const navigate = useNavigate();

  const handleHardwareToggle = (item: string) => {
    setHardware(prev => 
      prev.includes(item) 
        ? prev.filter(h => h !== item)
        : [...prev, item]
    );
  };

  const handleFinancesToggle = (item: string) => {
    setFinances(prev => 
      prev.includes(item) 
        ? prev.filter(f => f !== item)
        : [...prev, item]
    );
  };

  const completeAssessment = () => {
    // Save all data to localStorage
    localStorage.setItem('lylo_tech_level', techLevel);
    localStorage.setItem('lylo_personality', personality);
    localStorage.setItem('lylo_calibration_hardware', hardware.join(', '));
    localStorage.setItem('lylo_calibration_finances', finances.join(', '));
    localStorage.setItem('lylo_assessment_complete', 'true');
    
    // Navigate to dashboard
    navigate('/dashboard');
  };

  const forceStart = () => {
    // Set defaults and skip assessment
    localStorage.setItem('lylo_calibration_hardware', 'iPhone, PC');
    localStorage.setItem('lylo_calibration_finances', 'PayPal, Bank');
    localStorage.setItem('lylo_tech_level', 'average');
    localStorage.setItem('lylo_personality', 'protective');
    localStorage.setItem('lylo_assessment_complete', 'true');
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 font-sans">
      
      {/* Header */}
      <div className="mb-8 text-center animate-pulse">
        <div className="text-6xl mb-4">🛡️</div>
        <h1 className="text-3xl font-black italic uppercase tracking-tighter text-blue-500 mb-2">LYLO CALIBRATION</h1>
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Step {step} of 4</p>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-md mb-8">
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 mb-6">
        
        {step === 1 && (
          <div className="text-center">
            <div className="text-4xl mb-4">🧠</div>
            <h2 className="text-xl font-bold mb-6">Tech Experience Level</h2>
            <div className="space-y-3">
              {[
                { value: 'beginner', label: 'Beginner - I need simple explanations' },
                { value: 'average', label: 'Average - I know the basics' },
                { value: 'advanced', label: 'Advanced - I build my own PCs' }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setTechLevel(option.value)}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    techLevel === option.value 
                      ? 'bg-blue-600 border-blue-400' 
                      : 'bg-[#111] hover:bg-[#1a1a1a] border-white/10'
                  } border`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="text-center">
            <div className="text-4xl mb-4">🎭</div>
            <h2 className="text-xl font-bold mb-6">AI Personality</h2>
            <div className="space-y-3">
              {[
                { value: 'protective', label: 'Protective - Warn me about everything' },
                { value: 'balanced', label: 'Balanced - Alert but not paranoid' },
                { value: 'relaxed', label: 'Relaxed - Only major threats' }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setPersonality(option.value)}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    personality === option.value 
                      ? 'bg-blue-600 border-blue-400' 
                      : 'bg-[#111] hover:bg-[#1a1a1a] border-white/10'
                  } border`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center">
            <div className="text-4xl mb-4">📱</div>
            <h2 className="text-xl font-bold mb-6">Your Devices</h2>
            <p className="text-gray-400 text-sm mb-4">Select all that apply:</p>
            <div className="grid grid-cols-2 gap-3">
              {['iPhone', 'Android', 'PC', 'Mac', 'iPad', 'Chromebook'].map(device => (
                <button
                  key={device}
                  onClick={() => handleHardwareToggle(device)}
                  className={`p-3 rounded-xl text-sm transition-all ${
                    hardware.includes(device) 
                      ? 'bg-blue-600 border-blue-400' 
                      : 'bg-[#111] hover:bg-[#1a1a1a] border-white/10'
                  } border`}
                >
                  {device}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="text-center">
            <div className="text-4xl mb-4">💳</div>
            <h2 className="text-xl font-bold mb-6">Financial Accounts</h2>
            <p className="text-gray-400 text-sm mb-4">What do you use? (For scam protection)</p>
            <div className="grid grid-cols-2 gap-3">
              {['PayPal', 'Venmo', 'Cash App', 'Bank Online', 'Credit Cards', 'Crypto'].map(account => (
                <button
                  key={account}
                  onClick={() => handleFinancesToggle(account)}
                  className={`p-3 rounded-xl text-sm transition-all ${
                    finances.includes(account) 
                      ? 'bg-blue-600 border-blue-400' 
                      : 'bg-[#111] hover:bg-[#1a1a1a] border-white/10'
                  } border`}
                >
                  {account}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-4 w-full max-w-lg">
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 rounded-2xl transition-all"
          >
            BACK
          </button>
        )}
        
        {step < 4 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={
              (step === 1 && !techLevel) || 
              (step === 2 && !personality) ||
              (step === 3 && hardware.length === 0)
            }
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all"
          >
            NEXT
          </button>
        ) : (
          <button
            onClick={completeAssessment}
            disabled={finances.length === 0}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all"
          >
            ACTIVATE LYLO
          </button>
        )}
      </div>

      {/* Skip Button */}
      <button
        onClick={forceStart}
        className="mt-6 text-gray-500 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors"
      >
        Skip Setup (Demo Mode)
      </button>
    </div>
  );
}
