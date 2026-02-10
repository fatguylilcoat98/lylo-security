import React from 'react';
import { UserStats } from '../lib/api';

interface UsageDisplayProps {
  userStats: UserStats | null;
  isLoading?: boolean;
}

export default function UsageDisplay({ userStats, isLoading }: UsageDisplayProps) {
  if (isLoading || !userStats) {
    return (
      <div className="bg-black/40 border border-white/10 rounded-xl p-4">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-4">
      <div>
        <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-2">
          Usage Today
        </h3>
        
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-300 text-xs">
            {userStats.usage.current} / {userStats.usage.limit} queries
          </span>
          <span className="text-[#3b82f6] font-bold text-xs">
            {Math.round(userStats.usage.percentage)}%
          </span>
        </div>
        
        <div className="bg-gray-800/50 rounded-full h-2 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] transition-all duration-1000"
            style={{ width: `${Math.min(100, userStats.usage.percentage)}%` }}
          />
        </div>
        
        <div className="mt-2 text-xs text-gray-400">
          Tier: <span className="text-[#3b82f6] font-bold">{userStats.tier.toUpperCase()}</span>
        </div>
      </div>

      <div className="pt-2 border-t border-white/5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Conversations Today:</span>
          <span className="text-white">{userStats.conversations_today}</span>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-gray-400">Total:</span>
          <span className="text-white">{userStats.total_conversations}</span>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-gray-400">Top Concern:</span>
          <span className="text-white">{userStats.learning_profile.top_concern}</span>
        </div>
      </div>
    </div>
  );
}
