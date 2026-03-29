import fs from 'fs';

const appCode = fs.readFileSync('src/App.tsx', 'utf8');
const constantsCode = fs.readFileSync('src/constants.ts', 'utf8');

// Extract TEAMS_LIST
const teamsMatch = constantsCode.match(/export const TEAMS_LIST = \[([\s\S]*?)\];/);
const teamsList = teamsMatch[1].split(',').map(s => s.trim().replace(/"/g, '')).filter(Boolean);

// Extract TOURNAMENT_SCHEDULE
const scheduleMatch = constantsCode.match(/export const TOURNAMENT_SCHEDULE: RawMatch\[\] = \[([\s\S]*?)\];/);
const scheduleStr = scheduleMatch[1];
const matches = [];
const regex = /{ away: "([^"]+)", home: "([^"]+)", matchday: (\d+)(?:, type: '([^']+)')?(?:, rescheduled: (true|false))?(?:, matchNumber: (\d+))? }/g;
let m;
while ((m = regex.exec(scheduleStr)) !== null) {
  matches.push({
    away: m[1],
    home: m[2],
    matchday: parseInt(m[3]),
    type: m[4],
    rescheduled: m[5] === 'true',
    matchNumber: m[6] ? parseInt(m[6]) : undefined
  });
}

// Extract results from App.tsx
const resultsRegex = /if \(sm\.home === "([^"]+)" && sm\.away === "([^"]+)"\) {\s*homeScore = (\d+); awayScore = (\d+); status = 'finished';/g;
const results = {};
let rm;
while ((rm = resultsRegex.exec(appCode)) !== null) {
  results[`${rm[1]}-${rm[2]}`] = {
    homeScore: parseInt(rm[3]),
    awayScore: parseInt(rm[4])
  };
}

// Calculate standings
const standings = {};
teamsList.forEach(t => {
  standings[t] = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
});

matches.forEach(match => {
  const result = results[`${match.home}-${match.away}`];
  if (result) {
    const home = match.home;
    const away = match.away;
    const { homeScore, awayScore } = result;

    if (!standings[home]) standings[home] = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
    if (!standings[away]) standings[away] = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };

    standings[home].played++;
    standings[away].played++;
    standings[home].gf += homeScore;
    standings[home].ga += awayScore;
    standings[away].gf += awayScore;
    standings[away].ga += homeScore;

    if (homeScore > awayScore) {
      standings[home].won++;
      standings[home].points += 3;
      standings[away].lost++;
    } else if (homeScore < awayScore) {
      standings[away].won++;
      standings[away].points += 3;
      standings[home].lost++;
    } else {
      standings[home].drawn++;
      standings[away].drawn++;
      standings[home].points += 1;
      standings[away].points += 1;
    }
  }
});

Object.keys(standings).forEach(t => {
  standings[t].gd = standings[t].gf - standings[t].ga;
});

const sortedStandings = Object.entries(standings).map(([name, stats]) => ({ name, ...stats })).sort((a, b) => {
  if (b.points !== a.points) return b.points - a.points;
  if (b.gd !== a.gd) return b.gd - a.gd;
  return b.gf - a.gf;
});

console.log("Team | P | W | D | L | GF | GA | GD | Pts");
console.log("-----------------------------------------");
sortedStandings.forEach(t => {
  console.log(`${t.name.padEnd(10)} | ${t.played} | ${t.won} | ${t.drawn} | ${t.lost} | ${t.gf} | ${t.ga} | ${t.gd} | ${t.points}`);
});
