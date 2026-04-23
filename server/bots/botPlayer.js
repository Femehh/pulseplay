/**
 * Bot player system for PulsePlay.
 * Bots fill in when no human opponent is found after QUEUE_TIMEOUT ms.
 * Bot skill scales with the human player's ELO for that game.
 */

const { endMatch } = require('../sockets/gameHandler');

const QUEUE_TIMEOUT = 15000; // 15s before bot fills in
const BOT_NAMES = ['Pulse_AI', 'NexBot', 'RoboRival', 'SynthBot', 'AlphaUnit'];

function getBotName() {
  return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + '_' + Math.floor(Math.random() * 999);
}

/**
 * Bot ELO = player's ELO for that game (from per-game ranking), or overall ELO.
 * Adds ±50 random variance so it's not always identical.
 */
function getBotElo(playerElo) {
  const variance = (Math.random() - 0.5) * 100; // ±50
  return Math.max(600, Math.round(playerElo + variance));
}

/**
 * Skill factor 0-1: how accurate the bot is (based on ELO delta).
 * 1.0 = grandmaster bot, 0.3 = beginner bot.
 */
function skillFactor(botElo) {
  return Math.min(1, Math.max(0.25, (botElo - 600) / (2400 - 600)));
}

/**
 * Schedule a bot to join if the player is still in queue after QUEUE_TIMEOUT.
 */
function scheduleBotIfNeeded(io, state, gameType, playerEntry, prisma) {
  setTimeout(() => {
    const queue = state.matchmakingQueues[gameType];
    if (!queue) return;
    const stillInQueue = queue.some((p) => p.socketId === playerEntry.socketId);
    if (!stillInQueue) return; // already matched

    // Remove player from queue
    state.matchmakingQueues[gameType] = queue.filter((p) => p.socketId !== playerEntry.socketId);

    // Build bot entry
    const botElo = getBotElo(playerEntry.elo);
    const botName = getBotName();
    const botId = `bot_${Date.now()}`;
    const botSocketId = `bot_socket_${botId}`;

    const botEntry = {
      socketId: botSocketId,
      playerId: botId,
      username: botName,
      elo: botElo,
      isBot: true,
      skill: skillFactor(botElo),
    };

    // Start match immediately
    startBotMatch(io, state, gameType, playerEntry, botEntry, prisma);
  }, QUEUE_TIMEOUT);
}

async function startBotMatch(io, state, gameType, humanEntry, botEntry, prisma) {
  const { v4: uuidv4 } = require('uuid');
  const { createMatch } = require('../games/matchFactory');

  const matchId = uuidv4();
  const roomId = `match:${matchId}`;

  // Verify human is still connected
  const humanSocket = io.sockets.sockets.get(humanEntry.socketId);
  if (!humanSocket) return;

  humanSocket.join(roomId);
  state.playerToMatch.set(humanEntry.socketId, matchId);

  const matchState = createMatch(matchId, gameType, humanEntry, botEntry, roomId);
  matchState.isVsBot = true;
  matchState.botEntry = botEntry;
  state.activeMatches.set(matchId, matchState);

  const matchInfo = {
    matchId,
    gameType,
    isVsBot: true,
    players: [
      { id: humanEntry.playerId, username: humanEntry.username, elo: humanEntry.elo },
      { id: botEntry.playerId, username: botEntry.username, elo: botEntry.elo, isBot: true },
    ],
  };

  io.to(roomId).emit('match:found', matchInfo);

  console.log(`[BOT] ${humanEntry.username} vs ${botEntry.username} (skill=${botEntry.skill.toFixed(2)}) | ${gameType}`);

  // Countdown then start
  let count = 3;
  matchState.status = 'countdown';
  const interval = setInterval(() => {
    if (count > 0) {
      io.to(roomId).emit('match:countdown', { count, matchId });
      count--;
    } else {
      clearInterval(interval);
      io.to(roomId).emit('match:start', { matchId, timestamp: Date.now() });
      matchState.status = 'playing';
      matchState.startedAt = Date.now();

      try {
        const gameModule = require(`../games/${gameType.toLowerCase()}`);
        if (gameModule.onStart) gameModule.onStart(io, matchState, state);

        // Run bot AI for this game
        runBotAI(io, state, matchState, botEntry, prisma);
      } catch (err) {
        console.error('[BOT] Game start error:', err);
      }
    }
  }, 1000);
}

/**
 * Bot AI dispatcher — routes to per-game bot logic.
 */
