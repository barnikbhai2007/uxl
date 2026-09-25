import React, { useState } from 'react';
import { PREMIER_LEAGUE_TEAMS } from '../constants';

export const PremierLeagueHeaderBanner: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'top'>('all');

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-[#240029] via-[#38003c] to-[#1a001e] border-b border-[#00ff85]/30 text-white py-2.5 px-4 shadow-xl">
      {/* Subtle geometric pattern matching official Premier League broadcast branding */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, #00ff85 1.5px, transparent 1.5px)`,
          backgroundSize: '20px 20px'
        }}
      />

      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 relative z-10 text-xs font-sans">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Official PL Lion Emblem */}
          <div className="flex items-center gap-2 bg-[#00ff85]/10 border border-[#00ff85]/40 px-2.5 py-1 rounded-lg">
            <svg 
              className="w-5 h-5 text-[#00ff85]" 
              viewBox="0 0 24 24" 
              fill="currentColor"
            >
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            <span className="font-black text-[#00ff85] tracking-wider text-xs uppercase">
              Premier League
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-white/80">
            <span className="text-white/40">·</span>
            <span className="font-semibold text-white/90 text-xs uppercase tracking-wider">
              Season 2025/26 Matchday
            </span>
            <span className="text-white/40">·</span>
            <span className="text-[11px] font-medium text-[#00ff85]">
              20 Official Clubs
            </span>
          </div>
        </div>

        {/* Mini Club Crests Ticker */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-md scrollbar-none">
          {PREMIER_LEAGUE_TEAMS.map((team) => (
            <div 
              key={team.name}
              title={team.name}
              className="shrink-0 w-6 h-6 rounded-md bg-white/5 hover:bg-white/15 border border-white/10 hover:border-[#00ff85]/60 flex items-center justify-center p-0.5 transition-all cursor-pointer group"
            >
              <img 
                src={team.logoUrl} 
                alt={team.name} 
                className="w-full h-full object-contain filter group-hover:scale-110 transition-transform" 
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const PremierLeagueLogo: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} title="Premier League Lion">
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-[#00ff85] drop-shadow-[0_0_10px_rgba(0,255,133,0.5)]">
        {/* Stylized Premier League Crown & Lion Silhouette */}
        <path 
          d="M50 10 L62 30 L85 24 L74 48 L92 64 L68 70 L50 92 L32 70 L8 64 L26 48 L15 24 L38 30 Z" 
          fill="currentColor" 
        />
        <circle cx="50" cy="50" r="16" fill="#38003c" />
        <circle cx="50" cy="50" r="10" fill="#00ff85" />
      </svg>
    </div>
  );
};
