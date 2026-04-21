export interface Team {
  id: string;
  name: string;
  shortName: string;
  fullName: string;
  fcName: string;
  ovr: number;
  uid: string;
  goalkeeper?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  form: string[];
  logoUrl?: string;
}

export interface Scorer {
  playerName: string;
  goals: number;
  time?: string;
}

export interface MatchStats {
  shots: number;
  shotsOnTarget: number;
  possession: number;
  passAccuracy: number;
  fouls: number;
  offsides: number;
}

export interface Match {
  id: string;
  matchNumber: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore?: number;
  awayScore?: number;
  homeScorers?: Scorer[];
  awayScorers?: Scorer[];
  homeStats?: MatchStats;
  awayStats?: MatchStats;
  manOfTheMatch?: string;
  date: string;
  status: 'scheduled' | 'live' | 'finished' | 'rescheduled';
  type?: 'qualifier' | 'quarterfinal' | 'semifinal' | 'thirdplace' | 'final';
  rescheduled?: boolean;
  isDNF?: boolean;
  matchday?: number;
  leg?: 'Leg 1' | 'Leg 2';
}

export interface BracketMatch {
  id: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeScore?: number;
  awayScore?: number;
  winnerId?: string;
  nextMatchId?: string;
  round: string;
  leg?: 'Leg 1' | 'Leg 2';
  month?: 'April' | 'May';
}

export interface Registration {
  id: string;
  userId: string;
  name: string;
  age: number;
  fcUid: string;
  fcName: string;
  teamOvr: number;
  experience: string;
  timestamp: any;
  status: 'pending' | 'approved' | 'rejected';
  email?: string;
  logoUrl?: string;
  goalkeeper: string;
}

export interface AppContent {
  id: string;
  text: string;
}

export interface Config {
  registrationEnabled: boolean;
  tabVisibility?: Record<string, boolean>;
  dateOrder?: string[];
  geminiApiKey?: string;
  geminiModel?: string;
}
