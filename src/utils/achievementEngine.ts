import { Match, Team, Registration, Achievement } from '../types';

export function evaluateAchievements(
  team: Team,
  matches: Match[],
  registration: Registration
): string[] {
  const earned: string[] = [];
  const award = (id: string) => {
    if (!earned.includes(id)) earned.push(id);
  };

  const myMatches = matches
    .filter((m) => (m.homeTeamId === team.id || m.awayTeamId === team.id) && m.status === 'finished')
    .sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));

  let wins = 0;
  let losses = 0;
  let draws = 0;
  let cleanSheets = 0;
  let cleanSheetStreak = 0;
  let groupMatchesPlayed = 0; // Rough heuristic, assuming no round = group stage or qualifiers
  
  let totalMatches = myMatches.length;

  for (const match of myMatches) {
    const isHome = match.homeTeamId === team.id;
    const myScore = isHome ? (match.homeScore ?? 0) : (match.awayScore ?? 0);
    const oppScore = isHome ? (match.awayScore ?? 0) : (match.homeScore ?? 0);
    const myStats = isHome ? match.homeStats : match.awayStats;
    const oppStats = isHome ? match.awayStats : match.homeStats;

    const myScorers = isHome ? (match.homeScorers || []) : (match.awayScorers || []);
    const oppScorers = !isHome ? (match.homeScorers || []) : (match.awayScorers || []);

    // Outcomes
    if (myScore > oppScore) {
      wins++;
      award('first_blood');
      if (oppScore === 0) {
        award('clean_sheet_king');
        cleanSheets++;
        cleanSheetStreak++;
        if (cleanSheetStreak >= 3) award('the_wall');
      } else {
        cleanSheetStreak = 0;
      }
      if (myScore >= 3 && oppScore >= 3) award('thriller');
      
      // Comeback Kid check
      // Sort all goals by time to see if we were down by 2+
      const allGoals = [
        ...(myScorers.flatMap(s => String(s.time || '').split(',').map(t => ({ team: 'me', time: parseInt(t.trim().replace("'", "")) })))),
        ...(oppScorers.flatMap(s => String(s.time || '').split(',').map(t => ({ team: 'opp', time: parseInt(t.trim().replace("'", "")) }))))
      ].filter(g => !isNaN(g.time)).sort((a,b) => a.time - b.time);

      let myRunScore = 0;
      let oppRunScore = 0;
      let wasDownBy2 = false;
      for (const goal of allGoals) {
        if (goal.team === 'me') myRunScore++;
        else oppRunScore++;
        if (oppRunScore - myRunScore >= 2) wasDownBy2 = true;
      }
      if (wasDownBy2) award('comeback_kid');

    } else if (myScore < oppScore) {
      losses++;
      cleanSheetStreak = 0;
      
      // Bottler check
      const allGoals = [
        ...(myScorers.flatMap(s => String(s.time || '').split(',').map(t => ({ team: 'me', time: parseInt(t.trim().replace("'", "")) })))),
        ...(oppScorers.flatMap(s => String(s.time || '').split(',').map(t => ({ team: 'opp', time: parseInt(t.trim().replace("'", "")) }))))
      ].filter(g => !isNaN(g.time)).sort((a,b) => a.time - b.time);

      let myRunScore = 0;
      let oppRunScore = 0;
      let wasUpBy2 = false;
      for (const goal of allGoals) {
        if (goal.team === 'me') myRunScore++;
        else oppRunScore++;
        if (myRunScore - oppRunScore >= 2) wasUpBy2 = true;
      }
      if (wasUpBy2) award('bottler');

    } else {
      draws++;
      cleanSheetStreak = 0;
      if (myScore >= 3) award('thriller');
    }

    // Goalkeeper & Defense
    if (oppScore >= 5) award('goalkeeper_nightmare');
    if (oppStats && oppStats.shotsOnTarget === 0) award('fort_knox');
    if (myStats && myStats.saves >= 10) award('spider_man');

    // Scorers & Goals
    myScorers.forEach(s => {
      if (s.goals >= 3) award('hat_trick_hero');
      if (s.goals >= 5) award('sniper');
      if (s.playerName?.toLowerCase().includes('(og)')) award('uno_reversed');
      
      const times = String(s.time || '').split(',').map(t => parseInt(t.trim().replace("'", ""))).filter(t => !isNaN(t));
      times.forEach(t => {
        if (t >= 90) award('last_minute_hero');
        if (t === 67) award('lover_67');
        if (t === 69) award('lover_69');
      });
    });

    oppScorers.forEach(s => {
      const times = String(s.time || '').split(',').map(t => parseInt(t.trim().replace("'", ""))).filter(t => !isNaN(t));
      times.forEach(t => {
        if (t >= 90) award('heartbreak_90');
      });
    });
  }

  // Tournament Wide checks
  if (totalMatches > 0 && draws === totalMatches) award('coin_flip_guy');
  if (totalMatches >= 3 && losses === 0) award('unbeaten'); 

  const qualifiers = myMatches.filter(m => m.type === 'qualifier' || !m.type);
  if (qualifiers.length >= 3) {
    if (qualifiers.every(m => {
      const isHome = m.homeTeamId === team.id;
      return isHome ? (m.homeScore || 0) > (m.awayScore || 0) : (m.awayScore || 0) > (m.homeScore || 0);
    })) {
      award('perfect_run');
    }
    if (qualifiers.every(m => {
      const isHome = m.homeTeamId === team.id;
      return isHome ? (m.awayScore || 0) === 0 : (m.homeScore || 0) === 0;
    })) {
      award('untouchable');
    }
  }

  const finalMatch = myMatches.find(m => m.type === 'final');
  if (finalMatch) {
    award('runner_up');
    const isHome = finalMatch.homeTeamId === team.id;
    const myScore = isHome ? (finalMatch.homeScore ?? 0) : (finalMatch.awayScore ?? 0);
    const oppScore = isHome ? (finalMatch.awayScore ?? 0) : (finalMatch.homeScore ?? 0);
    
    if (myScore > oppScore) {
      award('champion');
    } else if (myScore < oppScore) {
      award('almost_there');
    }
  }
  
  return earned;
}
