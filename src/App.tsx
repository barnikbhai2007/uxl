import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Calendar, Table as TableIcon, GitBranch, ChevronRight, Star, Copy, Check, Info, Search, BarChart2, Award, Newspaper } from 'lucide-react';
import { INITIAL_TEAMS, TEAMS_LIST, TOURNAMENT_SCHEDULE } from './constants';
import { Team, Match, BracketMatch, Scorer } from './types';

// Static data mapping
const getMatchdayDate = (matchday: number) => {
  const day = 26 + matchday;
  return `${day}th March 2026`;
};

const getMatchesFromSchedule = (teams: Team[]): Match[] => {
  return TOURNAMENT_SCHEDULE.map((sm, index) => {
    const homeTeam = teams.find(t => t.name === sm.home);
    const awayTeam = teams.find(t => t.name === sm.away);
    
    let homeScore = 0;
    let awayScore = 0;
    let status: 'scheduled' | 'finished' = 'scheduled';
    let homeScorers: Scorer[] = [];
    let awayScorers: Scorer[] = [];
    let homeStats: Match['homeStats'];
    let awayStats: Match['awayStats'];

    // Inject results from images (Matchday 1)
    if (sm.matchday === 1) {
      if (sm.home === "SAGNICK" && sm.away === "PRIYAM") {
        homeScore = 0; awayScore = 3; status = 'finished';
        awayScorers = [{ playerName: 'Vini Jr.', goals: 1 }, { playerName: 'Scholes', goals: 1 }, { playerName: 'C. Ronaldo', goals: 1 }];
        homeStats = { shots: 0, shotsOnTarget: 0, possession: 45, passAccuracy: 88, fouls: 0, offsides: 0 };
        awayStats = { shots: 6, shotsOnTarget: 6, possession: 55, passAccuracy: 89, fouls: 0, offsides: 0 };
      } else if (sm.home === "SAGNIK" && sm.away === "DIBYAJOTI") {
        homeScore = 0; awayScore = 2; status = 'finished';
        awayScorers = [{ playerName: 'Rooney', goals: 2 }];
        homeStats = { shots: 2, shotsOnTarget: 2, possession: 50, passAccuracy: 89, fouls: 0, offsides: 1 };
        awayStats = { shots: 2, shotsOnTarget: 2, possession: 50, passAccuracy: 80, fouls: 0, offsides: 1 };
      } else if (sm.home === "SAGNIK" && sm.away === "PRIYAM") {
        homeScore = 0; awayScore = 4; status = 'finished';
        awayScorers = [{ playerName: 'Cruyff', goals: 1 }, { playerName: 'Bale', goals: 2 }, { playerName: 'C. Ronaldo', goals: 1 }];
        homeStats = { shots: 0, shotsOnTarget: 0, possession: 42, passAccuracy: 69, fouls: 0, offsides: 0 };
        awayStats = { shots: 10, shotsOnTarget: 9, possession: 58, passAccuracy: 92, fouls: 0, offsides: 0 };
      } else if (sm.home === "RANAJAY" && sm.away === "ARYAN") {
        homeScore = 0; awayScore = 1; status = 'finished';
        awayScorers = [{ playerName: 'C. Ronaldo', goals: 1 }];
        homeStats = { shots: 2, shotsOnTarget: 2, possession: 45, passAccuracy: 76, fouls: 1, offsides: 0 };
        awayStats = { shots: 4, shotsOnTarget: 2, possession: 55, passAccuracy: 69, fouls: 1, offsides: 0 };
      } else if (sm.home === "PRITAM" && sm.away === "AYUSH") {
        homeScore = 2; awayScore = 3; status = 'finished';
        homeScorers = [{ playerName: 'Lamine Yamal', goals: 2 }];
        awayScorers = [{ playerName: 'Garrincha', goals: 1 }, { playerName: 'Dembélé', goals: 1 }, { playerName: 'Raphinha', goals: 1 }];
        homeStats = { shots: 3, shotsOnTarget: 3, possession: 47, passAccuracy: 81, fouls: 0, offsides: 0 };
        awayStats = { shots: 5, shotsOnTarget: 5, possession: 53, passAccuracy: 78, fouls: 1, offsides: 0 };
      } else if (sm.home === "SONU" && sm.away === "ARYAN") {
        homeScore = 1; awayScore = 1; status = 'finished';
        homeScorers = [{ playerName: 'C. Ronaldo', goals: 1 }];
        awayScorers = [{ playerName: 'Messi', goals: 1 }];
        homeStats = { shots: 2, shotsOnTarget: 2, possession: 53, passAccuracy: 88, fouls: 1, offsides: 1 };
        awayStats = { shots: 3, shotsOnTarget: 3, possession: 47, passAccuracy: 75, fouls: 0, offsides: 0 };
      } else if (sm.home === "SOUMAJIT" && sm.away === "SONU") {
        homeScore = 0; awayScore = 0; status = 'finished';
        homeStats = { shots: 0, shotsOnTarget: 0, possession: 49, passAccuracy: 82, fouls: 0, offsides: 0 };
        awayStats = { shots: 2, shotsOnTarget: 1, possession: 51, passAccuracy: 79, fouls: 1, offsides: 0 };
      } else if (sm.home === "AYUSH" && sm.away === "ABHROJEET") {
        homeScore = 5; awayScore = 0; status = 'finished';
        homeScorers = [{ playerName: 'Garrincha', goals: 2 }, { playerName: 'Dembélé', goals: 1 }, { playerName: 'Raphinha', goals: 2 }];
        homeStats = { shots: 6, shotsOnTarget: 6, possession: 49, passAccuracy: 85, fouls: 0, offsides: 0 };
        awayStats = { shots: 4, shotsOnTarget: 2, possession: 51, passAccuracy: 73, fouls: 2, offsides: 0 };
      } else if (sm.home === "SAYANTAN" && sm.away === "ABHROJEET") {
        homeScore = 0; awayScore = 2; status = 'finished';
        awayScorers = [{ playerName: 'Dembélé', goals: 1 }, { playerName: 'King', goals: 1 }];
        homeStats = { shots: 3, shotsOnTarget: 3, possession: 47, passAccuracy: 68, fouls: 0, offsides: 0 };
        awayStats = { shots: 4, shotsOnTarget: 3, possession: 53, passAccuracy: 82, fouls: 0, offsides: 0 };
      } else if (sm.home === "SAGNICK" && sm.away === "ANIMESH") {
        homeScore = 0; awayScore = 2; status = 'finished';
        awayScorers = [{ playerName: 'Zieliński', goals: 1 }, { playerName: 'C. Ronaldo', goals: 1 }];
        homeStats = { shots: 0, shotsOnTarget: 0, possession: 48, passAccuracy: 82, fouls: 0, offsides: 1 };
        awayStats = { shots: 5, shotsOnTarget: 5, possession: 52, passAccuracy: 76, fouls: 0, offsides: 0 };
      }
    }

    return {
      id: `m-${index + 1}`,
      matchNumber: index + 1,
      homeTeamId: homeTeam?.id || '',
      awayTeamId: awayTeam?.id || '',
      homeScore,
      awayScore,
      homeScorers,
      awayScorers,
      homeStats,
      awayStats,
      date: getMatchdayDate(sm.matchday),
      status,
    };
  });
};

