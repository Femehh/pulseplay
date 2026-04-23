/**
 * ELO rating system for PulsePlay.
 * K-factor adjusts based on current rating and matches played.
 * Includes streak bonus for consecutive wins.
 */

const BASE_K = 32;

function getKFactor(elo, matchesPlayed = 0) {
  if (matchesPlayed < 30) return 40; // provisional
  if (elo >= 2000) return 16;        // elite
  if (elo >= 1600) return 24;        // advanced
  return BASE_K;                      // standard
}

/**
 * Calculate ELO change after a match.
 * Streak bonus: +2 ELO per consecutive win (max +10).
 */
function calculateEloChange(winnerElo, loserElo, winnerMatches = 0, loserMatches = 0, winnerStreak = 0) {
  const expectedWin = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLose = 1 - expectedWin;

  const kWinner = getKFactor(winnerElo, winnerMatches);
  const kLoser = getKFactor(loserElo, loserMatches);

  const streakBonus = Math.min(winnerStreak * 2, 10); // +2 per win streak, max +10

  const winnerChange = Math.round(kWinner * (1 - expectedWin)) + streakBonus;
  const loserChange = Math.round(kLoser * (0 - expectedLose));

  return { winnerChange, loserChange, streakBonus };
}

/**
 * Get rank tier from ELO.
 */
function getRankTier(elo) {
  if (elo >= 2200) return { name: 'Grandmaster', color: '#ff6b6b', icon: '🔴' };
  if (elo >= 2000) return { name: 'Master', color: '#ff9f43', icon: '🟠' };
  if (elo >= 1800) return { name: 'Diamond', color: '#00cec9', icon: '💎' };
  if (elo >= 1600) return { name: 'Platinum', color: '#6c5ce7', icon: '🔷' };
  if (elo >= 1400) return { name: 'Gold', color: '#f9ca24', icon: '🥇' };
  if (elo >= 1200) return { name: 'Silver', color: '#dfe6e9', icon: '🥈' };
  return { name: 'Bronze', color: '#cd7f32', icon: '🥉' };
}

/**
 * Get rank tier name from ELO for rank-up/down detection.
 */
function getRankName(elo) {
  return getRankTier(elo).name;
}

module.exports = { calculateEloChange, getRankTier, getRankName };
