import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Calendar, Table as TableIcon, GitBranch, ChevronRight, Star, Copy, Check, Info, Search, BarChart2, Award, LogIn, LogOut, Loader2, Plus, Trash2, Save, X, Trophy as TrophyIcon, Eye, EyeOff, Shield, RotateCcw, ArrowLeft, Users, Layout, Edit3, Settings, User as UserIcon, Download, Upload, IdCard, ChevronUp, ChevronDown, Sparkles, AlertCircle } from 'lucide-react';
import { INITIAL_TEAMS, TEAMS_LIST, TOURNAMENT_SCHEDULE, TEAM_DETAILS } from './constants';
import { Team, Match, BracketMatch, Scorer, Registration, Config, MatchReport, Achievement, UserAchievement, UserProfile } from './types';
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
import { auth, db, signIn, logout, handleFirestoreError, OperationType, signInAnon } from './supabase_mock';
import { onAuthStateChanged, User, supabase } from './supabase_mock';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, getDoc, limit, getDocs, deleteDoc, updateDoc, getDocFromServer, increment, writeBatch, orderBy, arrayUnion } from './supabase_mock';
import { ACHIEVEMENTS } from './achievements';
import { evaluateAchievements } from './utils/achievementEngine';
import { AchievementsList, AchievementPopup } from './components/AchievementSystem';

