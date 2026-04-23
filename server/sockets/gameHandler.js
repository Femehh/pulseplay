const { calculateEloChange } = require('../utils/elo');

/**
 * Handles all in-game socket events.
 * All game inputs are validated server-side.
 */
module.exports = function gameHandler(io, socket, state, prisma) {
  const player = socket.handshake.auth.player;

  // Keep-alive ping (client sends every 20s)
  socket.on('ping', () => socket.emit('pong'));

  // Heartbeat from game components when tab is hidden
  socket.on('player:heartbeat', () => {});

  // Rejoin active match room after reconnect
  socket.on('match:rejoin', ({ matchId }) => {
    const match = state.activeMatches.get(matchId);
    if (!match) return;
    const isParticipant = match.players.some((p) => p.playerId === player.id);
    if (!isParticipant) return;

    // Update socketId for this player
    const p = match.players.find((p) => p.playerId === player.id);
    if (p) {
      state.playerToMatch.delete(p.socketId);
      p.socketId = socket.id;
      state.playerToMatch.set(socket.id, matchId);
    }

    socket.join(match.roomId);

    // Notify opponent they're back
    const opponentSocketId = match.players.find((p) => p.socketId !== socket.id)?.socketId;
    if (opponentSocketId) {
      io.to(opponentSocketId).emit('opponent:reconnected', { username: player.username });
    }

    // Resend current game state
    try {
      const gameModule = require(`../games/${match.gameType.toLowerCase()}`);
      if (gameModule.onRejoin) {
        gameModule.onRejoin(io, socket, match, state);
      } else if (match.privateState?.board) {
        // Generic: resend board state for board games
        socket.emit('game:state', {
          type: match.gameType.toLowerCase(),
          board: match.privateState.board.map ? match.privateState.board.map(r => [...r]) : match.privateState.board,
          isRedTurn: match.privateState.isRedTurn,
          redPlayer: match.players[0].username,
          blackPlayer: match.players[1].username,
          scores: match.players.map((p) => ({ username: p.username, score: p.score })),
        });
      }
    } catch (err) {
      console.error('[REJOIN] Error resending state:', err);
    }
  });

  // Generic game action handler — routes to game module
  socket.on('game:action', (data) => {
    const matchId = state.playerToMatch.get(socket.id);
    if (!matchId) return;

    const match = state.activeMatches.get(matchId);
    if (!match || match.status !== 'playing') return;

    const isParticipant = match.players.some((p) => p.socketId === socket.id);
    if (!isParticipant) return;

    const playerIndex = match.players.findIndex((p) => p.socketId === socket.id);

    // Handle resign
    if (data.type === 'resign') {
      const winner = match.players.find((p) => p.socketId !== socket.id);
      endMatch(io, state, match, winner?.socketId || null, prisma);
      return;
    }

    // Handle draw offer (for checkers and any board game)
    if (data.type === 'draw_offer') {
      const opponent = match.players.find((p) => p.socketId !== socket.id);
      if (opponent) io.to(opponent.socketId).emit('game:draw_offer', { from: player.username });
      return;
    }

    // Handle draw response
    if (data.type === 'draw_response') {
      if (data.accept) {
        endMatch(io, state, match, null, prisma); // null = draw
      } else {
        const opponent = match.players.find((p) => p.socketId !== socket.id);
        if (opponent) io.to(opponent.socketId).emit('game:draw_declined', { from: player.username });
      }
      return;
    }

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

    const opponentSocketId = match.players.find((p) => p.socketId !== socket.id)?.socketId;
    if (opponentSocketId) {
      io.to(opponentSocketId).emit('game:rematch_requested', { from: player.username });
    }

    if (match.rematchRequests.size === 2) {
      const [p1, p2] = match.players;
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

  const winner = winnerId
    ? match.players.find((p) => p.playerId === winnerId || p.socketId === winnerId)
    : null;
  const loser = winner
    ? match.players.find((p) => p.playerId !== winner.playerId && p.socketId !== winner.socketId)
    : null;

  const result = {
    matchId: match.id,
    winner: winner ? { username: winner.username, id: winner.playerId } : null,
    scores: match.players.map((p) => ({ username: p.username, score: p.score })),
    eloChanges: {},
  };

  if (winner && loser && !winner.playerId?.startsWith('guest_') && !loser.playerId?.startsWith('guest_')) {
    const { winnerChange, loserChange } = calculateEloChange(winner.elo, loser.elo);
    result.eloChanges[winner.username] = winnerChange;
    result.eloChanges[loser.username] = loserChange;

    if (prisma) {
      try {
        await Promise.all([
          prisma.userStats.update({
            where: { userId: winner.playerId },
            data: { wins: { increment: 1 }, totalMatches: { increment: 1 }, elo: { increment: winnerChange } },
          }),
          prisma.userStats.update({
            where: { userId: loser.playerId },
            data: { losses: { increment: 1 }, totalMatches: { increment: 1 }, elo: { increment: loserChange } },
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

  setTimeout(() => {
    state.activeMatches.delete(match.id);
    match.players.forEach((p) => state.playerToMatch.delete(p.socketId));
  }, 30000);
}

module.exports.endMatch = endMatch;
