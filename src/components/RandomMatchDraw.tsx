import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Swords } from 'lucide-react';
import { Match, Team, Config } from '../types';
import { doc, writeBatch, serverTimestamp, db } from '../supabase_mock';

interface RandomMatchDrawProps {
  myTeam: Team;
  allTeams: Team[];
  myMatches: Match[];
  config: Config;
}

export const RandomMatchDraw: React.FC<RandomMatchDrawProps> = ({ myTeam, allTeams, myMatches, config }) => {
  const [drawing, setDrawing] = useState(false);

  // Filter approved opponents
  const approvedOpponents = allTeams.filter(t => t.id !== myTeam.id && t.status === 'approved');

  // Completed matches count (for 10 matches limit)
  const completedMatchesCount = myMatches.filter(m => m.status === 'finished').length;
  const canDrawMore = completedMatchesCount < 10;

  const handleDrawOpponent = async () => {
    if (approvedOpponents.length === 0) return;
    setDrawing(true);
    
    // Simulate drawing animation
    setTimeout(async () => {
      const opponent = approvedOpponents[Math.floor(Math.random() * approvedOpponents.length)];
      const challengeLevels = ['easy', 'moderate', 'hard', 'bonus'];
      const myChallenge = challengeLevels[Math.floor(Math.random() * challengeLevels.length)] as 'easy' | 'moderate' | 'hard' | 'bonus';
      const opponentChallenge = challengeLevels[Math.floor(Math.random() * challengeLevels.length)] as 'easy' | 'moderate' | 'hard' | 'bonus';

      const isHome = Math.random() > 0.5;

      const newMatch: Partial<Match> = {
        id: `random_${Date.now()}_${Math.random().toString(36).substring(7)}`, 
        matchNumber: Date.now(),
        homeTeamId: isHome ? myTeam.id : opponent.id,
        awayTeamId: isHome ? opponent.id : myTeam.id,
        status: 'scheduled',
        type: 'qualifier',
        date: new Date().toISOString(),
        challengeLevelHome: isHome ? myChallenge : opponentChallenge,
        challengeLevelAway: isHome ? opponentChallenge : myChallenge,
      };

      try {
        const batch = writeBatch(db);
        const matchRef = doc(db, 'matches', newMatch.id || '');
        batch.set(matchRef, newMatch as any);
        await batch.commit();
        setDrawnMatch(newMatch);
      } catch (err) {
        console.error("Failed to save drawn match", err);
      } finally {
        setDrawing(false);
      }
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <h3 className="text-xl font-display font-bold text-white">All In Random Draw</h3>
         <span className="px-3 py-1 bg-white/10 rounded-lg text-xs font-bold text-white/60">
           {completedMatchesCount} / 10 Matches Played
         </span>
      </div>

      {!canDrawMore && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-6 text-center">
          <p className="text-green-400 font-bold mb-2">Maximum Matches Reached</p>
          <p className="text-white/50 text-sm">You have played 10 matches in this random mode.</p>
        </div>
      )}

      {canDrawMore && (
        <div className="bg-[#3B82F6]/10 border border-[#3B82F6]/20 rounded-2xl p-8 text-center">
           <Swords className="w-12 h-12 text-[#3B82F6] mx-auto mb-4" />
           <h4 className="text-lg font-bold text-white mb-2">Draw Your Next Opponent</h4>
           <p className="text-white/50 text-sm mb-6 max-w-sm mx-auto">
             Draw a random approved team to face. A random challenge will automatically be generated for both players.
           </p>
           
           <button
             onClick={handleDrawOpponent}
             disabled={drawing}
             className="px-8 py-4 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-2xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
           >
             {drawing ? (
               <><RefreshCw className="w-5 h-5 animate-spin" /> Drawing...</>
             ) : (
               <><RefreshCw className="w-5 h-5" /> Draw Now</>
             )}
           </button>
        </div>
      )}

      {/* Challenges explanation or history could go here */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
         <h4 className="font-bold text-white text-sm mb-4">Challenges Guide</h4>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {['easy', 'moderate', 'hard', 'bonus'].map((level, i) => (
             <div key={level} className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
                <p className="text-xs font-bold text-white uppercase mb-1">{level}</p>
                <p className="text-[10px] text-white/40">{i === 0 ? '+1 Pt' : i === 1 ? '+2 Pts' : i === 2 ? '+3 Pts' : '+5 Pts'}</p>
             </div>
           ))}
         </div>
      </div>
    </div>
  );
};
