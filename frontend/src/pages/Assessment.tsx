
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Check, X } from 'lucide-react';

const questions = [
  "Do you use the same password for multiple accounts?",
  "Have you enabled 2-Factor Authentication on your email?",
  "Do you check URLs before clicking links in emails?",
  "Is your home Wi-Fi password longer than 12 characters?",
  "Do you update your phone software automatically?",
  "Do you have a backup of your important files?",
  "Do you share your location publicly on social media?",
  "Do you use a VPN on public Wi-Fi?",
  "Have you checked if your email has been breached?",
  "Do you lock your devices when you step away?"
];

export default function Assessment() {
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const navigate = useNavigate();

  const handleAnswer = (isYes) => {
    // Basic logic: Yes is good for Q2,3,4,5,6,8,9,10. No is good for Q1, 7.
    // Simplifying for demo: Just count progress.
    if (isYes) setScore(s => s + 10);
    
    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="flex justify-between text-sm text-slate-400 mb-2">
          <span>Security Assessment</span>
          <span>{current + 1} / {questions.length}</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full mb-8 overflow-hidden">
          <div 
            className="h-full bg-yellow-500 transition-all duration-300" 
            style={{ width: `${((current + 1) / questions.length) * 100}%` }}
          />
        </div>

        <h2 className="text-2xl font-bold text-white mb-8 leading-relaxed">
          {questions[current]}
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => handleAnswer(false)}
            className="p-6 bg-slate-800 rounded-xl hover:bg-red-900/30 border border-slate-700 hover:border-red-500 transition-all flex flex-col items-center gap-2"
          >
            <X size={32} className="text-red-400" />
            <span className="font-bold text-slate-200">NO</span>
          </button>
          <button 
            onClick={() => handleAnswer(true)}
            className="p-6 bg-slate-800 rounded-xl hover:bg-green-900/30 border border-slate-700 hover:border-green-500 transition-all flex flex-col items-center gap-2"
          >
            <Check size={32} className="text-green-400" />
            <span className="font-bold text-slate-200">YES</span>
          </button>
        </div>
      </div>
    </div>
  );
}
