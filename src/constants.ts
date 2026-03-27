import { Team } from './types';

export const TEAMS_LIST = [
  "AYUSH", "SOUMAJIT", "ARYAN", "SONU", "RANAJAY", "SAMRIDDHA", 
  "RAJAT", "BARNIK", "PRITAM", "DIBYAJOTI", "PRIYAM", "SAGNIK", 
  "SAGNICK", "ABHROJEET", "SAYANTAN", "ANIMESH"
];

export const TEAM_DETAILS: Record<string, { fcName: string, uid: string, ovr: number, fullName: string }> = {
  "AYUSH": { fcName: "AYUSH_08", uid: "847857761683775488", ovr: 121, fullName: "Ayush Saha" },
  "SOUMAJIT": { fcName: "soubiswas2", uid: "910022838300041217", ovr: 121, fullName: "Soumajit Biswas" },
  "ARYAN": { fcName: "Baby_Aryanrox121", uid: "908741022842437637", ovr: 119, fullName: "Aryan Sarkar" },
  "SONU": { fcName: "sonu2007", uid: "545136672475017216", ovr: 119, fullName: "Sonu Mandal" },
  "RANAJAY": { fcName: "GamerR", uid: "666275283639996417", ovr: 121, fullName: "RANAJOY BHOWMIK" },
  "SAMRIDDHA": { fcName: "sam1017", uid: "1000129435803713536", ovr: 121, fullName: "Samriddha Mandal" },
  "RAJAT": { fcName: "rd10", uid: "842718468706385920", ovr: 121, fullName: "Rajat Das" },
  "BARNIK": { fcName: "brokenaqua", uid: "858045300533792768", ovr: 121, fullName: "Barnik" },
  "PRITAM": { fcName: "Pritam", uid: "1058620361900937216", ovr: 120, fullName: "Pritam ghosh" },
  "DIBYAJOTI": { fcName: "dibya7334", uid: "998821168026656769", ovr: 121, fullName: "Dibyajyoti Sarkar" },
  "PRIYAM": { fcName: "Priyam2007", uid: "713327705700397056", ovr: 120, fullName: "Priyam Paul" },
  "SAGNIK": { fcName: "Kundes", uid: "1031556959882035200", ovr: 119, fullName: "Sagnik Kundu" },
  "SAGNICK": { fcName: "AYU45", uid: "881759190897385472", ovr: 116, fullName: "Sagnick Roy" },
  "ABHROJEET": { fcName: "Abhrojeet", uid: "1000048169385328640", ovr: 115, fullName: "Abhrojeet Kundu" },
  "SAYANTAN": { fcName: "Sayantan111", uid: "1044989674656509952", ovr: 117, fullName: "Sayantan Paul" },
  "ANIMESH": { fcName: "Ashish..Won", uid: "646962951897718784", ovr: 119, fullName: "Animesh" }
};

export const INITIAL_TEAMS: Team[] = TEAMS_LIST.map((name, index) => {
  const details = TEAM_DETAILS[name];
  return {
    id: `team-${index}`,
    name: name, // Keep short name as 'name' for matching
    shortName: name,
    fullName: details?.fullName || name,
    fcName: details?.fcName || "",
    ovr: details?.ovr || 0,
    uid: details?.uid || "",
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
  };
});

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