const calculateStandings = (teams: Team[], matches: Match[]): Team[] => {
  const standings = teams.map(t => ({ ...t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 }));
  
  matches.forEach(m => {
    if (m.status === 'finished' && m.homeScore !== undefined && m.awayScore !== undefined) {
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
          away.lost++;
        } else if (m.homeScore < m.awayScore) {
          away.won++;
          away.points += 3;
          home.lost++;
        } else {
          home.drawn++;
          away.drawn++;
          home.points += 1;
          away.points += 1;
        }
        home.gd = home.gf - home.ga;
        away.gd = away.gf - away.ga;
      }
    }
  });
  
  return standings.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
};

interface PlayerGoalStats {
  playerName: string;
  gamerName: string;
  gamerFullName: string;
  goals: number;
}

const calculateStats = (teams: Team[], matches: Match[]): PlayerGoalStats[] => {
  const statsMap: Record<string, PlayerGoalStats> = {};

  matches.forEach(m => {
    if (m.status === 'finished') {
      const homeTeam = teams.find(t => t.id === m.homeTeamId);
      const awayTeam = teams.find(t => t.id === m.awayTeamId);

      if (homeTeam && m.homeScorers) {
        m.homeScorers.forEach(s => {
          const key = `${s.playerName}-${homeTeam.id}`;
          if (!statsMap[key]) {
            statsMap[key] = {
              playerName: s.playerName,
              gamerName: homeTeam.name,
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
              playerName: s.playerName,
              gamerName: awayTeam.name,
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

const NEWS_POSTS = [
  {
    id: 13,
    title: "ANIMESH SECURES COMFORTABLE WIN",
    excerpt: "Animesh defeats Sagnick Roy 2-0 in a dominant display. Zieliński and C. Ronaldo provided the clinical finishes.",
    date: "27th March 2026",
    category: "MATCH REPORT"
  },
  {
    id: 12,
    title: "ABHROJEET BOUNCES BACK",
    excerpt: "After a tough loss earlier, Abhrojeet Kundu secures a solid 2-0 victory over Sayantan Paul. Dembélé and King provided the goals.",
    date: "27th March 2026",
    category: "MATCH REPORT"
  },
  {
    id: 11,
    title: "AYUSH SAHA DOMINATES ABHROJEET",
    excerpt: "Ayush Saha puts on a clinical performance, defeating Abhrojeet Kundu 5-0. Garrincha and Raphinha both bagged braces in the rout.",
    date: "27th March 2026",
    category: "MATCH REPORT"
  },
  {
    id: 10,
    title: "STALEMATE FOR SONU AND SOUMAJIT",
    excerpt: "A defensive masterclass from both sides results in a 0-0 draw. Scoring opportunities were rare in this Matchday 1 clash.",
    date: "27th March 2026",
    category: "MATCH REPORT"
  },
  {
    id: 9,
    title: "ARYAN AND SONU SHARE POINTS",
    excerpt: "A tactical battle between Aryan Sarkar and Sonu Mandal ends in a 1-1 draw, with Messi and Ronaldo both finding the net.",
    date: "27th March 2026",
    category: "MATCH REPORT"
  },
  {
    id: 8,
    title: "AYUSH EDGES PRITAM IN THRILLER",
    excerpt: "Ayush Saha secures a hard-fought 3-2 victory over Pritam Ghosh in the first high-scoring match of the tournament.",
    date: "27th March 2026",
    category: "MATCH REPORT"
  },
  {
    id: 4,
    title: "MATCHDAY 1: 10/16 COMPLETED",
    excerpt: "The tournament is in full swing with 10 matches completed. 6 more high-stakes fixtures remain for today.",
    date: "27th March 2026",
    category: "TOURNAMENT STATUS"
  },
  {
    id: 3,
    title: "ARYAN EDGES RANAJAY",
    excerpt: "In a tight contest, Aryan Sarkar secures a 1-0 win over Ranajay Bhowmik with a goal from C. Ronaldo.",
    date: "27th March 2026",
    category: "MATCHDAY 1"
  },
  {
    id: 2,
    title: "ROONEY BRACE FOR DIBYAJOTI",
    excerpt: "Dibyajyoti Sarkar defeats Sagnik Kundu 2-0 thanks to a clinical double from Wayne Rooney.",
    date: "27th March 2026",
    category: "MATCHDAY 1"
  },
  {
    id: 1,
    title: "PRIYAM PAUL ON FIRE",
    excerpt: "Priyam Paul secures two massive clean-sheet victories against Sagnick (3-0) and Sagnik (4-0), scoring 7 goals in total.",
    date: "27th March 2026",
    category: "MATCHDAY 1"
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'fixtures' | 'table' | 'bracket' | 'stats' | 'hallOfFame' | 'news'>('fixtures');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const teams = useMemo(() => INITIAL_TEAMS, []);
  const matches = useMemo(() => getMatchesFromSchedule(teams), [teams]);
  const standings = useMemo(() => calculateStandings(teams, matches), [teams, matches]);
  const stats = useMemo(() => calculateStats(teams, matches).slice(0, 5), [teams, matches]);
  const upcomingRef = React.useRef<HTMLDivElement>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const TeamNameWithCopy = ({ team, size = 'lg', reverse = false, showCopy = true }: { team: Team | undefined, size?: 'sm' | 'lg', reverse?: boolean, showCopy?: boolean }) => {
    if (!team) return (
      <div className={`flex items-center ${reverse ? 'flex-row-reverse' : ''} min-w-0 opacity-20`}>
        <span className={`font-display font-black tracking-tight whitespace-nowrap uppercase italic truncate pr-1 ${
          size === 'lg' ? 'text-xs md:text-lg' : 'text-xs md:text-sm'
        }`}>TBD</span>
      </div>
    );
    return (
      <div className={`flex items-center ${showCopy ? 'gap-2 md:gap-3' : ''} group/name ${reverse ? 'flex-row-reverse' : ''} min-w-0`}>
        <span className={`font-display font-black tracking-tight whitespace-nowrap uppercase italic truncate pr-1 ${
          size === 'lg' ? 'text-xs md:text-lg' : 'text-xs md:text-sm'
        }`}>{team.name}</span>
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

  const MatchDetailsModal = ({ match, onClose }: { match: Match, onClose: () => void }) => {
    const homeTeam = teams.find(t => t.id === match.homeTeamId);
    const awayTeam = teams.find(t => t.id === match.awayTeamId);

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
          {/* Header Decor */}
          <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-blue-500/20 to-transparent pointer-events-none" />
          
          <div className="p-8 relative z-10">
            {/* Faded Match Number in Modal Background */}
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
              <div className="flex-1 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl md:text-4xl shadow-lg">
                  {awayTeam?.name[0] || '?'}
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
                      <span key={i} className="text-[10px] font-bold text-white/40 italic">
                        {s.playerName} {Array.from({ length: s.goals }).map((_, idx) => <span key={idx}>⚽</span>)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center gap-2 md:gap-4">
                <div className="text-[10px] md:text-xs font-black text-blue-400/50 uppercase tracking-widest">Score</div>
                <div className="flex items-center gap-4 md:gap-6">
                  <span className="text-4xl md:text-6xl font-black tabular-nums">{match.awayScore ?? '-'}</span>
                  <span className="text-white/10 font-black text-xl md:text-2xl">VS</span>
                  <span className="text-4xl md:text-6xl font-black tabular-nums">{match.homeScore ?? '-'}</span>
                </div>
                <div className={`px-3 md:px-4 py-1 md:py-1.5 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${
                  match.status === 'finished' ? 'bg-green-500/20 text-green-400' : (match.date === '27th March 2026' ? 'bg-red-500/20 text-red-400' : 'bg-blue-600/20 text-blue-400')
                }`}>
                  {match.date === '27th March 2026' && match.status !== 'finished' && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  )}
                  {match.status === 'finished' ? 'Final Result' : (match.date === '27th March 2026' ? 'Ongoing' : 'Match Scheduled')}
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl md:text-4xl shadow-lg">
                  {homeTeam?.name[0] || '?'}
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
                      <span key={i} className="text-[10px] font-bold text-white/40 italic">
                        {s.playerName} {Array.from({ length: s.goals }).map((_, idx) => <span key={idx}>⚽</span>)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Match Stats */}
            {match.status === 'finished' && match.homeStats && match.awayStats && (
              <div className="mt-8 space-y-4 p-6 bg-white/5 rounded-2xl border border-white/5">
                <div className="text-center mb-2">
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Match Statistics</span>
                </div>
                <div className="grid gap-4">
                  <StatRow 
                    home={`${match.awayStats.shotsOnTarget}/${match.awayStats.shots}`} 
                    away={`${match.homeStats.shotsOnTarget}/${match.homeStats.shots}`} 
                    label="Shots (On Target)" 
                    homeVal={match.awayStats.shots}
                    awayVal={match.homeStats.shots}
                  />
                  <StatRow home={match.awayStats.possession} away={match.homeStats.possession} label="Possession" suffix="%" />
                  <StatRow home={match.awayStats.passAccuracy} away={match.homeStats.passAccuracy} label="Pass Accuracy" suffix="%" />
                  <StatRow home={match.awayStats.fouls} away={match.homeStats.fouls} label="Fouls" />
                  <StatRow home={match.awayStats.offsides} away={match.homeStats.offsides} label="Offsides" />
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 p-6 bg-white/5 rounded-2xl border border-white/5">
              <div className="text-center space-y-1">
                <div className="text-[10px] font-black text-white/30 uppercase tracking-widest">Match Date</div>
                <div className="text-sm font-bold text-blue-400">{match.date}</div>
              </div>
              <div className="text-center space-y-1 border-l border-white/5">
                <div className="text-[10px] font-black text-white/30 uppercase tracking-widest">Match No.</div>
                <div className="text-sm font-bold text-blue-400">#{match.matchNumber}</div>
              </div>
            </div>

            <div className="mt-8 flex justify-center">
              <button 
                onClick={onClose}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-blue-600/20"
              >
                Close Details
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
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
      if (!grouped[m.date]) grouped[m.date] = [];
      grouped[m.date].push(m);
    });
    return grouped;
  }, [matches, searchTerm, teams]);

  const firstUpcomingDay = useMemo(() => {
    const days = Object.keys(matchesByDay).sort((a, b) => a.localeCompare(b));
    return days.find(day => matchesByDay[day].some(m => m.status !== 'finished'));
  }, [matchesByDay]);

  const bracketMatches: BracketMatch[] = [];

  return (
    <div className="min-h-screen bg-[#000030] text-white font-sans selection:bg-blue-500/30 relative overflow-hidden">
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
          className="z-10 text-center px-4"
        >
          <Trophy className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]" />
          <h1 className="font-display text-3xl md:text-6xl font-black tracking-tighter uppercase italic leading-none pr-2">
            UXI <span className="text-blue-400">Tournament</span>
          </h1>
          <p className="text-blue-200/60 mt-2 font-mono text-[10px] md:text-sm tracking-[0.2em] md:tracking-[0.4em] uppercase">Elite Competition</p>
        </motion.div>
      </header>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#000030]/90 backdrop-blur-2xl border-b border-white/10 py-4 md:py-6">
        <div className="max-w-xl mx-auto px-4">
          <div className="relative flex p-1.5 bg-white/5 rounded-2xl border border-white/10 shadow-2xl overflow-x-auto no-scrollbar">
            {[
              { id: 'fixtures', label: 'Fixtures', icon: Calendar },
              { id: 'table', label: 'Table', icon: TableIcon },
              { id: 'bracket', label: 'Bracket', icon: GitBranch },
              { id: 'stats', label: 'Stats', icon: BarChart2 },
              { id: 'hallOfFame', label: 'H.O.F', icon: Award },
              { id: 'news', label: 'News', icon: Newspaper },
            ].map((tab) => (
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
          {activeTab === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-blue-600/20 rounded-2xl border border-blue-500/30">
                  <BarChart2 className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-black uppercase italic tracking-tight leading-none">Top Scorers</h2>
                  <p className="text-blue-200/40 text-xs uppercase tracking-widest mt-1">Individual Player Statistics</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
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
                      <tr key={`${stat.playerName}-${stat.gamerName}`} className="hover:bg-white/5 transition-colors">
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
                        <td colSpan={4} className="px-6 py-12 text-center">
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
            </motion.div>
          )}

          {activeTab === 'news' && (
            <motion.div
              key="news"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto px-4 py-8 space-y-6"
            >
              <div className="flex items-center gap-4 mb-8">
                <Newspaper className="w-6 h-6 text-blue-400" />
                <h2 className="text-2xl font-black uppercase italic tracking-tighter">Tournament <span className="text-blue-400">Glimpse</span></h2>
              </div>

              <div className="space-y-4">
                {NEWS_POSTS.map((post) => (
                  <motion.article
                    key={post.id}
                    whileHover={{ x: 4 }}
                    className="bg-white/5 border-l-2 border-blue-500 p-5 rounded-r-2xl shadow-lg group cursor-pointer hover:bg-white/[0.08] transition-all"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">
                        {post.category}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-white/20" />
                      <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">{post.date}</span>
                    </div>
                    <h3 className="text-lg font-black uppercase italic tracking-tight mb-1 group-hover:text-blue-400 transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-xs text-white/50 leading-relaxed font-medium">
                      {post.excerpt}
                    </p>
                  </motion.article>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'hallOfFame' && (
            <motion.div
              key="hallOfFame"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
                <Award className="w-24 h-24 text-blue-400 relative z-10 animate-pulse" />
              </div>
              <h2 className="font-display text-4xl font-black uppercase italic tracking-tighter mb-4">Hall of Fame</h2>
              <div className="max-w-md space-y-4">
                <p className="text-blue-200/60 font-mono text-sm uppercase tracking-widest leading-relaxed">
                  The legends of UXI are forged in the heat of competition.
                </p>
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">
                    Season Currently Ongoing
                  </p>
                  <p className="text-white/30 text-[9px] uppercase tracking-widest mt-2">
                    Winners will be immortalized here upon completion.
                  </p>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {standings.map((team, index) => {
                    let rowClass = "hover:bg-white/5 transition-colors";
                    if (index < 4) rowClass += " bg-green-500/5";
                    if (index >= 12) rowClass += " bg-red-500/5";
                    
                    return (
                      <tr key={team.id} className={`${rowClass} relative group/row`}>
                        <td className="px-3 md:px-6 py-3 md:py-4 relative">
                          <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold text-xs md:text-sm relative z-10 ${
                            index < 4 ? 'bg-green-500/20 text-green-400' : 
                            index >= 12 ? 'bg-red-500/20 text-red-400' : 
                            'bg-white/10 text-white/70'
                          }`}>
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4">
                          <div className="flex items-center min-w-0">
                            <span className="font-display font-black tracking-tight whitespace-nowrap uppercase italic truncate pr-1 text-xs md:text-sm">
                              {team.fullName}
                            </span>
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
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-center justify-between bg-white/5 border border-white/10 p-4 md:p-6 rounded-2xl backdrop-blur-sm">
                <div className="flex items-center gap-3 md:gap-4">
                  <Info className="w-4 h-4 md:w-5 md:h-5 text-blue-400 shrink-0" />
                  <p className="text-[10px] md:text-sm text-blue-200/80 italic pr-1">
                    Note: <span className="text-white font-bold">Left</span> is Away, <span className="text-white font-bold">Right</span> is Home.
                  </p>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input
                    type="text"
                    placeholder="Search player, FC or full name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-white/20"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    >
                      &times;
                    </button>
                  )}
                </div>
              </div>

              {Object.entries(matchesByDay).sort((a, b) => a[0].localeCompare(b[0])).map(([day, dayMatches]) => (
                <div key={day} ref={day === firstUpcomingDay ? upcomingRef : null} className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-blue-500/30" />
                    <h2 className="text-xl font-black uppercase italic tracking-widest text-blue-400 px-4 py-2 bg-blue-500/5 border border-blue-500/10 rounded-lg pr-5">
                      {day}
                    </h2>
                    <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-blue-500/30" />
                  </div>

                  <div className="grid gap-4">
                    {(dayMatches as Match[]).map((match) => {
                      const homeTeam = teams.find(t => t.id === match.homeTeamId);
                      const awayTeam = teams.find(t => t.id === match.awayTeamId);
                      
                      return (
                        <div 
                          key={match.id} 
                          onClick={() => setSelectedMatch(match)}
                          className="group bg-white/5 border border-white/10 rounded-xl p-4 md:p-6 flex items-center justify-between hover:border-blue-500/50 transition-all duration-300 relative overflow-hidden cursor-pointer"
                        >
                          {/* Decorative Corner Accents */}
                          <div className="absolute top-0 left-0 w-8 h-8 pointer-events-none">
                            <div className="absolute top-0 left-0 w-[1px] h-4 bg-blue-500/30" />
                            <div className="absolute top-0 left-0 w-4 h-[1px] bg-blue-500/30" />
                          </div>
                          <div className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none">
                            <div className="absolute bottom-0 right-0 w-[1px] h-4 bg-blue-500/30" />
                            <div className="absolute bottom-0 right-0 w-4 h-[1px] bg-blue-500/30" />
                          </div>

                          {/* Background Match Number Decor - Fixed Positioning and Visibility */}
                          <div className="absolute right-0 bottom-0 text-9xl md:text-[12rem] font-black text-white/[0.12] italic select-none pointer-events-none group-hover:text-blue-500/[0.25] transition-all duration-500 group-hover:-translate-y-2 pr-4">
                            {match.matchNumber}
                          </div>

                          {/* Background Glow */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                          
                          {/* Away Team (Left) */}
                          <div className="flex-1 flex justify-end pr-2 md:pr-8 relative z-10 min-w-0">
                            <TeamNameWithCopy team={awayTeam} showCopy={false} />
                          </div>
                          
                          {/* Score/VS (Center) */}
                          <div className="flex flex-col items-center gap-1 md:gap-2 px-3 md:px-8 border-x border-white/10 relative z-10 min-w-[110px] md:min-w-[180px] shrink-0">
                            <div className="flex items-center gap-1 md:gap-2">
                              <div className="h-[1px] w-2 md:w-4 bg-blue-500/30" />
                              <span className="text-[8px] md:text-[9px] font-black text-blue-400/50 uppercase tracking-[0.2em] md:tracking-[0.3em]">Match {match.matchNumber}</span>
                              <div className="h-[1px] w-2 md:w-4 bg-blue-500/30" />
                            </div>
                            <div className={`px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                              match.status === 'finished' ? 'bg-green-500/20 text-green-400' : (day === '27th March 2026' ? 'bg-red-500/20 text-red-400' : 'bg-blue-600/20 text-blue-400')
                            }`}>
                              {day === '27th March 2026' && match.status !== 'finished' && (
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                                </span>
                              )}
                              {match.status === 'finished' ? 'Final' : (day === '27th March 2026' ? 'Ongoing' : 'Upcoming')}
                            </div>
                            <div className="flex items-center gap-2 md:gap-4">
                              <span className={`text-2xl md:text-3xl font-black tabular-nums ${match.status === 'finished' ? 'text-white' : 'text-white/20'}`}>
                                {match.awayScore ?? '-'}
                              </span>
                              <span className="text-white/10 font-bold text-[10px]">VS</span>
                              <span className={`text-2xl md:text-3xl font-black tabular-nums ${match.status === 'finished' ? 'text-white' : 'text-white/20'}`}>
                                {match.homeScore ?? '-'}
                              </span>
                            </div>
                          </div>

                          {/* Home Team (Right) */}
                          <div className="flex-1 flex justify-start pl-2 md:pl-8 relative z-10 min-w-0">
                            <TeamNameWithCopy team={homeTeam} reverse={true} showCopy={false} />
                          </div>

                          {/* Mobile Click Indicator */}
                          <div className="md:hidden ml-2 text-white/20">
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
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
                <div className="flex flex-col justify-around gap-8">
                  <h3 className="text-blue-400 font-black uppercase tracking-widest text-[10px] mb-4 text-center">Round of 16</h3>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={`r16-${i}`} className="relative">
                      <div 
                        onClick={() => setSelectedMatch({
                          id: `r16-${i}`,
                          matchNumber: 100 + i,
                          homeTeamId: '',
                          awayTeamId: '',
                          homeScore: 0,
                          awayScore: 0,
                          date: 'TBD',
                          status: 'scheduled'
                        })}
                        className="w-48 bg-white/5 border border-white/10 rounded-lg overflow-hidden shadow-lg cursor-pointer hover:border-blue-500/50 transition-all group/match relative"
                      >
                        <div className={`p-2 flex justify-between items-center text-sm ${i % 2 === 0 ? 'bg-blue-500/10' : ''} relative z-10`}>
                          <span className="font-display font-black truncate max-w-[100px] text-white/20 uppercase italic group-hover/match:text-white/40 transition-colors pr-1">TBD</span>
                          <span className="font-mono font-bold text-white/20">0</span>
                        </div>
                        <div className={`p-2 flex justify-between items-center text-sm border-t border-white/5 ${i % 2 !== 0 ? 'bg-blue-500/10' : ''}`}>
                          <span className="font-display font-black truncate max-w-[100px] text-white/20 uppercase italic group-hover/match:text-white/40 transition-colors pr-1">TBD</span>
                          <span className="font-mono font-bold text-white/20">0</span>
                        </div>
                      </div>
                      {/* Connector Line */}
                      <div className={`absolute -right-8 top-1/2 w-8 h-[1px] bg-white/20`} />
                      {i % 2 === 0 ? (
                        <div className="absolute -right-8 top-1/2 w-[1px] h-[calc(100%+32px)] bg-white/20" />
                      ) : null}
                    </div>
                  ))}
                </div>

                {/* Quarter Finals */}
                <div className="flex flex-col justify-around gap-16">
                  <h3 className="text-blue-400 font-black uppercase tracking-widest text-xs mb-4 text-center">Quarter-Finals</h3>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={`qf-${i}`} className="relative">
                      <div 
                        onClick={() => setSelectedMatch({
                          id: `qf-${i}`,
                          matchNumber: 200 + i,
                          homeTeamId: '',
                          awayTeamId: '',
                          homeScore: 0,
                          awayScore: 0,
                          date: 'TBD',
                          status: 'scheduled'
                        })}
                        className="w-48 bg-white/5 border border-white/10 rounded-lg overflow-hidden shadow-lg cursor-pointer hover:border-blue-500/50 transition-all group/match relative"
                      >
                        <div className="p-2 flex justify-between items-center text-sm relative z-10">
                          <span className="font-display font-black truncate max-w-[100px] text-white/20 uppercase italic group-hover/match:text-white/40 transition-colors pr-1">TBD</span>
                          <span className="font-mono font-bold text-white/20">0</span>
                        </div>
                        <div className="p-2 flex justify-between items-center text-sm border-t border-white/5">
                          <span className="font-display font-black truncate max-w-[100px] text-white/20 uppercase italic group-hover/match:text-white/40 transition-colors pr-1">TBD</span>
                          <span className="font-mono font-bold text-white/20">0</span>
                        </div>
                      </div>
                      {/* Connector Line */}
                      <div className={`absolute -right-8 top-1/2 w-8 h-[1px] bg-white/20`} />
                      {i % 2 === 0 ? (
                        <div className="absolute -right-8 top-1/2 w-[1px] h-[calc(100%+112px)] bg-white/20" />
                      ) : null}
                    </div>
                  ))}
                </div>

                {/* Semi Finals */}
                <div className="flex flex-col justify-around gap-32">
                  <h3 className="text-blue-400 font-black uppercase tracking-widest text-xs mb-4 text-center">Semi-Finals</h3>
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={`sf-${i}`} className="relative">
                      <div 
                        onClick={() => setSelectedMatch({
                          id: `sf-${i}`,
                          matchNumber: 300 + i,
                          homeTeamId: '',
                          awayTeamId: '',
                          homeScore: 0,
                          awayScore: 0,
                          date: 'TBD',
                          status: 'scheduled'
                        })}
                        className="w-48 bg-white/5 border border-white/10 rounded-lg overflow-hidden shadow-lg cursor-pointer hover:border-blue-500/50 transition-all group/match relative"
                      >
                        <div className="p-2 flex justify-between items-center text-sm relative z-10">
                          <span className="font-display font-black truncate max-w-[100px] uppercase italic text-white/40 group-hover/match:text-white/60 transition-colors pr-1">Winner</span>
                          <span className="font-mono font-bold">-</span>
                        </div>
                        <div className="p-2 flex justify-between items-center text-sm border-t border-white/5">
                          <span className="font-display font-black truncate max-w-[100px] uppercase italic text-white/40 group-hover/match:text-white/60 transition-colors pr-1">Winner</span>
                          <span className="font-mono font-bold">-</span>
                        </div>
                      </div>
                      {/* Connector Line */}
                      <div className={`absolute -right-8 top-1/2 w-8 h-[1px] bg-white/20`} />
                      {i % 2 === 0 ? (
                        <div className="absolute -right-8 top-1/2 w-[1px] h-[calc(100%+272px)] bg-white/20" />
                      ) : null}
                    </div>
                  ))}
                </div>

                {/* Final */}
                <div className="flex flex-col justify-center gap-12">
                  <div>
                    <h3 className="text-yellow-400 font-black uppercase tracking-widest text-xs mb-4 text-center">Grand Final</h3>
                    <div 
                      onClick={() => setSelectedMatch({
                        id: 'final',
                        matchNumber: 400,
                        homeTeamId: '',
                        awayTeamId: '',
                        homeScore: 0,
                        awayScore: 0,
                        date: 'TBD',
                        status: 'scheduled'
                      })}
                      className="w-56 bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-yellow-500/30 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(234,179,8,0.1)] p-1 cursor-pointer hover:border-yellow-400 transition-all group/match relative"
                    >
                      <div className="bg-[#000030] rounded-lg overflow-hidden relative z-10">
                        <div className="p-4 flex justify-between items-center">
                          <span className="font-display font-black text-base uppercase italic tracking-tighter text-white/40 group-hover/match:text-white/60 transition-colors pr-1">Finalist 1</span>
                          <span className="font-mono font-black text-2xl">-</span>
                        </div>
                        <div className="p-4 flex justify-between items-center border-t border-white/5">
                          <span className="font-display font-black text-base uppercase italic tracking-tighter text-white/40 group-hover/match:text-white/60 transition-colors pr-1">Finalist 2</span>
                          <span className="font-mono font-black text-2xl">-</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-blue-400/50 font-black uppercase tracking-widest text-xs mb-4 text-center">3rd Place Match</h3>
                    <div 
                      onClick={() => setSelectedMatch({
                        id: '3rd',
                        matchNumber: 399,
                        homeTeamId: '',
                        awayTeamId: '',
                        homeScore: 0,
                        awayScore: 0,
                        date: 'TBD',
                        status: 'scheduled'
                      })}
                      className="w-56 bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-lg cursor-pointer hover:border-blue-500/50 transition-all group/match relative"
                    >
                      <div className="p-3 flex justify-between items-center text-sm relative z-10">
                        <span className="font-display font-black truncate max-w-[100px] text-white/40 uppercase italic group-hover/match:text-white/60 transition-colors pr-1">Loser SF1</span>
                        <span className="font-mono font-bold text-white/40">-</span>
                      </div>
                      <div className="p-3 flex justify-between items-center border-t border-white/5 text-sm">
                        <span className="font-display font-black truncate max-w-[100px] text-white/40 uppercase italic group-hover/match:text-white/60 transition-colors pr-1">Loser SF2</span>
                        <span className="font-mono font-bold text-white/40">-</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col items-center">
                    <Trophy className="w-12 h-12 text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)] mb-2" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-500/50">Champion</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {selectedMatch && (
          <MatchDetailsModal 
            match={selectedMatch} 
            onClose={() => setSelectedMatch(null)} 
          />
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="mt-20 py-8 md:py-12 border-t border-white/10 bg-black/20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-8">
                <div className="text-center md:text-left">
                  <p className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] font-black text-blue-400/50 mb-1">Total Matches</p>
                  <p className="text-xl md:text-3xl font-display font-black italic tracking-tighter pr-1">72</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] font-black text-blue-400/50 mb-1">Teams</p>
                  <p className="text-xl md:text-3xl font-display font-black italic tracking-tighter pr-1">16</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.3em] font-black text-blue-400/50 mb-1">Matchdays</p>
                  <p className="text-xl md:text-3xl font-display font-black italic tracking-tighter pr-1">5</p>
                </div>
          </div>
          <p className="text-white/20 text-[10px] font-mono uppercase tracking-widest">
            &copy; 2026 UXI Tournament Hub
          </p>
        </div>
      </footer>
    </div>
  );
}
