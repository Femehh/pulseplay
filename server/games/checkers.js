/**
 * GAME: Checkers
 * Classic checkers / draughts — standard 8x8 board, forced captures, kings on back rank.
 */

const { endMatch } = require('../sockets/gameHandler');

const EMPTY = 0;
const R = 1;   // Red regular
const RK = 2;  // Red king
const B = 3;   // Black regular
const BK = 4;  // Black king

function createBoard() {
  const board = Array(8).fill(null).map(() => Array(8).fill(EMPTY));
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) board[row][col] = B;
    }
  }
  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) board[row][col] = R;
    }
  }
  return board;
}

function isRed(piece) { return piece === R || piece === RK; }
function isBlack(piece) { return piece === B || piece === BK; }
function isKing(piece) { return piece === RK || piece === BK; }
function isFriendly(piece, isRedTurn) {
  return isRedTurn ? isRed(piece) : isBlack(piece);
}
function isEnemy(piece, isRedTurn) {
  return isRedTurn ? isBlack(piece) : isRed(piece);
}

function getDirections(piece) {
  if (piece === R) return [[-1, -1], [-1, 1]];
  if (piece === B) return [[1, -1], [1, 1]];
  return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
}

function getJumps(board, row, col, isRedTurn) {
  const piece = board[row][col];
  if (!piece || !isFriendly(piece, isRedTurn)) return [];
  const dirs = getDirections(piece);
  const jumps = [];
  for (const [dr, dc] of dirs) {
    const mr = row + dr, mc = col + dc;
    const lr = row + 2 * dr, lc = col + 2 * dc;
    if (lr < 0 || lr > 7 || lc < 0 || lc > 7) continue;
    if (board[mr][mc] && isEnemy(board[mr][mc], isRedTurn) && board[lr][lc] === EMPTY) {
      jumps.push({ from: [row, col], mid: [mr, mc], to: [lr, lc] });
    }
  }
  return jumps;
}

function getMoves(board, row, col, isRedTurn) {
  const piece = board[row][col];
  if (!piece || !isFriendly(piece, isRedTurn)) return [];
  const dirs = getDirections(piece);
  const moves = [];
  for (const [dr, dc] of dirs) {
    const nr = row + dr, nc = col + dc;
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
    if (board[nr][nc] === EMPTY) moves.push({ from: [row, col], to: [nr, nc] });
  }
  return moves;
}

function getAllJumps(board, isRedTurn) {
  const all = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      all.push(...getJumps(board, r, c, isRedTurn));
    }
  }
  return all;
}

function getAllMoves(board, isRedTurn) {
  const all = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      all.push(...getMoves(board, r, c, isRedTurn));
    }
  }
  return all;
}

function applyMove(board, from, to, mid) {
  const next = board.map((r) => [...r]);
  const piece = next[from[0]][from[1]];
  next[to[0]][to[1]] = piece;
  next[from[0]][from[1]] = EMPTY;
  if (mid) next[mid[0]][mid[1]] = EMPTY;
  // Promote to king
  if (piece === R && to[0] === 0) next[to[0]][to[1]] = RK;
  if (piece === B && to[0] === 7) next[to[0]][to[1]] = BK;
  return next;
}

function countPieces(board) {
  let red = 0, black = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (isRed(board[r][c])) red++;
      else if (isBlack(board[r][c])) black++;
    }
  }
  return { red, black };
}

function serializeBoard(board) {
  return board.map((row) => [...row]);
}

function onStart(io, match, state) {
  const board = createBoard();
  match.privateState = {
    board,
    isRedTurn: true,  // Red moves first (player index 0)
    mustJumpFrom: null,  // After multi-jump, force same piece
    moveCount: 0,
    drawClock: 0,  // moves without capture for draw detection
  };

  // player[0] = Red, player[1] = Black
  io.to(match.roomId).emit('game:state', {
    type: 'checkers',
    board: serializeBoard(board),
    isRedTurn: true,
    redPlayer: match.players[0].username,
    blackPlayer: match.players[1].username,
    scores: match.players.map((p) => ({ username: p.username, score: 0 })),
  });
}

