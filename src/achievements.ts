import { Achievement } from './types';

export const ACHIEVEMENTS: Achievement[] = [
  // Match Achievements
  { id: 'first_blood', title: 'First Blood', description: 'Win your first match', category: 'Match', icon: '🏆' },
  { id: 'clean_sheet_king', title: 'Clean Sheet King', description: 'Win a match without conceding', category: 'Match', icon: '🧤' },
  { id: 'comeback_kid', title: 'Comeback Kid', description: 'Win after being 2 goals down', category: 'Match', icon: '🔄' },
  { id: 'thriller', title: 'Thriller', description: 'Win or draw a match 3-3 or higher', category: 'Match', icon: '🔥' },
  { id: 'last_minute_hero', title: 'Last Minute Hero', description: 'Score in 90th minute or later', category: 'Match', icon: '⏰' },

  // Goal Achievements
  { id: 'hat_trick_hero', title: 'Hat Trick Hero', description: 'Score 3 goals in one match', category: 'Goal', icon: '⚽⚽⚽' },
  { id: 'sniper', title: 'Sniper', description: 'Score 5+ goals in one match', category: 'Goal', icon: '🎯' },

  // Tournament Achievements
  { id: 'perfect_run', title: 'Perfect Run', description: 'Win all group stage matches', category: 'Tournament', icon: '✨' },
  { id: 'unbeaten', title: 'Unbeaten', description: 'Go entire tournament without losing', category: 'Tournament', icon: '🛡️' },
  { id: 'champion', title: 'Champion', description: 'Win the whole tournament', category: 'Tournament', icon: '🥇' },
  { id: 'runner_up', title: 'Runner Up', description: 'Reach the final', category: 'Tournament', icon: '🥈' },

  // Cursed Achievements
  { id: 'uno_reversed', title: 'UNO Reversed', description: 'Score an own goal', category: 'Cursed', icon: '🔁' },
  { id: 'goalkeeper_nightmare', title: 'Goalkeeper\'s Nightmare', description: 'Concede 5+ goals in one match', category: 'Cursed', icon: '😱' },
  { id: 'coin_flip_guy', title: 'The Coin Flip Guy', description: 'Draw every single match', category: 'Cursed', icon: '🪙' },
  { id: 'almost_there', title: 'Almost There', description: 'Lose in the final', category: 'Cursed', icon: '💀' },
  { id: 'penalty_merchant', title: 'Penalty Merchant', description: 'Win only on penalties', category: 'Cursed', icon: '🥅' },
  { id: 'lucky_loser', title: 'Lucky Loser', description: 'Qualify despite losing more than winning', category: 'Cursed', icon: '🍀' },

  // Tragic Achievements
  { id: 'heartbreak_90', title: '90+1 Heartbreak', description: 'Concede a goal after 90 minutes', category: 'Tragic', icon: '💔' },
  { id: 'bottler', title: 'Bottler', description: 'Lose after being 2 goals up', category: 'Tragic', icon: '🍼' },

  // Unhinged Achievements
  { id: 'lover_67', title: '67 Lover', description: 'Score a goal on exact 67th minute', category: 'Unhinged', icon: '🥵' },
  { id: 'lover_69', title: '69 Lover', description: 'Score a goal on exact 69th minute', category: 'Unhinged', icon: '😏' },

  // Glove Story
  { id: 'the_wall', title: 'The Wall', description: 'Keep 3 clean sheets in a row', category: 'Glove Story', icon: '🧱' },
  { id: 'untouchable', title: 'Untouchable', description: 'Concede 0 goals in entire group stage', category: 'Glove Story', icon: '👻' },
  { id: 'spider_man', title: 'Spider-Man', description: 'Make 10+ saves in one match', category: 'Glove Story', icon: '🕸️' },
  { id: 'fort_knox', title: 'Fort Knox', description: 'Opponent gets 0 shots on target', category: 'Glove Story', icon: '🔒' },
];
