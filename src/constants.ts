import { Team } from './types';

export const TEAMS_LIST = [
  "AYUSH", "SOUMAJIT", "ARYAN", "SONU", "RANAJAY", "SAMRIDDHA", 
  "RAJAT", "BARNIK", "PRITAM", "DIBYAJOTI", "PRIYAM", "SAGNIK", 
  "SAGNICK", "ABHROJEET", "SAYANTAN", "ANIMESH"
];

export const TEAM_DETAILS: Record<string, { fcName: string, uid: string, ovr: number, fullName: string, goalkeeper: string }> = {
  "AYUSH": { fcName: "AYUSH_08", uid: "847857761683775488", ovr: 121, fullName: "Ayush Saha", goalkeeper: "Joan Garcia" },
  "SOUMAJIT": { fcName: "soubiswas2", uid: "910022838300041217", ovr: 121, fullName: "Soumajit Biswas", goalkeeper: "Buffon" },
  "ARYAN": { fcName: "Baby_Aryanrox121", uid: "908741022842437637", ovr: 119, fullName: "Aryan Sarkar", goalkeeper: "Yashin" },
  "SONU": { fcName: "sonu2007", uid: "545136672475017216", ovr: 119, fullName: "Sonu Mandal", goalkeeper: "Courtois" },
  "RANAJAY": { fcName: "GamerR", uid: "666275283639996417", ovr: 121, fullName: "RANAJOY BHOWMIK", goalkeeper: "Cech" },
  "SAMRIDDHA": { fcName: "sam1017", uid: "1000129435803713536", ovr: 121, fullName: "Samriddha Mandal", goalkeeper: "Dudek" },
  "RAJAT": { fcName: "rd10", uid: "842718468706385920", ovr: 121, fullName: "Rajat Das", goalkeeper: "Savic" },
  "BARNIK": { fcName: "brokenaqua", uid: "858045300533792768", ovr: 121, fullName: "Barnik", goalkeeper: "Donnarumma" },
  "PRITAM": { fcName: "Pritam", uid: "1058620361900937216", ovr: 120, fullName: "Pritam ghosh", goalkeeper: "Bounou" },
  "DIBYAJOTI": { fcName: "dibya7334", uid: "998821168026656769", ovr: 121, fullName: "Dibyajyoti Sarkar", goalkeeper: "Muselera" },
  "PRIYAM": { fcName: "Priyam2007", uid: "713327705700397056", ovr: 120, fullName: "Priyam Paul", goalkeeper: "Courtois" },
  "SAGNIK": { fcName: "Kundes", uid: "1031556959882035200", ovr: 119, fullName: "Sagnik Kundu", goalkeeper: "Robert Sanchez" },
  "SAGNICK": { fcName: "AYU45", uid: "881759190897385472", ovr: 116, fullName: "Sagnick Roy", goalkeeper: "Savic" },
  "ABHROJEET": { fcName: "Abhrojeet", uid: "1000048169385328640", ovr: 115, fullName: "Abhrojeet Kundu", goalkeeper: "Savic" },
  "SAYANTAN": { fcName: "Sayantan111", uid: "1044989674656509952", ovr: 117, fullName: "Sayantan Paul", goalkeeper: "Cech" },
  "ANIMESH": { fcName: "Ashish..Won", uid: "646962951897718784", ovr: 119, fullName: "Animesh", goalkeeper: "Courtois" }
};