function runBotAI(io, state, match, botEntry, prisma) {
  const skill = botEntry.skill;
  const gameType = match.gameType;

  switch (gameType) {
    case 'REACTION_TIME': return botReactionTime(io, state, match, botEntry, prisma);
    case 'AIM_TRAINER':   return botAimTrainer(io, state, match, botEntry, prisma);
    case 'COLOR_MATCH':   return botColorMatch(io, state, match, botEntry, prisma);
    case 'SOUND_RECOGNITION': return botSoundRecog(io, state, match, botEntry, prisma);
    case 'MEMORY_TILES':  return botMemoryTiles(io, state, match, botEntry, prisma);
    case 'CHECKERS':      return botCheckers(io, state, match, botEntry, prisma);
    default: break;
  }
}

// ─── REACTION TIME BOT ───────────────────────────────────────────────────────
function botReactionTime(io, state, match, botEntry, prisma) {
  const skill = botEntry.skill;
  // Listen for signals and click after a skill-based delay
  const checkSignal = setInterval(() => {
    if (!state.activeMatches.has(match.id) || match.status !== 'playing') {
      clearInterval(checkSignal);
      return;
    }
    const priv = match.privateState;
    if (priv?.signalActive && priv.roundWinner === null) {
      // Bot reaction time: 80ms (elite) to 600ms (beginner)
      const baseReaction = 80 + (1 - skill) * 520;
      const jitter = (Math.random() - 0.5) * 80;
      const delay = Math.max(50, baseReaction + jitter);

      setTimeout(() => {
        if (!state.activeMatches.has(match.id)) return;
        if (!priv.signalActive || priv.roundWinner !== null) return;

        // Simulate click from bot
        const playerIndex = match.players.findIndex((p) => p.socketId === botEntry.socketId);
        if (playerIndex === -1) return;

        const now = Date.now();
        clearTimeout(priv.roundTimeout);
        priv.roundWinner = botEntry.socketId;
        priv.signalActive = false;

        const reactionTime = now - priv.signalStartTime;
        match.players[playerIndex].score++;

        io.to(match.roomId).emit('game:round_end', {
          round: match.round,
          winner: { username: botEntry.username, socketId: botEntry.socketId },
          reactionTime,
          scores: match.players.map((p) => ({ username: p.username, score: p.score })),
        });

        const { proceedToNextRound } = (() => {
          try { return require('../games/reaction_time'); } catch { return {}; }
        })();
        if (proceedToNextRound) proceedToNextRound(io, match, state, prisma);
      }, delay);
    }
  }, 50);
}

// ─── AIM TRAINER BOT ─────────────────────────────────────────────────────────
function botAimTrainer(io, state, match, botEntry, prisma) {
  const skill = botEntry.skill;
  // Bot hits targets with skill-based probability and speed
  const hitInterval = setInterval(() => {
    if (!state.activeMatches.has(match.id) || match.status !== 'playing') {
      clearInterval(hitInterval);
      return;
    }
    const priv = match.privateState;
    if (!priv?.targets?.length) return;

    // Bot clicks with probability based on skill
    if (Math.random() > skill * 0.7) return; // miss chance

    const target = priv.targets[Math.floor(Math.random() * priv.targets.length)];
    if (!target) return;

    const playerIndex = match.players.findIndex((p) => p.socketId === botEntry.socketId);
    if (playerIndex === -1) return;

    // Simulate hit at center of target
    const targetIdx = priv.targets.findIndex((t) => t.id === target.id);
    if (targetIdx === -1) return;
    priv.targets.splice(targetIdx, 1);
    match.players[playerIndex].score++;

    io.to(match.roomId).emit('game:hit', {
      targetId: target.id,
      hitter: { username: botEntry.username, socketId: botEntry.socketId },
      scores: match.players.map((p) => ({ username: p.username, score: p.score })),
    });
  }, 800 + (1 - skill) * 1200); // hits every 0.8s (elite) to 2s (beginner)
}

