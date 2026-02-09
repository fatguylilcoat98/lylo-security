import React, { useState, useEffect } from 'react';
import { getUserStats, UserStats } from '../lib/api';

// Dynamic icon imports
const importIcons = async () => {
  try {
    const icons = await import('lucide-react');
    return icons;
  } catch {
    return null;
  }
};

interface UsageDisplayProps {
  userEmail: string;
  currentTier: string;
}

export default function UsageDisplay({ userEmail, currentTier }: UsageDisplayProps) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [icons, setIcons] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    importIcons().then(setIcons);
  }, []);

  useEffect(() => {
    if (userEmail) {
      getUserStats(userEmail).then(setStats);
    }
  }, [userEmail]);

  if (!stats || !icons) return null;

  const { usage, learning_profile } = stats;
  const remainingToday = getTierLimit(currentTier) - usage.messages_today;
  const usagePercentage = (usage.messages_today / getTierLimit(currentTier)) * 100;

  function getTierLimit(tier: string): number {
    const limits = { free: 5, pro: 50, elite: 99999 };
    return limits[tier as keyof typeof limits] || 5;
  }

  function getTierColor(tier: string): string {
    const colors = { 
      free: 'text-gray-400', 
      pro: 'text-blue-400', 
      elite: 'text-yellow-400' 
    };
    return colors[tier as keyof typeof colors] || 'text-gray-400';
  }

  return (
    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-4">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <icons.Activity className="w-5 h-5 text-cyan-400" />
          <span className="text-white font-semibold">Usage Today</span>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          {showDetails ? <icons.ChevronUp className="w-5 h-5" /> : <icons.ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Usage Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-300">
            {usage.messages_today} / {getTierLimit(currentTier)} messages
          </span>
          <span className={`font-medium ${getTierColor(currentTier)}`}>
            {currentTier.toUpperCase()}
          </span>
        </div>
        
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${
              usagePercentage > 90 ? 'bg-red-500' :
              usagePercentage > 70 ? 'bg-yellow-500' :
              'bg-cyan-500'
            }`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          />
        </div>
        
        <div className="text-xs text-gray-400">
          {remainingToday > 0 
            ? `${remainingToday} messages remaining today`
            : currentTier === 'free' 
              ? 'Daily limit reached - upgrade for more!'
              : 'Over limit - overage charges apply'
          }
        </div>
      </div>

      {/* Expanded Details */}
      {showDetails && (
        <div className="space-y-3 pt-3 border-t border-white/10 animate-in slide-in-from-top duration-200">
          
          {/* This Month Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-xs text-gray-400 mb-1">This Month</div>
              <div className="text-lg font-bold text-white">{usage.messages_this_month}</div>
              <div className="text-xs text-gray-400">messages</div>
            </div>
            
            {usage.overages_this_month > 0 && (
              <div className="bg-yellow-500/10 rounded-xl p-3">
                <div className="text-xs text-yellow-400 mb-1">Overages</div>
                <div className="text-lg font-bold text-yellow-400">${usage.total_cost_this_month.toFixed(2)}</div>
                <div className="text-xs text-yellow-300">{usage.overages_this_month} extra</div>
              </div>
            )}
          </div>

          {/* Learning Progress */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <icons.Brain className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-white">AI Learning Progress</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Tech Level:</span>
                <span className="text-white capitalize">{learning_profile.tech_level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Style:</span>
                <span className="text-white capitalize">{learning_profile.communication_style}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Conversations:</span>
                <span className="text-white">{learning_profile.total_conversations}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Interests:</span>
                <span className="text-white">{learning_profile.interests.length}</span>
              </div>
            </div>
          </div>

          {/* Upgrade CTA */}
          {currentTier === 'free' && remainingToday <= 1 && (
            <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <icons.Zap className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-400">Upgrade to Pro</span>
              </div>
              <div className="text-xs text-gray-300 mb-2">
                Get 50 messages/day + voice mode + image analysis
              </div>
              <button className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg text-white transition-colors">
                Upgrade for $9.99/month
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
