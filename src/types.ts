export interface Team {
  id: string;
  name: string;
  uid: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export interface Match {
  id: string;
  matchNumber: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore?: number;
  awayScore?: number;
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