const INITIAL_BRACKET: BracketMatch[] = [
  { id: 'qual-0', round: 'Qualifier Round', homeTeamName: 'TBD', awayTeamName: 'TBD', homeScore: 0, awayScore: 0 },
  { id: 'qual-1', round: 'Qualifier Round', homeTeamName: 'TBD', awayTeamName: 'TBD', homeScore: 0, awayScore: 0 },
  { id: 'qual-2', round: 'Qualifier Round', homeTeamName: 'TBD', awayTeamName: 'TBD', homeScore: 0, awayScore: 0 },
  { id: 'qual-3', round: 'Qualifier Round', homeTeamName: 'TBD', awayTeamName: 'TBD', homeScore: 0, awayScore: 0 },
  { id: 'qf-0', round: 'Quarter-Finals', homeTeamName: 'TBD', awayTeamName: 'TBD', homeScore: 0, awayScore: 0 },
  { id: 'qf-1', round: 'Quarter-Finals', homeTeamName: 'TBD', awayTeamName: 'TBD', homeScore: 0, awayScore: 0 },
  { id: 'qf-2', round: 'Quarter-Finals', homeTeamName: 'TBD', awayTeamName: 'TBD', homeScore: 0, awayScore: 0 },
  { id: 'qf-3', round: 'Quarter-Finals', homeTeamName: 'TBD', awayTeamName: 'TBD', homeScore: 0, awayScore: 0 },
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
  
  // Sort matches by matchNumber to ensure form is chronological
  const sortedMatches = [...matches].sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));

  sortedMatches.forEach(m => {
    // Determine if this is a league match based on matchday (e.g. 1-10 are league, 11+ are knockout)
    const isLeagueMatch = (m.matchday || 0) <= 20; 

    if (m.status === 'finished' && isLeagueMatch && m.homeScore !== undefined && m.homeScore !== null && m.awayScore !== undefined && m.awayScore !== null) {
      const home = standings.find(t => t.id === m.homeTeamId);
      const away = standings.find(t => t.id === m.awayTeamId);
      
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

const calculateStats = (teams: Team[], matches: Match[]): (PlayerGoalStats & { teamId: string })[] => {
  const statsMap: Record<string, PlayerGoalStats & { teamId: string }> = {};

  matches.forEach(m => {
    if (m.status === 'finished') {
      const homeTeam = teams.find(t => t.id === m.homeTeamId);
      const awayTeam = teams.find(t => t.id === m.awayTeamId);

      if (homeTeam && m.homeScorers) {
        m.homeScorers.forEach(s => {
          const key = `${s.playerName}-${homeTeam.id}`;
          if (!statsMap[key]) {
            statsMap[key] = {
              teamId: homeTeam.id,
              playerName: s.playerName,
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
          const key = `${s.playerName}-${awayTeam.id}`;
          if (!statsMap[key]) {
            statsMap[key] = {
              teamId: awayTeam.id,
              playerName: s.playerName,
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

  matches.forEach(m => {
    if (m.status === 'finished') {
      const homeTeam = teams.find(t => t.id === m.homeTeamId);
      const awayTeam = teams.find(t => t.id === m.awayTeamId);

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
  matches.forEach(m => {
    if (m.status === 'finished' && m.manOfTheMatch) {
      tallies[m.manOfTheMatch] = (tallies[m.manOfTheMatch] || 0) + 1;
    }
  });
  return Object.entries(tallies)
    .map(([playerName, awards]) => ({ playerName, awards }))
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
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-4xl bg-gradient-to-b from-[#000030] to-blue-900/20 border border-white/10 rounded-[2.5rem] p-6 md:p-10 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto hide-scrollbar"
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
              className={`p-2 rounded-full transition-colors flex items-center gap-2 px-4 text-xs font-black uppercase tracking-widest ${confirmReset ? 'bg-red-600 text-white animate-pulse' : 'bg-red-600/20 text-red-400 hover:bg-red-600/40'}`}
            >
              <RotateCcw className="w-4 h-4" />
              {confirmReset ? 'Confirm Reset' : 'Reset Player Data'}
            </button>
          )}
          <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-8 items-start mb-12 relative z-10 mt-8 md:mt-0">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-4xl md:text-5xl font-black shrink-0 shadow-lg overflow-hidden">
            {team.logoUrl ? <img src={team.logoUrl} className="w-full h-full object-cover" /> : team.name[0]}
          </div>
          <div className="flex-1 space-y-2">
            <h2 className="text-3xl md:text-5xl font-display font-black uppercase italic tracking-tighter leading-none">{team.fullName}</h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-3 py-1 bg-white/10 rounded-lg text-xs font-black uppercase tracking-widest text-white/60">FC: {team.fcName}</span>
              <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-lg text-xs font-black uppercase tracking-widest text-blue-400">OVR {team.ovr}</span>
              <div className="px-3 py-1 bg-white/5 rounded-lg flex items-center gap-1.5 text-xs text-white/40 font-mono">
                 UID: <span>{team.uid}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center items-center text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Total Goals</span>
            <span className="text-2xl font-black text-green-400">{totalGoalsScored}</span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center items-center text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Goals Conceded</span>
            <span className="text-2xl font-black text-red-400">{totalGoalsConceded}</span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center items-center text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Avg Possession</span>
            <span className="text-2xl font-black text-blue-400">{avgPossession}%</span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col justify-center items-center text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Top Scorer</span>
            <span className="text-lg font-black text-orange-400 truncate w-full px-2" title={topScorerInfo[0] as string}>{topScorerInfo[0]}</span>
            <span className="text-[10px] font-bold text-orange-400/50">{topScorerInfo[1]} Goals</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-white/60 mb-2 border-b border-white/10 pb-2">Upcoming Matches</h3>
            {upcomingMatches.length > 0 ? upcomingMatches.slice(0, 3).map(m => {
              const opp = m.homeTeamId === team.id ? teams.find(t => t.id === m.awayTeamId) : teams.find(t => t.id === m.homeTeamId);
              return (
                                <div key={m.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <EditableMatchBadge match={m} isAdmin={isAdmin} className="bg-blue-600/20 px-1.5 py-0.5 rounded border border-blue-500/20" textClassName="text-blue-400 text-[8px] font-black" />
                    <span className="text-xs font-bold uppercase">{opp?.name || 'TBD'}</span>
                  </div>
                  <span className="text-[10px] uppercase font-black text-white/30 tracking-widest">{m.date}</span>
                </div>
              );
            }) : (
               <div className="p-4 text-center text-white/20 text-xs uppercase font-black tracking-widest bg-white/5 rounded-xl border border-white/10">No upcoming matches</div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-white/60 mb-2 border-b border-white/10 pb-2">Recent Form</h3>
            {recentMatches.length > 0 ? recentMatches.map(m => {
              const isHome = m.homeTeamId === team.id;
              const opp = isHome ? teams.find(t => t.id === m.awayTeamId) : teams.find(t => t.id === m.homeTeamId);
              const myScore = isHome ? m.homeScore! : m.awayScore!;
              const oppScore = isHome ? m.awayScore! : m.homeScore!;
              const isWin = myScore > oppScore;
              const isDraw = myScore === oppScore;
              return (
                <div key={m.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${isWin ? 'bg-green-500' : isDraw ? 'bg-gray-400' : 'bg-red-500'}`} />
                    <span className="text-xs font-bold uppercase">{opp?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono font-bold">
                    <span className={isWin ? 'text-green-400' : (isDraw ? 'text-gray-400' : 'text-white/40')}>{myScore}</span>
                    <span className="text-white/20">-</span>
                    <span className={!isWin && !isDraw ? 'text-red-400' : 'text-white/40'}>{oppScore}</span>
                  </div>
                </div>
              );
            }) : (
               <div className="p-4 text-center text-white/20 text-xs uppercase font-black tracking-widest bg-white/5 rounded-xl border border-white/10">No recent matches</div>
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
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 flex items-center justify-center text-2xl font-black shadow-lg group-hover:scale-110 transition-transform overflow-hidden z-10">
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
            className="mt-2 bg-black/80 border border-blue-500/50 rounded-lg text-white text-[10px] p-1 font-bold outline-none max-w-[120px]"
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
        <div className="text-center max-w-[140px]">
          <div className="text-[10px] font-black text-white uppercase tracking-tight truncate">
            {team?.fullName || team?.fcName || team?.name || 'TBD'}
          </div>
        </div>
      );
    }

    return (
      <motion.div
        whileHover={{ scale: 1.01, y: -2 }}
        onClick={onClick}
        className="bg-white/5 border border-white/10 rounded-3xl p-6 cursor-pointer hover:bg-white/10 transition-all group relative overflow-visible backdrop-blur-sm"
      >
        <div className="absolute top-0 right-0 p-4 opacity-[0.08] pointer-events-none select-none">
           <span className="text-6xl font-black italic text-white tracking-tighter">
             {match.matchNumber}
           </span>
        </div>
        
        <div className="flex items-center justify-between gap-4 relative z-10">
          <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <TeamLogo team={homeTeam} />
            {renderTeamName('home', homeTeam)}
          </div>

          <div className="flex flex-col items-center gap-3 px-6 py-2 bg-black/20 rounded-2xl border border-white/5">
            <EditableMatchBadge 
              match={match} 
              isAdmin={isAdmin} 
              onUpdateMatch={onUpdateMatch}
              className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-600 px-2 py-0.5 rounded shadow-lg"
              textClassName="text-[8px] font-black text-white uppercase tracking-widest placeholder-white/50"
            />
            <div className="flex items-center gap-4">
              <span className={`text-3xl font-black tabular-nums ${displayStatus === 'finished' ? (match.homeScore! > match.awayScore! ? 'text-green-400' : 'text-white/40') : 'text-white'}`}>
                {match.homeScore ?? '-'}
              </span>
              <div className="flex flex-col items-center">
                 <span className="text-[10px] font-black text-white/20">VS</span>
                 <div className="h-4 w-[1px] bg-white/10 my-1" />
              </div>
              <span className={`text-3xl font-black tabular-nums ${displayStatus === 'finished' ? (match.awayScore! > match.homeScore! ? 'text-green-400' : 'text-white/40') : 'text-white'}`}>
                {match.awayScore ?? '-'}
              </span>
            </div>
            <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] shadow-sm ${
              displayStatus === 'finished' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
              displayStatus === 'ongoing' || displayStatus === 'live' ? 'bg-red-500/10 text-red-100 animate-pulse border border-red-500/20' :
              'bg-blue-500/10 text-blue-100 border border-blue-500/20'
            }`}>
              {displayStatus === 'finished' ? 'Final' : displayStatus === 'ongoing' || displayStatus === 'live' ? 'Live' : 'Upcoming'}
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

  const MatchDetailsModal = ({ match, onClose, teams, copiedId, copyToClipboard, updateMatch, deleteMatch, isEditingMode, siteContent, isAdmin, resetMatch }: { 
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
    resetMatch?: (id: string) => Promise<void> | void
  }) => {
    const [confirmDelete, setConfirmDelete] = useState(false);
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
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
            <span className="text-white w-12 text-left">{home}{suffix}</span>
            <span className="text-blue-400/40 text-[9px]">{label}</span>
            <span className="text-white w-12 text-right">{away}{suffix}</span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden flex">
            <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${homePercent}%` }} />
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000030]/95 cursor-pointer will-change-opacity"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.98, opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="w-full max-w-2xl bg-[#000040] border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative max-h-[90vh] overflow-y-auto cursor-default will-change-transform"
          onClick={e => e.stopPropagation()}
        >
          <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-blue-500/20 to-transparent pointer-events-none" />
          
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
                  className={`px-4 py-2 border rounded-lg text-xs font-black uppercase transition-all ${confirmDelete ? 'bg-red-600 border-red-600 text-white animate-pulse' : 'bg-red-600/20 hover:bg-red-600/40 border-red-500/50 text-red-400'}`}
                >
                  {confirmDelete ? 'Click to Confirm Delete' : 'Delete Match'}
                </button>
              </div>
            )}
            
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[15rem] md:text-[20rem] font-black text-white/[0.02] italic select-none pointer-events-none">
              {match.matchNumber}
            </div>
            
            <div className="flex justify-between items-center mb-12 relative z-10">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <span className="text-xs font-black uppercase tracking-[0.3em] text-blue-400">Match Details</span>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-4 mb-12">
              <div 
                className="flex-1 flex flex-col items-center text-center gap-4 cursor-pointer hover:bg-white/5 p-4 rounded-3xl transition-colors"
                onClick={() => { if (homeTeam) window.dispatchEvent(new CustomEvent('openTeamProfile', { detail: homeTeam })) }}
              >
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl md:text-4xl shadow-lg overflow-hidden">
                  {homeTeam?.logoUrl ? <img src={homeTeam.logoUrl} className="w-full h-full object-cover" /> : (homeTeam?.name[0] || '?')}
                </div>
                <div className="space-y-1">
                  <h2 className="font-display font-black text-lg md:text-xl uppercase italic tracking-tight pr-1">{homeTeam?.fullName || 'TBD'}</h2>
                  {homeTeam && (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest">FC: {homeTeam.fcName}</span>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] font-black text-blue-400">OVR {homeTeam.ovr}</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(homeTeam.uid);
                          }}
                          className="flex items-center gap-1.5 text-[9px] md:text-[10px] text-white/40 hover:text-blue-400 transition-colors group/uid"
                        >
                          <span className="font-mono font-bold tracking-wider uppercase">
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
                {match.homeScorers && match.homeScorers.length > 0 && (
                  <div className="mt-4 flex flex-col items-center gap-1">
                    {match.homeScorers.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-white/40 italic">
                          {s.playerName} {Array.from({ length: s.goals }).map((_, idx) => <span key={idx}>⚽</span>)} {s.time && `(${s.time})`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-2 md:gap-4">
                <div className="text-[10px] md:text-xs font-black text-blue-400/50 uppercase tracking-widest">Score</div>
                <div className="flex items-center gap-4 md:gap-6">
                  {match.isDNF ? (
                    <span className="text-4xl md:text-6xl font-black text-red-500 tracking-tighter">DNF</span>
                  ) : isEditingMode && isAdmin ? (
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" defaultValue={match.homeScore ?? 0} onChange={(e) => {
                          const val = parseInt(e.target.value);
                          match.homeScore = isNaN(val) ? 0 : val;
                          if(updateMatch) updateMatch(match);
                      }} className="w-16 h-16 md:w-20 md:h-20 bg-white/10 rounded-2xl text-center text-4xl md:text-6xl font-black text-white" />
                      <span className="text-2xl text-white/20">VS</span>
                      <input type="number" min="0" defaultValue={match.awayScore ?? 0} onChange={(e) => {
                          const val = parseInt(e.target.value);
                          match.awayScore = isNaN(val) ? 0 : val;
                          if(updateMatch) updateMatch(match);
                      }} className="w-16 h-16 md:w-20 md:h-20 bg-white/10 rounded-2xl text-center text-4xl md:text-6xl font-black text-white" />
                    </div>
                  ) : (
                    <>
                      <span className="text-4xl md:text-6xl font-black tabular-nums">{match.homeScore ?? '-'}</span>
                      <span className="text-white/10 font-black text-xl md:text-2xl">VS</span>
                      <span className="text-4xl md:text-6xl font-black tabular-nums">{match.awayScore ?? '-'}</span>
                    </>
                  )}
                </div>
                {match.rescheduled && displayStatus !== 'rescheduled' && (
                  <div className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-orange-400 mb-2">
                    Rescheduled Match
                  </div>
                )}
                <div className={`px-3 md:px-4 py-1 md:py-1.5 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                  displayStatus === 'finished' ? 'bg-green-500/20 text-green-400' : 
                  displayStatus === 'rescheduled' ? 'bg-orange-500/20 text-orange-400' :
                  displayStatus === 'live' || displayStatus === 'ongoing' ? 'bg-red-500/20 text-red-400' : 'bg-blue-600/20 text-blue-400'
                }`}>
                  {(displayStatus === 'live' || displayStatus === 'ongoing') && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  )}
                  {displayStatus === 'finished' ? 'Final Result' : 
                   displayStatus === 'rescheduled' ? 'Rescheduled' :
                   (displayStatus === 'live' || displayStatus === 'ongoing') ? 'Ongoing' : 'Match Scheduled'}
                </div>

                {isEditingMode && isAdmin && (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Edit Status</p>
                    <select 
                      value={match.status}
                      onChange={(e) => {
                        match.status = e.target.value as any;
                        if (updateMatch) updateMatch(match);
                      }}
                      className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest text-white outline-none focus:border-blue-500 transition-all hover:bg-white/10"
                    >
                      <option value="scheduled" className="bg-[#000030]">Scheduled</option>
                      <option value="ongoing" className="bg-[#000030]">Ongoing</option>
                      <option value="finished" className="bg-[#000030]">Final Result</option>
                      <option value="rescheduled" className="bg-[#000030]">Rescheduled</option>
                    </select>
                  </div>
                )}
              </div>

              <div 
                className="flex-1 flex flex-col items-center text-center gap-4 cursor-pointer hover:bg-white/5 p-4 rounded-3xl transition-colors"
                onClick={() => { if (awayTeam) window.dispatchEvent(new CustomEvent('openTeamProfile', { detail: awayTeam })) }}
              >
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl md:text-4xl shadow-lg overflow-hidden">
                  {awayTeam?.logoUrl ? <img src={awayTeam.logoUrl} className="w-full h-full object-cover" /> : (awayTeam?.name[0] || '?')}
                </div>
                <div className="space-y-1">
                  <h2 className="font-display font-black text-lg md:text-xl uppercase italic tracking-tight pr-1">{awayTeam?.fullName || 'TBD'}</h2>
                  {awayTeam && (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest">FC: {awayTeam.fcName}</span>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] font-black text-blue-400">OVR {awayTeam.ovr}</span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(awayTeam.uid);
                          }}
                          className="flex items-center gap-1.5 text-[9px] md:text-[10px] text-white/40 hover:text-blue-400 transition-colors group/uid"
                        >
                          <span className="font-mono font-bold tracking-wider uppercase">
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
                {match.awayScorers && match.awayScorers.length > 0 && (
                  <div className="mt-4 flex flex-col items-center gap-1">
                    {match.awayScorers.map((s, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-white/40 italic">
                          {s.playerName} {Array.from({ length: s.goals }).map((_, idx) => <span key={idx}>⚽</span>)} {s.time && `(${s.time})`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {displayStatus === 'finished' && (
              <>
                {match.manOfTheMatch || (isEditingMode && isAdmin) ? (
                  <div className="mt-6 flex flex-col items-center gap-2 bg-yellow-500/10 py-3 px-4 rounded-2xl border border-yellow-500/20 shadow-[0_0_20px_rgba(234,179,8,0.05)]">
                    <div className="flex items-center justify-center gap-2">
                      <Trophy className="w-4 h-4 text-yellow-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500/80">Man of the Match: </span>
                    </div>
                    {isEditingMode && isAdmin ? (
                      <input 
                        type="text" 
                        value={match.manOfTheMatch || ''} 
                        placeholder="Player Name"
                        onChange={(e) => {
                          match.manOfTheMatch = e.target.value;
                          if(updateMatch) updateMatch(match);
                        }}
                        className="bg-black/40 border border-yellow-500/30 rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-widest text-yellow-400 outline-none focus:border-yellow-500 w-full max-w-[200px] text-center"
                      />
                    ) : (
                      <span className="text-sm font-display font-black italic uppercase text-yellow-400">{match.manOfTheMatch}</span>
                    )}
                  </div>
                ) : null}

                {match.homeStats && match.awayStats && (
                  <div className="mt-4 md:mt-6 space-y-4 p-4 md:p-6 bg-white/5 rounded-2xl border border-white/5">
                    <div className="text-center mb-1 md:mb-2">
                      <span className="text-[9px] md:text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] md:tracking-[0.3em]">Match Statistics</span>
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
                <div className="text-[9px] md:text-[10px] font-black text-white/30 uppercase tracking-widest">Match Date</div>
                <div className="text-xs md:text-sm font-bold text-blue-400">{match.date}</div>
              </div>
              <div className="text-center space-y-1 border-l border-white/5">
                <div className="text-[9px] md:text-[10px] font-black text-white/30 uppercase tracking-widest">Match No.</div>
                <div className="flex items-center justify-center gap-2">
                  {isEditingMode && isAdmin ? (
                    <input 
                      type="number" 
                      min="1" 
                      defaultValue={match.matchNumber} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        match.matchNumber = isNaN(val) ? 1 : val;
                        if (updateMatch) updateMatch(match);
                      }}
                      className="w-16 bg-black/40 border border-white/20 rounded px-2 py-1 text-center text-xs text-blue-400 outline-none focus:border-blue-500 font-bold"
                    />
                  ) : (
                    <span className="text-xs md:text-sm font-bold text-blue-400">#{match.matchNumber}</span>
                  )}
                </div>
              </div>
            </div>

            {match.evidenceUploadedBy && (
              <div className="mt-4 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Result Verified by AI</span>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Reporter: <span className="text-white">{match.evidenceUploadedBy}</span></p>
                  {match.evidenceTimestamp && (
                    <p className="text-[8px] font-bold text-white/20 uppercase tracking-tighter mt-0.5">Time: {formatTimestamp(match.evidenceTimestamp)}</p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-8 flex flex-col items-center gap-4">
              <button 
                onClick={onClose}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-blue-600/20"
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
                  className="px-6 py-2 bg-red-600/10 hover:bg-red-600 border border-red-500/20 hover:border-red-500 text-red-500 hover:text-white font-black uppercase text-[10px] tracking-widest rounded-xl transition-all flex items-center gap-2"
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
    isSubmitting
  }: { 
    registration: Registration,
    onClose: () => void, 
    handleUpdateRegistration: (data: Registration) => Promise<void>, 
    isSubmitting: boolean
  }) => {
    const [formData, setFormData] = useState({
      ...registration,
      name: registration.name || '',
      age: (registration.age || '').toString(),
      fcUid: registration.fcUid || '',
      fcName: registration.fcName || '',
      teamOvr: (registration.teamOvr || '').toString(),
      experience: registration.experience || '',
      goalkeeper: registration.goalkeeper || '',
      logoUrl: registration.logoUrl || ''
    });
    const [isCompressing, setIsCompressing] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 10 * 1024 * 1024) {
        alert("File is too large. Please select an image under 10MB.");
        return;
      }

      setIsCompressing(true);
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData({ ...formData, logoUrl: reader.result as string });
          setIsCompressing(false);
        };
        reader.readAsDataURL(file);
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
          className="absolute inset-0 bg-black/90 backdrop-blur-xl"
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg bg-[#0a0a1a] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
        >
          <div className="p-6 md:p-8 border-b border-white/5 bg-gradient-to-b from-blue-600/10 to-transparent">
            <div className="flex justify-between items-start mb-4 md:mb-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-display font-black italic text-white tracking-tight uppercase leading-none mb-2">Edit Campaign Profile</h2>
                <p className="text-blue-400/60 text-[10px] font-black uppercase tracking-[0.2em]">Update your tournament information</p>
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
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Full Name</label>
                <input 
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Age</label>
                <input 
                  required
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({...formData, age: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">FC UID</label>
                <input 
                  required
                  type="text"
                  value={formData.fcUid}
                  onChange={(e) => setFormData({...formData, fcUid: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">FC Name</label>
                <input 
                  required
                  type="text"
                  value={formData.fcName}
                  onChange={(e) => setFormData({...formData, fcName: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Team OVR</label>
                <input 
                  required
                  type="number"
                  value={formData.teamOvr}
                  onChange={(e) => setFormData({...formData, teamOvr: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Goalkeeper Name</label>
                <input 
                  required
                  type="text"
                  value={formData.goalkeeper}
                  onChange={(e) => setFormData({...formData, goalkeeper: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all text-sm"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Experience</label>
                <input 
                  required
                  type="text"
                  value={formData.experience}
                  onChange={(e) => setFormData({...formData, experience: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all text-sm"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Logo Photo</label>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="edit-logo-upload" />
                <label htmlFor="edit-logo-upload" className="flex items-center justify-center gap-3 w-full bg-white/5 border border-dashed border-white/20 rounded-xl p-8 cursor-pointer hover:bg-white/10 hover:border-blue-500/50 transition-all">
                  {formData.logoUrl ? (
                    <img src={formData.logoUrl} className="w-16 h-16 rounded-full object-cover border-2 border-blue-500" />
                  ) : <Plus className="w-6 h-6" />}
                </label>
              </div>
              <div className="md:col-span-2 pt-4">
                <button 
                  type="submit" 
                  disabled={isSubmitting || isCompressing}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all"
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

  const TeamSearchableSelect = ({ label, value, onChange, teams, placeholder = "Search teammate..." }: { label: string, value: string, onChange: (val: string) => void, teams: Team[], placeholder?: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Initial search should be based on the current value if it's already a team name
    useEffect(() => {
      const safeTeams = teams || [];
      const team = safeTeams.find(t => t.id === value);
      if (team) {
        setSearch(team.fullName || team.fcName || team.name || '');
      } else {
        setSearch(value || '');
      }
    }, [value, teams]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredTeams = useMemo(() => {
      const safeTeams = teams || [];
      const lowerSearch = (search || '').toLowerCase();
      const filtered = search ? safeTeams.filter(t => 
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
    }, [search, teams]);

    return (
      <div className="space-y-2 relative" ref={dropdownRef}>
        <label className="text-[10px] font-black uppercase text-white/40 tracking-widest">{label}</label>
        <div className="relative">
          <input 
            type="text" 
            value={search}
            onFocus={() => setIsOpen(true)}
            onChange={e => {
              setSearch(e.target.value);
              onChange(e.target.value);
              setIsOpen(true);
            }} 
            placeholder={placeholder}
            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none transition-all" 
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
        </div>

        <AnimatePresence>
          {isOpen && (filteredTeams.length > 0 || search) && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-[110] left-0 right-0 mt-2 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto"
            >
              {filteredTeams.length > 0 ? (
                filteredTeams.map(team => (
                  <button
                    key={team.id}
                    onClick={() => {
                      const displayValue = team.fullName || team.fcName || team.name;
                      onChange(team.id);
                      setSearch(displayValue);
                      setIsOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-blue-600/20 flex items-center gap-3 border-b border-white/5 last:border-0 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      {team.logoUrl ? (
                        <img src={team.logoUrl} alt="" className="w-full h-full object-cover rounded-lg" referrerPolicy="no-referrer" />
                      ) : (
                        <Star className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 truncate">
                      <p className="text-xs font-bold text-white truncate">
                        {team.fullName || team.fcName || team.name}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/20 italic">No matching players</p>
                </div>
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
      <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-zinc-900 border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
          
          <h2 className="text-2xl font-display font-black uppercase italic text-white mb-6">Add New Fixture</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1 block">Match Date</label>
              <input 
                value={date}
                onChange={e => setDate(e.target.value)}
                placeholder="YYYY-MM-DD or TBD"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
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
              className="flex-1 py-4 rounded-xl font-black uppercase text-xs tracking-widest text-white/40 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => onSave({ date, home, away })}
              className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-blue-600/20"
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
    user
  }: { 
    onClose: () => void, 
    handleRegister: (data: any) => void, 
    isSubmitting: boolean,
    hasRegistered: boolean,
    user: User | null
  }) => {
    const [formData, setFormData] = useState({
      name: '',
      age: '',
      fcUid: '',
      fcName: '',
      teamOvr: '',
      experience: '',
      goalkeeper: '',
      logoUrl: ''
    });
    const [isCompressing, setIsCompressing] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        return;
      }

      setIsCompressing(true);
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData({ ...formData, logoUrl: reader.result as string });
          setIsCompressing(false);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error("File read error:", error);
        setIsCompressing(false);
      }
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
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
          className="absolute inset-0 bg-black/90 backdrop-blur-xl"
        />
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg bg-[#0a0a1a] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
        >
          <div className="p-6 md:p-8 border-b border-white/5 bg-gradient-to-b from-blue-600/10 to-transparent">
            <div className="flex justify-between items-start mb-4 md:mb-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-display font-black italic text-white tracking-tight uppercase leading-none mb-2">Tournament Registration</h2>
                <p className="text-blue-400/60 text-[10px] font-black uppercase tracking-[0.2em]">Join the Elite Competition</p>
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
                <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto">
                  <LogIn className="w-10 h-10 text-blue-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-display font-black text-white italic">Google Sign-In Required</h3>
                  <p className="text-white/40 text-sm max-w-xs mx-auto">To ensure secure registration and verify your identity, please sign in with your Google account.</p>
                </div>
                <button 
                  onClick={() => handleRegister({} as any)} 
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-600/20"
                >
                  <LogIn className="w-4 h-4" />
                  Continue with Google
                </button>
              </div>
            ) : hasRegistered ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="text-2xl font-display font-black text-white italic">Already Registered!</h3>
                <p className="text-white/40 text-sm">Your application has been received. Good luck!</p>
                <button 
                  onClick={onClose}
                  className="mt-6 w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Full Name</label>
                  <input 
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Enter your name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Age</label>
                  <input 
                    required
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({...formData, age: e.target.value})}
                    placeholder="21"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40">FC UID</label>
                  <input 
                    required
                    type="text"
                    value={formData.fcUid}
                    onChange={(e) => setFormData({...formData, fcUid: e.target.value})}
                    placeholder="Unique ID"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40">FC Name</label>
                  <input 
                    required
                    type="text"
                    value={formData.fcName}
                    onChange={(e) => setFormData({...formData, fcName: e.target.value})}
                    placeholder="In-game name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Team OVR</label>
                  <input 
                    required
                    type="number"
                    value={formData.teamOvr}
                    onChange={(e) => setFormData({...formData, teamOvr: e.target.value})}
                    placeholder="90"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Goalkeeper Name</label>
                  <input 
                    required
                    type="text"
                    value={formData.goalkeeper}
                    onChange={(e) => setFormData({...formData, goalkeeper: e.target.value})}
                    placeholder="Enter Goalkeeper Name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Play Time / Experience</label>
                  <input 
                    required
                    type="text"
                    value={formData.experience}
                    onChange={(e) => setFormData({...formData, experience: e.target.value})}
                    placeholder="e.g. 2 years, since FIFA 22"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all text-sm"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Team Logo / Photo (Optional, under 5MB)</label>
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
                      className="flex items-center justify-center gap-3 w-full bg-white/5 border border-dashed border-white/20 rounded-xl p-8 cursor-pointer hover:bg-white/10 hover:border-blue-500/50 transition-all group"
                    >
                      {formData.logoUrl ? (
                        <div className="flex flex-col items-center gap-2">
                          <img src={formData.logoUrl} alt="Preview" className="w-16 h-16 rounded-full object-cover border-2 border-blue-500 shadow-lg" />
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Photo Selected</span>
                        </div>
                      ) : (
                        <>
                          <div className="p-3 bg-white/5 rounded-full group-hover:bg-blue-600/20 group-hover:text-blue-400 transition-all">
                            {isCompressing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold text-white">Click to Upload Photo</p>
                            <p className="text-[10px] text-white/30 uppercase font-black">PNG, JPG up to 5MB</p>
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
                    className="w-full py-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl font-black uppercase text-xs tracking-[0.3em] transition-all shadow-xl shadow-blue-600/20"
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
    isEditingMode,
    setIsEditingMode,
    matchLabels,
    updateMatchLabel,
    matchesByDay,
    handleAnalyzeQualification,
    handleUpdateConfig,
    setAdminEditingRegistration,
    teams
  }: { 
    onClose: () => void, 
    isAdmin: boolean,
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
    isEditingMode: boolean,
    setIsEditingMode: (mode: boolean) => void,
    matchLabels: Record<string, string>,
    updateMatchLabel: (date: string, status: string) => Promise<void>,
    matchesByDay: Record<string, Match[]>,
    handleAnalyzeQualification: () => Promise<void>,
    handleUpdateConfig: (config: Config) => Promise<void>,
    setAdminEditingRegistration: (reg: Registration | null) => void,
    teams: Team[]
  }) => {
    const [activeTab, setActiveTab] = useState<'bracket' | 'registrations' | 'label' | 'visibility' | 'ai' | 'reports' | 'achievements' | 'backup'>('bracket');

    const [downloadingRegistration, setDownloadingRegistration] = useState<Registration | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);

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
      <svg viewBox="0 0 100 100" width="100%" height="100%" className="bg-white p-2 rounded-xl text-black shadow-lg">
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
        const q = query(collection(db, 'reports'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const reportsList = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
          } as MatchReport));
          setReports(reportsList);
          setIsReportsLoading(false);
        });
        return () => unsubscribe();
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
        const response = await fetch('/api/test-ai');
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

      return (
        <div ref={setNodeRef} style={style} className={`flex items-center justify-between p-4 bg-white/5 rounded-xl border border-[${isHidden ? 'red-500/50' : 'white/10'}] ${isDragging ? 'shadow-2xl bg-blue-600/20 border-blue-500/50' : ''} ${isHidden ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-4">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-2 hover:bg-white/5 rounded-lg transition-colors">
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
            <span className="text-sm font-bold text-white uppercase italic">{date} {isHidden && '(Hidden)'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => toggleDateVisibility(date)}
              className={`p-2 rounded-lg font-black text-xs uppercase transition-colors ${isHidden ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'}`}
            >
              {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <select 
              value={matchLabels[date] || 'scheduled'}
              onChange={(e) => updateMatchLabel(date, e.target.value)}
              className="bg-black/40 border border-white/10 rounded-lg p-2 text-white text-xs font-black uppercase tracking-widest outline-none focus:border-blue-500"
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
    const firstInputRef = React.useRef<HTMLInputElement>(null);

    const startEditingMatch = (match: BracketMatch) => {
      setEditingMatchId(match.id);
      setEditHomeName(match.homeTeamName || '');
      setEditAwayName(match.awayTeamName || '');
      setEditRound(match.round || '');
      setEditHomeScore(match.homeScore || 0);
      setEditAwayScore(match.awayScore || 0);
      setTimeout(() => firstInputRef.current?.focus(), 100);
    };

    const saveMatch = async () => {
      if (!editingMatchId) return;
      
      const resolveName = (idOrName: string) => {
        const team = teams.find(t => t.id === idOrName);
        return team ? (team.fullName || team.fcName || team.name) : idOrName;
      };

      await handleSaveBracket({
        id: editingMatchId,
        homeTeamName: resolveName(editHomeName),
        awayTeamName: resolveName(editAwayName),
        round: editRound,
        homeScore: editHomeScore,
        awayScore: editAwayScore
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

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-[#00000a] text-white flex flex-col font-sans"
      >
        <div className="flex flex-col md:flex-row items-center justify-between px-4 md:px-8 py-4 md:py-6 border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-20 gap-4">
          <div className="flex items-center gap-3 md:gap-6 w-full md:w-auto overflow-x-auto hide-scrollbar">
            <button 
              onClick={onClose}
              className="group flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 shrink-0"
            >
              <ArrowLeft className="w-4 md:w-5 h-4 md:h-5 text-blue-400 group-hover:-translate-x-1 transition-transform" />
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Back</span>
            </button>
            <div className="h-6 md:h-8 w-[1px] bg-white/10 shrink-0" />
            <div className="min-w-0 text-left">
              <h2 className="text-lg md:text-2xl font-display font-black italic uppercase leading-none text-white tracking-tight truncate">Admin Terminal</h2>
              <p className="text-blue-400/40 text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] mt-0.5 md:mt-1 truncate max-w-[200px]">
                {user?.email || 'System'} | {isAdmin ? 'AUTHORIZED' : 'ACCESS DENIED'}
              </p>
            </div>
          </div>

          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 w-full md:w-auto overflow-x-auto hide-scrollbar">
            <button 
              onClick={() => setIsEditingMode(!isEditingMode)}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-nowrap tracking-widest transition-all min-w-fit ${isEditingMode ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-green-600 text-white shadow-lg shadow-green-600/20'}`}
            >
              {isEditingMode ? 'Editing Enabled' : 'Editing Disabled'}
            </button>
            <div className="w-px bg-white/10 mx-2 flex-shrink-0" />
            <button 
              onClick={() => setActiveTab('bracket')}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-nowrap tracking-widest transition-all min-w-fit ${activeTab === 'bracket' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Bracket
            </button>
            <button 
              onClick={() => setActiveTab('registrations')}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-nowrap tracking-widest transition-all min-w-fit ${activeTab === 'registrations' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Applicants
            </button>
            <button 
              onClick={() => setActiveTab('label')}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-nowrap tracking-widest transition-all min-w-fit ${activeTab === 'label' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Label
            </button>
            <button 
              onClick={() => setActiveTab('visibility')}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-nowrap tracking-widest transition-all min-w-fit ${activeTab === 'visibility' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Visibility
            </button>
            <button 
              onClick={() => setActiveTab('reports')}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-nowrap tracking-widest transition-all min-w-fit ${activeTab === 'reports' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Evidence
            </button>
            <button 
              onClick={() => setActiveTab('achievements')}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-nowrap tracking-widest transition-all min-w-fit ${activeTab === 'achievements' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Trophies
            </button>
            <button 
              onClick={() => setActiveTab('ai')}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-nowrap tracking-widest transition-all min-w-fit ${activeTab === 'ai' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-white/40 hover:text-white/60'}`}
            >
              AI Settings
            </button>
            <button 
              onClick={() => setActiveTab('backup')}
              className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-nowrap tracking-widest transition-all min-w-fit ${activeTab === 'backup' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-white/40 hover:text-white/60'}`}
            >
              Backup
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar p-4 md:p-8 lg:p-12">
          <div className="max-w-6xl mx-auto w-full">
            <div className="mb-12 bg-blue-600/5 border border-blue-500/20 rounded-3xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                  <Star className="w-5 h-5 text-blue-400 animate-pulse" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-display font-black italic uppercase text-white">AI Tournament Assistant</h3>
                  <p className="text-blue-400/40 text-[9px] uppercase tracking-widest">
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
                  className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm outline-none focus:border-blue-500 transition-all"
                />
                <button 
                  disabled={isAiLoading}
                  className="px-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-blue-600/20 flex items-center gap-3 shrink-0"
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
                    <h3 className="text-xl font-display font-black italic uppercase text-blue-400 mb-6 flex items-center gap-3">
                      <Layout className="w-6 h-6" />
                      Live Bracket Editor
                    </h3>
                    <div className="space-y-4">
                      {['Qualifier Round', 'Quarter-Finals', 'Semi-Finals', 'Grand Final', '3rd Place Match'].map(round => {
                        const roundMatches = bracket.filter(m => m.round === round);
                        if (roundMatches.length === 0) return null;
                        return (
                          <div key={round} className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 border-b border-white/5 pb-2">{round}</h4>
                            <div className="grid grid-cols-1 gap-3">
                              {roundMatches.map(match => (
                                <div key={match.id} className={`p-4 md:p-5 rounded-2xl border transition-all ${editingMatchId === match.id ? 'bg-blue-600/10 border-blue-500' : 'bg-white/5 border-white/5 hover:border-white/20'}`}>
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
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                          <label className="text-[9px] font-black uppercase text-white/40">Home Score</label>
                                          <input type="number" value={editHomeScore} onChange={e => setEditHomeScore(Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none" />
                                        </div>
                                        <div className="space-y-2">
                                          <label className="text-[9px] font-black uppercase text-white/40">Away Score</label>
                                          <input type="number" value={editAwayScore} onChange={e => setEditAwayScore(Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none" />
                                        </div>
                                        <div className="flex items-end gap-2">
                                          <button onClick={saveMatch} className="h-11 flex-1 bg-green-500 text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-green-400 transition-all">Save</button>
                                          <button onClick={() => setEditingMatchId(null)} className="h-11 px-4 bg-white/10 text-white font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-white/20 transition-all">Cancel</button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between group">
                                      <div className="flex-1 space-y-2">
                                        <div className="flex justify-between items-center bg-black/20 p-2 px-3 rounded-lg">
                                          <span className="text-xs font-bold text-white/90">{match.homeTeamName}</span>
                                          <span className="text-lg font-display font-black italic text-blue-400">{match.homeScore}</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-black/20 p-2 px-3 rounded-lg">
                                          <span className="text-xs font-bold text-white/90">{match.awayTeamName}</span>
                                          <span className="text-lg font-display font-black italic text-blue-400">{match.awayScore}</span>
                                        </div>
                                      </div>
                                      <button onClick={() => startEditingMatch(match)} className="ml-4 md:ml-6 p-3 md:p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-blue-400 hover:text-white transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100">
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
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-8 sticky top-0">
                    <h3 className="text-xl font-display font-black italic uppercase text-blue-400 mb-6 flex items-center gap-3">
                      <Settings className="w-6 h-6" />
                      Global Config
                    </h3>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-6 bg-white/5 border border-white/5 rounded-2xl group">
                        <div>
                          <p className="text-sm font-bold text-white mb-1">Registration Portal</p>
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Enable or disable user applications</p>
                        </div>
                        <button 
                          onClick={handleToggleRegistration}
                          disabled={isSavingAdmin}
                          className={`w-14 h-8 rounded-full flex items-center p-1 transition-all ${config.registrationEnabled ? 'bg-green-500' : 'bg-white/10'}`}
                        >
                          <div className={`w-6 h-6 rounded-full bg-white shadow-md transition-all ${config.registrationEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      <div className="p-6 bg-blue-600/10 border border-blue-500/20 rounded-2xl">
                        <div className="flex items-center gap-3 mb-3">
                          <Users className="w-5 h-5 text-blue-400" />
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400">Total Applicants</h4>
                        </div>
                        <p className="text-5xl font-display font-black italic text-white">{registrations.length}</p>
                      </div>
                    <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
                      <div className="flex items-center gap-3 mb-4 text-red-400">
                        <Trash2 className="w-5 h-5" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest">Danger Zone</h4>
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
                          className={`relative px-4 py-3 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${confirmReset === 'matches' ? 'bg-red-600 border-red-600 text-white animate-pulse' : 'bg-red-600/10 border-red-500/20 text-red-500 hover:bg-red-600 hover:text-white'}`}
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
                          className={`relative px-4 py-3 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${confirmReset === 'bracket' ? 'bg-red-600 border-red-600 text-white animate-pulse' : 'bg-red-600/10 border-red-500/20 text-red-500 hover:bg-red-600 hover:text-white'}`}
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
                          className={`relative px-4 py-3 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${confirmReset === 'registrations' ? 'bg-red-600 border-red-600 text-white animate-pulse' : 'bg-red-600/10 border-red-500/20 text-red-500 hover:bg-red-600 hover:text-white'}`}
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
                          className={`relative px-4 py-3 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${confirmReset === 'table' ? 'bg-orange-600 border-orange-600 text-white animate-pulse' : 'bg-orange-600/10 border-orange-500/20 text-orange-500 hover:bg-orange-600 hover:text-white'}`}
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
                          className={`relative px-4 py-3 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${confirmReset === 'stats' ? 'bg-blue-600 border-blue-600 text-white animate-pulse' : 'bg-blue-600/10 border-blue-500/20 text-blue-400 hover:bg-blue-600 hover:text-white'}`}
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
                          className={`relative px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg ${confirmReset === 'all' ? 'bg-red-900 text-white animate-pulse scale-105' : 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/20'}`}
                        >
                          {isResetting && confirmReset === 'all' ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : (confirmReset === 'all' ? 'Confirm TOTAL PURGE' : 'Purge All Data')}
                        </button>
                      </div>
                      {confirmReset && (
                        <p className="mt-4 text-[9px] font-black uppercase text-red-400/60 text-center animate-bounce">Click again to confirm action</p>
                      )}
                    </div>
                    
                    <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-6">
                      <div className="flex items-center gap-3 mb-4 text-yellow-500">
                        <BarChart2 className="w-5 h-5" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest">Table Analysis</h4>
                      </div>
                      <button 
                        onClick={handleAnalyzeQualification}
                        className="w-full px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-yellow-500/20 transition-all flex items-center justify-center gap-2"
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
                <div className="flex flex-col sm:flex-row items-center justify-between bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 gap-4">
                   <div className="text-center sm:text-left">
                    <h3 className="text-xl md:text-2xl font-display font-black italic uppercase text-white tracking-tight">Registered Users</h3>
                    <p className="text-blue-400/40 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mt-1">Review applicant field data</p>
                   </div>
                   <div className="px-4 md:px-6 py-2 md:py-3 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center gap-3">
                      <span className="text-[9px] md:text-[10px] font-black text-blue-400 uppercase tracking-widest">Active applicants:</span>
                      <span className="text-xl md:text-2xl font-display font-black italic text-white">{registrations.length}</span>
                   </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {registrations.length === 0 ? (
                    <div className="p-20 text-center bg-white/5 border border-white/5 rounded-3xl">
                      <Users className="w-16 h-16 text-white/10 mx-auto mb-4" />
                      <p className="text-white/40 font-bold">No registrations yet.</p>
                    </div>
                  ) : (
                    registrations.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)).map(reg => (
                      <div key={reg.id} className="bg-white/5 border border-white/10 rounded-2xl md:rounded-3xl p-4 md:p-6 hover:bg-white/10 transition-all group">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 md:gap-6 items-center">
                          <div className="flex items-center gap-2">
                             <div className="mr-2">
                               <p className="text-[8px] font-black uppercase tracking-widest text-blue-400 mb-0.5">Status</p>
                               <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                                 reg.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                                 reg.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                 'bg-yellow-500/20 text-yellow-500'
                               }`}>{reg.status}</span>
                             </div>
                             <div className="flex flex-col gap-1">
                               <button 
                                 onClick={() => handleApproveRegistration(reg.id)}
                                 className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-black transition-all rounded-xl"
                                 title="Approve"
                               >
                                 <Check className="w-4 h-4" />
                               </button>
                               <button 
                                 onClick={() => handleRejectRegistration(reg.id)}
                                 className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500 transition-all rounded-xl"
                                 title="Reject"
                               >
                                 <X className="w-4 h-4" />
                               </button>
                               <button 
                                 onClick={() => {
                                   if (confirmDeleteId === reg.id) {
                                     handleDeleteRegistration(reg.id);
                                     setConfirmDeleteId(null);
                                   } else {
                                     setConfirmDeleteId(reg.id);
                                   }
                                 }}
                                 className={`p-2 transition-all rounded-xl ${confirmDeleteId === reg.id ? 'bg-red-600 text-white animate-pulse' : 'bg-white/5 text-white/40 hover:text-red-500'}`}
                                 title={confirmDeleteId === reg.id ? "Click again to confirm" : "Delete Forever"}
                               >
                                 <Trash2 className="w-4 h-4" />
                               </button>
                               <button 
                                 onClick={() => setAdminEditingRegistration(reg)}
                                 className="p-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all rounded-xl"
                                 title="Edit Registration"
                               >
                                 <Edit3 className="w-4 h-4" />
                               </button>
                               <button 
                                 onClick={() => setDownloadingRegistration(reg)}
                                 className="p-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500 hover:text-white transition-all rounded-xl"
                                 title="Download ID Card"
                               >
                                 <IdCard className="w-4 h-4" />
                               </button>
                             </div>
                          </div>
                          <div className="flex justify-center lg:justify-start">
                             <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 overflow-hidden shadow-lg group-hover:scale-105 transition-transform flex items-center justify-center">
                               {reg.logoUrl ? (
                                 <img src={reg.logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                               ) : (
                                 <Plus className="w-8 h-8 text-white/10" />
                               )}
                             </div>
                          </div>
                          <div>
                             <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-blue-400 mb-1">FC Name</p>
                             <p className="text-xs md:text-sm font-bold text-white">{reg.fcName}</p>
                          </div>
                          <div>
                             <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-blue-400 mb-1">Age</p>
                             <p className="text-xs md:text-sm font-bold text-white">{reg.age} years</p>
                          </div>
                          <div>
                             <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-blue-400 mb-1">Team OVR</p>
                             <div className="flex items-center gap-2">
                               <span className="text-lg md:text-xl font-display font-black italic text-yellow-500">{reg.teamOvr}</span>
                               <span className="text-[8px] md:text-[10px] font-black text-white/20 uppercase tracking-widest">Rating</span>
                             </div>
                          </div>
                          <div>
                             <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-blue-400 mb-1">Experience</p>
                             <p className="text-[9px] md:text-[10px] font-black text-white/60 uppercase">{reg.experience}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'visibility' && (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                <h3 className="text-xl font-display font-black italic uppercase text-white mb-6">Tab Visibility Management</h3>
                <div className="space-y-4">
                  {['Fixtures', 'Table', 'Bracket', 'Registration', 'Stats', 'News', 'Campaign'].map(tab => (
                    <div key={tab} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                      <span className="text-sm font-bold text-white">{tab}</span>
                      <button 
                        onClick={() => {
                          const newTabs = { ...(config.tabVisibility || {}), [tab.toLowerCase()]: !(config.tabVisibility?.[tab.toLowerCase()] ?? true) };
                          handleUpdateConfig({ ...config, tabVisibility: newTabs });
                        }}
                        className={`px-4 py-2 rounded-lg font-black text-xs uppercase ${!(config.tabVisibility?.[tab.toLowerCase()] ?? true) ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}
                      >
                        {!(config.tabVisibility?.[tab.toLowerCase()] ?? true) ? 'Disabled' : 'Enabled'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {activeTab === 'label' && (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                <h3 className="text-xl font-display font-black italic uppercase text-white mb-6">Date Label Management (Drag to Reorder)</h3>
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

            {activeTab === 'reports' && (
              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                  <div className="text-left w-full">
                    <h3 className="text-xl md:text-2xl font-display font-black italic uppercase text-white tracking-tight">Evidence Dashboard</h3>
                    <p className="text-blue-400/60 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mt-1">Review AI analysis and match verification screenshots</p>
                  </div>
                </div>

                {isReportsLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Loading reports from cloud...</p>
                  </div>
                ) : reports.length === 0 ? (
                  <div className="bg-white/5 border border-white/5 rounded-3xl p-12 text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10">
                      <BarChart2 className="w-8 h-8 text-white/20" />
                    </div>
                    <h4 className="text-lg font-display font-black italic uppercase text-white mb-2">No Reports Found</h4>
                    <p className="text-xs text-white/40 font-bold uppercase tracking-widest max-w-[240px] mx-auto leading-relaxed">Evidence will appear here when users submit match results via AI analysis.</p>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {reports.map((report) => (
                      <div key={report.id} className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden group hover:border-blue-500/30 transition-all">
                        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-white/10">
                          <div className="lg:w-1/3 aspect-[4/3] lg:aspect-auto bg-black relative flex items-center justify-center overflow-hidden">
                            {report.imageUrl ? (
                              <img src={`data:${report.mimeType || 'image/png'};base64,${report.imageUrl}`} alt="Evidence" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                            ) : (
                              <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">No Image Available</span>
                            )}
                            <div className="absolute top-4 left-4">
                              <span className="px-3 py-1.5 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-xl shadow-blue-900/40 border border-blue-400/20">Screenshot</span>
                            </div>
                          </div>
                          <div className="flex-1 p-6 md:p-8 space-y-6">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <div className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[8px] font-black text-blue-400 uppercase tracking-tighter">Reporter</div>
                                  <span className="text-[10px] font-black text-white uppercase tracking-widest">{report.reporterName || (report.matchData && report.matchData.reporterName) || 'Unknown Source'}</span>
                                </div>
                                <h4 className="text-lg font-display font-black italic uppercase text-white tracking-tight">
                                  {report.matchData.homeTeam} {report.matchData.homeScore} - {report.matchData.awayScore} {report.matchData.awayTeam}
                                </h4>
                                <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mt-1">
                                  {report.timestamp ? formatTimestamp(report.timestamp) : 'Time Pending...'}
                                </div>
                              </div>
                              <button 
                                onClick={async () => {
                                  if (window.confirm("Are you sure you want to delete this report?")) {
                                    await deleteDoc(doc(db, 'reports', report.id));
                                  }
                                }}
                                className="p-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20"
                                title="Delete Report"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                                <span className="block text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">MOTM</span>
                                <span className="text-[10px] font-black text-yellow-400 uppercase truncate block font-sans">{report.matchData.manOfTheMatch || 'N/A'}</span>
                              </div>
                              <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                                <span className="block text-[8px] font-black text-white/30 uppercase tracking-widest mb-1">Status</span>
                                <span className="text-[10px] font-black text-green-400 uppercase block tracking-widest">Analyzed</span>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest block font-sans">Goal Scorers (Extracted)</span>
                              <div className="bg-black/20 rounded-2xl p-4 border border-white/5 space-y-2">
                                {report.matchData.scorers && report.matchData.scorers.length > 0 ? (
                                  report.matchData.scorers.map((s: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                                      <span className="text-white/80 shrink-0">{s.name}</span>
                                      <div className="flex-1 border-b border-white/5 mx-2 border-dotted" />
                                      <span className="text-blue-400">
                                        {s.goals} G {s.time && `(${s.time})`}
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-[9px] font-black text-white/20 uppercase tracking-widest block text-center italic">No scorers detected</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'achievements' && (
              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
                 <div className="text-left w-full mb-8">
                   <h3 className="text-xl md:text-2xl font-display font-black italic uppercase text-white tracking-tight">Manual Achievement Award</h3>
                   <p className="text-blue-400/60 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mt-1">Select user and achievement to grant directly</p>
                 </div>
                 
                 <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 opacity-60 mb-2 block">Select Registered Player</label>
                        <select 
                          value={awardUserId}
                          onChange={e => setAwardUserId(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 font-sans outline-none disabled:opacity-50"
                        >
                          <option value="">-- Choose User --</option>
                          {registrations.filter(r => r.status === 'approved' && r.userId).map(r => (
                             <option key={r.id} value={r.userId}>{r.fcName} ({r.name})</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 opacity-60 mb-2 block">Select Trophy / Achievement</label>
                        <select 
                          value={awardAchvId}
                          onChange={e => setAwardAchvId(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 font-sans outline-none disabled:opacity-50"
                        >
                          <option value="">-- Choose Achievement --</option>
                          {(ACHIEVEMENTS || []).map(a => (
                             <option key={a.id} value={a.id}>{a.icon || '🏆'} {a.title} ({a.category})</option>
                          ))}
                        </select>
                      </div>

                      <button 
                        onClick={handleAwardSubmit}
                        disabled={isAwarding || !awardAchvId || !awardUserId}
                        className="w-full py-4 bg-yellow-600/20 text-yellow-400 border border-yellow-500/30 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-yellow-600/30 transition-all shadow-xl shadow-yellow-600/10 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                         {isAwarding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                         Award Achievement
                      </button>
                    </div>
                 </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-display font-black italic uppercase text-white">AI Settings</h3>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={handleTestAi}
                      disabled={isTestingAi}
                      className="flex items-center gap-2 px-6 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all font-sans"
                    >
                      {isTestingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Test
                    </button>
                    <button 
                      onClick={handleSaveAiSettings}
                      disabled={isSavingAdmin}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all font-sans"
                    >
                      {isSavingAdmin ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Save
                    </button>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 opacity-60">Gemini API Key</label>
                    <div className="relative">
                      <input 
                        type="password"
                        value={localApiKey}
                        onChange={(e) => setLocalApiKey(e.target.value)}
                        placeholder="Paste your Gemini API Key here..."
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm outline-none focus:border-blue-500 transition-all font-mono"
                      />
                      <Shield className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    </div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-white/20 px-1">If blank, the system default key will be used.</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 opacity-60">Gemini Model</label>
                    <div className="relative">
                      <select 
                        value={localModel || 'gemini-3-flash-preview'}
                        onChange={(e) => setLocalModel(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer font-sans"
                      >
                        <option value="gemini-1.5-flash">gemini-1.5-flash (Fast & Balanced)</option>
                        <option value="gemini-pro-latest">gemini-pro-latest (Smartest)</option>
                        <option value="gemini-1.5-pro-latest">gemini-1.5-pro-latest (Pro)</option>
                        <option value="gemini-3-flash-preview">gemini-3-flash-preview (Balanced / Default)</option>
                        <option value="gemini-3.1-flash-lite-preview">gemini-3.1-flash-lite-preview (Fastest / Lightweight)</option>
                        <option value="gemini-flash-latest">gemini-flash-latest (Stable Flash)</option>
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                         ▼
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-start gap-4">
                    <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">Configuration Status</h4>
                      <p className="text-[10px] font-black uppercase text-white/40 leading-relaxed font-sans">
                        Changes are saved to Firestore and take effect immediately for all subsequent AI requests (Match Analysis & Admin Commands).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'backup' && (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-display font-black italic uppercase text-white">Database Backup & Recovery</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Export */}
                  <div className="bg-black/20 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 w-32 h-32 bg-blue-600/10 rounded-bl-full -z-10 group-hover:bg-blue-600/20 transition-all" />
                    <Download className="w-8 h-8 text-blue-400 mb-4" />
                    <h4 className="font-black text-white uppercase text-sm mb-2">Export Data Backup</h4>
                    <p className="text-white/40 text-xs leading-relaxed mb-6">
                      Download a JSON backup of everything: registrations, bracket matches, historical matches, match labels, stats, users, and reports. Do this regularly.
                    </p>
                    <button 
                      onClick={handleExportBackup}
                      className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] font-black tracking-[0.2em] uppercase transition-all text-white flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Save Complete Backup
                    </button>
                  </div>

                  {/* Import */}
                  <div className="bg-black/20 border border-red-500/20 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 w-32 h-32 bg-red-600/5 rounded-bl-full -z-10 group-hover:bg-red-600/10 transition-all" />
                    <Upload className="w-8 h-8 text-red-400 mb-4" />
                    <h4 className="font-black text-white uppercase text-sm mb-2">Restore Backup</h4>
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
                      <div className="w-full py-4 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-xl text-[10px] font-black tracking-[0.2em] uppercase transition-all text-red-100 flex items-center justify-center gap-2">
                        {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        Restore JSON Backup
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
          </div>
        </div>
        {downloadingRegistration && (
          <div className="fixed top-0 left-[-9999px] pointer-events-none z-[-1] opacity-0 overflow-hidden">
            <div 
              ref={cardRef}
              className="w-[600px] h-[900px] bg-gradient-to-br from-[#0a0a1a] via-[#1a1a3a] to-[#0a0a1a] border-[8px] border-blue-500 rounded-[3rem] p-10 flex flex-col relative overflow-hidden backdrop-blur-3xl shadow-[0_0_100px_rgba(37,99,235,0.2)]"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              <div className="absolute top-0 right-0 p-32 w-[600px] h-[600px] bg-blue-600/30 rounded-full blur-[100px] -z-10" />
              <div className="absolute bottom-0 left-0 p-32 w-[600px] h-[600px] bg-purple-600/30 rounded-full blur-[100px] -z-10" />
              
              <div className="flex justify-between items-start mb-12">
                 <div>
                   <h1 className="text-5xl font-black italic uppercase text-white tracking-tighter shadow-sm w-[400px]">UXIT TOURNAMENT</h1>
                   <p className="text-2xl font-bold uppercase text-blue-400 tracking-widest mt-2">{downloadingRegistration.fcName}</p>
                 </div>
                 <div className="w-24 h-24 bg-white p-2 rounded-2xl text-black relative flex-shrink-0 shadow-lg">
                   <div className="absolute inset-0 p-2">
                      <DummyQRCode />
                   </div>
                 </div>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center -mt-8">
                 <div className="w-64 h-64 rounded-full border-[10px] border-white/20 overflow-hidden shadow-[0_0_50px_rgba(37,99,235,0.4)] mb-8 flex items-center justify-center bg-[#0a0a1a]">
                   {downloadingRegistration.logoUrl ? (
                      <img src={downloadingRegistration.logoUrl} alt="Logo" className="w-full h-full object-cover" crossOrigin="anonymous"/>
                   ) : (
                      <span className="text-8xl font-black text-white/20">{downloadingRegistration.name[0]}</span>
                   )}
                 </div>
                 <h2 className="text-5xl font-black text-white uppercase text-center bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 tracking-tight">{downloadingRegistration.name}</h2>
                 <p className="text-2xl text-white/60 font-black uppercase tracking-widest mt-4">FC UID: {downloadingRegistration.fcUid}</p>
              </div>

              <div className="grid grid-cols-2 gap-6 bg-black/40 backdrop-blur-2xl rounded-[2.5rem] p-8 border-2 border-white/10 relative z-10 shadow-2xl mt-8">
                 <div className="text-center">
                   <p className="text-sm font-black text-blue-400 uppercase tracking-widest mb-1">Team OVR</p>
                   <p className="text-5xl font-black text-white drop-shadow-md">{downloadingRegistration.teamOvr}</p>
                 </div>
                 <div className="text-center border-l-2 border-white/10">
                   <p className="text-sm font-black text-blue-400 uppercase tracking-widest mb-1">Age</p>
                   <p className="text-5xl font-black text-white drop-shadow-md">{downloadingRegistration.age}</p>
                 </div>
                 <div className="text-center md:col-span-2 border-t-2 border-white/10 pt-6 mt-2">
                   <p className="text-sm font-black text-blue-400 uppercase tracking-widest mb-1">Goalkeeper</p>
                   <p className="text-2xl font-bold text-white capitalize drop-shadow-md">{downloadingRegistration.goalkeeper || 'N/A'}</p>
                 </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  const AchievementNotification = ({ achievements, onClose }: { achievements: string[], onClose: () => void }) => {
  useEffect(() => {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3");
    audio.volume = 0.5;
    audio.play().catch(e => console.log("Audio play blocked", e));
    
    // Auto-dismiss after 5 seconds
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-20 right-4 z-[100] flex flex-col gap-3">
      {achievements.map((id, index) => (
        <motion.div
          key={`${id}-${index}`}
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          className="w-80 bg-[#0a0a2a] border-2 border-yellow-500/50 p-4 rounded-xl shadow-[0_0_20px_rgba(234,179,8,0.2)] flex items-center gap-4 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 to-transparent pointer-events-none" />
          <div className="text-3xl">🏆</div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Unlocked</div>
            <div className="text-sm font-bold text-white truncate">{ACHIEVEMENTS.find(a => a.id === id)?.title}</div>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      ))}
    </div>
  );
};

const TeamNameWithCopy = ({ team, size = 'lg', reverse = false, showCopy = true, copiedId, copyToClipboard }: { team: Team | undefined, size?: 'sm' | 'lg', reverse?: boolean, showCopy?: boolean, copiedId: string | null, copyToClipboard: (uid: string) => void }) => {
    if (!team) return (
      <div className={`flex items-center ${reverse ? 'flex-row-reverse' : ''} min-w-0 opacity-20`}>
        <div className={`${size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'} rounded bg-white/10 flex items-center justify-center text-[10px] font-black uppercase text-white/40 shrink-0 ${reverse ? 'ml-2' : 'mr-2'}`}>
          ?
        </div>
        <span className={`font-display font-black tracking-tight whitespace-nowrap uppercase italic truncate pr-1 ${
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
              className={`${size === 'lg' ? 'w-8 h-8 md:w-10 md:h-10' : 'w-6 h-6 md:w-8 md:h-8'} rounded-lg object-cover border border-white/10 shadow-lg ${reverse ? 'ml-2 md:ml-3' : 'mr-2 md:mr-3'}`}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className={`${size === 'lg' ? 'w-8 h-8 md:w-10 md:h-10' : 'w-6 h-6 md:w-8 md:h-8'} rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-display font-black italic uppercase ${size === 'lg' ? 'text-sm md:text-lg' : 'text-[10px] md:text-xs'} ${reverse ? 'ml-2 md:ml-3' : 'mr-2 md:mr-3'}`}>
              {team.name[0]}
            </div>
          )}
          <span className={`font-display font-black tracking-tight whitespace-nowrap uppercase italic truncate pr-1 ${
            size === 'lg' ? 'text-xs md:text-lg' : 'text-xs md:text-sm'
          }`}>{team.name}</span>
        </div>
        {showCopy && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(team.uid);
            }}
            className={`${size === 'lg' ? 'px-2 py-1 md:px-3 md:py-1.5' : 'px-1.5 py-0.5 md:px-2 md:py-1'} rounded-md bg-white/5 hover:bg-white/10 text-blue-400/80 hover:text-blue-400 flex items-center gap-1.5 transition-all shrink-0 border border-white/5`}
            title="Click to copy UID"
          >
            {copiedId === team.uid ? (
              <Check className="w-2.5 h-2.5 md:w-3 md:h-3 text-green-400" />
            ) : (
              <Copy className="w-2.5 h-2.5 md:w-3 md:h-3" />
            )}
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-wider">UID</span>
          </button>
        )}
      </div>
    );
  };

  // Main app component follows...

const fetchWithCache = async (cacheKey: string, queryRef: any, isDoc: boolean = false, ttlMs: number = 2000) => {
  const cached = localStorage.getItem(cacheKey);
  const cachedTimeStr = localStorage.getItem(`${cacheKey}_time`);
  
  if (cached && cachedTimeStr) {
    if (Date.now() - Number(cachedTimeStr) < ttlMs) {
      return JSON.parse(cached);
    }
  }
  
  try {
    let data;
    if (isDoc) {
      const snap = await getDoc(queryRef);
      if (snap.exists()) data = { id: snap.id, ...(snap.data() as any) };
      else data = null;
    } else {
      const snap = await getDocs(queryRef);
      data = snap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() as any) }));
    }
    
    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
      localStorage.setItem(`${cacheKey}_time`, Date.now().toString());
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

const NewsFeed = ({ articles }: { articles: any[] }) => {
  if (!articles || articles.length === 0) return (
    <div className="p-8 text-center text-white/40 bg-white/5 rounded-3xl border border-white/10 uppercase tracking-widest font-black text-xs">
      No recent news
    </div>
  );

  const getCategoryColor = (category: string) => {
    switch(category) {
      case 'SPICY': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'BANTER': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'ANALYSIS': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'PREDICTION': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'MATCHDAY': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
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
        <Sparkles className="w-5 h-5 text-blue-400" />
        <h2 className="font-display font-black text-xl italic uppercase tracking-widest text-white">UXL News Network</h2>
      </div>
      <div className="flex overflow-x-auto pb-4 gap-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {articles.map((article: any) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={article.id} 
            className="flex-none w-80 md:w-96 bg-black/40 border border-white/10 rounded-2xl p-5 snap-start relative overflow-hidden group hover:bg-white/5 transition-colors"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-[100px] pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
            <div className="flex items-start justify-between mb-3 relative z-10">
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${getCategoryColor(article.category)} flex items-center gap-1.5`}>
                <span>{getCategoryIcon(article.category)}</span> {article.category}
              </span>
              <span className="text-[10px] uppercase font-black tracking-widest text-white/30">
                {article.created_at ? getTimeAgo(article.created_at) : 'Just now'}
              </span>
            </div>
            
            <h3 className="text-lg font-display font-black leading-tight text-white mb-2 relative z-10">{article.title}</h3>
            <p className="text-sm text-white/60 leading-relaxed font-medium relative z-10">{article.content}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [hasQuotaError, setHasQuotaError] = useState(false);

  useEffect(() => {
    const handleQuotaError = () => setHasQuotaError(true);
    window.addEventListener('quotaExceeded', handleQuotaError);
    return () => window.removeEventListener('quotaExceeded', handleQuotaError);
  }, []);
  const handleResetSingleMatch = async (matchId: string) => {
    if (!isAdmin) return;
    try {
      const matchRef = doc(db, 'matches', matchId);
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
      
      setDbMatches(prev => prev.map(m => m.id === matchId ? { ...m, ...resetData } as Match : m));
      try {
        localStorage.removeItem('cache_matches');
        const data = await fetchWithCache('cache_matches', collection(db, 'matches'), false, 0);
        setDbMatches(data);
      } catch(e) {}
      
      alert("Match reset back to scheduled status.");
    } catch (e) {
      console.error("Failed to reset match:", e);
      alert("Failed to reset match.");
    }
  };

  const [activeTab, setActiveTab] = useState<'fixtures' | 'table' | 'bracket' | 'registration' | 'stats' | 'campaign'>('fixtures');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  const [dbTeams, setDbTeams] = useState<Team[]>([]);
  const [dbMatches, setDbMatches] = useState<Match[]>([]);
  const [isAddMatchModalOpen, setIsAddMatchModalOpen] = useState(false);
  const [addMatchInitialData, setAddMatchInitialData] = useState<{ date: string, home: string, away: string }>({ date: '2026-05-TBD', home: '', away: '' });
  const [dbBracket, setDbBracket] = useState<BracketMatch[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [myRegistrationData, setMyRegistrationData] = useState<Registration | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [bracket, setBracket] = useState<BracketMatch[]>([]);
  const [isSubmittingImg, setIsSubmittingImg] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
  const [campaignTab, setCampaignTab] = useState<'stats' | 'history' | 'edit' | 'achievements'>('stats');
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [newsFeed, setNewsFeed] = useState<any[]>([]);

  useEffect(() => {
    const fetchNews = async () => {
      const { data } = await supabase
        .from('news')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setNewsFeed(data);
    };

    fetchNews();

    const channel = supabase
      .channel('public:news')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'news' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setNewsFeed(prev => [payload.new, ...prev].slice(0, 20));
        } else {
           fetchNews();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const teams = useMemo(() => {
    return [...dbTeams].sort((a, b) => {
      const nameA = a.fullName || a.fcName || a.name || '';
      const nameB = b.fullName || b.fcName || b.name || '';
      return nameA.localeCompare(nameB);
    });
  }, [dbTeams]);
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
  const stats = useMemo(() => calculateStats(teams, matches).slice(0, 10), [teams, matches]);
  const cleanSheets = useMemo(() => calculateCleanSheets(teams, matches).slice(0, 10), [teams, matches]);
  const motmLeaders = useMemo(() => calculateMotmLeaders(matches).slice(0, 5), [matches]);
  const upcomingRef = React.useRef<HTMLDivElement>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Firebase State
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<Config>({ registrationEnabled: false });
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);
  const [hasRegistered, setHasRegistered] = useState(false);
  const [matchLabels, setMatchLabels] = useState<Record<string, string>>({}); // date -> status
  const [qualificationStatus, setQualificationStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    let _mounted = true;
    const loadMatchLabels = async () => {
      try {
        const data = await fetchWithCache('cache_match_labels', collection(db, 'match_labels'), false, 300000);
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
        const docSnap = await fetchWithCache('cache_qual', doc(db, 'config', 'qualification'), true, 300000);
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
      const K = 8;
      const remainingMatches: Record<string, number> = {};
      
      INITIAL_TEAMS.forEach(t => {
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
         remainingMatches[t.id] = totalFixtures - played;
      });

      const currentStandings = calculateStandings(INITIAL_TEAMS, matches);
      // Sort to determine current ranks
      currentStandings.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);

      const statuses: Record<string, string> = {};
      
      currentStandings.forEach(t => {
         const currentPoints = t.points;
         const maxPoints = currentPoints + (remainingMatches[t.id] * 3);
         
         const otherTeamsMaxPoints = currentStandings
             .filter(other => other.id !== t.id)
             .map(other => other.points + (remainingMatches[other.id] * 3))
             .sort((a, b) => b - a);
             
         const eighthBestOther = otherTeamsMaxPoints[K - 1];
         
         if (currentPoints > eighthBestOther) {
             statuses[t.id] = 'Q';
         } else {
             const currentEighthPoints = currentStandings[K - 1]?.points || 0;
             if (maxPoints < currentEighthPoints) {
                 statuses[t.id] = 'E';
             }
         }
      });

      await setDoc(doc(db, 'config', 'qualification'), { statuses });
      await refreshCache('cache_qual');
    } catch (error) {
      console.error("Qualification analysis failed:", error);
    }
  };

  const updateMatchLabel = async (date: string, status: string) => {
    if (!isAdmin) return;
    await setDoc(doc(db, 'match_labels', date), { status }, { merge: true });
  };
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [adminEditingRegistration, setAdminEditingRegistration] = useState<Registration | null>(null);

  const handleAdminUpdateUserRegistration = async (reg: Registration) => {
    if (!isAdmin) return;
    setIsSubmittingRegistration(true);
    try {
      await setDoc(doc(db, 'registrations', reg.id), reg, { merge: true });
      const teamsData = await fetchWithCache('cache_teams', query(collection(db, 'registrations'), where('status', '==', 'approved')), false, 0);
      const teamsList: Team[] = teamsData.map((data: any) => ({
        id: data.id,
        name: data.fcName,
        shortName: data.fcName.substring(0, 3).toUpperCase(),
        fullName: data.name,
        fcName: data.fcName,
        ovr: data.teamOvr,
        uid: data.fcUid,
        logoUrl: data.logoUrl,
        goalkeeper: data.goalkeeper,
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
    const isEmailAdmin = user?.email === 'webblogger82@gmail.com';
    // Optional additional check if we ever want to trust the DB role prop
    return isEmailAdmin;
  }, [user]);

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
        const data = await fetchWithCache('cache_site_content', q, false, 300000);
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
      if (file.size > 2 * 1024 * 1024) return alert("Image must be under 2MB");
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          await updateSiteContent(id, base64, true);
        } catch (err) {
          console.error("Failed to upload image:", err);
          alert("Failed to update image");
        }
      };
      reader.readAsDataURL(file);
    };

    if (isAdmin && isEditingMode) {
      return (
        <div className={`relative group ${className}`}>
          <img src={src} alt={alt} referrerPolicy="no-referrer" className={`w-full h-full object-cover`} />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
             <label className="bg-blue-600 px-4 py-2 rounded-xl text-white text-xs font-black uppercase cursor-pointer hover:bg-blue-500 transition-colors">
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
            className="bg-white/20 border border-blue-500 rounded p-1 outline-none text-white text-xs font-sans"
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
            className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition-all scale-75 absolute -right-8 top-1/2 -translate-y-1/2 z-[100] shadow-xl border border-blue-400"
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
    if (!isAdmin) return;
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

  const handleSaveBracket = async (bracketMatch: BracketMatch) => {
    if (!isAdmin) return;
    setIsSavingBracket(true);
    try {
      await setDoc(doc(db, 'bracket', bracketMatch.id), bracketMatch, { merge: true });
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
    if (!isAdmin) return;
    
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
        const data = await fetchWithCache('cache_matches', collection(db, 'matches'), false, 0);
        setDbMatches(data);
      } else if (type === 'teams') {
        const teamsData = await fetchWithCache('cache_teams', query(collection(db, 'registrations'), where('status', '==', 'approved')), false, 0);
        const teamsList: Team[] = teamsData.map((data: any) => ({
          id: data.id, name: data.fcName, shortName: data.fcName.substring(0, 3).toUpperCase(),
          fullName: data.name, fcName: data.fcName, ovr: data.teamOvr, uid: data.fcUid,
          logoUrl: data.logoUrl, goalkeeper: data.goalkeeper, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: []
        }));
        setDbTeams(teamsList);
      } else if (type === 'bracket') {
         const q = query(collection(db, 'bracket'));
         const bracketDataMap: Record<string, BracketMatch> = {};
         const snapshot = await fetchWithCache('cache_bracket', q, false, 0);
         snapshot.forEach((data: any) => { bracketDataMap[data.id] = data; });
         setBracket(Object.values(bracketDataMap));
      } else if (type === 'config') {
         const data = await fetchWithCache('cache_config', doc(db, 'config', 'system'), true, 0);
         if (data) setConfig(data as Config);
      } else if (type === 'site_content') {
         const q = query(collection(db, 'site_content'));
         const data = await fetchWithCache('cache_site_content', q, false, 0);
         const content: Record<string, any> = {};
         data.forEach((docData: any) => { content[docData.id] = docData; });
         setSiteContent(content);
      } else if (type === 'cache_qual') {
         const docSnap = await fetchWithCache('cache_qual', doc(db, 'config', 'qualification'), true, 0);
         if (docSnap?.statuses) setQualificationStatus(docSnap.statuses);
      }
    } catch (e) {
      console.error("Error refreshing cache:", e);
    }
  };

  const handleUpdateMatch = async (match: Match) => {
    const isParticipant = user && (match.homeTeamId === user.uid || match.awayTeamId === user.uid);
    if (!isAdmin && !isParticipant) {
       alert("Permission denied. Only admins or match participants can update results.");
       return;
    }
    try {
      const cleanedData = cleanDocData(match);
      setDbMatches(prev => prev.map(m => m.id === match.id ? { ...m, ...cleanedData } as Match : m));
      await updateDoc(doc(db, 'matches', match.id), cleanedData);
      await refreshCache('matches');
      
      // Call achievements after match saved
      if (cleanedData.status === 'finished' && user?.uid) {
        const homeT = dbTeams.find(t => t.id === match.homeTeamId);
        const awayT = dbTeams.find(t => t.id === match.awayTeamId);
        try {
          await checkAndAwardAchievements(
            {
              homeScore: cleanedData.homeScore,
              awayScore: cleanedData.awayScore,
              homeScorers: cleanedData.homeScorers || [],
              awayScorers: cleanedData.awayScorers || [],
              homeTeam: homeT?.fcName || '', 
              awayTeam: awayT?.fcName || '',
            },
            user.uid,
            (user.uid === match.homeTeamId ? match.awayTeamId : match.homeTeamId) || ''
          );
        } catch (e) {
          console.warn('Achievement check failed:', e);
        }
      }

      if (cleanedData.status === 'finished') {
        fetch('/api/generate-news', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matchData: cleanedData,
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
    try {
      await deleteDoc(doc(db, 'registrations', id));
    } catch (error) {
      console.error("Delete failed:", error);
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
      const teamsData = await fetchWithCache('cache_teams', query(collection(db, 'registrations'), where('status', '==', 'approved')), false, 0);
      const teamsList: Team[] = teamsData.map((data: any) => ({
        id: data.id,
        name: data.fcName,
        shortName: data.fcName.substring(0, 3).toUpperCase(),
        fullName: data.name,
        fcName: data.fcName,
        ovr: data.teamOvr,
        uid: data.fcUid,
        logoUrl: data.logoUrl,
        goalkeeper: data.goalkeeper,
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
      if (!bSnap.empty) return; // Bracket already seeded! Do not overwrite.
      
      const batch = writeBatch(db);
      for (const match of INITIAL_BRACKET) {
        const docRef = doc(db, 'bracket', match.id);
        batch.set(docRef, match);
      }
      await batch.commit();
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

      const response = await fetch('/api/admin-ai-command', {
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

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.readAsDataURL(file);
    });
  };

  const checkAndAwardAchievements = async (matchData: any, currentUserId: string, opponentUserId: string) => {
    const { homeScore, awayScore, homeScorers, awayScorers, homeTeam, awayTeam } = matchData;
    const currentUserAchievements: string[] = [];
    const opponentAchievements: string[] = [];
    
    // Helper to get minutes
    const getMinutes = (scorers: any[]) => scorers?.flatMap(s => String(s.time || '').split(',').map(t => parseInt(t.trim().replace("'", ""))).filter(t => !isNaN(t))) || [];
    const homeMinutes = getMinutes(homeScorers);
    const awayMinutes = getMinutes(awayScorers);
    
    // Determine who is who
    const isCurrentUserHome = myRegistrationData?.fcName && homeTeam?.toLowerCase().includes(myRegistrationData.fcName.toLowerCase());
    const myScore = isCurrentUserHome ? homeScore : awayScore;
    const oppScore = isCurrentUserHome ? awayScore : homeScore;
    const myMinutes = isCurrentUserHome ? homeMinutes : awayMinutes;
    const oppMinutes = isCurrentUserHome ? awayMinutes : homeMinutes;

    if (myRegistrationData?.fcName) {
      if (myScore > oppScore) currentUserAchievements.push('first_blood');
      if (oppScore === 0 && myScore > 0) currentUserAchievements.push('clean_sheet_king');
      if (myScore === 0 && oppScore > 0) opponentAchievements.push('clean_sheet_king');
      if (myScore >= 5) opponentAchievements.push('goalkeepers_nightmare');
      if (oppScore >= 5) currentUserAchievements.push('goalkeepers_nightmare');
      if (myScore >= 3 && oppScore >= 3) {
        currentUserAchievements.push('thriller');
        opponentAchievements.push('thriller');
      }
      
      // Scorers logic
      const myScorers = isCurrentUserHome ? homeScorers : awayScorers;
      const oppScorers = isCurrentUserHome ? awayScorers : homeScorers;
      
      myScorers?.forEach((s: any) => {
        if (s.goals >= 3) currentUserAchievements.push('hat_trick_hero');
        if (s.goals >= 5) currentUserAchievements.push('sniper');
        if (s.playerName?.includes('(OG)')) currentUserAchievements.push('uno_reversed');
      });
      oppScorers?.forEach((s: any) => {
        if (s.playerName?.includes('(OG)')) opponentAchievements.push('uno_reversed');
      });

      if (oppMinutes?.some((m: number) => m >= 90)) {
        currentUserAchievements.push('heartbreak_90');
        currentUserAchievements.push('last_minute_hero');
      }
      if (myMinutes?.some((m: number) => m >= 90)) {
        opponentAchievements.push('heartbreak_90');
        opponentAchievements.push('last_minute_hero');
      }
      
      if (myMinutes?.includes(67)) currentUserAchievements.push('lover_67');
      if (myMinutes?.includes(69)) currentUserAchievements.push('lover_69');
      if (oppMinutes?.includes(67)) opponentAchievements.push('lover_67');
      if (oppMinutes?.includes(69)) opponentAchievements.push('lover_69');
    }

    const updateAchievements = async (userId: string, achievements: string[]) => {
      if (!userId) return;
      if (!isAdmin && userId !== currentUserId) return; // Non-admins cannot update other users
      
      try {
        const updates: any = {};
        achievements.forEach(id => {
          updates[`achievements.${id}`] = { unlockedAt: serverTimestamp(), seen: false };
        });
        await updateDoc(doc(db, 'users', userId), updates);
      } catch (e) {
        console.warn("Could not update achievements:", e);
      }
    };

    await updateAchievements(currentUserId, currentUserAchievements);
    if (opponentUserId) await updateAchievements(opponentUserId, opponentAchievements);
  };

  const processMatchResultImage = async (file: File, playerRegistration: Registration) => {
    setIsSubmittingImg(true);
    setAiAnalysisResult(null);
    try {
      const base64 = await compressImage(file);

      const response = await fetch('/api/analyze-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64,
          mimeType: file.type,
          fcName: playerRegistration.fcName,
          homeGoalkeeper: teams.find(t => t.fcName === playerRegistration.fcName)?.goalkeeper,
          awayGoalkeeper: teams.find(t => t.fcName !== playerRegistration.fcName)?.goalkeeper
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

          let finalMOTM = data.manOfTheMatch;
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
          
          // Save the compressed base64 image as evidence for admins to verify
          cleanedPayload.evidenceImage = `data:image/jpeg;base64,${base64}`;
          cleanedPayload.evidenceUploadedBy = playerRegistration.fcName;
          cleanedPayload.evidenceTimestamp = serverTimestamp();

          const updatedMatch = { ...existingMatch, ...cleanedPayload } as Match;
          setDbMatches(prev => prev.map(m => m.id === existingMatch.id ? updatedMatch : m));
          if (selectedMatch?.id === existingMatch.id) {
            setSelectedMatch(updatedMatch);
          }
          await updateDoc(matchRef, cleanedPayload);
          await refreshCache('matches');

          // Call achievements after match saved
          if (cleanedPayload.status === 'finished' && user?.uid) {
            try {
              await checkAndAwardAchievements(
                {
                  homeScore: cleanedPayload.homeScore,
                  awayScore: cleanedPayload.awayScore,
                  homeScorers: cleanedPayload.homeScorers || [],
                  awayScorers: cleanedPayload.awayScorers || [],
                  homeTeam: team1.fcName,
                  awayTeam: team2.fcName,
                },
                user.uid,
                opponentReg?.userId || ''
              );
            } catch (e) {
              console.warn('Achievement check failed:', e);
            }
          }

          if (cleanedPayload.status === 'finished') {
            fetch('/api/generate-news', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                matchData: cleanedPayload,
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
        currentUser = await signIn(); // Force Google login for registration
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

  const getBracketMatch = (id: string) => {
    const bracketMatch = bracket.find(m => m.id === id);
    if (bracketMatch) return bracketMatch;
    
    return { id, round: '', homeTeamName: 'TBD', awayTeamName: 'TBD', homeScore: 0, awayScore: 0 };
  };

  useEffect(() => {
    let _mounted = true;
    let teamsLoaded = false;
    let matchesLoaded = false;

    const checkLoaded = () => {
      // Small timeout to prevent aggressive flashing and let UI settle
      if (teamsLoaded && matchesLoaded && _mounted) {
        setTimeout(() => {
          if(_mounted) setIsDataLoading(false);
        }, 0);
      }
    };

    // Teams Sync
    const unsubTeams = onSnapshot(query(collection(db, 'registrations'), where('status', '==', 'approved')), (snapshot) => {
      const teamsList: Team[] = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.fcName,
          shortName: (data.fcName || '').substring(0, 3).toUpperCase(),
          fullName: data.name,
          fcName: data.fcName,
          ovr: data.teamOvr,
          uid: data.fcUid,
          logoUrl: data.logoUrl,
          goalkeeper: data.goalkeeper,
          played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: []
        };
      });
      if (_mounted) {
        setDbTeams(teamsList);
        teamsLoaded = true;
        checkLoaded();
      }
    }, (error) => {
      console.error("Teams sync error:", error);
      if (_mounted) { teamsLoaded = true; checkLoaded(); }
    });

    // Matches Sync
    const unsubMatches = onSnapshot(collection(db, 'matches'), (snapshot) => {
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

    return () => {
      _mounted = false;
      unsubTeams();
      unsubMatches();
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
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        bracketDataMap[docSnap.id] = { ...data, id: docSnap.id } as BracketMatch;
      });
      setBracket(Object.values(bracketDataMap));
    }, (error) => {
      console.error("Bracket sync error:", error);
    });

    return () => unsubBracket();
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
    if (isAdmin) {
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
  }, [isAdmin]);

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

  // Achievement Notification Logic
  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      const data = snap.data();
      const achievements = data?.achievements || {};
      const unseen = Object.entries(achievements)
        .filter(([_, val]: any) => val.seen === false)
        .map(([id]: any) => id);
      if (unseen.length > 0) {
        setNewAchievements(unseen);
        const updates: any = {};
        unseen.forEach(id => { updates[`achievements.${id}.seen`] = true; });
        updateDoc(userRef, updates);
      }
    });
    return () => unsub();
  }, [user]);

  // Auto-sync local user achievements based on match data
  useEffect(() => {
    if (!user || !userProfile || !myRegistrationData || !teams.length || !matches.length) return;
    
    // Use setTimeout so we don't blast firestore repeatedly on fast state changes
    const timer = setTimeout(() => {
      const myTeam = teams.find(t => t.fcName === myRegistrationData.fcName);
      if (!myTeam) return;

      const earnedIds = evaluateAchievements(myTeam, matches, myRegistrationData);
      const existingIds = new Set(Object.keys(userProfile.achievements || {}));
      
      const missingIds = earnedIds.filter(id => !existingIds.has(id));
      
      if (missingIds.length > 0) {
        const newAchievements: any = {};
        missingIds.forEach(id => {
          newAchievements[id] = {
            unlockedAt: serverTimestamp(),
            seen: false
          };
        });
        
        const updatedAchievements = { ...userProfile.achievements, ...newAchievements };
        
        // Update user profile in firestore to grant the achievement
        setDoc(doc(db, 'users', user.uid), { achievements: updatedAchievements }, { merge: true }).catch(err => {
          console.error("Failed to auto-grant achievement:", err);
        });
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [user, userProfile, myRegistrationData, teams, matches]);

  const handleCloseAchievement = async () => {
    if (newAchievements.length === 0 || !userProfile) return;
    
    try {
      const updatedAchievements = { ...userProfile.achievements };
      newAchievements.forEach(id => {
        if (updatedAchievements[id]) {
          updatedAchievements[id].seen = true;
        }
      });
      
      const userRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userRef, { achievements: updatedAchievements });
      
      setUserProfile(prev => prev ? { ...prev, achievements: updatedAchievements } : null);
      setNewAchievements([]);
    } catch (e) {
      console.error("Failed to mark achievement as seen:", e);
      setNewAchievements([]);
    }
  };
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
        signInAnon().catch((error) => {
          if (error.code === 'auth/network-request-failed') {
            console.error("Anonymous sign-in failed: Network error. Please check your internet connection.");
          } else {
            console.error("Anonymous sign-in error:", error);
          }
        });
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
      <AnimatePresence>
        {isDataLoading && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#000030] flex flex-col items-center justify-center pointer-events-none"
          >
            <Trophy className="w-16 h-16 text-blue-400 drop-shadow-[0_0_20px_rgba(96,165,250,0.6)] mb-8 animate-pulse" />
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-6" />
            <h2 className="text-3xl font-black uppercase tracking-tighter text-white italic">Arena Server</h2>
            <p className="text-white/40 text-xs tracking-[0.3em] uppercase font-bold mt-2 animate-pulse">Syncing matches & teams...</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-[#000030] text-white font-sans selection:bg-blue-500/30 relative overflow-hidden">
      {hasQuotaError && (
        <div className="bg-red-500/20 border-b border-red-500/50 p-4 text-center z-50 relative backdrop-blur-sm">
          <p className="text-red-200 font-bold max-w-4xl mx-auto">
            <span className="uppercase tracking-widest text-xs block mb-1">Database Error / Quota Exceeded</span>
            Firestore daily read limit has been reached, or the connection is offline. Latest data will not load properly unless cached. Quota resets at 12:00 AM PT.
          </p>
        </div>
      )}
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#000030] via-transparent to-transparent" />
      </div>

      {/* Header */}
      <header className="relative h-48 md:h-64 flex flex-col items-center justify-center overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-[#000030]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full opacity-10">
            <div className="grid grid-cols-8 gap-4 p-4">
              {Array.from({ length: 32 }).map((_, i) => (
                <Star key={i} className="w-4 h-4 text-white animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          </div>
        </div>
        
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="z-10 text-center px-4 w-full"
        >
          <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
            {user && !user.isAnonymous ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:block text-right">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none">Logged In</p>
                  <p className="text-xs font-bold text-blue-400 truncate max-w-[100px]">{user.displayName || user.email}</p>
                </div>
                <button 
                  onClick={() => logout()}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-red-400 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setIsAdminModalOpen(true)}
                    className="px-3 py-2 bg-yellow-600/20 border border-yellow-500/30 text-yellow-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-yellow-600/30 transition-all flex items-center gap-2"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Terminal
                  </button>
                )}
              </div>
            ) : (
              <button 
                onClick={() => signIn()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30 transition-all text-[10px] font-black uppercase tracking-widest backdrop-blur-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                Login
              </button>
            )}
          </div>

          <Trophy className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]" />
          <h1 className="font-display text-3xl md:text-6xl font-black tracking-tighter uppercase italic leading-none pr-2">
            <EditableText id="hero_title_main" defaultText="UXI Tournament" />
          </h1>
          <p className="text-blue-200/60 mt-2 font-mono text-[10px] md:text-sm tracking-[0.2em] md:tracking-[0.4em] uppercase">
            <EditableText id="hero_subtitle" defaultText="Elite Competition" />
          </p>
        </motion.div>
      </header>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#000030]/90 backdrop-blur-2xl border-b border-white/10 py-4 md:py-6">
        <div className="max-w-xl mx-auto px-4">
          <div className="relative flex p-1.5 bg-white/5 rounded-2xl border border-white/10 shadow-2xl overflow-x-auto hide-scrollbar">
            {[
              { id: 'fixtures', label: 'Fixtures', icon: Calendar },
              { id: 'table', label: 'Table', icon: TableIcon },
              { id: 'bracket', label: 'Bracket', icon: GitBranch },
              { id: 'stats', label: 'Stats', icon: BarChart2 },
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
                className={`relative flex-1 flex flex-col items-center justify-center gap-1.5 py-3 md:py-4 rounded-xl transition-all duration-500 z-10 ${
                  activeTab === tab.id ? 'text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <tab.icon className={`w-4 h-4 md:w-5 md:h-5 relative z-20 transition-transform duration-500 ${activeTab === tab.id ? 'scale-110' : 'scale-100'}`} />
                <span className="relative z-20 font-black uppercase text-[9px] md:text-[10px] tracking-[0.15em] md:tracking-[0.2em]">
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
                  <div className="p-3 bg-blue-600/20 rounded-2xl border border-blue-500/30 shrink-0">
                    <UserIcon className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <EditableText id="campaign_header" defaultText="My Campaign" as="h2" className="font-display text-2xl font-black uppercase italic tracking-tight leading-none truncate" />
                    <p className="text-blue-200/40 text-xs uppercase tracking-widest mt-1 truncate">
                      <EditableText id="campaign_sub" defaultText="Player Portal & Performance" />
                    </p>
                  </div>
                </div>
                <div className="flex flex-row md:flex-row items-center gap-2 w-full md:w-auto">
                  <button 
                    onClick={() => setIsEditingProfile(true)}
                    className="flex justify-center items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group shrink-0 h-full"
                  >
                    <Edit3 className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white hidden md:inline">Edit</span>
                  </button>
                  <div className="flex items-center gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl md:ml-auto overflow-x-auto hide-scrollbar w-full">
                    <button 
                      onClick={() => setCampaignTab('stats')}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap min-w-fit ${campaignTab === 'stats' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40' : 'text-white/40 hover:text-white/60'}`}
                    >
                      Stats
                    </button>
                    <button 
                      onClick={() => setCampaignTab('history')}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap min-w-fit ${campaignTab === 'history' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40' : 'text-white/40 hover:text-white/60'}`}
                    >
                      Results
                    </button>
                    <button 
                      onClick={() => setCampaignTab('achievements')}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap min-w-fit ${campaignTab === 'achievements' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40' : 'text-white/40 hover:text-white/60'}`}
                    >
                      Achievements
                    </button>
                    <button 
                      onClick={() => setCampaignTab('edit')}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap min-w-fit ${campaignTab === 'edit' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40' : 'text-white/40 hover:text-white/60'}`}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>

              {!user ? (
                <div className="p-12 text-center bg-white/5 rounded-3xl border border-white/10">
                  <p className="text-white/40 mb-6">Please login to access your campaign portal.</p>
                  <button onClick={() => signIn()} className="px-8 py-4 bg-blue-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all">Login Now</button>
                </div>
              ) : (
                (() => {
                  const myRegistration = myRegistrationData;
                  if (!myRegistration) {
                     return (
                        <div className="p-12 text-center bg-white/5 rounded-3xl border border-white/10">
                          <p className="text-white/40 mb-6 font-bold">You are not registered for the tournament.</p>
                          <button onClick={() => setActiveTab('registration')} className="px-8 py-4 bg-blue-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all">Register Now</button>
                        </div>
                     );
                  }

                  if (myRegistration.status === 'pending') {
                    return (
                      <div className="p-12 text-center bg-yellow-500/5 rounded-3xl border border-yellow-500/20">
                        <Loader2 className="w-12 h-12 text-yellow-500/40 mx-auto mb-6 animate-spin" />
                        <h3 className="text-xl font-display font-black text-yellow-500 uppercase italic">Waiting for Verification</h3>
                        <p className="text-white/40 text-sm mt-2">Admin is currently reviewing your registration details.</p>
                      </div>
                    );
                  }

                  if (myRegistration.status === 'rejected') {
                    return (
                      <div className="p-12 text-center bg-red-500/5 rounded-3xl border border-red-500/20">
                        <X className="w-12 h-12 text-red-500/40 mx-auto mb-6" />
                        <h3 className="text-xl font-display font-black text-red-500 uppercase italic">Registration Rejected</h3>
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
                      <div className="p-12 text-center bg-blue-600/5 rounded-3xl border border-blue-500/20">
                        <Calendar className="w-12 h-12 text-blue-500/40 mx-auto mb-6" />
                        <h3 className="text-xl font-display font-black text-blue-400 uppercase italic">Waiting for Fixture Update</h3>
                        <p className="text-white/40 text-sm mt-2">You are registered and approved! Matches will appear here once the schedule is released.</p>
                      </div>
                    );
                  }

                  const myStats = calculateStats(teams, matches).filter(s => s.gamerName === myRegistration.fcName);

                  return (
                    <div className="space-y-8">
                      {campaignTab === 'achievements' ? (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 md:p-12"
                        >
                          <div className="max-w-4xl mx-auto space-y-12">
                             <div className="text-center space-y-4">
                               <h2 className="text-4xl md:text-5xl font-display font-black uppercase italic text-white tracking-tighter">My Trophy Room</h2>
                               <p className="text-white/40 text-xs font-black uppercase tracking-[0.3em]">Showcasing your tournament exploits</p>
                             </div>
                             <AchievementsList userAchievements={userProfile?.achievements || {}} />
                          </div>
                        </motion.div>
                      ) : campaignTab === 'edit' ? (
                         <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 text-center">
                            <Shield className="w-16 h-16 text-blue-400/20 mx-auto mb-6" />
                            <h3 className="text-xl font-display font-black text-white uppercase italic">Security Shield Active</h3>
                            <p className="text-white/40 text-sm max-w-sm mx-auto mt-2">Use the "Edit Info" button in the header to modify your tournament registration details.</p>
                            <button 
                              onClick={() => setIsEditingProfile(true)}
                              className="mt-8 px-8 py-4 bg-blue-600 rounded-2xl font-black uppercase text-xs tracking-widest text-white hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20"
                            >
                              Launch Editor
                            </button>
                         </div>
                      ) : campaignTab === 'history' ? (
                        <div className="space-y-6">
                           <h3 className="text-lg font-display font-black uppercase italic text-white px-4">All Match Results</h3>
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
                              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">
                                <EditableText id="stats_status_label" defaultText="Status" />
                              </p>
                              <p className="text-xl font-display font-black italic text-white uppercase">{myRegistration.status}</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] text-center">
                              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">OVR</p>
                              <p className="text-xl font-display font-black italic text-yellow-500">{myRegistration.teamOvr}</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] text-center">
                              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Goals</p>
                              <p className="text-xl font-display font-black italic text-white">{myStats.reduce((acc, s) => acc + s.goals, 0)}</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] text-center">
                              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Played</p>
                              <p className="text-xl font-display font-black italic text-white">{myMatches.filter(m => m.status === 'finished').length}</p>
                            </div>
                          </div>

                          {/* Goal Scorers */}
                          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8">
                            <h3 className="text-lg font-display font-black uppercase italic text-white mb-6">Top Scorers</h3>
                            <div className="space-y-4">
                              {myStats.length === 0 ? (
                                <p className="text-white/20 text-center py-4 text-sm uppercase font-black tracking-widest">No goals recorded yet</p>
                              ) : (
                                myStats.map(s => (
                                  <div key={s.playerName} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                                    <span className="font-bold text-white">{s.playerName}</span>
                                    <span className="font-display font-black text-blue-400 text-xl italic">{s.goals}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Result Submission AI */}
                          <div className="bg-blue-600/5 border border-blue-500/20 rounded-[2rem] p-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px] pointer-events-none" />
                            <EditableText id="ai_update_title" defaultText="Automated Result update" as="h3" className="text-lg font-display font-black uppercase italic text-blue-400 mb-2" />
                            <p className="text-white/40 text-[10px] uppercase tracking-widest mb-6">
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
                                      <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
                                        <AlertCircle className="w-5 h-5 text-blue-400/60" />
                                      </div>
                                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40">
                                        No Ongoing Matches Found<br/>
                                        <span className="text-blue-400/60 lowercase font-bold tracking-normal italic mt-1 block">Analysis is only enabled when your match is marked as "Ongoing" by an admin</span>
                                      </p>
                                    </div>
                                  );
                                }

                                return (
                                  <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/10 rounded-2xl hover:border-blue-500/50 transition-all group cursor-pointer relative">
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
                                          if (file.size > 2 * 1024 * 1024) return alert("File size must be under 2MB");
                                          processMatchResultImage(file, myRegistration);
                                        }
                                      }}
                                      className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                    <Plus className="w-8 h-8 text-blue-400/40 mb-3 group-hover:text-blue-400 transition-colors" />
                                    <span className="text-[10px] font-black uppercase text-white/40 tracking-widest text-center">Upload FC Result<br/>(Max 2MB)</span>
                                  </div>
                                );
                              })()}

                              {isSubmittingImg && (
                                 <div className="flex items-center justify-center gap-3 text-blue-400">
                                   <Loader2 className="w-4 h-4 animate-spin" />
                                   <span className="text-[10px] font-black uppercase tracking-widest">AI Analyzing Photo...</span>
                                 </div>
                              )}

                              {aiAnalysisResult && (
                                <div className={`p-4 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                                  aiAnalysisResult.startsWith('SUCCESS') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                }`}>
                                  {aiAnalysisResult}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Upcoming Matches */}
                          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8">
                            <h3 className="text-lg font-display font-black uppercase italic text-white mb-6">Upcoming Fixtures</h3>
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
                                       <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none ${isHome ? 'bg-blue-500' : 'bg-orange-500'}`}></div>
                                       
                                       <div className="flex items-center gap-4 relative z-10 w-full">
                                         <div className={`w-14 items-center justify-center flex py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${isHome ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>
                                           {isHome ? 'Home' : 'Away'}
                                         </div>
                                        <div className="flex-1">
                                          <p className="text-lg md:text-xl font-display font-black italic text-white uppercase mt-1 mb-1 line-clamp-1">vs {opponent?.name || 'TBD'}</p>
                                          <div className="flex items-center gap-3 text-white/40 text-xs font-black uppercase tracking-widest">
                                            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md border border-white/5">
                                              <EditableMatchBadge match={m} isAdmin={isAdmin} textClassName="text-blue-400 font-bold" />
                                              <div className="w-[1px] h-3 bg-white/10 mx-1" />
                                              <Calendar className="w-3.5 h-3.5 text-blue-400" />
                                              <span className="text-blue-300">{m.date || 'TBD'}</span>
                                            </div>
                                          </div>
                                         </div>
                                       </div>
                                       <div className="relative z-10 md:w-auto w-full">
                                          <button 
                                            onClick={() => setSelectedMatch(m)} 
                                            className="w-full md:w-auto px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white text-xs font-black uppercase tracking-widest transition-colors whitespace-nowrap"
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
              <NewsFeed articles={newsFeed} />
            </motion.div>
          )}

          {activeTab === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Top Scorers Section */}
              <div className="flex items-center gap-4 mb-4 mt-2">
                <div className="p-3 bg-blue-600/20 rounded-2xl border border-blue-500/30">
                  <BarChart2 className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <EditableText id="scorers_header" defaultText="Top Scorers" as="h2" className="font-display text-2xl font-black uppercase italic tracking-tight leading-none" />
                  <p className="text-blue-200/40 text-xs uppercase tracking-widest mt-1">
                    <EditableText id="individual_stats_sub" defaultText="Individual Player Statistics" />
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm mb-12">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-blue-200/50 text-[10px] uppercase tracking-[0.2em] font-bold">
                      <th className="px-6 py-4">Rank</th>
                      <th className="px-6 py-4">Football Player</th>
                      <th className="px-6 py-4">Gamer</th>
                      <th className="px-6 py-4 text-center">UID</th>
                      <th className="px-6 py-4 text-center">Goals</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {stats.length > 0 ? stats.map((stat, index) => (
                      <tr key={`${stat.playerName}-${stat.teamId}`} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            index === 0 ? 'bg-yellow-500/20 text-yellow-400' : 
                            index === 1 ? 'bg-gray-400/20 text-gray-300' : 
                            index === 2 ? 'bg-orange-500/20 text-orange-400' : 
                            'bg-white/10 text-white/70'
                          }`}>
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-display font-black uppercase italic text-sm tracking-tight">{stat.playerName}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white/80">{stat.gamerFullName}</span>
                            <span className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest">{stat.gamerName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => {
                              const team = teams.find(t => t.name === stat.gamerName);
                              if (team) copyToClipboard(team.uid);
                            }}
                            className="inline-flex items-center justify-center p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-blue-400/80 hover:text-blue-400 transition-all border border-white/5"
                            title="Copy UID"
                          >
                            {copiedId === teams.find(t => t.name === stat.gamerName)?.uid ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-lg font-black text-blue-400">{stat.goals}</span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-3 opacity-20">
                            <Info className="w-8 h-8" />
                            <p className="text-xs uppercase font-black tracking-widest">No goals recorded yet</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Clean Sheets Section */}
              <div className="flex items-center gap-4 mb-4 mt-8">
                <div className="p-3 bg-green-600/20 rounded-2xl border border-green-500/30">
                  <Shield className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-black uppercase italic tracking-tight leading-none text-white">Clean Sheets</h2>
                  <p className="text-green-200/40 text-xs uppercase tracking-widest mt-1">Top Goalkeepers</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm mb-12">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-green-200/50 text-[10px] uppercase tracking-[0.2em] font-bold">
                      <th className="px-6 py-4">Rank</th>
                      <th className="px-6 py-4">Goalkeeper</th>
                      <th className="px-6 py-4">Gamer</th>
                      <th className="px-6 py-4 text-center">UID</th>
                      <th className="px-6 py-4 text-center">Clean Sheets</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {cleanSheets.length > 0 ? cleanSheets.map((stat, index) => (
                      <tr key={stat.teamId} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            index === 0 ? 'bg-yellow-500/20 text-yellow-400' : 
                            index === 1 ? 'bg-gray-400/20 text-gray-300' : 
                            index === 2 ? 'bg-orange-500/20 text-orange-400' : 
                            'bg-white/10 text-white/70'
                          }`}>
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-display font-black uppercase italic text-sm tracking-tight">{stat.goalkeeperName}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white/80">{stat.gamerFullName}</span>
                            <span className="text-[10px] font-black text-green-400/60 uppercase tracking-widest">{stat.gamerName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => {
                              const team = teams.find(t => t.name === stat.gamerName);
                              if (team) copyToClipboard(team.uid);
                            }}
                            className="inline-flex items-center justify-center p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-green-400/80 hover:text-green-400 transition-all border border-white/5"
                            title="Copy UID"
                          >
                            {copiedId === teams.find(t => t.name === stat.gamerName)?.uid ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-lg font-black text-green-400">{stat.cleanSheets}</span>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-3 opacity-20">
                            <Shield className="w-8 h-8" />
                            <p className="text-xs uppercase font-black tracking-widest">No clean sheets recorded yet</p>
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
                  <h2 className="font-display text-2xl font-black uppercase italic tracking-tight leading-none text-white">Man of the Match Leaders</h2>
                  <p className="text-white/40 text-xs uppercase tracking-widest mt-1">Top Performers</p>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 lg:p-8 mb-12 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 w-32 h-32 bg-yellow-500/10 rounded-bl-full pointer-events-none" />
                
                <div className="space-y-4 relative z-10 max-w-2xl">
                  {motmLeaders.length > 0 ? (
                    motmLeaders.map((leader, index) => (
                      <div key={leader.playerName} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-4">
                          <span className="text-lg font-bold text-white/40">{index + 1}.</span>
                          <span className="text-base font-black uppercase tracking-widest text-white">{leader.playerName}</span>
                        </div>
                        <div className="flex items-center gap-2 sm:ml-auto">
                          <span className="text-yellow-400 font-bold">{leader.awards} award{leader.awards !== 1 ? 's' : ''}</span>
                          <TrophyIcon className="w-4 h-4 text-yellow-500" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-white/40 uppercase font-black text-xs tracking-widest">No MOTM awards recorded yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Team Statistics Grid */}
              <div className="flex items-center gap-4 mb-4 mt-8">
                <div className="p-3 bg-indigo-600/20 rounded-2xl border border-indigo-500/30">
                  <BarChart2 className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-black uppercase italic tracking-tight leading-none text-white">Team Overview</h2>
                  <p className="text-white/40 text-xs uppercase tracking-widest mt-1">Tournament Averages</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col justify-between items-center text-center">
                  <span className="text-[10px] font-black uppercase text-blue-400/60 tracking-widest mb-1">Highest Average Possession</span>
                  <span className="text-xl md:text-2xl font-display font-black uppercase tracking-tight italic mb-2 text-white line-clamp-1">{hofStats.mostPossession?.name || '---'}</span>
                  <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 font-bold text-sm">
                    {hofStats.mostPossession?.value ? `${hofStats.mostPossession.value.toFixed(1)}%` : '0%'}
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col justify-between items-center text-center">
                  <span className="text-[10px] font-black uppercase text-green-400/60 tracking-widest mb-1">Most Goals Scored</span>
                  <span className="text-xl md:text-2xl font-display font-black uppercase tracking-tight italic mb-2 text-white line-clamp-1">{hofStats.mostGoals?.name || '---'}</span>
                  <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 font-bold text-sm">
                    {hofStats.mostGoals?.value || 0} Goals
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col justify-between items-center text-center">
                  <span className="text-[10px] font-black uppercase text-cyan-400/60 tracking-widest mb-1">Best Defense</span>
                  <span className="text-xl md:text-2xl font-display font-black uppercase tracking-tight italic mb-2 text-white line-clamp-1">{hofStats.leastConceded?.name || '---'}</span>
                  <div className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400 font-bold text-sm">
                    {hofStats.leastConceded?.value || 0} Goals Conceded
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col justify-between items-center text-center">
                  <span className="text-[10px] font-black uppercase text-orange-400/60 tracking-widest mb-1">Most Shots Taken</span>
                  <span className="text-xl md:text-2xl font-display font-black uppercase tracking-tight italic mb-2 text-white line-clamp-1">{hofStats.mostShots?.name || '---'}</span>
                  <div className="px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-400 font-bold text-sm">
                    {hofStats.mostShots?.value || 0} Shots
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col justify-between items-center text-center border-yellow-500/30">
                  <span className="text-[10px] font-black uppercase text-yellow-400/60 tracking-widest mb-1">Most Early Goals (1-30')</span>
                  <span className="text-xl md:text-2xl font-display font-black uppercase tracking-tight italic mb-2 text-white line-clamp-1">{hofStats.mostEarlyGoals?.name || '---'}</span>
                  <div className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 font-bold text-sm">
                    {hofStats.mostEarlyGoals?.value || 0} Early Goals
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col justify-between items-center text-center border-red-500/30">
                  <span className="text-[10px] font-black uppercase text-red-400/60 tracking-widest mb-1">Most Late Goals (60-90+')</span>
                  <span className="text-xl md:text-2xl font-display font-black uppercase tracking-tight italic mb-2 text-white line-clamp-1">{hofStats.mostLateGoals?.name || '---'}</span>
                  <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 font-bold text-sm">
                    {hofStats.mostLateGoals?.value || 0} Late Goals
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'table' && (
            <motion.div
              key="table"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-black uppercase italic tracking-tighter">
                    <EditableText id="league_table_header" defaultText="League" /> <span className="text-blue-400">
                      <EditableText id="league_table_header_bold" defaultText="Table" />
                    </span>
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
                    <EditableText id="tournament_season_label" defaultText="Tournament Season" />
                  </span>
                </div>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-blue-200/50 text-[10px] md:text-[10px] uppercase tracking-[0.1em] md:tracking-[0.2em] font-bold">
                    <th className="px-3 md:px-6 py-3 md:py-4">Pos</th>
                    <th className="px-3 md:px-6 py-3 md:py-4">Player</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 hidden md:table-cell">FC Name</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-center">UID</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-center">OVR</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-center">P</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-center">W</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-center">D</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-center">L</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-center">GF</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-center">GA</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-center">GD</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-center">Pts</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-center">Form</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {standings.map((team, index) => {
                      let rowClass = "hover:bg-white/5 transition-colors";
                      
                      return (
                        <tr key={team.id} className={`${rowClass} relative group/row cursor-pointer`} onClick={() => setSelectedTeam(team)}>
                          <td className="px-3 md:px-6 py-3 md:py-4 relative text-center">
                            <div className={`w-6 h-6 md:w-8 md:h-8 mx-auto rounded-full flex items-center justify-center font-bold text-xs md:text-sm relative z-10 ${
                              index < 8 ? 'bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/30' : 
                              'bg-white/10 text-white/70'
                            }`}>
                              {index + 1}
                            </div>
                          </td>
                          <td className="px-3 md:px-6 py-3 md:py-4">
                            <div className="flex items-center min-w-0 gap-3">
                              <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-white/5 flex items-center justify-center">
                                {team.logoUrl ? (
                                  <img src={team.logoUrl} alt={team.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <span className="text-[10px] font-black text-white/20">{team.name[0]}</span>
                                )}
                              </div>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-display font-black tracking-tight whitespace-nowrap uppercase italic truncate pr-1 text-xs md:text-sm">
                                    {team.fullName}
                                  </span>
                                  {qualificationStatus && qualificationStatus[team.id] === 'Q' && (
                                    <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[8px] font-black uppercase tracking-tighter rounded border border-green-500/30" title="Mathematically Qualified (Top 8 Guaranteed)">Q</span>
                                  )}
                                  {qualificationStatus && qualificationStatus[team.id] === 'E' && (
                                    <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[8px] font-black uppercase tracking-tighter rounded border border-red-500/30" title="Mathematically Eliminated">E</span>
                                  )}
                                </div>
                                <span className="text-[10px] md:text-xs text-white/40 font-bold uppercase tracking-widest mt-0.5">{team.fcName}</span>
                              </div>
                            </div>
                          </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 hidden md:table-cell font-mono text-xs text-white/40">{team.fcName}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                          <button 
                            onClick={() => copyToClipboard(team.uid)}
                            className="inline-flex items-center justify-center p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-blue-400/80 hover:text-blue-400 transition-all border border-white/5"
                            title="Copy UID"
                          >
                            {copiedId === team.uid ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                          <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] md:text-[10px] font-black text-blue-400">{team.ovr}</span>
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 text-center font-mono text-xs md:text-sm text-white/60">{team.played}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4 text-center font-mono text-xs md:text-sm text-white/60">{team.won}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4 text-center font-mono text-xs md:text-sm text-white/60">{team.drawn}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4 text-center font-mono text-xs md:text-sm text-white/60">{team.lost}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4 text-center font-mono text-xs md:text-sm text-white/60">{team.gf}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4 text-center font-mono text-xs md:text-sm text-white/60">{team.ga}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4 text-center font-mono text-xs md:text-sm text-white/60">{team.gd > 0 ? `+${team.gd}` : team.gd}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4 text-center font-black text-xs md:text-sm text-blue-400">{team.points}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {team.form.map((result, i) => (
                              <div
                                key={i}
                                className={`w-4 h-4 md:w-5 md:h-5 rounded-sm flex items-center justify-center text-[8px] md:text-[10px] font-black ${
                                  result === 'W' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                  result === 'D' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                  'bg-red-500/20 text-red-400 border border-red-500/30'
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
              <div className="flex flex-col md:flex-row items-center gap-4 mb-8 justify-between w-full bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-600/20 rounded-2xl border border-blue-500/30">
                    <Calendar className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter">
                      <EditableText id="fixtures_header" defaultText="Tournament" isAdmin={isAdmin} /> <span className="text-blue-400">
                        <EditableText id="fixtures_header_bold" defaultText="Fixtures" isAdmin={isAdmin} />
                      </span>
                    </h2>
                    <p className="text-blue-200/40 text-[10px] uppercase font-black tracking-widest">
                      <EditableText id="fixtures_sub" defaultText="Season 2026" isAdmin={isAdmin} />
                    </p>
                  </div>
                </div>
                {isAdmin && isEditingMode && (
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAddNewFixture()}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full transition-all shadow-xl shadow-blue-600/30 border border-white/20 whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    Add Fixture
                  </motion.button>
                )}
              </div>

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

                      if (orderedDays.length === 0) {
                        return (
                          <div className="py-24 text-center bg-white/5 border border-white/10 rounded-[2.5rem] flex flex-col items-center gap-6">
                            <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center border border-blue-500/20">
                              <Calendar className="w-10 h-10 text-blue-400" />
                            </div>
                            <div>
                              <EditableText id="loading_fixtures_title" defaultText="Fixtures Loading" isAdmin={isAdmin} as="h3" className="text-2xl font-display font-black uppercase italic text-white mb-2" />
                              <p className="text-white/40 text-sm font-bold uppercase tracking-widest">
                                <EditableText id="loading_fixtures_sub" defaultText="Mark will update soon" isAdmin={isAdmin} />
                              </p>
                            </div>
                            {isAdmin && isEditingMode && (
                              <button 
                                onClick={() => handleAddNewFixture()}
                                className="mt-4 flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest rounded-full transition-all shadow-xl shadow-blue-600/30"
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
                            <div className="px-4 py-2 bg-blue-600/20 border border-blue-500/30 rounded-xl">
                              <span className="text-xs font-black text-blue-400 uppercase tracking-widest">{day}</span>
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
                                className="flex items-center justify-center gap-2 p-6 bg-blue-500/10 border border-dashed border-blue-500/30 rounded-3xl text-blue-400 hover:bg-blue-500/20 hover:border-blue-500 transition-all font-black uppercase text-xs tracking-widest"
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
                {/* Qualifier Round */}
                <div className="flex flex-col justify-around gap-16">
                  <h3 className="text-cyan-400 font-black uppercase tracking-widest text-[10px] mb-4 text-center bg-cyan-400/10 py-1 rounded border border-cyan-400/20">Qualifier Round</h3>
                  {Array.from({ length: 4 }).map((_, i) => {
                    const matchId = `qual-${i}`;
                    const match = getBracketMatch(matchId);
                    return (
                      <div key={`hub-qual-${i}`} className="relative">
                        <div className="w-fit min-w-[160px] bg-white/5 border border-cyan-400/30 rounded-lg overflow-hidden shadow-lg transition-all group/match relative">
                          <div className={`p-2 flex justify-between items-center text-sm ${i % 2 === 0 ? 'bg-blue-500/10' : ''} relative z-10 gap-6`}>
                            <span className="font-display font-black text-cyan-400/70 uppercase italic whitespace-nowrap">{match.homeTeamName || 'TBD'}</span>
                            <span className="font-mono font-bold text-cyan-400">{match.homeScore ?? '-'}</span>
                          </div>
                          <div className={`p-2 flex justify-between items-center text-sm border-t border-white/5 ${i % 2 !== 0 ? 'bg-blue-500/10' : ''} gap-6`}>
                            <span className="font-display font-black text-cyan-400/70 uppercase italic whitespace-nowrap">{match.awayTeamName || 'TBD'}</span>
                            <span className="font-mono font-bold text-cyan-400">{match.awayScore ?? '-'}</span>
                          </div>
                        </div>
                        {/* Connector Line - Straight to Quarterfinal */}
                        <div className={`absolute -right-16 top-1/2 w-16 h-[1px] bg-white/20`} />
                      </div>
                    );
                  })}
                </div>

                {/* Quarter Finals */}
                <div className="flex flex-col justify-center gap-16">
                  <h3 className="text-indigo-400 font-black uppercase tracking-widest text-xs mb-4 text-center bg-indigo-400/10 py-1 rounded border border-indigo-400/20">Quarter-Finals</h3>
                  {Array.from({ length: 4 }).map((_, i) => {
                    const matchId = `qf-${i}`;
                    const match = getBracketMatch(matchId);
                    const isDashed = i === 1 || i === 3;
                    return (
                      <div key={`hub-qf-${i}`} className="relative">
                        <div className="w-fit min-w-[160px] bg-white/5 border border-indigo-400/30 rounded-lg overflow-hidden shadow-lg transition-all group/match relative">
                          <div className="p-2 flex justify-between items-center text-sm relative z-10 gap-6">
                            <span className="font-display font-black uppercase italic transition-colors text-indigo-400/70 whitespace-nowrap">
                              {match.homeTeamName || 'TBD'}
                            </span>
                            <span className="font-mono font-bold text-indigo-400">{match.homeScore ?? '-'}</span>
                          </div>
                          <div className="p-2 flex justify-between items-center text-sm border-t border-white/5 gap-6">
                            <span className="font-display font-black uppercase italic transition-colors text-indigo-400/70 whitespace-nowrap">
                              {match.awayTeamName || 'TBD'}
                            </span>
                            <span className="font-mono font-bold text-indigo-400">{match.awayScore ?? '-'}</span>
                          </div>
                        </div>
                        {/* Connector Line */}
                        <div className={`absolute -right-8 top-1/2 w-8 h-[1px] ${isDashed ? 'border-t border-dashed border-white/40' : 'bg-white/20'}`} />
                        {i % 2 === 0 ? (
                          <div className="absolute -right-8 top-1/2 w-[1px] h-[calc(50%+32px)] bg-white/20" />
                        ) : (
                          <div className={`absolute -right-8 bottom-1/2 w-[1px] h-[calc(50%+32px)] ${isDashed ? 'border-r border-dashed border-white/40' : 'bg-white/20'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Semi Finals */}
                <div className="flex flex-col justify-center gap-32">
                  <h3 className="text-purple-400 font-black uppercase tracking-widest text-xs mb-4 text-center bg-purple-400/10 py-1 rounded border border-purple-400/20">Semi-Finals</h3>
                  {Array.from({ length: 2 }).map((_, i) => {
                    const matchId = `sf-${i}`;
                    const match = getBracketMatch(matchId);
                    const isDashed = i === 1;
                    return (
                      <div key={`hub-sf-${i}`} className="relative">
                        <div className="w-fit min-w-[160px] bg-white/5 border border-purple-400/30 rounded-lg overflow-hidden shadow-lg transition-all group/match relative">
                          <div className="p-2 flex justify-between items-center text-sm relative z-10 gap-6">
                            <span className="font-display font-black uppercase italic text-purple-400/70 transition-colors whitespace-nowrap">{match.homeTeamName || 'TBD'}</span>
                            <span className="font-mono font-bold text-purple-400">{match.homeScore ?? '-'}</span>
                          </div>
                          <div className="p-2 flex justify-between items-center text-sm border-t border-white/5 gap-6">
                            <span className="font-display font-black uppercase italic text-purple-400/70 transition-colors whitespace-nowrap">{match.awayTeamName || 'TBD'}</span>
                            <span className="font-mono font-bold text-purple-400">{match.awayScore ?? '-'}</span>
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
                    <h3 className="text-yellow-400 font-black uppercase tracking-widest text-xs mb-4 text-center bg-yellow-400/10 py-1 rounded border border-yellow-400/20 shadow-[0_0_15px_rgba(234,179,8,0.2)]">Grand Final</h3>
                    {(() => {
                      const match = getBracketMatch('final');
                      return (
                        <div className="w-fit min-w-[200px] bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-yellow-500/50 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(234,179,8,0.15)] p-1 transition-all group/match relative">
                          <div className="bg-[#000030] rounded-lg overflow-hidden relative z-10">
                            <div className="p-4 flex justify-between items-center gap-8">
                              <span className="font-display font-black text-base uppercase italic tracking-tighter text-yellow-400/70 transition-colors whitespace-nowrap">{match.homeTeamName || 'TBD'}</span>
                              <span className="font-mono font-black text-2xl text-yellow-400">{match.homeScore ?? '-'}</span>
                            </div>
                            <div className="p-4 flex justify-between items-center border-t border-white/5 gap-8">
                              <span className="font-display font-black text-base uppercase italic tracking-tighter text-yellow-400/70 transition-colors whitespace-nowrap">{match.awayTeamName || 'TBD'}</span>
                              <span className="font-mono font-black text-2xl text-yellow-400">{match.awayScore ?? '-'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div>
                    <h3 className="text-orange-400 font-black uppercase tracking-widest text-[10px] mb-4 text-center bg-orange-400/10 py-1 rounded border border-orange-400/20">3rd Place Match</h3>
                    {(() => {
                      const match = getBracketMatch('third-place');
                      return (
                        <div className="w-fit min-w-[200px] bg-white/5 border border-orange-500/30 rounded-xl overflow-hidden shadow-lg p-1 transition-all group/match relative">
                          <div className="bg-[#000020] rounded-lg overflow-hidden relative z-10">
                            <div className="p-3 flex justify-between items-center gap-8">
                              <span className="font-display font-black text-sm uppercase italic tracking-tighter text-orange-400/70 transition-colors whitespace-nowrap">{match.homeTeamName || 'TBD'}</span>
                              <span className="font-mono font-bold text-lg text-orange-400">{match.homeScore ?? '-'}</span>
                            </div>
                            <div className="p-3 flex justify-between items-center border-t border-white/5 gap-8">
                              <span className="font-display font-black text-sm uppercase italic tracking-tighter text-orange-400/70 transition-colors whitespace-nowrap">{match.awayTeamName || 'TBD'}</span>
                              <span className="font-mono font-bold text-lg text-orange-400">{match.awayScore ?? '-'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="mt-4 flex flex-col items-center">
                    <Trophy className="w-12 h-12 text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)] mb-2" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-500/50">Champion</span>
                  </div>
                </div>
              </div>
              
              {/* Legend */}
              <div className="mt-12 flex flex-col items-center gap-4">
                <div className="flex flex-wrap justify-center gap-8 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-[1px] bg-white/40" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Straight Line = 1st Leg Home</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-[1px] border-t border-dashed border-white/60" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Cutted Line = 2nd Leg Home</span>
                  </div>
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-blue-400/40 italic">Note: Seeding benefit allows play second leg at home</p>
              </div>
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
              <div className="relative h-80 rounded-[2.5rem] overflow-hidden group shadow-2xl">
                <EditableImage 
                  id="reg_hero_image" 
                  defaultSrc="https://picsum.photos/seed/tournament/1920/1080" 
                  alt="Tournament Registration" 
                  className="w-full h-full text-[0] leading-[0] transition-transform duration-700 group-hover:scale-110" 
                  isAdmin={isAdmin} 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#000020] via-[#000020]/40 to-transparent pointer-events-none" />
                <div className="absolute inset-x-8 bottom-8 pointer-events-none">
                  <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest mb-3 inline-block pointer-events-auto">
                    <EditableText id="apps_live_status" defaultText="Applications Live" isAdmin={isAdmin} />
                  </span>
                  <div className="pointer-events-auto inline-block relative">
                    <EditableText id="join_season_title" defaultText="Join Season 2026" isAdmin={isAdmin} as="h2" className="text-4xl md:text-5xl font-display font-black italic uppercase text-white tracking-tight leading-none mb-4" />
                  </div>
                  <p className="text-white/60 text-sm max-w-xl font-medium pointer-events-auto relative">
                    <EditableText id="ready_to_prove_sub" defaultText="Ready to prove your skills? Register now for the upcoming tournament season. Entry is limited to 16 teams." isAdmin={isAdmin} />
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-md">
                   <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/30">
                     <Users className="w-6 h-6 text-blue-400" />
                   </div>
                   <EditableText id="player_reg_title" defaultText="Player Registration" isAdmin={isAdmin} as="h3" className="text-xl font-black text-white uppercase italic tracking-tight mb-2" />
                   <p className="text-white/40 text-sm mb-8">
                     <EditableText id="click_below_sub" defaultText="Click below to fill out your details and secure your spot in the bracket." isAdmin={isAdmin} />
                   </p>
                   
                   {hasRegistered ? (
                     <div className="p-6 bg-green-600/10 border border-green-500/20 rounded-2xl flex items-center gap-3">
                       <Check className="w-5 h-5 text-green-400" />
                       <span className="text-sm font-bold text-green-400">Successfully Registered</span>
                     </div>
                   ) : (
                     <button
                       onClick={async () => {
                          if (!user || user.isAnonymous) {
                            try {
                              await signIn();
                            } catch (e) {
                              console.error("Login failed", e);
                              return;
                            }
                          }
                          setIsRegistrationModalOpen(true);
                        }}
                       className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase text-xs tracking-[0.3em] transition-all shadow-xl shadow-blue-600/20"
                     >
                       Register Now
                     </button>
                   )}
                 </div>

                 <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-md">
                   <div className="w-12 h-12 bg-yellow-500/20 rounded-2xl flex items-center justify-center mb-6 border border-yellow-500/30">
                     <Shield className="w-6 h-6 text-yellow-400" />
                   </div>
                   <EditableText id="requirements_title" defaultText="Requirements" isAdmin={isAdmin} as="h3" className="text-xl font-black text-white uppercase italic tracking-tight mb-2" />
                   <ul className="space-y-3">
                     {[
                       { id: 'req_1', text: "FC Mobile Active UID" },
                       { id: 'req_2', text: "Team OVR 110+" },
                       { id: 'req_3', text: "Stable Internet Connection" },
                       { id: 'req_4', text: "Fair Play Commitment" }
                     ].map(req => (
                       <li key={req.id} className="flex items-center gap-3 text-xs font-bold text-white/60">
                         <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
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
              className="flex items-center gap-3 px-6 py-4 bg-blue-600 rounded-2xl shadow-[0_10px_30px_rgba(37,99,235,0.4)] border border-blue-400/30 group relative overflow-hidden"
            >
              <div className="relative z-10 flex items-center gap-3">
                <Layout className="w-5 h-5 text-white" />
                <span className="font-display font-black uppercase italic text-sm tracking-widest text-white">Join Tournament</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
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
          />
        )}
        {isRegistrationModalOpen && (
          <RegistrationModal 
            onClose={() => setIsRegistrationModalOpen(false)} 
            handleRegister={handleRegister}
            isSubmitting={isSubmittingRegistration}
            hasRegistered={hasRegistered}
            user={user}
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
          />
        )}
        {adminEditingRegistration && (
          <EditProfileModal
            registration={adminEditingRegistration}
            onClose={() => setAdminEditingRegistration(null)}
            handleUpdateRegistration={handleAdminUpdateUserRegistration}
            isSubmitting={isSubmittingRegistration}
          />
        )}
        {isAdminModalOpen && (
          <AdminModal 
            isAdmin={isAdmin}
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
            isEditingMode={isEditingMode}
            setIsEditingMode={setIsEditingMode}
            matchLabels={matchLabels}
            updateMatchLabel={updateMatchLabel}
            matchesByDay={matchesByDay}
            handleAnalyzeQualification={handleAnalyzeQualification}
            handleUpdateConfig={handleUpdateConfig}
            setAdminEditingRegistration={setAdminEditingRegistration}
            teams={dbTeams}
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
        {newAchievements.length > 0 && (
          <AchievementNotification achievements={newAchievements} onClose={() => setNewAchievements([])} />
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-20 py-8 md:py-12 border-t border-white/10 bg-black/20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-8">
                <div className="text-center md:text-left">
                  <p className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] font-black text-blue-400/50 mb-1">
                    TOTAL MATCHES
                  </p>
                  <p className="text-xl md:text-3xl font-display font-black italic tracking-tighter pr-1">{matches.length}</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] font-black text-blue-400/50 mb-1">
                    TEAMS
                  </p>
                  <p className="text-xl md:text-3xl font-display font-black italic tracking-tighter pr-1">{teams.length}</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] font-black text-blue-400/50 mb-1">
                    MATCHDAYS
                  </p>
                  <p className="text-xl md:text-3xl font-display font-black italic tracking-tighter pr-1">{Object.keys(matchesByDay).length}</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] font-black text-blue-400/50 mb-1">
                    <EditableText id="footer_visits_label" defaultText="Total Visits" isAdmin={isAdmin} />
                  </p>
                  <p className="text-xl md:text-3xl font-display font-black italic tracking-tighter pr-1">{visitCount}</p>
                </div>
          </div>
          <p className="text-white/20 text-[10px] font-mono uppercase tracking-widest">
            &copy; 2026 UXI Tournament Hub
          </p>
        </div>
      </footer>
    </div>
    </>
  );
}