function onAction(io, socket, match, state, data, playerIndex, prisma) {
  if (data.type !== 'move') return;

  const priv = match.privateState;
  const isRedPlayer = playerIndex === 0;

  // Enforce turn order
  if (priv.isRedTurn !== isRedPlayer) return;

  const from = data.from;
  const to = data.to;
  if (!Array.isArray(from) || !Array.isArray(to)) return;
  if (from.length !== 2 || to.length !== 2) return;

  const [fr, fc] = from;
  const [tr, tc] = to;
  if (fr < 0 || fr > 7 || fc < 0 || fc > 7 || tr < 0 || tr > 7 || tc < 0 || tc > 7) return;

  const board = priv.board;
  const piece = board[fr][fc];
  if (!piece || !isFriendly(piece, isRedPlayer)) return;

  // If we're in mid-multi-jump, only allow the forced piece
  if (priv.mustJumpFrom) {
    if (fr !== priv.mustJumpFrom[0] || fc !== priv.mustJumpFrom[1]) return;
  }

  const allJumps = getAllJumps(board, isRedPlayer);
  const isJumpRequired = allJumps.length > 0;

  // Find if this move is a valid jump
  const jumpsFromPiece = getJumps(board, fr, fc, isRedPlayer);
  const matchedJump = jumpsFromPiece.find((j) => j.to[0] === tr && j.to[1] === tc);

  if (isJumpRequired && !matchedJump) return; // Must capture
  if (!matchedJump) {
    // Validate as simple move
    const movesFromPiece = getMoves(board, fr, fc, isRedPlayer);
    const matchedMove = movesFromPiece.find((m) => m.to[0] === tr && m.to[1] === tc);
    if (!matchedMove) return;
  }

  const newBoard = applyMove(board, from, to, matchedJump?.mid);
  priv.board = newBoard;
  priv.moveCount++;
  priv.drawClock = matchedJump ? 0 : priv.drawClock + 1;

  let nextTurn = !priv.isRedTurn;
  priv.mustJumpFrom = null;

  // Check for multi-jump
  if (matchedJump) {
    const movedPiece = newBoard[tr][tc];
    const furtherJumps = getJumps(newBoard, tr, tc, isRedPlayer);
    // Only continue multi-jump if piece wasn't just promoted to king
    const wasPromoted = isKing(movedPiece) && !isKing(piece);
    if (furtherJumps.length > 0 && !wasPromoted) {
      priv.mustJumpFrom = [tr, tc];
      nextTurn = priv.isRedTurn; // Same player continues
    }
  }

  const { red, black } = countPieces(newBoard);

  io.to(match.roomId).emit('game:move', {
    from,
    to,
    mid: matchedJump?.mid || null,
    board: serializeBoard(newBoard),
    isRedTurn: nextTurn,
    mustJumpFrom: priv.mustJumpFrom,
    redCount: red,
    blackCount: black,
    mover: match.players[playerIndex].username,
  });

  priv.isRedTurn = nextTurn;

  // Check end conditions
  const nextPlayerIsRed = nextTurn;
  const nextAllJumps = getAllJumps(newBoard, nextPlayerIsRed);
  const nextAllMoves = getAllMoves(newBoard, nextPlayerIsRed);
  const noMoves = nextAllJumps.length === 0 && nextAllMoves.length === 0;
  const noPieces = nextPlayerIsRed ? red === 0 : black === 0;

  // Draw: 40 moves without capture (or no pieces which shouldn't happen)
  if (priv.drawClock >= 40) {
    setTimeout(() => endMatch(io, state, match, null, prisma), 1000);
    return;
  }

  if (noPieces || noMoves) {
    // Current player (who just moved) wins
    const winner = match.players[playerIndex];
    setTimeout(() => endMatch(io, state, match, winner.socketId, prisma), 1000);
  }
}

module.exports = { onStart, onAction };
