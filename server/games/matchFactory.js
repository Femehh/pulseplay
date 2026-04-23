/**
 * Creates a fresh match state object for any game type.
 */
function createMatch(matchId, gameType, p1, p2, roomId) {
  return {
    id: matchId,
    gameType,
    roomId,
    status: 'waiting', // waiting | countdown | playing | ended | abandoned
    players: [
      { ...p1, score: 0, ready: false },
      { ...p2, score: 0, ready: false },
    ],
    round: 0,
    maxRounds: getMaxRounds(gameType),
    startedAt: null,
    endedAt: null,
    rematchRequests: new Set(),
    publicState: {},    // sent to spectators
    privateState: {},   // server-only
  };
}

function getMaxRounds(gameType) {
  const rounds = {
    REACTION_TIME: 5,
    COLOR_MATCH: 10,
    SOUND_RECOGNITION: 5,
    AIM_TRAINER: 1,     // time-based
    MEMORY_TILES: 1,    // race to clear
  };
  return rounds[gameType] || 5;
}

module.exports = { createMatch };
