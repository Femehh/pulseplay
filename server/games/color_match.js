/**
 * GAME: Color Memory
 *
 * Rules:
 * - A random color is shown to both players for SHOW_DURATION ms
 * - It disappears; players must recreate it using an HSL picker
 * - Score per round = 100 - colorDistance (0 = perfect, 100 = worst)
 * - 5 rounds, highest total score wins
 */

const { endMatch } = require('../sockets/gameHandler');

const SHOW_DURATION = 3000;  // ms color is visible
const GUESS_DURATION = 15000; // ms to submit guess

function randomColor() {
  return {
    h: Math.floor(Math.random() * 360),
    s: 30 + Math.floor(Math.random() * 60),  // 30-90%
    l: 30 + Math.floor(Math.random() * 40),  // 30-70%
  };
}

/**
 * Perceptual color distance in HSL space (0-100 scale).
 * Hue is circular so we handle wrap-around.
 */
function colorScore(target, guess) {
  const hueDiff = Math.min(Math.abs(target.h - guess.h), 360 - Math.abs(target.h - guess.h));
  const satDiff = Math.abs(target.s - guess.s);
  const lightDiff = Math.abs(target.l - guess.l);

  // Weighted: hue matters most
  const distance = (hueDiff / 180) * 60 + (satDiff / 100) * 20 + (lightDiff / 100) * 20;
  return Math.max(0, Math.round(100 - distance));
}

function onStart(io, match, state) {
  match.privateState = {
    currentColor: null,
    roundGuesses: {},
    phase: 'idle',
  };

  io.to(match.roomId).emit('game:state', {
    type: 'color_memory',
    round: 0,
    maxRounds: match.maxRounds,
    showDuration: SHOW_DURATION,
    guessDuration: GUESS_DURATION,
    scores: match.players.map((p) => ({ username: p.username, score: 0 })),
  });

  setTimeout(() => startRound(io, match, state), 1500);
}

function startRound(io, match, state) {
  if (!state.activeMatches.has(match.id) || match.status !== 'playing') return;

  match.round++;
  const color = randomColor();
  match.privateState.currentColor = color;
  match.privateState.roundGuesses = {};
  match.privateState.phase = 'showing';

  // Send the color to show
  io.to(match.roomId).emit('game:color_show', {
    round: match.round,
    maxRounds: match.maxRounds,
    color,                   // h, s, l
    showDuration: SHOW_DURATION,
  });

  // After show duration, hide and open guessing
  setTimeout(() => {
    if (!state.activeMatches.has(match.id) || match.status !== 'playing') return;
    match.privateState.phase = 'guessing';

    io.to(match.roomId).emit('game:color_hide', {
      round: match.round,
      guessDuration: GUESS_DURATION,
    });

    // Auto-resolve when time runs out
    match.privateState.guessTimer = setTimeout(() => {
      resolveRound(io, match, state);
    }, GUESS_DURATION);

  }, SHOW_DURATION);
}

function onAction(io, socket, match, state, data, playerIndex, prisma) {
  if (data.type !== 'color_guess') return;
  const priv = match.privateState;
  if (priv.phase !== 'guessing') return;
  if (priv.roundGuesses[socket.id] !== undefined) return; // already guessed

  const { h, s, l } = data;
  if (h == null || s == null || l == null) return;

  const score = colorScore(priv.currentColor, { h, s, l });
  priv.roundGuesses[socket.id] = { h, s, l, score, playerIndex };

  // Acknowledge privately so player sees their score immediately
  socket.emit('game:guess_ack', {
    yourGuess: { h, s, l },
    score,
  });

  // Both guessed → resolve early
  if (Object.keys(priv.roundGuesses).length === match.players.length) {
    clearTimeout(priv.guessTimer);
    resolveRound(io, match, state, prisma);
  }
}

function resolveRound(io, match, state, prisma) {
  const priv = match.privateState;
  if (!priv.currentColor) return;
  priv.phase = 'result';
  clearTimeout(priv.guessTimer);

  const target = priv.currentColor;

  // Add scores
  const roundResults = match.players.map((player, i) => {
    const guess = Object.values(priv.roundGuesses).find((g) => g.playerIndex === i);
    const score = guess ? guess.score : 0;
    const guessColor = guess ? { h: guess.h, s: guess.s, l: guess.l } : null;
    player.score += score;
    return { username: player.username, roundScore: score, totalScore: player.score, guess: guessColor };
  });

  io.to(match.roomId).emit('game:round_result', {
    round: match.round,
    maxRounds: match.maxRounds,
    target,
    results: roundResults,
    scores: match.players.map((p) => ({ username: p.username, score: p.score })),
  });

  priv.currentColor = null;

  if (match.round >= match.maxRounds) {
    setTimeout(() => {
      const winner = match.players.reduce((a, b) => (a.score >= b.score ? a : b));
      const tied = match.players[0].score === match.players[1].score;
      endMatch(io, state, match, tied ? null : winner.socketId, prisma);
    }, 3500);
  } else {
    setTimeout(() => {
      if (state.activeMatches.has(match.id) && match.status === 'playing') {
        startRound(io, match, state);
      }
    }, 4000);
  }
}

module.exports = { onStart, onAction };
