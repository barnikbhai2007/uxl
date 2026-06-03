import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";
import { Match, BracketMatch, Registration, Config, Team } from "../types";
import { WORLD_CUP_TEAMS } from "../constants";
import {
  calculateStats,
  calculateCleanSheets,
  calculateMotmLeaders,
  calculateStandings,
} from "../utils/stats";
import {
  Trophy,
  FileSpreadsheet,
  Star,
  Goal,
  Shield,
  Swords,
  ShieldAlert,
  Award,
} from "lucide-react";

const AnimatedNumber = ({ value }: { value: string | number }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  
  useEffect(() => {
    if (isNaN(numericValue)) return;
    
    let startTimestamp: number;
    const duration = 1500;
    
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setDisplayValue(Math.floor(progress * numericValue));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(numericValue);
      }
    };
    window.requestAnimationFrame(step);
  }, [numericValue]);

  if (isNaN(numericValue) || (typeof value === 'string' && isNaN(parseFloat(value)))) {
    return <span>{value}</span>;
  }
  
  return <span>{displayValue}</span>;
};

interface DrawBracketManagerProps {
  registrations: Registration[];
  config: Config;
  matches: Match[];
  bracket: BracketMatch[];
  teams: Team[];
  handleSaveBracket: (m: BracketMatch) => Promise<void>;
  handleUpdateConfig: (config: Config) => Promise<void>;
}

