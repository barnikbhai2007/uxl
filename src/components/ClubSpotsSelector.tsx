import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, CheckCircle2, Search, UserCheck, AlertCircle, Sparkles } from 'lucide-react';
import { PREMIER_LEAGUE_TEAMS, PremierLeagueClub } from '../constants';
import { Registration, Config } from '../types';

interface ClubSpotsSelectorProps {
  selectedClubName: string;
  onSelectClub: (club: PremierLeagueClub) => void;
  existingRegistrations?: Registration[];
  config?: Config;
  currentUserId?: string;
  disabled?: boolean;
}

export const ClubSpotsSelector: React.FC<ClubSpotsSelectorProps> = ({
  selectedClubName,
  onSelectClub,
  existingRegistrations = [],
  config,
  currentUserId,
  disabled = false,
}) => {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'available' | 'locked'>('all');

  // Determine which clubs are permanently locked / claimed
  const lockedClubsSet = useMemo(() => {
    const set = new Set<string>();
    
    // Clubs locked in config
    if (config?.lockedCountries) {
      config.lockedCountries.forEach(c => set.add(c.trim().toLowerCase()));
    }

    // Clubs already registered by other players
    existingRegistrations.forEach(reg => {
      if (reg.country) {
        // If current user already registered this team, they can re-select or keep it
        if (!currentUserId || reg.userId !== currentUserId) {
          set.add(reg.country.trim().toLowerCase());
        }
      }
    });

    return set;
  }, [config?.lockedCountries, existingRegistrations, currentUserId]);

  // Mapping from club name to player who claimed it
  const claimedByMap = useMemo(() => {
    const map = new Map<string, string>();
    existingRegistrations.forEach(reg => {
      if (reg.country) {
        const playerName = reg.fcName || reg.name || 'Player';
        map.set(reg.country.trim().toLowerCase(), playerName);
      }
    });
    return map;
  }, [existingRegistrations]);

  const selectedClub = useMemo(() => {
    return PREMIER_LEAGUE_TEAMS.find(
      c => c.name.toLowerCase() === (selectedClubName || '').trim().toLowerCase()
    );
  }, [selectedClubName]);

  const filteredClubs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return PREMIER_LEAGUE_TEAMS.filter((club, index) => {
      const isLocked = lockedClubsSet.has(club.name.toLowerCase());
      
      if (filterMode === 'available' && isLocked) return false;
      if (filterMode === 'locked' && !isLocked) return false;

      if (!query) return true;
      return (
        club.name.toLowerCase().includes(query) ||
        club.shortName.toLowerCase().includes(query) ||
        club.stadium.toLowerCase().includes(query) ||
        club.manager.toLowerCase().includes(query) ||
        `spot ${index + 1}`.includes(query)
      );
    });
  }, [search, filterMode, lockedClubsSet]);

  const claimedCount = useMemo(() => {
    return PREMIER_LEAGUE_TEAMS.filter(c => lockedClubsSet.has(c.name.toLowerCase())).length;
  }, [lockedClubsSet]);

  return (
    <div className="w-full space-y-4">
      {/* Header and Spot Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-[#38003c]/40 via-[#1e0024]/50 to-[#38003c]/40 border border-[#00ff85]/20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00ff85]/10 border border-[#00ff85]/30 flex items-center justify-center text-[#00ff85] font-black text-sm shrink-0">
            20
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-sans font-black text-white uppercase tracking-wider">
                Select Your Club Spot
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-[#00ff85]/10 border border-[#00ff85]/30 text-[#00ff85] text-[10px] font-black tracking-widest uppercase">
                Official 20 Spots
              </span>
            </div>
            <p className="text-[11px] text-white/50">
              Each club comes with its real-life official manager automatically assigned. Once registered, a team is locked forever!
            </p>
          </div>
        </div>

        {/* Spots tracker badge */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
          <div className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-right">
            <span className="text-[10px] text-white/40 block font-bold uppercase tracking-wider">Claimed Spots</span>
            <span className="text-xs font-black text-[#00ff85]">
              {claimedCount} / 20 Claimed
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-[#00ff85]/10 border border-[#00ff85]/30 text-right">
            <span className="text-[10px] text-[#00ff85]/70 block font-bold uppercase tracking-wider">Available</span>
            <span className="text-xs font-black text-[#00ff85]">
              {20 - claimedCount} Open
            </span>
          </div>
        </div>
      </div>

      {/* Selected Club Preview Banner (if selected) */}
      <AnimatePresence>
        {selectedClub && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-2xl bg-gradient-to-r from-[#00ff85]/15 via-[#00ff85]/10 to-[#38003c]/30 border-2 border-[#00ff85] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_0_25px_rgba(0,255,133,0.15)]"
          >
            <div className="flex items-center gap-3.5 w-full sm:w-auto">
              <div className="w-14 h-14 rounded-2xl bg-black/50 p-2 flex items-center justify-center border border-[#00ff85]/40 shrink-0">
                <img 
                  src={selectedClub.logoUrl} 
                  alt={selectedClub.name} 
                  className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(0,255,133,0.4)]" 
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-[#00ff85] text-[#38003c] font-black text-[10px] tracking-wider">
                    {selectedClub.shortName}
                  </span>
                  <h4 className="text-base font-sans font-black text-white leading-tight">
                    {selectedClub.name}
                  </h4>
                  <span className="text-xs text-[#00ff85] font-black flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Selected
                  </span>
                </div>
                <p className="text-[11px] text-white/60 flex items-center gap-2 mt-0.5">
                  <span>🏟️ {selectedClub.stadium}</span>
                </p>
              </div>
            </div>

            {/* Auto-selected Manager Callout */}
            <div className="flex items-center gap-3 w-full sm:w-auto p-2 px-3 rounded-xl bg-black/60 border border-[#00ff85]/30">
              <img 
                src={selectedClub.managerPhoto} 
                alt={selectedClub.manager} 
                className="w-10 h-10 rounded-full object-cover border-2 border-[#00ff85] shrink-0 shadow-md"
                referrerPolicy="no-referrer"
              />
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-black tracking-widest text-[#00ff85] uppercase">
                    Auto-Assigned Manager
                  </span>
                  <span className="text-xs">{selectedClub.managerFlag}</span>
                </div>
                <p className="text-xs font-bold text-white leading-tight">
                  {selectedClub.manager}
                </p>
                <span className="text-[10px] text-white/50">{selectedClub.managerNationality}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search club name, stadium, or manager..."
            className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-white/40 text-xs focus:border-[#00ff85] outline-none transition-all"
          />
        </div>

        {/* Status Filters */}
        <div className="flex gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              filterMode === 'all'
                ? 'bg-white/20 text-white'
                : 'text-white/40 hover:text-white'
            }`}
          >
            All (20)
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('available')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              filterMode === 'available'
                ? 'bg-[#00ff85] text-[#38003c]'
                : 'text-white/40 hover:text-white'
            }`}
          >
            Available ({20 - claimedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('locked')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
              filterMode === 'locked'
                ? 'bg-rose-600 text-white'
                : 'text-white/40 hover:text-white'
            }`}
          >
            Locked ({claimedCount})
          </button>
        </div>
      </div>

      {/* 20 Club Spots Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-h-[460px] overflow-y-auto pr-1">
        {filteredClubs.map((club, index) => {
          const clubNorm = club.name.toLowerCase();
          const isLocked = lockedClubsSet.has(clubNorm);
          const isSelected = selectedClubName?.trim().toLowerCase() === clubNorm;
          const claimedBy = claimedByMap.get(clubNorm);
          const spotNumber = PREMIER_LEAGUE_TEAMS.findIndex(c => c.name === club.name) + 1;

          return (
            <div
              key={club.name}
              onClick={() => {
                if (disabled || isLocked) return;
                onSelectClub(club);
              }}
              className={`relative rounded-2xl p-3 border transition-all select-none overflow-hidden flex flex-col justify-between ${
                isLocked 
                  ? 'bg-black/50 border-rose-900/40 opacity-70 cursor-not-allowed'
                  : isSelected
                    ? 'bg-gradient-to-b from-[#00ff85]/20 to-[#38003c]/40 border-2 border-[#00ff85] shadow-[0_0_20px_rgba(0,255,133,0.3)] cursor-pointer transform -translate-y-0.5'
                    : 'bg-black/30 border-white/10 hover:border-[#00ff85]/60 hover:bg-white/[0.04] cursor-pointer hover:shadow-lg'
              }`}
            >
              {/* Top Row: Spot Number + Status Badge */}
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/60 font-mono text-[10px] font-bold">
                  SPOT #{String(spotNumber).padStart(2, '0')}
                </span>

                {isLocked ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-black uppercase tracking-wider">
                    <Lock className="w-3 h-3" /> Locked Forever
                  </span>
                ) : isSelected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#00ff85] text-[#38003c] text-[10px] font-black uppercase tracking-wider">
                    <CheckCircle2 className="w-3 h-3" /> Selected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#00ff85]/10 border border-[#00ff85]/30 text-[#00ff85] text-[10px] font-black uppercase tracking-wider">
                    <Sparkles className="w-2.5 h-2.5" /> Available
                  </span>
                )}
              </div>

              {/* Club Crest & Info */}
              <div className="flex items-center gap-3 my-1">
                <div className="w-12 h-12 rounded-xl bg-black/40 p-1.5 flex items-center justify-center border border-white/10 shrink-0">
                  <img 
                    src={club.logoUrl} 
                    alt={club.name} 
                    className="w-full h-full object-contain filter drop-shadow"
                    loading="lazy"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-sans font-black text-white truncate">
                      {club.name}
                    </h4>
                    <span className="text-[10px] font-mono text-white/40">
                      {club.shortName}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/50 truncate flex items-center gap-1">
                    <span>🏟️</span> {club.stadium}
                  </p>
                </div>
              </div>

              {/* Real Manager Row */}
              <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <img 
                    src={club.managerPhoto} 
                    alt={club.manager} 
                    className="w-8 h-8 rounded-full object-cover border border-[#00ff85]/50 shrink-0 shadow-sm"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <span className="text-[8px] font-black text-[#00ff85] uppercase tracking-widest block leading-none">
                      Manager
                    </span>
                    <p className="text-[11px] font-bold text-white truncate flex items-center gap-1">
                      <span>{club.manager}</span>
                      <span className="text-[10px] shrink-0">{club.managerFlag}</span>
                    </p>
                  </div>
                </div>

                {/* Action button / Status Icon */}
                {isLocked ? (
                  <div className="text-right shrink-0">
                    <span className="text-[9px] text-rose-400 font-bold block truncate max-w-[80px]" title={claimedBy ? `Claimed by ${claimedBy}` : 'Locked'}>
                      {claimedBy ? claimedBy : 'Taken'}
                    </span>
                  </div>
                ) : isSelected ? (
                  <div className="w-6 h-6 rounded-full bg-[#00ff85] text-[#38003c] flex items-center justify-center shrink-0 shadow">
                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={disabled}
                    className="px-2 py-1 rounded-lg bg-white/10 hover:bg-[#00ff85] text-white hover:text-black text-[10px] font-black uppercase tracking-wider transition-all shrink-0"
                  >
                    Select
                  </button>
                )}
              </div>

              {/* Locked overlay text if locked */}
              {isLocked && (
                <div className="mt-1.5 px-2 py-1 rounded bg-rose-950/80 border border-rose-800/50 text-[10px] text-rose-300 font-bold text-center">
                  {claimedBy ? `Claimed by ${claimedBy}` : 'Permanently Locked'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredClubs.length === 0 && (
        <div className="p-8 text-center bg-black/20 rounded-2xl border border-white/5">
          <AlertCircle className="w-8 h-8 mx-auto text-white/30 mb-2" />
          <p className="text-sm text-white/60 font-medium">No club spots match your filter.</p>
          <button
            type="button"
            onClick={() => { setSearch(''); setFilterMode('all'); }}
            className="mt-2 text-xs font-bold text-[#00ff85] underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
};
