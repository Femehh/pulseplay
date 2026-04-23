const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const authMiddleware = require('./middleware/auth');
const matchmakingHandler = require('./sockets/matchmaking');
const gameHandler = require('./sockets/gameHandler');
const lobbyHandler = require('./sockets/lobbyHandler');

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 20000,
  pingInterval: 10000,
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());

// REST API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/matches', require('./routes/matches'));

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

// Socket auth middleware
io.use(authMiddleware);

// In-memory state (replace with Redis in production)
const state = {
  matchmakingQueues: {
    REACTION_TIME: [],
    COLOR_MATCH: [],
    SOUND_RECOGNITION: [],
    AIM_TRAINER: [],
    MEMORY_TILES: [],
    CHECKERS: [],
  },
  activeMatches: new Map(),     // matchId -> match state
  playerToMatch: new Map(),     // socketId -> matchId
  lobbies: new Map(),           // lobbyId -> lobby state
  connectedPlayers: new Map(),  // socketId -> player info
};

io.on('connection', (socket) => {
  const player = socket.handshake.auth.player;
  state.connectedPlayers.set(socket.id, {
    ...player,
    socketId: socket.id,
    connectedAt: Date.now(),
  });

  console.log(`[CONNECT] ${player.username} (${socket.id})`);

  // Register handlers
  matchmakingHandler(io, socket, state, prisma);
  gameHandler(io, socket, state, prisma);
  lobbyHandler(io, socket, state, prisma);

  socket.on('disconnect', (reason) => {
    console.log(`[DISCONNECT] ${player.username} - ${reason}`);

    // Handle disconnect mid-match — give 30s grace period for reconnect
    const matchId = state.playerToMatch.get(socket.id);
    if (matchId) {
      const match = state.activeMatches.get(matchId);
      if (match && match.status === 'playing') {
        const opponentSocketId = match.players.find((p) => p.socketId !== socket.id)?.socketId;
        if (opponentSocketId) {
          io.to(opponentSocketId).emit('opponent:disconnected', { reason: 'disconnect', username: player.username });
        }

        // Grace period: wait 30s before forfeiting
        match._disconnectTimer = setTimeout(() => {
          const stillActive = state.activeMatches.get(matchId);
          if (!stillActive || stillActive.status !== 'playing') return;
          // Player didn't reconnect — opponent wins
          const { endMatch } = require('./sockets/gameHandler');
          const winner = match.players.find((p) => p.socketId !== socket.id);
          endMatch(io, state, match, winner?.socketId || null, prisma);
        }, 30000);
      }
    }

    // Remove from matchmaking queues immediately
    for (const gameType of Object.keys(state.matchmakingQueues)) {
      state.matchmakingQueues[gameType] = state.matchmakingQueues[gameType].filter(
        (p) => p.socketId !== socket.id
      );
    }

    state.connectedPlayers.delete(socket.id);
    // Don't delete playerToMatch — needed for rejoin
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[SERVER] PulsePlay server running on port ${PORT}`);
  console.log(`[SERVER] Socket.io ready`);
});

module.exports = { io, state, prisma };
