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
  country?: string;
  group?: string;
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
  saves: number;
}

export interface MatchEditLog {
  editedBy: string;
  editedAt: string;
  changes: string;
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
  editLogs?: MatchEditLog[];
  homeStats?: MatchStats;
  awayStats?: MatchStats;
  manOfTheMatch?: string;
  motm?: { fcName: string, userId: string } | null;
  date: string;
  status: 'scheduled' | 'live' | 'finished' | 'rescheduled';
  type?: 'qualifier' | 'quarterfinal' | 'semifinal' | 'thirdplace' | 'final';
  rescheduled?: boolean;
  isDNF?: boolean;
  matchday?: number;
  leg?: 'Leg 1' | 'Leg 2';
  evidenceUploadedBy?: string;
  evidenceTimestamp?: any;
  evidenceImage?: string;
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
  round: string | number;
  leg?: 'Leg 1' | 'Leg 2';
  month?: 'April' | 'May';
  scheduledDate?: string;
  matchday?: number;
  matchNumber?: number;
  status?: string;
  isBye?: boolean;
}

export interface Registration {
  id: string;
  userId: string;
  name: string;
  age: number;
  fcName: string;
  teamOvr: number;
  experience: string;
  timestamp: any;
  status: 'pending' | 'approved' | 'rejected';
  email?: string;
  logoUrl?: string;
  goalkeeper: string;
  country?: string;
}

export interface AppContent {
  id: string;
  text: string;
}

export interface Config {
  registrationEnabled: boolean;
  tabVisibility?: Record<string, boolean>;
  hiddenDates?: string[];
  dateOrder?: string[];
  geminiApiKey?: string;
  allowedNames?: string[];
  geminiModel?: string;
  groupType?: 'single' | 'many';
  playersPerGroup?: number;
  groupAssignments?: Record<string, string>;
  groupNames?: Record<string, string>;
  groupLabels?: Record<string, string>;
  lockedCountries?: string[];
  drawAdminEnabled?: boolean;
}

export interface MatchReport {
  id: string;
  matchData: any;
  reporterName: string;
  timestamp: any;
  imageUrl: string;
  mimeType: string;
  motm?: { fcName: string; userId: string } | null;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: 'Match' | 'Goal' | 'Tournament' | 'Cursed' | 'Tragic' | 'Unhinged' | 'Glove Story';
  icon: string;
}

export interface UserAchievement {
  unlockedAt: any;
  seen: boolean;
}

export interface UserAchievementMap {
  [achievementId: string]: UserAchievement;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'user';
  achievements?: UserAchievementMap;
}
