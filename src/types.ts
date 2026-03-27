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
}

export interface Scorer {
  playerName: string;
  goals: number;
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
  date: string;
  status: 'scheduled' | 'live' | 'finished';
}

export interface BracketMatch {
  id: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeScore?: number;
  awayScore?: number;
  winnerId?: string;
  nextMatchId?: string;
  round: string;
}

export interface VotingCandidate {
  id: string;
  name: string;
  fcName: string;
}

export interface VotingSession {
  id: string;
  sessionId: string;
  matchday: number | string;
  startTime: any;
  endTime: any;
  candidates: VotingCandidate[];
  isActive: boolean;
  showResults?: boolean;
}

export interface Vote {
  voterId: string;
  userId: string;
  candidateId: string;
  matchday: number | string;
  sessionId: string;
  timestamp: any;
}
