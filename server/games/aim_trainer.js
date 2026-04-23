/**
 * GAME: Aim Trainer 1v1
 *
 * Rules:
 * - Shared target grid (server generates targets)
 * - Targets appear on screen; first player to click a target claims it
 * - Server validates clicks (coordinates must be within target bounds)
 * - Score = number of targets hit in 30 seconds
 * - Faster hit time = tiebreaker
 */

const { endMatch } = require('../sockets/gameHandler');

const GAME_DURATION = 30000; // 30 seconds
const TARGET_SPAWN_INTERVAL = 800; // ms between new targets
const TARGET_RADIUS = 35; // px — matches client hitbox
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const MAX_TARGETS = 5; // max concurrent targets

function generateTarget() {
  const margin = TARGET_RADIUS + 10;
  return {
    id: Math.random().toString(36).slice(2, 10),
    x: margin + Math.random() * (CANVAS_WIDTH - margin * 2),
    y: margin + Math.random() * (CANVAS_HEIGHT - margin * 2),
    radius: TARGET_RADIUS,
    spawnedAt: Date.now(),
    lifespan: 2500, // disappears after 2.5s
  };
}

function onStart(io, match, state) {
  match.privateState = {
    targets: [],
    hitLog: [],
    gameTimer: null,
    spawnTimer: null,
    endTime: Date.now() + GAME_DURATION,
  };

  io.to(match.roomId).emit('game:state', {
    type: 'aim_trainer',
    duration: GAME_DURATION,
    canvasSize: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
    targetRadius: TARGET_RADIUS,
    scores: match.players.map((p) => ({ username: p.username, score: p.score })),
  });

  const priv = match.privateState;

  // Start spawning targets
  priv.spawnTimer = setInterval(() => {
    if (!state.activeMatches.has(match.id) || match.status !== 'playing') {
      clearInterval(priv.spawnTimer);
      return;
    }

    // Remove expired targets
    const now = Date.now();
    priv.targets = priv.targets.filter((t) => now - t.spawnedAt < t.lifespan);

    if (priv.targets.length < MAX_TARGETS) {
      const target = generateTarget();
      priv.targets.push(target);
      io.to(match.roomId).emit('game:target_spawn', { target });

      // Auto-expire
      setTimeout(() => {
        priv.targets = priv.targets.filter((t) => t.id !== target.id);
        io.to(match.roomId).emit('game:target_expire', { targetId: target.id });
      }, target.lifespan);
    }
  }, TARGET_SPAWN_INTERVAL);

  // End game timer
  priv.gameTimer = setTimeout(() => {
    endAimGame(io, match, state);
  }, GAME_DURATION);
}

function onAction(io, socket, match, state, data, playerIndex, prisma) {
  if (data.type !== 'hit') return;

  const { targetId, x, y } = data;
  const priv = match.privateState;

  // Find target
  const targetIdx = priv.targets.findIndex((t) => t.id === targetId);
  if (targetIdx === -1) return; // Already hit or expired

  const target = priv.targets[targetIdx];

  // Server-side hit validation (distance check)
  const dist = Math.hypot(x - target.x, y - target.y);
  if (dist > target.radius * 1.3) {
    // Generous 30% hitbox tolerance for latency compensation
    return;
  }

  // Valid hit!
  priv.targets.splice(targetIdx, 1);
  const player = match.players[playerIndex];
  player.score++;

  priv.hitLog.push({ playerId: player.playerId, targetId, time: Date.now() });

  io.to(match.roomId).emit('game:hit', {
    targetId,
    hitter: { username: player.username, socketId: socket.id },
    scores: match.players.map((p) => ({ username: p.username, score: p.score })),
  });
}

function endAimGame(io, match, state, prisma) {
  const priv = match.privateState;
  clearInterval(priv.spawnTimer);
  clearTimeout(priv.gameTimer);

  const winner = match.players[0].score > match.players[1].score
    ? match.players[0]
    : match.players[0].score < match.players[1].score
      ? match.players[1]
      : null;

  endMatch(io, state, match, winner?.socketId || null, prisma);
}

module.exports = { onStart, onAction };
