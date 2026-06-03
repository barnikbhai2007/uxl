import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, getDocs, writeBatch, db } from '../supabase_mock';
import { Registration, Config, Team } from '../types';
import { WORLD_CUP_TEAMS } from '../constants';

import { Match, BracketMatch } from '../types';
import DrawBracketManager from './DrawBracketManager';
import { Save, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

function WildcardsAdminTab({ config, teams, handleUpdateConfig }: { config: Config, teams: Team[], handleUpdateConfig: (config: Config) => Promise<void> }) {
  const [wildcards, setWildcards] = useState<{ teamId: string, reason: string }[]>(config.wildcardsSelected || []);
  const [autoQualifiedSelected, setAutoQualifiedSelected] = useState<string[]>(config.autoQualifiedSelected || []);
  const [groupOfDeath, setGroupOfDeath] = useState(config.groupOfDeath || "");
  const [easiestGroup, setEasiestGroup] = useState(config.easiestGroup || "");

  const handleAdd = () => {
    setWildcards([...wildcards, { teamId: '', reason: 'Outstanding performance in a highly competitive group.' }]);
  };

  const handleAddAutoQualified = () => {
    setAutoQualifiedSelected([...autoQualifiedSelected, '']);
  };

  const handleRemoveAutoQualified = (index: number) => {
    setAutoQualifiedSelected(autoQualifiedSelected.filter((_, i) => i !== index));
  };

  const handleAutoQualifiedChange = (index: number, value: string) => {
    const updated = [...autoQualifiedSelected];
    updated[index] = value;
    setAutoQualifiedSelected(updated);
  };

  const handleRemove = (index: number) => {
    setWildcards(wildcards.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...wildcards];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    setWildcards(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index === wildcards.length - 1) return;
    const updated = [...wildcards];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    setWildcards(updated);
  };

  const handleChange = (index: number, field: 'teamId' | 'reason', value: string) => {
    const updated = [...wildcards];
    updated[index] = { ...updated[index], [field]: value };
    setWildcards(updated);
  };

  const handleSave = async () => {
    await handleUpdateConfig({ ...config, wildcardsSelected: wildcards, autoQualifiedSelected, groupOfDeath, easiestGroup });
    alert("Manual configurations saved successfully!");
  };

  const nonAutoQualified = useMemo(() => {
    // Assuming top 2 qualify automatically...
    const groups: Record<string, Team[]> = {};
    teams.forEach(t => {
      const g = t.group || "None";
      if (!groups[g]) groups[g] = [];
      groups[g].push(t);
    });
    const thirdsAndBelow: Team[] = [];
    Object.keys(groups).forEach(g => {
      if (g === "None") return;
      const sorted = groups[g].sort((a,b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return (b.gf || 0) - (a.gf || 0);
      });
      if (sorted.length > 2) {
        thirdsAndBelow.push(...sorted.slice(2));
      }
    });
    return thirdsAndBelow.length > 0 ? thirdsAndBelow : teams;
  }, [teams]);

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 min-h-[500px]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-display font-black text-white uppercase tracking-widest text-fc-neon-green">Manual Wildcard Selection</h2>
          <p className="text-white/50 text-xs mt-1">Select players who didn't automatically qualify to give them a wildcard spot in the Round of 16.</p>
        </div>
        <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-fc-neon-green text-black uppercase font-bold text-xs rounded hover:bg-white transition-all">
          <Save className="w-4 h-4" /> Save Wildcards
        </button>
      </div>

      <div className="space-y-4">
        {wildcards.map((wc, i) => {
          const spot = i + 1;
          let spotLabel = `${spot}th Spot`;
          if (spot === 1) spotLabel = "1st Spot";
          else if (spot === 2) spotLabel = "2nd Spot";
          else if (spot === 3) spotLabel = "3rd Spot";
          else if (spot !== 11 && spot !== 12 && spot !== 13) {
            const last = spot % 10;
            if (last === 1) spotLabel = `${spot}st Spot`;
            if (last === 2) spotLabel = `${spot}nd Spot`;
            if (last === 3) spotLabel = `${spot}rd Spot`;
          }

          return (
          <div key={i} className="flex flex-col md:flex-row gap-4 items-start md:items-center bg-black/40 p-4 border border-white/10 rounded-xl">
             <div className="flex items-center gap-2 font-bold text-fc-neon-green bg-white/5 border border-white/10 px-3 py-2 rounded">
               <div className="flex flex-col">
                 <button disabled={i === 0} onClick={() => handleMoveUp(i)} className="text-white/50 hover:text-white disabled:opacity-30">
                   <ArrowUp className="w-3 h-3" />
                 </button>
                 <button disabled={i === wildcards.length - 1} onClick={() => handleMoveDown(i)} className="text-white/50 hover:text-white disabled:opacity-30">
                   <ArrowDown className="w-3 h-3" />
                 </button>
               </div>
               <span className="whitespace-nowrap min-w-[70px] text-center text-xs">{spotLabel}</span>
             </div>
             <div className="flex-1 w-full relative">
               <label className="text-[10px] text-white/50 uppercase font-bold tracking-widest absolute -top-2 left-2 bg-black px-1">Select Player</label>
               <select 
                 className="w-full bg-black/50 border border-white/20 rounded pt-4 pb-2 px-3 text-white font-bold h-[52px]"
                 value={wc.teamId}
                 onChange={(e) => handleChange(i, 'teamId', e.target.value)}
               >
                 <option value="" disabled>Choose Player...</option>
                 {nonAutoQualified.map(t => (
                   <option key={t.id} value={t.id}>{t.name} ({t.group})</option>
                 ))}
               </select>
             </div>
             
             <div className="flex-[2] w-full relative">
               <label className="text-[10px] text-white/50 uppercase font-bold tracking-widest absolute -top-2 left-2 bg-black px-1">Reason</label>
               <input 
                 type="text" 
                 value={wc.reason}
                 onChange={(e) => handleChange(i, 'reason', e.target.value)}
                 className="w-full bg-black/50 border border-white/20 rounded pt-4 pb-2 px-3 text-white font-bold h-[52px]"
                 placeholder="Reason for wildcard..."
               />
             </div>
             
             <button onClick={() => handleRemove(i)} className="bg-red-500/20 text-red-500 p-4 rounded hover:bg-red-500 hover:text-white transition-all">
               <Trash2 className="w-5 h-5" />
             </button>
          </div>
        )})}
      </div>

      <button onClick={handleAdd} className="mt-6 flex items-center justify-center gap-2 w-full py-4 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/10 border-dashed rounded-xl uppercase font-bold text-xs transition-all">
        <Plus className="w-4 h-4" /> Add Wildcard Spot
      </button>

      <div className="mt-8 p-4 bg-fc-purple-light/20 border border-fc-purple-light/50 rounded-xl mb-8">
         <p className="text-white/70 text-xs leading-relaxed">
           <strong>Note:</strong> When you specify wildcards here, the Draw system will use these selections explicitly instead of automatically picking the best 3rd place finishers based on statistics. Make sure you select the exact amount needed (usually 2 for a 16-team bracket if 14 qualify automatically).
         </p>
      </div>

      <div className="mb-6 border-t border-white/10 pt-8">
        <h2 className="text-xl font-display font-black text-white uppercase tracking-widest text-fc-neon-green mb-6">Manual Auto-Qualified Players</h2>
        <p className="text-white/50 text-xs mb-4">Optionally hardcode the players that automatically qualify (e.g. 14 players) if you want to bypass the automatic calculations.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {autoQualifiedSelected.map((teamId, i) => (
            <div key={i} className="flex gap-2 items-center bg-black/40 p-4 border border-white/10 rounded-xl relative">
              <span className="text-fc-neon-green font-bold text-xs">{i + 1}.</span>
              <select 
                  className="w-full bg-black/50 border border-white/20 rounded py-2 px-3 text-white font-bold text-sm"
                  value={teamId}
                  onChange={(e) => handleAutoQualifiedChange(i, e.target.value)}
                >
                  <option value="" disabled>Choose Player...</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.group})</option>
                  ))}
              </select>
              <button onClick={() => handleRemoveAutoQualified(i)} className="text-red-500 hover:text-red-400 p-2">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={handleAddAutoQualified} className="mt-4 flex items-center justify-center gap-2 w-full py-4 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/10 border-dashed rounded-xl uppercase font-bold text-xs transition-all">
          <Plus className="w-4 h-4" /> Add Auto-Qualified Spot
        </button>
      </div>

      <div className="mb-6 border-t border-white/10 pt-8">
        <h2 className="text-xl font-display font-black text-white uppercase tracking-widest text-fc-neon-green mb-6">Group Awards (Manual)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-black/40 p-4 border border-white/10 rounded-xl relative">
            <label className="text-[10px] text-white/50 uppercase font-bold tracking-widest absolute -top-2 left-2 bg-black px-1">Group of Death</label>
            <input 
              type="text" 
              value={groupOfDeath}
              onChange={(e) => setGroupOfDeath(e.target.value)}
              className="w-full bg-black/50 border border-white/20 rounded pt-4 pb-2 px-3 text-white font-bold h-[52px]"
              placeholder="e.g. Group A"
            />
          </div>
          <div className="bg-black/40 p-4 border border-white/10 rounded-xl relative">
            <label className="text-[10px] text-white/50 uppercase font-bold tracking-widest absolute -top-2 left-2 bg-black px-1">Easiest Group</label>
            <input 
              type="text" 
              value={easiestGroup}
              onChange={(e) => setEasiestGroup(e.target.value)}
              className="w-full bg-black/50 border border-white/20 rounded pt-4 pb-2 px-3 text-white font-bold h-[52px]"
              placeholder="e.g. Group D"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface DrawAdminPanelProps {
  registrations: Registration[];
  config: Config;
  handleUpdateConfig: (config: Config) => Promise<void>;
  matches: Match[];
  bracket: BracketMatch[];
  teams: Team[];
  handleSaveBracket: (m: BracketMatch) => Promise<void>;
}

