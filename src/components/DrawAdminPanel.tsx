import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Registration, Config, Team } from '../types';
import { WORLD_CUP_TEAMS } from '../constants';

interface DrawAdminPanelProps {
  registrations: Registration[];
  config: Config;
  handleUpdateConfig: (config: Config) => Promise<void>;
}

export default function DrawAdminPanel({ registrations, config, handleUpdateConfig }: DrawAdminPanelProps) {
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
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-2xl font-display font-black text-white uppercase tracking-widest text-fc-neon-green">Live Draw Studio</h3>
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
                    {/* FLAG REVEAL (Fades in, stays, fades out within 3s) */}
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1, 1, 0.8] }}
                      transition={{ duration: 3, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
                      className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                    >
                      <span className="text-8xl drop-shadow-2xl">
                        {WORLD_CUP_TEAMS.find(t => t.name === drawnPlayer.player.country)?.flag || '🌍'}
                      </span>
                      <span className="text-xl font-black text-white/80 uppercase tracking-widest mt-4">
                         {drawnPlayer.player.country || 'Unknown Country'}
                      </span>
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
             <button onClick={() => { setPots([]); setIsWrapped(false); }} className="px-6 py-2 text-white/40 hover:text-white border border-white/10 hover:border-white/30 rounded-xl transition-all text-xs font-bold uppercase tracking-widest">
               Reset Draw
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
