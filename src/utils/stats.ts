import { Team, Match } from '../types';

export interface PlayerGoalStats {
  playerName: string;
  gamerName: string;
  gamerFullName: string;
  goals: number;
}

export interface CleanSheetStats {
  gamerName: string;
  gamerFullName: string;
  cleanSheets: number;
}

export interface MotmStats {
  playerName: string;
  awards: number;
}

export const canonicalizePlayerName = (name: string) => {
  if (!name) return '';
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[0-9]/g, '').trim().toLowerCase();
};

export const formatPlayerName = (name: string) => {
  if (!name) return '';
  return name.replace(/[0-9]/g, '').trim(); 
};

export const calculateStats = (teams: Team[], matches: Match[]): (PlayerGoalStats & { teamId: string })[] => {
  const statsMap: Record<string, PlayerGoalStats & { teamId: string }> = {};

  matches.forEach(m => {
    if (m.status === 'finished') {
      const homeTeam = teams.find(t => t.id === m.homeTeamId);
      const awayTeam = teams.find(t => t.id === m.awayTeamId);

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
          statsMap[key].goals += (s.goals || 1);
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
          statsMap[key].goals += (s.goals || 1);
        });
      }
    }
  });

  return Object.values(statsMap).sort((a, b) => b.goals - a.goals);
};

export const calculateCleanSheets = (teams: Team[], matches: Match[]): (CleanSheetStats & { teamId: string })[] => {
  const cleanSheetsMap: Record<string, CleanSheetStats & { teamId: string }> = {};
  
  teams.forEach(t => {
    cleanSheetsMap[t.id] = {
      teamId: t.id,
      gamerName: t.fcName || t.name,
      gamerFullName: t.fullName,
      cleanSheets: 0
    };
  });

  matches.forEach(m => {
    if (m.status === 'finished') {
      if (m.awayScore === 0 && m.homeTeamId) {
        if (cleanSheetsMap[m.homeTeamId]) cleanSheetsMap[m.homeTeamId].cleanSheets += 1;
      }
      if (m.homeScore === 0 && m.awayTeamId) {
        if (cleanSheetsMap[m.awayTeamId]) cleanSheetsMap[m.awayTeamId].cleanSheets += 1;
      }
    }
  });

  return Object.values(cleanSheetsMap)
    .filter(cs => cs.cleanSheets > 0)
    .sort((a, b) => b.cleanSheets - a.cleanSheets);
};

export const calculateStandings = (teams: Pick<Team, 'id'|'name'|'shortName'|'fullName'|'fcName'|'ovr'|'uid'|'goalkeeper'|'played'|'won'|'drawn'|'lost'|'gf'|'ga'|'gd'|'points'|'form'|'logoUrl'|'country'|'group'>[], matches: Match[]): Team[] => {
  const standings = teams.map(t => ({ ...t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: [] as string[] }));
  const standingsMap = new Map(standings.map(t => [t.id, t]));

  matches.forEach(m => {
    if (m.status === 'finished' && typeof m.homeScore === 'number' && typeof m.awayScore === 'number') {
      const home = standingsMap.get(m.homeTeamId);
      const away = standingsMap.get(m.awayTeamId);

      if (home && away) {
        home.played++;
        away.played++;
        home.gf += m.homeScore;
        home.ga += m.awayScore;
        home.gd = home.gf - home.ga;
        
        away.gf += m.awayScore;
        away.ga += m.homeScore;
        away.gd = away.gf - away.ga;

        if (m.homeScore > m.awayScore) {
          home.won++;
          home.points += 3;
          home.form.unshift('W');
          away.lost++;
          away.form.unshift('L');
        } else if (m.homeScore < m.awayScore) {
          away.won++;
          away.points += 3;
          away.form.unshift('W');
          home.lost++;
          home.form.unshift('L');
        } else {
          home.drawn++;
          home.points += 1;
          home.form.unshift('D');
          away.drawn++;
          away.points += 1;
          away.form.unshift('D');
        }

        home.form = home.form.slice(0, 5);
        away.form = away.form.slice(0, 5);
      }
    }
  });

  return standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  }) as Team[];
};

export const calculateMotmLeaders = (matches: Match[]): MotmStats[] => {
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