export default function DrawAdminPanel({ registrations, config, handleUpdateConfig, matches, bracket, teams, handleSaveBracket }: DrawAdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'group' | 'bracket' | 'wildcards'>('group');
  const approvedPlayers = useMemo(() => registrations.filter(r => r.status === 'approved'), [registrations]);
  
  const [numPots, setNumPots] = useState(3);
  const [numGroups, setNumGroups] = useState(3);
  const [pots, setPots] = useState<Registration[][]>([]);
  const [isWrapped, setIsWrapped] = useState(false);
  const [isWrapping, setIsWrapping] = useState(false);
  const [currentGroupIdx, setCurrentGroupIdx] = useState(0);
  const [drawnPlayer, setDrawnPlayer] = useState<{player: Registration, targetGroup: string} | null>(null);
  const [unwrapping, setUnwrapping] = useState(false);

  const groupAssignmentsRef = useRef<Record<string, string>>(config.groupAssignments || {});
  
  useEffect(() => {
    groupAssignmentsRef.current = config.groupAssignments || {};
  }, [config.groupAssignments]);
  
  const groupKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].slice(0, numGroups);

  const divideIntoPots = () => {
    // Shuffle players
    const shuffled = [...approvedPlayers].sort(() => Math.random() - 0.5);
    const newPots: Registration[][] = Array.from({ length: numPots }, () => []);
    
    shuffled.forEach((player, i) => {
      newPots[i % numPots].push(player);
    });
    
    setPots(newPots);
    setIsWrapped(false);
    setIsWrapping(false);
    setCurrentGroupIdx(0);
    setDrawnPlayer(null);
  };

  const wrapNames = () => {
    setIsWrapping(true);
    setTimeout(() => {
      setIsWrapping(false);
      setIsWrapped(true);
    }, 1200);
  };

  const drawFromPot = async (potIndex: number) => {
    if (pots[potIndex].length === 0 || unwrapping || isWrapping) return;
    
    // Pick random player from the pot
    const pot = [...pots[potIndex]];
    const randomIndex = Math.floor(Math.random() * pot.length);
    const player = pot.splice(randomIndex, 1)[0];
    
    // Update pots immediately
    const newPots = [...pots];
    newPots[potIndex] = pot;
    setPots(newPots);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Assign to group immediately
    const targetGroup = groupKeys[currentGroupIdx % numGroups];
    
    const newAssignments = { ...groupAssignmentsRef.current };
    newAssignments[player.id] = targetGroup;
    groupAssignmentsRef.current = newAssignments;
    handleUpdateConfig({ ...config, groupAssignments: newAssignments });
    
    setCurrentGroupIdx(prev => prev + 1);
    
    // Animate Unwrapping
    setUnwrapping(true);
    setDrawnPlayer(null);
    
    setTimeout(() => {
      setDrawnPlayer({ player, targetGroup });
      setUnwrapping(false);
    }, 1800);
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 min-h-[500px]">
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <h3 className="text-2xl font-display font-black text-white uppercase tracking-widest text-fc-neon-green">Live Draw Studio</h3>
        <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
          <button 
            onClick={() => setActiveTab('group')}
            className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
              activeTab === 'group' ? 'bg-fc-neon-green text-black' : 'text-white/50 hover:text-white'
            }`}
          >
            Group Draw
          </button>
          <button 
            onClick={() => setActiveTab('bracket')}
            className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
              activeTab === 'bracket' ? 'bg-fc-neon-green text-black' : 'text-white/50 hover:text-white'
            }`}
          >
            Bracket Draw
          </button>
          <button 
            onClick={() => setActiveTab('wildcards')}
            className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
              activeTab === 'wildcards' ? 'bg-fc-neon-green text-black' : 'text-white/50 hover:text-white'
            }`}
          >
            Wildcards
          </button>
        </div>
      </div>
      
      {activeTab === 'bracket' ? (
        <DrawBracketManager 
          registrations={registrations} 
          config={config} 
          matches={matches}
          bracket={bracket}
          teams={teams}
          handleSaveBracket={handleSaveBracket}
          handleUpdateConfig={handleUpdateConfig}
        />
      ) : activeTab === 'wildcards' ? (
        <WildcardsAdminTab 
          config={config} 
          teams={teams} 
          handleUpdateConfig={handleUpdateConfig} 
        />
      ) : (
        <>
          <div className="mb-10 p-6 bg-black/40 border border-white/10 rounded-xl text-white/80 font-sans text-sm md:text-base leading-relaxed">
        <h4 className="text-fc-neon-green font-bold text-lg mb-4 uppercase tracking-wider">Tournament Format</h4>
        
        <h5 className="font-bold text-white mb-2 uppercase tracking-wide">Group Stage</h5>
        <ul className="list-disc list-inside space-y-1 mb-6 text-white/70 marker:text-fc-neon-green">
          <li>7 groups total</li>
          <li>Each group plays 4 matches</li>
          <li>Top 2 teams from each group qualify for the Round of 16</li>
          <li>The bottom team is eliminated</li>
          <li>2 additional teams (from the remaining 7 third-place finishers) will be selected for the Round of 16 using an AI-based system &mdash; Goal Difference and Goals Scored will be key factors, favoring the best performers from the toughest groups</li>
        </ul>

        <h5 className="font-bold text-white mb-2 uppercase tracking-wide">Knockout Stage</h5>
        <ul className="list-disc list-inside space-y-1 mb-6 text-white/70 marker:text-fc-neon-green">
          <li>Daily schedule: 2 matches per day in the Group Stage, 1 match per day in the Knockout rounds</li>
        </ul>

        <h5 className="font-bold text-white mb-2 uppercase tracking-wide">Rules</h5>
        <ul className="list-disc list-inside space-y-1 text-white/70 marker:text-fc-neon-green">
          <li>No Home/Away rule &mdash; teams can play anywhere</li>
          <li>Network issues are not the admin's responsibility &mdash; a match can be withdrawn or replayed if the opponent agrees</li>
        </ul>
      </div>
      
      {!isWrapped && pots.length === 0 && (
        <div className="space-y-6 max-w-md">
          <div>
            <label className="text-white/60 text-xs font-bold uppercase tracking-wider mb-2 block">Number of Pots</label>
            <input type="number" value={numPots} onChange={e => setNumPots(Number(e.target.value))} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-white font-bold" min={1} max={8} />
          </div>
          <div>
            <label className="text-white/60 text-xs font-bold uppercase tracking-wider mb-2 block">Number of Groups</label>
            <input type="number" value={numGroups} onChange={e => setNumGroups(Number(e.target.value))} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-white font-bold" min={1} max={8} />
          </div>
          <button onClick={divideIntoPots} className="w-full py-4 bg-fc-neon-green text-black uppercase font-black tracking-widest rounded-xl hover:bg-white transition-all">
            Divide {approvedPlayers.length} Players into Pots
          </button>
        </div>
      )}

      {pots.length > 0 && !isWrapped && (
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h4 className="text-white text-lg font-bold">Players Divided Successfully</h4>
            <button onClick={wrapNames} className="px-6 py-3 bg-fc-neon-green text-black uppercase font-black tracking-widest rounded-xl hover:bg-white transition-all">
              Wrap Names & Begin Draw
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pots.map((pot, i) => (
              <div key={i} className="bg-white/5 border border-white/20 rounded-t-3xl rounded-b-xl p-4 shadow-xl relative overflow-visible">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/80 border border-white/20 rounded-full text-fc-neon-green font-black uppercase text-xs tracking-widest z-10 whitespace-nowrap">Pot {i + 1}</div>
                <div className="flex flex-col gap-3 mt-4">
                  {pot.map((p, idx) => (
                    <motion.div 
                      key={p.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={isWrapping ? { 
                        scale: [1, 0.5, 0], 
                        scaleY: [1, 0.2, 0],
                        rotate: [0, -10, 45],
                        opacity: [1, 1, 0] 
                      } : { scale: 1, opacity: 1 }}
                      transition={{ 
                        duration: isWrapping ? 0.6 : 0.3, 
                        delay: isWrapping ? Math.random() * 0.4 : i * 0.2 + idx * 0.1,
                        ease: "easeInOut"
                      }}
                      className="bg-[#f8f5ee] px-4 py-2.5 rounded shadow-sm text-black font-sans relative transform -rotate-1 origin-center flex flex-col items-center justify-center border-l-4 border-black/10"
                    >
                      <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{p.country || 'Unknown'}</span>
                      <span className="font-bold tracking-tight text-sm">{p.name}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isWrapped && (
        <div className="relative">
          {/* Main Stage for Unwrapping */}
          <div className="flex flex-col items-center justify-center mb-12 min-h-[250px] bg-gradient-to-b from-black/60 to-transparent border border-white/10 rounded-2xl p-8 text-center relative overflow-hidden">
            {unwrapping && (
              <motion.div
                initial={{ scale: 0.5, rotate: -180 }}
                animate={{ scale: 3, rotate: 0, opacity: [1, 1, 0] }}
                transition={{ duration: 1.8, ease: "easeInOut" }}
                className="w-32 h-32 bg-[#e8e4d9] rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.2)] absolute overflow-hidden"
              >
                {/* Paper opening lines */}
                <motion.div 
                  initial={{ opacity: 1 }} 
                  animate={{ opacity: 0 }} 
                  transition={{ delay: 0.8 }} 
                  className="w-full h-1 bg-black/10 transform rotate-45" 
                />
              </motion.div>
            )}
            
            <AnimatePresence>
              {drawnPlayer && !unwrapping && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0, y: 50 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -50 }}
                  className="relative z-10 flex flex-col items-center"
                >
                  <div className="text-xs text-white/50 font-bold uppercase tracking-widest mb-4">Drawn Player</div>
                  
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col items-center justify-center relative min-h-[220px] w-full"
                  >
                    {/* COUNTRY REVEAL (Fades in, highlights, stays, fades out within 3s) */}
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: [0, 1, 1, 0], y: [30, 0, 0, -20] }}
                      transition={{ duration: 3, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
                      className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                    >
                      <div className="relative inline-flex items-center justify-center px-4 py-2 mt-4 pointer-events-auto">
                        <motion.div 
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ delay: 0.4, duration: 0.4, ease: "easeOut" }}
                          className="absolute inset-0 bg-white -skew-x-6 z-0 origin-left"
                        />
                        <motion.span 
                          initial={{ color: "#ffffff" }}
                          animate={{ color: "#000000" }}
                          transition={{ delay: 0.4, duration: 0.1 }}
                          className="relative z-10 text-4xl md:text-6xl font-display font-black uppercase tracking-tight"
                        >
                          {drawnPlayer.player.country || 'Unknown Country'}
                        </motion.span>
                      </div>
                    </motion.div>

                    {/* NAME REVEAL WITH GREEN HIGHLIGHT */}
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 4, type: "spring", bounce: 0.5 }}
                      className="relative inline-flex items-center justify-center px-4 py-2 mt-4"
                    >
                      <motion.div 
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ delay: 4.4, duration: 0.4, ease: "easeOut" }}
                        className="absolute inset-0 bg-fc-neon-green -skew-x-6 z-0 origin-left"
                      />
                      <motion.span 
                        initial={{ color: "#ffffff" }}
                        animate={{ color: "#000000" }}
                        transition={{ delay: 4.4, duration: 0.1 }}
                        className="relative z-10 text-5xl md:text-7xl font-display font-black uppercase tracking-tight"
                      >
                        {drawnPlayer.player.name}
                      </motion.span>
                    </motion.div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 5.2 }}
                    className="inline-block px-8 py-3 bg-white/10 text-white border border-white/20 font-black uppercase tracking-widest rounded-xl text-xl mt-6 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                  >
                    Assigned to Group <span className="text-fc-neon-green">{drawnPlayer.targetGroup}</span>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {!unwrapping && !drawnPlayer && (
              <div className="text-white/40 font-bold uppercase tracking-widest text-sm">
                Awaiting Next Draw...
                <div className="mt-2 text-fc-neon-green">Next Group: Group {groupKeys[currentGroupIdx % numGroups]}</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pots.map((pot, i) => (
              <div key={i} className="bg-black/40 border border-white/10 rounded-2xl p-6 text-center shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent pointer-events-none" />
                <h5 className="text-fc-neon-green font-black uppercase text-xl tracking-widest mb-6">Pot {i + 1}</h5>
                
                <div className="flex flex-wrap justify-center gap-3 mb-8 min-h-[50px]">
                  {pot.map((_, idx) => (
                     <motion.div 
                       key={idx}
                       initial={{ scale: 0, rotate: -180 }}
                       animate={{ scale: 1, rotate: Math.random() * 60 - 30 }}
                       transition={{ type: "spring", bounce: 0.5, delay: idx * 0.02 }}
                       className="w-10 h-10 bg-[#e8e4d9] rounded-full shadow-[inset_-2px_-2px_6px_rgba(0,0,0,0.1),0_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center relative overflow-hidden"
                     >
                       <div className="w-full h-px bg-black/5 absolute top-1/2 transform rotate-45" />
                       <div className="w-full h-px bg-black/5 absolute top-1/3 transform -rotate-12" />
                     </motion.div>
                  ))}
                </div>

                <button 
                  onClick={() => drawFromPot(i)}
                  disabled={pot.length === 0 || unwrapping}
                  className="px-6 py-3 bg-fc-purple-light text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-fc-neon-green hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pot.length > 0 ? `Draw from Pot ${i + 1}` : 'Pot Empty'}
                </button>
              </div>
            ))}
          </div>
          
          <div className="mt-12 flex justify-center">
             <button onClick={async () => { 
                setPots([]); 
                setIsWrapped(false); 
                try {
                  const bSnap = await getDocs(collection(db, 'bracket'));
                  const batch = writeBatch(db);
                  bSnap.docs.forEach(d => batch.delete(d.ref));
                  await batch.commit();
                } catch(e) {}
             }} className="px-6 py-2 text-white/40 hover:text-white border border-white/10 hover:border-white/30 rounded-xl transition-all text-xs font-bold uppercase tracking-widest">
               Reset Draw
             </button>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
