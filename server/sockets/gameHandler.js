const { calculateEloChange } = require('../utils/elo');

/**
 * Handles all in-game socket events.
 * All game inputs are validated server-side.
 */
module.exports = function gameHandler(io, socket, state, prisma) {
  const player = socket.handshake.auth.player;

  // Generic game action handler — routes to game module
  socket.on('game:action', (data) => {
    const matchId = state.playerToMatch.get(socket.id);
    if (!matchId) return;

    const match = state.activeMatches.get(matchId);
    if (!match || match.status !== 'playing') return;

    // Verify sender is a participant
    const isParticipant = match.players.some((p) => p.socketId === socket.id);
    if (!isParticipant) return;

    const playerIndex = match.players.findIndex((p) => p.socketId === socket.id);

    try {
      const gameModule = require(`../games/${match.gameType.toLowerCase()}`);
      if (gameModule.onAction) {
        gameModule.onAction(io, socket, match, state, data, playerIndex, prisma);
      }
    } catch (err) {
      console.error(`[GAME] Error in ${match.gameType} action:`, err);
    }
  });

  // Rematch request
  socket.on('game:rematch', ({ matchId }) => {
    const match = state.activeMatches.get(matchId);
    if (!match) return;

    if (!match.rematchRequests) match.rematchRequests = new Set();
    match.rematchRequests.add(socket.id);

    // Notify opponent
    const opponentSocketId = match.players.find((p) => p.socketId !== socket.id)?.socketId;
    if (opponentSocketId) {
      io.to(opponentSocketId).emit('game:rematch_requested', { from: player.username });
    }

    // Both accepted
    if (match.rematchRequests.size === 2) {
      const [p1, p2] = match.players;
      // Reset and restart match
      const { createMatch } = require('../games/matchFactory');
      const newMatch = createMatch(matchId, match.gameType, p1, p2, match.roomId);
      state.activeMatches.set(matchId, newMatch);

      io.to(match.roomId).emit('match:rematch_start', { matchId });

      setTimeout(() => {
        io.to(match.roomId).emit('match:start', { matchId, timestamp: Date.now() });
        newMatch.status = 'playing';
        newMatch.startedAt = Date.now();

        const gameModule = require(`../games/${newMatch.gameType.toLowerCase()}`);
        if (gameModule.onStart) gameModule.onStart(io, newMatch, state);
      }, 3000);
    }
  });

  // Spectate match
  socket.on('game:spectate', ({ matchId }) => {
    const match = state.activeMatches.get(matchId);
    if (!match) return socket.emit('error', { message: 'Match not found' });

    socket.join(match.roomId);
    socket.emit('game:spectating', {
      matchId,
      gameType: match.gameType,
      players: match.players.map((p) => ({ username: p.username, score: p.score })),
      state: match.publicState,
    });
  });
};

/**
 * End a match and update ELO. Called by game modules.
 */
async function endMatch(io, state, match, winnerId, prisma) {
  if (match.status === 'ended') return;
  match.status = 'ended';
  match.endedAt = Date.now();

  const winner = match.players.find((p) => p.playerId === winnerId || p.socketId === winnerId);
  const loser = match.players.find((p) => p.playerId !== (winner?.playerId) && p.socketId !== (winner?.socketId));

  const result = {
    matchId: match.id,
    winner: winner ? { username: winner.username, id: winner.playerId } : null,
    scores: match.players.map((p) => ({ username: p.username, score: p.score })),
    eloChanges: {},
  };

  // Calculate ELO changes
  if (winner && loser && !winner.playerId?.startsWith('guest_') && !loser.playerId?.startsWith('guest_')) {
    const { winnerChange, loserChange } = calculateEloChange(winner.elo, loser.elo);
    result.eloChanges[winner.playerId] = winnerChange;
    result.eloChanges[loser.playerId] = loserChange;

    // Update DB
    if (prisma) {
      try {
        await Promise.all([
          prisma.userStats.update({
            where: { userId: winner.playerId },
            data: {
              wins: { increment: 1 },
              totalMatches: { increment: 1 },
              elo: { increment: winnerChange },
            },
          }),
          prisma.userStats.update({
            where: { userId: loser.playerId },
            data: {
              losses: { increment: 1 },
              totalMatches: { increment: 1 },
              elo: { increment: loserChange },
            },
          }),
          prisma.match.update({
            where: { id: match.id },
            data: {
              status: 'COMPLETED',
              winnerId: winner.playerId,
              player1Score: match.players[0].score,
              player2Score: match.players[1].score,
              player1EloChange: match.players[0].playerId === winner.playerId ? winnerChange : loserChange,
              player2EloChange: match.players[1].playerId === winner.playerId ? winnerChange : loserChange,
              endedAt: new Date(),
              duration: Math.floor((match.endedAt - match.startedAt) / 1000),
            },
          }),
        ]);
      } catch (err) {
        console.error('[DB] Error updating match result:', err);
      }
    }
  }

  io.to(match.roomId).emit('match:ended', result);

  // Cleanup after delay
  setTimeout(() => {
    state.activeMatches.delete(match.id);
    match.players.forEach((p) => state.playerToMatch.delete(p.socketId));
  }, 30000);
}

module.exports.endMatch = endMatch;
