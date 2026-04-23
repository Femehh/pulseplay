/**
 * GAME: Frequency Match
 *
 * Rules:
 * - A pure sine tone is played at a random frequency (80–1200 Hz)
 * - Players hear it for PLAY_DURATION ms, then must dial in the frequency
 * - Score per round = 100 - distance_penalty (closer = higher score)
 * - 5 rounds, highest total score wins
 */

const { endMatch } = require('../sockets/gameHandler');

const PLAY_DURATION  = 3000;  // ms tone plays
const GUESS_DURATION = 15000; // ms to submit guess
const MIN_HZ = 80;
const MAX_HZ = 1200;

function randomFrequency() {
  // Log-scale random so low freqs aren't underrepresented
  const logMin = Math.log(MIN_HZ);
  const logMax = Math.log(MAX_HZ);
  return Math.round(Math.exp(logMin + Math.random() * (logMax - logMin)));
}

/**
 * Score 0-100. Uses log ratio so a 2x error is always the same penalty
 * regardless of whether you're at 100 Hz or 1000 Hz.
 */
function frequencyScore(target, guess) {
  const ratio = Math.abs(Math.log(guess / target)) / Math.log(MAX_HZ / MIN_HZ);
  return Math.max(0, Math.round(100 - ratio * 100));
}

function onStart(io, match, state) {
  match.privateState = {
    currentFreq: null,
    roundGuesses: {},
    phase: 'idle',
    guessTimer: null,
  };

  io.to(match.roomId).emit('game:state', {
    type: 'frequency_match',
    round: 0,
    maxRounds: match.maxRounds,
    playDuration: PLAY_DURATION,
    guessDuration: GUESS_DURATION,
    minHz: MIN_HZ,
    maxHz: MAX_HZ,
    scores: match.players.map((p) => ({ username: p.username, score: 0 })),
  });

  setTimeout(() => startRound(io, match, state), 1500);
}

function startRound(io, match, state) {
  if (!state.activeMatches.has(match.id) || match.status !== 'playing') return;

  match.round++;
  const freq = randomFrequency();
  match.privateState.currentFreq = freq;
  match.privateState.roundGuesses = {};
  match.privateState.phase = 'playing';

  io.to(match.roomId).emit('game:freq_show', {
    round: match.round,
    maxRounds: match.maxRounds,
    freq,
    playDuration: PLAY_DURATION,
  });

  setTimeout(() => {
    if (!state.activeMatches.has(match.id) || match.status !== 'playing') return;
    match.privateState.phase = 'guessing';

    io.to(match.roomId).emit('game:freq_hide', {
      round: match.round,
      guessDuration: GUESS_DURATION,
      minHz: MIN_HZ,
      maxHz: MAX_HZ,
    });

    match.privateState.guessTimer = setTimeout(() => {
      resolveRound(io, match, state);
    }, GUESS_DURATION);
  }, PLAY_DURATION);
}

function onAction(io, socket, match, state, data, playerIndex, prisma) {
  if (data.type !== 'freq_guess') return;
  const priv = match.privateState;
  if (priv.phase !== 'guessing') return;
  if (priv.roundGuesses[socket.id] !== undefined) return;

  const guess = Math.round(Number(data.freq));
  if (!guess || guess < MIN_HZ || guess > MAX_HZ) return;

  const score = frequencyScore(priv.currentFreq, guess);
  priv.roundGuesses[socket.id] = { freq: guess, score, playerIndex };

  socket.emit('game:freq_guess_ack', { yourGuess: guess, score });

  if (Object.keys(priv.roundGuesses).length === match.players.length) {
    clearTimeout(priv.guessTimer);
    resolveRound(io, match, state, prisma);
  }
}

function resolveRound(io, match, state, prisma) {
  const priv = match.privateState;
  if (!priv.currentFreq) return;
  priv.phase = 'result';
  clearTimeout(priv.guessTimer);

  const target = priv.currentFreq;

  const roundResults = match.players.map((player, i) => {
    const guess = Object.values(priv.roundGuesses).find((g) => g.playerIndex === i);
    const score = guess ? guess.score : 0;
    const guessFreq = guess ? guess.freq : null;
    player.score += score;
    return { username: player.username, roundScore: score, totalScore: player.score, guessFreq };
  });

  io.to(match.roomId).emit('game:freq_result', {
    round: match.round,
    maxRounds: match.maxRounds,
    target,
    results: roundResults,
    scores: match.players.map((p) => ({ username: p.username, score: p.score })),
  });

  priv.currentFreq = null;

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
