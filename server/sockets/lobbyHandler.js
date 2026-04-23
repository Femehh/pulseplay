const { v4: uuidv4 } = require('uuid');

/**
 * Private lobby system handler.
 */
module.exports = function lobbyHandler(io, socket, state, prisma) {
  const player = socket.handshake.auth.player;

  // Create a private lobby
  socket.on('lobby:create', ({ gameType }) => {
    const lobbyId = uuidv4();
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const lobby = {
      id: lobbyId,
      code,
      gameType,
      hostId: socket.id,
      players: [{ socketId: socket.id, playerId: player.id, username: player.username, elo: player.elo, ready: false }],
      status: 'waiting',
      createdAt: Date.now(),
    };

    state.lobbies.set(lobbyId, lobby);
    socket.join(`lobby:${lobbyId}`);

    socket.emit('lobby:created', { lobbyId, code, gameType, lobby });
    console.log(`[LOBBY] ${player.username} created lobby ${code} for ${gameType}`);
  });

  // Join lobby by code
  socket.on('lobby:join', ({ code }) => {
    const lobby = [...state.lobbies.values()].find((l) => l.code === code);

    if (!lobby) {
      return socket.emit('error', { message: 'Lobby not found' });
    }
    if (lobby.status !== 'waiting') {
      return socket.emit('error', { message: 'Lobby already started' });
    }
    if (lobby.players.length >= 2) {
      return socket.emit('error', { message: 'Lobby is full' });
    }
    if (lobby.players.some((p) => p.socketId === socket.id)) {
      return socket.emit('error', { message: 'Already in this lobby' });
    }

    lobby.players.push({
      socketId: socket.id,
      playerId: player.id,
      username: player.username,
      elo: player.elo,
      ready: false,
    });

    socket.join(`lobby:${lobby.id}`);
    io.to(`lobby:${lobby.id}`).emit('lobby:updated', { lobby });
    console.log(`[LOBBY] ${player.username} joined lobby ${code}`);
  });

  // Player ready toggle
  socket.on('lobby:ready', ({ lobbyId }) => {
    const lobby = state.lobbies.get(lobbyId);
    if (!lobby) return;

    const p = lobby.players.find((p) => p.socketId === socket.id);
    if (p) {
      p.ready = !p.ready;
      io.to(`lobby:${lobbyId}`).emit('lobby:updated', { lobby });

      // Auto-start if all ready and full
      if (lobby.players.length === 2 && lobby.players.every((p) => p.ready)) {
        lobby.status = 'starting';
        io.to(`lobby:${lobbyId}`).emit('lobby:starting', { lobby });

        setTimeout(() => {
          const [p1, p2] = lobby.players;
          require('./matchmaking').startMatchFromLobby?.(io, state, lobby.gameType, p1, p2, prisma, lobby.id);
        }, 1000);
      }
    }
  });

  // Leave lobby
  socket.on('lobby:leave', ({ lobbyId }) => {
    const lobby = state.lobbies.get(lobbyId);
    if (!lobby) return;

    lobby.players = lobby.players.filter((p) => p.socketId !== socket.id);
    socket.leave(`lobby:${lobbyId}`);

    if (lobby.players.length === 0) {
      state.lobbies.delete(lobbyId);
    } else {
      // Reassign host
      if (lobby.hostId === socket.id) {
        lobby.hostId = lobby.players[0].socketId;
      }
      io.to(`lobby:${lobbyId}`).emit('lobby:updated', { lobby });
    }
  });

  // Get lobby info
  socket.on('lobby:info', ({ code }) => {
    const lobby = [...state.lobbies.values()].find((l) => l.code === code);
    if (lobby) {
      socket.emit('lobby:info', { lobby });
    } else {
      socket.emit('error', { message: 'Lobby not found' });
    }
  });
};
