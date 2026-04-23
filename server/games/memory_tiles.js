/**
 * GAME: Memory Tiles
 *
 * Rules:
 * - 4x4 grid of 8 pairs (16 tiles total)
 * - Each player takes turns flipping tiles OR race mode (simultaneous)
 * - RACE MODE: Both players race to find all pairs
 * - Whoever matches the most pairs wins
 * - Server tracks all flipped/matched tiles
 */

const { endMatch } = require('../sockets/gameHandler');

const EMOJIS = ['🎮', '🎯', '🏆', '⚡', '🔥', '💎', '🚀', '🌟'];

function generateBoard() {
  const pairs = [...EMOJIS, ...EMOJIS];
  // Fisher-Yates shuffle
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs.map((value, index) => ({ id: index, value, flipped: false, matched: false, matchedBy: null }));
}

function onStart(io, match, state) {
  const board = generateBoard();

  match.privateState = {
    board,
    playerFlips: {
      [match.players[0].socketId]: [],
      [match.players[1].socketId]: [],
    },
    lockedTiles: new Set(), // tiles being animated
  };

  // Send board without values (hidden)
  const hiddenBoard = board.map((t) => ({ id: t.id, flipped: false, matched: false }));

  io.to(match.roomId).emit('game:state', {
    type: 'memory_tiles',
    board: hiddenBoard,
    gridSize: { cols: 4, rows: 4 },
    scores: match.players.map((p) => ({ username: p.username, score: p.score })),
  });
}

function onAction(io, socket, match, state, data, playerIndex, prisma) {
  if (data.type !== 'flip') return;

  const { tileId } = data;
  const priv = match.privateState;
  const board = priv.board;

  // Validate tile
  if (tileId < 0 || tileId >= board.length) return;
  const tile = board[tileId];
  if (tile.matched || tile.flipped) return;
  if (priv.lockedTiles.has(tileId)) return;

  const player = match.players[playerIndex];
  const flips = priv.playerFlips[socket.id];

  // Mark tile as flipped
  tile.flipped = true;
  flips.push(tileId);

  io.to(match.roomId).emit('game:tile_flip', {
    tileId,
    value: tile.value,
    playerId: socket.id,
    username: player.username,
  });

  // Check for pair
  if (flips.length === 2) {
    const [firstId, secondId] = flips;
    const first = board[firstId];
    const second = board[secondId];

    // Lock both tiles during resolution
    priv.lockedTiles.add(firstId);
    priv.lockedTiles.add(secondId);

    setTimeout(() => {
      if (first.value === second.value) {
        // Match!
        first.matched = true;
        second.matched = true;
        first.matchedBy = socket.id;
        second.matchedBy = socket.id;
        player.score++;

        io.to(match.roomId).emit('game:match_found', {
          tileIds: [firstId, secondId],
          value: first.value,
          matchedBy: { username: player.username, socketId: socket.id },
          scores: match.players.map((p) => ({ username: p.username, score: p.score })),
        });

        priv.lockedTiles.delete(firstId);
        priv.lockedTiles.delete(secondId);

        // Check if all matched
        if (board.every((t) => t.matched)) {
          const winner = match.players[0].score > match.players[1].score
            ? match.players[0]
            : match.players[0].score < match.players[1].score
              ? match.players[1]
              : null;
          endMatch(io, state, match, winner?.socketId || null, prisma);
        }
      } else {
        // No match — flip back
        first.flipped = false;
        second.flipped = false;

        io.to(match.roomId).emit('game:no_match', { tileIds: [firstId, secondId] });

        priv.lockedTiles.delete(firstId);
        priv.lockedTiles.delete(secondId);
      }

      priv.playerFlips[socket.id] = [];
    }, 800);
  }
}

module.exports = { onStart, onAction };
