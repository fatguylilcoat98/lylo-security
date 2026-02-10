import React, { useState } from 'react';

interface QuizProps {
  userEmail: string;
  onComplete: () => void;
}

export default function QuickQuiz({ userEmail, onComplete }: QuizProps) {
  const [answers, setAnswers] = useState({
    q1: '',
    q2: '',
    q3: '',
    q4: '',
    q5: ''
  });
  const [loading, setLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(1);

  const questions = [
    {
      id: 'q1',
      text: 'What worries you most when using the internet?',
      options: [
        'Getting scammed or tricked',
        'Identity theft or fraud',
        'Viruses or malware',
        'Privacy and personal information',
        'Online shopping safety'
      ]
    },
    {
      id: 'q2', 
      text: 'How do you like information explained to you?',
      options: [
        'Quick and simple answers',
        'Detailed explanations with examples',
        'Step by step instructions',
        'Just tell me what to do',
        'Let me ask follow-up questions'
      ]
    },
    {
      id: 'q3',
      text: 'What devices do you use most?',
      options: [
        'Smartphone or iPhone',
        'Computer or laptop',
        'Tablet or iPad', 
        'All of the above',
        'I need help with all devices'
      ]
    },
    {
      id: 'q4',
      text: 'What topics interest you most?',
      options: [
        'Family and staying connected',
        'Health and medical information',
        'Money and retirement planning',
        'Shopping and deals',
        'Technology and learning new things'
      ]
    },
    {
      id: 'q5',
      text: 'Do you need any help seeing or hearing?',
      options: [
        'I need larger text',
        'I need things read out loud',
        'I need both larger text and audio',
        'I use a screen reader',
        'I can see and hear fine'
      ]
    }
  ];

  const handleAnswer = (answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [`q${currentQuestion}`]: answer
    }));

    if (currentQuestion < 5) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('user_email', userEmail);
      formData.append('q1_primary_concern', answers.q1);
      formData.append('q2_communication', answers.q2);
      formData.append('q3_devices', answers.q3);
      formData.append('q4_interests', answers.q4);
      formData.append('q5_accessibility', answers.q5);

      const response = await fetch('https://lylo-backend.onrender.com/quiz', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        onComplete();
      } else {
        alert('There was a problem saving your answers. Please try again.');
      }
    } catch (error) {
      alert('Connection error. Please check your internet and try again.');
    } finally {
      setLoading(false);
    }
  };

  const currentQ = questions[currentQuestion - 1];
  const isLastQuestion = currentQuestion === 5;
  const canSubmit = currentQuestion === 5 && answers.q5;

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-white font-black text-xl">L</span>
          </div>
          <h1 className="text-3xl font-black text-white uppercase tracking-[0.3em] mb-3">
            Quick Setup
          </h1>
          <p className="text-gray-400 text-lg">
            Help LYLO learn how to best assist you
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Question {currentQuestion} of 5</span>
            <span>{Math.round((currentQuestion / 5) * 100)}% Complete</span>
          </div>
          <div className="bg-gray-800 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] h-2 rounded-full transition-all duration-500"
              style={{ width: `${(currentQuestion / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 mb-8">
          <h2 className="text-xl font-bold text-white mb-6 leading-relaxed">
            {currentQ.text}
          </h2>

          <div className="space-y-4">
            {currentQ.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswer(option)}
                disabled={loading}
                className={`
                  w-full text-left p-4 rounded-xl border transition-all duration-200
                  ${answers[`q${currentQuestion}` as keyof typeof answers] === option
                    ? 'bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] border-[#3b82f6] text-white'
                    : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10 hover:border-[#3b82f6]/50'
                  }
                  disabled:opacity-50 disabled:cursor-not-allowed
                  text-base font-medium
                `}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => setCurrentQuestion(Math.max(1, currentQuestion - 1))}
            disabled={currentQuestion === 1 || loading}
            className="px-6 py-3 text-gray-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:text-white transition-colors"
          >
            Previous
          </button>

          {canSubmit ? (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-8 py-4 bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] text-white font-bold rounded-xl hover:shadow-lg disabled:opacity-50 transition-all"
            >
              {loading ? 'Saving...' : 'Complete Setup'}
            </button>
          ) : (
            <button
              onClick={() => setCurrentQuestion(currentQuestion + 1)}
              disabled={!answers[`q${currentQuestion}` as keyof typeof answers] || loading}
              className="px-8 py-4 bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] text-white font-bold rounded-xl hover:shadow-lg disabled:opacity-50 transition-all"
            >
              Next Question
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
