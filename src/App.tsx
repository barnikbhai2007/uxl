import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Calendar, Table as TableIcon, GitBranch, ChevronRight, Star, Copy, Check, Info, Search } from 'lucide-react';
import { INITIAL_TEAMS, TEAMS_LIST, TOURNAMENT_SCHEDULE } from './constants';
import { Team, Match, BracketMatch } from './types';

// Static data mapping
const getMatchdayDate = (matchday: number) => {
  const day = 26 + matchday;
  return `${day}th March 2026`;
};

const getMatchesFromSchedule = (teams: Team[]): Match[] => {
  return TOURNAMENT_SCHEDULE.map((sm, index) => {
    const homeTeam = teams.find(t => t.name === sm.home);
    const awayTeam = teams.find(t => t.name === sm.away);
    
    return {
      id: `m-${index + 1}`,
      matchNumber: index + 1,
      homeTeamId: homeTeam?.id || '',
      awayTeamId: awayTeam?.id || '',
      homeScore: 0,
      awayScore: 0,
      date: getMatchdayDate(sm.matchday),
      status: 'scheduled',
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

export default function App() {
  const [activeTab, setActiveTab] = useState<'fixtures' | 'table' | 'bracket'>('fixtures');
  const [searchTerm, setSearchTerm] = useState('');
  const teams = useMemo(() => INITIAL_TEAMS, []);
  const matches = useMemo(() => getMatchesFromSchedule(teams), [teams]);
  const standings = useMemo(() => calculateStandings(teams, matches), [teams, matches]);
  const upcomingRef = React.useRef<HTMLDivElement>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (uid: string) => {
    navigator.clipboard.writeText(uid);
    setCopiedId(uid);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const TeamNameWithCopy = ({ team, size = 'lg', reverse = false }: { team: Team | undefined, size?: 'sm' | 'lg', reverse?: boolean }) => {
    if (!team) return null;
    return (
      <div className={`flex items-center gap-3 group/name ${reverse ? 'flex-row-reverse' : ''}`}>
        <span className={`font-display font-black tracking-tight whitespace-nowrap uppercase italic ${size === 'lg' ? 'text-lg' : 'text-sm'}`}>{team.name}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            copyToClipboard(team.uid);
          }}
          className={`${size === 'lg' ? 'p-1.5' : 'p-1'} rounded-md bg-white/5 hover:bg-white/10 text-blue-400/70 hover:text-blue-400 flex items-center gap-1 transition-all`}
          title="Click to copy UID"
        >
          {copiedId === team.uid ? (
            <Check className="w-3 h-3 text-green-400" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
          <span className="text-[8px] font-black uppercase tracking-tighter">UID</span>
        </button>
      </div>
    );
  };

  const matchesByDay = useMemo(() => {
    const grouped: Record<string, Match[]> = {};
    const filtered = searchTerm 
      ? matches.filter(m => {
          const home = teams.find(t => t.id === m.homeTeamId)?.name.toLowerCase();
          const away = teams.find(t => t.id === m.awayTeamId)?.name.toLowerCase();
          return home?.includes(searchTerm.toLowerCase()) || away?.includes(searchTerm.toLowerCase());
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

  React.useEffect(() => {
    if (activeTab === 'fixtures' && upcomingRef.current) {
      // Small delay to ensure the tab content is rendered before scrolling
      const timer = setTimeout(() => {
        upcomingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab, firstUpcomingDay]);

  const bracketMatches: BracketMatch[] = [];

  return (
    <div className="min-h-screen bg-[#000030] text-white font-sans selection:bg-blue-500/30 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#000030] via-transparent to-transparent" />
      </div>

      {/* Header */}
      <header className="relative h-64 flex flex-col items-center justify-center overflow-hidden border-b border-white/10">
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
          className="z-10 text-center"
        >
          <Trophy className="w-16 h-16 mx-auto mb-4 text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]" />
          <h1 className="font-display text-4xl md:text-6xl font-black tracking-tighter uppercase italic">
            UXI <span className="text-blue-400">Tournament</span>
          </h1>
          <p className="text-blue-200/60 mt-2 font-mono text-sm tracking-[0.4em] uppercase">Elite Competition</p>
        </motion.div>
      </header>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-[#000030]/80 backdrop-blur-xl border-b border-white/10 py-6">
        <div className="max-w-md mx-auto px-4">
          <div className="relative flex p-1 bg-white/5 rounded-2xl border border-white/10">
            {[
              { id: 'fixtures', label: 'Fixtures', icon: Calendar },
              { id: 'table', label: 'Table', icon: TableIcon },
              { id: 'bracket', label: 'Bracket', icon: GitBranch },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all duration-500 z-10 ${
                  activeTab === tab.id ? 'text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <tab.icon className={`w-4 h-4 relative z-20 transition-transform duration-500 ${activeTab === tab.id ? 'scale-110' : 'scale-100'}`} />
                <span className="relative z-20 font-black uppercase text-[10px] tracking-[0.2em]">
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
                  <tr className="bg-white/5 text-blue-200/50 text-[10px] uppercase tracking-[0.2em] font-bold">
                    <th className="px-6 py-4">Pos</th>
                    <th className="px-6 py-4">Team</th>
                    <th className="px-6 py-4 text-center">P</th>
                    <th className="px-6 py-4 text-center">W</th>
                    <th className="px-6 py-4 text-center">D</th>
                    <th className="px-6 py-4 text-center">L</th>
                    <th className="px-6 py-4 text-center">GF</th>
                    <th className="px-6 py-4 text-center">GA</th>
                    <th className="px-6 py-4 text-center">GD</th>
                    <th className="px-6 py-4 text-center">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {standings.map((team, index) => {
                    let rowClass = "hover:bg-white/5 transition-colors";
                    if (index < 4) rowClass += " bg-green-500/10";
                    if (index >= 12) rowClass += " bg-red-500/10";
                    
                    return (
                      <tr key={team.id} className={rowClass}>
                        <td className="px-6 py-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            index < 4 ? 'bg-green-500/20 text-green-400' : 
                            index >= 12 ? 'bg-red-500/20 text-red-400' : 
                            'bg-white/10 text-white/70'
                          }`}>
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <TeamNameWithCopy team={team} size="sm" />
                        </td>
                        <td className="px-6 py-4 text-center font-mono text-white/60">{team.played}</td>
                        <td className="px-6 py-4 text-center font-mono text-white/60">{team.won}</td>
                        <td className="px-6 py-4 text-center font-mono text-white/60">{team.drawn}</td>
                        <td className="px-6 py-4 text-center font-mono text-white/60">{team.lost}</td>
                        <td className="px-6 py-4 text-center font-mono text-white/60">{team.gf}</td>
                        <td className="px-6 py-4 text-center font-mono text-white/60">{team.ga}</td>
                        <td className="px-6 py-4 text-center font-mono text-white/60">{team.gd > 0 ? `+${team.gd}` : team.gd}</td>
                        <td className="px-6 py-4 text-center font-black text-blue-400">{team.points}</td>
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
              <div className="flex flex-col md:flex-row gap-6 items-center justify-between bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <Info className="w-5 h-5 text-blue-400 shrink-0" />
                  <p className="text-sm text-blue-200/80 italic">
                    Note: In the schedule below, the <span className="text-white font-bold">Left side</span> is Away and the <span className="text-white font-bold">Right side</span> is Home.
                  </p>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input
                    type="text"
                    placeholder="Search player name..."
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
                    <h2 className="text-xl font-black uppercase italic tracking-widest text-blue-400 px-4 py-2 bg-blue-500/5 border border-blue-500/10 rounded-lg">
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
                          className="group bg-white/5 border border-white/10 rounded-xl p-6 flex items-center justify-between hover:border-blue-500/50 transition-all duration-300 relative overflow-hidden"
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

                          {/* Background Match Number Decor */}
                          <div className="absolute -right-4 -bottom-8 text-8xl font-black text-white/[0.02] italic select-none pointer-events-none group-hover:text-blue-500/[0.05] transition-colors duration-500">
                            {match.matchNumber}
                          </div>

                          {/* Background Glow */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                          
                          {/* Away Team (Left) */}
                          <div className="flex-1 flex justify-end pr-8 relative z-10">
                            <TeamNameWithCopy team={awayTeam} />
                          </div>
                          
                          {/* Score/VS (Center) */}
                          <div className="flex flex-col items-center gap-2 px-8 border-x border-white/10 relative z-10 min-w-[180px]">
                            <div className="flex items-center gap-2">
                              <div className="h-[1px] w-4 bg-blue-500/30" />
                              <span className="text-[9px] font-black text-blue-400/50 uppercase tracking-[0.3em]">Match {match.matchNumber}</span>
                              <div className="h-[1px] w-4 bg-blue-500/30" />
                            </div>
                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              match.status === 'finished' ? 'bg-green-500/20 text-green-400' : 'bg-blue-600/20 text-blue-400'
                            }`}>
                              {match.status === 'finished' ? 'Final' : 'Scheduled'}
                            </div>
                            <div className="flex items-center gap-4">
                              <span className={`text-3xl font-black tabular-nums ${match.status === 'finished' ? 'text-white' : 'text-white/20'}`}>
                                {match.awayScore ?? '-'}
                              </span>
                              <span className="text-white/10 font-bold text-xs">VS</span>
                              <span className={`text-3xl font-black tabular-nums ${match.status === 'finished' ? 'text-white' : 'text-white/20'}`}>
                                {match.homeScore ?? '-'}
                              </span>
                            </div>
                          </div>

                          {/* Home Team (Right) */}
                          <div className="flex-1 flex justify-start pl-8 relative z-10">
                            <TeamNameWithCopy team={homeTeam} reverse={true} />
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
                      <div className="w-48 bg-white/5 border border-white/10 rounded-lg overflow-hidden shadow-lg">
                        <div className={`p-2 flex justify-between items-center text-xs ${i % 2 === 0 ? 'bg-blue-500/10' : ''}`}>
                          <span className="font-display font-black truncate max-w-[100px] text-white/20 uppercase italic">TBD</span>
                          <span className="font-mono font-bold text-white/20">0</span>
                        </div>
                        <div className={`p-2 flex justify-between items-center text-xs border-t border-white/5 ${i % 2 !== 0 ? 'bg-blue-500/10' : ''}`}>
                          <span className="font-display font-black truncate max-w-[100px] text-white/20 uppercase italic">TBD</span>
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
                  <h3 className="text-blue-400 font-black uppercase tracking-widest text-[10px] mb-4 text-center">Quarter-Finals</h3>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={`qf-${i}`} className="relative">
                      <div className="w-48 bg-white/5 border border-white/10 rounded-lg overflow-hidden shadow-lg">
                        <div className="p-2 flex justify-between items-center text-xs">
                          <span className="font-display font-black truncate max-w-[100px] text-white/20 uppercase italic">TBD</span>
                          <span className="font-mono font-bold text-white/20">0</span>
                        </div>
                        <div className="p-2 flex justify-between items-center text-xs border-t border-white/5">
                          <span className="font-display font-black truncate max-w-[100px] text-white/20 uppercase italic">TBD</span>
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
                  <h3 className="text-blue-400 font-black uppercase tracking-widest text-[10px] mb-4 text-center">Semi-Finals</h3>
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={`sf-${i}`} className="relative">
                      <div className="w-48 bg-white/5 border border-white/10 rounded-lg overflow-hidden shadow-lg">
                        <div className="p-2 flex justify-between items-center text-xs">
                          <span className="font-display font-black truncate max-w-[100px] uppercase italic">Winner</span>
                          <span className="font-mono font-bold">-</span>
                        </div>
                        <div className="p-2 flex justify-between items-center text-xs border-t border-white/5">
                          <span className="font-display font-black truncate max-w-[100px] uppercase italic">Winner</span>
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
                    <h3 className="text-yellow-400 font-black uppercase tracking-widest text-[10px] mb-4 text-center">Grand Final</h3>
                    <div className="w-56 bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-yellow-500/30 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(234,179,8,0.1)] p-1">
                      <div className="bg-[#000030] rounded-lg overflow-hidden">
                        <div className="p-4 flex justify-between items-center">
                          <span className="font-display font-black text-sm uppercase italic tracking-tighter">Finalist 1</span>
                          <span className="font-mono font-black text-xl">-</span>
                        </div>
                        <div className="p-4 flex justify-between items-center border-t border-white/5">
                          <span className="font-display font-black text-sm uppercase italic tracking-tighter">Finalist 2</span>
                          <span className="font-mono font-black text-xl">-</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-blue-400/50 font-black uppercase tracking-widest text-[10px] mb-4 text-center">3rd Place Match</h3>
                    <div className="w-56 bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-lg">
                      <div className="p-3 flex justify-between items-center text-xs">
                        <span className="font-display font-black truncate max-w-[100px] text-white/60 uppercase italic">Loser SF1</span>
                        <span className="font-mono font-bold text-white/40">-</span>
                      </div>
                      <div className="p-3 flex justify-between items-center border-t border-white/5 text-xs">
                        <span className="font-display font-black truncate max-w-[100px] text-white/60 uppercase italic">Loser SF2</span>
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

      {/* Footer */}
      <footer className="mt-20 py-12 border-t border-white/10 bg-black/20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="flex justify-center gap-8 mb-8">
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-[0.3em] font-black text-blue-400/50 mb-1">Total Matches</p>
                  <p className="text-3xl font-display font-black italic tracking-tighter">72</p>
                </div>
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-[0.3em] font-black text-blue-400/50 mb-1">Teams</p>
                  <p className="text-3xl font-display font-black italic tracking-tighter">16</p>
                </div>
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-[0.3em] font-black text-blue-400/50 mb-1">Matchdays</p>
                  <p className="text-3xl font-display font-black italic tracking-tighter">5</p>
                </div>
          </div>
          <p className="text-white/20 text-xs font-mono uppercase tracking-widest">
            &copy; 2026 UXI Tournament Hub
          </p>
        </div>
      </footer>
    </div>
  );
}
