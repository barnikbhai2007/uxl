import { Team } from './types';

export const TEAMS_LIST = [
  "AYUSH", "SOUMAJIT", "ARYAN", "SONU", "RANAJAY", "SAMRIDDHA", 
  "RAJAT", "BARNIK", "PRITAM", "DIBYAJOTI", "PRIYAM", "SAGNIK", 
  "SAGNICK", "ABHROJEET", "SAYANTAN", "ANIMESH"
];

export const TEAM_UIDS: Record<string, string> = {
  "AYUSH": "847857761683775488",
  "SOUMAJIT": "910022838300041217",
  "ARYAN": "908741022842437637",
  "SONU": "545136672475017216",
  "RANAJAY": "666275283639996417",
  "SAMRIDDHA": "1000129435803713536",
  "RAJAT": "842718468706385920",
  "BARNIK": "858045300533792768",
  "PRITAM": "1058620361900937216",
  "DIBYAJOTI": "998821168026656769",
  "PRIYAM": "713327705700397056",
  "SAGNIK": "1031556959882035200",
  "SAGNICK": "881759190897385472",
  "ABHROJEET": "1000048169385328640",
  "SAYANTAN": "1044989674656509952",
  "ANIMESH": "646962951897718784"
};

export const INITIAL_TEAMS: Team[] = TEAMS_LIST.map((name, index) => ({
  id: `team-${index}`,
  name,
  uid: TEAM_UIDS[name] || "",
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  gf: 0,
  ga: 0,
  gd: 0,
  points: 0,
}));

export interface RawMatch {
  away: string;
  home: string;
  matchday: number;
}

export const TOURNAMENT_SCHEDULE: RawMatch[] = [
  // Matchday 1
  { away: "RAJAT", home: "SAMRIDDHA", matchday: 1 },
  { away: "ARYAN", home: "SONU", matchday: 1 },
  { away: "SAMRIDDHA", home: "SOUMAJIT", matchday: 1 },
  { away: "SONU", home: "SOUMAJIT", matchday: 1 },
  { away: "PRIYAM", home: "SAGNICK", matchday: 1 },
  { away: "DIBYAJOTI", home: "SAGNIK", matchday: 1 },
  { away: "AYUSH", home: "PRITAM", matchday: 1 },
  { away: "PRIYAM", home: "SAGNIK", matchday: 1 },
  { away: "ANIMESH", home: "SAYANTAN", matchday: 1 },
  { away: "ABHROJEET", home: "AYUSH", matchday: 1 },
  { away: "DIBYAJOTI", home: "PRITAM", matchday: 1 },
  { away: "ANIMESH", home: "SAGNICK", matchday: 1 },
  { away: "ABHROJEET", home: "SAYANTAN", matchday: 1 },
  { away: "ARYAN", home: "RANAJAY", matchday: 1 },
  { away: "BARNIK", home: "RANAJAY", matchday: 1 },
  { away: "BARNIK", home: "RAJAT", matchday: 1 },

  // Matchday 2
  { away: "BARNIK", home: "SAYANTAN", matchday: 2 },
  { away: "RAJAT", home: "RANAJAY", matchday: 2 },
  { away: "ABHROJEET", home: "SAMRIDDHA", matchday: 2 },
  { away: "SAGNIK", home: "SOUMAJIT", matchday: 2 },
  { away: "PRITAM", home: "SAGNIK", matchday: 2 },
  { away: "ABHROJEET", home: "ANIMESH", matchday: 2 },
  { away: "PRIYAM", home: "RANAJAY", matchday: 2 },
  { away: "AYUSH", home: "PRIYAM", matchday: 2 },
  { away: "DIBYAJOTI", home: "RAJAT", matchday: 2 },
  { away: "DIBYAJOTI", home: "SOUMAJIT", matchday: 2 },
  { away: "SAMRIDDHA", home: "SONU", matchday: 2 },
  { away: "PRITAM", home: "SAGNICK", matchday: 2 },
  { away: "AYUSH", home: "SAGNICK", matchday: 2 },
  { away: "ARYAN", home: "BARNIK", matchday: 2 },
  { away: "ARYAN", home: "SAYANTAN", matchday: 2 },
  { away: "ANIMESH", home: "SONU", matchday: 2 },

  // Matchday 3
  { away: "RANAJAY", home: "SAYANTAN", matchday: 3 },
  { away: "ABHROJEET", home: "SAGNICK", matchday: 3 },
  { away: "AYUSH", home: "RANAJAY", matchday: 3 },
  { away: "ABHROJEET", home: "SONU", matchday: 3 },
  { away: "ARYAN", home: "SOUMAJIT", matchday: 3 },
  { away: "ARYAN", home: "SAGNICK", matchday: 3 },
  { away: "ANIMESH", home: "DIBYAJOTI", matchday: 3 },
  { away: "BARNIK", home: "SAGNIK", matchday: 3 },
  { away: "DIBYAJOTI", home: "SONU", matchday: 3 },
  { away: "ANIMESH", home: "SAMRIDDHA", matchday: 3 },
  { away: "PRITAM", home: "PRIYAM", matchday: 3 },
  { away: "SAGNIK", home: "SAMRIDDHA", matchday: 3 },
  { away: "BARNIK", home: "SOUMAJIT", matchday: 3 },
  { away: "PRITAM", home: "RAJAT", matchday: 3 },
  { away: "PRIYAM", home: "SAYANTAN", matchday: 3 },
  { away: "AYUSH", home: "RAJAT", matchday: 3 },

  // Matchday 4
  { away: "AYUSH", home: "SOUMAJIT", matchday: 4 },
  { away: "BARNIK", home: "PRIYAM", matchday: 4 },
  { away: "RANAJAY", home: "SAMRIDDHA", matchday: 4 },
  { away: "ANIMESH", home: "SAGNIK", matchday: 4 },
  { away: "ARYAN", home: "PRITAM", matchday: 4 },
  { away: "SAYANTAN", home: "SOUMAJIT", matchday: 4 },
  { away: "ABHROJEET", home: "PRITAM", matchday: 4 },
  { away: "AYUSH", home: "SONU", matchday: 4 },
  { away: "DIBYAJOTI", home: "PRIYAM", matchday: 4 },
  { away: "ABHROJEET", home: "RAJAT", matchday: 4 },
  { away: "RAJAT", home: "SONU", matchday: 4 },
  { away: "DIBYAJOTI", home: "SAMRIDDHA", matchday: 4 },
  { away: "ARYAN", home: "SAGNIK", matchday: 4 },
  { away: "ANIMESH", home: "BARNIK", matchday: 4 },
  { away: "RANAJAY", home: "SAGNICK", matchday: 4 },
  { away: "SAGNICK", home: "SAYANTAN", matchday: 4 },

  // Matchday 5
  { away: "DIBYAJOTI", home: "SAYANTAN", matchday: 5 },
  { away: "ABHROJEET", home: "SAGNIK", matchday: 5 },
  { away: "ANIMESH", home: "SOUMAJIT", matchday: 5 },
  { away: "RAJAT", home: "SAGNICK", matchday: 5 },
  { away: "ARYAN", home: "AYUSH", matchday: 5 },
  { away: "BARNIK", home: "SAMRIDDHA", matchday: 5 },
  { away: "PRITAM", home: "RANAJAY", matchday: 5 },
  { away: "PRIYAM", home: "SONU", matchday: 5 },
];