export default function DrawBracketManager({
  registrations,
  config,
  matches,
  bracket,
  teams,
  handleSaveBracket,
  handleUpdateConfig,
}: DrawBracketManagerProps) {
  const { width, height } = useWindowSize();
  const [step, setStep] = useState<
    | "timelapse"
    | "tournament_stats"
    | "best_thirds"
    | "qualified_view"
    | "pot_assignment"
    | "bracket_draw"
  >("timelapse");

  // Match Timelapse
  const finishedMatches = useMemo(() => {
    return matches
      .filter((m) => m.status === "finished")
      .sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
  }, [matches]);

  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [animHomeScore, setAnimHomeScore] = useState(0);
  const [animAwayScore, setAnimAwayScore] = useState(0);
  const [matchFinished, setMatchFinished] = useState(false);

  useEffect(() => {
    if (step === "timelapse") {
      if (currentMatchIdx < finishedMatches.length) {
        const match = finishedMatches[currentMatchIdx];
        const targetHome = match.homeScore || 0;
        const targetAway = match.awayScore || 0;

        if (animHomeScore < targetHome) {
          const t = setTimeout(() => setAnimHomeScore((p) => p + 1), 600);
          return () => clearTimeout(t);
        } else if (animAwayScore < targetAway) {
          const t = setTimeout(() => setAnimAwayScore((p) => p + 1), 600);
          return () => clearTimeout(t);
        } else {
          if (!matchFinished) {
            setMatchFinished(true);
          } else {
            const t = setTimeout(() => {
              setCurrentMatchIdx((p) => p + 1);
              setAnimHomeScore(0);
              setAnimAwayScore(0);
              setMatchFinished(false);
            }, 3000);
            return () => clearTimeout(t);
          }
        }
      } else {
        const t = setTimeout(() => {
          setStep("tournament_stats");
        }, 4000);
        return () => clearTimeout(t);
      }
    }
  }, [
    step,
    currentMatchIdx,
    animHomeScore,
    animAwayScore,
    matchFinished,
    finishedMatches,
  ]);

  const liveMatches = useMemo(() => {
    return finishedMatches.slice(
      0,
      matchFinished ? currentMatchIdx + 1 : currentMatchIdx,
    );
  }, [finishedMatches, currentMatchIdx, matchFinished]);

  const goalScorers = useMemo(
    () => calculateStats(teams, liveMatches).slice(0, 16),
    [teams, liveMatches],
  );
  const cleanSheets = useMemo(
    () => calculateCleanSheets(teams, liveMatches).slice(0, 16),
    [teams, liveMatches],
  );
  const motms = useMemo(
    () => calculateMotmLeaders(liveMatches).slice(0, 16),
    [liveMatches],
  );

  const [statsPhase, setStatsPhase] = useState(0);
  useEffect(() => {
    if (step === "tournament_stats") {
      if (statsPhase < 12) {
        const timer = setTimeout(() => {
          setStatsPhase((prev) => prev + 1);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [step, statsPhase]);

  const tournamentStatsData = useMemo(() => {
    if (!matches.length) return [];
    const allMatches = matches.filter((m) => m.status === "finished");
    if (!allMatches.length) return [];

    const totalGoals = allMatches.reduce(
      (acc, m) => acc + (m.homeScore || 0) + (m.awayScore || 0),
      0,
    );
    const avgGoals = (totalGoals / allMatches.length).toFixed(2);

    let highestScoringMatch = allMatches[0];
    let highestDiffMatch = allMatches[0];
    
    // Additional tracking for advanced stats
    const teamStats: Record<string, { possession: number, shots: number, offsides: number, matches: number, points: number, goalDiff: number }> = {};
    const groupStats: Record<string, { totalGoals: number, ptsSpread: number, teamsCount: number, minPts: number, maxPts: number }> = {};
    
    teams.forEach(t => {
       teamStats[t.id] = { possession: 0, shots: 0, offsides: 0, matches: 0, points: 0, goalDiff: 0 };
    });

    allMatches.forEach((m) => {
      const curGoals = (m.homeScore || 0) + (m.awayScore || 0);
      const highGoals =
        (highestScoringMatch.homeScore || 0) +
        (highestScoringMatch.awayScore || 0);
      if (curGoals > highGoals) highestScoringMatch = m;

      const curDiff = Math.abs((m.homeScore || 0) - (m.awayScore || 0));
      const highDiff = Math.abs(
        (highestDiffMatch.homeScore || 0) - (highestDiffMatch.awayScore || 0),
      );
      if (curDiff > highDiff) highestDiffMatch = m;
      
      if (m.homeTeamId && teamStats[m.homeTeamId]) {
         teamStats[m.homeTeamId].matches += 1;
         if (m.homeStats) {
             teamStats[m.homeTeamId].possession += (m.homeStats.possession || 0);
             teamStats[m.homeTeamId].shots += (m.homeStats.shots || 0);
             teamStats[m.homeTeamId].offsides += (m.homeStats.offsides || 0);
         }
         
         const scoreDiff = (m.homeScore || 0) - (m.awayScore || 0);
         if (scoreDiff > 0) teamStats[m.homeTeamId].points += 3;
         else if (scoreDiff === 0) teamStats[m.homeTeamId].points += 1;
         teamStats[m.homeTeamId].goalDiff += scoreDiff;
      }
      
      if (m.awayTeamId && teamStats[m.awayTeamId]) {
         teamStats[m.awayTeamId].matches += 1;
         if (m.awayStats) {
             teamStats[m.awayTeamId].possession += (m.awayStats.possession || 0);
             teamStats[m.awayTeamId].shots += (m.awayStats.shots || 0);
             teamStats[m.awayTeamId].offsides += (m.awayStats.offsides || 0);
         }
         
         const scoreDiff = (m.awayScore || 0) - (m.homeScore || 0);
         if (scoreDiff > 0) teamStats[m.awayTeamId].points += 3;
         else if (scoreDiff === 0) teamStats[m.awayTeamId].points += 1;
         teamStats[m.awayTeamId].goalDiff += scoreDiff;
      }
    });
    
    // Process groups
    teams.forEach(t => {
       const g = t.group || "None";
       if (g === "None") return;
       if (!groupStats[g]) groupStats[g] = { totalGoals: 0, ptsSpread: 0, teamsCount: 0, minPts: 999, maxPts: -1 };
       groupStats[g].teamsCount++;
       const pts = teamStats[t.id]?.points || 0;
       groupStats[g].minPts = Math.min(groupStats[g].minPts, pts);
       groupStats[g].maxPts = Math.max(groupStats[g].maxPts, pts);
    });
    
    let hardestGroup = config.groupOfDeath || "N/A";
    let easiestGroup = config.easiestGroup || "N/A";
    let minSpread = 999;
    let maxSpread = -1;
    
    if (!config.groupOfDeath || !config.easiestGroup) {
      Object.keys(groupStats).forEach(g => {
         const stat = groupStats[g];
         if (stat.teamsCount > 1) {
            const spread = stat.maxPts - stat.minPts;
            if (!config.groupOfDeath && spread < minSpread) { minSpread = spread; hardestGroup = `Group ${g}`; }
            if (!config.easiestGroup && spread > maxSpread) { maxSpread = spread; easiestGroup = `Group ${g}`; }
         }
      });
    }
    
    let mostPossessionTeam = "N/A";
    let highestAvgPossession = 0;
    
    let mostShotsTeam = "N/A";
    let highestShots = 0;
    
    let mostOffsideTeam = "N/A";
    let highestOffside = 0;
    
    Object.keys(teamStats).forEach(tId => {
       const s = teamStats[tId];
       if (s.matches > 0) {
          const avgPossession = s.possession / s.matches;
          if (avgPossession > highestAvgPossession) {
             highestAvgPossession = avgPossession;
             mostPossessionTeam = teams.find(t => t.id === tId)?.name || "N/A";
          }
          if (s.shots > highestShots) {
             highestShots = s.shots;
             mostShotsTeam = teams.find(t => t.id === tId)?.name || "N/A";
          }
          if (s.offsides > highestOffside) {
             highestOffside = s.offsides;
             mostOffsideTeam = teams.find(t => t.id === tId)?.name || "N/A";
          }
       }
    });

    const biggestWinHomeName = teams.find(t => t.id === highestDiffMatch.homeTeamId)?.name || "Home";
    const biggestWinAwayName = teams.find(t => t.id === highestDiffMatch.awayTeamId)?.name || "Away";

    const allCleanSheets = calculateCleanSheets(teams, allMatches);
    const allGoalScorers = calculateStats(teams, allMatches);
    const topScorerTeamName = allGoalScorers.length > 0 ? teams.find(t => t.id === allGoalScorers[0].teamId)?.name : "N/A";

    return [
      { label: "Matches Played", value: allMatches.length },
      { label: "Total Goals", value: totalGoals },
      { label: "Goals Per Match", value: avgGoals },
      {
        label: "Biggest Win",
        value: `${biggestWinHomeName} ${highestDiffMatch.homeScore} - ${highestDiffMatch.awayScore} ${biggestWinAwayName}`,
      },
      {
        label: "Most Possession",
        value: highestAvgPossession > 0 ? `${mostPossessionTeam} (${Math.round(highestAvgPossession)}%)` : "N/A",
      },
      {
        label: "Most Shots Taken",
        value: highestShots > 0 ? `${mostShotsTeam} (${highestShots})` : "N/A",
      },
      {
        label: "Most Offsides",
        value: highestOffside > 0 ? `${mostOffsideTeam} (${highestOffside})` : "N/A",
      },
      {
        label: "Group of Death",
        value: hardestGroup,
      },
      { 
        label: "Easiest Group", 
        value: easiestGroup 
      },
      { 
        label: "Top Scorer Player", 
        value: allGoalScorers.length > 0 ? `${allGoalScorers[0].playerName} (${allGoalScorers[0].goals} Goals)` : "N/A" 
      },
      { 
        label: "Top Team Goalscorer", 
        value: allGoalScorers.length > 0 ? `${allGoalScorers[0].playerName} | ${topScorerTeamName} (${allGoalScorers[0].goals} Goals)` : "N/A" 
      },
      {
        label: "Most Clean Sheets",
        value: allCleanSheets.length > 0 ? `${allCleanSheets[0].gamerName} (${allCleanSheets[0].cleanSheets} CS)` : "N/A",
      },
    ];
  }, [matches, registrations, teams, config]);

  const [bestThirdsPhase, setBestThirdsPhase] = useState<
    | "analyzing"
    | "reveal_1_reason"
    | "reveal_1_name"
    | "reveal_2_reason"
    | "reveal_2_name"
    | "done"
  >("analyzing");

  const standings = useMemo(
    () => calculateStandings(teams, matches),
    [teams, matches],
  );
  const groupStandings = useMemo(() => {
    const groups: Record<string, Team[]> = {};
    standings.forEach((t) => {
      const g = t.group || "None";
      if (!groups[g]) groups[g] = [];
      groups[g].push(t);
    });
    return groups;
  }, [standings]);

  const { autoQualified, thirdPlaceFinishers } = useMemo(() => {
    const aq: Team[] = [];
    const thirds: Team[] = [];
    const validGroups = Object.keys(groupStandings).filter(g => g !== "None");

    if (config.autoQualifiedSelected && config.autoQualifiedSelected.length > 0) {
      config.autoQualifiedSelected.forEach(id => {
        const team = teams.find(t => t.id === id);
        if (team) {
          aq.push(team);
        }
      });
      // Thirds shouldn't technically matter if wildcards are also manually selected, but we populate it just in case
      validGroups.forEach((g) => {
        const groupTeams = groupStandings[g];
        groupTeams.forEach(t => {
           if (!config.autoQualifiedSelected?.includes(t.id)) {
              thirds.push(t);
           }
        });
      });
    } else if (validGroups.length > 0) {
      validGroups.forEach((g) => {
        const groupTeams = groupStandings[g];
        aq.push(...groupTeams.slice(0, 2));
        if (groupTeams.length > 2) {
          thirds.push(groupTeams[2]);
        }
      });
    } else {
      // Fallback: If no groups were configured, take top teams from global standings
      const sortedStandings = [...standings].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return (b.gf || 0) - (a.gf || 0);
      });
      aq.push(...sortedStandings.slice(0, 14)); // assume 14 since we want 2 wildcards in a 16 bracket usually if no groups? Actually let's assume 14.
    }

    thirds.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return (b.gf || 0) - (a.gf || 0);
    });

    return { autoQualified: aq, thirdPlaceFinishers: thirds };
  }, [groupStandings, standings, config.autoQualifiedSelected, teams]);

  const wildcards = useMemo(() => {
    const targetBracketSize = autoQualified.length <= 8 ? 8 : 16;
    const needed = Math.max(0, targetBracketSize - autoQualified.length);

    if (config?.wildcardsSelected && config.wildcardsSelected.length > 0) {
      return config.wildcardsSelected.map((wc, index) => {
         const t = teams.find(team => team.id === wc.teamId);
         if (t) {
            return { ...t, wildcardReason: wc.reason, isEliminated: index >= needed };
         }
         return null;
      }).filter(t => t !== null) as (Team & { wildcardReason?: string, isEliminated?: boolean })[];
    }

    return thirdPlaceFinishers.slice(0, Math.max(needed, thirdPlaceFinishers.length)).map((t, index) => ({
      ...t,
      isEliminated: index >= needed
    }));
  }, [thirdPlaceFinishers, autoQualified.length, config, teams]);

  const [wildcardIdx, setWildcardIdx] = useState(0);
  const [wildcardPhase, setWildcardPhase] = useState<"analyzing" | "reason" | "country" | "name" | "done">("analyzing");

  useEffect(() => {
    if (step === "best_thirds") {
      if (wildcardPhase === "analyzing") {
        const t = setTimeout(() => {
          if (wildcards.length > 0) {
            setWildcardIdx(wildcards.length - 1); // Start from bottom
            setWildcardPhase("reason");
          } else {
            setWildcardPhase("done");
          }
        }, 4000);
        return () => clearTimeout(t);
      } else if (wildcardPhase === "reason") {
        const t = setTimeout(() => setWildcardPhase("country"), 4000);
        return () => clearTimeout(t);
      } else if (wildcardPhase === "country") {
        const t = setTimeout(() => setWildcardPhase("name"), 2000);
        return () => clearTimeout(t);
      }
    }
  }, [step, wildcardPhase, wildcardIdx, wildcards.length]);

  const allQualified = useMemo(
    () => [...autoQualified, ...wildcards.filter(w => !w.isEliminated)],
    [autoQualified, wildcards],
  );

  const [potPhase, setPotPhase] = useState<"divide" | "ready">("divide");
  const [pots, setPots] = useState<{ pot1: Team[]; pot2: Team[] }>({
    pot1: [],
    pot2: [],
  });

  const handleDividePots = () => {
    const half = Math.floor(allQualified.length / 2);
    // Fisher-Yates shuffle
    const shuffled = [...allQualified];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    setPots({
      pot1: shuffled.slice(0, half),
      pot2: shuffled.slice(half),
    });
    setPotPhase("ready");
  };

  const [currentPick, setCurrentPick] = useState<{ pot: 1 | 2; index: number }>(
    { pot: 1, index: 0 },
  );
  const [bracketAssignments, setBracketAssignments] = useState<
    Record<string, Team>
  >({});

  useEffect(() => {
    const newAssignments: Record<string, Team> = {};
    let hasValidAssignments = false;

    // Build assignments from the confirmed bracket using teams list
    bracket.forEach(m => {
      if (m.round === 'Round of 16' || m.round === 'r16') {
        const i = m.id.replace('r16-', '');
        if (m.homeTeamId) {
          const t = teams.find(t => t.id === m.homeTeamId);
          if (t) newAssignments[`r16-${i}-home`] = t;
        }
        if (m.awayTeamId) {
          const t = teams.find(t => t.id === m.awayTeamId);
          if (t) newAssignments[`r16-${i}-away`] = t;
        }
      }
    });

    if (Object.keys(newAssignments).length > 0) {
      hasValidAssignments = true;
      setBracketAssignments(prev => ({ ...prev, ...newAssignments }));
    } else {
      setBracketAssignments({});
      setCurrentPick({ pot: 1, index: 0 });
      setPots({ pot1: [], pot2: [] });
      setPotPhase("divide");
    }
  }, [bracket, teams]);

  const [activeDrawMatch, setActiveDrawMatch] = useState<string | null>(null);
  const [activeDrawPhase, setActiveDrawPhase] = useState<"country" | "name" | null>(null);

  const handleDrawFromPot = async (potIndex: 1 | 2) => {
    const activePot = potIndex === 1 ? pots.pot1 : pots.pot2;
    if (activePot.length === 0) return;

    const randomIndex = Math.floor(Math.random() * activePot.length);
    const team = activePot.splice(randomIndex, 1)[0];

    // Pot 1 maps (0 to 7): M1_Home(r16-0), M2_Home(r16-1), M3_Home(r16-2), M4_Home(r16-3), M8_Away(r16-7), M7_Away(r16-6), M6_Away(r16-5), M5_Away(r16-4)
    // Pot 2 maps (0 to 7): M8_Home(r16-7), M7_Home(r16-6), M6_Home(r16-5), M5_Home(r16-4), M1_Away(r16-0), M2_Away(r16-1), M3_Away(r16-2), M4_Away(r16-3)

    // Update local state Pots
    if (potIndex === 1) setPots({ ...pots, pot1: activePot });
    else setPots({ ...pots, pot2: activePot });

    let matchKey = "";
    const pickCount = 8 - activePot.length - 1; // 0-based index of this pick

    if (potIndex === 1) {
      if (pickCount < 4) {
        matchKey = `r16-${pickCount}-home`;
      } else {
        matchKey = `r16-${7 - (pickCount - 4)}-away`;
      }
    } else {
      if (pickCount < 4) {
        matchKey = `r16-${7 - pickCount}-home`;
      } else {
        matchKey = `r16-${pickCount - 4}-away`;
      }
    }

    // pre-assign to active highlight
    setBracketAssignments((prev) => ({ ...prev, [matchKey]: team }));
    setActiveDrawMatch(matchKey);
    setActiveDrawPhase("country");
    setTimeout(() => setActiveDrawPhase("name"), 2000);
    setTimeout(async () => {
      setActiveDrawPhase(null);
      setActiveDrawMatch(null);

      // Send to Firestore Bracket
      const mId = matchKey.replace("-home", "").replace("-away", "");
      let roundName = mId.split('-')[0];
      if (roundName === 'r16') roundName = 'Round of 16';
      else if (roundName === 'qf') roundName = 'Quarter-Finals';
      else if (roundName === 'sf') roundName = 'Semi-Finals';
      const existingMatch = bracket.find((b) => b.id === mId) || { id: mId, round: roundName };
      if (matchKey.includes("home")) {
        await handleSaveBracket({
          ...existingMatch,
          homeTeamId: team.id,
          homeTeamName: team.name,
        } as BracketMatch);
      } else {
        await handleSaveBracket({
          ...existingMatch,
          awayTeamId: team.id,
          awayTeamName: team.name,
        } as BracketMatch);
      }
    }, 4500);
  };

  return (
    <div className="text-white">

      {step === "timelapse" && (
        <div className="flex flex-col items-center justify-center min-h-[400px] w-full max-w-6xl mx-auto px-4">
          <h2 className="text-fc-neon-green font-display font-black text-2xl uppercase tracking-widest mb-12">
            Dynamic Tournament Simulator
          </h2>

          <div className="flex flex-col lg:flex-row w-full gap-8">
            <div className="w-full lg:w-1/2 flex flex-col items-center">
              <h3 className="text-white/80 font-bold uppercase tracking-widest text-sm mb-6 border-b border-white/10 pb-4 w-full text-center">
                Match Results
              </h3>
              
              <div className="w-full relative h-[500px] overflow-hidden flex flex-col justify-end pb-4">
                <AnimatePresence mode="popLayout" initial={false}>
                  {finishedMatches
                    .slice(
                      Math.max(0, matchFinished ? currentMatchIdx - 4 : currentMatchIdx - 5),
                      matchFinished ? currentMatchIdx + 1 : currentMatchIdx + 1
                    )
                    .map((m, relativeIdx, arr) => {
                      const absoluteIdx = finishedMatches.findIndex((fm) => fm.id === m.id);
                      const home = teams.find((t) => t.id === m.homeTeamId);
                      const away = teams.find((t) => t.id === m.awayTeamId);
                      const isCurrent = absoluteIdx === currentMatchIdx;
                      
                      const dHomeScore = isCurrent ? animHomeScore : (m.homeScore || 0);
                      const dAwayScore = isCurrent ? animAwayScore : (m.awayScore || 0);

                      let isHomeWinner = false;
                      let isAwayWinner = false;
                      
                      // if past match OR finished current match, highlight winner
                      if (absoluteIdx < currentMatchIdx || (isCurrent && matchFinished)) {
                         if (dHomeScore > dAwayScore) isHomeWinner = true;
                         if (dAwayScore > dHomeScore) isAwayWinner = true;
                      }

                      return (
                        <motion.div
                          key={`match-${m.id}`}
                          layout
                          initial={{ opacity: 0, scale: 0.8, y: 50 }}
                          animate={{
                            opacity: isCurrent ? 1 : 0.6,
                            scale: isCurrent ? 1 : 0.95,
                            y: 0,
                          }}
                          exit={{ opacity: 0, scale: 0.8, y: -50 }}
                          transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
                          className={`bg-white/5 border ${
                            isCurrent && !matchFinished
                              ? "border-fc-neon-green/50 shadow-[0_0_15px_rgba(204,255,0,0.2)]"
                              : "border-white/10"
                          } rounded-2xl p-4 mb-3 w-full max-w-lg mx-auto flex justify-between items-center relative overflow-hidden`}
                        >
                          <div className="absolute top-0 left-0 bg-white/10 text-white/50 text-[8px] font-bold px-2 py-0.5 rounded-br-lg">
                            M# {m.matchNumber || (absoluteIdx + 1)}
                          </div>
                      
                          <div className="flex items-center gap-3 w-1/3 mt-2">
                             <div className="w-10 h-10 rounded block flex-shrink-0 bg-white/10 flex items-center justify-center text-sm font-bold overflow-hidden shadow-md">
                               {home?.logoUrl ? <img src={home.logoUrl} alt={home.name} className="w-full h-full object-cover" /> : (home?.name[0] || '?')}
                             </div>
                             <span className={`font-bold truncate text-sm transition-all ${isHomeWinner ? 'bg-fc-neon-green text-black px-2 py-0.5 rounded -rotate-2 scale-110 shadow-lg' : 'text-white'}`}>
                               {home?.name || "TBD"}
                             </span>
                          </div>
                          
                          <div className="flex flex-col items-center w-1/3 mt-2">
                            <span className="text-[9px] text-white/50 mb-1">
                              {new Date(m.date).toLocaleDateString()}
                            </span>
                            <div className="font-sans font-black text-white text-3xl text-center min-w-[80px] bg-black/40 px-3 py-1 rounded-xl shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] flex items-center justify-center gap-2">
                              <span>{dHomeScore}</span>
                              <span className="text-white/20 text-lg">-</span>
                              <span>{dAwayScore}</span>
                            </div>
                            {isCurrent && matchFinished && dHomeScore !== dAwayScore && (
                              <motion.div initial={{scale:0}} animate={{scale:1}} className="text-[10px] text-fc-neon-green mt-1 font-bold uppercase tracking-widest bg-fc-neon-green/10 px-2 rounded-full">
                                Winner Decided
                              </motion.div>
                            )}
                          </div>

                          <div className="flex items-center justify-end gap-3 w-1/3 mt-2">
                             <span className={`font-bold truncate text-sm text-right transition-all transform origin-right ${isAwayWinner ? 'bg-fc-neon-green text-black px-2 py-0.5 rounded rotate-2 scale-110 shadow-lg' : 'text-white'}`}>
                               {away?.name || "TBD"}
                             </span>
                             <div className="w-10 h-10 rounded block flex-shrink-0 bg-white/10 flex items-center justify-center text-sm font-bold overflow-hidden shadow-md">
                               {away?.logoUrl ? <img src={away.logoUrl} alt={away.name} className="w-full h-full object-cover" /> : (away?.name[0] || '?')}
                             </div>
                          </div>
                        </motion.div>
                      );
                    })}
                </AnimatePresence>
              </div>
              
              <div className="mt-4 text-white/50 text-xs font-bold uppercase tracking-widest text-center">
                {currentMatchIdx} / {finishedMatches.length} Matches Simulated
              </div>
            </div>

            <div className="w-full lg:w-1/2 flex flex-col items-center gap-6 lg:border-l border-white/10 lg:pl-8">
              <h3 className="text-white/80 font-bold uppercase tracking-widest text-sm mb-2 border-b border-white/10 pb-4 w-full text-center">
                Live Stats Rankings
              </h3>
              
              <div className="w-full grid gap-4">
                {/* Goal Scorers */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                   <div className="flex items-center gap-3 mb-4 text-white/60">
                     <Goal className="w-5 h-5 text-fc-neon-green" />
                     <h4 className="font-bold uppercase tracking-widest text-xs">Top Scorers</h4>
                   </div>
                   <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                     <AnimatePresence mode="popLayout">
                       {goalScorers.map((s, i) => (
                         <motion.div
                           key={s.playerName + s.gamerName}
                           layout
                           initial={{ opacity: 0, x: -20 }}
                           animate={{ opacity: 1, x: 0 }}
                           exit={{ opacity: 0, x: 20 }}
                           className="flex items-center justify-between bg-black/40 p-2 rounded-lg mb-2 text-sm"
                         >
                           <div className="flex items-center gap-3">
                             <span className="font-bold text-white/40 w-4 font-sans">#{i+1}</span>
                             <div className="flex flex-col">
                               <span className="font-bold text-white leading-tight">{s.playerName}</span>
                               <span className="text-[10px] text-white/50">{s.gamerName} | {teams.find(t => t.id === s.teamId)?.name}</span>
                             </div>
                           </div>
                           <span className="text-fc-neon-green font-sans font-bold">{s.goals}</span>
                         </motion.div>
                       ))}
                     </AnimatePresence>
                   </div>
                </div>

                {/* Clean Sheets */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col max-h-[300px]">
                   <div className="flex items-center gap-3 mb-4 text-white/60 shrink-0">
                     <Shield className="w-5 h-5 text-blue-400" />
                     <h4 className="font-bold uppercase tracking-widest text-xs">Clean Sheets</h4>
                   </div>
                   <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
                     <AnimatePresence mode="popLayout">
                       {cleanSheets.map((s, i) => {
                         const gkName = teams.find(t => t.id === s.teamId)?.goalkeeper || "Team GK";
                         return (
                           <motion.div
                             key={s.gamerName}
                             layout
                             initial={{ opacity: 0, x: -20 }}
                             animate={{ opacity: 1, x: 0 }}
                             exit={{ opacity: 0, x: 20 }}
                             className="flex items-center justify-between bg-black/40 p-2 rounded-lg mb-2 text-sm"
                           >
                             <div className="flex items-center gap-3">
                               <span className="font-bold text-white/40 w-4 font-sans">#{i+1}</span>
                               <div className="flex flex-col">
                                 <span className="font-bold text-white leading-tight">{gkName}</span>
                                 <span className="text-[10px] text-white/50">{s.gamerName} | {teams.find(t => t.id === s.teamId)?.name}</span>
                               </div>
                             </div>
                             <span className="text-blue-400 font-sans font-bold">{s.cleanSheets}</span>
                           </motion.div>
                         );
                       })}
                     </AnimatePresence>
                   </div>
                </div>

                 {/* MOTMs */}
                 <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col max-h-[300px]">
                   <div className="flex items-center gap-3 mb-4 text-white/60 shrink-0">
                     <Star className="w-5 h-5 text-yellow-400" />
                     <h4 className="font-bold uppercase tracking-widest text-xs">Man of the Match</h4>
                   </div>
                   <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
                     <AnimatePresence mode="popLayout">
                       {motms.map((s, i) => (
                         <motion.div
                           key={s.playerName}
                           layout
                           initial={{ opacity: 0, x: -20 }}
                           animate={{ opacity: 1, x: 0 }}
                           exit={{ opacity: 0, x: 20 }}
                           className="flex items-center justify-between bg-black/40 p-2 rounded-lg mb-2 text-sm"
                         >
                           <div className="flex items-center gap-3">
                             <span className="font-bold text-white/40 w-4">#{i+1}</span>
                             <span className="font-bold text-white">{s.playerName}</span>
                           </div>
                           <span className="text-yellow-400 font-sans font-bold">{s.awards}</span>
                         </motion.div>
                       ))}
                     </AnimatePresence>
                   </div>
                </div>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setStep("tournament_stats")}
            className="mt-8 px-4 py-2 border border-white/20 rounded-xl text-xs hover:bg-white/10"
          >
            Skip Animation
          </button>
        </div>
      )}

      {step === "tournament_stats" && (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          {statsPhase >= 12 && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} colors={['#ccff00', '#ffffff', '#000000']} />}
          <h2 className="text-fc-neon-green font-display font-black text-2xl uppercase tracking-widest mb-12">
            Tournament Statistics
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-5xl">
            {tournamentStatsData.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: statsPhase > i ? 1 : 0,
                  scale: statsPhase > i ? 1 : 0.8,
                }}
                className="bg-black/40 border border-white/10 rounded-xl p-4 text-center flex flex-col items-center justify-center min-h-[100px]"
              >
                <div className="text-white/50 text-[10px] font-bold uppercase tracking-widest mb-2">
                  {stat.label}
                </div>
                <div className="text-fc-neon-green font-display font-black text-xl">
                  {typeof stat.value === 'number' && statsPhase > i ? (
                    <AnimatedNumber value={stat.value} />
                  ) : (
                    stat.value
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {statsPhase >= 12 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-12"
            >
              <button
                onClick={() => setStep("best_thirds")}
                className="px-8 py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-fc-neon-green transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              >
                Begin Draw
              </button>
            </motion.div>
          )}
        </div>
      )}

      {step === "best_thirds" && (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          {wildcardPhase === "done" && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} colors={['#ccff00', '#ffffff', '#000000']} />}
          <h2 className="text-fc-neon-green font-display font-black text-2xl uppercase tracking-widest mb-12">
            Wildcard Selection
          </h2>

          <div className="w-full max-w-3xl bg-black/40 border border-white/10 rounded-2xl p-8 text-center relative min-h-[250px] flex flex-col justify-center items-center overflow-hidden">
            <AnimatePresence mode="wait">
              {wildcardPhase === "analyzing" && (
                <motion.div
                  key="analyzing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-16 h-16 border-4 border-fc-neon-green border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-white/60 font-bold uppercase tracking-widest text-sm">
                    Analyzing group stage performances...
                  </p>
                  <p className="text-white/40 text-[10px] mt-2">
                    Evaluating Goal Difference, Goals Scored, and Points
                  </p>
                </motion.div>
              )}

              {(wildcardPhase === "reason" || wildcardPhase === "country" || wildcardPhase === "name") &&
                wildcards[wildcardIdx] && (
                  <motion.div
                    key={`reveal-${wildcardIdx}`}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -30 }}
                    className="flex flex-col items-center w-full"
                  >
                    <div className="text-fc-neon-green font-bold uppercase tracking-widest text-sm mb-4">
                      {(() => {
                        const spot = wildcardIdx + 1;
                        if (spot === 11 || spot === 12 || spot === 13) return `${spot}th Spot`;
                        const last = spot % 10;
                        if (last === 1) return `${spot}st Spot`;
                        if (last === 2) return `${spot}nd Spot`;
                        if (last === 3) return `${spot}rd Spot`;
                        return `${spot}th Spot`;
                      })()}
                    </div>

                      <div className="bg-white/5 border border-white/10 p-6 rounded-xl w-full max-w-lg mb-6 shadow-xl relative overflow-hidden flex flex-col items-center">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-fc-neon-green to-transparent opacity-50"></div>
                        <div className="w-full relative z-10 mb-4 bg-white/5 rounded-xl border border-white/10 p-4">
                          <h4 className="text-fc-neon-green font-bold text-xs uppercase tracking-widest mb-3 border-b border-white/10 pb-2">
                            Wildcard Evaluation
                          </h4>
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="flex flex-col">
                              <span className="text-white/50 uppercase tracking-widest text-[10px]">Group</span>
                              <span className="text-white font-bold">{wildcards[wildcardIdx].group || "N/A"}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-white/50 uppercase tracking-widest text-[10px]">Points</span>
                              <span className="text-white font-bold">{wildcards[wildcardIdx].points} PTS</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-white/50 uppercase tracking-widest text-[10px]">Goal Diff</span>
                              <span className="text-white font-bold">{wildcards[wildcardIdx].gd >= 0 ? "+" : ""}{wildcards[wildcardIdx].gd}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-white/50 uppercase tracking-widest text-[10px]">Goals Scored</span>
                              <span className="text-white font-bold">{wildcards[wildcardIdx].gf}</span>
                            </div>
                          </div>
                          <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
                            <span className="text-white/50 uppercase tracking-widest text-[10px]">Decision</span>
                            <span className={wildcards[wildcardIdx].isEliminated ? "bg-red-500 text-white px-2 py-1 rounded font-bold uppercase tracking-widest text-[10px]" : "bg-fc-neon-green text-black px-2 py-1 rounded font-bold uppercase tracking-widest text-[10px]"}>
                              {wildcards[wildcardIdx].isEliminated ? "Eliminated" : "Selected"}
                            </span>
                          </div>
                        </div>
                        
                        {wildcards[wildcardIdx].group && groupStandings[wildcards[wildcardIdx].group] && (
                          <div className="w-full text-left text-xs bg-black/40 p-3 rounded-xl border border-white/5 mb-2">
                             <div className="text-white/50 uppercase tracking-widest text-[10px] mb-2">{wildcards[wildcardIdx].group} Standings</div>
                             <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b border-white/10 pb-2 mb-2 font-bold text-white/50 text-[10px] uppercase tracking-widest">
                               <span>Team</span>
                               <span className="text-center w-6">PTS</span>
                               <span className="text-center w-6">GD</span>
                               <span className="text-center w-6">GF</span>
                             </div>
                             <div className="space-y-1">
                               {groupStandings[wildcards[wildcardIdx].group].map((st, idx) => (
                                 <div key={st.id} className={`grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center p-1 rounded ${st.id === wildcards[wildcardIdx].id ? 'bg-white/10' : ''}`}>
                                   <div className="flex items-center gap-2 truncate">
                                      <span className="text-white/30 text-[10px] font-mono">{idx + 1}</span>
                                      <span className={`font-bold truncate ${st.id === wildcards[wildcardIdx].id ? 'text-fc-neon-green' : 'text-white'}`}>{st.name}</span>
                                   </div>
                                   <span className="text-center w-6 font-bold text-white">{st.points}</span>
                                   <span className="text-center w-6 text-white/70">{st.gd >= 0 ? "+" : ""}{st.gd}</span>
                                   <span className="text-center w-6 text-white/70">{st.gf}</span>
                                 </div>
                               ))}
                             </div>
                          </div>
                        )}
                      </div>

                    {(wildcardPhase === "country" || wildcardPhase === "name") && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center bg-white/10 px-12 py-6 rounded-2xl border border-white/20"
                      >
                        <span className={`text-2xl font-bold uppercase tracking-widest mb-2 transition-all ${wildcardPhase === "name" ? 'bg-fc-neon-green text-black px-3 py-1 rounded shadow-lg -rotate-1 scale-110' : 'text-white/50'}`}>
                          {wildcards[wildcardIdx].country || "Unknown"}
                        </span>
                        {wildcardPhase === "name" && (
                           <motion.span 
                             initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                             className="text-5xl font-display font-black text-black bg-fc-neon-green px-4 py-1 rounded mt-2 shadow-[0_0_20px_rgba(204,255,0,0.4)] rotate-1 scale-110"
                           >
                             {wildcards[wildcardIdx].name}
                           </motion.span>
                        )}
                      </motion.div>
                    )}
                    
                    {wildcardPhase === "name" && (
                      <motion.button 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        onClick={() => {
                          if (wildcardIdx > 0) {
                            setWildcardIdx(prev => prev - 1);
                            setWildcardPhase("reason");
                          } else {
                            setWildcardPhase("done");
                          }
                        }}
                        className="mt-8 px-6 py-3 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-fc-neon-green transition-all"
                      >
                        {wildcardIdx > 0 ? "Reveal Next Spot?" : "Finish Wildcards"}
                      </motion.button>
                    )}
                  </motion.div>
                )}
            </AnimatePresence>
          </div>

          {wildcardPhase === "done" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8"
            >
              <button
                onClick={() => setStep("qualified_view")}
                className="px-8 py-4 bg-fc-neon-green text-black font-black uppercase tracking-widest rounded-xl hover:bg-white transition-all"
              >
                View Qualified Teams
              </button>
            </motion.div>
          )}
        </div>
      )}
      {step === "qualified_view" && (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <h2 className="text-fc-neon-green font-display font-black text-2xl uppercase tracking-widest mb-12">
            Qualified Teams
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 w-full px-4 text-center">
            {allQualified.map((t, i) => (
              <motion.div
                key={`${t.id}-${i}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white/5 border border-white/20 rounded-xl p-4 flex flex-col items-center relative overflow-hidden group hover:border-fc-neon-green/50 transition-colors"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-80" />
                <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest relative z-10 mb-2">
                  {t.country || "Team"}
                </span>
                <span className="font-display font-black text-sm relative z-10 text-white truncate w-full">
                  {t.name}
                </span>
                {i >= autoQualified.length && (
                  <span className="absolute top-2 right-2 text-fc-neon-green text-[10px] bg-fc-neon-green/10 px-2 py-0.5 rounded-full border border-fc-neon-green/30">
                    WC
                  </span>
                )}
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="mt-12 text-center"
          >
            <button
              onClick={() => {
                handleDividePots();
                setStep("pot_assignment");
              }}
              className="px-8 py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-fc-neon-green transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              Divide into 2 Pots
            </button>
            <p className="text-white/40 mt-4 text-xs">
              Total {allQualified.length} Teams will be distributed into Pot 1 ({Math.floor(allQualified.length / 2)} Teams) & Pot 2 ({Math.ceil(allQualified.length / 2)} Teams)
            </p>
          </motion.div>
        </div>
      )}

      {step === "pot_assignment" && (
        <div className="flex flex-col items-center min-h-[400px] w-full max-w-5xl mx-auto">
          <h2 className="text-fc-neon-green font-display font-black text-2xl uppercase tracking-widest mb-12">
            Pot Allocations
          </h2>

          <div className="flex justify-between w-full gap-8 mb-8">
            {/* Pot 1 */}
            <div className={`flex flex-col w-1/2 p-6 rounded-2xl border transition-all ${potPhase !== 'divide' ? 'bg-black/60 border-white/5 opacity-50' : 'bg-black/40 border-fc-purple-light/30'}`}>
               <h3 className="text-white/80 font-display font-black text-xl uppercase tracking-widest mb-6 text-center">Pot 1</h3>
               <div className="flex flex-col gap-3">
                 {pots.pot1.map((p, i) => (
                   <motion.div
                     key={p.id}
                     animate={potPhase === 'wrapping' ? {
                       scale: [1, 0.5, 0],
                       scaleY: [1, 0.2, 0],
                       rotate: [0, -10, 45],
                       opacity: [1, 1, 0]
                     } : { scale: 1, opacity: 1 }}
                     transition={{ duration: 0.6, delay: potPhase === 'wrapping' ? Math.random() * 0.4 : i * 0.1 }}
                     className="bg-white/5 pt-2 pb-3 px-4 rounded border border-white/10 flex flex-col items-center"
                   >
                     <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest">{p.country}</span>
                     <span className="font-bold text-white text-sm">{p.name}</span>
                   </motion.div>
                 ))}
               </div>
            </div>

            {/* Pot 2 */}
            <div className={`flex flex-col w-1/2 p-6 rounded-2xl border transition-all ${potPhase !== 'divide' ? 'bg-black/60 border-white/5 opacity-50' : 'bg-black/40 border-fc-neon-green/30'}`}>
               <h3 className="text-white/80 font-display font-black text-xl uppercase tracking-widest mb-6 text-center">Pot 2</h3>
               <div className="flex flex-col gap-3">
                 {pots.pot2.map((p, i) => (
                   <motion.div
                     key={p.id}
                     animate={potPhase === 'wrapping' ? {
                       scale: [1, 0.5, 0],
                       scaleY: [1, 0.2, 0],
                       rotate: [0, -10, 45],
                       opacity: [1, 1, 0]
                     } : { scale: 1, opacity: 1 }}
                     transition={{ duration: 0.6, delay: potPhase === 'wrapping' ? Math.random() * 0.4 : i * 0.1 }}
                     className="bg-white/5 pt-2 pb-3 px-4 rounded border border-white/10 flex flex-col items-center"
                   >
                     <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest">{p.country}</span>
                     <span className="font-bold text-white text-sm">{p.name}</span>
                   </motion.div>
                 ))}
               </div>
            </div>
          </div>

          <button
            onClick={() => {
              setPotPhase("wrapping");
              setTimeout(() => {
                setPotPhase("ready");
                setStep("bracket_draw");
              }, 1200);
            }}
            disabled={potPhase === 'wrapping'}
            className="px-8 py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-fc-neon-green transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] disabled:opacity-50"
          >
            {potPhase === 'wrapping' ? 'Wrapping Teams...' : 'Wrap Names & Begin Draw'}
          </button>
        </div>
      )}

      {step === "bracket_draw" && (
        <div className="flex flex-col items-center min-h-[400px] w-full max-w-6xl mx-auto">
          {pots.pot1.length === 0 && pots.pot2.length === 0 && (
            <Confetti width={width} height={height} recycle={false} numberOfPieces={800} colors={['#ccff00', '#ffffff', '#000000']} />
          )}
          <div className="flex justify-between items-center w-full mb-8 relative">
            <div className="flex flex-col items-center p-6 bg-black/40 border border-fc-purple-light/30 rounded-2xl w-full max-w-sm">
              <h3 className="text-fc-purple-light font-display font-black text-xl uppercase tracking-widest mb-4">
                Pot 1
              </h3>
              <div className="flex flex-wrap gap-2 justify-center mb-6 min-h-[60px]">
                {pots.pot1.map((_, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-white/10 border border-white/20 animate-pulse"
                  />
                ))}
              </div>
              <button
                onClick={() => handleDrawFromPot(1)}
                disabled={pots.pot1.length === 0}
                className="px-6 py-3 bg-fc-purple-light text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-white hover:text-black transition-all disabled:opacity-50"
              >
                Draw Pot 1 ({pots.pot1.length} left)
              </button>
            </div>

            <div className="px-8 text-center text-white/50 text-xs font-mono uppercase">
              Live Assignments
            </div>

            <div className="flex flex-col items-center p-6 bg-black/40 border border-fc-neon-green/30 rounded-2xl w-full max-w-sm">
              <h3 className="text-fc-neon-green font-display font-black text-xl uppercase tracking-widest mb-4">
                Pot 2
              </h3>
              <div className="flex flex-wrap gap-2 justify-center mb-6 min-h-[60px]">
                {pots.pot2.map((_, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-white/10 border border-white/20 animate-pulse"
                  />
                ))}
              </div>
              <button
                onClick={() => handleDrawFromPot(2)}
                disabled={pots.pot2.length === 0}
                className="px-6 py-3 bg-fc-neon-green text-black font-black uppercase tracking-widest text-xs rounded-xl hover:bg-white transition-all disabled:opacity-50"
              >
                Draw Pot 2 ({pots.pot2.length} left)
              </button>
            </div>
          </div>

          <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-8 mb-8 shadow-xl">
            <h4 className="text-center text-white/80 font-bold uppercase tracking-widest text-sm mb-6 border-b border-white/10 pb-4">
              Round of 16 Bracket Preview
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => {
                const homeKey = `r16-${i}-home`;
                const awayKey = `r16-${i}-away`;
                const homeTeam = bracketAssignments[homeKey];
                const awayTeam = bracketAssignments[awayKey];

                return (
                  <div
                    key={i}
                    className="bg-black/60 border border-white/10 p-4 rounded-xl flex flex-col gap-2 relative group hover:border-white/30 transition-all"
                  >
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] bg-black border border-white/20 px-2 py-0.5 rounded-full text-white/50 font-mono">
                      Match {i + 1}
                    </span>

                    <div
                      className={`flex justify-between items-center p-2 rounded relative ${homeTeam ? (activeDrawMatch === homeKey ? "bg-fc-neon-green text-black shadow-[0_0_15px_rgba(204,255,0,0.4)] animate-pulse" : "bg-fc-purple-light/20 border border-fc-purple-light/30") : "bg-white/5 border border-transparent"}`}
                    >
                      <span className={`text-xs font-bold truncate max-w-[100px] ${activeDrawMatch === homeKey ? "text-black" : "text-white"}`}>
                        {homeTeam ? (
                           activeDrawMatch === homeKey ? (
                             activeDrawPhase === "country" ? (
                               <motion.span
                                 initial={{ scale: 0.2, opacity: 0 }}
                                 animate={{ scale: [1, 3, 3, 1], opacity: 1 }}
                                 transition={{ duration: 1.8, ease: "easeInOut" }}
                                 className="absolute inset-0 flex items-center justify-center z-50 text-3xl drop-shadow-2xl bg-fc-neon-green rounded"
                               >
                                 {WORLD_CUP_TEAMS.find(t => t.name === homeTeam.country)?.flag || '🌍'}
                               </motion.span>
                             ) : homeTeam.name
                           ) : homeTeam.name
                        ) : "TBD"}
                      </span>
                      {homeTeam && activeDrawMatch !== homeKey && (
                        <span className="text-[10px] text-white/40">
                          {WORLD_CUP_TEAMS.find(t => t.name === homeTeam.country)?.flag || homeTeam.country}
                        </span>
                      )}
                    </div>

                    <div className="text-center text-[10px] text-white/30 font-bold uppercase w-full my-1">
                      VS
                    </div>

                    <div
                      className={`flex justify-between items-center p-2 rounded relative ${awayTeam ? (activeDrawMatch === awayKey ? "bg-fc-neon-green text-black shadow-[0_0_15px_rgba(204,255,0,0.4)] animate-pulse" : "bg-fc-neon-green/20 border border-fc-neon-green/30") : "bg-white/5 border border-transparent"}`}
                    >
                      <span className={`text-xs font-bold truncate max-w-[100px] ${activeDrawMatch === awayKey ? "text-black" : "text-white"}`}>
                        {awayTeam ? (
                           activeDrawMatch === awayKey ? (
                             activeDrawPhase === "country" ? (
                               <motion.span
                                 initial={{ scale: 0.2, opacity: 0 }}
                                 animate={{ scale: [1, 3, 3, 1], opacity: 1 }}
                                 transition={{ duration: 1.8, ease: "easeInOut" }}
                                 className="absolute inset-0 flex items-center justify-center z-50 text-3xl drop-shadow-2xl bg-fc-neon-green rounded"
                               >
                                 {WORLD_CUP_TEAMS.find(t => t.name === awayTeam.country)?.flag || '🌍'}
                               </motion.span>
                             ) : awayTeam.name
                           ) : awayTeam.name
                        ) : "TBD"}
                      </span>
                      {awayTeam && activeDrawMatch !== awayKey && (
                        <span className="text-[10px] text-white/40">
                           {WORLD_CUP_TEAMS.find(t => t.name === awayTeam.country)?.flag || awayTeam.country}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-center text-white/40 text-xs mt-8 bg-black/40 p-4 rounded-xl border border-white/10 w-full max-w-3xl">
            <h5 className="text-white/80 font-bold uppercase mb-2 text-sm">
              Draw Mechanism Rules
            </h5>
            <p>1. Teams are distributed into two equal pots (8 teams each).</p>
            <p>
              2. Pot 1 assignments fill the Home slots starting from Match 1 to
              Match 4, then wrap around filling Away slots from Match 8
              downwards.
            </p>
            <p>
              3. Pot 2 assignments fill the Home slots starting from Match 8
              down to Match 5, then wrap around filling Away slots from Match 1
              upwards.
            </p>
            <p>
              4. Matches will automatically sync with the Live Bracket upon
              drawing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
