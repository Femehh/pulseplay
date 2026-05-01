const { v4: uuidv4 } = require('uuid');
const { createMatch } = require('../games/matchFactory');
const { scheduleBotIfNeeded } = require('../bots/botPlayer');

/**
 * Matchmaking socket handler.
 * Manages queues, lobby creation, and match starts.
 */
module.exports = function matchmakingHandler(io, socket, state, prisma) {
  const player = socket.handshake.auth.player;

  // Join matchmaking queue
  socket.on('matchmaking:join', ({ gameType, mode = 'ONE_VS_ONE' }) => {
    if (!state.matchmakingQueues[gameType]) {
      return socket.emit('error', { message: 'Invalid game type' });
    }

    // Check not already in queue
    const alreadyInQueue = state.matchmakingQueues[gameType].some(
      (p) => p.socketId === socket.id
    );
    if (alreadyInQueue) return;

    // Check not already in match
    if (state.playerToMatch.has(socket.id)) {
      return socket.emit('error', { message: 'Already in a match' });
    }

    const queueEntry = {
      socketId: socket.id,
      playerId: player.id,
      username: player.username,
      elo: player.elo,
      joinedAt: Date.now(),
      mode,
    };

    state.matchmakingQueues[gameType].push(queueEntry);
    socket.emit('matchmaking:queued', { gameType, position: state.matchmakingQueues[gameType].length });
    console.log(`[QUEUE] ${player.username} joined ${gameType} queue (${state.matchmakingQueues[gameType].length} in queue)`);

    // Try to find a match
    tryMatchPlayers(io, state, gameType, prisma);

    // Schedule bot fallback if no match found in 15s
    scheduleBotIfNeeded(io, state, gameType, queueEntry, prisma);
  });

  // Leave matchmaking queue
  socket.on('matchmaking:leave', ({ gameType }) => {
    if (state.matchmakingQueues[gameType]) {
      state.matchmakingQueues[gameType] = state.matchmakingQueues[gameType].filter(
        (p) => p.socketId !== socket.id
      );
      socket.emit('matchmaking:left', { gameType });
    }
  });

  // Get queue status
  socket.on('matchmaking:status', ({ gameType }) => {
    const queue = state.matchmakingQueues[gameType] || [];
    socket.emit('matchmaking:status', {
      gameType,
      playersInQueue: queue.length,
      estimatedWait: queue.length === 0 ? 'Searching...' : `~${Math.ceil(queue.length * 5)}s`,
    });
  });
};

function tryMatchPlayers(io, state, gameType, prisma) {
  const queue = state.matchmakingQueues[gameType];
  if (queue.length < 2) return;

  // Sort by join time (FIFO with ELO tolerance)
  queue.sort((a, b) => a.joinedAt - b.joinedAt);

  // Find best match within ELO range (expands over time)
  let p1 = null, p2 = null;
  for (let i = 0; i < queue.length; i++) {
    for (let j = i + 1; j < queue.length; j++) {
      const a = queue[i];
      const b = queue[j];
      const waitTime = (Date.now() - Math.min(a.joinedAt, b.joinedAt)) / 1000;
      const eloRange = 200 + waitTime * 10; // expand 10 ELO per second

      if (Math.abs(a.elo - b.elo) <= eloRange) {
        p1 = a;
        p2 = b;
        break;
      }
    }
    if (p1) break;
  }

  // If waited >30s, just match first two
  if (!p1 && queue.length >= 2) {
    const oldest = queue[0];
    if ((Date.now() - oldest.joinedAt) > 30000) {
      p1 = queue[0];
      p2 = queue[1];
    }
  }

  if (!p1 || !p2) return;

  // Remove from queue
  state.matchmakingQueues[gameType] = queue.filter(
    (p) => p.socketId !== p1.socketId && p.socketId !== p2.socketId
  );

  startMatch(io, state, gameType, p1, p2, prisma);
}

async function startMatch(io, state, gameType, p1, p2, prisma) {
  const matchId = uuidv4();
  const roomId = `match:${matchId}`;

  // Join both players to the room
  const p1Socket = io.sockets.sockets.get(p1.socketId);
  const p2Socket = io.sockets.sockets.get(p2.socketId);

  if (!p1Socket || !p2Socket) {
    // One player disconnected, re-add the other
    if (p1Socket) state.matchmakingQueues[gameType].unshift(p1);
    if (p2Socket) state.matchmakingQueues[gameType].unshift(p2);
    return;
  }

  p1Socket.join(roomId);
  p2Socket.join(roomId);

  state.playerToMatch.set(p1.socketId, matchId);
  state.playerToMatch.set(p2.socketId, matchId);

  // Create match state
  const matchState = createMatch(matchId, gameType, p1, p2, roomId);
  state.activeMatches.set(matchId, matchState);

  // Notify both players
  const matchInfo = {
    matchId,
    gameType,
    players: [
      { id: p1.playerId, username: p1.username, elo: p1.elo },
      { id: p2.playerId, username: p2.username, elo: p2.elo },
    ],
  };

  io.to(roomId).emit('match:found', matchInfo);

  console.log(`[MATCH] ${p1.username} vs ${p2.username} | Game: ${gameType} | ID: ${matchId}`);

  // Save to DB (non-blocking)
  if (prisma && !p1.playerId.startsWith('guest_') && !p2.playerId.startsWith('guest_')) {
    prisma.match.create({
      data: {
        id: matchId,
        gameType,
        status: 'IN_PROGRESS',
        player1Id: p1.playerId,
        player2Id: p2.playerId,
        startedAt: new Date(),
      },
    }).catch(console.error);
  }

  // Start countdown
  startCountdown(io, state, matchId, 3, prisma);
}

function startCountdown(io, state, matchId, seconds, prisma) {
  const match = state.activeMatches.get(matchId);
  if (!match) return;

  match.status = 'countdown';

  let count = seconds;
  const interval = setInterval(() => {
    if (!state.activeMatches.has(matchId)) {
      clearInterval(interval);
      return;
    }

    if (count > 0) {
      io.to(match.roomId).emit('match:countdown', { count, matchId });
      count--;
    } else {
      clearInterval(interval);
      io.to(match.roomId).emit('match:start', { matchId, timestamp: Date.now() });
      match.status = 'playing';
      match.startedAt = Date.now();

      // Start game-specific logic
      const gameModule = require(`../games/${match.gameType.toLowerCase()}`);
      if (gameModule.onStart) {
        gameModule.onStart(io, match, state);
      }
    }
  }, 1000);
}

module.exports.startMatchFromLobby = startMatch;