// ─── COLOR MATCH BOT ─────────────────────────────────────────────────────────
function botColorMatch(io, state, match, botEntry, prisma) {
  const skill = botEntry.skill;
  const checkGuess = setInterval(() => {
    if (!state.activeMatches.has(match.id) || match.status !== 'playing') {
      clearInterval(checkGuess);
      return;
    }
    const priv = match.privateState;
    if (priv?.phase !== 'guessing' || priv.roundGuesses[botEntry.socketId] !== undefined) return;

    clearInterval(checkGuess);

    // Bot submits after a delay
    const delay = 1000 + (1 - skill) * 8000;
    setTimeout(() => {
      if (!state.activeMatches.has(match.id)) return;
      const priv2 = match.privateState;
      if (priv2?.phase !== 'guessing') return;

      const target = priv2.currentColor;
      if (!target) return;

      // Error range inversely proportional to skill
      const hueError = (1 - skill) * 60;
      const satError = (1 - skill) * 30;
      const lightError = (1 - skill) * 25;

      const guess = {
        h: Math.round(Math.max(0, Math.min(359, target.h + (Math.random() - 0.5) * hueError * 2))),
        s: Math.round(Math.max(0, Math.min(100, target.s + (Math.random() - 0.5) * satError * 2))),
        l: Math.round(Math.max(0, Math.min(100, target.l + (Math.random() - 0.5) * lightError * 2))),
      };

      const playerIndex = match.players.findIndex((p) => p.socketId === botEntry.socketId);
      if (playerIndex === -1) return;

      // Score and register guess
      const hueDiff = Math.min(Math.abs(target.h - guess.h), 360 - Math.abs(target.h - guess.h));
      const dist = (hueDiff / 180) * 60 + (Math.abs(target.s - guess.s) / 100) * 20 + (Math.abs(target.l - guess.l) / 100) * 20;
      const score = Math.max(0, Math.round(100 - dist));

      priv2.roundGuesses[botEntry.socketId] = { h: guess.h, s: guess.s, l: guess.l, score, playerIndex };

      if (Object.keys(priv2.roundGuesses).length === match.players.length) {
        const resolveRound = (() => {
          try { return require('../games/color_match').resolveRound; } catch { return null; }
        })();
        // resolveRound is not exported; the guess registration will trigger it if both guessed
        // The game's own timer handles resolution
      }

      // Restart check for next round
      setTimeout(() => botColorMatch(io, state, match, botEntry, prisma), 500);
    }, delay);
  }, 200);
}

// ─── SOUND RECOGNITION BOT ───────────────────────────────────────────────────
function botSoundRecog(io, state, match, botEntry, prisma) {
  const skill = botEntry.skill;
  const checkGuess = setInterval(() => {
    if (!state.activeMatches.has(match.id) || match.status !== 'playing') {
      clearInterval(checkGuess);
      return;
    }
    const priv = match.privateState;
    if (priv?.phase !== 'guessing' || priv.roundGuesses[botEntry.socketId] !== undefined) return;

    clearInterval(checkGuess);
    const delay = 1000 + (1 - skill) * 9000;

    setTimeout(() => {
      if (!state.activeMatches.has(match.id)) return;
      const priv2 = match.privateState;
      if (priv2?.phase !== 'guessing') return;

      const target = priv2.currentFreq;
      if (!target) return;

      // Bot guess: log-scale error
      const logError = (1 - skill) * 1.5; // max 1.5 log units error
      const logTarget = Math.log(target);
      const logGuess = logTarget + (Math.random() - 0.5) * logError;
      const guess = Math.round(Math.max(80, Math.min(1200, Math.exp(logGuess))));

      const playerIndex = match.players.findIndex((p) => p.socketId === botEntry.socketId);
      if (playerIndex === -1) return;

      const score = Math.max(0, Math.round(100 - (Math.abs(Math.log(guess / target)) / Math.log(1200 / 80)) * 100));
      priv2.roundGuesses[botEntry.socketId] = { freq: guess, score, playerIndex };

      setTimeout(() => botSoundRecog(io, state, match, botEntry, prisma), 500);
    }, delay);
  }, 200);
}

