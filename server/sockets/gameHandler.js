const { calculateEloChange, getRankName } = require('../utils/elo');

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

    const p = match.players.find((p) => p.playerId === player.id);
    if (p) {
      // Cancel any pending forfeit timer
      if (match._disconnectTimer) {
        clearTimeout(match._disconnectTimer);
        match._disconnectTimer = null;
      }
      state.playerToMatch.delete(p.socketId);
      p.socketId = socket.id;
      state.playerToMatch.set(socket.id, matchId);
    }

    socket.join(match.roomId);

    const opponentSocketId = match.players.find((p) => p.socketId !== socket.id)?.socketId;
    if (opponentSocketId) {
      io.to(opponentSocketId).emit('opponent:reconnected', { username: player.username });
    }

    try {
      const gameModule = require(`../games/${match.gameType.toLowerCase()}`);
      if (gameModule.onRejoin) {
        gameModule.onRejoin(io, socket, match, state);
      } else if (match.privateState?.board) {
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

    // Handle draw offer
    if (data.type === 'draw_offer') {
      const opponent = match.players.find((p) => p.socketId !== socket.id);
      if (opponent) io.to(opponent.socketId).emit('game:draw_offer', { from: player.username });
      return;
    }

    // Handle draw response
    if (data.type === 'draw_response') {
      if (data.accept) {
        endMatch(io, state, match, null, prisma);
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
 * End a match, update ELO + streaks + per-game rankings + peak ELO.
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
    streakBonus: 0,
    rankChanges: {},
  };

  const isGuest = (p) => !p || p.playerId?.startsWith('guest_');

  if (winner && loser && !isGuest(winner) && !isGuest(loser)) {
    // Fetch current stats including streaks
    let winnerStats, loserStats;
    try {
      [winnerStats, loserStats] = await Promise.all([
        prisma.userStats.findUnique({ where: { userId: winner.playerId } }),
        prisma.userStats.findUnique({ where: { userId: loser.playerId } }),
      ]);
    } catch { winnerStats = null; loserStats = null; }

    const winnerStreak = (winnerStats?.currentWinStreak || 0);
    const { winnerChange, loserChange, streakBonus } = calculateEloChange(
      winner.elo, loser.elo,
      winnerStats?.totalMatches || 0,
      loserStats?.totalMatches || 0,
      winnerStreak
    );

    result.eloChanges[winner.username] = winnerChange;
    result.eloChanges[loser.username] = loserChange;
    result.streakBonus = streakBonus;

    // Detect rank changes
    const winnerNewElo = (winnerStats?.elo || winner.elo) + winnerChange;
    const loserNewElo = (loserStats?.elo || loser.elo) + loserChange;
    const winnerOldRank = getRankName(winnerStats?.elo || winner.elo);
    const loserOldRank = getRankName(loserStats?.elo || loser.elo);
    const winnerNewRank = getRankName(winnerNewElo);
    const loserNewRank = getRankName(Math.max(0, loserNewElo));

    if (winnerOldRank !== winnerNewRank) result.rankChanges[winner.username] = { from: winnerOldRank, to: winnerNewRank };
    if (loserOldRank !== loserNewRank) result.rankChanges[loser.username] = { from: loserOldRank, to: loserNewRank };

    const gameType = match.gameType;

    if (prisma) {
      try {
        await Promise.all([
          // Winner stats
          prisma.userStats.update({
            where: { userId: winner.playerId },
            data: {
              wins: { increment: 1 },
              totalMatches: { increment: 1 },
              elo: { increment: winnerChange },
              peakElo: { set: Math.max(winnerNewElo, winnerStats?.peakElo || 0) },
              currentWinStreak: { increment: 1 },
              bestWinStreak: {
                set: Math.max((winnerStreak + 1), winnerStats?.bestWinStreak || 0),
              },
              ...(gameType === 'REACTION_TIME' && { reactionWins: { increment: 1 } }),
              ...(gameType === 'COLOR_MATCH' && { colorMatchWins: { increment: 1 } }),
              ...(gameType === 'SOUND_RECOGNITION' && { soundRecogWins: { increment: 1 } }),
              ...(gameType === 'AIM_TRAINER' && { aimTrainerWins: { increment: 1 } }),
              ...(gameType === 'MEMORY_TILES' && { memoryTilesWins: { increment: 1 } }),
              ...(gameType === 'CHECKERS' && { checkersWins: { increment: 1 } }),
            },
          }),
          // Loser stats
          prisma.userStats.update({
            where: { userId: loser.playerId },
            data: {
              losses: { increment: 1 },
              totalMatches: { increment: 1 },
              elo: { increment: loserChange },
              currentWinStreak: { set: 0 },
            },
          }),
          // Match record
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
          // Per-game ranking upsert for winner
          prisma.ranking.upsert({
            where: { userId_gameType: { userId: winner.playerId, gameType } },
            update: { elo: { increment: winnerChange } },
            create: { userId: winner.playerId, gameType, elo: 1000 + winnerChange },
          }),
          // Per-game ranking upsert for loser
          prisma.ranking.upsert({
            where: { userId_gameType: { userId: loser.playerId, gameType } },
            update: { elo: { increment: loserChange } },
            create: { userId: loser.playerId, gameType, elo: Math.max(600, 1000 + loserChange) },
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
