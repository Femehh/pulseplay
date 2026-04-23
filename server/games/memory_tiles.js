/**
 * GAME: Memory Tiles
 * Race mode — both players flip simultaneously, most pairs wins.
 */

const { endMatch } = require('../sockets/gameHandler');

const EMOJIS = ['🎮', '🎯', '🏆', '⚡', '🔥', '💎', '🚀', '🌟', '🎪', '🎨', '🦁', '🐬', '🌈', '🍕', '🎸', '🏄'];
const PAIRS = 8;

function generateBoard() {
  const pool = EMOJIS.slice(0, PAIRS);
  const pairs = [...pool, ...pool];
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs.map((value, id) => ({ id, value, matched: false, matchedBy: null }));
}

function onStart(io, match, state) {
  const board = generateBoard();
  match.privateState = {
    board,
    pending: {},
    locked: new Set(),
  };
  for (const p of match.players) {
    match.privateState.pending[p.socketId] = [];
  }

  io.to(match.roomId).emit('game:state', {
    type: 'memory_tiles',
    board: board.map((t) => ({ id: t.id, matched: false })),
    totalPairs: PAIRS,
    scores: match.players.map((p) => ({ username: p.username, score: 0 })),
  });
}

function onAction(io, socket, match, state, data, playerIndex, prisma) {
  if (data.type !== 'flip') return;

  const tileId = Number(data.tileId);
  const priv = match.privateState;
  const board = priv.board;
  const player = match.players[playerIndex];

  if (isNaN(tileId) || tileId < 0 || tileId >= board.length) return;
  const tile = board[tileId];
  if (tile.matched) return;
  if (priv.locked.has(tileId)) return;

  if (!priv.pending[socket.id]) priv.pending[socket.id] = [];
  const flips = priv.pending[socket.id];
  if (flips.includes(tileId) || flips.length >= 2) return;

  // Prevent two players flipping same tile simultaneously
  for (const [sid, f] of Object.entries(priv.pending)) {
    if (sid !== socket.id && f.includes(tileId)) return;
  }

  flips.push(tileId);
  priv.locked.add(tileId);

  io.to(match.roomId).emit('game:tile_flip', {
    tileId,
    value: tile.value,
    username: player.username,
    socketId: socket.id,
  });

  if (flips.length === 2) {
    const [id1, id2] = flips;
    const t1 = board[id1];
    const t2 = board[id2];

    setTimeout(() => {
      if (!state.activeMatches.has(match.id)) return;

      priv.locked.delete(id1);
      priv.locked.delete(id2);
      priv.pending[socket.id] = [];

      if (t1.value === t2.value) {
        t1.matched = true; t1.matchedBy = socket.id;
        t2.matched = true; t2.matchedBy = socket.id;
        player.score++;

        io.to(match.roomId).emit('game:match_found', {
          tileIds: [id1, id2],
          value: t1.value,
          matchedBy: { username: player.username, socketId: socket.id },
          scores: match.players.map((p) => ({ username: p.username, score: p.score })),
        });

        if (board.every((t) => t.matched)) {
          const [p0, p1] = match.players;
          const winner = p0.score > p1.score ? p0 : p0.score < p1.score ? p1 : null;
          setTimeout(() => endMatch(io, state, match, winner?.socketId || null, prisma), 1500);
        }
      } else {
        io.to(match.roomId).emit('game:no_match', { tileIds: [id1, id2] });
      }
    }, 900);
  }
}

module.exports = { onStart, onAction };