// ─── MEMORY TILES BOT ────────────────────────────────────────────────────────
function botMemoryTiles(io, state, match, botEntry, prisma) {
  const skill = botEntry.skill;
  const memory = {}; // bot "remembers" tiles it has seen

  const playLoop = setInterval(() => {
    if (!state.activeMatches.has(match.id) || match.status !== 'playing') {
      clearInterval(playLoop);
      return;
    }
    const priv = match.privateState;
    if (!priv) return;

    const playerIndex = match.players.findIndex((p) => p.socketId === botEntry.socketId);
    if (playerIndex === -1) return;

    const pending = priv.pending[botEntry.socketId] || [];
    if (pending.length >= 2) return; // already has 2 flipped

    // Find unmatched tiles
    const unmatched = priv.board.filter((t) => !t.matched && !priv.locked.has(t.id) && !pending.includes(t.id));

    // Check if bot knows a matching pair
    const knownPairs = Object.entries(memory).filter(([id1, val]) => {
      const pair = unmatched.find((t) => t.id !== Number(id1) && t.value === val && !priv.locked.has(t.id));
      const self = unmatched.find((t) => t.id === Number(id1));
      return pair && self;
    });

    let targetId;
    if (knownPairs.length > 0 && Math.random() < skill) {
      // Play the known pair
      const [id1, val] = knownPairs[0];
      if (pending.length === 0) {
        targetId = Number(id1);
      } else {
        const partner = unmatched.find((t) => t.id !== Number(id1) && t.value === val);
        if (partner) targetId = partner.id;
      }
    } else {
      // Random unflipped tile
      const unknownTiles = unmatched.filter((t) => !pending.includes(t.id));
      if (!unknownTiles.length) return;
      targetId = unknownTiles[Math.floor(Math.random() * unknownTiles.length)].id;
    }

    if (targetId == null) return;

    // Simulate the flip action
    const tile = priv.board[targetId];
    if (!tile || tile.matched || priv.locked.has(targetId)) return;

    // Memorize
    memory[targetId] = tile.value;

    // Route through onAction
    try {
      const gameModule = require('../games/memory_tiles');
      const fakeSocket = { id: botEntry.socketId, emit: () => {} };
      gameModule.onAction(io, fakeSocket, match, { activeMatches: state.activeMatches }, { type: 'flip', tileId: targetId }, playerIndex, null);
    } catch (err) {}

  }, 800 + (1 - skill) * 1500);
}

// ─── CHECKERS BOT ────────────────────────────────────────────────────────────
function botCheckers(io, state, match, botEntry, prisma) {
  const skill = botEntry.skill;

  const playLoop = setInterval(() => {
    if (!state.activeMatches.has(match.id) || match.status !== 'playing') {
      clearInterval(playLoop);
      return;
    }
    const priv = match.privateState;
    if (!priv) return;

    const playerIndex = match.players.findIndex((p) => p.socketId === botEntry.socketId);
    if (playerIndex === -1) return;

    // Bot is player index 1 (Black)
    const isRedTurn = priv.isRedTurn;
    if (isRedTurn) return; // not bot's turn (bot is always Black = player[1])

    const board = priv.board;
    const isBlack = (p) => p === 3 || p === 4;
    const isKing = (p) => p === 2 || p === 4;
    const getDirs = (p) => p === 3 ? [[1,-1],[1,1]] : p === 4 ? [[-1,-1],[-1,1],[1,-1],[1,1]] : [];

    // Collect all jumps
    const allJumps = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (!isBlack(board[r][c])) continue;
        const piece = board[r][c];
        for (const [dr, dc] of getDirs(piece)) {
          const mr = r+dr, mc = c+dc, lr = r+2*dr, lc = c+2*dc;
          if (lr<0||lr>7||lc<0||lc>7) continue;
          const mid = board[mr][mc];
          if ((mid===1||mid===2) && board[lr][lc]===0)
            allJumps.push({ from:[r,c], to:[lr,lc] });
        }
      }
    }

    const allMoves = [];
    if (allJumps.length === 0) {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (!isBlack(board[r][c])) continue;
          for (const [dr, dc] of getDirs(board[r][c])) {
            const nr=r+dr, nc=c+dc;
            if (nr<0||nr>7||nc<0||nc>7) continue;
            if (board[nr][nc]===0) allMoves.push({ from:[r,c], to:[nr,nc] });
          }
        }
      }
    }

    const candidates = allJumps.length > 0 ? allJumps : allMoves;
    if (!candidates.length) return;

    // Pick best move: skill chance of picking best vs random
    let move;
    if (Math.random() < skill && candidates.length > 1) {
      // Prefer jumps, prefer advancing (higher row index = advancing for black)
      move = candidates.reduce((best, m) => m.to[0] > best.to[0] ? m : best, candidates[0]);
    } else {
      move = candidates[Math.floor(Math.random() * candidates.length)];
    }

    try {
      const gameModule = require('../games/checkers');
      const fakeSocket = { id: botEntry.socketId, emit: () => {} };
      gameModule.onAction(io, fakeSocket, match, { activeMatches: state.activeMatches }, { type: 'move', from: move.from, to: move.to }, playerIndex, prisma);
    } catch (err) {}

  }, 600 + (1 - skill) * 1400); // 0.6s (elite) to 2s (beginner) per move
}

module.exports = { scheduleBotIfNeeded };
