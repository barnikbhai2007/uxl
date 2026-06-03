import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Calendar, Table as TableIcon, GitBranch, ChevronRight, Star, Copy, Check, Info, Search, BarChart2, Award, LogIn, LogOut, Loader2, Plus, Trash2, Save, X, Trophy as TrophyIcon, Eye, EyeOff, Shield, RotateCcw, ArrowLeft, Users, Layout, Edit3, Edit2, Settings, User as UserIcon, Download, Upload, IdCard, ChevronUp, ChevronDown, Sparkles, AlertCircle, ArrowRightLeft, HelpCircle } from 'lucide-react';
import { INITIAL_TEAMS, TEAMS_LIST, TOURNAMENT_SCHEDULE, TEAM_DETAILS, WORLD_CUP_TEAMS } from './constants';
import { Team, Match, BracketMatch, Scorer, Registration, Config, MatchReport, Achievement, UserAchievement, UserProfile, StatGuess } from './types';
import { v4 as uuidv4 } from 'uuid';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { auth, db, signIn, logout, handleFirestoreError, OperationType, getCollectionMeta } from './supabase_mock';
import { onAuthStateChanged, User, supabase } from './supabase_mock';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, getDoc, limit, getDocs, getDocsWithDelta, deleteDoc, updateDoc, getDocFromServer, increment, writeBatch, orderBy, arrayUnion } from './supabase_mock';
import { ScheduleRandomizer } from './ScheduleRandomizer';
import DrawAdminPanel from './components/DrawAdminPanel';

const WORLD_CUP_FLAGS = new Map(WORLD_CUP_TEAMS.map(t => [t.name, t.flag]));

const rawApiUrl = (import.meta as any).env?.VITE_API_URL || "";
const VITE_API_URL = rawApiUrl.endsWith("/") ? rawApiUrl.slice(0, -1) : rawApiUrl;

const cropToSquareImage = (file: File, size: number = 400): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context unavailable'));
        
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context unavailable'));
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
};


const INITIAL_BRACKET: BracketMatch[] = [
  ...Array.from({ length: 8 }).map((_, i) => ({ id: `r16-${i}`, round: 'Round of 16', homeTeamName: 'TBD', awayTeamName: 'TBD', homeScore: 0, awayScore: 0 })),
  ...Array.from({ length: 4 }).map((_, i) => ({ id: `qf-${i}`, round: 'Quarter-Finals', homeTeamName: 'TBD', awayTeamName: 'TBD', homeScore: 0, awayScore: 0 })),
  { id: 'sf-0', round: 'Semi-Finals', homeTeamName: 'Winner QF1', awayTeamName: 'Winner QF2', homeScore: 0, awayScore: 0 },
  { id: 'sf-1', round: 'Semi-Finals', homeTeamName: 'Winner QF3', awayTeamName: 'Winner QF4', homeScore: 0, awayScore: 0 },
  { id: 'final', round: 'Grand Final', homeTeamName: 'Finalist 1', awayTeamName: 'Finalist 2', homeScore: 0, awayScore: 0 },
  { id: 'third-place', round: '3rd Place Match', homeTeamName: 'Loser SF1', awayTeamName: 'Loser SF2', homeScore: 0, awayScore: 0 },
];

const getMatchdayDate = (matchday: number) => {
  if (matchday === 1) return "27th March 2026";
  if (matchday === 2) return "28th March 2026";
  if (matchday === 3) return "29th March 2026";
  if (matchday === 4) return "30th March 2026";
  if (matchday === 5) return "31st March 2026";
  if (matchday === 6) return "1st April 2026";
  return `${26 + matchday}th March 2026`;
};

const getMatchesFromSchedule = (teams: Team[]): Match[] => {
  return TOURNAMENT_SCHEDULE.map((sm, index) => {
    const homeTeam = teams.find(t => t.name === sm.home);
    const awayTeam = teams.find(t => t.name === sm.away);
    
    let homeScore = 0;
    let awayScore = 0;
    let status: 'scheduled' | 'live' | 'finished' = 'scheduled';
    let homeScorers: Scorer[] = [];
    let awayScorers: Scorer[] = [];
    let homeStats: Match['homeStats'];
    let awayStats: Match['awayStats'];
    let isDNF = false;

    return {
      id: `m-${index + 1}`,
      matchNumber: sm.matchNumber || index + 1,
      matchday: sm.matchday,
      leg: sm.leg,
      homeTeamId: homeTeam?.id || 'TBD',
      awayTeamId: awayTeam?.id || 'TBD',
      homeScore,
      awayScore,
      homeScorers,
      awayScorers,
      homeStats,
      awayStats,
      date: getMatchdayDate(sm.matchday),
      status: (sm.rescheduled && sm.matchday <= 2) ? 'rescheduled' : status,
      type: sm.type,
      rescheduled: sm.rescheduled,
      isDNF,
    };
  });
};

const calculateStandings = (teams: Team[], matches: Match[]): Team[] => {
  const standings = teams.map(t => ({ ...t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: [] as string[] }));
  const standingsMap = new Map(standings.map(t => [t.id, t]));
  
  // Sort matches by matchNumber to ensure form is chronological
  const sortedMatches = [...matches].sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));

  sortedMatches.forEach(m => {
    // Determine if this is a league match based on matchday (e.g. 1-10 are league, 11+ are knockout)
    const isLeagueMatch = (m.matchday || 0) <= 20; 

    if (m.status === 'finished' && isLeagueMatch && m.homeScore !== undefined && m.homeScore !== null && m.awayScore !== undefined && m.awayScore !== null) {
      const home = standingsMap.get(m.homeTeamId);
      const away = standingsMap.get(m.awayTeamId);
      
      if (home && away) {
        home.played++;
        away.played++;
        home.gf += m.homeScore;
        home.ga += m.awayScore;
        away.gf += m.awayScore;
        away.ga += m.homeScore;
        
        if (m.homeScore > m.awayScore) {
          home.won++;
          home.points += 3;
          home.form.push('W');
          away.lost++;
          away.form.push('L');
        } else if (m.homeScore < m.awayScore) {
          away.won++;
          away.points += 3;
          away.form.push('W');
          home.lost++;
          home.form.push('L');
        } else {
          home.drawn++;
          away.drawn++;
          home.points += 1;
          home.form.push('D');
          away.points += 1;
          away.form.push('D');
        }
        home.gd = home.gf - home.ga;
        away.gd = away.gf - away.ga;
      }
    }
  });
  
  // Keep only the last 5 results for form
  standings.forEach(t => {
    t.form = t.form.slice(-5);
  });
  
  return standings.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
};

const formatTimestamp = (ts: any) => {
  if (!ts) return '';
  try {
    if (ts && typeof ts === 'object' && 'seconds' in ts) return new Date(ts.seconds * 1000).toLocaleString();
    if (ts.toDate && typeof ts.toDate === 'function') return ts.toDate().toLocaleString();
    const d = new Date(ts);
    return isNaN(d.getTime()) ? '' : d.toLocaleString();
  } catch (e) {
    return '';
  }
};

interface PlayerGoalStats {
  playerName: string;
  gamerName: string;
  gamerFullName: string;
  goals: number;
}

const canonicalizePlayerName = (name: string) => {
  if (!name) return '';
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[0-9]/g, '').trim().toLowerCase();
};

const formatPlayerName = (name: string) => {
  if (!name) return '';
  return name.replace(/[0-9]/g, '').trim(); 
};

const calculateStats = (teams: Team[], matches: Match[]): (PlayerGoalStats & { teamId: string })[] => {
  const statsMap: Record<string, PlayerGoalStats & { teamId: string }> = {};
  const teamsMap = new Map(teams.map(t => [t.id, t]));

  matches.forEach(m => {
    if (m.status === 'finished') {
      const homeTeam = teamsMap.get(m.homeTeamId);
      const awayTeam = teamsMap.get(m.awayTeamId);

      if (homeTeam && m.homeScorers) {
        m.homeScorers.forEach(s => {
          const canonicalName = canonicalizePlayerName(s.playerName);
          const key = `${canonicalName}-${homeTeam.id}`;
          if (!statsMap[key]) {
            statsMap[key] = {
              teamId: homeTeam.id,
              playerName: formatPlayerName(s.playerName),
              gamerName: homeTeam.fcName || homeTeam.name,
              gamerFullName: homeTeam.fullName,
              goals: 0
            };
          }
          statsMap[key].goals += s.goals;
        });
      }

      if (awayTeam && m.awayScorers) {
        m.awayScorers.forEach(s => {
          const canonicalName = canonicalizePlayerName(s.playerName);
          const key = `${canonicalName}-${awayTeam.id}`;
          if (!statsMap[key]) {
            statsMap[key] = {
              teamId: awayTeam.id,
              playerName: formatPlayerName(s.playerName),
              gamerName: awayTeam.fcName || awayTeam.name,
              gamerFullName: awayTeam.fullName,
              goals: 0
            };
          }
          statsMap[key].goals += s.goals;
        });
      }
    }
  });

  return Object.values(statsMap).sort((a, b) => b.goals - a.goals);
};

interface CleanSheetStats {
  teamId: string;
  goalkeeperName: string;
  gamerName: string;
  gamerFullName: string;
  cleanSheets: number;
}

const calculateCleanSheets = (teams: Team[], matches: Match[]): CleanSheetStats[] => {
  const statsMap: Record<string, CleanSheetStats> = {};
  const teamsMap = new Map(teams.map(t => [t.id, t]));

  matches.forEach(m => {
    if (m.status === 'finished') {
      const homeTeam = teamsMap.get(m.homeTeamId);
      const awayTeam = teamsMap.get(m.awayTeamId);

      if (homeTeam && (m.awayScore ?? -1) === 0) {
        const key = homeTeam.id;
        if (!statsMap[key]) {
          statsMap[key] = {
            teamId: homeTeam.id,
            goalkeeperName: homeTeam.goalkeeper || 'Unknown GK',
            gamerName: homeTeam.name,
            gamerFullName: homeTeam.fullName,
            cleanSheets: 0
          };
        }
        statsMap[key].cleanSheets += 1;
      }

      if (awayTeam && (m.homeScore ?? -1) === 0) {
        const key = awayTeam.id;
        if (!statsMap[key]) {
          statsMap[key] = {
            teamId: awayTeam.id,
            goalkeeperName: awayTeam.goalkeeper || 'Unknown GK',
            gamerName: awayTeam.name,
            gamerFullName: awayTeam.fullName,
            cleanSheets: 0
          };
        }
        statsMap[key].cleanSheets += 1;
      }
    }
  });

  return Object.values(statsMap).sort((a, b) => b.cleanSheets - a.cleanSheets);
};

interface MotmStats {
  playerName: string;
  awards: number;
}

const calculateMotmLeaders = (matches: Match[]): MotmStats[] => {
  const tallies: Record<string, number> = {};
  const displayNames: Record<string, string> = {};
  matches.forEach(m => {
    if (m.status === 'finished' && m.manOfTheMatch) {
        const canonical = canonicalizePlayerName(m.manOfTheMatch);
        if (canonical) {
          tallies[canonical] = (tallies[canonical] || 0) + 1;
          if (!displayNames[canonical]) displayNames[canonical] = formatPlayerName(m.manOfTheMatch);
        }
    }
  });
  return Object.entries(tallies)
    .map(([canonical, awards]) => ({ playerName: displayNames[canonical], awards }))
    .sort((a, b) => b.awards - a.awards);
};

const TeamProfileModal = ({ team, matches, teams, onClose, isAdmin, resetPlayer }: { team: Team, matches: Match[], teams: Team[], onClose: () => void, isAdmin?: boolean, resetPlayer?: (id: string) => void }) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const teamMatches = matches.filter(m => m.homeTeamId === team.id || m.awayTeamId === team.id);
  const finishedMatches = teamMatches.filter(m => m.status === 'finished').sort((a, b) => b.matchNumber - a.matchNumber);
  const upcomingMatches = teamMatches.filter(m => m.status !== 'finished').sort((a, b) => a.matchNumber - b.matchNumber);
  
  const recentMatches = finishedMatches.slice(0, 5);

  let totalGoalsScored = 0;
  let totalGoalsConceded = 0;
  let totalPossession = 0;
  let matchesWithStats = 0;
  let totalShots = 0;
  const scorers: Record<string, number> = {};

  finishedMatches.forEach(m => {
    const isHome = m.homeTeamId === team.id;
    totalGoalsScored += isHome ? (m.homeScore || 0) : (m.awayScore || 0);
    totalGoalsConceded += isHome ? (m.awayScore || 0) : (m.homeScore || 0);
    
    const myStats = isHome ? m.homeStats : m.awayStats;
    if (myStats) {
      totalPossession += myStats.possession;
      totalShots += myStats.shots;
      matchesWithStats++;
    }

    const myScorers = isHome ? m.homeScorers : m.awayScorers;
    if (myScorers) {
      myScorers.forEach(s => {
        scorers[s.playerName] = (scorers[s.playerName] || 0) + s.goals;
      });
    }
  });

  const avgPossession = matchesWithStats > 0 ? (totalPossession / matchesWithStats).toFixed(1) : 0;
  const topScorerInfo = Object.entries(scorers).sort((a, b) => b[1] - a[1])[0] || ['None', 0];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-fc-purple-dark/80 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-gradient-to-b from-fc-purple-dark to-fc-purple-base/50 border border-white/10 rounded-2xl p-6 md:p-10 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto hide-scrollbar"
      >
        <div className="absolute top-6 right-6 flex gap-2 z-20">
          {isAdmin && resetPlayer && (
            <button 
              onClick={() => {
                if (confirmReset) {
                  resetPlayer(team.id);
                } else {
                  setConfirmReset(true);
                }
              }} 
              className={`p-2 rounded-2xl transition-colors flex items-center gap-2 px-4 text-xs font-bold tracking-normal ${confirmReset ? 'bg-red-600 text-white animate-pulse' : 'bg-red-600/20 text-red-400 hover:bg-red-600/40'}`}
            >
              <RotateCcw className="w-4 h-4" />
              {confirmReset ? 'Confirm Reset' : 'Reset Player Data'}
            </button>
          )}
          <button onClick={onClose} className="p-2 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-8 items-start mb-12 relative z-10 mt-8 md:mt-0">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-fc-purple-light/30 border border-fc-neon-green/50/30 flex items-center justify-center text-4xl md:text-5xl font-bold shrink-0 shadow-lg overflow-hidden">
            {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-cover" /> : team.name[0]}
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="text-3xl md:text-5xl font-display font-bold  tracking-tight leading-none flex items-center gap-3">
              {team.fullName}
              {team.country && (
                <span className="text-3xl md:text-4xl shadow-sm" title={team.country}>
                  {WORLD_CUP_TEAMS.find(t => t.name === team.country)?.flag || '🌍'}
                </span>
              )}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 bg-white/10 rounded-2xl text-xs font-bold tracking-normal text-white/60">FC: {team.fcName}</span>
              <span className="px-3 py-1 bg-fc-neon-green/20 border border-fc-neon-green/50/30 rounded-2xl text-xs font-bold tracking-normal text-fc-neon-green">OVR {team.ovr}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center items-center text-center">
            <span className="text-[10px] font-bold tracking-normal text-white/30 mb-1">Total Goals</span>
            <span className="text-2xl font-bold text-green-400">{totalGoalsScored}</span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center items-center text-center">
            <span className="text-[10px] font-bold tracking-normal text-white/30 mb-1">Goals Conceded</span>
            <span className="text-2xl font-bold text-red-400">{totalGoalsConceded}</span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center items-center text-center">
            <span className="text-[10px] font-bold tracking-normal text-white/30 mb-1">Avg Possession</span>
            <span className="text-2xl font-bold text-fc-neon-green">{avgPossession}%</span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center items-center text-center">
            <span className="text-[10px] font-bold tracking-normal text-white/30 mb-1">Top Scorer</span>
            <span className="text-lg font-bold text-orange-400 truncate w-full px-2" title={topScorerInfo[0] as string}>{topScorerInfo[0]}</span>
            <span className="text-[10px] font-bold text-orange-400/50">{topScorerInfo[1]} Goals</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-sm font-bold tracking-normal text-white/60 mb-2 border-b border-white/10 pb-2">Upcoming Matches</h3>
            {upcomingMatches.length > 0 ? upcomingMatches.slice(0, 3).map(m => {
              const opp = m.homeTeamId === team.id ? teams.find(t => t.id === m.awayTeamId) : teams.find(t => t.id === m.homeTeamId);
              return (
                                <div key={m.id} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <EditableMatchBadge match={m} isAdmin={isAdmin} className="bg-fc-purple-light/30 px-1.5 py-0.5 rounded border border-fc-neon-green/30" textClassName="text-fc-neon-green text-[8px] font-bold" />
                    <span className="text-xs font-bold">{opp?.name || 'TBD'}</span>
                  </div>
                  <span className="text-[10px] font-bold text-white/30 tracking-normal">{m.date}</span>
                </div>
              );
            }) : (
               <div className="p-4 text-center text-white/20 text-xs font-bold tracking-normal bg-white/5 rounded-2xl border border-white/10">No upcoming matches</div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold tracking-normal text-white/60 mb-2 border-b border-white/10 pb-2">Recent Form</h3>
            {recentMatches.length > 0 ? recentMatches.map(m => {
              const isHome = m.homeTeamId === team.id;
              const opp = isHome ? teams.find(t => t.id === m.awayTeamId) : teams.find(t => t.id === m.homeTeamId);
              const myScore = isHome ? m.homeScore! : m.awayScore!;
              const oppScore = isHome ? m.awayScore! : m.homeScore!;
              const isWin = myScore > oppScore;
              const isDraw = myScore === oppScore;
              return (
                <div key={m.id} className="flex items-center justify-between p-3 bg-white/5 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-2xl ${isWin ? 'bg-green-500' : isDraw ? 'bg-gray-400' : 'bg-red-500'}`} />
                    <span className="text-xs font-bold">{opp?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono font-bold">
                    <span className={isWin ? 'text-green-400' : (isDraw ? 'text-gray-400' : 'text-white/40')}>{myScore}</span>
                    <span className="text-white/20">-</span>
                    <span className={!isWin && !isDraw ? 'text-red-400' : 'text-white/40'}>{oppScore}</span>
                  </div>
                </div>
              );
            }) : (
               <div className="p-4 text-center text-white/20 text-xs font-bold tracking-normal bg-white/5 rounded-2xl border border-white/10">No recent matches</div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const NEWS_POSTS: any[] = [];

const EditableMatchBadge = ({ match, isAdmin, onUpdateMatch, className, textClassName }: { match: Match, isAdmin?: boolean, onUpdateMatch?: (m: Match) => void, className?: string, textClassName?: string }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(match.matchNumber?.toString() || '');

  return (
    <div 
      onClick={(e) => {
        if (isAdmin) {
          e.stopPropagation();
          setIsEditing(true);
          setVal(match.matchNumber?.toString() || '');
        }
      }}
      className={`${className || ''} ${isAdmin ? 'cursor-pointer hover:scale-110 transition-all' : ''}`}
    >
      {isEditing ? (
        <input 
          autoFocus
          className={`bg-transparent text-center outline-none p-0 m-0 w-8 ${textClassName || ''}`}
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={(e) => {
            setIsEditing(false);
            const num = parseInt(val);
            if (!isNaN(num) && num !== match.matchNumber) {
              if (onUpdateMatch) {
                onUpdateMatch({ ...match, matchNumber: num });
              } else {
                import('./supabase_mock').then(({ doc, updateDoc, db }) => {
                  updateDoc(doc(db, 'matches', match.id), { matchNumber: num }).catch(console.error);
                });
                match.matchNumber = num;
              }
            } else {
              setVal(match.matchNumber?.toString() || '');
            }
          }}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        />
      ) : (
        <span className={textClassName || ''}>M# {match.matchNumber}</span>
      )}
    </div>
  );
};

  const MatchCard = ({ match, teams, overrideStatus, onClick, isEditingMode, isAdmin, onUpdateMatch }: { match: Match, teams: Team[], overrideStatus?: string, onClick: () => void, isEditingMode?: boolean, isAdmin?: boolean, onUpdateMatch?: (updatedMatch: Match) => void, key?: any }) => {
    const homeTeam = teams.find(t => t.id === match.homeTeamId);
    const awayTeam = teams.find(t => t.id === match.awayTeamId);

    const displayStatus = match.status === 'finished' ? 'finished' : (overrideStatus || match.status);

    const TeamLogo = ({ team }: { team: Team | undefined }) => (
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 flex items-center justify-center text-2xl font-bold shadow-lg group-hover:scale-110 transition-transform overflow-hidden z-10">
        {team?.logoUrl ? (
          <img src={team.logoUrl} alt={team.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          team?.name[0] || '?'
        )}
      </div>
    );

    const renderTeamName = (teamType: 'away' | 'home', team: Team | undefined) => {
      if (isAdmin && isEditingMode && onUpdateMatch) {
        return (
          <select
            className="mt-2 bg-fc-purple-dark/80 border border-fc-neon-green/50/50 rounded-2xl text-white text-[10px] p-1 font-bold outline-none max-w-[120px]"
            value={team?.id || ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const newId = e.target.value === '' ? null : e.target.value;
              const updated = { ...match };
              if (teamType === 'home') updated.homeTeamId = newId;
              else updated.awayTeamId = newId;
              onUpdateMatch(updated);
            }}
          >
            <option value="">TBD</option>
            {teams.sort((a, b) => {
              const nameA = a.fullName || a.fcName || a.name || '';
              const nameB = b.fullName || b.fcName || b.name || '';
              return nameA.localeCompare(nameB);
            }).map(t => (
              <option key={t.id} value={t.id}>
                {t.fullName || t.fcName || t.name}
              </option>
            ))}
          </select>
        );
      }
      return (
        <div className="text-center max-w-[140px] mt-2">
          <div className="text-lg md:text-xl font-display font-extrabold text-white tracking-normal truncate px-2">
            {team?.fullName || team?.fcName || team?.name || 'TBD'}
          </div>
        </div>
      );
    }

    return (
      <motion.div
        whileHover={{ scale: 1.01, y: -2 }}
        onClick={onClick}
        className="bg-white/[0.04] border border-white/5 relative p-6 cursor-pointer hover:brightness-110 transition-all group overflow-visible rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.4)]"
      >
        <div className="absolute top-0 right-0 p-4 opacity-[0.08] pointer-events-none select-none">
           <span className="text-6xl font-display font-bold  text-white tracking-tight">
             {match.matchNumber}
           </span>
        </div>
        
        <div className="flex items-center justify-between gap-4 relative z-10">
          <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <TeamLogo team={homeTeam} />
            {renderTeamName('home', homeTeam)}
          </div>

          <div className="flex flex-col items-center gap-3 px-6 py-4 bg-[#0A0A0A] border border-white/5 rounded-2xl shadow-[inset_0_2px_10px_rgb(0,0,0,0.5)]">
            <EditableMatchBadge 
              match={match} 
              isAdmin={isAdmin} 
              onUpdateMatch={onUpdateMatch}
              className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#3B82F6] px-3 py-1 rounded-full shadow-md"
              textClassName="text-[10px] font-sans font-bold text-white tracking-[0.1em] placeholder-white/50"
            />
            <div className="flex items-center gap-4">
              <span className={`text-4xl font-display font-extrabold tabular-nums ${displayStatus === 'finished' ? (match.homeScore! > match.awayScore! ? 'text-[#10B981]' : 'text-[#A0A0A0]') : 'text-white'}`}>
                {match.homeScore ?? '-'}
              </span>
              <div className="flex flex-col items-center">
                 <span className="text-[10px] font-sans font-bold text-[#A0A0A0]">VS</span>
                 <div className="h-4 w-[1px] bg-white/[0.08] my-1" />
              </div>
              <span className={`text-4xl font-display font-extrabold tabular-nums ${displayStatus === 'finished' ? (match.awayScore! > match.homeScore! ? 'text-[#10B981]' : 'text-[#A0A0A0]') : 'text-white'}`}>
                {match.awayScore ?? '-'}
              </span>
            </div>
            <div className={`px-4 py-1 text-[10px] font-sans font-bold tracking-[0.1em] rounded-none shadow-sm ${
              displayStatus === 'finished' ? 'bg-[#3B82F6] text-white' :
              displayStatus === 'ongoing' || displayStatus === 'live' ? 'bg-[#EF4444] text-white animate-pulse' :
              'bg-white/[0.08] text-[#A0A0A0]'
            }`}>
              {displayStatus === 'finished' ? 'FT' : displayStatus === 'ongoing' || displayStatus === 'live' ? 'LIVE' : 'UPCOMING'}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <TeamLogo team={awayTeam} />
            {renderTeamName('away', awayTeam)}
          </div>
        </div>
      </motion.div>
    );
  };

  const MatchDetailsModal = ({ match, onClose, teams, copiedId, copyToClipboard, updateMatch, deleteMatch, isEditingMode, siteContent, isAdmin, resetMatch, currentUser, myRegistrationData }: { 
    match: Match & { _overrideStatus?: string }, 
    onClose: () => void,
    teams: Team[],
    copiedId: string | null,
    copyToClipboard: (id: string) => void,
    updateMatch?: (match: Match) => Promise<void> | void,
    deleteMatch?: (matchId: string) => Promise<void> | void,
    isEditingMode?: boolean,
    siteContent?: any,
    isAdmin?: boolean,
    resetMatch?: (id: string) => Promise<void> | void,
    currentUser?: any,
    myRegistrationData?: any
  }) => {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [localHomeScorers, setLocalHomeScorers] = useState<any[]>(match.homeScorers ? JSON.parse(JSON.stringify(match.homeScorers)) : []);
    const [localAwayScorers, setLocalAwayScorers] = useState<any[]>(match.awayScorers ? JSON.parse(JSON.stringify(match.awayScorers)) : []);
    const [isSavingScorers, setIsSavingScorers] = useState(false);

    const handleSaveScorers = async () => {
      if (!updateMatch) return;
      setIsSavingScorers(true);
      
      const stringifyScorers = (scorers: any[]) => scorers.map(s => `${s.playerName} (${s.goals} goals, ${s.time || 'no time'})`).join(', ') || 'None';
      const changesStrs: string[] = [];
      const oldHStr = stringifyScorers(match.homeScorers || []);
      const newHStr = stringifyScorers(localHomeScorers || []);
      if (oldHStr !== newHStr) changesStrs.push(`Home: [${oldHStr}] -> [${newHStr}]`);

      const oldAStr = stringifyScorers(match.awayScorers || []);
      const newAStr = stringifyScorers(localAwayScorers || []);
      if (oldAStr !== newAStr) changesStrs.push(`Away: [${oldAStr}] -> [${newAStr}]`);

      const finalChangeStr = changesStrs.length > 0 ? changesStrs.join(' | ') : 'Update scorers (no structure changes)';

      const newEditLogs = match.editLogs ? [...match.editLogs] : [];
      if (!isAdmin && currentUser && myRegistrationData) {
         newEditLogs.push({
           editedBy: myRegistrationData.fcName || currentUser.email || 'Participant',
           editedAt: new Date().toISOString(),
           changes: finalChangeStr
         });
      } else if (isAdmin) {
         newEditLogs.push({
           editedBy: 'Admin',
           editedAt: new Date().toISOString(),
           changes: finalChangeStr
         });
      }

      await updateMatch({
        ...match,
        homeScorers: localHomeScorers,
        awayScorers: localAwayScorers,
        editLogs: newEditLogs
      });
      setIsSavingScorers(false);
    };

    const addLogAndUpdate = (field: keyof Match, newVal: any, descField?: string) => {
      if (!updateMatch) return;
      const oldVal = match[field];
      if (oldVal === newVal) return;

      const newEditLogs = match.editLogs ? [...match.editLogs] : [];
      const editorName = (!isAdmin && currentUser && myRegistrationData) ? (myRegistrationData.fcName || currentUser.email || 'Participant') : (isAdmin ? 'Admin' : 'Someone');
      newEditLogs.push({
         editedBy: editorName,
         editedAt: new Date().toISOString(),
         changes: `${descField || field}: '${oldVal ?? '-'}' -> '${newVal ?? '-'}'`
      });

      const updated = { ...match, [field]: newVal, editLogs: newEditLogs } as Match;
      // Also mutate local match object so input doesn't glitch if there is a delay
      (match as any)[field] = newVal;
      match.editLogs = newEditLogs;
      updateMatch(updated);
    };

    const homeTeam = teams.find(t => t.id === match.homeTeamId);
    const awayTeam = teams.find(t => t.id === match.awayTeamId);

    const displayStatus = match.status === 'finished' ? 'finished' : (match._overrideStatus || match.status);

    const StatRow = ({ home, away, label, suffix = '', homeVal, awayVal }: { home: number | string, away: number | string, label: string, suffix?: string, homeVal?: number, awayVal?: number }) => {
      const h = homeVal ?? (typeof home === 'number' ? home : parseFloat(home as string));
      const a = awayVal ?? (typeof away === 'number' ? away : parseFloat(away as string));
      const total = h + a;
      const homePercent = total === 0 ? 50 : (h / total) * 100;

      return (
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] font-bold tracking-normal">
            <span className="text-white w-12 text-left">{home}{suffix}</span>
            <span className="text-fc-neon-green/40 text-[9px]">{label}</span>
            <span className="text-white w-12 text-right">{away}{suffix}</span>
          </div>
          <div className="h-1 bg-white/5 rounded-2xl overflow-hidden flex">
            <div className="h-full bg-fc-neon-green text-black transition-all duration-700" style={{ width: `${homePercent}%` }} />
            <div className="h-full bg-white/10 transition-all duration-700" style={{ width: `${100 - homePercent}%` }} />
          </div>
        </div>
      );
    };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-fc-purple-dark/95 cursor-pointer will-change-opacity"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.98, opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="w-full max-w-2xl bg-fc-purple-base border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative max-h-[90vh] overflow-y-auto cursor-default will-change-transform"
          onClick={e => e.stopPropagation()}
        >
          <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-fc-neon-green/20 to-transparent pointer-events-none" />
          
          <div className="p-8 relative z-10">
            {isEditingMode && isAdmin && (
              <div className="flex justify-end gap-2 mb-4">
                <button 
                  onClick={() => {
                    if (confirmDelete) {
                      if(deleteMatch) deleteMatch(match.id);
                      onClose();
                    } else {
                      setConfirmDelete(true);
                    }
                  }}
                  className={`px-4 py-2 border rounded-2xl text-xs font-bold transition-all ${confirmDelete ? 'bg-red-600 border-red-600 text-white animate-pulse' : 'bg-red-600/20 hover:bg-red-600/40 border-red-500/50 text-red-400'}`}
                >
                  {confirmDelete ? 'Click to Confirm Delete' : 'Delete Match'}
                </button>
              </div>
            )}
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[15rem] md:text-[20rem] font-bold text-white/[0.02]  select-none pointer-events-none">
              {match.matchNumber}
            </div>
            
            <div className="flex justify-between items-center mb-12 relative z-10">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <span className="text-xs font-bold tracking-[0.3em] text-fc-neon-green">Match Details</span>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-4 mb-12">
              <div className="flex-1 flex flex-col items-center text-center gap-4 p-4 rounded-2xl transition-colors">
                <div 
                  className="flex flex-col items-center text-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); if (homeTeam) window.dispatchEvent(new CustomEvent('openTeamProfile', { detail: homeTeam })) }}
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl md:text-4xl shadow-lg overflow-hidden">
                    {homeTeam?.logoUrl ? <img src={homeTeam.logoUrl} className="w-full h-full object-cover" /> : (homeTeam?.name[0] || '?')}
                  </div>
                  <div className="space-y-1">
                    <h2 className="font-display font-bold text-lg md:text-xl  tracking-tight pr-1 hover:text-fc-neon-green transition-colors">{homeTeam?.fullName || 'TBD'}</h2>
                    {homeTeam && (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-bold text-fc-neon-green/60 tracking-normal">FC: {homeTeam.fcName}</span>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 bg-fc-purple-light/20 border border-fc-neon-green/30 rounded text-[9px] font-bold text-fc-neon-green">OVR {homeTeam.ovr}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(homeTeam.uid);
                            }}
                            className="flex items-center gap-1.5 text-[9px] md:text-[10px] text-white/40 hover:text-fc-neon-green transition-colors group/uid"
                          >
                            <span className="font-mono font-bold tracking-wider">
                              {copiedId === homeTeam.uid ? 'Copied!' : 'Copy UID'}
                            </span>
                            {copiedId === homeTeam.uid ? (
                              <Check className="w-2.5 h-2.5 text-green-400" />
                            ) : (
                              <Copy className="w-2.5 h-2.5 opacity-40 group-hover/uid:opacity-100" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {isEditingMode ? (
                  <div className="mt-4 flex flex-col items-center gap-2 w-full md:max-w-[250px]">
                    <span className="text-[10px] font-bold text-fc-neon-green tracking-normal">Edit Scorers</span>
                    {localHomeScorers.map((s, i) => (
                      <div key={i} className="flex flex-col gap-1 bg-fc-purple-dark/20 p-2 rounded-2xl w-full border border-white/5">
                        <input type="text" value={s.playerName} onChange={e => { const newS = [...localHomeScorers]; newS[i].playerName = e.target.value; setLocalHomeScorers(newS); }} className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-fc-neon-green/50" placeholder="Player Name" />
                        <div className="flex gap-1 items-center">
                          <input type="number" value={s.goals} onChange={e => { const newS = [...localHomeScorers]; newS[i].goals = parseInt(e.target.value)||0; setLocalHomeScorers(newS); }} className="bg-white/5 border border-white/10 rounded px-2 py-1.5 w-12 text-xs text-white outline-none focus:border-fc-neon-green/50" placeholder="Goals" min="0" />
                          <input type="text" value={s.time||''} onChange={e => { const newS = [...localHomeScorers]; newS[i].time = e.target.value; setLocalHomeScorers(newS); }} className="bg-white/5 border border-white/10 rounded px-2 py-1.5 flex-1 w-0 min-w-[50px] text-xs text-white outline-none focus:border-fc-neon-green/50" placeholder="Time" />
                          <button onClick={(e) => { 
                            e.stopPropagation(); 
                            setLocalHomeScorers(prev => {
                              const newS = [...prev];
                              const scorer = newS.splice(i, 1)[0];
                              setLocalAwayScorers(prevA => [...prevA, scorer]);
                              return newS;
                            });
                          }} className="p-1 w-8 h-8 flex items-center justify-center shrink-0 bg-fc-neon-green/20 text-fc-neon-green hover:bg-fc-neon-green text-black hover:text-black rounded transition-colors" title="Swap to Away Team"><ArrowRightLeft className="w-3 h-3" /></button>
                          <button onClick={(e) => { e.stopPropagation(); const newS = [...localHomeScorers]; newS.splice(i, 1); setLocalHomeScorers(newS); }} className="p-1 w-8 h-8 flex shrink-0 items-center justify-center bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded transition-colors">&times;</button>
                        </div>
                      </div>
                    ))}
                    <button onClick={(e) => { e.stopPropagation(); setLocalHomeScorers([...localHomeScorers, { playerName: '', goals: 1 }]); }} className="text-[9px] bg-fc-purple-light/20 border border-fc-neon-green/50/30 text-fc-neon-green px-3 py-2 rounded-2xl font-bold tracking-normal hover:bg-fc-neon-green text-black hover:text-black transition-colors w-full">+ Add Scorer</button>
                    <button onClick={handleSaveScorers} disabled={isSavingScorers} className="mt-2 text-[10px] bg-green-500 text-white px-3 py-2 rounded-2xl font-bold tracking-normal hover:bg-green-600 transition-colors w-full">{isSavingScorers ? 'Saving...' : 'Save Scorers'}</button>
                  </div>
                ) : match.homeScorers && match.homeScorers.length > 0 ? (
                  <div className="mt-4 flex flex-col items-center gap-1">
                    {match.homeScorers.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] font-sans font-bold text-[#A0A0A0] tracking-normal">
                          {s.playerName} <span className="text-[#3B82F6] ml-1">{Array.from({ length: s.goals }).map((_, idx) => <span key={idx}>[G] </span>)}</span> {s.time && `(${s.time})`}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col items-center gap-2 md:gap-4">
                <div className="text-[10px] md:text-xs font-bold text-fc-neon-green/50 tracking-normal">Score</div>
                <div className="flex items-center gap-4 md:gap-6">
                  {match.isDNF ? (
                    <span className="text-4xl md:text-6xl font-bold text-red-500 tracking-tight">DNF</span>
                  ) : isEditingMode && isAdmin ? (
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" defaultValue={match.homeScore ?? 0} onBlur={(e) => {
                          const val = parseInt(e.target.value);
                          addLogAndUpdate('homeScore', isNaN(val) ? 0 : val, 'Home Score');
                      }} className="w-16 h-16 md:w-20 md:h-20 bg-white/10 rounded-2xl text-center text-4xl md:text-6xl font-bold text-white" />
                      <span className="text-2xl text-white/20">VS</span>
                      <input type="number" min="0" defaultValue={match.awayScore ?? 0} onBlur={(e) => {
                          const val = parseInt(e.target.value);
                          addLogAndUpdate('awayScore', isNaN(val) ? 0 : val, 'Away Score');
                      }} className="w-16 h-16 md:w-20 md:h-20 bg-white/10 rounded-2xl text-center text-4xl md:text-6xl font-bold text-white" />
                    </div>
                  ) : (
                    <>
                      <motion.span key={match.homeScore} initial={{ scale: 1.5, color: '#F0C040' }} animate={{ scale: 1, color: '#ffffff' }} transition={{ duration: 0.5 }} className="text-4xl md:text-6xl font-bold tabular-nums inline-block origin-center">{match.homeScore ?? '-'}</motion.span>
                      <span className="text-white/10 font-bold text-xl md:text-2xl">VS</span>
                      <motion.span key={match.awayScore} initial={{ scale: 1.5, color: '#F0C040' }} animate={{ scale: 1, color: '#ffffff' }} transition={{ duration: 0.5 }} className="text-4xl md:text-6xl font-bold tabular-nums inline-block origin-center">{match.awayScore ?? '-'}</motion.span>
                    </>
                  )}
                </div>
                {match.rescheduled && displayStatus !== 'rescheduled' && (
                  <div className="text-[8px] md:text-[10px] font-bold tracking-[0.2em] text-orange-400 mb-2">
                    Rescheduled Match
                  </div>
                )}
                <div className={`px-3 md:px-4 py-1 md:py-1.5 text-[10px] font-sans font-bold tracking-[0.1em] flex items-center gap-2 rounded-none ${
                  displayStatus === 'finished' ? 'bg-[#3B82F6] text-[#080808]' : 
                  displayStatus === 'rescheduled' ? 'bg-white/[0.08] backdrop-blur-xl text-[#3B82F6]' :
                  displayStatus === 'live' || displayStatus === 'ongoing' ? 'bg-[#EF4444] text-white' : 'bg-white/[0.08] backdrop-blur-xl text-[#555555]'
                }`}>
                  {(displayStatus === 'live' || displayStatus === 'ongoing') && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-2xl bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-2xl h-2 w-2 bg-white"></span>
                    </span>
                  )}
                  {displayStatus === 'finished' ? 'FINAL RESULT' : 
                   displayStatus === 'rescheduled' ? 'rescheduled' :
                   (displayStatus === 'live' || displayStatus === 'ongoing') ? 'LIVE' : 'UPCOMING'}
                </div>

                {isEditingMode && isAdmin && (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <p className="text-[10px] font-bold tracking-normal text-white/40">Edit Status</p>
                    <select 
                      value={match.status}
                      onChange={(e) => addLogAndUpdate('status', e.target.value as any, 'Match Status')}
                      className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2 text-xs font-bold tracking-normal text-white outline-none focus:border-fc-neon-green/50 transition-all hover:bg-white/10"
                    >
                      <option value="scheduled" className="bg-fc-purple-dark">Scheduled</option>
                      <option value="ongoing" className="bg-fc-purple-dark">Ongoing</option>
                      <option value="finished" className="bg-fc-purple-dark">Final Result</option>
                      <option value="rescheduled" className="bg-fc-purple-dark">Rescheduled</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col items-center text-center gap-4 p-4 rounded-2xl transition-colors">
                <div 
                  className="flex flex-col items-center text-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); if (awayTeam) window.dispatchEvent(new CustomEvent('openTeamProfile', { detail: awayTeam })) }}
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl md:text-4xl shadow-lg overflow-hidden">
                    {awayTeam?.logoUrl ? <img src={awayTeam.logoUrl} className="w-full h-full object-cover" /> : (awayTeam?.name[0] || '?')}
                  </div>
                  <div className="space-y-1">
                    <h2 className="font-display font-bold text-lg md:text-xl  tracking-tight pr-1 hover:text-fc-neon-green transition-colors">{awayTeam?.fullName || 'TBD'}</h2>
                    {awayTeam && (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-bold text-fc-neon-green/60 tracking-normal">FC: {awayTeam.fcName}</span>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 bg-fc-purple-light/20 border border-fc-neon-green/30 rounded text-[9px] font-bold text-fc-neon-green">OVR {awayTeam.ovr}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(awayTeam.uid);
                            }}
                            className="flex items-center gap-1.5 text-[9px] md:text-[10px] text-white/40 hover:text-fc-neon-green transition-colors group/uid"
                          >
                            <span className="font-mono font-bold tracking-wider">
                              {copiedId === awayTeam.uid ? 'Copied!' : 'Copy UID'}
                            </span>
                            {copiedId === awayTeam.uid ? (
                              <Check className="w-2.5 h-2.5 text-green-400" />
                            ) : (
                              <Copy className="w-2.5 h-2.5 opacity-40 group-hover/uid:opacity-100" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {isEditingMode ? (
                  <div className="mt-4 flex flex-col items-center gap-2 w-full md:max-w-[250px]">
                    <span className="text-[10px] font-bold text-fc-neon-green tracking-normal">Edit Scorers</span>
                    {localAwayScorers.map((s, i) => (
                      <div key={i} className="flex flex-col gap-1 bg-fc-purple-dark/20 p-2 rounded-2xl w-full border border-white/5">
                        <input type="text" value={s.playerName} onChange={e => { const newS = [...localAwayScorers]; newS[i].playerName = e.target.value; setLocalAwayScorers(newS); }} className="bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-fc-neon-green/50" placeholder="Player Name" />
                        <div className="flex gap-1 items-center">
                          <input type="number" value={s.goals} onChange={e => { const newS = [...localAwayScorers]; newS[i].goals = parseInt(e.target.value)||0; setLocalAwayScorers(newS); }} className="bg-white/5 border border-white/10 rounded px-2 py-1.5 w-12 text-xs text-white outline-none focus:border-fc-neon-green/50" placeholder="Goals" min="0" />
                          <input type="text" value={s.time||''} onChange={e => { const newS = [...localAwayScorers]; newS[i].time = e.target.value; setLocalAwayScorers(newS); }} className="bg-white/5 border border-white/10 rounded px-2 py-1.5 flex-1 w-0 min-w-[50px] text-xs text-white outline-none focus:border-fc-neon-green/50" placeholder="Time" />
                          <button onClick={(e) => { 
                            e.stopPropagation(); 
                            setLocalAwayScorers(prev => {
                              const newS = [...prev];
                              const scorer = newS.splice(i, 1)[0];
                              setLocalHomeScorers(prevH => [...prevH, scorer]);
                              return newS;
                            });
                          }} className="p-1 w-8 h-8 flex items-center justify-center shrink-0 bg-fc-neon-green/20 text-fc-neon-green hover:bg-fc-neon-green text-black hover:text-black rounded transition-colors" title="Swap to Home Team"><ArrowRightLeft className="w-3 h-3" /></button>
                          <button onClick={(e) => { e.stopPropagation(); const newS = [...localAwayScorers]; newS.splice(i, 1); setLocalAwayScorers(newS); }} className="p-1 w-8 h-8 flex shrink-0 items-center justify-center bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded transition-colors">&times;</button>
                        </div>
                      </div>
                    ))}
                    <button onClick={(e) => { e.stopPropagation(); setLocalAwayScorers([...localAwayScorers, { playerName: '', goals: 1 }]); }} className="text-[9px] bg-fc-purple-light/20 border border-fc-neon-green/50/30 text-fc-neon-green px-3 py-2 rounded-2xl font-bold tracking-normal hover:bg-fc-neon-green text-black hover:text-black transition-colors w-full">+ Add Scorer</button>
                    <button onClick={handleSaveScorers} disabled={isSavingScorers} className="mt-2 text-[10px] bg-green-500 text-white px-3 py-2 rounded-2xl font-bold tracking-normal hover:bg-green-600 transition-colors w-full">{isSavingScorers ? 'Saving...' : 'Save Scorers'}</button>
                  </div>
                ) : match.awayScorers && match.awayScorers.length > 0 ? (
                  <div className="mt-4 flex flex-col items-center gap-1">
                    {match.awayScorers.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] font-sans font-bold text-[#A0A0A0] tracking-normal">
                          {s.playerName} <span className="text-[#3B82F6] ml-1">{Array.from({ length: s.goals }).map((_, idx) => <span key={idx}>[G] </span>)}</span> {s.time && `(${s.time})`}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {displayStatus === 'finished' && (
              <>
                {match.manOfTheMatch || (isEditingMode && isAdmin) ? (
                  <div className="mt-6 flex flex-col items-center gap-2 bg-yellow-500/10 py-3 px-4 rounded-2xl border border-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.05)]">
                    <div className="flex items-center justify-center gap-2">
                      <Trophy className="w-4 h-4 text-yellow-500" />
                      <span className="text-[10px] font-bold tracking-normal text-yellow-500/80">Man of the Match: </span>
                    </div>
                    {isEditingMode && isAdmin ? (
                      <input 
                        type="text" 
                        defaultValue={match.manOfTheMatch || ''} 
                        placeholder="Player Name"
                        onBlur={(e) => addLogAndUpdate('manOfTheMatch', e.target.value, 'MOTM')}
                        className="bg-fc-purple-dark/40 border border-yellow-500/30 rounded-2xl px-3 py-1.5 text-xs font-bold tracking-normal text-yellow-400 outline-none focus:border-yellow-500 w-full max-w-[200px] text-center"
                      />
                    ) : (
                      <span className="text-sm font-display font-bold  text-yellow-400">{match.manOfTheMatch}</span>
                    )}
                  </div>
                ) : null}

                {match.homeStats && match.awayStats && (
                  <div className="mt-4 md:mt-6 space-y-4 p-4 md:p-6 bg-white/5 rounded-2xl border border-white/5">
                    <div className="text-center mb-1 md:mb-2">
                      <span className="text-[9px] md:text-[10px] font-bold text-fc-neon-green tracking-[0.2em] md:tracking-[0.3em]">Match Statistics</span>
                    </div>
                    <div className="grid gap-3 md:gap-4">
                      <StatRow 
                        home={`${match.homeStats.shotsOnTarget}/${match.homeStats.shots}`} 
                        away={`${match.awayStats.shotsOnTarget}/${match.awayStats.shots}`} 
                        label="Shots (On Target)" 
                        homeVal={match.homeStats.shots}
                        awayVal={match.awayStats.shots}
                      />
                      <StatRow home={match.homeStats.possession} away={match.awayStats.possession} label="Possession" suffix="%" />
                      <StatRow home={match.homeStats.passAccuracy} away={match.awayStats.passAccuracy} label="Pass Accuracy" suffix="%" />
                      <StatRow home={match.homeStats.saves} away={match.awayStats.saves} label="Saves" />
                      <StatRow home={match.homeStats.fouls} away={match.awayStats.fouls} label="Fouls" />
                      <StatRow home={match.homeStats.offsides} away={match.awayStats.offsides} label="Offsides" />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-3 md:gap-4 p-4 md:p-6 bg-white/5 rounded-2xl border border-white/5">
              <div className="text-center space-y-1">
                <div className="text-[9px] md:text-[10px] font-bold text-white/30 tracking-normal">Match Date</div>
                <div className="text-xs md:text-sm font-bold text-fc-neon-green">{match.date}</div>
              </div>
              <div className="text-center space-y-1 border-l border-white/5">
                <div className="text-[9px] md:text-[10px] font-bold text-white/30 tracking-normal">Match No.</div>
                <div className="flex items-center justify-center gap-2">
                  {isEditingMode && isAdmin ? (
                    <input 
                      type="number" 
                      min="1" 
                      defaultValue={match.matchNumber} 
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        addLogAndUpdate('matchNumber', isNaN(val) ? 1 : val, 'Match Number');
                      }}
                      className="w-16 bg-fc-purple-dark/40 border border-white/20 rounded px-2 py-1 text-center text-xs text-fc-neon-green outline-none focus:border-fc-neon-green/50 font-bold"
                    />
                  ) : (
                    <span className="text-xs md:text-sm font-bold text-fc-neon-green">#{match.matchNumber}</span>
                  )}
                </div>
              </div>
            </div>

            {match.evidenceUploadedBy && (
              <div className="mt-4 p-4 bg-fc-neon-green/5 border border-fc-neon-green/50/10 rounded-2xl flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-fc-neon-green text-black rounded-2xl animate-pulse" />
                  <span className="text-[10px] font-bold tracking-normal text-fc-neon-green">Result Verified by AI</span>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-bold text-white/40 tracking-normal">Reporter: <span className="text-white">{match.evidenceUploadedBy}</span></p>
                  {match.evidenceTimestamp && (
                    <p className="text-[8px] font-bold text-white/20 tracking-tight mt-0.5">Time: {formatTimestamp(match.evidenceTimestamp)}</p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-col items-center gap-4">
              <button 
                onClick={onClose}
                className="px-8 py-3 bg-fc-neon-green text-black hover:bg-fc-neon-green text-black text-black font-bold text-xs tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-fc-neon-green/20"
              >
                Close Details
              </button>
              
              {isAdmin && (
                <button 
                  onClick={() => {
                    if (window.confirm("Are you sure you want to reset this match result? This action cannot be undone.")) {
                      if (resetMatch) resetMatch(match.id);
                      onClose();
                    }
                  }}
                  className="px-6 py-2 bg-red-600/10 hover:bg-red-600 border border-red-500/20 hover:border-red-500 text-red-500 hover:text-white font-bold text-[10px] tracking-normal rounded-2xl transition-all flex items-center gap-2"
                >
                  <RotateCcw className="w-3 h-3" />
                  Admin: Reset Match Result
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const EditProfileModal = ({ 
    registration,
    onClose, 
    handleUpdateRegistration, 
    isSubmitting,
    config,
    registrations = []
  }: { 
    registration: Registration,
    onClose: () => void, 
    handleUpdateRegistration: (data: Registration) => Promise<void>, 
    isSubmitting: boolean,
    config?: Config,
    registrations?: Registration[]
  }) => {
    const [formData, setFormData] = useState({
      ...registration,
      name: registration.name || '',
      age: (registration.age || '').toString(),
      fcName: registration.fcName || '',
      teamOvr: (registration.teamOvr || '').toString(),
      experience: registration.experience || '',
      goalkeeper: registration.goalkeeper || '',
      logoUrl: registration.logoUrl || '',
      country: registration.country || ''
    });
    const [isCompressing, setIsCompressing] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsCompressing(true);
      try {
        const croppedBase64 = await cropToSquareImage(file);
        setFormData({ ...formData, logoUrl: croppedBase64 });
        setIsCompressing(false);
      } catch (error) {
        console.error("File read error:", error);
        alert("Failed to process image. Please try another one.");
        setIsCompressing(false);
      }
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (isCompressing) return;
      await handleUpdateRegistration({
        ...formData,
        age: Number(formData.age),
        teamOvr: Number(formData.teamOvr)
      } as Registration);
      onClose();
    };

    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-fc-purple-dark/90 backdrop-blur-xl"
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg bg-fc-purple-base border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        >
          <div className="p-6 md:p-8 border-b border-white/5 bg-gradient-to-b from-fc-neon-green/10 to-transparent">
            <div className="flex justify-between items-start mb-4 md:mb-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-display font-bold  text-white tracking-tight leading-none mb-2">Edit Campaign Profile</h2>
                <p className="text-fc-neon-green/60 text-[10px] font-bold tracking-[0.2em]">Update your tournament information</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 md:p-3 hover:bg-white/5 rounded-2xl transition-colors text-white/40 hover:text-white"
              >
                <X className="w-5 md:w-6 h-5 md:h-6" />
              </button>
            </div>
          </div>

          <div className="p-6 md:p-8 overflow-y-auto max-h-[70vh] hide-scrollbar">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-normal text-white/40">Full Name</label>
                {config?.allowedNames && config.allowedNames.length > 0 ? (
                  <select
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-fc-neon-green/50 outline-none transition-all text-sm appearance-none cursor-pointer"
                  >
                    <option value="">Select your name</option>
                    {config.allowedNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                    {/* Add current name if not in allowed list */}
                    {formData.name && !config.allowedNames.includes(formData.name) && (
                      <option value={formData.name}>{formData.name}</option>
                    )}
                  </select>
                ) : (
                  <input 
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-fc-neon-green/50 outline-none transition-all text-sm"
                  />
                )}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-normal text-white/40">Age</label>
                <input 
                  required
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({...formData, age: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-fc-neon-green/50 outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-normal text-white/40">FC Name</label>
                <input 
                  required
                  type="text"
                  value={formData.fcName}
                  onChange={(e) => setFormData({...formData, fcName: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-fc-neon-green/50 outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-normal text-white/40">Team OVR</label>
                <input 
                  required
                  type="number"
                  value={formData.teamOvr}
                  onChange={(e) => setFormData({...formData, teamOvr: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-fc-neon-green/50 outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-normal text-white/40">Goalkeeper Name</label>
                <input 
                  required
                  type="text"
                  value={formData.goalkeeper}
                  onChange={(e) => setFormData({...formData, goalkeeper: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-fc-neon-green/50 outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-bold tracking-normal text-white/40">Experience</label>
                <input 
                  required
                  type="text"
                  value={formData.experience}
                  onChange={(e) => setFormData({...formData, experience: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-fc-neon-green/50 outline-none transition-all text-sm"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-bold tracking-normal text-white/40">World Cup Country / Flag</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-48 overflow-y-auto pr-2 hide-scrollbar">
                  {(() => {
                    const takenCountries = registrations
                      ? registrations
                          .filter(r => r.id !== registration.id)
                          .map(r => r.country?.toLowerCase().trim())
                          .filter(Boolean) as string[]
                      : [];
                    return WORLD_CUP_TEAMS.map((team) => {
                      const isTaken = takenCountries.includes(team.name.toLowerCase().trim());
                      const isSelected = formData.country?.toLowerCase().trim() === team.name.toLowerCase().trim();
                      const isLocked = config?.lockedCountries?.includes(team.name);
                      return (
                        <button
                          key={team.name}
                          type="button"
                          disabled={(isTaken || isLocked) && !isSelected}
                          onClick={() => setFormData({...formData, country: team.name})}
                          className={`flex items-center gap-2 p-3 rounded-2xl border transition-all ${
                            isSelected 
                              ? 'bg-fc-neon-green/20 border-fc-neon-green text-white shadow-[0_0_15px_rgba(202,255,0,0.2)] font-bold' 
                              : (isTaken || isLocked)
                                ? 'bg-white/5 border-transparent text-white/30 cursor-not-allowed opacity-50'
                                : 'bg-white/5 border-white/10 hover:border-white/30 text-white/80 hover:bg-white/10'
                          }`}
                        >
                          <span className="text-xl">{team.flag}</span>
                          <span className="text-xs font-bold truncate">{team.name}</span>
                          {isTaken && !isSelected && <span className="text-[9px] ml-auto text-red-400 font-bold uppercase tracking-widest">Taken</span>}
                          {isLocked && !isSelected && <span className="text-[9px] ml-auto text-yellow-400 font-bold uppercase tracking-widest">Locked</span>}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-bold tracking-normal text-white/40">Logo Photo</label>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="edit-logo-upload" />
                <label htmlFor="edit-logo-upload" className="flex items-center justify-center gap-3 w-full bg-white/5 border border-dashed border-white/20 rounded-2xl p-8 cursor-pointer hover:bg-white/10 hover:border-fc-neon-green/50/50 transition-all">
                  {formData.logoUrl ? (
                    <img src={formData.logoUrl} className="max-h-32 max-w-full w-auto rounded-2xl object-contain border-2 border-fc-neon-green/50 shadow-lg" />
                  ) : <Plus className="w-6 h-6" />}
                </label>
              </div>
              <div className="md:col-span-2 pt-4">
                <button 
                  type="submit" 
                  disabled={isSubmitting || isCompressing}
                  className="w-full py-4 bg-fc-neon-green text-black hover:bg-fc-neon-green text-black disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-2xl font-bold text-xs tracking-normal transition-all"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    );
  };

  const TeamSearchableSelect = ({ label, value, onChange, teams, placeholder = "Search teammate...", showTbdOption = true }: { label: string, value: string, onChange: (val: string) => void, teams: Team[], placeholder?: string, showTbdOption?: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Get current team full name/fcName/name
    const currentSelectedName = useMemo(() => {
      if (value === 'TBD') return 'TBD';
      const safeTeams = teams || [];
      const team = safeTeams.find(t => t.id === value);
      return team ? (team.fullName || team.fcName || team.name || '') : (value || '');
    }, [value, teams]);

    // Initial search should be based on the current value if it's already a team name
    useEffect(() => {
      setSearch(currentSelectedName);
    }, [currentSelectedName]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          // Revert search input back to selected name if closed without selecting
          setSearch(currentSelectedName);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [currentSelectedName]);

    const filteredTeams = useMemo(() => {
      const safeTeams = teams || [];
      const lowerSearch = (search || '').toLowerCase();
      
      // If search text is exactly the currently selected name, do NOT filter (show all options so they see who is selected)
      const isUserSearching = search.trim().toLowerCase() !== currentSelectedName.trim().toLowerCase();
      
      const filtered = (search && isUserSearching) ? safeTeams.filter(t => 
        (t.fcName?.toLowerCase() || '').includes(lowerSearch) || 
        (t.name?.toLowerCase() || '').includes(lowerSearch) ||
        (t.fullName?.toLowerCase() || '').includes(lowerSearch)
      ) : safeTeams;

      // Sort alphabetically by full name
      return [...filtered].sort((a, b) => {
        const nameA = a.fullName || a.fcName || a.name || '';
        const nameB = b.fullName || b.fcName || b.name || '';
        return nameA.localeCompare(nameB);
      });
    }, [search, teams, currentSelectedName]);

    const showTbd = showTbdOption && (!search || 'tbd'.includes(search.toLowerCase()));

    return (
      <div className="space-y-2 relative" ref={dropdownRef}>
        <label className="text-[10px] font-bold text-white/40 tracking-normal">{label}</label>
        <div className="relative">
          <input 
            type="text" 
            value={search}
            onFocus={() => {
              setIsOpen(true);
            }}
            onChange={e => {
              setSearch(e.target.value);
              if (e.target.value === '') {
                onChange('');
              }
              setIsOpen(true);
            }} 
            placeholder={placeholder}
            className="w-full bg-fc-purple-dark/40 border border-white/10 rounded-2xl p-3 text-sm text-white focus:border-fc-neon-green/50 outline-none transition-all" 
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
        </div>

        <AnimatePresence>
          {isOpen && (filteredTeams.length > 0 || showTbd || search) && (
            <motion.div 
               initial={{ opacity: 0, y: -10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               className="absolute z-[110] left-0 right-0 mt-2 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto w-full animate-none"
            >
              {showTbd && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('TBD');
                    setSearch('TBD');
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left flex items-center gap-3 border-b border-white/5 transition-colors cursor-pointer ${
                    value === 'TBD' || !value
                      ? 'bg-fc-neon-green/20 text-white font-bold border-l-2 border-l-fc-neon-green'
                      : 'hover:bg-fc-purple-light/30 text-white/80'
                  }`}
                >
                  <div className="w-8 h-8 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <Users className={`w-4 h-4 ${value === 'TBD' || !value ? 'text-fc-neon-green animate-pulse' : 'text-fc-neon-green/40'}`} />
                  </div>
                  <div className="flex-1 truncate">
                    <p className={`text-xs truncate ${value === 'TBD' || !value ? 'text-fc-neon-green font-bold' : 'text-white font-bold'}`}>
                      TBD (To Be Determined)
                    </p>
                  </div>
                  {(value === 'TBD' || !value) && (
                    <div className="px-2 py-0.5 bg-fc-neon-green text-black text-[9px] uppercase tracking-wider font-extrabold rounded-md shrink-0 shadow-md">
                      Selected
                    </div>
                  )}
                </button>
              )}

              {filteredTeams.length > 0 ? (
                filteredTeams.map(team => {
                  const isSelected = team.id === value;
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => {
                        const displayValue = team.fullName || team.fcName || team.name;
                        onChange(team.id);
                        setSearch(displayValue);
                        setIsOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left flex items-center gap-3 border-b border-white/5 last:border-0 transition-colors cursor-pointer ${
                        isSelected 
                          ? 'bg-fc-neon-green/20 text-white font-bold border-l-2 border-l-fc-neon-green' 
                          : 'hover:bg-fc-purple-light/30 text-white/80'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                        {team.logoUrl ? (
                          <img src={team.logoUrl} alt="" className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
                        ) : (
                          <Star className={`w-4 h-4 ${isSelected ? 'text-fc-neon-green animate-pulse' : 'text-fc-neon-green/40'}`} />
                        )}
                      </div>
                      <div className="flex-1 truncate">
                        <p className={`text-xs truncate ${isSelected ? 'text-fc-neon-green font-bold' : 'text-white font-bold'}`}>
                          {team.fullName || team.fcName || team.name}
                        </p>
                        {team.country && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-xs">{WORLD_CUP_FLAGS.get(team.country) || '🌍'}</span>
                            <span className="text-[9px] text-white/40">{team.country}</span>
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <div className="px-2 py-0.5 bg-fc-neon-green text-black text-[9px] uppercase tracking-wider font-extrabold rounded-md shrink-0 shadow-md">
                          Selected
                        </div>
                      )}
                    </button>
                  );
                })
              ) : (
                !showTbd && (
                  <div className="p-4 text-center">
                    <p className="text-[10px] font-bold tracking-normal text-white/20 ">No matching players</p>
                  </div>
                )
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const AddMatchModal = ({ onClose, onSave, teams, initialDate = '2026-05-TBD', initialHome = '', initialAway = '' }: { onClose: () => void, onSave: (data: { date: string, home: string, away: string }) => void, teams: Team[], initialDate?: string, initialHome?: string, initialAway?: string }) => {
    const [date, setDate] = useState(initialDate);
    const [home, setHome] = useState(initialHome);
    const [away, setAway] = useState(initialAway);

    return (
      <div className="fixed inset-0 bg-fc-purple-dark/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-zinc-900 border border-white/10 p-8 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-fc-neon-green to-fc-purple-base" />
          
          <h2 className="text-2xl font-display font-bold  text-white mb-6">Add New Fixture</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold tracking-normal text-fc-neon-green mb-1 block">Match Date</label>
              <input 
                value={date}
                onChange={e => setDate(e.target.value)}
                placeholder="YYYY-MM-DD or TBD"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-fc-neon-green/50 transition-colors"
              />
            </div>

            <TeamSearchableSelect 
              label="Home Team / Player" 
              value={home} 
              onChange={setHome} 
              teams={teams} 
              placeholder="Search home player..."
            />

            <TeamSearchableSelect 
              label="Away Team / Player" 
              value={away} 
              onChange={setAway} 
              teams={teams} 
              placeholder="Search away player..."
            />
          </div>

          <div className="flex gap-4 mt-8">
            <button 
              onClick={onClose}
              className="flex-1 py-4 rounded-2xl font-bold text-xs tracking-normal text-white/40 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => onSave({ date, home, away })}
              className="flex-1 py-4 bg-fc-neon-green text-black hover:bg-fc-purple-light text-black rounded-2xl font-bold text-xs tracking-normal transition-all shadow-lg shadow-fc-neon-green/20"
            >
              Add Match
            </button>
          </div>

          <button onClick={onClose} className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    );
  };
  const RegistrationModal = ({ 
    onClose, 
    handleRegister, 
    isSubmitting, 
    hasRegistered,
    user,
    existingRegistrations,
    config
  }: { 
    onClose: () => void, 
    handleRegister: (data: any) => void, 
    isSubmitting: boolean,
    hasRegistered: boolean,
    user: User | null,
    existingRegistrations: Registration[],
    config: Config
  }) => {
    const takenCountries = useMemo(() => {
      if (!existingRegistrations) return [];
      return existingRegistrations.map(r => r.country).filter(Boolean) as string[];
    }, [existingRegistrations]);

    const [formData, setFormData] = useState({
      name: '',
      age: '',
      fcName: '',
      teamOvr: '',
      experience: '',
      goalkeeper: '',
      logoUrl: '',
      country: ''
    });
    const [isCompressing, setIsCompressing] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsCompressing(true);
      try {
        const croppedBase64 = await cropToSquareImage(file);
        setFormData({ ...formData, logoUrl: croppedBase64 });
        setIsCompressing(false);
      } catch (error) {
        console.error("File read error:", error);
        setIsCompressing(false);
      }
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.country) {
        alert("Please select a World Cup country.");
        return;
      }
      if (!formData.logoUrl) {
        alert("Please upload a logo/photo before submitting.");
        return;
      }
      if (isCompressing) {
        return;
      }
      handleRegister({
        ...formData,
        age: Number(formData.age),
        teamOvr: Number(formData.teamOvr)
      });
    };

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-fc-purple-dark/90 backdrop-blur-xl"
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg bg-fc-purple-base border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        >
          <div className="p-6 md:p-8 border-b border-white/5 bg-gradient-to-b from-fc-neon-green/10 to-transparent">
            <div className="flex justify-between items-start mb-4 md:mb-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-display font-bold  text-white tracking-tight leading-none mb-2">Tournament Registration</h2>
                <p className="text-fc-neon-green/60 text-[10px] font-bold tracking-[0.2em]">Join THE WORLD'S GAME</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 md:p-3 hover:bg-white/5 rounded-2xl transition-colors text-white/40 hover:text-white"
              >
                <X className="w-5 md:w-6 h-5 md:h-6" />
              </button>
            </div>
          </div>

          <div className="p-6 md:p-8 overflow-y-auto max-h-[70vh] hide-scrollbar">
            {!user || user.isAnonymous ? (
              <div className="text-center py-12 space-y-6">
                <div className="w-20 h-20 bg-fc-purple-light/30 rounded-2xl flex items-center justify-center mx-auto">
                  <LogIn className="w-10 h-10 text-fc-neon-green" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-display font-bold text-white ">Google Sign-In Required</h3>
                  <p className="text-white/40 text-sm max-w-xs mx-auto">To ensure secure registration and verify your identity, please sign in with your Google account.</p>
                </div>
                <button 
                  onClick={() => handleRegister({} as any)} 
                  className="w-full py-4 bg-fc-neon-green text-black hover:bg-fc-neon-green text-black text-black rounded-2xl font-bold text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl shadow-fc-neon-green/20"
                >
                  <LogIn className="w-4 h-4" />
                  Continue with Google
                </button>
              </div>
            ) : hasRegistered ? (
              <div className="text-center py-8 space-y-6">
                <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-display font-bold text-white  tracking-tight">Registration Submitted!</h3>
                  <p className="text-white/60 text-sm px-4">Your application has been received successfully.</p>
                </div>

                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-5 space-y-4 mx-4">
                  <p className="text-[11px] font-bold text-emerald-400 tracking-wider flex items-center justify-center gap-1.5 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Mandatory Next Step
                  </p>
                  <p className="text-white/80 text-xs leading-relaxed">
                    You <span className="text-emerald-300 font-extrabold underline">MUST</span> join the official WhatsApp Community to finalize your registration, coordinate with opponents, and view schedules.
                  </p>
                  <a 
                    href="https://chat.whatsapp.com/Hc4mGIatJYkI1myUbAWiv7"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 bg-[#25D366] hover:bg-[#20ba5a] text-black rounded-2xl font-bold text-xs tracking-normal transition-all shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] transform duration-150"
                  >
                    Join WhatsApp Community
                  </a>
                </div>

                <div className="px-4">
                  <button 
                    onClick={onClose}
                    className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold text-xs tracking-normal transition-all"
                  >
                    Keep Browsing
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-normal text-white/40">Full Name</label>
                  {config?.allowedNames && config.allowedNames.length > 0 ? (
                    <select
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-fc-neon-green/50 outline-none transition-all text-sm"
                    >
                      <option value="">-- Select Your Name --</option>
                      {config.allowedNames.map(name => {
                        const isTaken = existingRegistrations?.some(r => r.name.toLowerCase().trim() === name.toLowerCase().trim());
                        return (
                          <option key={name} value={name} disabled={isTaken}>
                            {name} {isTaken ? ' (Registered)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input 
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Enter your name"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-fc-neon-green/50 outline-none transition-all text-sm"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-normal text-white/40">Age</label>
                  <input 
                    required
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({...formData, age: e.target.value})}
                    placeholder="21"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-fc-neon-green/50 outline-none transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-normal text-white/40">FC Name</label>
                  <input 
                    required
                    type="text"
                    value={formData.fcName}
                    onChange={(e) => setFormData({...formData, fcName: e.target.value})}
                    placeholder="In-game name"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-fc-neon-green/50 outline-none transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-normal text-white/40">Team OVR</label>
                  <input 
                    required
                    type="number"
                    value={formData.teamOvr}
                    onChange={(e) => setFormData({...formData, teamOvr: e.target.value})}
                    placeholder="90"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-fc-neon-green/50 outline-none transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-normal text-white/40">Goalkeeper Name</label>
                  <input 
                    required
                    type="text"
                    value={formData.goalkeeper}
                    onChange={(e) => setFormData({...formData, goalkeeper: e.target.value})}
                    placeholder="Enter Goalkeeper Name"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-fc-neon-green/50 outline-none transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-normal text-white/40">Play Time / Experience</label>
                  <input 
                    required
                    type="text"
                    value={formData.experience}
                    onChange={(e) => setFormData({...formData, experience: e.target.value})}
                    placeholder="e.g. 2 years, since FIFA 22"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:border-fc-neon-green/50 outline-none transition-all text-sm"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold tracking-normal text-white/40">World Cup Country</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-60 overflow-y-auto pr-2 hide-scrollbar">
                    {WORLD_CUP_TEAMS.map((team) => {
                      const isTaken = takenCountries.some(tc => tc.toLowerCase().trim() === team.name.toLowerCase().trim());
                      const isSelected = formData.country && formData.country.toLowerCase().trim() === team.name.toLowerCase().trim();
                      const isLocked = config?.lockedCountries?.includes(team.name);
                      return (
                        <button
                          key={team.name}
                          type="button"
                          disabled={(isTaken || isLocked) && !isSelected}
                          onClick={() => setFormData({...formData, country: team.name})}
                          className={`flex items-center gap-2 p-3 rounded-2xl border transition-all ${
                            isSelected 
                              ? 'bg-fc-neon-green/20 border-fc-neon-green text-white shadow-[0_0_15px_rgba(202,255,0,0.2)]' 
                              : (isTaken || isLocked)
                                ? 'bg-white/5 border-transparent text-white/30 cursor-not-allowed opacity-50'
                                : 'bg-white/5 border-white/10 hover:border-white/30 text-white/80 hover:bg-white/10'
                          }`}
                        >
                          <span className="text-xl">{team.flag}</span>
                          <span className="text-xs font-bold truncate">{team.name}</span>
                          {isTaken && !isSelected && <span className="text-[9px] ml-auto text-red-400 font-bold uppercase tracking-widest">Taken</span>}
                          {isLocked && !isSelected && <span className="text-[9px] ml-auto text-yellow-400 font-bold uppercase tracking-widest">Locked</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold tracking-normal text-white/40">Team Logo / Photo (Optional)</label>
                  <div className="relative">
                    <input 
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      id="logo-upload"
                    />
                    <label 
                      htmlFor="logo-upload"
                      className="flex items-center justify-center gap-3 w-full bg-white/5 border border-dashed border-white/20 rounded-2xl p-8 cursor-pointer hover:bg-white/10 hover:border-fc-neon-green/50/50 transition-all group"
                    >
                      {formData.logoUrl ? (
                        <div className="flex flex-col items-center gap-2">
                          <img src={formData.logoUrl} alt="Preview" className="w-24 h-24 rounded-[16px] object-cover border-2 border-fc-neon-green/50 shadow-lg" />
                          <span className="text-[10px] font-bold text-fc-neon-green tracking-normal">Photo Selected</span>
                        </div>
                      ) : (
                        <>
                          <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-fc-purple-light/30 group-hover:text-fc-neon-green transition-all">
                            {isCompressing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold text-white">Click to Upload Photo</p>
                            <p className="text-[10px] text-white/30 font-bold">PNG, JPG</p>
                          </div>
                        </>
                      )}
                    </label>
                  </div>
                </div>
                <div className="md:col-span-2 pt-4">
                  <button 
                    type="submit"
                    disabled={isSubmitting || isCompressing}
                    className="w-full py-5 bg-fc-neon-green text-black hover:bg-fc-purple-light disabled:opacity-50 text-black rounded-2xl font-bold text-xs tracking-[0.3em] transition-all shadow-xl shadow-fc-neon-green/20"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Submit Registration"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    );
  };

  const AdminModal = ({ 
    onClose, 
    isAdmin,
    isDrawAdmin,
    user,
    bracket,
    isSavingBracket,
    handleSaveBracket,
    registrations,
    config,
    handleToggleRegistration,
    isSavingAdmin,
    handleAdminAiCommand,
    handleAdminReset,
    handleApproveRegistration,
    handleRejectRegistration,
    handleDeleteRegistration,
    handleResetAllRegistrations,
    isEditingMode,
    setIsEditingMode,
    matchLabels,
    updateMatchLabel,
    handleRenameMatchDate,
    matchesByDay,
    handleAnalyzeQualification,
    handleUpdateConfig,
    setAdminEditingRegistration,
    teams,
    matches,
    handleRandomizeGroups,
    handleClearGroups,
    refreshCache
  }: { 
    onClose: () => void, 
    isAdmin: boolean,
    isDrawAdmin: boolean,
    user: User | null,
    bracket: BracketMatch[],
    isSavingBracket: boolean,
    handleSaveBracket: (m: BracketMatch) => Promise<void>,
    registrations: Registration[],
    config: Config,
    handleToggleRegistration: () => void,
    isSavingAdmin: boolean,
    handleAdminAiCommand: (command: string) => Promise<void>,
    handleAdminReset: (type: 'matches' | 'bracket' | 'table' | 'registrations' | 'stats' | 'all') => Promise<void>,
    handleApproveRegistration: (id: string) => Promise<void>,
    handleRejectRegistration: (id: string) => Promise<void>,
    handleDeleteRegistration: (id: string) => Promise<void>,
    handleResetAllRegistrations: () => Promise<void>,
    isEditingMode: boolean,
    setIsEditingMode: (mode: boolean) => void,
    matchLabels: Record<string, string>,
    updateMatchLabel: (date: string, status: string) => Promise<void>,
    handleRenameMatchDate: (oldDate: string, newDate: string) => Promise<void>,
    matchesByDay: Record<string, Match[]>,
    handleAnalyzeQualification: () => Promise<void>,
    handleUpdateConfig: (config: Config) => Promise<void>,
    setAdminEditingRegistration: (reg: Registration | null) => void,
    teams: Team[],
    matches?: Match[],
    handleRandomizeGroups: () => Promise<void>,
    handleClearGroups: () => Promise<void>,
    refreshCache: (type: 'matches' | 'teams' | 'bracket' | 'config' | 'site_content' | 'cache_qual') => Promise<void>
  }) => {
    const [activeTab, setActiveTab] = useState<'bracket' | 'registrations' | 'label' | 'visibility' | 'ai' | 'reports' | 'backup' | 'edits' | 'schedule' | 'groups' | 'names' | 'countries' | 'draw_admin'>('bracket');
    const [newAllowedNameInput, setNewAllowedNameInput] = useState('');

    const [downloadingRegistration, setDownloadingRegistration] = useState<Registration | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const [adminUsers, setAdminUsers] = useState<any[]>([]);

    const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);
    const [editingGroupName, setEditingGroupName] = useState<string>('');
    const [editingGroupLabel, setEditingGroupLabel] = useState<string>('');

    const movePlayerToGroup = async (playerId: string, groupKey: string) => {
      const newAssignments = {
        ...(config.groupAssignments || {}),
      };
      if (groupKey) {
        newAssignments[playerId] = groupKey;
      } else {
        delete newAssignments[playerId];
      }
      await handleUpdateConfig({
        ...config,
        groupAssignments: newAssignments
      });
    };

    const handleSaveGroupDetails = async (groupKey: string) => {
      const newNames = { ...(config.groupNames || {}) };
      if (editingGroupName.trim() === '') {
        delete newNames[groupKey];
      } else {
        newNames[groupKey] = editingGroupName.trim();
      }

      const newLabels = { ...(config.groupLabels || {}) };
      if (editingGroupLabel.trim() === '') {
        delete newLabels[groupKey];
      } else {
        newLabels[groupKey] = editingGroupLabel.trim();
      }

      await handleUpdateConfig({
        ...config,
        groupNames: newNames,
        groupLabels: newLabels
      });
      setEditingGroupKey(null);
      setEditingGroupName('');
      setEditingGroupLabel('');
    };

    useEffect(() => {
      const fetchU = async () => {
        const snap = await getDocs(collection(db, 'users'));
        setAdminUsers(snap.docs.map(d => ({id: d.id, ...d.data() as any})).filter(u => u.role !== 'admin'));
      };
      if (activeTab === 'registrations') {
        fetchU();
      }
    }, [activeTab]);

    useEffect(() => {
      if (downloadingRegistration && cardRef.current) {
        const download = async () => {
          try {
            await new Promise(r => setTimeout(r, 150)); // let images load in portal
            const { toPng } = await import('html-to-image');
            const dataUrl = await toPng(cardRef.current!, { quality: 1, pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = `player_card_${downloadingRegistration.name.replace(/\s+/g, '_')}.png`;
            link.href = dataUrl;
            link.click();
          } catch (e) {
            console.error('Failed to generate card', e);
            alert('Failed to generate card overlay');
          } finally {
            setDownloadingRegistration(null);
          }
        };
        download();
      }
    }, [downloadingRegistration]);

    const DummyQRCode = () => (
      <svg viewBox="0 0 100 100" width="100%" height="100%" className="bg-white p-2 rounded-2xl text-black shadow-lg">
         <rect x="10" y="10" width="20" height="20" fill="currentColor" />
         <rect x="15" y="15" width="10" height="10" fill="white" />
         <rect x="70" y="10" width="20" height="20" fill="currentColor" />
         <rect x="75" y="15" width="10" height="10" fill="white" />
         <rect x="10" y="70" width="20" height="20" fill="currentColor" />
         <rect x="15" y="75" width="10" height="10" fill="white" />
         <rect x="40" y="40" width="20" height="20" fill="currentColor" />
         <rect x="10" y="40" width="10" height="10" fill="currentColor" />
         <rect x="25" y="50" width="10" height="10" fill="currentColor" />
         <rect x="40" y="10" width="10" height="10" fill="currentColor" />
         <rect x="55" y="25" width="10" height="10" fill="currentColor" />
         <rect x="70" y="40" width="10" height="10" fill="currentColor" />
         <rect x="85" y="55" width="10" height="10" fill="currentColor" />
         <rect x="70" y="70" width="10" height="10" fill="currentColor" />
         <rect x="40" y="80" width="10" height="10" fill="currentColor" />
         <rect x="55" y="70" width="10" height="10" fill="currentColor" />
         <rect x="85" y="20" width="10" height="10" fill="currentColor" />
         <rect x="40" y="55" width="10" height="10" fill="currentColor" />
         <rect x="20" y="35" width="10" height="10" fill="currentColor" />
      </svg>
    );

    const handleExportBackup = async () => {
      try {
        const collections = ['config', 'registrations', 'bracket', 'matches', 'match_labels', 'reports', 'users', 'site_content', 'stats']; // Core data
        const backupData: Record<string, any> = {};

        for (const colName of collections) {
          const snapshot = await getDocs(collection(db, colName));
          backupData[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `uxit_backup_${new Date().toISOString().slice(0,10)}.json`);
        document.body.appendChild(downloadAnchorNode); 
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
      } catch (err: any) {
        console.error("Backup failed:", err);
        alert(`Failed to create backup. Error: ${err.message || 'Unknown error'}`);
      }
    };

    const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!window.confirm("WARNING: This will overwrite your existing database with the backup data. Are you absolutely sure?")) {
        event.target.value = '';
        return;
      }

      setIsResetting(true);
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = JSON.parse(e.target?.result as string);
            for (const colName of Object.keys(data)) {
              for (const docData of data[colName]) {
                const { id, ...originalData } = docData;
                const docRef = doc(db, colName, id);
                await setDoc(docRef, originalData, { merge: true });
              }
            }
            alert("Backup restored successfully. Data is populating live.");
            setIsResetting(false);
          } catch (err) {
            console.error("Parse or restore error", err);
            alert("Failed to restore backup format.");
            setIsResetting(false);
          }
        };
        reader.readAsText(file);
      } catch (err) {
        console.error("File upload failed", err);
        setIsResetting(false);
      }
    };

    const [reports, setReports] = useState<MatchReport[]>([]);
    const [isReportsLoading, setIsReportsLoading] = useState(false);

    useEffect(() => {
      if (activeTab === 'reports') {
        setIsReportsLoading(true);
        const getReports = async () => {
          try {
            const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
            const snapshot = await getDocs(q);
            const reportsList = snapshot.docs.map(doc => ({ 
              id: doc.id, 
              ...doc.data() 
            } as MatchReport));
            setReports(reportsList);
          } catch (e) {
            console.error("Failed to fetch reports:", e);
          } finally {
            setIsReportsLoading(false);
          }
        };
        getReports();
      }
    }, [activeTab]);
    const [localApiKey, setLocalApiKey] = useState(config.geminiApiKey || '');
    const [localModel, setLocalModel] = useState(config.geminiModel || 'gemini-flash-latest');

    useEffect(() => {
      setLocalApiKey(config.geminiApiKey || '');
      setLocalModel(config.geminiModel || 'gemini-flash-latest');
    }, [config.geminiApiKey, config.geminiModel]);

    const [isTestingAi, setIsTestingAi] = useState(false);
    const handleTestAi = async () => {
      setIsTestingAi(true);
      try {
        const response = await fetch(`${VITE_API_URL}/api/test-ai`);
        const data = await response.json();
        if (data.success) {
          alert(data.message);
        } else {
          alert(`Test failed: ${data.message}`);
        }
      } catch (err: any) {
        alert(`Test failed: ${err.message}`);
      } finally {
        setIsTestingAi(false);
      }
    };

    const handleSaveAiSettings = async () => {
      await handleUpdateConfig({
        ...config,
        geminiApiKey: localApiKey,
        geminiModel: localModel
      });
      alert("AI Settings saved successfully!");
    };
    const [confirmReset, setConfirmReset] = useState<'matches' | 'bracket' | 'table' | 'registrations' | 'stats' | 'all' | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [isResetting, setIsResetting] = useState(false);

    const [awardUserId, setAwardUserId] = useState('');
    const [awardAchvId, setAwardAchvId] = useState('');
    const [isAwarding, setIsAwarding] = useState(false);

    const handleAwardSubmit = async () => {
      if (!awardUserId || !awardAchvId) return alert('Select both user and achievement');
      setIsAwarding(true);
      try {
        const userRef = doc(db, 'users', awardUserId);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data() || { achievements: [] };
        const unlockedIds = new Set((userData.achievements || []).map((a: any) => a.achievementId));
        if (!unlockedIds.has(awardAchvId)) {
          const updatedAchievements = [
            ...(userData.achievements || []),
            { achievementId: awardAchvId, unlockedAt: serverTimestamp(), seen: false }
          ];
          await setDoc(userRef, { achievements: updatedAchievements }, { merge: true });
          alert('Achievement successfully awarded!');
          setAwardUserId('');
          setAwardAchvId('');
        } else {
          alert('User already has this achievement');
        }
      } catch (e) {
        console.error(e);
        alert('Error awarding achievement');
      }
      setIsAwarding(false);
    };

    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
      useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = sortedDates.indexOf(active.id as string);
        const newIndex = sortedDates.indexOf(over.id as string);
        const newOrder = arrayMove(sortedDates, oldIndex, newIndex) as string[];
        await handleUpdateConfig({ ...config, dateOrder: newOrder });
      }
    };

    const sortedDates = useMemo(() => {
      const allDates = Object.keys(matchesByDay);
      if (config.dateOrder && config.dateOrder.length > 0) {
        const existingDates = config.dateOrder.filter(d => allDates.includes(d));
        const newDates = allDates.filter(d => !config.dateOrder!.includes(d)).sort();
        // Use Set to ensure final list has no duplicates
        return Array.from(new Set([...existingDates, ...newDates]));
      }
      return allDates.sort();
    }, [matchesByDay, config.dateOrder]);

    const moveDateLabel = async (date: string, direction: 'up' | 'down') => {
      const allDates = sortedDates;
      const index = allDates.indexOf(date);
      if (index < 0) return;
      if (direction === 'up' && index === 0) return;
      if (direction === 'down' && index === allDates.length - 1) return;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      const newOrder = arrayMove(allDates, index, newIndex) as string[];
      await handleUpdateConfig({ ...config, dateOrder: newOrder });
    };

    const toggleDateVisibility = async (date: string) => {
      const currentHidden = config.hiddenDates || [];
      const isHidden = currentHidden.includes(date);
      let newHidden = [...currentHidden];
      if (isHidden) {
        newHidden = newHidden.filter(d => d !== date);
      } else {
        newHidden.push(date);
      }
      await handleUpdateConfig({ ...config, hiddenDates: newHidden });
    };

    const SortableDateItem = ({ date, index, total, matchLabels, updateMatchLabel, isHidden }: { date: string, index: number, total: number, matchLabels: Record<string, string>, updateMatchLabel: (date: string, status: string) => Promise<void>, isHidden: boolean, key?: any }) => {
      const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: date });
      const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 'auto', position: 'relative' as any };
      const [isRenaming, setIsRenaming] = useState(false);
      const [newName, setNewName] = useState(date);

      const submitRename = async () => {
        if (newName.trim() && newName !== date) {
          await handleRenameMatchDate(date, newName.trim());
        }
        setIsRenaming(false);
      };

      return (
        <div ref={setNodeRef} style={style} className={`flex flex-col md:flex-row md:items-center justify-between p-4 bg-white/5 rounded-2xl border border-[${isHidden ? 'red-500/50' : 'white/10'}] ${isDragging ? 'shadow-2xl bg-fc-purple-light/30 border-fc-neon-green/50/50' : ''} ${isHidden ? 'opacity-50' : ''} gap-4`}>
          <div className="flex items-center gap-4">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2 hover:bg-white/5 rounded-2xl transition-colors">
              <Users className="w-4 h-4 text-white/20 select-none pointer-events-none" />
            </div>
            <div className="flex flex-col gap-1">
              <button disabled={index === 0} onClick={() => moveDateLabel(date, 'up')} className={`p-1 rounded bg-white/5 hover:bg-white/10 transition-colors ${index === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}>
                <ChevronUp className="w-3 h-3 text-white/60" />
              </button>
              <button disabled={index === total - 1} onClick={() => moveDateLabel(date, 'down')} className={`p-1 rounded bg-white/5 hover:bg-white/10 transition-colors ${index === total - 1 ? 'opacity-30 cursor-not-allowed' : ''}`}>
                <ChevronDown className="w-3 h-3 text-white/60" />
              </button>
            </div>
            {isRenaming ? (
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={newName} 
                  onChange={e => setNewName(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && submitRename()}
                  className="bg-black/50 border border-white/20 rounded px-2 py-1 text-sm text-white" 
                  autoFocus
                />
                <button onClick={submitRename} className="p-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/40"><Check className="w-4 h-4" /></button>
                <button onClick={() => { setIsRenaming(false); setNewName(date); }} className="p-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/40"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setIsRenaming(true)}>
                <span className="text-sm font-bold text-white group-hover:text-fc-neon-green transition-colors">{date} {isHidden && '(Hidden)'}</span>
                <Edit2 className="w-3 h-3 text-white/20 group-hover:text-fc-neon-green/50 opacity-0 group-hover:opacity-100 transition-all" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => toggleDateVisibility(date)}
              className={`p-2 rounded-2xl font-bold text-xs transition-colors ${isHidden ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'}`}
            >
              {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <select 
              value={matchLabels[date] || 'scheduled'}
              onChange={(e) => updateMatchLabel(date, e.target.value)}
              className="bg-fc-purple-dark/40 border border-white/10 rounded-2xl p-2 text-white text-xs font-bold tracking-normal outline-none focus:border-fc-neon-green/50"
            >
              <option value="scheduled">Scheduled</option>
              <option value="ongoing">Ongoing</option>
              <option value="finished">Final Result</option>
            </select>
          </div>
        </div>
      );
    };
    const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
    const [editHomeName, setEditHomeName] = useState('');
    const [editAwayName, setEditAwayName] = useState('');
    const [editRound, setEditRound] = useState('');
    const [editHomeScore, setEditHomeScore] = useState(0);
    const [editAwayScore, setEditAwayScore] = useState(0);
    const [editLinkedMatchId, setEditLinkedMatchId] = useState('');
    const firstInputRef = React.useRef<HTMLInputElement>(null);

    const startEditingMatch = (match: BracketMatch) => {
      setEditingMatchId(match.id);
      setEditHomeName(match.homeTeamName || '');
      setEditAwayName(match.awayTeamName || '');
      setEditRound(match.round || '');
      setEditHomeScore(match.homeScore || 0);
      setEditAwayScore(match.awayScore || 0);
      setEditLinkedMatchId(match.linkedMatchId || '');
      setTimeout(() => firstInputRef.current?.focus(), 100);
    };

    const saveMatch = async () => {
      if (!editingMatchId) return;
      
      const resolveName = (idOrName: string) => {
        const team = teams.find(t => t.id === idOrName);
        return team ? (team.fullName || team.fcName || team.name) : idOrName;
      };

      let finalRound = editRound;
      if (editingMatchId.startsWith('r16-')) finalRound = 'Round of 16';
      else if (editingMatchId.startsWith('qf-')) finalRound = 'Quarter-Finals';
      else if (editingMatchId.startsWith('sf-')) finalRound = 'Semi-Finals';
      else if (editingMatchId === 'final') finalRound = 'Grand Final';
      else if (editingMatchId === 'third-place') finalRound = '3rd Place Match';

      await handleSaveBracket({
        id: editingMatchId,
        homeTeamId: editHomeName,
        awayTeamId: editAwayName,
        homeTeamName: resolveName(editHomeName),
        awayTeamName: resolveName(editAwayName),
        round: finalRound,
        homeScore: editHomeScore,
        awayScore: editAwayScore,
        linkedMatchId: editLinkedMatchId || undefined
      });
      setEditingMatchId(null);
    };

    const [aiCommand, setAiCommand] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);

    const handleAiSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!aiCommand.trim()) return;
      setIsAiLoading(true);
      await handleAdminAiCommand(aiCommand);
      setAiCommand('');
      setIsAiLoading(false);
    };

    const handleGenerateFixturesFromBracket = async () => {
      if (!window.confirm("This will auto-generate matches in the Fixtures tab for any bracket slots that are not currently linked. Proceed?")) return;
      try {
        const batch = writeBatch(db);
        let updates = 0;
        for (const bMatch of bracket) {
          if (!bMatch.linkedMatchId) {
             const randomId = Math.random().toString(36).substring(2);
             const newMatchRef = doc(db, 'matches', randomId);
             const homeTeam = teams.find(t => t.name === bMatch.homeTeamName || (bMatch.homeTeamId && t.id === bMatch.homeTeamId));
             const awayTeam = teams.find(t => t.name === bMatch.awayTeamName || (bMatch.awayTeamId && t.id === bMatch.awayTeamId));
             
             const matchRoundStr = String(bMatch.round);
             let matchType: Match['type'] = 'qualifier';
             if (matchRoundStr === 'r16') matchType = 'qualifier';
             else if (matchRoundStr === 'qf') matchType = 'quarterfinal';
             else if (matchRoundStr === 'sf') matchType = 'semifinal';
             else if (matchRoundStr.toLowerCase().includes('final') && !matchRoundStr.toLowerCase().includes('quarter') && !matchRoundStr.toLowerCase().includes('semi')) {
                 matchType = 'final';
             }
             
             const matchData: Match = {
               id: newMatchRef.id,
               matchNumber: matches.length + updates + 1,
               date: 'TBD',
               homeTeamId: homeTeam ? homeTeam.id : 'TBD',
               awayTeamId: awayTeam ? awayTeam.id : 'TBD',
               status: 'scheduled',
               type: matchType,
               leg: bMatch.leg
             };
             batch.set(newMatchRef, matchData);
             
             const bracketRef = doc(db, 'bracket', bMatch.id);
             batch.update(bracketRef, { linkedMatchId: newMatchRef.id });
             updates++;
          }
        }

        if (updates > 0) {
          await batch.commit();
          await refreshCache('matches');
          await refreshCache('bracket');
          alert(`Successfully generated and linked ${updates} fixtures from bracket.`);
        } else {
          alert("No unlinked bracket matches found.");
        }
      } catch(e) {
        console.error(e);
        alert("Error syncing bracket to fixtures.");
      }
    };

    if (!isAdmin && !isDrawAdmin) {
      return (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-fc-purple-dark text-white flex flex-col items-center justify-center font-sans tracking-tight"
        >
          <div className="text-center max-w-sm px-6">
            <h2 className="text-2xl font-bold mb-4 text-red-500">Access Restricted</h2>
            <p className="text-white/60 mb-8">This panel has been strictly disabled or you lack required permissions.</p>
            <button onClick={onClose} className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all font-bold">Close</button>
          </div>
        </motion.div>
      );
    }

    if (!isAdmin && isDrawAdmin) {
      return (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-fc-purple-dark text-white flex flex-col font-sans overflow-y-auto"
        >
          <div className="flex flex-col md:flex-row items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-white/5 bg-fc-purple-dark/40 backdrop-blur-md sticky top-0 z-20 gap-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={onClose}
                className="group flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 shrink-0"
              >
                <ArrowLeft className="w-4 md:w-5 h-4 md:h-5 text-fc-neon-green group-hover:-translate-x-1 transition-transform" />
                <span className="text-[9px] md:text-[10px] font-bold tracking-normal whitespace-nowrap">Back</span>
              </button>
            </div>
            <h2 className="text-lg md:text-2xl font-display font-bold  leading-none text-white tracking-tight truncate">Live Draw Admin</h2>
          </div>
          <div className="p-4 md:p-8">
            <DrawAdminPanel 
              registrations={registrations} 
              config={config} 
              handleUpdateConfig={handleUpdateConfig} 
              matches={matches}
              bracket={bracket}
              teams={teams}
              handleSaveBracket={handleSaveBracket}
            />
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-fc-purple-dark text-white flex flex-col font-sans"
      >
        <div className="flex flex-col md:flex-row items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-white/5 bg-fc-purple-dark/40 backdrop-blur-md sticky top-0 z-20 gap-4">
          <div className="flex items-center gap-3 md:gap-6 w-full md:w-auto overflow-x-auto hide-scrollbar">
            <button 
              onClick={onClose}
              className="group flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 shrink-0"
            >
              <ArrowLeft className="w-4 md:w-5 h-4 md:h-5 text-fc-neon-green group-hover:-translate-x-1 transition-transform" />
              <span className="text-[9px] md:text-[10px] font-bold tracking-normal whitespace-nowrap">Back</span>
            </button>
            <div className="h-6 md:h-8 w-[1px] bg-white/10 shrink-0" />
            <div className="min-w-0 text-left">
              <h2 className="text-lg md:text-2xl font-display font-bold  leading-none text-white tracking-tight truncate">Admin Terminal</h2>
              <p className="text-fc-neon-green/40 text-[8px] md:text-[9px] font-bold tracking-[0.2em] mt-0.5 md:mt-1 truncate max-w-[200px]">
                {user?.email || 'System'} | {isAdmin ? 'AUTHORIZED' : 'ACCESS DENIED'}
              </p>
            </div>
          </div>

          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 w-full md:w-auto overflow-x-auto hide-scrollbar">
            <button 
              onClick={() => setIsEditingMode(!isEditingMode)}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-2xl text-[9px] md:text-[10px] font-bold tracking-nowrap tracking-normal transition-all min-w-fit ${isEditingMode ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-green-600 text-white shadow-lg shadow-green-600/20'}`}
            >
              {isEditingMode ? 'Editing Enabled' : 'Editing Disabled'}
            </button>
            <div className="w-px bg-white/10 mx-2 flex-shrink-0" />
            <button 
              onClick={() => setActiveTab('bracket')}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-2xl text-[9px] md:text-[10px] font-bold tracking-nowrap tracking-normal transition-all min-w-fit ${activeTab === 'bracket' ? 'bg-fc-neon-green text-black text-black shadow-lg shadow-fc-neon-green/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Bracket
            </button>
            <button 
              onClick={() => setActiveTab('registrations')}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-2xl text-[9px] md:text-[10px] font-bold tracking-nowrap tracking-normal transition-all min-w-fit ${activeTab === 'registrations' ? 'bg-fc-neon-green text-black text-black shadow-lg shadow-fc-neon-green/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Applicants
            </button>
            <button 
              onClick={() => setActiveTab('groups')}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-2xl text-[9px] md:text-[10px] font-bold tracking-nowrap tracking-normal transition-all min-w-fit ${activeTab === 'groups' ? 'bg-fc-neon-green text-black text-black shadow-lg shadow-fc-neon-green/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Groups Manager
            </button>
            <button 
              onClick={() => setActiveTab('schedule')}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-2xl text-[9px] md:text-[10px] font-bold tracking-nowrap tracking-normal transition-all min-w-fit ${activeTab === 'schedule' ? 'bg-fc-neon-green text-black text-black shadow-lg shadow-fc-neon-green/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Schedule Generator
            </button>
            <button 
              onClick={() => setActiveTab('label')}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-2xl text-[9px] md:text-[10px] font-bold tracking-nowrap tracking-normal transition-all min-w-fit ${activeTab === 'label' ? 'bg-fc-neon-green text-black text-black shadow-lg shadow-fc-neon-green/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Label
            </button>
            <button 
              onClick={() => setActiveTab('visibility')}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-2xl text-[9px] md:text-[10px] font-bold tracking-nowrap tracking-normal transition-all min-w-fit ${activeTab === 'visibility' ? 'bg-fc-neon-green text-black text-black shadow-lg shadow-fc-neon-green/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Visibility
            </button>
            <button 
              onClick={() => setActiveTab('names')}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-2xl text-[9px] md:text-[10px] font-bold tracking-nowrap tracking-normal transition-all min-w-fit ${activeTab === 'names' ? 'bg-fc-neon-green text-black text-black shadow-lg shadow-fc-neon-green/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Allowed Names
            </button>
            <button 
              onClick={() => setActiveTab('countries')}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-2xl text-[9px] md:text-[10px] font-bold tracking-nowrap tracking-normal transition-all min-w-fit ${activeTab === 'countries' ? 'bg-fc-neon-green text-black text-black shadow-lg shadow-fc-neon-green/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Country Locking
            </button>
            <button 
              onClick={() => setActiveTab('draw_admin')}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-2xl text-[9px] md:text-[10px] font-bold tracking-nowrap tracking-normal transition-all min-w-fit ${activeTab === 'draw_admin' ? 'bg-fc-neon-green text-black text-black shadow-lg shadow-fc-neon-green/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Draw Admin
            </button>

            <button 
              onClick={() => setActiveTab('backup')}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-2xl text-[9px] md:text-[10px] font-bold tracking-nowrap tracking-normal transition-all min-w-fit ${activeTab === 'backup' ? 'bg-fc-neon-green text-black text-black shadow-lg shadow-fc-neon-green/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Backup
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar p-4 md:p-8 lg:p-12">
          <div className="max-w-6xl mx-auto w-full">
            <div className="mb-12 bg-fc-neon-green/5 border border-fc-neon-green/30 rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-fc-purple-light/30 rounded-2xl flex items-center justify-center border border-fc-neon-green/50/30">
                  <Star className="w-5 h-5 text-fc-neon-green animate-pulse" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-display font-bold  text-white">AI Tournament Assistant</h3>
                  <p className="text-fc-neon-green/40 text-[9px] tracking-normal">
                    Model: {config.geminiModel || 'gemini-3-flash-preview'}
                  </p>
                </div>
              </div>
              <form onSubmit={handleAiSubmit} className="flex gap-4">
                <input 
                  type="text" 
                  value={aiCommand}
                  onChange={e => setAiCommand(e.target.value)}
                  placeholder="e.g. 'Team A vs Team B ended 3-2. Scorers: John x2, Mike x1' or 'Reset all matches'"
                  className="flex-1 bg-fc-purple-dark/40 border border-white/10 rounded-2xl px-6 py-4 text-sm outline-none focus:border-fc-neon-green/50 transition-all"
                />
                <button 
                  disabled={isAiLoading}
                  className="px-8 bg-fc-neon-green text-black hover:bg-fc-purple-light disabled:opacity-50 rounded-2xl font-bold text-[10px] tracking-normal transition-all shadow-xl shadow-fc-neon-green/20 flex items-center gap-3 shrink-0"
                >
                  {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                  Execute
                </button>
              </form>
            </div>
            {activeTab === 'bracket' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-12">
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-display font-bold text-fc-neon-green flex items-center gap-3">
                          <Layout className="w-6 h-6" />
                          Live Bracket Editor
                        </h3>
                        <button 
                          onClick={handleGenerateFixturesFromBracket}
                          className="bg-fc-purple-light/20 text-white hover:bg-fc-neon-green hover:text-black hover:border-fc-neon-green transition-all px-4 py-2 rounded-2xl border border-white/20 text-[10px] font-bold"
                        >
                          Generate Fixtures
                        </button>
                      </div>
                      <div className="space-y-4">
                      {['Round of 16', 'Quarter-Finals', 'Semi-Finals', 'Grand Final', '3rd Place Match'].map(round => {
                        const resolveLinkedScoresLocal = (bracketMatch: BracketMatch) => {
                          if (bracketMatch.linkedMatchId) {
                            const fixtureMatch = matches.find(m => m.id === bracketMatch.linkedMatchId);
                            if (fixtureMatch) {
                              return {
                                ...bracketMatch,
                                homeScore: fixtureMatch.homeScore !== undefined ? fixtureMatch.homeScore : bracketMatch.homeScore,
                                awayScore: fixtureMatch.awayScore !== undefined ? fixtureMatch.awayScore : bracketMatch.awayScore
                              };
                            }
                          }
                          return bracketMatch;
                        };
                        const roundMatches = bracket.filter(m => {
                          if (round === 'Round of 16') {
                            return m.round === 'Round of 16' || m.round === 'r16' || m.id.startsWith('r16-');
                          }
                          if (round === 'Quarter-Finals') {
                            return m.round === 'Quarter-Finals' || m.round === 'qf' || m.id.startsWith('qf-');
                          }
                          if (round === 'Semi-Finals') {
                            return m.round === 'Semi-Finals' || m.round === 'sf' || m.id.startsWith('sf-');
                          }
                          if (round === 'Grand Final') {
                            return m.round === 'Grand Final' || m.id === 'final';
                          }
                          if (round === '3rd Place Match') {
                            return m.round === '3rd Place Match' || m.id === 'third-place';
                          }
                          return m.round === round;
                        }).map(m => resolveLinkedScoresLocal(m));
                        if (roundMatches.length === 0) return null;
                        return (
                          <div key={round} className="space-y-4">
                            <h4 className="text-[10px] font-bold tracking-normal text-white/40 mb-2 border-b border-white/5 pb-2">{round}</h4>
                            <div className="grid grid-cols-1 gap-3">
                              {roundMatches.map(match => (
                                <div key={match.id} className={`p-4 md:p-5 rounded-2xl border transition-all ${editingMatchId === match.id ? 'bg-fc-purple-light/20 border-fc-neon-green/50' : 'bg-white/5 border-white/5 hover:border-white/20'}`}>
                                  {editingMatchId === match.id ? (
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <TeamSearchableSelect 
                                          label="Home Team" 
                                          value={editHomeName} 
                                          onChange={setEditHomeName} 
                                          teams={teams} 
                                        />
                                        <TeamSearchableSelect 
                                          label="Away Team" 
                                          value={editAwayName} 
                                          onChange={setEditAwayName} 
                                          teams={teams} 
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[9px] font-bold text-white/40">Link to Existing Match (Optional)</label>
                                        <select
                                          value={editLinkedMatchId}
                                          onChange={e => setEditLinkedMatchId(e.target.value)}
                                          className="w-full border p-2.5 rounded-2xl bg-fc-purple-dark text-white border-white/5 text-xs"
                                        >
                                          <option value="">-- No Match Linked --</option>
                                          {matches.map(m => {
                                            const homeTeam = teams.find(t => t.id === m.homeTeamId);
                                            const awayTeam = teams.find(t => t.id === m.awayTeamId);
                                            const matchLabel = m.matchday ? `Matchday ${m.matchday}` : (m.type || 'Match');
                                            return (
                                              <option key={`link-${m.id}`} value={m.id}>
                                                {matchLabel} - {homeTeam?.name || m.homeTeamId || 'TBD'} vs {awayTeam?.name || m.awayTeamId || 'TBD'} ({m.homeScore ?? '-'}-{m.awayScore ?? '-'} - {m.status})
                                              </option>
                                            );
                                          })}
                                        </select>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                          <label className="text-[9px] font-bold text-white/40">Home Score</label>
                                          <input type="number" value={editHomeScore} onChange={e => setEditHomeScore(Number(e.target.value))} className="w-full bg-fc-purple-dark/40 border border-white/10 rounded-2xl p-3 text-sm text-white focus:border-fc-neon-green/50 outline-none" />
                                        </div>
                                        <div className="space-y-2">
                                          <label className="text-[9px] font-bold text-white/40">Away Score</label>
                                          <input type="number" value={editAwayScore} onChange={e => setEditAwayScore(Number(e.target.value))} className="w-full bg-fc-purple-dark/40 border border-white/10 rounded-2xl p-3 text-sm text-white focus:border-fc-neon-green/50 outline-none" />
                                        </div>
                                        <div className="flex items-end gap-2">
                                          <button onClick={saveMatch} className="h-11 flex-1 bg-green-500 text-black font-bold text-[10px] tracking-normal rounded-2xl hover:bg-green-400 transition-all">Save</button>
                                          <button onClick={() => setEditingMatchId(null)} className="h-11 px-4 bg-white/10 text-white font-bold text-[10px] tracking-normal rounded-2xl hover:bg-white/20 transition-all">Cancel</button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between group">
                                      <div className="flex-1 space-y-2">
                                        <div className="flex justify-between items-center bg-fc-purple-dark/20 p-2 px-3 rounded-2xl">
                                          <span className="text-xs font-bold text-white/90">{match.homeTeamName}</span>
                                          <span className="text-lg font-display font-bold  text-fc-neon-green">{match.homeScore}</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-fc-purple-dark/20 p-2 px-3 rounded-2xl">
                                          <span className="text-xs font-bold text-white/90">{match.awayTeamName}</span>
                                          <span className="text-lg font-display font-bold  text-fc-neon-green">{match.awayScore}</span>
                                        </div>
                                      </div>
                                      <button onClick={() => startEditingMatch(match)} className="ml-4 md:ml-6 p-3 md:p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-fc-neon-green hover:text-white transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100">
                                        <Edit3 className="w-4 md:w-5 h-4 md:h-5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                         );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-12">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-8 sticky top-0">
                    <h3 className="text-xl font-display font-bold  text-fc-neon-green mb-6 flex items-center gap-3">
                      <Settings className="w-6 h-6" />
                      Global Config
                    </h3>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-6 bg-white/5 border border-white/5 rounded-2xl group">
                        <div>
                          <p className="text-sm font-bold text-white mb-1">Registration Portal</p>
                          <p className="text-[10px] font-bold tracking-normal text-white/30">Enable or disable user applications</p>
                        </div>
                        <button 
                          onClick={handleToggleRegistration}
                          disabled={isSavingAdmin}
                          className={`w-14 h-8 rounded-2xl flex items-center p-1 transition-all ${config.registrationEnabled ? 'bg-green-500' : 'bg-white/10'}`}
                        >
                          <div className={`w-6 h-6 rounded-2xl bg-white shadow-md transition-all ${config.registrationEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {/* Tournament Group Configuration */}
                      <div className="p-6 bg-white/5 border border-white/5 rounded-2xl space-y-4">
                        <div>
                          <p className="text-sm font-bold text-white mb-1">Group Stage Format</p>
                          <p className="text-[10px] font-bold tracking-normal text-white/30 mb-3">Choose tournament group stage structure</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateConfig({ ...config, groupType: 'single' })}
                            className={`py-2.5 px-4 rounded-xl text-xs font-bold font-sans transition-all flex items-center justify-center gap-1.5 border ${
                              (!config.groupType || config.groupType === 'single')
                                ? 'bg-[#3B82F6] text-white border-[#3B82F6] shadow-md shadow-[#3B82F6]/15'
                                : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10'
                            }`}
                          >
                            Single League Table
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateConfig({ ...config, groupType: 'many' })}
                            className={`py-2.5 px-4 rounded-xl text-xs font-bold font-sans transition-all flex items-center justify-center gap-1.5 border ${
                              config.groupType === 'many'
                                ? 'bg-[#3B82F6] text-white border-[#3B82F6] shadow-md shadow-[#3B82F6]/15'
                                : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10'
                            }`}
                          >
                            Many Groups (A, B, C...)
                          </button>
                        </div>
                      </div>

                      {config.groupType === 'many' && (
                        <div className="p-6 bg-white/5 border border-white/5 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div>
                            <p className="text-sm font-bold text-white mb-1">Players per Group</p>
                            <p className="text-[10px] font-bold tracking-normal text-white/30 mb-3">Select the ideal group size (3 or 4 players)</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {[3, 4].map((size) => (
                              <button
                                key={size}
                                type="button"
                                onClick={() => handleUpdateConfig({ ...config, playersPerGroup: size })}
                                className={`py-2.5 px-4 rounded-xl text-xs font-bold font-sans transition-all flex items-center justify-center gap-1.5 border ${
                                  (config.playersPerGroup === size || (!config.playersPerGroup && size === 3))
                                    ? 'bg-fc-neon-green text-black border-fc-neon-green shadow-md shadow-fc-neon-green/15'
                                    : 'bg-white/5 text-white/60 border-white/5 hover:bg-white/10'
                                }`}
                              >
                                {size} Players
                              </button>
                            ))}
                          </div>

                          <div className="pt-2 border-t border-white/5 space-y-3">
                            <p className="text-xs font-bold text-white/80">Group Stage Actions</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={handleRandomizeGroups}
                                className="w-full py-2.5 px-4 bg-fc-neon-green hover:brightness-110 text-black font-sans text-xs font-bold rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-fc-neon-green/10"
                              >
                                <Users className="w-4 h-4" />
                                Randomize Groups
                              </button>
                              <button
                                type="button"
                                onClick={handleClearGroups}
                                className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 text-white/80 font-sans text-xs font-bold rounded-xl active:scale-[0.98] border border-white/10 transition-all flex items-center justify-center gap-1.5"
                              >
                                <Trash2 className="w-4 h-4" />
                                Clear Groups
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="p-6 bg-fc-purple-light/20 border border-fc-neon-green/30 rounded-2xl">
                        <div className="flex items-center gap-3 mb-3">
                          <Users className="w-5 h-5 text-fc-neon-green" />
                          <h4 className="text-[10px] font-bold tracking-normal text-fc-neon-green">Total Applicants</h4>
                        </div>
                        <p className="text-5xl font-display font-bold  text-white">{registrations.length}</p>
                      </div>
                    <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
                      <div className="flex items-center gap-3 mb-4 text-red-400">
                        <Trash2 className="w-5 h-5" />
                        <h4 className="text-[10px] font-bold tracking-normal">Danger Zone</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          disabled={isResetting}
                          onClick={() => {
                            if (confirmReset === 'matches') {
                              setIsResetting(true);
                              handleAdminReset('matches').finally(() => setIsResetting(false));
                              setConfirmReset(null);
                            } else {
                              setConfirmReset('matches');
                            }
                          }} 
                          className={`relative px-4 py-3 border rounded-2xl text-[9px] font-bold tracking-normal transition-all ${confirmReset === 'matches' ? 'bg-red-600 border-red-600 text-white animate-pulse' : 'bg-red-600/10 border-red-500/20 text-red-500 hover:bg-red-600 hover:text-white'}`}
                        >
                          {isResetting && confirmReset === 'matches' ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : (confirmReset === 'matches' ? 'Confirm Reset Matches' : 'Reset Matches')}
                        </button>
                        <button 
                          disabled={isResetting}
                          onClick={() => {
                            if (confirmReset === 'bracket') {
                              setIsResetting(true);
                              handleAdminReset('bracket').finally(() => setIsResetting(false));
                              setConfirmReset(null);
                            } else {
                              setConfirmReset('bracket');
                            }
                          }} 
                          className={`relative px-4 py-3 border rounded-2xl text-[9px] font-bold tracking-normal transition-all ${confirmReset === 'bracket' ? 'bg-red-600 border-red-600 text-white animate-pulse' : 'bg-red-600/10 border-red-500/20 text-red-500 hover:bg-red-600 hover:text-white'}`}
                        >
                          {isResetting && confirmReset === 'bracket' ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : (confirmReset === 'bracket' ? 'Confirm Reset Bracket' : 'Reset Bracket')}
                        </button>
                        <button 
                          disabled={isResetting}
                          onClick={() => {
                            if (confirmReset === 'registrations') {
                              setIsResetting(true);
                              handleAdminReset('registrations').finally(() => setIsResetting(false));
                              setConfirmReset(null);
                            } else {
                              setConfirmReset('registrations');
                            }
                          }} 
                          className={`relative px-4 py-3 border rounded-2xl text-[9px] font-bold tracking-normal transition-all ${confirmReset === 'registrations' ? 'bg-red-600 border-red-600 text-white animate-pulse' : 'bg-red-600/10 border-red-500/20 text-red-500 hover:bg-red-600 hover:text-white'}`}
                        >
                          {isResetting && confirmReset === 'registrations' ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : (confirmReset === 'registrations' ? 'Confirm Reset Applicants' : 'Reset Applicants')}
                        </button>
                        <button 
                          disabled={isResetting}
                          onClick={() => {
                            if (confirmReset === 'table') {
                              setIsResetting(true);
                              handleAdminReset('table').finally(() => setIsResetting(false));
                              setConfirmReset(null);
                            } else {
                              setConfirmReset('table');
                            }
                          }} 
                          className={`relative px-4 py-3 border rounded-2xl text-[9px] font-bold tracking-normal transition-all ${confirmReset === 'table' ? 'bg-orange-600 border-orange-600 text-white animate-pulse' : 'bg-orange-600/10 border-orange-500/20 text-orange-500 hover:bg-orange-600 hover:text-white'}`}
                        >
                          {isResetting && confirmReset === 'table' ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : (confirmReset === 'table' ? 'Confirm Reset All Scores' : 'Reset All Scores')}
                        </button>
                        <button 
                          disabled={isResetting}
                          onClick={() => {
                            if (confirmReset === 'stats') {
                              setIsResetting(true);
                              handleAdminReset('stats').finally(() => setIsResetting(false));
                              setConfirmReset(null);
                            } else {
                              setConfirmReset('stats');
                            }
                          }} 
                          className={`relative px-4 py-3 border rounded-2xl text-[9px] font-bold tracking-normal transition-all ${confirmReset === 'stats' ? 'bg-fc-neon-green text-black border-fc-neon-green text-black animate-pulse' : 'bg-fc-purple-light/20 border-fc-neon-green/30 text-fc-neon-green hover:bg-fc-neon-green text-black hover:text-black'}`}
                        >
                          {isResetting && confirmReset === 'stats' ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : (confirmReset === 'stats' ? 'Confirm Reset Stats Tab' : 'Reset Stats Tab')}
                        </button>
                        <button 
                          disabled={isResetting}
                          onClick={() => {
                            if (confirmReset === 'all') {
                              setIsResetting(true);
                              handleAdminReset('all').finally(() => setIsResetting(false));
                              setConfirmReset(null);
                            } else {
                              setConfirmReset('all');
                            }
                          }} 
                          className={`relative px-4 py-3 rounded-2xl text-[9px] font-bold tracking-normal transition-all shadow-lg ${confirmReset === 'all' ? 'bg-red-900 text-white animate-pulse scale-105' : 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/20'}`}
                        >
                          {isResetting && confirmReset === 'all' ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : (confirmReset === 'all' ? 'Confirm TOTAL PURGE' : 'Purge All Data')}
                        </button>
                      </div>
                      {confirmReset && (
                        <p className="mt-4 text-[9px] font-bold text-red-400/60 text-center animate-bounce">Click again to confirm action</p>
                      )}
                    </div>
                    
                    <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-6">
                      <div className="flex items-center gap-3 mb-4 text-yellow-500">
                        <BarChart2 className="w-5 h-5" />
                        <h4 className="text-[10px] font-bold tracking-normal">Table Analysis</h4>
                      </div>
                      <button 
                        onClick={handleAnalyzeQualification}
                        className="w-full px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-2xl text-[9px] font-bold tracking-normal hover:bg-yellow-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Calculate Q/E Statuses
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

            {activeTab === 'registrations' && (
              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 gap-4">
                   <div className="text-center sm:text-left">
                    <h3 className="text-xl md:text-2xl font-display font-bold  text-white tracking-tight">Registered Users</h3>
                    <p className="text-fc-neon-green/40 text-[9px] md:text-[10px] font-bold tracking-[0.2em] mt-1">Review applicant field data</p>
                   </div>
                   <div className="flex flex-wrap items-center gap-3">
                     <div className="px-4 md:px-6 py-2 md:py-3 bg-fc-purple-light/30 border border-fc-neon-green/50/30 rounded-2xl flex items-center gap-3">
                        <span className="text-[9px] md:text-[10px] font-bold text-fc-neon-green tracking-normal">Active applicants:</span>
                        <span className="text-xl md:text-2xl font-display font-bold  text-white">{registrations.length}</span>
                     </div>
                     <button
                       id="btn-admin-full-reset-players"
                       onClick={handleResetAllRegistrations}
                       className="px-4 py-2 bg-red-500/10 hover:bg-red-500/35 text-red-400 hover:text-white border border-red-500/30 hover:border-red-500/60 rounded-2xl flex items-center gap-2 text-xs font-bold transition duration-200 cursor-pointer shadow-sm tracking-wide py-2 md:py-3 h-full"
                       title="Full reset all players and registrations"
                     >
                       <RotateCcw className="w-3.5 h-3.5 animate-pulse" />
                       <span>Full Reset Players</span>
                     </button>
                   </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {registrations.length === 0 && adminUsers.length === 0 ? (
                    <div className="p-20 text-center bg-white/5 border border-white/5 rounded-2xl">
                      <Users className="w-16 h-16 text-white/10 mx-auto mb-4" />
                      <p className="text-white/40 font-bold">No registrations yet.</p>
                    </div>
                  ) : (
                    <>
                      {registrations.sort((a,b) => (b.timestamp?.seconds||0) - (a.timestamp?.seconds||0)).map(reg => {
                        const user = adminUsers.find(u => u.id === reg.userId) || { displayName: reg.name, id: reg.userId, name: reg.name };
                        return (
                          <div key={reg.id} className="bg-white/5 border border-white/10 rounded-2xl md:rounded-2xl p-4 md:p-6 hover:bg-white/10 transition-all group">
                            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start lg:items-center">
                              
                              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
                                <div className="min-w-[80px]">
                                  <p className="text-[8px] font-bold tracking-normal text-fc-neon-green mb-0.5">Status</p>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                    reg.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                                    reg.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                    'bg-yellow-500/20 text-yellow-500'
                                  }`}>{reg.status}</span>
                                </div>
                                <div className="flex flex-row flex-wrap sm:flex-nowrap gap-2">
                                  <button 
                                    onClick={() => handleApproveRegistration(reg.id)}
                                    className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-black transition-all rounded-2xl flex-shrink-0"
                                    title="Approve"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleRejectRegistration(reg.id)}
                                    className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500 transition-all rounded-2xl flex-shrink-0"
                                    title="Reject"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      if (confirmDeleteId === reg.id) {
                                        handleDeleteRegistration(reg.id);
                                        setConfirmDeleteId(null);
                                        setAdminUsers(prev => prev.filter(u => u.id !== user.id));
                                      } else {
                                        setConfirmDeleteId(reg.id);
                                      }
                                    }}
                                    className={`p-2 transition-all rounded-2xl flex-shrink-0 ${confirmDeleteId === reg.id ? 'bg-red-600 text-white animate-pulse' : 'bg-white/5 text-white/40 hover:text-red-500'}`}
                                    title={confirmDeleteId === reg.id ? "Click again to confirm" : "Delete Forever"}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => setAdminEditingRegistration(reg)}
                                    className="p-2 bg-fc-neon-green/20 text-fc-neon-green hover:bg-fc-neon-green hover:text-black transition-all rounded-2xl flex-shrink-0"
                                    title="Edit Registration"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => setDownloadingRegistration(reg)}
                                    className="p-2 bg-fc-purple-light/20 text-fc-neon-green hover:bg-fc-purple-light hover:text-white transition-all rounded-2xl flex-shrink-0"
                                    title="Download ID Card"
                                  >
                                    <IdCard className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              <div className="flex flex-row flex-wrap md:flex-nowrap gap-4 md:gap-6 items-center flex-1 w-full lg:w-auto">
                                <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 overflow-hidden shadow-lg group-hover:scale-105 transition-transform flex items-center justify-center flex-shrink-0">
                                  {reg.logoUrl ? (
                                    <img src={reg.logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <Plus className="w-8 h-8 text-white/10" />
                                  )}
                                </div>
                                <div className="min-w-[120px]">
                                   <p className="text-[8px] md:text-[9px] font-bold tracking-normal text-fc-neon-green mb-1">Gamer / FC Name</p>
                                   <p className="text-xs md:text-sm font-bold text-white mb-0.5">{user.displayName || reg.name}</p>
                                   <p className="text-[10px] text-white/60 font-mono break-all">{reg.fcName}</p>
                                </div>
                                <div>
                                   <p className="text-[8px] md:text-[9px] font-bold tracking-normal text-fc-neon-green mb-1">Age</p>
                                   <p className="text-xs md:text-sm font-bold text-white">{reg.age} years</p>
                                </div>
                                <div>
                                   <p className="text-[8px] md:text-[9px] font-bold tracking-normal text-fc-neon-green mb-1">Team OVR</p>
                                   <span className="text-lg font-display font-bold text-yellow-500">{reg.teamOvr}</span>
                                </div>
                                <div className="hidden sm:block">
                                   <p className="text-[8px] md:text-[9px] font-bold tracking-normal text-fc-neon-green mb-1">Experience</p>
                                   <p className="text-[9px] md:text-[10px] font-bold text-white/60">{reg.experience}</p>
                                 </div>
                                 {config.groupType === 'many' && reg.status === 'approved' && (
                                   <div className="animate-in fade-in duration-200 min-w-[140px] shrink-0 mt-2 lg:mt-0 lg:ml-4">
                                      <p className="text-[8px] md:text-[9px] font-bold tracking-normal text-fc-neon-green mb-1">Group Stage Group</p>
                                      <select
                                        value={config.groupAssignments?.[reg.id] || ''}
                                        onChange={async (e) => {
                                          const grp = e.target.value;
                                          const newMap = {
                                            ...(config.groupAssignments || {}),
                                            [reg.id]: grp
                                          };
                                          await handleUpdateConfig({
                                            ...config,
                                            groupAssignments: newMap
                                          });
                                        }}
                                        className="bg-black/65 border border-white/10 text-white font-sans text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-fc-neon-green tracking-wide cursor-pointer transition-colors w-full"
                                      >
                                        <option value="">None (Unassigned)</option>
                                        {Array.from({ length: 8 }).map((_, i) => {
                                          const char = String.fromCharCode(65 + i);
                                          return <option key={char} value={char}>Group {char}</option>;
                                        })}
                                      </select>
                                   </div>
                                 )}
                                 <div className="hidden sm:block" style={{display: 'none'}}>
                                    <p className="text-[9px] md:text-[10px] font-bold text-white/80">dummy</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      {adminUsers.filter(u => u.id && !registrations.find(r => r.userId === u.id) && u.role !== 'admin').map((user) => (
                        <div key={user.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-6 hover:bg-white/10 transition-all flex items-center justify-between mt-2">
                          <div>
                             <p className="text-sm font-bold text-white mb-1"><span className="text-fc-neon-green/60 mr-2">Gamer:</span>{user.displayName || user.name || 'Unknown'}</p>
                             <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-500/20 text-gray-400">Under Process</span>
                          </div>
                          <button 
                             onClick={async () => {
                               if (window.confirm('Delete this user? Name spot will be freed.')) {
                                 try {
                                   await deleteDoc(doc(db, 'users', user.id));
                                 } catch (e) {
                                   console.warn("Could not delete shadow user doc:", e);
                                 }
                                 setAdminUsers(prev => prev.filter(u => u.id !== user.id));
                               }
                             }}
                             className="p-3 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white transition-all rounded-2xl flex items-center gap-2 text-xs font-bold tracking-normal"
                          >
                            <Trash2 className="w-4 h-4" /> Reset Name
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'schedule' && (
              <div className="space-y-8">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <Calendar className="w-6 h-6 text-fc-neon-green" />
                    <h3 className="text-xl font-display font-bold  text-fc-neon-green">
                      Schedule Generator
                    </h3>
                  </div>
                  <ScheduleRandomizer teams={registrations.filter(r => r.status === 'approved')} config={config} />
                </div>
              </div>
            )}
            
            {activeTab === 'visibility' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                <h3 className="text-xl font-display font-bold  text-white mb-6">Tab Visibility Management</h3>
                <div className="space-y-4">
                  {['Fixtures', 'Table', 'Bracket', 'Registration', 'Stats', 'News', 'Campaign'].map(tab => (
                    <div key={tab} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                      <span className="text-sm font-bold text-white">{tab}</span>
                      <button 
                        onClick={() => {
                          const newTabs = { ...(config.tabVisibility || {}), [tab.toLowerCase()]: !(config.tabVisibility?.[tab.toLowerCase()] ?? true) };
                          handleUpdateConfig({ ...config, tabVisibility: newTabs });
                        }}
                        className={`px-4 py-2 rounded-2xl font-bold text-xs ${!(config.tabVisibility?.[tab.toLowerCase()] ?? true) ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}
                      >
                        {!(config.tabVisibility?.[tab.toLowerCase()] ?? true) ? 'Disabled' : 'Enabled'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {activeTab === 'label' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                <h3 className="text-xl font-display font-bold  text-white mb-6">Date Label Management (Drag to Reorder)</h3>
                <div className="space-y-4">
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext 
                      items={sortedDates}
                      strategy={verticalListSortingStrategy}
                    >
                      {sortedDates.map((date, index) => (
                        <SortableDateItem 
                          key={date} 
                          date={date} 
                          index={index}
                          total={sortedDates.length}
                          isHidden={config.hiddenDates?.includes(date) || false}
                          matchLabels={matchLabels} 
                          updateMatchLabel={updateMatchLabel} 
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              </div>
            )}

            
            {activeTab === 'names' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-display font-bold text-white">Allowed Registration Names</h3>
                </div>
                <div className="space-y-4">
                  <p className="text-xs text-white/50">Add predefined names that users can select during registration. If this list is empty, users can type any name.</p>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Add a new name (e.g. Ayush)"
                      value={newAllowedNameInput}
                      onChange={(e) => setNewAllowedNameInput(e.target.value)}
                      className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-fc-neon-green/50 text-white"
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          const name = newAllowedNameInput.trim();
                          if (name) {
                            const newNames = [...(config.allowedNames || []), name];
                            await handleUpdateConfig({ ...config, allowedNames: newNames });
                            setNewAllowedNameInput('');
                          }
                        }
                      }}
                    />
                    <button 
                      onClick={async () => {
                        const name = newAllowedNameInput.trim();
                        if (name) {
                          const newNames = [...(config.allowedNames || []), name];
                          await handleUpdateConfig({ ...config, allowedNames: newNames });
                          setNewAllowedNameInput('');
                        }
                      }}
                      className="px-4 py-2 bg-fc-neon-green text-black rounded-xl font-bold text-sm hover:bg-fc-purple-light transition-all cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
                    {(config.allowedNames || []).map((name, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                        <span className="text-sm text-white font-bold">{name}</span>
                        <button 
                          onClick={async () => {
                            const newNames = (config.allowedNames || []).filter((_, i) => i !== idx);
                            await handleUpdateConfig({ ...config, allowedNames: newNames });
                          }}
                          className="p-1 hover:bg-red-500/20 text-white/40 hover:text-red-400 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {(!config.allowedNames || config.allowedNames.length === 0) && (
                      <div className="col-span-full p-4 border border-dashed border-white/20 rounded-xl text-center text-white/40 text-xs">
                        No allowed names set. Users can currently enter any full name.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'countries' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-display font-bold text-white">Country Locking</h3>
                </div>
                <p className="text-xs text-white/50 mb-6">Lock specific countries to prevent them from being selected during registration.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {WORLD_CUP_TEAMS.map((team) => {
                    const isLocked = (config.lockedCountries || []).includes(team.name);
                    return (
                      <button
                        key={team.name}
                        onClick={async () => {
                          const newLocked = isLocked 
                            ? (config.lockedCountries || []).filter(c => c !== team.name)
                            : [...(config.lockedCountries || []), team.name];
                          await handleUpdateConfig({ ...config, lockedCountries: newLocked });
                        }}
                        className={`flex items-center gap-2 p-3 rounded-2xl border transition-all ${
                          isLocked 
                            ? 'bg-red-500/20 border-red-500 text-white font-bold' 
                            : 'bg-white/5 border-white/10 hover:border-white/30 text-white/80'
                        }`}
                      >
                        <span className="text-xl">{team.flag}</span>
                        <span className="text-xs font-bold">{team.name}</span>
                        {isLocked && <span className="text-[9px] ml-auto text-red-400 font-bold uppercase tracking-widest">Locked</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'draw_admin' && (
              <div className="space-y-8">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-display font-bold text-white">Draw Admin settings</h3>
                    <button
                      onClick={async () => {
                        const enabled = config.drawAdminEnabled !== false;
                        await handleUpdateConfig({ ...config, drawAdminEnabled: !enabled });
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.drawAdminEnabled !== false ? 'bg-fc-neon-green' : 'bg-gray-600'}`}
                    >
                      <span className={`inline-block w-4 h-4 transform rounded-full bg-white transition-transform ${config.drawAdminEnabled !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <p className="text-xs text-white/50 mb-6">Enable or disable the draw admin (Password: Priyam@2000+admin). If enabled, draw admin has a dedicated panel for pots and live draws.</p>
                </div>
                <DrawAdminPanel 
                  registrations={registrations} 
                  config={config} 
                  handleUpdateConfig={handleUpdateConfig}
                  matches={matches}
                  bracket={bracket}
                  teams={teams}
                  handleSaveBracket={handleSaveBracket}
                />
              </div>
            )}



            {activeTab === 'groups' && (
              <div className="space-y-8 animate-in fade-in duration-200">
                {/* Format Toggle Header card */}
                <div className="flex flex-col md:flex-row items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 gap-4 shadow-xl">
                  <div className="text-center md:text-left min-w-0">
                    <h3 className="text-xl md:text-2xl font-display font-black text-white tracking-tight flex items-center justify-center md:justify-start gap-2">
                      <Layout className="w-5 h-5 text-fc-neon-green" />
                      Groups & Assign Management
                    </h3>
                    <p className="text-fc-neon-green/40 text-[9px] md:text-[10px] font-bold tracking-[0.2em] mt-1">
                      CURRENT FORMAT: <span className="text-white bg-fc-neon-green/10 px-2 py-0.5 rounded ml-1 font-bold">{config.groupType === 'many' ? 'MANY GROUPS' : 'SINGLE LEAGUE TABLE'}</span>
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={async () => {
                        const newType = config.groupType === 'many' ? 'single' : 'many';
                        await handleUpdateConfig({
                          ...config,
                          groupType: newType
                        });
                      }}
                      className="px-4 py-2.5 bg-fc-neon-green/10 hover:bg-fc-neon-green/30 text-fc-neon-green border border-fc-neon-green/20 hover:border-fc-neon-green/40 rounded-xl flex items-center gap-2 text-xs font-bold transition duration-200 cursor-pointer shadow-sm tracking-wide"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>Switch to {config.groupType === 'many' ? 'Single League Table' : 'Many Groups Stage'}</span>
                    </button>
                    
                    {config.groupType === 'many' && (
                      <>
                        <button
                          onClick={handleRandomizeGroups}
                          className="px-4 py-2.5 bg-[#3B82F6]/15 hover:bg-[#3B82F6]/30 text-[#3B82F6] hover:text-white border border-[#3B82F6]/20 rounded-xl flex items-center gap-2 text-xs font-bold transition duration-200 cursor-pointer shadow-sm tracking-wide"
                        >
                          <Sparkles className="w-4 h-4 text-blue-400" />
                          <span>Auto Randomize</span>
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm("Are you sure you want to clear all group assignments?")) {
                              await handleClearGroups();
                            }
                          }}
                          className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/35 text-red-400 hover:text-white border border-red-500/25 rounded-xl flex items-center gap-2 text-xs font-bold transition duration-200 cursor-pointer shadow-sm tracking-wide"
                        >
                          <RotateCcw className="w-4 h-4 text-red-400" />
                          <span>Clear Assignments</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {config.groupType !== 'many' ? (
                  <div className="p-12 text-center bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center space-y-4 shadow-xl">
                    <AlertCircle className="w-16 h-16 text-white/20" />
                    <p className="text-white/80 font-display font-black text-lg">Group Stage Mode is Off</p>
                    <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
                      Your current tournament structure is configured as a single unified league table. Switch to Multi-Group mode to manage individual groups, auto-assign players, and edit group names.
                    </p>
                    <button
                      onClick={async () => {
                        await handleUpdateConfig({
                          ...config,
                          groupType: 'many'
                        });
                      }}
                      className="px-6 py-3 bg-fc-neon-green text-black hover:bg-fc-neon-green/90 rounded-xl text-xs font-bold tracking-wide transition shadow-lg shadow-fc-neon-green/20"
                    >
                      Activate Many Groups Format
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Left Column: Unassigned Players Pool */}
                    <div className="lg:col-span-1 bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl h-fit">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
                        <div className="text-left">
                          <h4 className="text-sm font-display font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Users className="w-4 h-4 text-fc-neon-green" />
                            Unassigned Pool
                          </h4>
                          <p className="text-[10px] text-white/40 font-bold tracking-normal mt-0.5">Approved players not yet in a group</p>
                        </div>
                        <span className="px-2 py-0.5 bg-fc-neon-green/10 text-fc-neon-green rounded text-xs font-display font-black">
                          {registrations.filter(r => r.status === 'approved' && !(config.groupAssignments?.[r.id])).length}
                        </span>
                      </div>

                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                        {registrations.filter(r => r.status === 'approved' && !(config.groupAssignments?.[r.id])).length === 0 ? (
                          <div className="py-12 text-center text-white/20 text-xs font-medium border border-dashed border-white/5 rounded-xl">
                            All players are assigned!
                          </div>
                        ) : (
                          registrations.filter(r => r.status === 'approved' && !(config.groupAssignments?.[r.id])).map(player => (
                            <div key={player.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 hover:bg-white/[0.05] transition-all flex flex-col gap-2.5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#222222] shrink-0 flex items-center justify-center bg-black">
                                  {player.logoUrl ? (
                                    <img src={player.logoUrl} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <span className="text-[10px] font-display text-fc-neon-green">{player.name.substring(0, 2)}</span>
                                  )}
                                </div>
                                <div className="min-w-0 text-left">
                                  <p className="font-sans font-bold text-xs text-white truncate" title={player.name}>{player.name}</p>
                                  <p className="text-[9px] text-[#A0A0A0] font-sans font-medium truncate" title={player.fcName}>{player.fcName}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <select
                                  value=""
                                  onChange={(e) => movePlayerToGroup(player.id, e.target.value)}
                                  className="flex-1 bg-black/60 border border-white/10 text-white font-sans text-[11px] font-bold rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer"
                                >
                                  <option value="">Move to group...</option>
                                  {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(g => (
                                    <option key={g} value={g}>{config.groupNames?.[g] || `Group ${g}`}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Right Column: Groups Grid */}
                    <div className="lg:col-span-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((groupKey) => {
                          const groupPlayers = registrations.filter(r => r.status === 'approved' && (config.groupAssignments?.[r.id] || '') === groupKey);
                          const isEditingThisGroup = editingGroupKey === groupKey;
                          
                          return (
                            <div key={groupKey} className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col justify-between group/card hover:border-fc-neon-green/30 transition-all">
                              <div>
                                <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-3">
                                  {isEditingThisGroup ? (
                                    <div className="flex flex-col gap-2 w-full">
                                      <div className="flex items-center gap-2">
                                        <input 
                                          type="text" 
                                          value={editingGroupName} 
                                          onChange={e => setEditingGroupName(e.target.value)} 
                                          className="bg-black/60 border border-white/20 text-white font-sans text-xs font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-fc-neon-green flex-1"
                                          placeholder={`Group ${groupKey} Name`}
                                          autoFocus
                                        />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <input 
                                          type="text" 
                                          value={editingGroupLabel} 
                                          onChange={e => setEditingGroupLabel(e.target.value)} 
                                          className="bg-black/60 border border-white/20 text-white font-sans text-xs font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-fc-neon-green flex-1"
                                          placeholder="Indicator Label (e.g. Top 2 Qualify)"
                                        />
                                        <div className="flex gap-1 shrink-0">
                                          <button 
                                            onClick={() => handleSaveGroupDetails(groupKey)} 
                                            className="p-1.5 bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-black rounded-lg transition-all"
                                            title="Save Details"
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                          </button>
                                          <button 
                                            onClick={() => { setEditingGroupKey(null); setEditingGroupName(''); setEditingGroupLabel(''); }} 
                                            className="p-1.5 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                                            title="Cancel"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between w-full">
                                      <div className="min-w-0 text-left">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                          <span className="font-display font-black text-[10px] text-fc-neon-green uppercase tracking-widest block">Group {groupKey}</span>
                                          <span className="highlighter-green text-[8px] font-sans font-black tracking-wider uppercase py-0 px-1.5 scale-90 origin-left">
                                            {config.groupLabels?.[groupKey] || 'Top 2 Qualify'}
                                          </span>
                                        </div>
                                        <h4 className="font-sans font-black text-sm text-white truncate max-w-[130px]" title={config.groupNames?.[groupKey] || `Group ${groupKey}`}>
                                          {config.groupNames?.[groupKey] || `Group ${groupKey}`}
                                        </h4>
                                      </div>
                                      <button 
                                        onClick={() => { 
                                          setEditingGroupKey(groupKey); 
                                          setEditingGroupName(config.groupNames?.[groupKey] || ''); 
                                          setEditingGroupLabel(config.groupLabels?.[groupKey] || 'Top 2 Qualify'); 
                                        }}
                                        className="p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white/80 transition-colors"
                                        title="Rename Group or Label"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <div className="space-y-2 mt-4 min-h-[160px]">
                                  {groupPlayers.length === 0 ? (
                                    <div className="py-12 text-center text-white/10 border border-dashed border-white/5 rounded-xl text-xs font-semibold">
                                      No players assigned
                                    </div>
                                  ) : (
                                    groupPlayers.map(player => (
                                      <div key={player.id} className="flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-xl p-2 transition-all">
                                        <div className="flex items-center min-w-0 gap-2">
                                          <div className="w-7 h-7 rounded-lg overflow-hidden border border-[#222222] shrink-0 flex items-center justify-center bg-black">
                                            {player.logoUrl ? (
                                              <img src={player.logoUrl} alt={player.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                            ) : (
                                              <span className="text-[9px] font-display text-[#3B82F6]">{player.name.substring(0, 2)}</span>
                                            )}
                                          </div>
                                          <div className="min-w-0 text-left">
                                            <p className="font-sans font-bold text-xs text-white truncate max-w-[90px] xl:max-w-[110px]" title={player.name}>{player.name}</p>
                                            <p className="text-[9px] text-[#A0A0A0] font-sans font-medium truncate max-w-[90px] xl:max-w-[110px]" title={player.fcName}>{player.fcName}</p>
                                          </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-1 shrink-0">
                                          <select
                                            value={groupKey}
                                            onChange={(e) => movePlayerToGroup(player.id, e.target.value)}
                                            className="bg-black/65 border border-white/10 text-white font-sans text-[10px] font-bold rounded-lg px-1.5 py-0.5 focus:outline-none cursor-pointer"
                                          >
                                            {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map(g => (
                                              <option key={g} value={g}>{config.groupNames?.[g] || `Group ${g}`}</option>
                                            ))}
                                            <option value="">Remove</option>
                                          </select>
                                          <button
                                            onClick={() => movePlayerToGroup(player.id, '')}
                                            className="p-1 hover:bg-red-500/10 rounded-lg text-white/30 hover:text-red-400 transition-colors"
                                            title="Remove from group"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>

                              {/* Add Quick-selector */}
                              <div className="mt-4 pt-4 border-t border-white/5">
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      movePlayerToGroup(e.target.value, groupKey);
                                    }
                                  }}
                                  className="bg-fc-neon-green/10 border border-fc-neon-green/10 hover:border-fc-neon-green/30 text-fc-neon-green font-sans text-[10px] font-bold rounded-xl px-2 py-2 focus:outline-none tracking-wide cursor-pointer transition-colors w-full text-center"
                                >
                                  <option value="" className="bg-[#121215] text-white">Add player to group...</option>
                                  {registrations.filter(r => r.status === 'approved' && (config.groupAssignments?.[r.id] || '') !== groupKey).map(p => {
                                    const isCurrentOther = config.groupAssignments?.[p.id];
                                    const otherLabel = isCurrentOther ? ` (currently Group ${isCurrentOther})` : '';
                                    return (
                                      <option key={p.id} value={p.id} className="bg-[#121215] text-white">
                                        {p.name} {otherLabel}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}



            {activeTab === 'backup' && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-display font-bold  text-white">Database Backup & Recovery</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Export */}
                  <div className="bg-fc-purple-dark/20 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 w-32 h-32 bg-fc-purple-light/20 rounded-bl-full -z-10 group-hover:bg-fc-purple-light/30 transition-all" />
                    <Download className="w-8 h-8 text-fc-neon-green mb-4" />
                    <h4 className="font-bold text-white text-sm mb-2">Export Data Backup</h4>
                    <p className="text-white/40 text-xs leading-relaxed mb-6">
                      Download a JSON backup of everything: registrations, bracket matches, historical matches, match labels, stats, users, and reports. Do this regularly.
                    </p>
                    <button 
                      onClick={handleExportBackup}
                      className="w-full py-4 bg-fc-neon-green text-black hover:bg-fc-neon-green text-black rounded-2xl text-[10px] font-bold tracking-[0.2em] transition-all text-black flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Save Complete Backup
                    </button>
                  </div>

                  {/* Import */}
                  <div className="bg-fc-purple-dark/20 border border-red-500/20 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 w-32 h-32 bg-red-600/5 rounded-bl-full -z-10 group-hover:bg-red-600/10 transition-all" />
                    <Upload className="w-8 h-8 text-red-400 mb-4" />
                    <h4 className="font-bold text-white text-sm mb-2">Restore Backup</h4>
                    <p className="text-red-400/60 text-xs leading-relaxed mb-6 font-bold">
                      DANGER: Restoring a backup will overwrite your current live database with the data contained in the file.
                    </p>
                    
                    <div className="relative">
                      <input 
                        type="file" 
                        accept=".json"
                        onChange={handleImportBackup}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        title="Upload JSON Backup"
                      />
                      <div className="w-full py-4 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-2xl text-[10px] font-bold tracking-[0.2em] transition-all text-red-100 flex items-center justify-center gap-2">
                        {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        Restore JSON Backup
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="absolute left-[9999px] top-0 pointer-events-none">
             {downloadingRegistration && (
                <div ref={cardRef} className="w-[800px] h-[1200px] bg-gradient-to-br from-[#0a0a0c] to-[#121218] text-white p-16 flex flex-col items-center border-[16px] border-fc-neon-green relative shadow-2xl">
                   <div className="absolute top-0 left-0 w-full h-[400px] bg-fc-neon-green/10 -skew-y-6 transform origin-top-left -z-10" />
                   
                   <h1 className="text-7xl font-black italic tracking-tighter text-fc-neon-green mt-8 mb-16 uppercase shadow-lg">UX Leagues</h1>
                   
                   <div className="w-[450px] h-[450px] rounded-[64px] overflow-hidden border-8 border-fc-neon-green/50 mb-16 shadow-[0_0_100px_rgba(201,168,76,0.2)] bg-black/50 p-4">
                      {downloadingRegistration.logoUrl ? (
                         <img src={downloadingRegistration.logoUrl} className="w-full h-full object-cover rounded-[48px]" alt="Player" referrerPolicy="no-referrer" />
                      ) : (
                         <div className="w-full h-full rounded-[48px] bg-white/5 flex items-center justify-center">
                            <Users className="w-32 h-32 text-white/10" />
                         </div>
                      )}
                   </div>
                   
                   <div className="w-full text-center space-y-4 mb-16">
                      <h2 className="text-6xl font-black tracking-tight text-white uppercase">{downloadingRegistration.name}</h2>
                      <p className="text-4xl text-fc-neon-green font-mono tracking-widest">{downloadingRegistration.fcName}</p>
                      <p className="text-2xl text-white/40 font-bold mt-4 uppercase">Registration ID: {downloadingRegistration.id.substring(0, 8)}</p>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-8 w-full max-w-[600px] mt-auto mb-8">
                     <div className="bg-white/5 p-8 rounded-[32px] border border-white/10 text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-fc-purple-light/20 blur-2xl" />
                        <p className="text-2xl text-white/40 font-bold mb-4 relative">AGE</p>
                        <p className="text-7xl font-black text-white relative">{downloadingRegistration.age}</p>
                     </div>
                     <div className="bg-fc-neon-green/10 p-8 rounded-[32px] border border-fc-neon-green/30 text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-fc-neon-green/20 blur-2xl" />
                        <p className="text-2xl text-fc-neon-green/60 font-bold mb-4 relative tracking-widest">OVR</p>
                        <p className="text-7xl font-black text-fc-neon-green relative">{downloadingRegistration.teamOvr}</p>
                     </div>
                   </div>
                   
                   {/* Decorative elements */}
                   <div className="absolute bottom-16 right-16 w-32 h-32 opacity-50">
                      <DummyQRCode />
                   </div>
                   <div className="absolute bottom-16 left-16">
                      <p className="text-xl font-bold text-white/20 whitespace-normal w-48 text-left leading-tight">OFFICIAL PLAYER PASSPORT</p>
                   </div>
                </div>
             )}
          </div>
        </div>
      </motion.div>
    );
  };

const TeamNameWithCopy = ({ team, size = 'lg', reverse = false, showCopy = true, copiedId, copyToClipboard }: { team: Team | undefined, size?: 'sm' | 'lg', reverse?: boolean, showCopy?: boolean, copiedId: string | null, copyToClipboard: (uid: string) => void }) => {
    if (!team) return (
      <div className={`flex items-center ${reverse ? 'flex-row-reverse' : ''} min-w-0 opacity-20`}>
        <div className={`${size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'} rounded bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/40 shrink-0 ${reverse ? 'ml-2' : 'mr-2'}`}>
          ?
        </div>
        <span className={`font-display font-bold tracking-tight whitespace-nowrap  truncate pr-1 ${
          size === 'lg' ? 'text-xs md:text-lg' : 'text-xs md:text-sm'
        }`}>TBD</span>
      </div>
    );
    return (
      <div className={`flex items-center ${showCopy ? 'gap-2 md:gap-3' : ''} group/name ${reverse ? 'flex-row-reverse' : ''} min-w-0`}>
        <div className={`shrink-0 flex items-center ${reverse ? 'flex-row-reverse' : ''}`}>
          {team.logoUrl ? (
            <img 
              src={team.logoUrl} 
              alt={team.name} 
              className={`${size === 'lg' ? 'w-8 h-8 md:w-10 md:h-10' : 'w-6 h-6 md:w-8 md:h-8'} rounded-2xl object-cover border border-fc-neon-green/50 shadow-[0_0_10px_rgba(201,168,76,0.3)] ${reverse ? 'ml-2 md:ml-3' : 'mr-2 md:mr-3'}`}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={`${size === 'lg' ? 'w-8 h-8 md:w-10 md:h-10' : 'w-6 h-6 md:w-8 md:h-8'} rounded-2xl bg-black border border-fc-neon-green flex items-center justify-center text-fc-neon-green font-sans font-bold shadow-[0_0_10px_rgba(201,168,76,0.3)] ${size === 'lg' ? 'text-sm md:text-base' : 'text-[10px] md:text-xs'} ${reverse ? 'ml-2 md:ml-3' : 'mr-2 md:mr-3'}`}>
              {team.name.substring(0, 2)}
            </div>
          )}
          <span className={`font-sans font-bold tracking-normal whitespace-nowrap truncate pr-1 ${
            size === 'lg' ? 'text-sm md:text-xl' : 'text-xs md:text-sm'
          }`}>{team.name}</span>
        </div>
      </div>
    );
  };

  // Main app component follows...

const fetchWithCache = async (cacheKey: string, queryRef: any, isDoc: boolean = false, ttlMs: number = 2000) => {
  const cached = localStorage.getItem(cacheKey);
  const cacheKeyMeta = `${cacheKey}_meta`;
  
  let shouldFetch = true;

  if (cached) {
    let serverBusted = false;
    if (!isDoc && queryRef.collectionName) {
       try {
         const serverMeta = await getCollectionMeta(queryRef.collectionName);
         if (serverMeta !== null) {
           const localMetaStr = localStorage.getItem(cacheKeyMeta);
           const localMeta = localMetaStr ? Number(localMetaStr) : 0;
           if (serverMeta > localMeta) {
             serverBusted = true;
           }
         } else {
           // Fallback to TTL if meta fails
           const cachedTimeStr = localStorage.getItem(`${cacheKey}_time`);
           if (!cachedTimeStr || Date.now() - Number(cachedTimeStr) > ttlMs) {
             serverBusted = true;
           }
         }
       } catch(e) {
         // Fallback to TTL if meta fails
         const cachedTimeStr = localStorage.getItem(`${cacheKey}_time`);
         if (!cachedTimeStr || Date.now() - Number(cachedTimeStr) > ttlMs) {
           serverBusted = true;
         }
       }
    } else {
       const cachedTimeStr = localStorage.getItem(`${cacheKey}_time`);
       if (!cachedTimeStr || Date.now() - Number(cachedTimeStr) > ttlMs) {
         serverBusted = true;
       }
    }
    if (!serverBusted) {
       shouldFetch = false;
    }
  }
  
  if (!shouldFetch && cached) {
    return JSON.parse(cached);
  }
  
  try {
    let data;
    if (isDoc) {
      const snap = await getDoc(queryRef);
      if (snap.exists()) data = { id: snap.id, ...(snap.data() as any) };
      else data = null;
    } else {
      let snap;
      if (cached && queryRef.collectionName) {
        try {
           const cacheMetaStr = localStorage.getItem(`${cacheKey}_meta`);
           if (cacheMetaStr && Number(cacheMetaStr) > 0) {
              snap = await getDocsWithDelta(queryRef, cacheMetaStr, JSON.parse(cached));
           } else {
              snap = await getDocs(queryRef);
           }
        } catch(e) {
           console.warn("Delta fetch issue:", e);
           snap = await getDocs(queryRef);
        }
      } else {
        snap = await getDocs(queryRef);
      }
      data = snap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() as any) }));
    }
    
    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
      localStorage.setItem(`${cacheKey}_time`, Date.now().toString());
      if (!isDoc && queryRef.collectionName) {
         const currentMeta = await getCollectionMeta(queryRef.collectionName);
         if (currentMeta !== null) {
           localStorage.setItem(cacheKeyMeta, currentMeta.toString());
         }
      }
    } catch(e) {}
    
    return data;
  } catch (error: any) {
    if ((error.code === 'resource-exhausted' || error.message?.includes('Quota') || error.message?.includes('offline'))) {
      window.dispatchEvent(new Event('quotaExceeded'));
      if (cached) return JSON.parse(cached);
    }
    throw error;
  }
};

// Helper to parse dates like "4th May 2026"
const parseTourneyDate = (dStr: string) => {
  if (!dStr || dStr === 'TBD') return new Date(0);
  const cleanStr = dStr.replace(/(\d+)(st|nd|rd|th)/, '$1');
  return new Date(cleanStr);
};

const NewsFeed = ({ articles, isAdmin, isEditingMode, onDelete }: { articles: any[], isAdmin?: boolean, isEditingMode?: boolean, onDelete?: (id: string) => void }) => {
  if (!articles || articles.length === 0) return (
    <div className="p-8 text-center text-white/40 bg-white/5 rounded-2xl border border-white/10 tracking-normal font-bold text-xs">
      No recent news
    </div>
  );

  const getCategoryColor = (category: string) => {
    switch(category) {
      case 'SPICY': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'BANTER': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'ANALYSIS': return 'bg-fc-neon-green/20 text-fc-neon-green border-fc-neon-green/50/30';
      case 'PREDICTION': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'MATCHDAY': return 'bg-fc-purple-light/20 text-fc-neon-green border-fc-purple-light/30';
      case 'FORM': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-white/10 text-white/50 border-white/20';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch(category) {
      case 'SPICY': return '🔥';
      case 'BANTER': return '😂';
      case 'ANALYSIS': return '📊';
      case 'PREDICTION': return '🏆';
      case 'MATCHDAY': return '📅';
      case 'FORM': return '📈';
      default: return '🗞️';
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
    if (diffHours === 0) return 'Just now';
    if (diffHours === 1) return '1 hr ago';
    return `${diffHours} hrs ago`;
  };

  return (
    <div className="w-full space-y-4 mb-12">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="w-5 h-5 text-fc-neon-green" />
        <h2 className="font-display font-bold text-xl  tracking-normal text-white">UXL News Network</h2>
      </div>
      <div className="flex overflow-x-auto pb-4 gap-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {articles.map((article: any) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={article.id} 
            className="flex-none w-80 md:w-96 bg-fc-purple-dark/40 border border-white/10 rounded-2xl p-5 snap-start relative overflow-hidden group hover:bg-white/5 transition-colors"
          >
            {isAdmin && isEditingMode && onDelete && (
              <button 
                onClick={() => onDelete(article.id)}
                className="absolute top-2 right-2 z-20 w-8 h-8 flex items-center justify-center bg-red-500/20 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <div className="absolute top-0 right-0 w-32 h-32 bg-fc-neon-green/5 rounded-bl-[100px] pointer-events-none group-hover:bg-fc-purple-light/20 transition-colors" />
            <div className="flex items-start justify-between mb-3 relative z-10">
              <span className={`text-[10px] font-bold tracking-normal px-2.5 py-1 rounded-2xl border ${getCategoryColor(article.category)} flex items-center gap-1.5`}>
                <span>{getCategoryIcon(article.category)}</span> {article.category}
              </span>
              <span className="text-[10px] font-bold tracking-normal text-white/30">
                {article.created_at ? getTimeAgo(article.created_at) : 'Just now'}
              </span>
            </div>
            
            <h3 className="text-lg font-display font-bold leading-tight text-white mb-2 relative z-10">{article.title}</h3>
            <p className="text-sm text-white/60 leading-relaxed font-medium relative z-10">{article.content}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const DEFAULT_PLAYERS = [
  "Ayush", "Aryan", "Sagnick", "Sagnik", "Samriddha", 
  "Biswadeb", "Souvik", "Priyam", "Barnik", "Pritam", 
  "Soumajit", "Ranajay", "Ankit", "Sonu", "Sougata", 
  "Sougata JR", "Sayantan", "Utsab", "Animesh", "Rajat"
];

function LoginModal({ onClose, onAdminLogin }: { onClose: () => void, onAdminLogin?: () => void }) {
  const [tab, setTab] = useState<'player'|'admin'>('player');
  const [availablePlayers, setAvailablePlayers] = useState<string[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [lastLoginDetails, setLastLoginDetails] = useState<{username: string, displayName: string, role: string, password?: string} | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('last_login_details');
      if (stored) {
        setLastLoginDetails(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        const [usersSnap, regsSnap, configSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'registrations')),
          getDoc(doc(db, 'config', 'system'))
        ]);

        const takenNames = new Set<string>();
        usersSnap.forEach((doc: any) => {
          const data = doc.data();
          if (data.displayName && data.role !== 'admin') {
            takenNames.add(data.displayName.toLowerCase().trim());
          }
          if (data.username && data.role !== 'admin') {
            takenNames.add(data.username.toLowerCase().trim());
          }
        });

        regsSnap.forEach((doc: any) => {
          const data = doc.data();
          if (data.name) {
            takenNames.add(data.name.toLowerCase().trim());
          }
        });

        const configData = configSnap.exists() ? configSnap.data() : null;
        const basePlayers = configData?.allowedNames && configData.allowedNames.length > 0
          ? configData.allowedNames
          : DEFAULT_PLAYERS;
        
        const available = basePlayers.filter(p => !takenNames.has(p.toLowerCase().trim())).sort((a,b) => a.localeCompare(b));
        setAvailablePlayers(available);
        if (available.length > 0) {
          setSelectedPlayer(prev => {
            if (prev && available.includes(prev)) {
              return prev;
            }
            return available[0];
          });
        }
      } catch (err) {
        console.error("Failed to fetch available players", err);
        const fb = [...DEFAULT_PLAYERS].sort((a,b) => a.localeCompare(b));
        setAvailablePlayers(fb);
        setSelectedPlayer(fb[0]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleQuickLogin = async () => {
    if (!lastLoginDetails) return;
    try {
      setError('');
      setIsLoading(true);
      const res = await signIn(lastLoginDetails.username, lastLoginDetails.password || "", lastLoginDetails.role || "user");
      if (lastLoginDetails.role === 'admin' && onAdminLogin) {
        onAdminLogin();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Quick login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (tab === 'player' && !selectedPlayer) {
      setError('No player selected or all spots taken.');
      return;
    }

    try {
      if (tab === 'player') {
        if (selectedPlayer.trim().toLowerCase() === 'barnik') {
          if (!password) {
            setError('Admin password is required for Barnik.');
            return;
          }
          const res = await signIn(selectedPlayer, password, "admin");
          localStorage.setItem('last_login_details', JSON.stringify({
            username: selectedPlayer,
            password: password,
            role: "admin",
            displayName: selectedPlayer
          }));
          if (onAdminLogin) onAdminLogin();
        } else {
          const res = await signIn(selectedPlayer, "", "user");
          localStorage.setItem('last_login_details', JSON.stringify({
            username: selectedPlayer,
            password: "",
            role: "user",
            displayName: selectedPlayer
          }));
        }
      } else {
        if (!password) {
          setError('Admin password is required.');
          return;
        }
        const res = await signIn("admin", password, "admin");
        localStorage.setItem('last_login_details', JSON.stringify({
          username: "admin",
          password: password,
          role: "admin",
          displayName: "Admin"
        }));
        if (onAdminLogin) onAdminLogin();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-fc-purple-dark border border-fc-neon-green/30 p-8 rounded-2xl max-w-sm w-full font-mono text-white shadow-2xl"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold tracking-normal text-fc-neon-green mb-6 text-center">Login</h2>
        
        <div className="flex gap-4 mb-6">
          <button 
            type="button"
            className={`flex-1 py-2 text-xs font-bold tracking-wider border-b-2 transition-colors ${tab === 'player' ? 'border-fc-neon-green text-white' : 'border-white/10 text-white/40'}`}
            onClick={() => setTab('player')}
          >
            Player
          </button>
          <button 
            type="button"
            className={`flex-1 py-2 text-xs font-bold tracking-wider border-b-2 transition-colors ${tab === 'admin' ? 'border-fc-neon-green text-white' : 'border-white/10 text-white/40'}`}
            onClick={() => setTab('admin')}
          >
            Admin
          </button>
        </div>

        {lastLoginDetails && (
          <div className="mb-6 p-4 bg-white/[0.04] border border-fc-neon-green/35 rounded-xl text-center space-y-2 animate-in fade-in duration-300">
            <p className="text-[10px] text-white/50 tracking-wide font-sans">
              Accidentally logged out? Log back in!
            </p>
            <button
              type="button"
              onClick={handleQuickLogin}
              className="w-full py-2 px-4 bg-fc-neon-green hover:brightness-110 active:scale-[0.98] transition-all text-black rounded-lg text-xs font-bold font-sans flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(34,197,94,0.15)]"
            >
              Log back in as {lastLoginDetails.displayName}
            </button>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          {tab === 'player' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-white/50 mb-2">Select Player Name</label>
                {isLoading ? (
                  <div className="text-xs text-white/50">Loading available spots...</div>
                ) : availablePlayers.length === 0 ? (
                  <div className="text-xs text-red-400">All spots have been taken.</div>
                ) : (
                  <select 
                    value={selectedPlayer}
                    onChange={(e) => setSelectedPlayer(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-fc-neon-green/50 text-white"
                  >
                    {availablePlayers.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}
              </div>
              {selectedPlayer.trim().toLowerCase() === 'barnik' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-[10px] text-white/50 mb-2">Admin Password for Barnik</label>
                  <input 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-fc-neon-green/50 text-white"
                    placeholder="Enter admin password"
                  />
                </div>
              )}
            </div>
          )}

          {tab === 'admin' && (
            <div>
              <label className="block text-[10px] text-white/50 mb-2">Admin Password</label>
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-fc-neon-green/50 text-white"
                placeholder="Enter admin password"
              />
            </div>
          )}

          {error && <div className="text-red-500 text-xs text-center">{error}</div>}

          <button 
            type="submit"
            disabled={tab === 'player' && availablePlayers.length === 0}
            className="w-full py-4 bg-fc-neon-green text-black tracking-normal font-bold text-xs hover:bg-fc-purple-light transition-colors rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Proceed
          </button>
        </form>
      </motion.div>
    </div>
  );
}

const FLAGS = ['🇧🇷', '🇫🇷', '🇩🇪', '🇪🇸', '🇵🇹', '🇦🇷', '🇮🇹', '🇳🇱', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇧🇪', '🇺🇾', '🇭🇷'];

const RotatingFlag = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % FLAGS.length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative inline-block w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 ml-3 md:ml-4 align-middle">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 20, scale: 0.8, rotate: -20 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, y: -20, scale: 0.8, rotate: 20 }}
          transition={{ duration: 0.4, type: "spring", bounce: 0.4 }}
          className="absolute inset-0 flex items-center justify-center text-5xl sm:text-6xl md:text-8xl drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
        >
          {FLAGS[index]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [hasQuotaError, setHasQuotaError] = useState(false);
  const [config, setConfig] = useState<Config>({ registrationEnabled: false });

  useEffect(() => {
    const handleQuotaError = () => setHasQuotaError(true);
    window.addEventListener('quotaExceeded', handleQuotaError);
    return () => window.removeEventListener('quotaExceeded', handleQuotaError);
  }, []);
  const handleResetSingleMatch = async (matchId: string) => {
    if (!isAdmin) return;
    try {
      const isBracketMatch = matchId.startsWith('r16-') || matchId.startsWith('qf-') || matchId.startsWith('sf-') || matchId === 'final' || matchId === 'third-place';
      const collectionName = isBracketMatch ? 'bracket' : 'matches';
      const matchRef = doc(db, collectionName, matchId);
      const resetData = {
        homeScore: 0,
        awayScore: 0,
        status: 'scheduled',
        homeScorers: [],
        awayScorers: [],
        homeStats: null,
        awayStats: null,
        manOfTheMatch: null,
        isDNF: false
      };
      await updateDoc(matchRef, resetData);
      
      if (isBracketMatch) {
         setBracket(prev => prev.map(m => m.id === matchId ? { ...m, ...resetData } as BracketMatch : m));
      } else {
         setDbMatches(prev => prev.map(m => m.id === matchId ? { ...m, ...resetData } as Match : m));
         try {
           localStorage.removeItem('cache_matches');
           const data = await fetchWithCache('cache_matches', collection(db, 'matches'), false, 30000);
           setDbMatches(data);
         } catch(e) {}
      }
      
      alert("Match reset back to scheduled status.");
    } catch (e) {
      console.error("Failed to reset match:", e);
      alert("Failed to reset match.");
    }
  };

  const [activeTab, setActiveTab] = useState<'fixtures' | 'trivia' | 'stats' | 'table' | 'bracket' | 'registration' | 'campaign'>('fixtures');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  const [dbTeams, setDbTeams] = useState<Team[]>([]);
  const [dbMatches, setDbMatches] = useState<Match[]>([]);
  const [isAddMatchModalOpen, setIsAddMatchModalOpen] = useState(false);
  const [addMatchInitialData, setAddMatchInitialData] = useState<{ date: string, home: string, away: string }>({ date: '2026-05-TBD', home: '', away: '' });
  const [dbBracket, setDbBracket] = useState<BracketMatch[]>([]);
  // Statistics Guess states
  const [dbStatsGuesses, setDbStatsGuesses] = useState<StatGuess[]>([]);
  const [triviaUnlocked, setTriviaUnlocked] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedTriviaOption, setSelectedTriviaOption] = useState<string | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [myRegistrationData, setMyRegistrationData] = useState<Registration | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [bracket, setBracket] = useState<BracketMatch[]>([]);
  const [isSubmittingImg, setIsSubmittingImg] = useState(false);
  const [motmInput, setMotmInput] = useState('');
  const [showMotmSuggestions, setShowMotmSuggestions] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
  const [campaignTab, setCampaignTab] = useState<'stats' | 'history' | 'edit'>('stats');
  const [newsFeed, setNewsFeed] = useState<any[]>([]);

  const renderStatsTab = () => {
    return (
      <motion.div
        key="stats"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-6"
      >
        {/* Top Scorers Section */}
        <div className="flex items-center gap-4 mb-4 mt-2">
          <div className="p-3 bg-fc-purple-light/30 rounded-2xl border border-fc-neon-green/50/30">
            <BarChart2 className="w-6 h-6 text-fc-neon-green" />
          </div>
          <div>
            <EditableText id="scorers_header" defaultText="Top Scorers" as="h2" className="font-display text-2xl font-bold  tracking-tight leading-none" />
            <p className="text-fc-neon-green/40 text-xs tracking-normal mt-1">
              <EditableText id="individual_stats_sub" defaultText="Individual Player Statistics" />
            </p>
          </div>
        </div>

        <div className="overflow-x-auto mb-12">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-[#3B82F6] text-[10px] tracking-[0.1em] font-sans font-bold">
                <th className="px-6 py-2">Rank</th>
                <th className="px-6 py-2">Football Player</th>
                <th className="px-6 py-2">Gamer</th>
                <th className="px-6 py-2 text-center">Goals</th>
              </tr>
            </thead>
            <tbody>
              {stats.length > 0 ? stats.map((stat, index) => (
                <tr key={`${stat.playerName}-${stat.teamId}`} className="relative group/row transition-colors duration-150">
                  <td className="px-6 py-4 bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 first:rounded-l-2xl border-y border-l border-white/5 border-r-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-[#3B82F6] text-white shadow-md' : 
                      index === 1 ? 'bg-[#888888] text-white' : 
                      index === 2 ? 'bg-[#EF4444]/20 text-[#EF4444]' : 
                      'bg-white/10 text-white/70'
                    }`}>
                      {index + 1}
                    </div>
                  </td>
                  <td className="px-6 py-4 bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">
                    <span className="font-display font-bold text-lg tracking-tight text-white">{stat.playerName}</span>
                  </td>
                  <td className="px-6 py-4 bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">
                    <div className="flex flex-col">
                      <span className="text-sm font-sans font-bold text-white/80">{stat.gamerFullName}</span>
                      <span className="text-[10px] font-sans font-bold text-[#3B82F6]/80 tracking-normal">{stat.gamerName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 last:rounded-r-2xl border-y border-r border-white/5 border-l-0">
                    <span className="text-2xl font-display text-white">{stat.goals}</span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center bg-white/[0.03] rounded-2xl border border-white/5">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                      <Info className="w-8 h-8" />
                      <p className="text-xs font-sans font-bold tracking-normal">No goals recorded yet</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Clean Sheets Section */}
        <div className="flex items-center gap-4 mb-4 mt-8">
          <div className="p-3 bg-fc-purple-light/30 rounded-2xl border border-fc-neon-green/50/30">
            <BarChart2 className="w-6 h-6 text-fc-neon-green" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold  tracking-tight leading-none text-white">Clean Sheets</h2>
            <p className="text-fc-neon-green/40 text-xs tracking-normal mt-1">Individual Goalkeeper Statistics</p>
          </div>
        </div>

        <div className="overflow-x-auto mb-12">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-[#3B82F6] text-[10px] tracking-[0.1em] font-sans font-bold">
                <th className="px-6 py-2">Rank</th>
                <th className="px-6 py-2">Goalkeeper</th>
                <th className="px-6 py-2">Gamer</th>
                <th className="px-6 py-2 text-center">Clean Sheets</th>
              </tr>
            </thead>
            <tbody>
              {cleanSheets.length > 0 ? cleanSheets.map((stat, index) => (
                <tr key={`${stat.playerName}-${stat.teamId}`} className="relative group/row transition-colors duration-150">
                  <td className="px-6 py-4 bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 first:rounded-l-2xl border-y border-l border-white/5 border-r-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-[#3B82F6] text-white shadow-md' : 
                      index === 1 ? 'bg-[#888888] text-white' : 
                      index === 2 ? 'bg-[#EF4444]/20 text-[#EF4444]' : 
                      'bg-white/10 text-white/70'
                    }`}>
                      {index + 1}
                    </div>
                  </td>
                  <td className="px-6 py-4 bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">
                    <span className="font-display font-bold text-lg tracking-tight text-white">{stat.playerName}</span>
                  </td>
                  <td className="px-6 py-4 bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">
                    <div className="flex flex-col">
                      <span className="text-sm font-sans font-bold text-white/80">{stat.gamerFullName}</span>
                      <span className="text-[10px] font-sans font-bold text-[#3B82F6]/80 tracking-normal">{stat.gamerName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 last:rounded-r-2xl border-y border-r border-white/5 border-l-0">
                    <span className="text-2xl font-display text-white">{stat.cleanSheets}</span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center bg-white/[0.03] rounded-2xl border border-white/5">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                      <Info className="w-8 h-8" />
                      <p className="text-xs font-sans font-bold tracking-normal">No clean sheets recorded yet</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Man of the Match Leaders */}
        <div className="flex items-center gap-4 mb-4 mt-8">
          <div className="p-3 bg-yellow-500/20 rounded-2xl border border-yellow-500/30">
            <Award className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold  tracking-tight leading-none text-white">Man of the Match Leaders</h2>
            <p className="text-white/40 text-xs tracking-normal mt-1">Top Performers</p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 lg:p-8 mb-12 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 w-32 h-32 bg-yellow-500/10 rounded-bl-full pointer-events-none" />
          
          <div className="space-y-4 relative z-10 max-w-2xl">
            {liveMotmLeaders.length > 0 ? (
              liveMotmLeaders.map((leader, index) => {
                let styleClass = 'bg-fc-purple-dark/40 border-white/5';
                let rankClass = 'text-white/40';
                let awardClass = 'text-yellow-400';
                let iconClass = 'text-yellow-500';

                if (index === 0) {
                  styleClass = 'bg-yellow-500/10 border-yellow-500/50 shadow-lg shadow-yellow-500/10';
                  rankClass = 'text-yellow-500 text-xl';
                  awardClass = 'text-yellow-400';
                } else if (index === 1) {
                  styleClass = 'bg-gray-300/10 border-gray-300/50 shadow-lg shadow-gray-300/10';
                  rankClass = 'text-gray-300 text-xl';
                  awardClass = 'text-gray-200';
                  iconClass = 'text-gray-300';
                } else if (index === 2) {
                  styleClass = 'bg-amber-700/10 border-amber-700/50 shadow-lg shadow-amber-700/10';
                  rankClass = 'text-amber-600 text-xl';
                  awardClass = 'text-amber-500';
                  iconClass = 'text-amber-600';
                }

                return (
                  <div key={`${leader.playerName}-${index}`} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 justify-between p-4 rounded-2xl border ${styleClass} transition-all`}>
                    <div className="flex items-center gap-4">
                      <span className={`text-lg font-bold ${rankClass}`}>#{index + 1}</span>
                      <span className="text-base font-bold tracking-normal text-white">{leader.playerName}</span>
                    </div>
                    <div className="flex items-center gap-2 sm:ml-auto">
                      <span className={`${awardClass} font-bold`}>{leader.awards} award{leader.awards !== 1 ? 's' : ''}</span>
                      <Star className={`w-4 h-4 fill-current ${iconClass}`} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <p className="text-white/40 font-bold text-xs tracking-normal">No MOTM awards recorded yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Team Statistics Grid */}
        <div className="flex items-center gap-4 mb-4 mt-8">
          <div className="p-3 bg-fc-purple-base/20 rounded-2xl border border-fc-purple-light/30">
            <BarChart2 className="w-6 h-6 text-fc-neon-green" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold  tracking-tight leading-none text-white">Team Overview</h2>
            <p className="text-white/40 text-xs tracking-normal mt-1">Tournament Averages</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between items-center text-center">
            <span className="text-[10px] font-bold text-fc-neon-green/60 tracking-normal mb-1">Highest Average Possession</span>
            <span className="text-xl md:text-2xl font-display font-bold tracking-tight  mb-2 text-white line-clamp-1">{hofStats.mostPossession?.name || '---'}</span>
            <div className="px-3 py-1 bg-fc-purple-light/20 border border-fc-neon-green/30 rounded-2xl text-fc-neon-green font-bold text-sm">
              {hofStats.mostPossession?.value ? `${hofStats.mostPossession.value.toFixed(1)}%` : '0%'}
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between items-center text-center">
            <span className="text-[10px] font-bold text-green-400/60 tracking-normal mb-1">Most Goals Scored</span>
            <span className="text-xl md:text-2xl font-display font-bold tracking-tight  mb-2 text-white line-clamp-1">{hofStats.mostGoals?.name || '---'}</span>
            <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-400 font-bold text-sm">
              {hofStats.mostGoals?.value || 0} Goals
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between items-center text-center">
            <span className="text-[10px] font-bold text-fc-neon-green/60 tracking-normal mb-1">Best Defense</span>
            <span className="text-xl md:text-2xl font-display font-bold tracking-tight  mb-2 text-white line-clamp-1">{hofStats.leastConceded?.name || '---'}</span>
            <div className="px-3 py-1 bg-fc-purple-light/10 border border-fc-purple-light/20 rounded-2xl text-fc-neon-green font-bold text-sm">
              {hofStats.leastConceded?.value || 0} Goals Conceded
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between items-center text-center">
            <span className="text-[10px] font-bold text-orange-400/60 tracking-normal mb-1">Most Shots Taken</span>
            <span className="text-xl md:text-2xl font-display font-bold tracking-tight  mb-2 text-white line-clamp-1">{hofStats.mostShots?.name || '---'}</span>
            <div className="px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-2xl text-orange-400 font-bold text-sm">
              {hofStats.mostShots?.value || 0} Shots
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between items-center text-center border-yellow-500/30">
            <span className="text-[10px] font-bold text-yellow-400/60 tracking-normal mb-1">Most Early Goals (1-30')</span>
            <span className="text-xl md:text-2xl font-display font-bold tracking-tight  mb-2 text-white line-clamp-1">{hofStats.mostEarlyGoals?.name || '---'}</span>
            <div className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl text-yellow-400 font-bold text-sm">
              {hofStats.mostEarlyGoals?.value || 0} Early Goals
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col justify-between items-center text-center border-red-500/30">
            <span className="text-[10px] font-bold text-red-400/60 tracking-normal mb-1">Most Late Goals (60-90+')</span>
            <span className="text-xl md:text-2xl font-display font-bold tracking-tight  mb-2 text-white line-clamp-1">{hofStats.mostLateGoals?.name || '---'}</span>
            <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 font-bold text-sm">
              {hofStats.mostLateGoals?.value || 0} Late Goals
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const handleDeleteNews = async (id: string | number) => {
    if (!isAdmin || !confirm('Are you sure you want to delete this news article?')) return;
    try {
      const response = await fetch(`${VITE_API_URL}/api/news/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to delete news');
      setNewsFeed(prev => prev.filter(n => n.id !== id));
    } catch (e: any) {
      console.error("Error deleting news:", e);
      alert("Failed to delete news: " + e.message);
    }
  };

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch(`${VITE_API_URL}/api/news`);
        const { data, success } = await response.json();
        if (success && data) {
          console.log("[News] Fetched news data length:", data.length, data);
          setNewsFeed(data);
        } else {
          console.log("[News] Fetched news data is null/undefined or failed");
        }
      } catch (error) {
        console.error("Error fetching news:", error);
      }
    };

    fetchNews();
    
    // Simulate realtime updates by polling every 30 seconds since we removed websockets
    const interval = setInterval(fetchNews, 300000);
    return () => clearInterval(interval);
  }, []);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const teams = useMemo(() => {
    return dbTeams.map(t => ({
      ...t,
      group: config.groupAssignments?.[t.id] || ''
    })).sort((a, b) => {
      const nameA = a.fullName || a.fcName || a.name || '';
      const nameB = b.fullName || b.fcName || b.name || '';
      return nameA.localeCompare(nameB);
    });
  }, [dbTeams, config.groupAssignments]);
  const matches = useMemo(() => dbMatches, [dbMatches]);
  const hofStats = useMemo(() => {
    const monthMatches = matches;
    
    const totalGoals = monthMatches.reduce((acc, m) => acc + (m.homeScore || 0) + (m.awayScore || 0), 0);
    const totalMatches = monthMatches.filter(m => m.status === 'finished').length;
    const avgGoals = totalMatches > 0 ? (totalGoals / totalMatches).toFixed(2) : '0.00';
    
    // Find top scorer for the month
    const playerGoals: { [key: string]: { goals: number, gamer: string } } = {};
    monthMatches.forEach(m => {
      [...(m.homeScorers || []), ...(m.awayScorers || [])].forEach(s => {
        if (!playerGoals[s.playerName]) {
          const team = teams.find(t => t.id === (m.homeScorers?.includes(s) ? m.homeTeamId : m.awayTeamId));
          playerGoals[s.playerName] = { goals: 0, gamer: team?.name || 'Unknown' };
        }
        playerGoals[s.playerName].goals += s.goals;
      });
    });
    
    const topScorer = Object.entries(playerGoals)
      .sort(([, a], [, b]) => b.goals - a.goals)[0];

    // Team Stats
    const teamStats: { [key: string]: { 
      goalsScored: number, 
      goalsConceded: number, 
      possession: number, 
      fouls: number, 
      offsides: number, 
      shots: number, 
      shotsOnTarget: number,
      matches: number,
      earlyGoals: number,
      lateGoals: number
    } } = {};

    monthMatches.forEach(m => {
      if (m.status === 'finished') {
        const hId = m.homeTeamId;
        const aId = m.awayTeamId;
        
        if (!teamStats[hId]) teamStats[hId] = { goalsScored: 0, goalsConceded: 0, possession: 0, fouls: 0, offsides: 0, shots: 0, shotsOnTarget: 0, matches: 0, earlyGoals: 0, lateGoals: 0 };
        if (!teamStats[aId]) teamStats[aId] = { goalsScored: 0, goalsConceded: 0, possession: 0, fouls: 0, offsides: 0, shots: 0, shotsOnTarget: 0, matches: 0, earlyGoals: 0, lateGoals: 0 };
        
        teamStats[hId].goalsScored += (m.homeScore || 0);
        teamStats[hId].goalsConceded += (m.awayScore || 0);
        teamStats[hId].possession += (m.homeStats?.possession || 50);
        teamStats[hId].fouls += (m.homeStats?.fouls || 0);
        teamStats[hId].offsides += (m.homeStats?.offsides || 0);
        teamStats[hId].shots += (m.homeStats?.shots || 0);
        teamStats[hId].shotsOnTarget += (m.homeStats?.shotsOnTarget || 0);
        teamStats[hId].matches += 1;

        // Early/Late tracking
        (m.homeScorers || []).forEach(s => {
          const t = parseInt(s.time || "0");
          if (t > 0 && t <= 30) teamStats[hId].earlyGoals += s.goals;
          if (t >= 60) teamStats[hId].lateGoals += s.goals;
        });

        teamStats[aId].goalsScored += (m.awayScore || 0);
        teamStats[aId].goalsConceded += (m.homeScore || 0);
        teamStats[aId].possession += (m.awayStats?.possession || 50);
        teamStats[aId].fouls += (m.awayStats?.fouls || 0);
        teamStats[aId].offsides += (m.awayStats?.offsides || 0);
        teamStats[aId].shots += (m.awayStats?.shots || 0);
        teamStats[aId].shotsOnTarget += (m.awayStats?.shotsOnTarget || 0);
        teamStats[aId].matches += 1;

        // Early/Late tracking
        (m.awayScorers || []).forEach(s => {
          const t = parseInt(s.time || "0");
          if (t > 0 && t <= 30) teamStats[aId].earlyGoals += s.goals;
          if (t >= 60) teamStats[aId].lateGoals += s.goals;
        });
      }
    });

    const getTopTeam = (key: keyof typeof teamStats[string], mode: 'max' | 'min' = 'max') => {
      const filteredTeams = Object.entries(teamStats).filter(([_, s]) => s.matches > 0);
      if (filteredTeams.length === 0) return { name: '---', value: 0 };

      return filteredTeams
        .map(([id, stats]) => {
          const team = teams.find(t => t.id === id);
          let value = stats[key] as number;
          if (key === 'possession') value = value / stats.matches;
          return { name: team?.name || 'Unknown', value };
        })
        .sort((a, b) => mode === 'max' ? b.value - a.value : a.value - b.value)[0];
    };

    return { 
      totalGoals, 
      totalMatches, 
      avgGoals, 
      topScorer: topScorer ? { name: topScorer[0], ...topScorer[1] } : null,
      mostPossession: getTopTeam('possession'),
      mostGoals: getTopTeam('goalsScored'),
      leastConceded: getTopTeam('goalsConceded', 'min'),
      mostFouls: getTopTeam('fouls'),
      mostOffsides: getTopTeam('offsides'),
      mostShots: getTopTeam('shots'),
      mostShotsOnTarget: getTopTeam('shotsOnTarget'),
      mostEarlyGoals: getTopTeam('earlyGoals'),
      mostLateGoals: getTopTeam('lateGoals')
    };
  }, [matches, teams]);
  
  const standings = useMemo(() => calculateStandings(teams, matches), [teams, matches]);
  
  const groupedStandings = useMemo(() => {
    if (config.groupType !== 'many') return null;
    const groups: Record<string, Team[]> = {};
    
    // Sort first
    const sorted = [...standings].sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
    
    sorted.forEach(team => {
      const g = team.group || 'Unassigned';
      if (!groups[g]) groups[g] = [];
      groups[g].push(team);
    });
    
    return groups;
  }, [standings, config.groupType, config.groupAssignments]);

  const sortedGroupKeys = useMemo(() => {
    if (!groupedStandings) return [];
    return Object.keys(groupedStandings).sort((a, b) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return a.localeCompare(b);
    });
  }, [groupedStandings]);
  const stats = useMemo(() => calculateStats(teams, matches).slice(0, 10), [teams, matches]);
  const cleanSheets = useMemo(() => calculateCleanSheets(teams, matches).slice(0, 10), [teams, matches]);
  
  const motmSuggestions = useMemo(() => {
    const list = new Set<string>();
    // Previously saved man of the matches from all tournament matches
    matches.forEach(m => {
      if (m.manOfTheMatch && m.manOfTheMatch.trim()) {
        const canonical = canonicalizePlayerName(m.manOfTheMatch);
        if (canonical) {
          list.add(formatPlayerName(m.manOfTheMatch));
        }
      }
    });
    return Array.from(list).sort((a, b) => a.localeCompare(b));
  }, [matches]);
  
  const [liveMotmLeaders, setLiveMotmLeaders] = useState<{playerName: string, awards: number}[]>([]);
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'motm_leaderboard', 'global'), (docSnap) => {
       if (docSnap.exists()) {
          const players = docSnap.data().players || {};
          const leaders = Object.entries(players)
             .map(([playerName, awards]) => ({ playerName, awards: awards as number }))
             .filter(p => p.awards > 0)
             .sort((a,b) => b.awards - a.awards)
             .slice(0, 5);
          setLiveMotmLeaders(leaders);
       } else {
          setLiveMotmLeaders([]);
       }
    });
    return () => unsub();
  }, []);

  const upcomingRef = React.useRef<HTMLDivElement>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Firebase State
  const [user, setUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);
  const [hasRegistered, setHasRegistered] = useState(false);
  const [matchLabels, setMatchLabels] = useState<Record<string, string>>({}); // date -> status
  const [qualificationStatus, setQualificationStatus] = useState<Record<string, string>>({});

  const [lastLoginDetails, setLastLoginDetails] = useState<any>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('last_login_details');
      if (stored) {
        setLastLoginDetails(JSON.parse(stored));
      } else {
        setLastLoginDetails(null);
      }
    } catch (e) {}
  }, [user]);

  const handleQuickLogin = async () => {
    if (!lastLoginDetails) return;
    try {
      setIsDataLoading(true);
      await signIn(lastLoginDetails.username, lastLoginDetails.password || "", lastLoginDetails.role || "user");
    } catch (err) {
      console.error("Quick login failed", err);
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    let _mounted = true;
    const loadMatchLabels = async () => {
      try {
        const data = await fetchWithCache('cache_match_labels', collection(db, 'match_labels'), false, 600000);
        const labels: Record<string, string> = {};
        data.forEach((docData: any) => labels[docData.id] = docData.status);
        if (_mounted) setMatchLabels(labels);
      } catch (err) {}
    };
    loadMatchLabels();
    const interval = setInterval(loadMatchLabels, 300000);

    const handleOpenProfile = (e: Event) => {
      const customEvent = e as CustomEvent;
      setSelectedTeam(customEvent.detail);
    };
    window.addEventListener('openTeamProfile', handleOpenProfile);

    return () => {
      _mounted = false;
      clearInterval(interval);
      window.removeEventListener('openTeamProfile', handleOpenProfile);
    };
  }, []);

  useEffect(() => {
    let _mounted = true;
    const loadQual = async () => {
      try {
        const docSnap = await fetchWithCache('cache_qual', doc(db, 'config', 'qualification'), true, 600000);
        if (_mounted && docSnap?.statuses) setQualificationStatus(docSnap.statuses);
      } catch (err) {}
    };
    loadQual();
    const interval = setInterval(loadQual, 300000);
    return () => {
      _mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleAnalyzeQualification = async () => {
    if (!isAdmin) return;
    try {
      const statuses: Record<string, string> = {};
      const currentStandings = calculateStandings(teams, matches);

      if (config.groupType === 'many') {
        const K = 2;
        const groups: Record<string, Team[]> = {};
        currentStandings.forEach(t => {
          const g = config.groupAssignments?.[t.id] || 'Unassigned';
          if (!groups[g]) groups[g] = [];
          groups[g].push(t);
        });

        const remainingMatches: Record<string, number> = {};
        teams.forEach(t => {
          let played = 0;
          const tGroup = config.groupAssignments?.[t.id] || '';
          matches.filter(m => m.status === 'finished').forEach(m => {
            const hGroup = config.groupAssignments?.[m.homeTeamId] || '';
            const aGroup = config.groupAssignments?.[m.awayTeamId] || '';
            if (hGroup === tGroup && aGroup === tGroup) {
              if (m.homeTeamId === t.id || m.awayTeamId === t.id) played++;
            }
          });
          
          let totalFixtures = 0;
          matches.forEach(m => {
            const hGroup = config.groupAssignments?.[m.homeTeamId] || '';
            const aGroup = config.groupAssignments?.[m.awayTeamId] || '';
            if (hGroup === tGroup && aGroup === tGroup) {
              if (m.homeTeamId === t.id || m.awayTeamId === t.id) totalFixtures++;
            }
          });
          remainingMatches[t.id] = Math.max(0, totalFixtures - played);
        });

        Object.entries(groups).forEach(([groupName, groupTeams]) => {
          if (groupName === 'Unassigned') return;
          groupTeams.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);

          groupTeams.forEach(t => {
            const currentPoints = t.points;
            const maxPoints = currentPoints + (remainingMatches[t.id] * 3);
            
            const otherTeamsMaxPoints = groupTeams
              .filter(other => other.id !== t.id)
              .map(other => other.points + (remainingMatches[other.id] * 3))
              .sort((a, b) => b - a);
              
            const secondBestOther = otherTeamsMaxPoints[K - 1] ?? 0;
            
            if (currentPoints > secondBestOther && groupTeams.length > K) {
              statuses[t.id] = 'Q';
            } else {
              const currentSecondPoints = groupTeams[K - 1]?.points ?? 0;
              if (maxPoints < currentSecondPoints && groupTeams.length >= K) {
                statuses[t.id] = 'E';
              }
            }
          });
        });
      } else {
        const K = 8;
        const remainingMatches: Record<string, number> = {};
        
        teams.forEach(t => {
           let played = 0;
           matches.forEach(m => {
              if (m.matchday && m.matchday < 5 && m.status === 'finished') {
                 if (m.homeTeamId === t.id || m.awayTeamId === t.id) played++;
              }
           });
           let totalFixtures = 0;
           matches.forEach(m => {
              if (m.matchday && m.matchday < 5 && (m.homeTeamId === t.id || m.awayTeamId === t.id)) totalFixtures++;
           });
           remainingMatches[t.id] = Math.max(0, totalFixtures - played);
        });

        const standingsSorted = [...currentStandings].sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
        
        standingsSorted.forEach(t => {
           const currentPoints = t.points;
           const maxPoints = currentPoints + (remainingMatches[t.id] * 3);
           
           const otherTeamsMaxPoints = standingsSorted
               .filter(other => other.id !== t.id)
               .map(other => other.points + (remainingMatches[other.id] * 3))
               .sort((a, b) => b - a);
               
           const eighthBestOther = otherTeamsMaxPoints[K - 1] ?? 0;
           
           if (currentPoints > eighthBestOther) {
               statuses[t.id] = 'Q';
           } else {
               const currentEighthPoints = standingsSorted[K - 1]?.points || 0;
               if (maxPoints < currentEighthPoints) {
                   statuses[t.id] = 'E';
               }
           }
        });
      }

      await setDoc(doc(db, 'config', 'qualification'), { statuses });
      await refreshCache('cache_qual');
      alert("Qualification statuses analyzed & updated successfully!");
    } catch (error) {
      console.error("Qualification analysis failed:", error);
    }
  };

  const updateMatchLabel = async (date: string, status: string) => {
    if (!isAdmin) return;
    await setDoc(doc(db, 'match_labels', date), { status }, { merge: true });
  };

  const handleRenameMatchDate = async (oldDate: string, newDate: string) => {
    if (!isAdmin || !oldDate || !newDate || oldDate === newDate) return;
    try {
      const batch = writeBatch(db);
      // Update matches
      matches.forEach(m => {
        if (m.date === oldDate) {
          batch.update(doc(db, 'matches', m.id), { date: newDate });
        }
      });
      
      // Update match_labels if exists
      if (matchLabels[oldDate]) {
        batch.set(doc(db, 'match_labels', newDate), { status: matchLabels[oldDate] });
        batch.delete(doc(db, 'match_labels', oldDate));
      }
      
      // Update hiddenDates & dateOrder in config if needed
      let newConfig = { ...config };
      let configChanged = false;
      if (config.hiddenDates?.includes(oldDate)) {
        newConfig.hiddenDates = config.hiddenDates.map(d => d === oldDate ? newDate : d);
        configChanged = true;
      }
      if (config.dateOrder?.includes(oldDate)) {
        newConfig.dateOrder = config.dateOrder.map(d => d === oldDate ? newDate : d);
        configChanged = true;
      }
      if (configChanged) {
        batch.update(doc(db, 'config', 'global'), newConfig);
      }
      
      await batch.commit();
    } catch (e) {
      console.error("Failed to rename date:", e);
      alert("Failed to rename date.");
    }
  };

  const [isEditingMode, setIsEditingMode] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [adminEditingRegistration, setAdminEditingRegistration] = useState<Registration | null>(null);

  const handleAdminUpdateUserRegistration = async (reg: Registration) => {
    if (!isAdmin) return;
    setIsSubmittingRegistration(true);
    try {
      await setDoc(doc(db, 'registrations', reg.id), reg, { merge: true });
      const teamsData = await fetchWithCache('cache_teams', query(collection(db, 'registrations'), where('status', '==', 'approved')), false, 300000);
      const teamsList: Team[] = teamsData.map((data: any) => ({
        id: data.id,
        name: data.fcName,
        shortName: data.fcName.substring(0, 3).toUpperCase(),
        fullName: data.name,
        fcName: data.fcName,
        ovr: data.teamOvr,
        uid: data.id,
        logoUrl: data.logoUrl,
        goalkeeper: data.goalkeeper,
        country: data.country,
        played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: []
      }));
      setDbTeams(teamsList);
    } catch (error) {
      console.error("Error updating user registration by admin:", error);
    } finally {
      setIsSubmittingRegistration(false);
      setAdminEditingRegistration(null);
    }
  };
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  const isAdmin = useMemo(() => {
    return user?.email === 'webblogger82@gmail.com' || user?.email === 'admin@uxl.com' || (user as any)?.role === 'admin';
  }, [user]);

  const isDrawAdmin = useMemo(() => {
    return (user as any)?.role === 'draw_admin' && config?.drawAdminEnabled !== false;
  }, [user, config]);

  // For debugging, only shown in development console
  useEffect(() => {
    if (user) {
      // Logic for admin check
    }
  }, [user, isAdmin]);

  const [isSavingAdmin, setIsSavingAdmin] = useState(false);
  const [visitCount, setVisitCount] = useState<number>(0);
  const [isSavingBracket, setIsSavingBracket] = useState(false);
  const [siteContent, setSiteContent] = useState<Record<string, any>>({});

  useEffect(() => {
    let _mounted = true;
    const loadSiteContent = async () => {
      try {
        const q = query(collection(db, 'site_content'));
        const data = await fetchWithCache('cache_site_content', q, false, 600000);
        const content: Record<string, any> = {};
        data.forEach((docData: any) => {
          content[docData.id] = docData;
        });
        if (_mounted) setSiteContent(content);
      } catch (err) {
        console.error("Failed to load site content");
      }
    };
    loadSiteContent();
    const interval = setInterval(loadSiteContent, 300000);
    return () => {
      _mounted = false;
      clearInterval(interval);
    };
  }, []);

  const updateSiteContent = async (id: string, content: string, isImage: boolean = false) => {
    if (!isAdmin) return;
    try {
      // Optimistic update
      setSiteContent(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          [isImage ? 'imageUrl' : 'text']: content,
          updatedAt: new Date()
        }
      }));

      await setDoc(doc(db, 'site_content', id), { 
        [isImage ? 'imageUrl' : 'text']: content, 
        updatedAt: serverTimestamp() 
      }, { merge: true });
      await refreshCache('site_content');
    } catch (err) {
      console.error("Failed to update site content:", err);
    }
  };

  const EditableImage = ({ id, defaultSrc, alt, className = "", isAdmin }: any) => {
    const data = siteContent[id] || {};
    // Fallback carefully: if it has imageUrl, use it. If it has content, use it. Else default.
    const src = data.imageUrl || data.content || defaultSrc;

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      try {
        const base64 = await compressImage(file);
        await updateSiteContent(id, base64, true);
      } catch (err) {
        console.error("Failed to upload image:", err);
        alert("Failed to update image");
      }
    };

    if (isAdmin && isEditingMode) {
      return (
        <div className={`relative group ${className}`}>
          <img src={src} alt={alt} referrerPolicy="no-referrer" className={`w-full h-full object-cover`} />
          <div className="absolute inset-0 bg-fc-purple-dark/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
             <label className="bg-fc-neon-green text-black px-4 py-2 rounded-2xl text-black text-xs font-bold cursor-pointer hover:bg-fc-neon-green text-black transition-colors">
               Change Image
               <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
             </label>
          </div>
        </div>
      );
    }
    
    return <img src={src} alt={alt} referrerPolicy="no-referrer" className={className} />;
  };

  const EditableText = ({ 
    id, 
    defaultText, 
    as: Component = 'span', 
    className = "", 
    isAdmin,
    isImage = false 
  }: { 
    id: string, 
    defaultText: string, 
    as?: any, 
    className?: string, 
    isAdmin?: any,
    isImage?: boolean 
  }) => {
    const data = siteContent[id] || {};
    const text = data.text || defaultText;
    const imageUrl = data.imageUrl;
    const [isEditing, setIsEditing] = useState(false);
    const [tempContent, setTempContent] = useState(isImage ? imageUrl : text);

    useEffect(() => {
      setTempContent(isImage ? imageUrl : text);
    }, [text, imageUrl, isImage]);

    const handleSave = async () => {
      if (!isAdmin) return;
      try {
        await updateSiteContent(id, tempContent, isImage);
        setIsEditing(false);
      } catch (err) {
        console.error("Save failed:", err);
      }
    };

    if (isEditing && isAdmin) {
      return (
        <div className="inline-flex items-center gap-2 group/edit-mode">
          <input 
            type="text"
            value={tempContent || ''}
            onChange={(e) => setTempContent(e.target.value)}
            className="bg-white/20 border border-fc-neon-green/50 rounded p-1 outline-none text-white text-xs font-sans"
            autoFocus
            placeholder={isImage ? "Image URL" : "Text"}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') setIsEditing(false);
            }}
          />
          <div className="flex flex-col gap-1">
            <button onClick={handleSave} className="p-1 bg-green-500 rounded text-black hover:bg-green-400">
              <Check className="w-3 h-3" />
            </button>
            <button onClick={() => setIsEditing(false)} className="p-1 bg-red-500 rounded text-white hover:bg-red-400">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <span className={`group/edit relative inline-flex items-center ${className}`}>
        {isImage ? (
          <img src={imageUrl || defaultText} alt={id} className={className} referrerPolicy="no-referrer" />
        ) : (
          <Component>{text}</Component>
        )}
        {isAdmin && isEditingMode && (
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setTempContent(isImage ? imageUrl : text);
              setIsEditing(true);
            }}
            className="p-1.5 bg-fc-neon-green text-black hover:bg-fc-neon-green text-black rounded-2xl text-black transition-all scale-75 absolute -right-8 top-1/2 -translate-y-1/2 z-[100] shadow-xl border border-fc-neon-green/40"
            title={isImage ? "Edit Image" : "Edit Text"}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}
      </span>
    );
  };

  const handleToggleRegistration = async () => {
    if (!isAdmin) return;
    setIsSavingAdmin(true);
    try {
      await setDoc(doc(db, 'config', 'system'), {
        registrationEnabled: !config.registrationEnabled
      }, { merge: true });
      await refreshCache('config');
    } catch (error) {
      console.error("Error toggling registration:", error);
    } finally {
      setIsSavingAdmin(false);
    }
  };

  const handleUpdateConfig = async (newConfig: Config) => {
    if (!isAdmin && !isDrawAdmin) return;
    setIsSavingAdmin(true);
    try {
      await setDoc(doc(db, 'config', 'system'), newConfig, { merge: true });
      await refreshCache('config');
    } catch (error) {
      console.error("Error updating config:", error);
    } finally {
      setIsSavingAdmin(false);
    }
  };

  const handleRandomizeGroups = async () => {
    if (!isAdmin) return;
    const approvedRegs = registrations.filter(r => r.status === 'approved');
    if (approvedRegs.length === 0) {
      alert("No approved players available. Please approve some registrations first!");
      return;
    }
    
    const size = config.playersPerGroup || 3;
    const shuffled = [...approvedRegs].sort(() => Math.random() - 0.5);
    const assignments: Record<string, string> = {};
    
    let targetNumGroups = Math.floor(shuffled.length / size);
    if (targetNumGroups === 0) targetNumGroups = 1;
    
    for (let i = 0; i < shuffled.length; i++) {
      const grpIdx = Math.min(Math.floor(i / size), targetNumGroups - 1);
      const letter = String.fromCharCode(65 + grpIdx);
      assignments[shuffled[i].id] = letter;
    }
    
    await handleUpdateConfig({
      ...config,
      groupAssignments: assignments
    });
    alert(`Successfully distributed ${approvedRegs.length} players into ${targetNumGroups} groups of target size ${size}!`);
  };

  const handleClearGroups = async () => {
    if (!isAdmin) return;
    if (confirm("Are you sure you want to clear all group assignments?")) {
      await handleUpdateConfig({
        ...config,
        groupAssignments: {}
      });
    }
  };

  const handleSaveBracket = async (bracketMatch: Partial<BracketMatch> & { id: string }) => {
    if (!isAdmin && !isDrawAdmin) return;
    setIsSavingBracket(true);
    try {
      // 1. Save local/remote bracket state
      await setDoc(doc(db, 'bracket', bracketMatch.id), bracketMatch, { merge: true });

      // 2. Sync to corresponding linked fixture if existing
      const existingBracketMatch = bracket.find(b => b.id === bracketMatch.id);
      const targetLinkedId = bracketMatch.linkedMatchId !== undefined ? bracketMatch.linkedMatchId : existingBracketMatch?.linkedMatchId;
      
      if (targetLinkedId) {
        const updateData: any = {};
        if (bracketMatch.homeTeamId !== undefined) {
          updateData.homeTeamId = bracketMatch.homeTeamId;
        }
        if (bracketMatch.awayTeamId !== undefined) {
          updateData.awayTeamId = bracketMatch.awayTeamId;
        }
        if (bracketMatch.homeScore !== undefined) {
          updateData.homeScore = bracketMatch.homeScore;
        }
        if (bracketMatch.awayScore !== undefined) {
          updateData.awayScore = bracketMatch.awayScore;
        }
        
        if (updateData.homeScore !== undefined || updateData.awayScore !== undefined) {
          updateData.status = 'finished';
        }

        if (Object.keys(updateData).length > 0) {
          await setDoc(doc(db, 'matches', targetLinkedId), updateData, { merge: true });
          await refreshCache('matches');
        }
      }

      await refreshCache('bracket');
    } catch (error) {
      console.error("Error saving bracket match:", error);
      alert("Failed to save bracket match.");
    } finally {
      setIsSavingBracket(false);
    }
  };

  const handleDeleteMatch = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'matches', id));
      await refreshCache('matches');
    } catch (error) {
      console.error("Error deleting match:", error);
      alert("Failed to delete match.");
    }
  };

  const cleanDocData = (data: any) => {
    const result: any = {};
    Object.keys(data).forEach(key => {
      if (key.startsWith('_')) return;
      if (data[key] === undefined) return;
      if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
        result[key] = cleanDocData(data[key]);
      } else {
        result[key] = data[key];
      }
    });
    return result;
  };


  const handleAddNewFixture = async (fixtureDataOrDay?: { date: string, home: string, away: string } | string) => {
    if (!isAdmin && !isDrawAdmin) return;
    
    let date = '';
    let homePlayer = '';
    let awayPlayer = '';

    if (typeof fixtureDataOrDay === 'string') {
      // Open modal with pre-filled date
      setAddMatchInitialData({ date: fixtureDataOrDay, home: '', away: '' });
      setIsAddMatchModalOpen(true);
      return;
    } else if (fixtureDataOrDay && typeof fixtureDataOrDay === 'object') {
      // Modal save logic
      date = fixtureDataOrDay.date || 'TBD';
      homePlayer = fixtureDataOrDay.home || 'TBD';
      awayPlayer = fixtureDataOrDay.away || 'TBD';
      setIsAddMatchModalOpen(false);
    } else {
      // Global add button logic: open the modal with default
      setAddMatchInitialData({ date: '2026-05-TBD', home: '', away: '' });
      setIsAddMatchModalOpen(true);
      return;
    }

    try {
      const matchId = `match-${Math.random().toString(36).substring(7)}`;
      
      // Calculate where to insert and shift match numbers
      // We sort matches globally: by date, then matchNumber
      const sortedMatches = [...matches].sort((a, b) => {
        if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
        return (a.matchNumber || 0) - (b.matchNumber || 0);
      });

      // Find the first match that should come AFTER this one
      // We'll put it at the end of the matches for that specific date
      let insertIndex = sortedMatches.length;
      for (let i = 0; i < sortedMatches.length; i++) {
        // If we found a date that is strictly GREATER than our new date, we insert BEFORE it
        if ((sortedMatches[i].date || '').localeCompare(date) > 0) {
          insertIndex = i;
          break;
        }
      }
      
      const newMatchNumber = insertIndex + 1;
      
      let homeId = '';
      let awayId = '';
      
      if (homePlayer && homePlayer !== 'TBD') {
        const team = dbTeams.find(t => 
          t.id === homePlayer ||
          t.name?.toLowerCase() === homePlayer.toLowerCase() || 
          t.fullName?.toLowerCase() === homePlayer.toLowerCase() ||
          t.fcName?.toLowerCase() === homePlayer.toLowerCase()
        );
        homeId = team ? team.id : homePlayer;
      }
      
      if (awayPlayer && awayPlayer !== 'TBD') {
        const team = dbTeams.find(t => 
          t.id === awayPlayer ||
          t.name?.toLowerCase() === awayPlayer.toLowerCase() || 
          t.fullName?.toLowerCase() === awayPlayer.toLowerCase() ||
          t.fcName?.toLowerCase() === awayPlayer.toLowerCase()
        );
        awayId = team ? team.id : awayPlayer;
      }

      const newMatch: Match = {
        id: matchId,
        matchNumber: newMatchNumber,
        date: date,
        status: 'scheduled',
        homeTeamId: homeId,
        awayTeamId: awayId,
      };
      
      // Prepare batch update to shift other matches
      const batch = writeBatch(db);
      batch.set(doc(db, 'matches', matchId), newMatch);

      const shiftedMatches = sortedMatches.slice(insertIndex).map((m, idx) => ({
        ...m,
        matchNumber: newMatchNumber + idx + 1
      }));

      shiftedMatches.forEach(m => {
        batch.update(doc(db, 'matches', m.id), { matchNumber: m.matchNumber });
      });

      // Optimistic state update
      setDbMatches(prev => {
        const updated = prev.map(m => {
          const shifted = shiftedMatches.find(sm => sm.id === m.id);
          return shifted ? { ...m, matchNumber: shifted.matchNumber } : m;
        });
        return [...updated, newMatch];
      });
      
      await batch.commit();
      await refreshCache('matches');
    } catch(err) {
      console.error("Error adding match:", err);
      alert('Error adding new fixture.');
    }
  };

  const refreshCache = async (type: 'matches' | 'teams' | 'bracket' | 'config' | 'site_content' | 'cache_qual') => {
    try {
      if (type === 'matches') {
        localStorage.removeItem('cache_matches');
        const data = await fetchWithCache('cache_matches', collection(db, 'matches'), false, 30000);
        setDbMatches(data);
      } else if (type === 'teams') {
        localStorage.removeItem('cache_teams');
        const teamsData = await fetchWithCache('cache_teams', query(collection(db, 'registrations'), where('status', '==', 'approved')), false, 300000);
        const teamsList: Team[] = teamsData.map((data: any) => ({
          id: data.id, name: data.fcName, shortName: data.fcName.substring(0, 3).toUpperCase(),
          fullName: data.name, fcName: data.fcName, ovr: data.teamOvr, uid: data.id,
          logoUrl: data.logoUrl, goalkeeper: data.goalkeeper, country: data.country, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: []
        }));
        setDbTeams(teamsList);
      } else if (type === 'bracket') {
         localStorage.removeItem('cache_bracket');
         const q = query(collection(db, 'bracket'));
         const bracketDataMap: Record<string, BracketMatch> = {};
         INITIAL_BRACKET.forEach(m => bracketDataMap[m.id!] = { ...m });
         const snapshot = await fetchWithCache('cache_bracket', q, false, 0);
         snapshot.forEach((data: any) => { bracketDataMap[data.id] = data; });
         setBracket(INITIAL_BRACKET.map(m => bracketDataMap[m.id!]));
      } else if (type === 'config') {
         localStorage.removeItem('cache_config');
         const data = await fetchWithCache('cache_config', doc(db, 'config', 'system'), true, 0);
         if (data) setConfig(data as Config);
      } else if (type === 'site_content') {
         localStorage.removeItem('cache_site_content');
         const q = query(collection(db, 'site_content'));
         const data = await fetchWithCache('cache_site_content', q, false, 600000);
         const content: Record<string, any> = {};
         data.forEach((docData: any) => { content[docData.id] = docData; });
         setSiteContent(content);
      } else if (type === 'cache_qual') {
         localStorage.removeItem('cache_qual');
         const docSnap = await fetchWithCache('cache_qual', doc(db, 'config', 'qualification'), true, 600000);
         if (docSnap?.statuses) setQualificationStatus(docSnap.statuses);
      }
    } catch (e) {
      console.error("Error refreshing cache:", e);
    }
  };

  const handleUpdateMatch = async (match: Match) => {
    const isParticipant = user && (match.homeTeamId === user.uid || match.awayTeamId === user.uid);
    if (!isAdmin && !isDrawAdmin && !isParticipant) {
       alert("Permission denied. Only admins or match participants can update results.");
       return;
    }
    try {
      const cleanedData = cleanDocData(match);
      setDbMatches(prev => prev.map(m => m.id === match.id ? { ...m, ...cleanedData } as Match : m));
      await updateDoc(doc(db, 'matches', match.id), cleanedData);
      await refreshCache('matches');
      


      if (cleanedData.status === 'finished') {
        const homeT = dbTeams.find(t => t.id === match.homeTeamId);
        const awayT = dbTeams.find(t => t.id === match.awayTeamId);
        const enrichedMatchData = {
          ...cleanedData,
          homePlayer: homeT?.name || homeT?.fcName,
          awayPlayer: awayT?.name || awayT?.fcName
        };
        fetch(`${VITE_API_URL}/api/generate-news`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchData: enrichedMatchData,
            leagueTable: null, // Could map team names to their standings here if we wanted
            trigger: 'match-updated'
          })
        }).catch(e => console.error("News trigger failed:", e));
      }
    } catch (error) {
      console.error("Error updating match:", error);
      alert("Failed to update match.");
    }
  };

  const handleApproveRegistration = async (id: string) => {
    if (!isAdmin) {
      alert("Permission denied");
      return;
    }
    try {
      await updateDoc(doc(db, 'registrations', id), { status: 'approved' });
      await refreshCache('teams');
    } catch (error) {
      console.error("Approval failed:", error);
    }
  };

  const handleDeleteRegistration = async (id: string) => {
    if (!isAdmin) {
      alert("Permission denied");
      return;
    }
    const doubleConfirm = window.confirm("Are you absolutely sure you want to delete this player? This will PERMANENTLY delete their registration, user account, group assignments, and ALL of their scheduled/played matches! This data cannot be recovered.");
    if (!doubleConfirm) return;

    try {
      // Find the registration first to get userId
      const reg = registrations.find(r => r.id === id);

      // Delete all matches played or scheduled for this player
      const matchesToDelete = dbMatches.filter(m => m.homeTeamId === id || m.awayTeamId === id);
      for (const m of matchesToDelete) {
        await deleteDoc(doc(db, 'matches', m.id));
      }

      // Remove from group assignments
      if (config.groupAssignments && config.groupAssignments[id]) {
        const newGroupAssignments = { ...config.groupAssignments };
        delete newGroupAssignments[id];
        await handleUpdateConfig({
          ...config,
          groupAssignments: newGroupAssignments
        });
      }

      // Delete the registration document
      await deleteDoc(doc(db, 'registrations', id));
      if (reg && reg.userId) {
        try {
          await deleteDoc(doc(db, 'users', reg.userId));
        } catch (ignored) {
          console.warn("Could not delete user shadow document, it might be protected.");
        }
      }

      // Refresh caches to update listings and standings immediately
      await refreshCache('matches');
      await refreshCache('teams');
      alert("Player, group assignments, and all related matches have been permanently deleted and reset.");
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Delete failed. Check console.");
    }
  };

  const handleResetAllRegistrations = async () => {
    if (!isAdmin) {
      alert("Permission denied");
      return;
    }
    const confirmFirst = window.confirm("Are you absolutely sure you want to perform a FULL RESET? This will delete all players, teams, and user registration accounts from the tournament data. This action cannot be undone!");
    if (!confirmFirst) return;
    
    const confirmSecond = window.confirm("WARNING: Doing this will wipe the registration list clean so players can register afresh. Click OK to confirm the permanent wipe.");
    if (!confirmSecond) return;

    try {
      // Fetch all registrations from server directly
      const colRef = collection(db, 'registrations');
      const snap = await getDocs(colRef);
      
      const promises: Promise<void>[] = [];
      snap.forEach((docSnap: any) => {
        promises.push(deleteDoc(doc(db, 'registrations', docSnap.id)));
        const data = docSnap.data();
        if (data && data.userId) {
          promises.push(deleteDoc(doc(db, 'users', data.userId)).catch(() => {}));
        }
      });
      
      // Also fetch and clean users who registered but might not have entries
      const usersCol = collection(db, 'users');
      const usersSnap = await getDocs(usersCol);
      usersSnap.forEach((userDoc: any) => {
        const u = userDoc.data();
        if (u && u.role !== 'admin' && userDoc.id !== user?.uid) {
          promises.push(deleteDoc(doc(db, 'users', userDoc.id)).catch(() => {}));
        }
      });

      await Promise.all(promises);

      // Clear local caches
      localStorage.removeItem('cache_teams');
      localStorage.removeItem('cache_matches');
      localStorage.removeItem('cache_bracket');

      const qKey = 'registrations';
      localStorage.removeItem(`sb_query_${qKey}`);
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb_query_') || key.startsWith('sb_cache_'))) {
          localStorage.removeItem(key);
        }
      }

      await refreshCache('teams');
      alert("All registrations and user accounts have been successfully wiped and reset!");
      window.location.reload();
    } catch (error) {
      console.error("Full reset failed:", error);
      alert(`Wipe failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRejectRegistration = async (id: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'registrations', id), { status: 'rejected' });
    } catch (error) {
      console.error("Rejection failed:", error);
    }
  };



  const handleUpdateRegistration = async (reg: Registration) => {
    if (!user || user.uid !== reg.userId) return;
    setIsSubmittingRegistration(true);
    try {
      await setDoc(doc(db, 'registrations', reg.id), reg, { merge: true });
      const teamsData = await fetchWithCache('cache_teams', query(collection(db, 'registrations'), where('status', '==', 'approved')), false, 300000);
      const teamsList: Team[] = teamsData.map((data: any) => ({
        id: data.id,
        name: data.fcName,
        shortName: data.fcName.substring(0, 3).toUpperCase(),
        fullName: data.name,
        fcName: data.fcName,
        ovr: data.teamOvr,
        uid: data.id,
        logoUrl: data.logoUrl,
        goalkeeper: data.goalkeeper,
        country: data.country,
        played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: []
      }));
      setDbTeams(teamsList);
    } catch (error) {
      console.error("Error updating registration:", error);
    } finally {
      setIsSubmittingRegistration(false);
    }
  };

  const handleResetPlayerMatches = async (teamId: string) => {
    if (!isAdmin) return;
    try {
      const batch = writeBatch(db);
      const teamMatches = matches.filter(m => m.homeTeamId === teamId || m.awayTeamId === teamId);
      
      for (const m of teamMatches) {
        batch.update(doc(db, 'matches', m.id), {
          homeScore: null,
          awayScore: null,
          status: 'scheduled',
          homeScorers: [],
          awayScorers: [],
          homeStats: null,
          awayStats: null,
          manOfTheMatch: null,
          isDNF: false
        });
      }
      
      await batch.commit();
      alert("Player stats reset successfully.");
      setSelectedTeam(null);
    } catch (e) {
      console.error(e);
      alert("Failed to reset player matches.");
    }
  };

  const seedBracket = async () => {
    if (!isAdmin) return;
    try {
      const bSnap = await getDocs(collection(db, 'bracket'));
      const existingIds = bSnap.docs.map(d => d.id);
      
      const batch = writeBatch(db);
      let needsCommit = false;
      for (const match of INITIAL_BRACKET) {
        if (!existingIds.includes(match.id!)) {
          const docRef = doc(db, 'bracket', match.id!);
          batch.set(docRef, match);
          needsCommit = true;
        }
      }
      if (needsCommit) {
         await batch.commit();
      }
    } catch (error) {
      console.error("Bracket seeding failed:", error);
    }
  };

  const handleResetPlayer = async (teamId: string) => {
    if (!isAdmin) return;
    try {
      const batch = writeBatch(db);
      const mSnap = await getDocs(collection(db, 'matches'));
      mSnap.docs.forEach(d => {
        const data = d.data();
        if (data.homeTeamId === teamId || data.awayTeamId === teamId) {
          batch.update(d.ref, {
            homeScore: null,
            awayScore: null,
            status: 'scheduled',
            homeScorers: [],
            awayScorers: [],
            homeStats: null,
            awayStats: null,
            manOfTheMatch: null,
            isDNF: false
          });
        }
      });
      await batch.commit();
      localStorage.removeItem('cache_matches');
      await refreshCache('matches');
      setSelectedTeam(null);
    } catch(err) {
      console.error("Error resetting player:", err);
      alert("Failed to reset player matches.");
    }
  };

  const handleAdminReset = async (type: 'matches' | 'bracket' | 'table' | 'registrations' | 'stats' | 'all') => {
    if (!isAdmin) {
      alert("Admin access required.");
      return;
    }
    
    try {
      const batch = writeBatch(db);
      
      if (type === 'matches') {
        const mSnap = await getDocs(collection(db, 'matches'));
        mSnap.docs.forEach(d => batch.delete(d.ref));
      } else if (type === 'bracket') {
        const bSnap = await getDocs(collection(db, 'bracket'));
        bSnap.docs.forEach(d => batch.delete(d.ref));
        INITIAL_BRACKET.forEach(match => {
          batch.set(doc(db, 'bracket', match.id!), match);
        });
      } else if (type === 'registrations') {
        const rSnap = await getDocs(collection(db, 'registrations'));
        rSnap.docs.forEach(d => batch.delete(d.ref));
      } else if (type === 'stats') {
        batch.set(doc(db, 'stats', 'global'), { visitCount: 0 });
      } else if (type === 'table') {
        const mSnap = await getDocs(collection(db, 'matches'));
        mSnap.docs.forEach(d => {
          batch.update(d.ref, {
            homeScore: null,
            awayScore: null,
            status: 'scheduled',
            homeScorers: [],
            awayScorers: [],
            homeStats: null,
            awayStats: null,
            manOfTheMatch: null,
            isDNF: false
          });
        });
        const bSnap = await getDocs(collection(db, 'bracket'));
        bSnap.docs.forEach(d => {
          batch.update(d.ref, {
            homeScore: null,
            awayScore: null,
            status: 'scheduled',
            homeScorers: [],
            awayScorers: [],
            homeStats: null,
            awayStats: null,
            manOfTheMatch: null,
            isDNF: false
          });
        });
      } else if (type === 'all') {
        const mSnap = await getDocs(collection(db, 'matches'));
        mSnap.docs.forEach(d => batch.delete(d.ref));
        
        const bSnap = await getDocs(collection(db, 'bracket'));
        bSnap.docs.forEach(d => batch.delete(d.ref));
        
        const rSnap = await getDocs(collection(db, 'registrations'));
        rSnap.docs.forEach(d => batch.delete(d.ref));
        
        const uSnap = await getDocs(collection(db, 'users'));
        uSnap.docs.forEach(d => {
          if (d.id !== user?.uid) batch.delete(d.ref);
        });
        
        batch.set(doc(db, 'stats', 'global'), { visitCount: 0 });
      }
      
      await batch.commit();

      if (['matches', 'table', 'all'].includes(type)) {
        localStorage.removeItem('cache_matches');
        await refreshCache('matches');
      }

      if (type === 'bracket' || type === 'all') {
        localStorage.removeItem('cache_bracket');
        await new Promise(resolve => setTimeout(resolve, 300));
        await seedBracket();
        await refreshCache('bracket');
      }
      
      if (['registrations', 'all'].includes(type)) {
        localStorage.removeItem('cache_teams');
        await refreshCache('teams');
      }
      
      alert(`${type.charAt(0).toUpperCase() + type.slice(1)} reset successful!`);
    } catch (error) {
      console.error("Reset failed:", error);
      alert(`Reset failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleAdminAiCommand = async (command: string) => {
    try {
      // Send the available teams to the AI so it can properly resolve their IDs
      const teamsContext = teams.map(t => ({ id: t.id, name: t.name, fcName: t.fcName }));

      const response = await fetch(`${VITE_API_URL}/api/admin-ai-command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, teams: teamsContext })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'AI failed to process command.');
      }

      // Process the commands returned by the backend
      const commands = result.commands;
      for (const cmd of commands) {
        if (cmd.type === 'UPDATE_MATCH' || cmd.type === 'ADD_MATCH' || cmd.type === 'CREATE_MATCH') {
          const homeTeam = teams.find(t => 
            t.id === cmd.data.homeTeamId ||
            t.name.toLowerCase() === cmd.data.homeTeamId?.toLowerCase() || 
            t.fcName.toLowerCase() === cmd.data.homeTeamId?.toLowerCase()
          );
          const awayTeam = teams.find(t => 
            t.id === cmd.data.awayTeamId ||
            t.name.toLowerCase() === cmd.data.awayTeamId?.toLowerCase() || 
            t.fcName.toLowerCase() === cmd.data.awayTeamId?.toLowerCase()
          );
          
          cmd.data.homeTeamId = homeTeam?.id || cmd.data.homeTeamId;
          cmd.data.awayTeamId = awayTeam?.id || cmd.data.awayTeamId;

          const matchId = cmd.data.matchId || `m-${Date.now()}`;
          const cleanedData = cleanDocData({
            homeTeamId: cmd.data.homeTeamId,
            awayTeamId: cmd.data.awayTeamId,
            homeScore: cmd.data.homeScore || 0,
            awayScore: cmd.data.awayScore || 0,
            status: cmd.data.status || 'scheduled',
            date: cmd.data.date,
            matchNumber: cmd.data.matchNumber || 1,
            matchday: cmd.data.matchday || 1,
            ...cmd.data,
            id: matchId,
          });
          await setDoc(doc(db, 'matches', matchId), cleanedData, { merge: true });
        } else if (cmd.type === 'RESET') {
          await handleAdminReset(cmd.data.type);
        } else if (cmd.type === 'UPDATE_CONTENT') {
          await updateSiteContent(cmd.data.elementId, cmd.data.text, cmd.data.isImage);
        } else if (cmd.type === 'APPROVE_REGISTRATION') {
          await handleApproveRegistration(cmd.data.registrationId);
        } else if (cmd.type === 'REJECT_REGISTRATION') {
          await handleRejectRegistration(cmd.data.registrationId);
        }
      }

      alert("AI Assistant successfully processed your request.");
    } catch (error) {
      console.error("AI Error:", error);
      alert(`AI Assistant failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };



  const processMatchResultImage = async (file: File, playerRegistration: Registration, motm: string | null = null) => {
    setIsSubmittingImg(true);
    setAiAnalysisResult(null);
    try {
      // 1. Fetch AI credentials securely from our server
      setAiAnalysisResult("Connecting to secure key vault...");
      const token = localStorage.getItem("auth_token");
      const keyResponse = await fetch(`${VITE_API_URL}/api/ai-key`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const keyData = await keyResponse.json();
      if (!keyData.success || !keyData.key) {
        throw new Error(keyData.error || "Failed to retrieve AI credentials. Please sign in again.");
      }

      const groqKey = keyData.key;
      const model = keyData.model || "meta-llama/llama-4-scout-17b-16e-instruct";

      // 2. Read the original uncompressed image as base64 for full accurate quality reading
      setAiAnalysisResult("Processing original screenshot for AI vision...");
      const getOriginalBase64 = (f: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            if (!dataUrl) return reject(new Error('Failed to read file as Data URL'));
            resolve(dataUrl.split(',')[1]);
          };
          reader.onerror = () => reject(new Error('FileReader error'));
          reader.readAsDataURL(f);
        });
      };
      
      const originalBase64 = await getOriginalBase64(file);
      const mimeType = file.type || 'image/jpeg';

      const homeGoalkeeper = teams.find(t => t.fcName === playerRegistration.fcName)?.goalkeeper || "Not specified";
      const awayGoalkeeper = teams.find(t => t.fcName !== playerRegistration.fcName)?.goalkeeper || "Not specified";

      const promptText = `Analyze this FC Mobile match result screenshot. The player reporting this is named "${playerRegistration.fcName}".
              
      CONTEXT:
      - Home Team Goalkeeper: ${homeGoalkeeper}
      - Away Team Goalkeeper: ${awayGoalkeeper}

      INSTRUCTIONS:
      1. USERNAME DETECTION (CRITICAL):
         - Home player username = large bold text TOP LEFT of screen.
         - Away player username = large bold Latin text TOP RIGHT of screen.
         - IGNORE all subtitle text below usernames (team names, league names, Cyrillic text, "NO LEAGUE" etc.).
         - The username is ALWAYS Latin alphabet, never Cyrillic. 
         - Examples: "brokenaqua", "Icebear" — NOT "збірна України 3", "KOLKATA MASTERS", or "NO LEAGUE".
      2. Identify the TWO TEAM NAMES ("team1" for Left, "team2" for Right) using the usernames detected above.
      3. Identify the Final Score in the middle. team1Score is Left, team2Score is Right.
      4. Extract GOAL SCORERS:
         - In FC Mobile Match Summary, the screen has two distinct halves:
           * LEFT HALF contains the Home team's details, including a list of Home goal scorers, accompanied by Goal icons (soccer ball) and minutes (e.g. 18').
           * RIGHT HALF contains the Away team's details, including a list of Away goal scorers, accompanied by Goal icons (soccer ball) and minutes (e.g. 54').
         - Scan both halves of the screen carefully. Player Names under the Left (Home) team belong to "team1". Player Names under the Right (Away) team belong to "team2".
         - DO NOT MIX THEM UP. Left-side scorers are strictly "team1", and Right-side scorers are strictly "team2".
         - FOLLOW THE CRITICAL SCORER ASSIGNMENT RULES BELOW.
      5. Extract Match Stats: Possession, Shots, Shots on Target, Pass Accuracy, Fouls, Offsides, Saves.
         - For "Shots (On Goal)" like "6(6)": 'shots' is 6, 'shotsOnTarget' is 6.
         - Left-side values = "team1Stats".
         - Right-side values = "team2Stats".
      6. MAN OF THE MATCH (MOTM): Look at the player ratings or for a player highlighted with a Star Icon or "MVP". Assign their name to "manOfTheMatch". IF NOT EXPLICITLY SHOWN, just pick the player with the most goals from the winning team (if they scored multiple goals). Otherwise, leave it as null.
      
      CRITICAL SCORER ASSIGNMENT RULES:
      1. Goals listed on the Left-side half of the screenshot are scored by the Left-side player/team (team1).
      2. Goals listed on the Right-side half of the screenshot are scored by the Right-side player/team (team2).
      3. Verify the final score:
         - If team1Score is 3, exactly 3 goals must contain team1 scorers.
         - If team2Score is 2, exactly 2 goals must contain team2 scorers.
      4. If a player is listed on the Left side, their "team" field MUST be "team1". If listed on the Right side, their "team" field MUST be "team2".
      5. The sum of goals for team1 scorers MUST equal team1Score, and the sum of goals for team2 scorers MUST equal team2Score.
      6. Under no circumstances should you assign a left-side scorer to "team2", or a right-side scorer to "team1".
      7. team1 = the LEFT side player (home), team2 = the RIGHT side player (away).
      8. Double check: count team1 scorers = team1Score, count team2 scorers = team2Score.

      CRITICAL RULES:
      - ALWAYS USE STRICTLY "team1" OR "team2" in the "team" field of each scorer.
      - Ensure "team1Score" matches the total number of goals in the "team1" scorers list.
      - One team must match or contain "${playerRegistration.fcName}".
      
      Return JSON in this exact structure, ONLY the raw JSON object, no markdown, no backticks, no explanation.
      CRITICAL: The "scorers" array must have ALL goals assigned.
      { 
        "team1": "string", "team2": "string", 
        "team1Score": number, "team2Score": number, 
        "scorers": [{ "name": "string", "team": "team1"|"team2", "minute": number, "goals": 1 }],
        "team1Stats": { "possession": number, "shots": number, "shotsOnTarget": number, "passAccuracy": number, "fouls": number, "offsides": number, "saves": number },
        "team2Stats": { "possession": number, "shots": number, "shotsOnTarget": number, "passAccuracy": number, "fouls": number, "offsides": number, "saves": number },
        "manOfTheMatch": "string"
      }`;

      // 3. Post to Groq directly - uncompressed full-quality image is used, bypassing Render bandwidth entirely
      setAiAnalysisResult("Analyzing high-quality match image with Groq Vision...");
      const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:${mimeType};base64,${originalBase64}` }
                },
                {
                  type: 'text',
                  text: promptText
                }
              ]
            }
          ]
        })
      });

      if (!groqResponse.ok) {
        const errorText = await groqResponse.text();
        throw new Error(`Groq Vision API returned error: ${groqResponse.status} - ${errorText}`);
      }

      const groqJson = await groqResponse.json();
      const rawText = groqJson.choices?.[0]?.message?.content || '{}';
      const cleanJsonText = rawText.replace(/```json|```/g, "").trim();
      const parsedMatchData = JSON.parse(cleanJsonText);

      // 4. Compress the image for R2 upload & Telegram evidence to minimize server payload and outbound size
      setAiAnalysisResult("Compressing final stored copy for archive records...");
      const compressedBase64 = await compressImage(file);

      // 5. Submit the rich analysis data and lightweight image to the server for persistent record storage and achievements
      setAiAnalysisResult("Submitting results and processing tournament achievements...");
      const response = await fetch(`${VITE_API_URL}/api/analyze-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64: compressedBase64,
          mimeType: 'image/jpeg',
          fcName: playerRegistration.fcName,
          homeGoalkeeper,
          awayGoalkeeper,
          motm,
          preAnalyzedMatchData: parsedMatchData
        })
      });
      
      const resData = await response.json();
      
      if (!resData.success) {
        setAiAnalysisResult(`REJECTED: ${resData.message || 'Failed to analyze'}`);
        return;
      }

      const data = resData.matchData;
      
      const normalize = (nm: string) => (nm || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const userFcName = normalize(playerRegistration.fcName);
      const aiTeam1 = normalize(data.team1);
      const aiTeam2 = normalize(data.team2);

      const isParticipant = aiTeam1.includes(userFcName) || userFcName.includes(aiTeam1) || 
                          aiTeam2.includes(userFcName) || userFcName.includes(aiTeam2);

      if (!isParticipant) {
        setAiAnalysisResult(`REJECTED: User not matched. Your FC Name "${playerRegistration.fcName}" was not clearly detected in the screenshot (AI saw: "${data.team1}" vs "${data.team2}").`);
        return;
      }

      // Achievement processing
      const opponentAiNameRaw = aiTeam1.includes(userFcName) || userFcName.includes(aiTeam1) ? data.team2 : data.team1;
      const opponentAiName = normalize(opponentAiNameRaw);
      
      let opponentReg: Registration | undefined;
      try {
        const opponentSnap = await getDocs(query(collection(db, 'registrations'), where('fcName', '==', opponentAiNameRaw), where('status', '==', 'approved')));
        if (!opponentSnap.empty) {
            opponentReg = opponentSnap.docs[0]?.data() as Registration;
        }
      } catch (e) {
        console.warn("Could not fetch opponent registration:", e);
      }

      // Find user's team
      const userTeam = teams.find(t => t.id === user!.uid || normalize(t.fcName) === userFcName || normalize(t.name) === userFcName);
      if (!userTeam) {
        setAiAnalysisResult(`ERROR: Could not find your team in the active tournament.`);
        return;
      }

      // Find all matches where userTeam is a participant
      const userMatches = matches.filter(m => m.homeTeamId === userTeam.id || m.awayTeamId === userTeam.id);

      // Rank matching matches
      let bestMatch: Match | null = null;
      let bestOpponentTeam: Team | null = null;

      // Define display status logic inside processing to align with UI expectations
      const getDisplayStatus = (m: Match) => {
        if (m.status === 'finished') return 'finished';
        const label = matchLabels[m.date];
        return label || m.status;
      };

      // 1. Intelligent matching: ONLY look for matches that are labeled as ongoing/live
      const ongoingMatches = userMatches.filter(m => {
          const ds = getDisplayStatus(m);
          return ds === 'ongoing' || ds === 'live';
      });
      
      if (ongoingMatches.length > 0) {
          // If multiple ongoing, try to find the one matching the AI opponent name
          if (ongoingMatches.length === 1) {
              bestMatch = ongoingMatches[0];
              const opponentId = bestMatch.homeTeamId === userTeam.id ? bestMatch.awayTeamId : bestMatch.homeTeamId;
              bestOpponentTeam = teams.find(t => t.id === opponentId) || null;
          } else {
              for (const m of ongoingMatches) {
                  const opponentId = m.homeTeamId === userTeam.id ? m.awayTeamId : m.homeTeamId;
                  const oppTeam = teams.find(t => t.id === opponentId);
                  if (!oppTeam) continue;

                  const oppNormName = normalize(oppTeam.name);
                  const oppNormFcName = normalize(oppTeam.fcName);

                  if (oppNormName === opponentAiName || oppNormFcName === opponentAiName ||
                      oppNormName.includes(opponentAiName) || opponentAiName.includes(oppNormName) ||
                      oppNormFcName.includes(opponentAiName) || opponentAiName.includes(oppNormFcName)) {
                      bestMatch = m;
                      bestOpponentTeam = oppTeam;
                      break;
                  }
              }
          }
      }

      if (!bestMatch || !bestOpponentTeam) {
          setAiAnalysisResult(`ERROR: No ONGOING match found for you against "${opponentAiNameRaw}". Only matches marked as "Ongoing" by an admin can be analyzed.`);
          return;
      }

      const team1 = aiTeam1.includes(userFcName) || userFcName.includes(aiTeam1) ? userTeam : bestOpponentTeam;
      const team2 = aiTeam1.includes(userFcName) || userFcName.includes(aiTeam1) ? bestOpponentTeam : userTeam;

      const existingMatch = bestMatch;

      if (existingMatch) {
          // Prevent overwriting finished results unless admin
          if (existingMatch.status === 'finished' && !isAdmin) {
            setAiAnalysisResult("REJECTED: Match finalized. This result is already officially recorded. If there is an error, please contact a tournament administrator.");
            return;
          }

          // 3. Status logic check
          const effectiveStatus = getDisplayStatus(existingMatch);
          if (effectiveStatus !== 'ongoing' && effectiveStatus !== 'live') {
            setAiAnalysisResult(`REJECTED: This match (vs ${bestOpponentTeam.name}) is currently "${effectiveStatus}". AI Analysis can only be performed on "Ongoing" matches. Please wait for an admin to start your match.`);
            return;
          }

          // 4. Winner check
          const winnerTeam = data.team1Score > data.team2Score ? team1 : (data.team1Score < data.team2Score ? team2 : null);
          if (winnerTeam && !isAdmin) {
             const isWinnerReporter = normalize(winnerTeam.fcName) === userFcName || 
                                     normalize(winnerTeam.name) === userFcName ||
                                     normalize(winnerTeam.fullName).includes(userFcName);
             if (!isWinnerReporter) {
                setAiAnalysisResult(`REJECTED: Your are not the match winner. Only the winning team (${winnerTeam.name}) is allowed to upload the final results.`);
                return;
             }
          }

          const matchRef = doc(db, 'matches', existingMatch.id);
          
          const t1Score = Number(data.team1Score ?? data.homeScore ?? 0);
          const t2Score = Number(data.team2Score ?? data.awayScore ?? 0);
          const safeScorers = data.scorers || data.goalScorers || data.goal_scorers || data.goalScorer || [];
          
          const isT1 = (t?: string) => {
            if (!t) return false;
            const normT = normalize(t);
            return normT === 'team1' || normT === normalize(data.team1);
          };
          const isT2 = (t?: string) => {
            if (!t) return false;
            const normT = normalize(t);
            return normT === 'team2' || normT === normalize(data.team2);
          };
          
          const parseScorers = (filterFn: (t?: string) => boolean) => 
            safeScorers
              .filter((s:any) => {
                 let sTeam = s.team;
                 if (!sTeam) {
                    if (t1Score > 0 && t2Score === 0) sTeam = 'team1';
                    else if (t2Score > 0 && t1Score === 0) sTeam = 'team2';
                 }
                 return s && (filterFn(sTeam) || filterFn === undefined);
              })
              .map((s:any) => ({ 
                playerName: s.name || s.playerName || 'Unknown', 
                goals: Number(s.goals) || 1, 
                time: (s.minute !== undefined ? String(s.minute) : s.time) || null 
              }));

          const buildStats = (s: any) => s ? {
              possession: Number(s.possession ?? 50),
              shots: Number(s.shots ?? 0),
              shotsOnTarget: Number(s.shotsOnTarget ?? 0),
              passAccuracy: Number(s.passAccuracy ?? 0),
              fouls: Number(s.fouls ?? 0),
              offsides: Number(s.offsides ?? 0),
              saves: Number(s.saves ?? 0),
          } : null;

          const t1Stats = buildStats(data.team1Stats ?? data.homeStats);
          const t2Stats = buildStats(data.team2Stats ?? data.awayStats);

          const isTeam1ActuallyDbHome = existingMatch.homeTeamId === team1.id;

          let finalMOTM = motm || data.manOfTheMatch;
          if (!finalMOTM) {
             const allPlayers = parseScorers(() => true);
             if (allPlayers.length > 0) {
                 const bestPlayer = [...allPlayers].sort((a,b) => b.goals - a.goals)[0];
                 finalMOTM = bestPlayer.playerName;
             }
          }

          const updatePayload = {
            homeScore: isTeam1ActuallyDbHome ? t1Score : t2Score,
            awayScore: isTeam1ActuallyDbHome ? t2Score : t1Score,
            status: 'finished',
            homeScorers: isTeam1ActuallyDbHome ? parseScorers(isT1) : parseScorers(isT2),
            awayScorers: isTeam1ActuallyDbHome ? parseScorers(isT2) : parseScorers(isT1),
            homeStats: isTeam1ActuallyDbHome ? t1Stats : t2Stats,
            awayStats: isTeam1ActuallyDbHome ? t2Stats : t1Stats,
            manOfTheMatch: finalMOTM || null
          };

          // Deep clean payload to guarantee no undefined values or internal fields throw a Firestore error
          const cleanedPayload = cleanDocData(updatePayload);
          
          // Save the URL as evidence for admins to verify
          cleanedPayload.evidenceImage = resData.evidenceUrl || null;
          if (!cleanedPayload.evidenceImage) {
            console.warn("No evidence URL returned from API, not saving image link.");
          }
          cleanedPayload.evidenceUploadedBy = playerRegistration.fcName;
          cleanedPayload.evidenceTimestamp = serverTimestamp();
          if (motm) {
            cleanedPayload.motm = { fcName: motm, userId: '' };
          }

          const updatedMatch = { ...existingMatch, ...cleanedPayload } as Match;
          setDbMatches(prev => prev.map(m => m.id === existingMatch.id ? updatedMatch : m));
          if (selectedMatch?.id === existingMatch.id) {
            setSelectedMatch(updatedMatch);
          }
          await updateDoc(matchRef, cleanedPayload);
          await refreshCache('matches');

          // Increment MOTM Leaderboard
          if (motm) {
            try {
               const leaderboardRef = doc(db, 'motm_leaderboard', 'global');
               const lbSnap = await getDoc(leaderboardRef);
               if (lbSnap.exists()) {
                  await updateDoc(leaderboardRef, {
                     [`players.${motm}`]: increment(1)
                  });
               } else {
                  await setDoc(leaderboardRef, {
                     players: { [motm]: 1 }
                  });
               }
            } catch(e) {
               console.error("Failed to update MOTM leaderboard: ", e);
            }
          }



          if (cleanedPayload.status === 'finished') {
            const homeT = dbTeams.find(t => t.id === existingMatch.homeTeamId);
            const awayT = dbTeams.find(t => t.id === existingMatch.awayTeamId);
            const enrichedMatchData = {
              ...cleanedPayload,
              homePlayer: homeT?.name || homeT?.fcName,
              awayPlayer: awayT?.name || awayT?.fcName
            };
            fetch(`${VITE_API_URL}/api/generate-news`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                matchData: enrichedMatchData,
                leagueTable: null,
                trigger: 'match-updated'
              })
            }).catch(e => console.error("News trigger failed:", e));
          }

          setAiAnalysisResult("SUCCESS: Match result verified and updated!");
        }

    } catch (error) {
      console.error("Vision AI Error:", error);
      setAiAnalysisResult(`AI failed to analyze the image (${error instanceof Error ? error.message : 'Unknown Error'}). Please try a clearer screenshot or update manually below if you are a participant.`);
    } finally {
      setIsSubmittingImg(false);
    }
  };

  const handleRegister = async (regData: Omit<Registration, 'id' | 'userId' | 'timestamp' | 'status'>) => {
    let currentUser = user;
    if (!currentUser || currentUser.isAnonymous) {
      try {
        setShowLoginModal(true);
        return; // Pause registration to allow login
      } catch (error) {
        console.error("Auth failed:", error);
        return;
      }
    }

    if (!currentUser) return;

    setIsSubmittingRegistration(true);
    try {
      const regId = currentUser.uid;
      await setDoc(doc(db, 'registrations', regId), {
        ...regData,
        id: regId,
        userId: currentUser.uid,
        email: currentUser.email,
        status: 'pending',
        timestamp: serverTimestamp()
      });
      setHasRegistered(true);
    } catch (error) {
      console.error("Registration failed:", error);
    } finally {
      setIsSubmittingRegistration(false);
    }
  };

  const handleCancelMyRegistration = async () => {
    if (!user) return;
    const confirmDelete = window.confirm("Are you absolutely sure you want to delete your registration? This will cancel your tournament application and remove you from the system. You will need to fill in your info to register again.");
    if (!confirmDelete) return;

    setIsSubmittingRegistration(true);
    try {
      const regId = user.uid;
      await deleteDoc(doc(db, 'registrations', regId));
      
      localStorage.removeItem('cache_teams');
      localStorage.removeItem('cache_matches');
      localStorage.removeItem('cache_bracket');

      const qKey = 'registrations';
      localStorage.removeItem(`sb_query_${qKey}`);

      setHasRegistered(false);
      setMyRegistrationData(null);

      await refreshCache('teams');
      alert("Your registration has been successfully deleted. You can now register again by clicking the registration button!");
    } catch (error) {
      console.error("Cancel registration failed:", error);
      alert(`Cancellation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmittingRegistration(false);
    }
  };

  const resolveLinkedScores = (bracketMatch: BracketMatch) => {
    if (bracketMatch.linkedMatchId) {
      const fixtureMatch = dbMatches.find(m => m.id === bracketMatch.linkedMatchId);
      if (fixtureMatch) {
        return {
          ...bracketMatch,
          homeScore: fixtureMatch.homeScore !== undefined ? fixtureMatch.homeScore : bracketMatch.homeScore,
          awayScore: fixtureMatch.awayScore !== undefined ? fixtureMatch.awayScore : bracketMatch.awayScore
        };
      }
    }
    return bracketMatch;
  };

  const getBracketMatch = (id: string) => {
    const bracketMatch = bracket.find(m => m.id === id);
    if (bracketMatch) {
      return resolveLinkedScores(bracketMatch);
    }
    
    return { id, round: '', homeTeamName: 'TBD', awayTeamName: 'TBD', homeScore: 0, awayScore: 0 };
  };

  useEffect(() => {
    let _mounted = true;
    let teamsLoaded = false;
    let matchesLoaded = false;
    let unsubTeams: any = null;
    let unsubMatches: any = null;

    const loadData = async () => {
      // 1. Wake up Supabase with a very small dummy query
      try {
        await getDocs(query(collection(db, 'registrations'), limit(1)));
      } catch (err) {
        console.warn("Wake up query failed, continuing anyway", err);
      }

      if (!_mounted) return;

      const checkLoaded = () => {
        // Small timeout to prevent aggressive flashing and let UI settle
        if (matchesLoaded && _mounted) {
          setTimeout(() => {
            if(_mounted) setIsDataLoading(false);
          }, 0);
        }
      };

      // Teams Sync (Filtered so we use fetchWithCache which handles filtered cache perfectly)
      const loadTeams = async () => {
        try {
          await refreshCache('teams');
        } catch (e) {
          console.error("Teams sync error:", e);
        }
        if (_mounted) {
          teamsLoaded = true;
          checkLoaded();
        }
      };
      loadTeams();
      unsubTeams = setInterval(loadTeams, 30000); // Check every 30s (will only do 100byte meta query)

      // Matches Sync
      unsubMatches = onSnapshot(collection(db, 'matches'), (snapshot) => {
        const matchesData = snapshot.docs.map(docSnap => ({ ...docSnap.data(), id: docSnap.id } as Match));
        if (_mounted) {
          setDbMatches(matchesData);
          matchesLoaded = true;
          checkLoaded();
        }
      }, (error) => {
        console.error("Matches sync error:", error);
        if (_mounted) { matchesLoaded = true; checkLoaded(); }
      });
    };

    loadData();

    return () => {
      _mounted = false;
      if (unsubTeams) clearInterval(unsubTeams);
      if (unsubMatches) unsubMatches();
    };
  }, []);

    useEffect(() => {
      const statsRef = doc(db, 'stats', 'global');
      
      const incrementVisitCount = async () => {
        try {
          if (!sessionStorage.getItem('hasVisitedTourney')) {
            await setDoc(statsRef, { visitCount: increment(1) }, { merge: true });
            sessionStorage.setItem('hasVisitedTourney', 'true');
          }
        } catch (error) {
          console.error("Error incrementing visit count:", error);
        }
      };

      incrementVisitCount();

      // Real-time sync for visit count
      const unsubscribe = onSnapshot(statsRef, (docSnap) => {
        if (docSnap.exists()) {
          setVisitCount(docSnap.data().visitCount || 0);
        }
      });

      return () => unsubscribe();
    }, []);

  useEffect(() => {
    const unsubBracket = onSnapshot(collection(db, 'bracket'), (snapshot) => {
      const bracketDataMap: Record<string, BracketMatch> = {};
      INITIAL_BRACKET.forEach(m => bracketDataMap[m.id!] = { ...m });
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        bracketDataMap[docSnap.id] = { ...data, id: docSnap.id } as BracketMatch;
      });
      setBracket(INITIAL_BRACKET.map(m => bracketDataMap[m.id!]));
    }, (error) => {
      console.error("Bracket sync error:", error);
    });

    return () => unsubBracket();
  }, []);

  useEffect(() => {
    const unsubGuesses = onSnapshot(collection(db, 'statsGuesses'), (snapshot) => {
      const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as StatGuess));
      setDbStatsGuesses(list);
    }, (error) => {
      console.error("Error syncing statsGuesses:", error);
    });
    return () => unsubGuesses();
  }, []);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'config', 'system'));
        console.log("Firebase Connection: OK");
      } catch (error) {
        console.error("Firebase Connection Error:", error);
      }
    };
    // Only run testConnection outside cache
    // testConnection(); 
    // removing testConnection explicitly querying server to save reads
  }, [isAdmin, user]);

  useEffect(() => {
    if (isAdmin) seedBracket();
  }, [isAdmin]);

  useEffect(() => {
    let _mounted = true;
    // Config Sync
    const unsubConfig = onSnapshot(doc(db, 'config', 'system'), (docSnap) => {
      if (docSnap.exists() && _mounted) {
        setConfig(docSnap.data() as Config);
      }
    });

    // Qualification Status Sync
    const unsubQual = onSnapshot(doc(db, 'config', 'qualification'), (docSnap) => {
      if (docSnap.exists() && docSnap.data()?.statuses && _mounted) {
        setQualificationStatus(docSnap.data().statuses);
      }
    });

    let unsubscribeRegs: any;
    if (isAdmin || isDrawAdmin) {
      // For Admin, we can afford onSnapshot to manage registrations comfortably,
      // but to save quota we can use getDocs polling. Since admin is a single user, onSnapshot is fine.
      const q = query(collection(db, 'registrations'));
      unsubscribeRegs = onSnapshot(q, (snapshot) => {
        const regs: Registration[] = [];
        snapshot.forEach((doc) => {
          regs.push({ ...doc.data(), id: doc.id } as Registration);
        });
        if (_mounted) setRegistrations(regs);
      });
    }

    return () => {
      _mounted = false;
      unsubConfig();
      unsubQual();
      if (unsubscribeRegs) unsubscribeRegs();
    };
  }, [isAdmin, isDrawAdmin]);

  useEffect(() => {
    // Check if user has already registered
    if (user) {
      const unsubscribe = onSnapshot(doc(db, 'registrations', user.uid), (doc) => {
        if (doc.exists()) {
          setHasRegistered(true);
          setMyRegistrationData({ ...doc.data(), id: doc.id } as Registration);
        } else {
          setHasRegistered(false);
          setMyRegistrationData(null);
        }
      });
      
      const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          setUserProfile(docSnap.data() as UserProfile);
        }
      });

      return () => {
        unsubscribe();
        unsubscribeProfile();
      };
    } else {
      setHasRegistered(false);
      setUserProfile(null);
    }
  }, [user]);

  // End of registrations sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u && !u.isAnonymous) {
        // Ensure user profile document exists
        const userRef = doc(db, 'users', u.uid);
        try {
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            await setDoc(userRef, {
              uid: u.uid,
              email: u.email,
              role: 'user',
              achievements: {}
            });
          }
        } catch (e) {
          console.warn("Failed to ensure user profile:", e);
        }
      }
      if (!u) {
        // user logged out
      }
    });

    // Initialize a persistent voter ID in this browser
    if (!localStorage.getItem('voter_id')) {
      localStorage.setItem('voter_id', uuidv4());
    }

    return () => unsubscribe();
  }, []);

  // Voting listeners removed

  const copyToClipboard = (uid: string) => {
    if (!uid) return;
    try {
      // Fallback for better compatibility in iframes
      const textArea = document.createElement("textarea");
      textArea.value = uid;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      
      // Modern API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(uid).catch(() => {});
      }
      
      setCopiedId(uid);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  const matchesByDay = useMemo(() => {
    const grouped: Record<string, Match[]> = {};
    const filtered = searchTerm 
      ? matches.filter(m => {
          const home = teams.find(t => t.id === m.homeTeamId);
          const away = teams.find(t => t.id === m.awayTeamId);
          const search = searchTerm.toLowerCase();
          return home?.name.toLowerCase().includes(search) || 
                 home?.fullName.toLowerCase().includes(search) ||
                 home?.fcName.toLowerCase().includes(search) ||
                 away?.name.toLowerCase().includes(search) ||
                 away?.fullName.toLowerCase().includes(search) ||
                 away?.fcName.toLowerCase().includes(search);
        })
      : matches;

    filtered.forEach(m => {
      const dateKey = m.date || 'TBD';
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(m);
    });
    
    // Sort matches within each day by matchNumber
    Object.keys(grouped).forEach(day => {
      grouped[day].sort((a, b) => a.matchNumber - b.matchNumber);
    });

    // Helper to get IST date string
    const getISTDate = () => {
      const d = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(d.getTime() + istOffset);
      const day = istDate.getUTCDate();
      const month = istDate.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
      const year = istDate.getUTCFullYear();
      
      const daySuffix = (n: number) => {
        if (n > 3 && n < 21) return 'th';
        switch (n % 10) {
          case 1:  return "st";
          case 2:  return "nd";
          case 3:  return "rd";
          default: return "th";
        }
      };
      
      return `${day}${daySuffix(day)} ${month} ${year}`;
    };

    const todayIST = getISTDate();
    
    const sortedDays = Object.keys(grouped).sort((a, b) => {
       const timeA = parseTourneyDate(a).getTime();
       const timeB = parseTourneyDate(b).getTime();
       
       if (isNaN(timeA) || isNaN(timeB)) {
         return a.localeCompare(b);
       }
       return timeA - timeB;
    });

    const finalGrouped: Record<string, Match[]> = {};
    sortedDays.forEach(day => {
      finalGrouped[day] = grouped[day];
    });
    
    return finalGrouped;
  }, [matches, searchTerm, teams]);

  const firstUpcomingDay = useMemo(() => {
    const parseDate = (dStr: string) => {
      if (!dStr || dStr === 'TBD') return new Date(0);
      const cleanStr = dStr.replace(/(\d+)(st|nd|rd|th)/, '$1');
      return new Date(cleanStr);
    };

    const days = Object.keys(matchesByDay).sort((a, b) => {
      const timeA = parseDate(a).getTime();
      const timeB = parseDate(b).getTime();
      return timeA - timeB;
    });
    return days.find(day => matchesByDay[day].some(m => m.status !== 'finished'));
  }, [matchesByDay]);

  const bracketMatches: BracketMatch[] = [];

  return (
    <>
      <div className="min-h-screen bg-fc-purple-dark text-white font-sans selection:bg-fc-neon-green/30 relative overflow-hidden">
      {hasQuotaError && (
        <div className="bg-red-500/20 border-b border-red-500/50 p-4 text-center z-50 relative backdrop-blur-sm">
          <p className="text-red-200 font-bold max-w-4xl mx-auto">
            <span className="tracking-normal text-xs block mb-1">Database Error / Quota Exceeded</span>
            Firestore daily read limit has been reached, or the connection is offline. Latest data will not load properly unless cached. Quota resets at 12:00 AM PT.
          </p>
        </div>
      )}
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-transparent to-transparent" />
      </div>

      {/* Header */}
      <header className="relative w-full bg-gradient-to-br from-[#050505] to-[#111] py-16 md:py-24 md:rounded-b-3xl border-b border-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.5)] mb-8 overflow-hidden">
        {/* Soft Modern BG glow elements instead of emojis */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDIiPjwvcmVjdD4KPHBhdGggZD0iTTAgMEw4IDhaTThgMGwtOCA4IiBzdHJva2U9IiMzMzMiIHN0cm9rZS13aWR0aD0iMSIgb3BhY2l0eT0iMC4yIj48L3BhdGg+Cjwvc3ZnPg==')] opacity-30 mask-image-[radial-gradient(ellipse_at_center,black_10%,transparent_70%)] pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#3B82F6] blur-[150px] opacity-[0.10] pointer-events-none rounded-full transform translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-[#10B981] blur-[120px] opacity-[0.08] rounded-full pointer-events-none z-0"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-left w-full relative max-w-3xl"
          >
            <div className="highlighter-yellow mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-black/60 animate-pulse shrink-0 mr-1.5" />
              <span className="text-[10px] font-sans font-black tracking-widest uppercase truncate">
                <EditableText id="hero_status" defaultText="GLOBAL LEAGUE ACTIVE" />
              </span>
            </div>
            
            <h1 className="font-display text-5xl sm:text-6xl md:text-8xl font-black text-white leading-[1.05] tracking-tight mb-6 drop-shadow-sm flex items-center flex-wrap">
              <EditableText id="hero_title_main" defaultText="UXI: World's Game" />
              <RotatingFlag />
            </h1>
            
            <p className="text-white/50 font-sans text-sm md:text-base lg:text-lg max-w-xl leading-relaxed">
              <EditableText id="hero_desc" defaultText="The ultimate competitive e-sports football tournament. Track fixtures, live leaderboards, and detailed player statistics in real-time." />
            </p>
          </motion.div>

          {/* Top Right Auth */}
          <div className="absolute top-0 right-4 md:relative md:-top-4 z-[100] flex items-center justify-end w-full md:w-auto">
            {user && !user.isAnonymous ? (
              <div className="flex items-center gap-2 p-1.5 bg-white/[0.03] border border-white/5 rounded-2xl backdrop-blur-xl shadow-lg">
                <div className="hidden sm:block text-right px-3 py-1">
                  <p className="text-[10px] text-white/50 tracking-widest uppercase leading-none font-sans font-bold mb-0.5">Session Active</p>
                  <p className="text-xs font-bold text-white truncate max-w-[120px] font-sans">{user.displayName || user.email}</p>
                </div>
                {(isAdmin || isDrawAdmin) && (
                  <button
                    onClick={() => setIsAdminModalOpen(true)}
                    className="px-3 py-2 bg-white/10 hover:bg-[#3B82F6] text-white font-sans font-bold text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 border border-white/5 shadow-sm"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="hidden sm:inline">Admin</span>
                  </button>
                )}
                <button 
                  onClick={() => logout()}
                  className="p-2.5 bg-white/[0.05] hover:bg-[#EF4444] text-white/80 hover:text-white rounded-xl transition-colors border border-transparent hover:border-white/20 shadow-sm ml-1"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowLoginModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.05] hover:bg-[#3B82F6] border border-white/10 text-white font-sans font-bold rounded-2xl transition-all text-xs tracking-widest shadow-lg hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 uppercase"
              >
                <LogIn className="w-4 h-4" />
                Player Login
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 py-4 mb-4 md:mb-8 pointer-events-none">
        <div className="max-w-7xl mx-auto px-4 overflow-visible flex justify-center">
          <div className="flex flex-wrap justify-center items-center gap-2 md:gap-3 pointer-events-auto w-full md:w-auto overflow-x-auto hide-scrollbar pb-4 md:pb-0">
            {[
              { id: 'fixtures', label: 'Fixtures', icon: Calendar },
              { id: 'stats', label: 'Stats', icon: BarChart2 },
              { id: 'table', label: 'Table', icon: TableIcon },
              { id: 'bracket', label: 'Bracket', icon: GitBranch },
              { id: 'news', label: 'News', icon: Sparkles },
              { id: 'registration', label: 'Registration', icon: Layout },
              { id: 'campaign', label: 'My Campaign', icon: UserIcon },
            ].filter(tab => {
              if (tab.id === 'registration') return config.registrationEnabled;
              if (tab.id === 'campaign') return !!user;

              // Check custom visibility
              const isVisible = config.tabVisibility?.[tab.id] ?? true;
              return isVisible;
            }).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`group relative px-4 py-2.5 md:px-6 md:py-3 flex items-center justify-center gap-2 transition-all duration-300 rounded-2xl text-xs md:text-sm font-sans font-bold whitespace-nowrap overflow-hidden border ${
                  activeTab === tab.id 
                    ? 'text-[#3B82F6] border-[#3B82F6]/50 bg-[#3B82F6]/10 shadow-[0_4px_20px_rgba(59,130,246,0.2)]' 
                    : 'text-white/60 border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:text-white hover:border-white/20 hover:shadow-[0_4px_20px_rgba(255,255,255,0.05)]'
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTabGlow"
                    className="absolute inset-0 bg-gradient-to-tr from-[#3B82F6]/20 to-transparent z-0 blur-md"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                
                <div className={`relative flex items-center justify-center w-6 h-6 rounded-lg transition-transform duration-300 ${
                  activeTab === tab.id ? 'bg-[#3B82F6] text-white scale-110 shadow-lg' : 'bg-white/10 text-white/60 group-hover:bg-white/20'
                }`}>
                  <tab.icon className="w-3.5 h-3.5 relative z-20" />
                </div>
                <span className="relative z-20 tracking-wide">
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-12">
        <AnimatePresence mode="wait">
          {activeTab === 'campaign' && (
            <motion.div
              key="campaign"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-3 bg-fc-purple-light/30 rounded-2xl border border-fc-neon-green/50/30 shrink-0">
                    <UserIcon className="w-6 h-6 text-fc-neon-green" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <EditableText id="campaign_header" defaultText="My Campaign" as="h2" className="font-display text-2xl font-bold  tracking-tight leading-none truncate" />
                    <p className="text-fc-neon-green/40 text-xs tracking-normal mt-1 truncate">
                      <EditableText id="campaign_sub" defaultText="Player Portal & Performance" />
                    </p>
                  </div>
                </div>
                <div className="flex flex-row md:flex-row items-center gap-2 w-full md:w-auto">
                  <button 
                    onClick={() => setIsEditingProfile(true)}
                    className="flex justify-center items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group shrink-0 h-full"
                  >
                    <Edit3 className="w-4 h-4 text-fc-neon-green group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold tracking-normal text-white hidden md:inline">Edit</span>
                  </button>
                  <div className="flex items-center gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl md:ml-auto overflow-x-auto hide-scrollbar w-full">
                    <button 
                      onClick={() => setCampaignTab('stats')}
                      className={`px-4 py-2 rounded-2xl text-[9px] font-bold tracking-normal transition-all whitespace-nowrap min-w-fit ${campaignTab === 'stats' ? 'bg-fc-neon-green text-black text-black shadow-lg shadow-fc-neon-green/40' : 'text-white/40 hover:text-white/60'}`}
                    >
                      Stats
                    </button>
                    <button 
                      onClick={() => setCampaignTab('history')}
                      className={`px-4 py-2 rounded-2xl text-[9px] font-bold tracking-normal transition-all whitespace-nowrap min-w-fit ${campaignTab === 'history' ? 'bg-fc-neon-green text-black text-black shadow-lg shadow-fc-neon-green/40' : 'text-white/40 hover:text-white/60'}`}
                    >
                      Results
                    </button>

                    <button 
                      onClick={() => setCampaignTab('edit')}
                      className={`px-4 py-2 rounded-2xl text-[9px] font-bold tracking-normal transition-all whitespace-nowrap min-w-fit ${campaignTab === 'edit' ? 'bg-fc-neon-green text-black text-black shadow-lg shadow-fc-neon-green/40' : 'text-white/40 hover:text-white/60'}`}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>

              {!user ? (
                <div className="p-12 text-center bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-white/40 mb-6">Please login to access your campaign portal.</p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button onClick={() => setShowLoginModal(true)} className="px-8 py-4 bg-fc-neon-green text-black rounded-2xl font-bold tracking-normal text-xs hover:brightness-110 active:scale-95 transition-all shrink-0">Login Now</button>
                    {lastLoginDetails && (
                      <button 
                        onClick={handleQuickLogin}
                        className="px-8 py-4 bg-white/10 border border-white/15 text-white rounded-2xl font-bold tracking-normal text-xs hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        Log back in as <span className="text-[#3B82F6]">{lastLoginDetails.displayName}</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                (() => {
                  const myRegistration = myRegistrationData;
                  if (isDataLoading) {
                    return (
                      <div className="py-24 text-center bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-6">
                        <Loader2 className="w-12 h-12 text-fc-neon-green animate-spin" />
                        <p className="text-white/40 text-xs tracking-[0.3em] font-bold animate-pulse">Loading Campaign Data...</p>
                      </div>
                    );
                  }
                  if (!myRegistration) {
                     return (
                        <div className="p-12 text-center bg-white/5 rounded-2xl border border-white/10">
                          <p className="text-white/40 mb-6 font-bold">You are not registered for the tournament.</p>
                          <button onClick={() => setActiveTab('registration')} className="px-8 py-4 bg-fc-neon-green text-black rounded-2xl font-bold tracking-normal text-xs hover:bg-fc-purple-light transition-all">Register Now</button>
                        </div>
                     );
                  }

                  if (myRegistration.status === 'pending') {
                    return (
                      <div className="p-12 text-center bg-yellow-500/5 rounded-2xl border border-yellow-500/20">
                        <Loader2 className="w-12 h-12 text-yellow-500/40 mx-auto mb-6 animate-spin" />
                        <h3 className="text-xl font-display font-bold text-yellow-500 ">Waiting for Verification</h3>
                        <p className="text-white/40 text-sm mt-2">Admin is currently reviewing your registration details.</p>
                      </div>
                    );
                  }

                  if (myRegistration.status === 'rejected') {
                    return (
                      <div className="p-12 text-center bg-red-500/5 rounded-2xl border border-red-500/20">
                        <X className="w-12 h-12 text-red-500/40 mx-auto mb-6" />
                        <h3 className="text-xl font-display font-bold text-red-500 ">Registration Rejected</h3>
                        <p className="text-white/40 text-sm mt-2">Your application was not approved for this tournament.</p>
                      </div>
                    );
                  }

                  // Approved Campaign
                  const myTeam = teams.find(t => t.id === myRegistration.id);
                  const myMatches = matches.filter(m => m.homeTeamId === myRegistration.id || m.awayTeamId === myRegistration.id)
                    .sort((a, b) => b.matchNumber - a.matchNumber);
                  
                  if (myMatches.length === 0) {
                    return (
                      <div className="p-12 text-center bg-fc-neon-green/5 rounded-2xl border border-fc-neon-green/30">
                        <Calendar className="w-12 h-12 text-fc-neon-green/40 mx-auto mb-6" />
                        <h3 className="text-xl font-display font-bold text-fc-neon-green ">Waiting for Fixture Update</h3>
                        <p className="text-white/40 text-sm mt-2">You are registered and approved! Matches will appear here once the schedule is released.</p>
                      </div>
                    );
                  }

                  const myStats = calculateStats(teams, matches).filter(s => s.gamerName === myRegistration.fcName);

                  return (
                    <div className="space-y-8">
                      {campaignTab === 'edit' ? (
                         <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 text-center">
                            <Shield className="w-16 h-16 text-fc-neon-green/20 mx-auto mb-6" />
                            <h3 className="text-xl font-display font-bold text-white ">Security Shield Active</h3>
                            <p className="text-white/40 text-sm max-w-sm mx-auto mt-2">Use the "Edit Info" button in the header to modify your tournament registration details.</p>
                            <button 
                              onClick={() => setIsEditingProfile(true)}
                              className="mt-8 px-8 py-4 bg-fc-neon-green text-black rounded-2xl font-bold text-xs tracking-normal text-black hover:bg-fc-purple-light transition-all shadow-xl shadow-fc-neon-green/20"
                            >
                              Launch Editor
                            </button>
                         </div>
                      ) : campaignTab === 'history' ? (
                        <div className="space-y-6">
                           <h3 className="text-lg font-display font-bold  text-white px-4">All Match Results</h3>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             {myMatches.filter(m => m.status !== 'scheduled' && m.status !== 'rescheduled').map(m => (
                               <MatchCard key={m.id} match={m} teams={teams} onClick={() => setSelectedMatch(m)} />
                             ))}
                           </div>
                           {myMatches.filter(m => m.status !== 'scheduled' && m.status !== 'rescheduled').length === 0 && (
                               <div className="p-8 text-center text-white/40 bg-white/5 rounded-2xl border border-white/10 mt-4">
                                  No previous results yet.
                               </div>
                           )}
                        </div>
                      ) : (
                        <div className="max-w-4xl mx-auto space-y-8">
                          {/* Performance Snapshot */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] text-center">
                              <p className="text-[10px] font-bold text-fc-neon-green tracking-normal mb-1">
                                <EditableText id="stats_status_label" defaultText="Status" />
                              </p>
                              <p className="text-xl font-display font-bold  text-white">{myRegistration.status}</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] text-center">
                              <p className="text-[10px] font-bold text-fc-neon-green tracking-normal mb-1">OVR</p>
                              <p className="text-xl font-display font-bold  text-yellow-500">{myRegistration.teamOvr}</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] text-center">
                              <p className="text-[10px] font-bold text-fc-neon-green tracking-normal mb-1">Goals</p>
                              <p className="text-xl font-display font-bold  text-white">{myStats.reduce((acc, s) => acc + s.goals, 0)}</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] text-center">
                              <p className="text-[10px] font-bold text-fc-neon-green tracking-normal mb-1">Played</p>
                              <p className="text-xl font-display font-bold  text-white">{myMatches.filter(m => m.status === 'finished').length}</p>
                            </div>
                          </div>

                          {/* Goal Scorers */}
                          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8">
                            <h3 className="text-lg font-display font-bold  text-white mb-6">Top Scorers</h3>
                            <div className="space-y-4">
                              {myStats.length === 0 ? (
                                <p className="text-[#555555] text-center py-4 text-xs font-sans font-bold tracking-normal">No goals recorded yet</p>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {myStats.map((s, i) => (
                                    <div key={`${s.playerName}-${i}`} className="p-4 bg-white/[0.03] border-t-2 border-[#3B82F6] border border-x-[#1E1E1E] border-b-[#1E1E1E]">
                                      <div className="flex flex-col mb-4">
                                        <span className="font-display font-extrabold text-white text-2xl">{s.playerName}</span>
                                        <div className="text-[#3B82F6] font-sans text-[10px] small-caps font-bold tracking-[0.1em] mt-0.5">FORWARD</div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-3 mt-auto">
                                        <div className="flex flex-col">
                                          <span className="text-[#555555] font-sans text-[10px] font-bold tracking-normal">GOALS</span>
                                          <span className="font-display font-extrabold text-white text-3xl">{s.goals}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Result Submission AI */}
                          <div className="bg-fc-neon-green/5 border border-fc-neon-green/30 rounded-[2rem] p-8 relative">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-fc-purple-light/20 blur-[60px] pointer-events-none" />
                            <EditableText id="ai_update_title" defaultText="Automated Result update" as="h3" className="text-lg font-display font-bold  text-fc-neon-green mb-2" />
                            <p className="text-white/40 text-[10px] tracking-normal mb-6">
                              <EditableText id="ai_verify_sub" defaultText="AI-Powered Verification" />
                            </p>
                            
                            <div className="space-y-6">
                              {(() => {
                                const myOngoingMatches = matches.filter(m => {
                                  if (m.homeTeamId !== myRegistration?.id && m.awayTeamId !== myRegistration?.id) return false;
                                  if (m.status === 'finished') return false;
                                  const label = matchLabels[m.date];
                                  const effectiveStatus = label || m.status;
                                  return effectiveStatus === 'ongoing' || effectiveStatus === 'live';
                                });

                                if (myOngoingMatches.length === 0) {
                                  return (
                                    <div className="p-6 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center gap-3 text-center">
                                      <div className="w-10 h-10 bg-fc-purple-light/20 rounded-2xl flex items-center justify-center">
                                        <AlertCircle className="w-5 h-5 text-fc-neon-green/60" />
                                      </div>
                                      <p className="text-[10px] font-bold tracking-[0.15em] text-white/40">
                                        No Ongoing Matches Found<br/>
                                        <span className="text-fc-neon-green/60 lowercase font-bold tracking-normal  mt-1 block">Analysis is only enabled when your match is marked as "Ongoing" by an admin</span>
                                      </p>
                                    </div>
                                  );
                                }

                                return (
                                  <div className="flex flex-col md:flex-row gap-4 w-full relative z-20">
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/10 rounded-2xl hover:border-fc-neon-green/50/50 transition-all group cursor-pointer relative">
                                      <input 
                                        type="file" 
                                        accept="image/*"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            if (!myRegistration) {
                                              alert("Please register a team first to submit match results.");
                                              return;
                                            }
                                            if (!motmInput.trim()) {
                                              alert("Please enter/select the Man of the Match (Required) before uploading!");
                                              e.target.value = '';
                                              return;
                                            }
                                            processMatchResultImage(file, myRegistration, motmInput.trim());
                                          }
                                        }}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                      />
                                      <Plus className="w-8 h-8 text-fc-neon-green/40 mb-3 group-hover:text-fc-neon-green transition-colors" />
                                      <span className="text-[10px] font-bold text-white/40 tracking-normal text-center">Upload FC Result<br/>(Max 2MB)</span>
                                    </div>
                                    <div className="flex-1 flex flex-col justify-center p-4 border border-white/10 rounded-2xl bg-white/5 relative z-30">
                                        <label className="text-[10px] font-bold tracking-normal text-white/40 mb-2 block text-center uppercase tracking-wider">
                                          Man of the Match <span className="text-red-500 font-extrabold">*Required*</span>
                                        </label>
                                        <div className="relative w-full max-w-xs mx-auto z-40">
                                          <input 
                                            type="text" 
                                            placeholder="Type or select name..." 
                                            value={motmInput}
                                            onChange={(e) => {
                                              setMotmInput(e.target.value);
                                              setShowMotmSuggestions(true);
                                            }}
                                            onFocus={() => setShowMotmSuggestions(true)}
                                            onBlur={() => {
                                              // Close suggestions after a small delay to handle click selections safely
                                              setTimeout(() => setShowMotmSuggestions(false), 200);
                                            }}
                                            className="w-full bg-black/20 border border-white/10 rounded-2xl p-3 text-white focus:border-fc-neon-green/50 outline-none text-sm text-center font-bold"
                                          />
                                          {showMotmSuggestions && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-fc-purple-dark border border-white/20 rounded-2xl shadow-xl z-50 max-h-40 overflow-y-auto hide-scrollbar">
                                              {motmSuggestions
                                                .filter(item => !motmInput || item.toLowerCase().includes(motmInput.toLowerCase()))
                                                .map(item => (
                                                  <button 
                                                    key={item}
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                      // Prevent immediate input blur which blocks selection
                                                      e.preventDefault();
                                                      setMotmInput(item);
                                                      setShowMotmSuggestions(false);
                                                    }}
                                                    onClick={() => { 
                                                      setMotmInput(item); 
                                                      setShowMotmSuggestions(false); 
                                                    }}
                                                    className="w-full text-center p-3 hover:bg-white/10 text-sm font-bold text-white border-b border-white/5 last:border-0 relative z-50 cursor-pointer"
                                                  >
                                                    {item}
                                                  </button>
                                                ))
                                              }
                                              {motmInput && !motmSuggestions.some(item => item.toLowerCase() === motmInput.toLowerCase()) && (
                                                <div className="w-full text-center p-3 text-xs text-white/45 italic relative z-50">
                                                  Using custom name: "{motmInput}"
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                    </div>
                                  </div>
                                );
                              })()}

                              {isSubmittingImg && (
                                 <div className="flex items-center justify-center gap-3 text-fc-neon-green">
                                   <Loader2 className="w-4 h-4 animate-spin" />
                                   <span className="text-[10px] font-bold tracking-normal">AI Analyzing Photo...</span>
                                 </div>
                              )}

                              {aiAnalysisResult && (
                                <div className={`p-4 rounded-2xl text-[10px] font-bold tracking-normal ${
                                  aiAnalysisResult.startsWith('SUCCESS') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                }`}>
                                  {aiAnalysisResult}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Upcoming Matches */}
                          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8">
                            <h3 className="text-lg font-display font-bold  text-white mb-6">Upcoming Fixtures</h3>
                            <div className="space-y-4">
                               {myMatches.filter(m => (m.status === 'scheduled' || m.status === 'rescheduled') && !(config.hiddenDates || []).includes(m.date || '')).length === 0 ? (
                                  <div className="p-8 text-center bg-white/5 rounded-[2rem] border border-white/10">
                                     <Calendar className="w-12 h-12 text-white/20 mx-auto mb-4" />
                                     <p className="text-white/40">No upcoming matches at the moment.</p>
                                  </div>
                               ) : (
                                 myMatches.filter(m => (m.status === 'scheduled' || m.status === 'rescheduled') && !(config.hiddenDates || []).includes(m.date || '')).sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0)).slice(0, 15).map(m => {
                                   const isHome = m.homeTeamId === myRegistration.id;
                                   const opponentId = isHome ? m.awayTeamId : m.homeTeamId;
                                   const opponent = teams.find(t => t.id === opponentId);
                                   return (
                                     <div key={m.id} className="group relative bg-white/5 border border-white/10 p-4 md:p-6 rounded-[2rem] flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:bg-white/10 overflow-hidden">
                                       {/* Background glow based on Home/Away */}
                                       <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none ${isHome ? 'bg-fc-neon-green text-black' : 'bg-orange-500'}`}></div>
                                       
                                       <div className="flex items-center gap-4 relative z-10 w-full">
                                         <div className={`w-14 items-center justify-center flex py-2 rounded-2xl text-[10px] font-bold tracking-normal ${isHome ? 'bg-fc-purple-light/30 text-fc-neon-green border border-fc-neon-green/50/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>
                                           {isHome ? 'Home' : 'Away'}
                                         </div>
                                        <div className="flex-1">
                                          <p className="text-lg md:text-xl font-display font-bold  text-white mt-1 mb-1 line-clamp-1">vs {opponent?.name || 'TBD'}</p>
                                          <div className="flex items-center gap-3 text-white/40 text-xs font-bold tracking-normal">
                                            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                                              <EditableMatchBadge match={m} isAdmin={isAdmin} textClassName="text-fc-neon-green font-bold" />
                                              <div className="w-[1px] h-3 bg-white/10 mx-1" />
                                              <Calendar className="w-3.5 h-3.5 text-fc-neon-green" />
                                              <span className="text-fc-neon-green">{m.date || 'TBD'}</span>
                                            </div>
                                          </div>
                                         </div>
                                       </div>
                                       <div className="relative z-10 md:w-auto w-full">
                                          <button 
                                            onClick={() => setSelectedMatch(m)} 
                                            className="w-full md:w-auto px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-white text-xs font-bold tracking-normal transition-colors whitespace-nowrap"
                                          >
                                            View Details
                                          </button>
                                       </div>
                                     </div>
                                   );
                                 })
                               )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </motion.div>
          )}

          {activeTab === 'news' && (
            <motion.div
              key="news"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <NewsFeed articles={newsFeed} isAdmin={isAdmin} isEditingMode={isEditingMode} onDelete={handleDeleteNews} />
            </motion.div>
          )}

          {activeTab === 'stats' && renderStatsTab()}
          {false && null}
          {activeTab === 'table' && (
            <motion.div
              key="table"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full"
            >
              {config.groupType === 'many' ? (
                <div className="space-y-12">
                  {sortedGroupKeys.length === 0 && (
                     <div className="p-12 text-center bg-white/5 border border-white/10 rounded-2xl">
                       <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
                       <p className="text-white/60 font-sans font-bold">Groups have not been distributed yet.</p>
                       {isAdmin && (
                         <p className="text-fc-neon-green/80 font-sans text-xs font-bold mt-2">Go to Admin panel &rarr; Global Config to randomly distribute players into groups!</p>
                       )}
                     </div>
                  )}

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {sortedGroupKeys.map((groupKey) => {
                      const groupTeams = groupedStandings?.[groupKey] || [];
                      return (
                        <div key={groupKey} className="overflow-x-auto rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 md:p-6 shadow-xl relative group">
                          <div className="absolute inset-0 bg-gradient-to-br from-fc-neon-green/0 via-transparent to-white/0 group-hover:from-fc-neon-green/5 group-hover:to-white/5 transition-all duration-300 pointer-events-none rounded-2xl" />
                          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
                            <h3 className="text-lg md:text-xl font-display font-black text-white flex items-center gap-2 tracking-tight">
                              {groupKey === 'Unassigned' ? 'Unassigned Standings' : (config.groupNames?.[groupKey] || `Group ${groupKey}`)}
                            </h3>
                            <div className="highlighter-green">
                              <span className="w-1.5 h-1.5 rounded-full bg-black/60 animate-pulse shrink-0 mr-1.5" />
                              <span className="text-[9.5px] font-sans font-black tracking-wider uppercase">
                                {config.groupLabels?.[groupKey] || 'Top 2 Qualify'}
                              </span>
                            </div>
                          </div>

                          <table className="w-full text-left border-separate border-spacing-y-2">
                            <thead>
                              <tr className="text-[#3B82F6] text-[10px] md:text-xs tracking-[0.1em] font-sans font-bold opacity-85">
                                <th className="px-2 md:px-3 py-2 text-center w-8">Pos</th>
                                <th className="px-2 md:px-4 py-2">Player</th>
                                <th className="px-2 md:px-3 py-2 text-center w-12">OVR</th>
                                <th className="px-2 py-2 text-center w-8">P</th>
                                <th className="px-1.5 py-2 text-center w-8 text-emerald-400">W</th>
                                <th className="px-1.5 py-2 text-center w-8 text-white/50">D</th>
                                <th className="px-1.5 py-2 text-center w-8 text-red-400">L</th>
                                <th className="px-2 py-2 text-center w-10">GF</th>
                                <th className="px-2 py-2 text-center w-10">GA</th>
                                <th className="px-2 py-2 text-center w-10">GD</th>
                                <th className="px-2 md:px-3 py-2 text-center w-10">Pts</th>
                                <th className="px-2 py-2 text-center w-24">Form</th>
                              </tr>
                            </thead>
                            <tbody>
                              {groupTeams.map((team, gIndex) => {
                                const isQualified = gIndex < 2;
                                return (
                                  <tr key={team.id} className="relative group/row cursor-pointer transition-colors duration-150" onClick={() => setSelectedTeam(team)}>
                                    <td className={`px-2 md:px-3 py-3 relative text-center bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 first:rounded-l-2xl last:rounded-r-2xl border-y border-l border-white/5 border-r-0 ${
                                      isQualified ? 'border-l-2 border-l-[#10B981]' : ''
                                    }`}>
                                      <div className={`font-display text-base md:text-lg ${isQualified ? 'text-[#10B981] font-extrabold' : 'text-[#555555]'}`}>
                                        {gIndex + 1}
                                      </div>
                                    </td>
                                    <td className="px-2 md:px-4 py-3 bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">
                                      <div className="flex items-center min-w-0 gap-3">
                                        <div className="w-8 h-8 rounded-xl overflow-hidden border border-[#222222] shrink-0 flex items-center justify-center bg-black">
                                          {team.logoUrl ? (
                                            <img src={team.logoUrl} alt={team.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                          ) : (
                                            <span className="text-[10px] font-display text-[#3B82F6]">{team.name.substring(0, 2)}</span>
                                          )}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            {team.country && (
                                              <span className="text-xs shrink-0">{WORLD_CUP_FLAGS.get(team.country) || '🌍'}</span>
                                            )}
                                            <span className="font-sans font-bold text-xs md:text-sm text-white truncate max-w-[120px] md:max-w-none">
                                              {team.fullName}
                                            </span>
                                            {qualificationStatus && qualificationStatus[team.id] === 'Q' && (
                                              <span className="px-1.5 py-0.5 bg-[#10B981]/25 text-[#10B981] text-[7px] font-sans font-extrabold tracking-tight rounded-md uppercase border border-[#10B981]/20">Q</span>
                                            )}
                                            {qualificationStatus && qualificationStatus[team.id] === 'E' && (
                                              <span className="px-1.5 py-0.5 bg-[#EF4444]/25 text-[#EF4444] text-[7px] font-sans font-extrabold tracking-tight rounded-md uppercase border border-[#EF4444]/20">E</span>
                                            )}
                                          </div>
                                          <span className="text-[9px] text-[#A0A0A0] font-sans font-medium truncate">{team.fcName}</span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-2 md:px-3 py-3 text-center bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">
                                      <span className="px-1.5 py-0.5 bg-[#1a1a1a] text-[9px] font-sans font-bold text-[#3B82F6] rounded-md">{team.ovr}</span>
                                    </td>
                                    <td className="px-2 py-3 text-center font-sans font-bold text-xs text-[#A0A0A0] bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">{team.played}</td>
                                    <td className="px-2 py-3 text-center font-sans font-bold text-xs text-emerald-400/90 bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">{team.won}</td>
                                    <td className="px-2 py-3 text-center font-sans font-bold text-xs text-white/45 bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">{team.drawn}</td>
                                    <td className="px-2 py-3 text-center font-sans font-bold text-xs text-red-400/90 bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">{team.lost}</td>
                                    <td className="px-2 py-3 text-center font-sans font-bold text-xs text-[#A0A0A0] bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">{team.gf}</td>
                                    <td className="px-2 py-3 text-center font-sans font-bold text-xs text-[#A0A0A0] bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">{team.ga}</td>
                                    <td className="px-2 py-3 text-center font-sans font-bold text-xs text-[#A0A0A0] bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">{team.gd > 0 ? `+${team.gd}` : team.gd}</td>
                                    <td className="px-2 md:px-3 py-3 text-center font-display font-extrabold text-sm md:text-base text-white bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">{team.points}</td>
                                    <td className="px-2 py-3 text-center bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 last:rounded-r-2xl border-y border-r border-white/5 border-l-0">
                                      <div className="flex items-center justify-center gap-1">
                                        {team.form.map((result, i) => (
                                          <div
                                            key={i}
                                            className={`w-4.5 h-4.5 text-[8px] font-sans font-bold flex items-center justify-center text-white rounded-full ${
                                              result === 'W' ? 'bg-[#10B981]' :
                                              result === 'D' ? 'bg-[#2A2A2A]' :
                                              'bg-[#EF4444]'
                                            }`}
                                            title={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}
                                          >
                                            {result}
                                          </div>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="flex flex-wrap gap-4 px-4 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-2xl bg-[#10B981]"></span>
                      <span className="text-[10px] font-bold text-[#10B981] tracking-normal uppercase">Q - Qualified</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-2xl bg-[#EF4444]"></span>
                      <span className="text-[10px] font-bold text-[#EF4444] tracking-normal uppercase">E - Eliminated</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
                  <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                    <div className="flex items-center gap-4">
                      <h2 className="text-xl font-bold  tracking-tight">
                        <EditableText id="league_table_header" defaultText="League" /> <span className="text-fc-neon-green">
                          <EditableText id="league_table_header_bold" defaultText="Table" />
                        </span>
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-2xl bg-fc-neon-green text-black" />
                      <span className="text-[10px] font-bold tracking-normal text-white/60">
                        <EditableText id="tournament_season_label" defaultText="Tournament Season" />
                      </span>
                    </div>
                  </div>
                  <table className="w-full text-left border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-[#3B82F6] text-[10px] md:text-xs tracking-[0.1em] font-sans font-bold">
                        <th className="px-3 md:px-6 py-2">Pos</th>
                        <th className="px-3 md:px-6 py-2">Player</th>
                        <th className="px-3 md:px-6 py-2 hidden md:table-cell">FC Name</th>
                        <th className="px-3 md:px-6 py-2 text-center">OVR</th>
                        <th className="px-3 md:px-6 py-2 text-center">P</th>
                        <th className="px-3 md:px-6 py-2 text-center">W</th>
                        <th className="px-3 md:px-6 py-2 text-center">D</th>
                        <th className="px-3 md:px-6 py-2 text-center">L</th>
                        <th className="px-3 md:px-6 py-2 text-center">GF</th>
                        <th className="px-3 md:px-6 py-2 text-center">GA</th>
                        <th className="px-3 md:px-6 py-2 text-center">GD</th>
                        <th className="px-3 md:px-6 py-2 text-center">Pts</th>
                        <th className="px-3 md:px-6 py-2 text-center">Form</th>
                      </tr>
                    </thead>
                    <tbody>
                        {standings.map((team, index) => {
                          return (
                            <tr key={team.id} className="relative group/row cursor-pointer transition-colors duration-150" onClick={() => setSelectedTeam(team)}>
                              <td className="px-3 md:px-6 py-3 md:py-4 relative text-center bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 first:rounded-l-2xl last:rounded-r-2xl border-y border-l border-white/5 border-r-0">
                                <div className={`font-display text-xl md:text-2xl ${
                                  index === 0 || index === 1 ? 'text-[#3B82F6]' : 
                                  index === 2 ? 'text-[#888888]' :
                                  'text-[#555555]'
                                }`}>
                                  {index + 1}
                                </div>
                              </td>
                              <td className="px-3 md:px-6 py-3 md:py-4 bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">
                                <div className="flex items-center min-w-0 gap-3">
                                   <div className="w-10 h-10 rounded-2xl overflow-hidden border border-[#222222] shrink-0 flex items-center justify-center bg-black shadow-sm">
                                    {team.logoUrl ? (
                                      <img src={team.logoUrl} alt={team.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <span className="text-[10px] font-display text-[#3B82F6]">{team.name.substring(0, 2)}</span>
                                    )}
                                  </div>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      {team.country && (
                                        <span className="text-sm shadow-sm" title={team.country}>
                                          {WORLD_CUP_FLAGS.get(team.country) || '🌍'}
                                        </span>
                                      )}
                                      <span className="font-sans font-bold whitespace-nowrap truncate pr-1 text-sm md:text-base text-white">
                                        {team.fullName}
                                      </span>
                                      {qualificationStatus && qualificationStatus[team.id] === 'Q' && (
                                        <span className="px-2 py-0.5 bg-[#10B981] text-white text-[8px] font-sans font-bold tracking-tight rounded-full" title="Mathematically Qualified">Q</span>
                                      )}
                                      {qualificationStatus && qualificationStatus[team.id] === 'E' && (
                                        <span className="px-2 py-0.5 bg-[#EF4444] text-white text-[8px] font-sans font-bold tracking-tight rounded-full" title="Mathematically Eliminated">E</span>
                                      )}
                                    </div>
                                    <span className="text-[10px] md:text-xs text-[#A0A0A0] font-sans font-bold tracking-normal mt-0.5">{team.fcName}</span>
                                  </div>
                                </div>
                              </td>
                            <td className="px-3 md:px-6 py-3 md:py-4 hidden md:table-cell font-sans font-bold text-xs text-[#A0A0A0] tracking-normal bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">{team.fcName}</td>
                            <td className="px-3 md:px-6 py-3 md:py-4 text-center bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">
                              <span className="px-2 py-1 bg-[#1A1A1A] text-[10px] font-sans font-bold text-[#3B82F6] rounded-full">{team.ovr}</span>
                            </td>
                            <td className="px-3 md:px-6 py-3 md:py-4 text-center font-sans font-bold text-xs md:text-sm text-[#A0A0A0] bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">{team.played}</td>
                            <td className="px-3 md:px-6 py-3 md:py-4 text-center font-sans font-bold text-xs md:text-sm text-[#A0A0A0] bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">{team.won}</td>
                            <td className="px-3 md:px-6 py-3 md:py-4 text-center font-sans font-bold text-xs md:text-sm text-[#A0A0A0] bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">{team.drawn}</td>
                            <td className="px-3 md:px-6 py-3 md:py-4 text-center font-sans font-bold text-xs md:text-sm text-[#A0A0A0] bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">{team.lost}</td>
                            <td className="px-3 md:px-6 py-3 md:py-4 text-center font-sans font-bold text-xs md:text-sm text-[#A0A0A0] bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">{team.gf}</td>
                            <td className="px-3 md:px-6 py-3 md:py-4 text-center font-sans font-bold text-xs md:text-sm text-[#A0A0A0] bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">{team.ga}</td>
                            <td className="px-3 md:px-6 py-3 md:py-4 text-center font-sans font-bold text-xs md:text-sm text-[#A0A0A0] bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">{team.gd > 0 ? `+${team.gd}` : team.gd}</td>
                            <td className="px-3 md:px-6 py-3 md:py-4 text-center font-display font-extrabold text-xl md:text-2xl text-white bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 border-y border-white/5">{team.points}</td>
                            <td className="px-3 md:px-6 py-3 md:py-4 text-center bg-white/[0.03] group-hover/row:bg-white/[0.08] transition-colors duration-150 last:rounded-r-2xl border-y border-r border-white/5 border-l-0">
                              <div className="flex items-center justify-center gap-1">
                                {team.form.map((result, i) => (
                                  <div
                                    key={i}
                                    className={`w-5 h-5 text-[9px] font-sans font-bold flex items-center justify-center text-white rounded-full ${
                                      result === 'W' ? 'bg-[#10B981]' :
                                      result === 'D' ? 'bg-[#2A2A2A]' :
                                      'bg-[#EF4444]'
                                    }`}
                                    title={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}
                                  >
                                    {result}
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="mt-4 flex flex-wrap gap-4 px-4 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-2xl bg-green-500/20 border border-green-500/30"></span>
                      <span className="text-[10px] font-bold text-white/40 tracking-normal">Round of 16 (Auto)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-2xl bg-yellow-500/20 border border-yellow-500/30"></span>
                      <span className="text-[10px] font-bold text-white/40 tracking-normal">Round of 16 (Wildcard)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-2xl bg-[#EF4444]/20 border border-[#EF4444]/30"></span>
                      <span className="text-[10px] font-bold text-white/40 tracking-normal">Eliminated</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'fixtures' && (
            <motion.div
              key="fixtures"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto px-4 py-8 space-y-6"
            >
              <div className="flex flex-col md:flex-row items-center gap-4 mb-8 justify-between w-full bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-fc-purple-light/30 rounded-2xl border border-fc-neon-green/50/30">
                    <Calendar className="w-6 h-6 text-fc-neon-green" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold  tracking-tight">
                      <EditableText id="fixtures_header" defaultText="Tournament" isAdmin={isAdmin} /> <span className="text-fc-neon-green">
                        <EditableText id="fixtures_header_bold" defaultText="Fixtures" isAdmin={isAdmin} />
                      </span>
                    </h2>
                    <p className="text-fc-neon-green/40 text-[10px] font-bold tracking-normal">
                      <EditableText id="fixtures_sub" defaultText="Season 2026" isAdmin={isAdmin} />
                    </p>
                  </div>
                </div>
                {isAdmin && isEditingMode && (
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAddNewFixture()}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-fc-neon-green to-fc-purple-base hover:from-fc-neon-green hover:to-fc-purple-light text-white text-[10px] font-bold tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-fc-neon-green/30 border border-white/20 whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    Add Fixture
                  </motion.button>
                )}
              </div>

              {isAdmin && isEditingMode && (
                <ScheduleRandomizer teams={registrations.filter(r => r.status === 'approved')} config={config} />
              )}

                    {(() => {
                      const allDays = Object.keys(matchesByDay);
                      let orderedDays = [];
                      if (config.dateOrder && config.dateOrder.length > 0) {
                        const existingInConfig = config.dateOrder.filter(d => allDays.includes(d));
                        const missingInConfig = allDays.filter(d => !config.dateOrder!.includes(d)).sort((a, b) => {
                          const timeA = parseTourneyDate(a).getTime();
                          const timeB = parseTourneyDate(b).getTime();
                          return timeA - timeB;
                        });
                        orderedDays = [...new Set([...existingInConfig, ...missingInConfig])];
                      } else {
                        orderedDays = allDays.sort((a, b) => {
                          const timeA = parseTourneyDate(a).getTime();
                          const timeB = parseTourneyDate(b).getTime();
                          return timeA - timeB;
                        });
                      }

                      if (!isAdmin || !isEditingMode) {
                        orderedDays = orderedDays.filter(day => !config.hiddenDates?.includes(day));
                      }
                      
                      if (isDataLoading) {
                        return (
                          <div className="py-24 text-center bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-6">
                            <Loader2 className="w-12 h-12 text-fc-neon-green animate-spin" />
                            <p className="text-white/40 text-xs tracking-[0.3em] font-bold animate-pulse">Syncing matches & teams...</p>
                          </div>
                        );
                      }

                      if (orderedDays.length === 0) {
                        return (
                          <div className="py-24 text-center bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center gap-6">
                            <div className="w-20 h-20 bg-fc-purple-light/20 rounded-2xl flex items-center justify-center border border-fc-neon-green/30">
                              <Calendar className="w-10 h-10 text-fc-neon-green" />
                            </div>
                            <div>
                              <EditableText id="loading_fixtures_title" defaultText="No Fixtures Scheduled" isAdmin={isAdmin} as="h3" className="text-2xl font-display font-bold  text-white mb-2" />
                              <p className="text-white/40 text-sm font-bold tracking-normal">
                                <EditableText id="loading_fixtures_sub" defaultText="Mark will add fixtures soon" isAdmin={isAdmin} />
                              </p>
                            </div>
                            {isAdmin && isEditingMode && (
                              <button 
                                onClick={() => handleAddNewFixture()}
                                className="mt-4 flex items-center gap-2 px-6 py-3 bg-fc-neon-green text-black hover:bg-fc-purple-light text-black text-xs font-bold tracking-normal rounded-2xl transition-all shadow-xl shadow-fc-neon-green/30"
                              >
                                <Plus className="w-4 h-4" />
                                Add First Fixture
                              </button>
                            )}
                          </div>
                        );
                      }

                      return orderedDays.map(day => (
                        <div key={day} className="space-y-6">
                          <div className="flex items-center gap-4">
                            <div className="px-4 py-2 bg-fc-purple-light/30 border border-fc-neon-green/50/30 rounded-2xl">
                              <span className="text-xs font-bold text-fc-neon-green tracking-normal">{day}</span>
                            </div>
                            <div className="h-[1px] flex-1 bg-white/10" />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {matchesByDay[day].map((match) => (
                              <MatchCard 
                                key={match.id} 
                                match={match} 
                                teams={teams}
                                isAdmin={isAdmin}
                                isEditingMode={isEditingMode}
                                onUpdateMatch={handleUpdateMatch}
                                overrideStatus={matchLabels[day]}
                                onClick={() => setSelectedMatch({ ...match, _overrideStatus: matchLabels[day] } as any)}
                              />
                            ))}
                            {isAdmin && isEditingMode && (
                              <button
                                onClick={() => handleAddNewFixture(day)}
                                className="flex items-center justify-center gap-2 p-6 bg-fc-purple-light/20 border border-dashed border-fc-neon-green/50/30 rounded-2xl text-fc-neon-green hover:bg-fc-neon-green-dark/20 hover:border-fc-neon-green/50 transition-all font-bold text-xs tracking-normal"
                              >
                                <Plus className="w-5 h-5" /> Add Fixture
                              </button>
                            )}
                          </div>
                        </div>
                      ));
                    })()}
                </motion.div>
              )}

          {activeTab === 'bracket' && (
            <motion.div
              key="bracket"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full overflow-x-auto pb-8"
            >
              <div className="flex gap-16 min-w-[1000px] px-4 py-8">
                {/* Round of 16 */}
                <div className="flex flex-col justify-around gap-4">
                  <h3 className="text-fc-neon-green font-bold tracking-normal text-[10px] mb-4 text-center bg-fc-neon-green/10 py-1 rounded border border-fc-neon-green/20">Round of 16</h3>
                  {Array.from({ length: 8 }).map((_, i) => {
                    const matchId = `r16-${i}`;
                    const match = getBracketMatch(matchId);
                    return (
                      <div key={`hub-r16-${i}`} className="relative">
                        <div className="w-fit min-w-[160px] bg-white/5 border border-fc-neon-green/30 rounded-2xl overflow-hidden shadow-lg transition-all group/match relative">
                          <div className={`p-2 flex justify-between items-center text-sm ${i % 2 === 0 ? 'bg-fc-purple-light/20' : ''} relative z-10 gap-6`}>
                            <span className="font-display font-extrabold text-fc-neon-green whitespace-nowrap">{match.homeTeamName || 'TBD'}</span>
                            <span className="font-mono font-extrabold text-fc-neon-green">{match.homeScore ?? '-'}</span>
                          </div>
                          <div className={`p-2 flex justify-between items-center text-sm border-t border-white/5 ${i % 2 !== 0 ? 'bg-fc-purple-light/20' : ''} gap-6`}>
                            <span className="font-display font-extrabold text-fc-neon-green whitespace-nowrap">{match.awayTeamName || 'TBD'}</span>
                            <span className="font-mono font-extrabold text-fc-neon-green">{match.awayScore ?? '-'}</span>
                          </div>
                        </div>
                        {/* Connector Line - Converging to Quarterfinal */}
                        <div className="absolute -right-8 top-1/2 w-8 h-[1px] bg-white/20" />
                        {i % 2 === 0 ? (
                          <div className="absolute -right-8 top-1/2 w-[1px] h-[calc(50%+8px)] bg-white/20" />
                        ) : (
                          <div className="absolute -right-8 bottom-1/2 w-[1px] h-[calc(50%+8px)] bg-white/20" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Quarter Finals */}
                <div className="flex flex-col justify-around gap-8">
                  <h3 className="text-fc-neon-green font-bold tracking-normal text-xs mb-4 text-center bg-fc-neon-green/10 py-1 rounded border border-fc-neon-green/20">Quarter-Finals</h3>
                  {Array.from({ length: 4 }).map((_, i) => {
                    const matchId = `qf-${i}`;
                    const match = getBracketMatch(matchId);
                    return (
                      <div key={`hub-qf-${i}`} className="relative my-4">
                        <div className="w-fit min-w-[160px] bg-white/5 border border-fc-neon-green/30 rounded-2xl overflow-hidden shadow-lg transition-all group/match relative">
                          <div className="p-2 flex justify-between items-center text-sm relative z-10 gap-6">
                            <span className="font-display font-extrabold transition-colors text-fc-neon-green whitespace-nowrap">
                              {match.homeTeamName || 'TBD'}
                            </span>
                            <span className="font-mono font-extrabold text-fc-neon-green">{match.homeScore ?? '-'}</span>
                          </div>
                          <div className="p-2 flex justify-between items-center text-sm border-t border-white/5 gap-6">
                            <span className="font-display font-extrabold transition-colors text-fc-neon-green whitespace-nowrap">
                              {match.awayTeamName || 'TBD'}
                            </span>
                            <span className="font-mono font-extrabold text-fc-neon-green">{match.awayScore ?? '-'}</span>
                          </div>
                        </div>
                        {/* Horizontal inbound connector */}
                        <div className="absolute -left-8 top-1/2 w-8 h-[1px] bg-white/20" />
                        
                        {/* Connector Line to Semis */}
                        <div className="absolute -right-8 top-1/2 w-8 h-[1px] bg-white/20" />
                        {i % 2 === 0 ? (
                          <div className="absolute -right-8 top-1/2 w-[1px] h-[calc(50%+32px)] bg-white/20" />
                        ) : (
                          <div className="absolute -right-8 bottom-1/2 w-[1px] h-[calc(50%+32px)] bg-white/20" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Semi Finals */}
                <div className="flex flex-col justify-around gap-16">
                  <h3 className="text-fc-neon-green font-bold tracking-normal text-xs mb-4 text-center bg-fc-neon-green/10 py-1 rounded border border-fc-neon-green/20">Semi-Finals</h3>
                  {Array.from({ length: 2 }).map((_, i) => {
                    const matchId = `sf-${i}`;
                    const match = getBracketMatch(matchId);
                    const isDashed = i === 1;
                    return (
                      <div key={`hub-sf-${i}`} className="relative">
                        <div className="w-fit min-w-[160px] bg-white/5 border border-fc-neon-green/30 rounded-2xl overflow-hidden shadow-lg transition-all group/match relative">
                          <div className="p-2 flex justify-between items-center text-sm relative z-10 gap-6">
                            <span className="font-display font-extrabold text-fc-neon-green transition-colors whitespace-nowrap">{match.homeTeamName || 'TBD'}</span>
                            <span className="font-mono font-extrabold text-fc-neon-green">{match.homeScore ?? '-'}</span>
                          </div>
                          <div className="p-2 flex justify-between items-center text-sm border-t border-white/5 gap-6">
                            <span className="font-display font-extrabold text-fc-neon-green transition-colors whitespace-nowrap">{match.awayTeamName || 'TBD'}</span>
                            <span className="font-mono font-extrabold text-fc-neon-green">{match.awayScore ?? '-'}</span>
                          </div>
                        </div>
                        {/* Connector Line */}
                        <div className={`absolute -right-8 top-1/2 w-8 h-[1px] ${isDashed ? 'border-t border-dashed border-white/40' : 'bg-white/20'}`} />
                        {i % 2 === 0 ? (
                          <div className="absolute -right-8 top-1/2 w-[1px] h-[calc(50%+64px)] bg-white/20" />
                        ) : (
                          <div className={`absolute -right-8 bottom-1/2 w-[1px] h-[calc(50%+64px)] ${isDashed ? 'border-r border-dashed border-white/40' : 'bg-white/20'}`}>
                            {/* Horizontal line to next round */}
                            <div className="absolute top-0 left-0 w-8 h-[1px] bg-white/20" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Final & 3rd Place */}
                <div className="flex flex-col justify-center gap-16">
                  <div>
                    <h3 className="text-yellow-400 font-bold tracking-normal text-xs mb-4 text-center bg-yellow-400/10 py-1 rounded border border-yellow-400/20 shadow-[0_0_15px_rgba(234,179,8,0.2)]">Grand Final</h3>
                    {(() => {
                      const match = getBracketMatch('final');
                      return (
                        <div className="w-fit min-w-[200px] bg-gradient-to-br from-fc-neon-green/20 to-fc-purple-base/20 border border-yellow-500/50 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(234,179,8,0.15)] p-1 transition-all group/match relative">
                          <div className="bg-fc-purple-dark rounded-2xl overflow-hidden relative z-10">
                            <div className="p-4 flex justify-between items-center gap-8">
                              <span className="font-display font-extrabold text-base tracking-tight text-white transition-colors whitespace-nowrap">{match.homeTeamName || 'TBD'}</span>
                              <span className="font-mono font-extrabold text-2xl text-yellow-400">{match.homeScore ?? '-'}</span>
                            </div>
                            <div className="p-4 flex justify-between items-center border-t border-white/5 gap-8">
                              <span className="font-display font-extrabold text-base tracking-tight text-white transition-colors whitespace-nowrap">{match.awayTeamName || 'TBD'}</span>
                              <span className="font-mono font-extrabold text-2xl text-yellow-400">{match.awayScore ?? '-'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <h3 className="text-orange-400 font-bold tracking-normal text-[10px] mb-4 text-center bg-orange-400/10 py-1 rounded border border-orange-400/20">3rd Place Match</h3>
                    {(() => {
                      const match = getBracketMatch('third-place');
                      return (
                        <div className="w-fit min-w-[200px] bg-white/5 border border-orange-500/30 rounded-2xl overflow-hidden shadow-lg p-1 transition-all group/match relative">
                          <div className="bg-[#0A0A0A] rounded-2xl overflow-hidden relative z-10">
                            <div className="p-3 flex justify-between items-center gap-8">
                              <span className="font-display font-extrabold text-sm tracking-tight text-orange-400 transition-colors whitespace-nowrap">{match.homeTeamName || 'TBD'}</span>
                              <span className="font-mono font-extrabold text-lg text-orange-400">{match.homeScore ?? '-'}</span>
                            </div>
                            <div className="p-3 flex justify-between items-center border-t border-white/5 gap-8">
                              <span className="font-display font-extrabold text-sm tracking-tight text-orange-400 transition-colors whitespace-nowrap">{match.awayTeamName || 'TBD'}</span>
                              <span className="font-mono font-extrabold text-lg text-orange-400">{match.awayScore ?? '-'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="mt-4 flex flex-col items-center">
                    <Trophy className="w-12 h-12 text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)] mb-2" />
                    <span className="text-[10px] font-bold tracking-[0.3em] text-yellow-500/50">Champion</span>
                  </div>
                </div>
              </div>
              
              {/* Legend hidden */}
            </motion.div>
          )}
          {activeTab === 'registration' && config.registrationEnabled && (
            <motion.div
              key="registration"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="relative h-80 rounded-2xl overflow-hidden group shadow-2xl">
                <EditableImage 
                  id="reg_hero_image" 
                  defaultSrc="https://picsum.photos/seed/tournament/1920/1080" 
                  alt="Tournament Registration" 
                  className="w-full h-full text-[0] leading-[0] transition-transform duration-700 group-hover:scale-110" 
                  isAdmin={isAdmin} 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent pointer-events-none" />
                <div className="absolute inset-x-8 bottom-8 pointer-events-none">
                  <span className="px-3 py-1 bg-fc-neon-green text-black text-black text-[10px] font-bold rounded-2xl tracking-normal mb-3 inline-block pointer-events-auto">
                    <EditableText id="apps_live_status" defaultText="Applications Live" isAdmin={isAdmin} />
                  </span>
                  <div className="pointer-events-auto inline-block relative">
                    <EditableText id="join_season_title" defaultText="Join Season 2026" isAdmin={isAdmin} as="h2" className="text-4xl md:text-5xl font-display font-bold  text-white tracking-tight leading-none mb-4" />
                  </div>
                  <p className="text-white/60 text-sm max-w-xl font-medium pointer-events-auto relative">
                    <EditableText id="ready_to_prove_sub" defaultText="Ready to prove your skills? Register now for the upcoming tournament season. Entry is limited to 16 teams." isAdmin={isAdmin} />
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-md">
                   <div className="w-12 h-12 bg-fc-purple-light/30 rounded-2xl flex items-center justify-center mb-6 border border-fc-neon-green/50/30">
                     <Users className="w-6 h-6 text-fc-neon-green" />
                   </div>
                   <EditableText id="player_reg_title" defaultText="Player Registration" isAdmin={isAdmin} as="h3" className="text-xl font-bold text-white  tracking-tight mb-2" />
                   <p className="text-white/40 text-sm mb-8">
                     <EditableText id="click_below_sub" defaultText="Click below to fill out your details and secure your spot in the bracket." isAdmin={isAdmin} />
                   </p>
                   
                   {hasRegistered ? (
                     <div className="space-y-4">
                       <div className="p-5 bg-green-600/10 border border-green-500/20 rounded-2xl flex items-center gap-3">
                         <Check className="w-5 h-5 text-green-400" />
                         <span className="text-sm font-bold text-green-400">Successfully Registered</span>
                       </div>
                       <div className="bg-[#25D366]/10 border border-[#25D366]/20 rounded-2xl p-4 space-y-3">
                         <p className="text-[10px] font-bold text-[#25D366] tracking-wider flex items-center gap-1.5 animate-pulse">
                           <span className="w-2 h-2 rounded-full bg-[#25D366]" />
                           Action Required
                         </p>
                         <p className="text-white/80 text-xs leading-relaxed">
                           To finalize your registration and secure your spot, you <span className="text-[#25D366] font-extrabold underline">MUST</span> join our WhatsApp Community.
                         </p>
                         <a 
                           href="https://chat.whatsapp.com/Hc4mGIatJYkI1myUbAWiv7"
                           target="_blank"
                           rel="noopener noreferrer"
                           className="w-full py-3 bg-[#25D366] hover:bg-[#20ba5a] text-black rounded-2xl font-bold text-[10px] tracking-normal transition-all shadow-md flex items-center justify-center gap-2 hover:scale-[1.02] transform duration-150"
                         >
                           Join WhatsApp Community
                         </a>
                       </div>
                       <button
                         id="btn-cancel-my-registration"
                         onClick={handleCancelMyRegistration}
                         className="w-full py-3.5 bg-red-500/10 hover:bg-red-500/25 text-red-400 hover:text-white border border-red-500/20 hover:border-red-500/50 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition duration-200 cursor-pointer shadow-sm tracking-wide"
                       >
                         <Trash2 className="w-4 h-4 text-red-500" />
                         <span>Cancel &amp; Delete My Registration</span>
                       </button>
                     </div>
                   ) : (
                     <button
                       onClick={async () => {
                          if (!user || user.isAnonymous) {
                            try {
                              setShowLoginModal(true);
                            } catch (e) {
                              console.error("Login failed", e);
                              return;
                            }
                          }
                          setIsRegistrationModalOpen(true);
                        }}
                       className="w-full py-5 bg-fc-neon-green text-black hover:bg-fc-purple-light text-black rounded-2xl font-bold text-xs tracking-[0.3em] transition-all shadow-xl shadow-fc-neon-green/20"
                     >
                       Register Now
                     </button>
                   )}
                 </div>

                 <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-md">
                   <div className="w-12 h-12 bg-yellow-500/20 rounded-2xl flex items-center justify-center mb-6 border border-yellow-500/30">
                     <Shield className="w-6 h-6 text-yellow-400" />
                   </div>
                   <EditableText id="requirements_title" defaultText="Requirements" isAdmin={isAdmin} as="h3" className="text-xl font-bold text-white  tracking-tight mb-2" />
                   <ul className="space-y-3">
                     {[
                       { id: 'req_1', text: "FC Mobile Active UID" },
                       { id: 'req_2', text: "Team OVR 110+" },
                       { id: 'req_3', text: "Stable Internet Connection" },
                       { id: 'req_4', text: "Fair Play Commitment" }
                     ].map(req => (
                       <li key={req.id} className="flex items-center gap-3 text-xs font-bold text-white/60">
                         <div className="w-1.5 h-1.5 bg-fc-neon-green text-black rounded-2xl" />
                         <EditableText id={req.id} defaultText={req.text} isAdmin={isAdmin} />
                       </li>
                     ))}
                   </ul>
                 </div>
              </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>

      {/* Floating Action Button */}
      <AnimatePresence>
        {config.registrationEnabled && !hasRegistered && activeTab !== 'registration' && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setActiveTab('registration'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex items-center gap-3 px-6 py-4 bg-fc-neon-green text-black rounded-2xl shadow-[0_10px_30px_rgba(37,99,235,0.4)] border border-fc-neon-green/40/30 group relative overflow-hidden"
            >
              <div className="relative z-10 flex items-center gap-3">
                <Layout className="w-5 h-5 text-white" />
                <span className="font-display font-bold  text-sm tracking-normal text-white">Join Tournament</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} onAdminLogin={() => setIsAdminModalOpen(true)} />}
        {selectedMatch && (
          <MatchDetailsModal 
            match={selectedMatch} 
            onClose={() => setSelectedMatch(null)} 
            teams={teams}
            copiedId={copiedId}
            copyToClipboard={copyToClipboard}
            updateMatch={handleUpdateMatch}
            deleteMatch={handleDeleteMatch}
            isEditingMode={isEditingMode || (user && (selectedMatch.homeTeamId === user.uid || selectedMatch.awayTeamId === user.uid))}
            siteContent={siteContent}
            isAdmin={isAdmin}
            resetMatch={handleResetSingleMatch}
            currentUser={user}
            myRegistrationData={myRegistrationData}
          />
        )}
        {isRegistrationModalOpen && (
          <RegistrationModal 
            onClose={() => setIsRegistrationModalOpen(false)} 
            handleRegister={handleRegister}
            isSubmitting={isSubmittingRegistration}
            hasRegistered={hasRegistered}
            user={user}
            existingRegistrations={registrations}
            config={config}
          />
        )}

        {isAddMatchModalOpen && (
          <AddMatchModal 
            onClose={() => setIsAddMatchModalOpen(false)}
            onSave={handleAddNewFixture}
            teams={dbTeams}
            initialDate={addMatchInitialData.date}
            initialHome={addMatchInitialData.home}
            initialAway={addMatchInitialData.away}
          />
        )}
        {isEditingProfile && myRegistrationData && (
          <EditProfileModal
            registration={myRegistrationData}
            onClose={() => setIsEditingProfile(false)}
            handleUpdateRegistration={handleUpdateRegistration}
            isSubmitting={isSubmittingRegistration}
            config={config}
            registrations={registrations}
          />
        )}
        {adminEditingRegistration && (
          <EditProfileModal
            registration={adminEditingRegistration}
            onClose={() => setAdminEditingRegistration(null)}
            handleUpdateRegistration={handleAdminUpdateUserRegistration}
            isSubmitting={isSubmittingRegistration}
            config={config}
            registrations={registrations}
          />
        )}
        {isAdminModalOpen && (
          <AdminModal 
            isAdmin={isAdmin}
            isDrawAdmin={isDrawAdmin}
            user={user}
            onClose={() => setIsAdminModalOpen(false)} 
            registrations={registrations}
            config={config}
            handleToggleRegistration={handleToggleRegistration}
            isSavingAdmin={isSavingAdmin}
            bracket={bracket}
            isSavingBracket={isSavingBracket}
            handleSaveBracket={handleSaveBracket}
            handleAdminAiCommand={handleAdminAiCommand}
            handleAdminReset={handleAdminReset}
            handleApproveRegistration={handleApproveRegistration}
            handleRejectRegistration={handleRejectRegistration}
            handleDeleteRegistration={handleDeleteRegistration}
            handleResetAllRegistrations={handleResetAllRegistrations}
            isEditingMode={isEditingMode}
            setIsEditingMode={setIsEditingMode}
            matchLabels={matchLabels}
            updateMatchLabel={updateMatchLabel}
            handleRenameMatchDate={handleRenameMatchDate}
            matchesByDay={matchesByDay}
            handleAnalyzeQualification={handleAnalyzeQualification}
            handleUpdateConfig={handleUpdateConfig}
            setAdminEditingRegistration={setAdminEditingRegistration}
            teams={standings}
            matches={matches}
            handleRandomizeGroups={handleRandomizeGroups}
            handleClearGroups={handleClearGroups}
            refreshCache={refreshCache}
          />
        )}
        {selectedTeam && (
          <TeamProfileModal
            team={selectedTeam}
            teams={teams}
            matches={matches}
            onClose={() => setSelectedTeam(null)}
            isAdmin={isAdmin}
            resetPlayer={handleResetPlayer}
          />
        )}

      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-20 py-8 md:py-12 border-t border-white/10 bg-fc-purple-dark/20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-8">
                <div className="text-center md:text-left">
                  <p className="text-[8px] md:text-[10px] tracking-[0.2em] md:tracking-[0.3em] font-bold text-fc-neon-green/50 mb-1">
                    TOTAL MATCHES
                  </p>
                  <p className="text-xl md:text-3xl font-display font-bold  tracking-tight pr-1">{matches.length}</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-[8px] md:text-[10px] tracking-[0.2em] md:tracking-[0.3em] font-bold text-fc-neon-green/50 mb-1">
                    TEAMS
                  </p>
                  <p className="text-xl md:text-3xl font-display font-bold  tracking-tight pr-1">{teams.length}</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-[8px] md:text-[10px] tracking-[0.2em] md:tracking-[0.3em] font-bold text-fc-neon-green/50 mb-1">
                    MATCHDAYS
                  </p>
                  <p className="text-xl md:text-3xl font-display font-bold  tracking-tight pr-1">{Object.keys(matchesByDay).length}</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-[8px] md:text-[10px] tracking-[0.2em] md:tracking-[0.3em] font-bold text-fc-neon-green/50 mb-1">
                    <EditableText id="footer_visits_label" defaultText="Total Visits" isAdmin={isAdmin} />
                  </p>
                  <p className="text-xl md:text-3xl font-display font-bold  tracking-tight pr-1">{visitCount}</p>
                </div>
          </div>
          <p className="text-white/20 text-[10px] font-mono tracking-normal">
            &copy; 2026 UXI Tournament Hub
          </p>
        </div>
      </footer>
    </div>
    </>
  );
}