export const WORLD_CUP_TEAMS = [
  { name: 'Argentina', flag: '🇦🇷' },
  { name: 'Australia', flag: '🇦🇺' },
  { name: 'Belgium', flag: '🇧🇪' },
  { name: 'Brazil', flag: '🇧🇷' },
  { name: 'Cameroon', flag: '🇨🇲' },
  { name: 'Canada', flag: '🇨🇦' },
  { name: 'Colombia', flag: '🇨🇴' },
  { name: 'Costa Rica', flag: '🇨🇷' },
  { name: 'Croatia', flag: '🇭🇷' },
  { name: 'Denmark', flag: '🇩🇰' },
  { name: 'Ecuador', flag: '🇪🇨' },
  { name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { name: 'France', flag: '🇫🇷' },
  { name: 'Germany', flag: '🇩🇪' },
  { name: 'Ghana', flag: '🇬🇭' },
  { name: 'Iran', flag: '🇮🇷' },
  { name: 'Italy', flag: '🇮🇹' },
  { name: 'Japan', flag: '🇯🇵' },
  { name: 'Mexico', flag: '🇲🇽' },
  { name: 'Morocco', flag: '🇲🇦' },
  { name: 'Netherlands', flag: '🇳🇱' },
  { name: 'Poland', flag: '🇵🇱' },
  { name: 'Portugal', flag: '🇵🇹' },
  { name: 'Saudi Arabia', flag: '🇸🇦' },
  { name: 'Senegal', flag: '🇸🇳' },
  { name: 'Serbia', flag: '🇷🇸' },
  { name: 'South Korea', flag: '🇰🇷' },
  { name: 'Spain', flag: '🇪🇸' },
  { name: 'Switzerland', flag: '🇨🇭' },
  { name: 'USA', flag: '🇺🇸' },
  { name: 'Uruguay', flag: '🇺🇾' },
  { name: 'Wales', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
];

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
    goalkeeper: details?.goalkeeper || "",
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
    form: [],
  };
});

export interface RawMatch {
  away: string;
  home: string;
  matchday: number;
  type?: 'qualifier' | 'quarterfinal' | 'semifinal' | 'thirdplace' | 'final';
  rescheduled?: boolean;
  matchNumber?: number;
  leg?: 'Leg 1' | 'Leg 2';
}

