/**
 * GAME: Reaction Time Test
 *
 * Rules:
 * - Screen shows a color/signal after a random delay (1.5–5s)
 * - First player to send 'game:action' with { type: 'click' } wins the round
 * - Early clicks = penalty (0.5s added to reaction time)
 * - Best of 5 rounds
 */

const { endMatch } = require('../sockets/gameHandler');

const COLORS = [
  // Reds / oranges
  '#ef4444', '#f97316', '#dc2626', '#ea580c', '#fb923c', '#c2410c',
  // Yellows / limes
  '#f59e0b', '#eab308', '#84cc16', '#a3e635', '#ca8a04', '#65a30d',
  // Greens
  '#22c55e', '#10b981', '#059669', '#16a34a', '#34d399', '#4ade80',
  // Cyans / teals
  '#06b6d4', '#0ea5e9', '#22d3ee', '#0891b2', '#67e8f9', '#0284c7',
  // Blues
  '#3b82f6', '#2563eb', '#1d4ed8', '#60a5fa', '#3730a3', '#6366f1',
  // Purples / violets
  '#8b5cf6', '#7c3aed', '#a855f7', '#9333ea', '#c084fc', '#7e22ce',
  // Pinks / roses
  '#ec4899', '#db2777', '#f43f5e', '#e11d48', '#f472b6', '#be185d',
  // Extras
  '#14b8a6', '#f0abfc', '#fbbf24', '#4f46e5', '#0f766e', '#b45309',
];

let colorPool = [];
let lastColor = '';

function pickColor() {
  if (colorPool.length === 0) {
    colorPool = [...COLORS].sort(() => Math.random() - 0.5);
  }
  let color = colorPool.pop();
  if (color === lastColor && colorPool.length > 0) {
    colorPool.unshift(color);
    color = colorPool.pop();
  }
  lastColor = color;
  return color;
}

function onStart(io, match, state) {
  match.privateState = {
    signalActive: false,
    signalStartTime: null,
    roundWinner: null,
    penalties: { [match.players[0].socketId]: 0, [match.players[1].socketId]: 0 },
  };

  io.to(match.roomId).emit('game:state', {
    type: 'reaction_time',
    round: 0,
    maxRounds: match.maxRounds,
    scores: match.players.map((p) => ({ username: p.username, score: p.score })),
  });

  setTimeout(() => startRound(io, match, state), 1500);
}

function startRound(io, match, state) {
  if (!state.activeMatches.has(match.id) || match.status !== 'playing') return;

  match.round++;
  match.privateState.signalActive = false;
  match.privateState.roundWinner = null;

  const color = pickColor();
  const delay = 1500 + Math.random() * 3500; // 1.5–5s random delay

  io.to(match.roomId).emit('game:round_start', {
    round: match.round,
    maxRounds: match.maxRounds,
    phase: 'waiting', // don't click yet
  });

  // Signal timeout — fire the GO signal
  match.privateState.signalTimer = setTimeout(() => {
    if (!state.activeMatches.has(match.id) || match.status !== 'playing') return;

    match.privateState.signalActive = true;
    match.privateState.signalStartTime = Date.now();
    match.privateState.roundWinner = null;

    io.to(match.roomId).emit('game:signal', {
      round: match.round,
      color,
      timestamp: match.privateState.signalStartTime,
    });

    // Auto-end round after 3s if nobody clicks
    match.privateState.roundTimeout = setTimeout(() => {
      if (match.privateState.roundWinner === null) {
        io.to(match.roomId).emit('game:round_end', {
          round: match.round,
          winner: null,
          reactionTime: null,
          message: 'No one clicked!',
          scores: match.players.map((p) => ({ username: p.username, score: p.score })),
        });
        proceedToNextRound(io, match, state);
      }
    }, 3000);
  }, delay);
}

function onAction(io, socket, match, state, data, playerIndex, prisma) {
  if (data.type !== 'click') return;

  const now = Date.now();
  const priv = match.privateState;
  const player = match.players[playerIndex];

  // Early click penalty
  if (!priv.signalActive) {
    player.score = Math.max(0, player.score - 1);
    socket.emit('game:penalty', {
      message: 'Too early! -1 point',
      scores: match.players.map((p) => ({ username: p.username, score: p.score })),
    });
    return;
  }

  // Already someone won this round
  if (priv.roundWinner !== null) return;

  clearTimeout(priv.roundTimeout);
  priv.roundWinner = socket.id;
  priv.signalActive = false;

  const reactionTime = now - priv.signalStartTime;
  player.score++;

  io.to(match.roomId).emit('game:round_end', {
    round: match.round,
    winner: { username: player.username, socketId: socket.id },
    reactionTime,
    scores: match.players.map((p) => ({ username: p.username, score: p.score })),
  });

  proceedToNextRound(io, match, state, prisma);
}

function proceedToNextRound(io, match, state, prisma) {
  if (match.round >= match.maxRounds) {
    // Determine overall winner
    const winner = match.players.reduce((a, b) => (a.score >= b.score ? a : b));
    const tied = match.players[0].score === match.players[1].score;

    endMatch(io, state, match, tied ? null : winner.socketId, prisma);
    return;
  }

  setTimeout(() => {
    if (state.activeMatches.has(match.id) && match.status === 'playing') {
      startRound(io, match, state);
    }
  }, 2500);
}

module.exports = { onStart, onAction };
