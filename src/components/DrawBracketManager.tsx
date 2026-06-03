import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Match, BracketMatch, Registration, Config, Team } from "../types";
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
    () => calculateStats(teams, liveMatches).slice(0, 3),
    [teams, liveMatches],
  );
  const cleanSheets = useMemo(
    () => calculateCleanSheets(teams, liveMatches).slice(0, 3),
    [teams, liveMatches],
  );
  const motms = useMemo(
    () => calculateMotmLeaders(liveMatches).slice(0, 3),
    [liveMatches],
  );

  const [statsPhase, setStatsPhase] = useState(0);
  useEffect(() => {
    if (step === "tournament_stats") {
      if (statsPhase < 12) {
        const timer = setTimeout(() => {
          setStatsPhase((prev) => prev + 1);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [step, statsPhase]);

  const tournamentStatsData = useMemo(() => {
    // Basic stats calculation out of 12 types.
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
    });

    return [
      { label: "Matches Played", value: allMatches.length },
      { label: "Total Goals", value: totalGoals },
      { label: "Goals Per Match", value: avgGoals },
      {
        label: "Biggest Win",
        value: `${highestDiffMatch.homeScore} - ${highestDiffMatch.awayScore}`,
      },
      {
        label: "Highest Scoring",
        value: `${(highestScoringMatch.homeScore || 0) + (highestScoringMatch.awayScore || 0)} Goals`,
      },
      {
        label: "Top Scorer",
        value: goalScorers.length > 0 ? goalScorers[0].playerName : "N/A",
      },
      {
        label: "Most Clean Sheets",
        value: cleanSheets.length > 0 ? cleanSheets[0].gamerName : "N/A",
      },
      {
        label: "Most MOTMs",
        value: motms.length > 0 ? motms[0].playerName : "N/A",
      },
      { label: "Red Cards", value: "0" },
      { label: "Yellow Cards", value: "12" },
      { label: "Total Attendees", value: registrations.length },
      { label: "Uxl Admin Rating", value: "10/10" },
    ];
  }, [matches, goalScorers, cleanSheets, motms, registrations]);

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
    Object.keys(groupStandings).forEach((g) => {
      if (g === "None") return;
      const groupTeams = groupStandings[g];
      aq.push(...groupTeams.slice(0, 2));
      if (groupTeams.length > 2) {
        thirds.push(groupTeams[2]);
      }
    });

    thirds.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return (b.gf || 0) - (a.gf || 0);
    });

    return { autoQualified: aq, thirdPlaceFinishers: thirds };
  }, [groupStandings]);

  const wildcards = useMemo(() => {
    const needed = Math.max(0, 16 - autoQualified.length);
    return thirdPlaceFinishers.slice(0, needed);
  }, [thirdPlaceFinishers, autoQualified.length]);

  const [wildcardIdx, setWildcardIdx] = useState(0);
  const [wildcardPhase, setWildcardPhase] = useState<"analyzing" | "reason" | "name" | "done">("analyzing");

  useEffect(() => {
    if (step === "best_thirds") {
      if (wildcardPhase === "analyzing") {
        const t = setTimeout(() => {
          if (wildcards.length > 0) {
            setWildcardPhase("reason");
          } else {
            setWildcardPhase("done");
          }
        }, 4000);
        return () => clearTimeout(t);
      } else if (wildcardPhase === "reason") {
        const t = setTimeout(() => setWildcardPhase("name"), 4000);
        return () => clearTimeout(t);
      } else if (wildcardPhase === "name") {
        const t = setTimeout(() => {
          if (wildcardIdx < wildcards.length - 1) {
            setWildcardIdx(prev => prev + 1);
            setWildcardPhase("reason");
          } else {
            setWildcardPhase("done");
          }
        }, 4000);
        return () => clearTimeout(t);
      }
    }
  }, [step, wildcardPhase, wildcardIdx, wildcards.length]);

  const allQualified = useMemo(
    () => [...autoQualified, ...wildcards],
    [autoQualified, wildcards],
  );

  const [potPhase, setPotPhase] = useState<"divide" | "ready">("divide");
  const [pots, setPots] = useState<{ pot1: Team[]; pot2: Team[] }>({
    pot1: [],
    pot2: [],
  });

  const handleDividePots = () => {
    // 8 and 8
    const shuffled = [...allQualified].sort(() => Math.random() - 0.5);
    setPots({
      pot1: shuffled.slice(0, 8),
      pot2: shuffled.slice(8, 16),
    });
    setPotPhase("ready");
  };

  const [currentPick, setCurrentPick] = useState<{ pot: 1 | 2; index: number }>(
    { pot: 1, index: 0 },
  );
  const [bracketAssignments, setBracketAssignments] = useState<
    Record<string, Team>
  >({});

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

    setBracketAssignments((prev) => ({ ...prev, [matchKey]: team }));

    // Send to Firestore Bracket
    const mId = matchKey.replace("-home", "").replace("-away", "");
    if (matchKey.includes("home")) {
      await handleSaveBracket({
        id: mId,
        homeTeamId: team.id,
        homeTeamName: team.name,
      });
    } else {
      await handleSaveBracket({
        id: mId,
        awayTeamId: team.id,
        awayTeamName: team.name,
      });
    }
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
              
              <div className="w-full relative h-[400px] overflow-hidden">
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

                      let homeStatus = "text-white";
                      let awayStatus = "text-white";
                      
                      // if past match OR finished current match, highlight winner
                      if (absoluteIdx < currentMatchIdx || (isCurrent && matchFinished)) {
                         if (dHomeScore > dAwayScore) homeStatus = "text-fc-neon-green";
                         if (dAwayScore > dHomeScore) awayStatus = "text-fc-neon-green";
                      }

                      return (
                        <motion.div
                          key={`match-${m.id}`}
                          layout
                          initial={{ opacity: 0, scale: 0.8, y: 50 }}
                          animate={{
                            opacity: isCurrent ? 1 : 0.4,
                            scale: isCurrent ? 1 : 0.9,
                            y: 0,
                          }}
                          exit={{ opacity: 0, scale: 0.8, y: -50 }}
                          transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
                          className={`bg-white/5 border ${
                            isCurrent && !matchFinished
                              ? "border-fc-neon-green/50 shadow-[0_0_15px_rgba(204,255,0,0.2)] animate-pulse"
                              : "border-white/10"
                          } rounded-2xl p-4 mb-4 w-full max-w-md mx-auto flex justify-between items-center`}
                        >
                          <span className={`font-bold truncate max-w-[120px] ${homeStatus}`}>
                            {home?.name || "TBD"}
                          </span>
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] text-white/50 mb-1">
                              {new Date(m.date).toLocaleDateString()}
                            </span>
                            <div className="font-mono font-black text-fc-neon-green text-2xl text-center min-w-[60px] bg-black/40 px-3 py-1 rounded-lg">
                              {dHomeScore} - {dAwayScore}
                            </div>
                            {isCurrent && matchFinished && dHomeScore !== dAwayScore && (
                              <motion.div initial={{scale:0}} animate={{scale:1}} className="text-[9px] text-fc-neon-green mt-1 font-bold uppercase">
                                Winner Decided
                              </motion.div>
                            )}
                          </div>
                          <span className={`font-bold truncate max-w-[120px] text-right ${awayStatus}`}>
                            {away?.name || "TBD"}
                          </span>
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
                   <AnimatePresence mode="popLayout">
                     {goalScorers.map((s, i) => (
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
                         <span className="text-fc-neon-green font-mono font-bold">{s.goals}</span>
                       </motion.div>
                     ))}
                   </AnimatePresence>
                </div>

                {/* Clean Sheets */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                   <div className="flex items-center gap-3 mb-4 text-white/60">
                     <Shield className="w-5 h-5 text-blue-400" />
                     <h4 className="font-bold uppercase tracking-widest text-xs">Clean Sheets</h4>
                   </div>
                   <AnimatePresence mode="popLayout">
                     {cleanSheets.map((s, i) => (
                       <motion.div
                         key={s.gamerName}
                         layout
                         initial={{ opacity: 0, x: -20 }}
                         animate={{ opacity: 1, x: 0 }}
                         exit={{ opacity: 0, x: 20 }}
                         className="flex items-center justify-between bg-black/40 p-2 rounded-lg mb-2 text-sm"
                       >
                         <div className="flex items-center gap-3">
                           <span className="font-bold text-white/40 w-4">#{i+1}</span>
                           <span className="font-bold text-white">{s.gamerName}</span>
                         </div>
                         <span className="text-blue-400 font-mono font-bold">{s.cleanSheets}</span>
                       </motion.div>
                     ))}
                   </AnimatePresence>
                </div>

                 {/* MOTMs */}
                 <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                   <div className="flex items-center gap-3 mb-4 text-white/60">
                     <Star className="w-5 h-5 text-yellow-400" />
                     <h4 className="font-bold uppercase tracking-widest text-xs">Man of the Match</h4>
                   </div>
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
                         <span className="text-yellow-400 font-mono font-bold">{s.awards}</span>
                       </motion.div>
                     ))}
                   </AnimatePresence>
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
                  {stat.value}
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

              {(wildcardPhase === "reason" || wildcardPhase === "name") &&
                wildcards[wildcardIdx] && (
                  <motion.div
                    key={`reveal-${wildcardIdx}`}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -30 }}
                    className="flex flex-col items-center w-full"
                  >
                    <div className="text-fc-neon-green font-bold uppercase tracking-widest text-sm mb-4">
                      Wildcard Selected ({wildcardIdx + 1} of {wildcards.length})
                    </div>

                    <div className="bg-white/5 border border-white/10 p-6 rounded-xl w-full max-w-lg mb-6 shadow-xl">
                      <p className="text-white/80 font-mono text-sm leading-relaxed text-left">
                        &gt; Group: {wildcards[wildcardIdx].group}
                        <br />
                        &gt; Points: {wildcards[wildcardIdx].points}
                        <br />
                        &gt; Goal Difference: {wildcards[wildcardIdx].gd >= 0 ? "+" : ""}
                        {wildcards[wildcardIdx].gd}
                        <br />
                        &gt; Status: Outstanding performance in a highly competitive group.
                      </p>
                    </div>

                    {wildcardPhase === "name" && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center bg-white/10 px-12 py-6 rounded-2xl border border-white/20"
                      >
                        <span className="text-2xl font-bold uppercase tracking-widest text-white/50 mb-2">
                          {wildcards[wildcardIdx].country || "Unknown"}
                        </span>
                        <span className="text-5xl font-display font-black text-white">
                          {wildcards[wildcardIdx].name}
                        </span>
                      </motion.div>
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
              Total 16 Teams will be distributed into Pot 1 (8 Teams) & Pot 2 (8
              Teams)
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
                      className={`flex justify-between items-center p-2 rounded ${homeTeam ? "bg-fc-purple-light/20 border border-fc-purple-light/30" : "bg-white/5 border border-transparent"}`}
                    >
                      <span className="text-xs font-bold truncate max-w-[100px] text-white">
                        {homeTeam ? homeTeam.name : "TBD"}
                      </span>
                      {homeTeam && (
                        <span className="text-[10px] text-white/40">
                          {homeTeam.country}
                        </span>
                      )}
                    </div>

                    <div className="text-center text-[10px] text-white/30 font-bold uppercase w-full">
                      VS
                    </div>

                    <div
                      className={`flex justify-between items-center p-2 rounded ${awayTeam ? "bg-fc-neon-green/20 border border-fc-neon-green/30" : "bg-white/5 border border-transparent"}`}
                    >
                      <span className="text-xs font-bold truncate max-w-[100px] text-white">
                        {awayTeam ? awayTeam.name : "TBD"}
                      </span>
                      {awayTeam && (
                        <span className="text-[10px] text-white/40">
                          {awayTeam.country}
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
