export interface RankTier {
  name: string;
  color: string;
  bgColor: string;
  icon: string;
  minElo: number;
}

export const RANK_TIERS: RankTier[] = [
  { name: 'Bronze', color: '#cd7f32', bgColor: 'rgba(205,127,50,0.15)', icon: '🥉', minElo: 0 },
  { name: 'Silver', color: '#c0c0c0', bgColor: 'rgba(192,192,192,0.15)', icon: '🥈', minElo: 1200 },
  { name: 'Gold', color: '#f9ca24', bgColor: 'rgba(249,202,36,0.15)', icon: '🥇', minElo: 1400 },
  { name: 'Platinum', color: '#6c5ce7', bgColor: 'rgba(108,92,231,0.15)', icon: '🔷', minElo: 1600 },
  { name: 'Diamond', color: '#00cec9', bgColor: 'rgba(0,206,201,0.15)', icon: '💎', minElo: 1800 },
  { name: 'Master', color: '#fd79a8', bgColor: 'rgba(253,121,168,0.15)', icon: '🌟', minElo: 2000 },
  { name: 'Grandmaster', color: '#ff6b6b', bgColor: 'rgba(255,107,107,0.15)', icon: '👑', minElo: 2200 },
];

export function getRankTier(elo: number): RankTier {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (elo >= RANK_TIERS[i].minElo) return RANK_TIERS[i];
  }
  return RANK_TIERS[0];
}

export function getRankBadge(elo: number): string {
  return getRankTier(elo).icon;
}

export const GAME_CONFIG = {
  REACTION_TIME: {
    name: 'Reaction Time',
    description: 'React faster than your opponent to the signal',
    icon: '⚡',
    color: '#f59e0b',
    gradient: 'from-yellow-500 to-orange-500',
  },
  COLOR_MATCH: {
    name: 'Color Match',
    description: 'Identify the ink color — not the word!',
    icon: '🎨',
    color: '#8b5cf6',
    gradient: 'from-purple-500 to-pink-500',
  },
  SOUND_RECOGNITION: {
    name: 'Sound Recognition',
    description: 'Identify the sound before your opponent',
    icon: '🔊',
    color: '#06b6d4',
    gradient: 'from-cyan-500 to-blue-500',
  },
  AIM_TRAINER: {
    name: 'Aim Trainer',
    description: 'Hit more targets than your opponent in 30s',
    icon: '🎯',
    color: '#ef4444',
    gradient: 'from-red-500 to-orange-500',
  },
  MEMORY_TILES: {
    name: 'Memory Tiles',
    description: 'Find matching pairs before your opponent',
    icon: '🃏',
    color: '#22c55e',
    gradient: 'from-green-500 to-teal-500',
  },
  CHECKERS: {
    name: 'Checkers',
    description: 'Classic checkers — capture all your opponent\'s pieces to win',
    icon: '♟',
    color: '#f97316',
    gradient: 'from-orange-500 to-amber-500',
  },
} as const;