export const TOURNAMENT_SCHEDULE: RawMatch[] = [
  // Matchday 1 - 27th March
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
  { away: "RAJAT", home: "BARNIK", matchday: 1 },
  { away: "RANAJAY", home: "BARNIK", matchday: 1 },

  // Matchday 2 - 28th March
  { away: "BARNIK", home: "SAYANTAN", matchday: 2 },
  { away: "RAJAT", home: "RANAJAY", matchday: 3, rescheduled: true },
  { away: "ABHROJEET", home: "SAMRIDDHA", matchday: 2 },
  { away: "SAGNIK", home: "SOUMAJIT", matchday: 2 },
  { away: "PRITAM", home: "SAGNIK", matchday: 2 },
  { away: "ABHROJEET", home: "ANIMESH", matchday: 2 },
  { away: "PRIYAM", home: "RANAJAY", matchday: 3, rescheduled: true },
  { away: "AYUSH", home: "PRIYAM", matchday: 2 },
  { away: "DIBYAJOTI", home: "RAJAT", matchday: 2 },
  { away: "DIBYAJOTI", home: "SOUMAJIT", matchday: 2 },
  { away: "SAMRIDDHA", home: "SONU", matchday: 2 },
  { away: "PRITAM", home: "SAGNICK", matchday: 2 },
  { away: "AYUSH", home: "SAGNICK", matchday: 2 },
  { away: "ARYAN", home: "BARNIK", matchday: 2 },
  { away: "ARYAN", home: "SAYANTAN", matchday: 2 },
  { away: "ANIMESH", home: "SONU", matchday: 2 },

  // Matchday 3 - 29th March
  { away: "SAYANTAN", home: "RANAJAY", matchday: 3 },
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
  { away: "SOUMAJIT", home: "BARNIK", matchday: 3 },
  { away: "PRITAM", home: "RAJAT", matchday: 3 },
  { away: "PRIYAM", home: "SAYANTAN", matchday: 3 },
  { away: "AYUSH", home: "RAJAT", matchday: 3 },

  // Matchday 4 - 30th March (Ongoing)
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
  { away: "DIBYAJOTI", home: "SAYANTAN", matchday: 4 },
  { away: "ABHROJEET", home: "SAGNIK", matchday: 4 },
  { away: "ANIMESH", home: "SOUMAJIT", matchday: 4 },
  { away: "RAJAT", home: "SAGNICK", matchday: 4 },
  { away: "ARYAN", home: "AYUSH", matchday: 4 },
  { away: "BARNIK", home: "SAMRIDDHA", matchday: 4 },
  { away: "PRITAM", home: "RANAJAY", matchday: 4 },
  { away: "PRIYAM", home: "SONU", matchday: 4 },

  // Matchday 5 - 31st March (Qualifiers & Quarterfinals)
  { away: "ANIMESH", home: "BARNIK", matchday: 5, type: 'qualifier', matchNumber: 73, leg: 'Leg 1' },
  { away: "RAJAT", home: "RANAJAY", matchday: 5, type: 'qualifier', matchNumber: 74, leg: 'Leg 1' },
  { away: "SONU", home: "SAGNIK", matchday: 5, type: 'qualifier', matchNumber: 75, leg: 'Leg 1' },
  { away: "AYUSH", home: "SOUMAJIT", matchday: 5, type: 'qualifier', matchNumber: 76, leg: 'Leg 1' },
  { away: "BARNIK", home: "ANIMESH", matchday: 5, type: 'qualifier', matchNumber: 77, leg: 'Leg 2' },
  { away: "RANAJAY", home: "RAJAT", matchday: 5, type: 'qualifier', matchNumber: 78, leg: 'Leg 2' },
  { away: "SAGNIK", home: "SONU", matchday: 5, type: 'qualifier', matchNumber: 79, leg: 'Leg 2' },
  { away: "SOUMAJIT", home: "AYUSH", matchday: 5, type: 'qualifier', matchNumber: 80, leg: 'Leg 2' },

  { away: "ARYAN", home: "BARNIK", matchday: 5, type: 'quarterfinal', matchNumber: 81, leg: 'Leg 1' },
  { away: "PRIYAM", home: "RANAJAY", matchday: 5, type: 'quarterfinal', matchNumber: 82, leg: 'Leg 1' },
  { away: "PRITAM", home: "SONU", matchday: 5, type: 'quarterfinal', matchNumber: 83, leg: 'Leg 1' },
  { away: "SAMRIDDHA", home: "TBD", matchday: 5, type: 'quarterfinal', matchNumber: 84, leg: 'Leg 1' },
  { away: "BARNIK", home: "ARYAN", matchday: 5, type: 'quarterfinal', matchNumber: 85, leg: 'Leg 2' },
  { away: "RANAJAY", home: "PRIYAM", matchday: 5, type: 'quarterfinal', matchNumber: 86, leg: 'Leg 2' },
  { away: "SONU", home: "PRITAM", matchday: 5, type: 'quarterfinal', matchNumber: 87, leg: 'Leg 2' },
  { away: "TBD", home: "SAMRIDDHA", matchday: 5, type: 'quarterfinal', matchNumber: 88, leg: 'Leg 2' },

  // Matchday 6 - 1st April (Semis, 3rd Place & Final)
  { away: "TBD", home: "TBD", matchday: 6, type: 'semifinal', matchNumber: 89, leg: 'Leg 1' },
  { away: "TBD", home: "TBD", matchday: 6, type: 'semifinal', matchNumber: 90, leg: 'Leg 1' },
  { away: "TBD", home: "TBD", matchday: 6, type: 'semifinal', matchNumber: 91, leg: 'Leg 2' },
  { away: "TBD", home: "TBD", matchday: 6, type: 'semifinal', matchNumber: 92, leg: 'Leg 2' },
  { away: "TBD", home: "TBD", matchday: 6, type: 'thirdplace', matchNumber: 93 },
  { away: "TBD", home: "TBD", matchday: 6, type: 'final', matchNumber: 94 },
];
