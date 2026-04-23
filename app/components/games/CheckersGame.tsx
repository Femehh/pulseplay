'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ScoreBar from '../ui/ScoreBar';
import MatchResultModal from '../ui/MatchResultModal';
import { useGameStore } from '@/app/store/gameStore';
import { useAuthStore } from '@/app/store/authStore';
import { useRouter } from 'next/navigation';

type Piece = 0 | 1 | 2 | 3 | 4;
type Board = Piece[][];

const EMPTY = 0, R = 1, RK = 2, B = 3, BK = 4;

function isRed(p: Piece) { return p === R || p === RK; }
function isBlack(p: Piece) { return p === B || p === BK; }
function isKing(p: Piece) { return p === RK || p === BK; }
function isFriendly(p: Piece, redTurn: boolean) { return redTurn ? isRed(p) : isBlack(p); }
function isEnemy(p: Piece, redTurn: boolean) { return redTurn ? isBlack(p) : isRed(p); }

function getDirs(p: Piece): [number, number][] {
  if (p === R) return [[-1, -1], [-1, 1]];
  if (p === B) return [[1, -1], [1, 1]];
  return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
}

function getJumpsFrom(board: Board, r: number, c: number, red: boolean) {
  const p = board[r][c];
  if (!p || !isFriendly(p, red)) return [];
  const res: { mid: [number, number]; to: [number, number] }[] = [];
  for (const [dr, dc] of getDirs(p)) {
    const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
    if (lr < 0 || lr > 7 || lc < 0 || lc > 7) continue;
    if (board[mr][mc] && isEnemy(board[mr][mc] as Piece, red) && board[lr][lc] === EMPTY)
      res.push({ mid: [mr, mc], to: [lr, lc] });
  }
  return res;
}

function getMovesFrom(board: Board, r: number, c: number, red: boolean) {
  const p = board[r][c];
  if (!p || !isFriendly(p, red)) return [];
  const res: [number, number][] = [];
  for (const [dr, dc] of getDirs(p)) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
    if (board[nr][nc] === EMPTY) res.push([nr, nc]);
  }
  return res;
}

function getAllJumps(board: Board, red: boolean) {
  const all: { from: [number, number]; mid: [number, number]; to: [number, number] }[] = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      for (const j of getJumpsFrom(board, r, c, red))
        all.push({ from: [r, c], ...j });
  return all;
}

function createInitialBoard(): Board {
  const board: Board = Array(8).fill(null).map(() => Array(8).fill(EMPTY) as Piece[]);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 8; col++)
      if ((row + col) % 2 === 1) board[row][col] = B;
  for (let row = 5; row < 8; row++)
    for (let col = 0; col < 8; col++)
      if ((row + col) % 2 === 1) board[row][col] = R;
  return board;
}

function countPieces(board: Board) {
  let red = 0, black = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      if (isRed(board[r][c] as Piece)) red++;
      else if (isBlack(board[r][c] as Piece)) black++;
    }
  return { red, black };
}

function applyMoveLocal(board: Board, from: [number,number], to: [number,number], mid?: [number,number]): Board {
  const next = board.map(r => [...r]) as Board;
  const piece = next[from[0]][from[1]] as Piece;
  next[to[0]][to[1]] = piece;
  next[from[0]][from[1]] = EMPTY;
  if (mid) next[mid[0]][mid[1]] = EMPTY;
  if (piece === R && to[0] === 0) next[to[0]][to[1]] = RK;
  if (piece === B && to[0] === 7) next[to[0]][to[1]] = BK;
  return next;
}

interface GameProps { match: any; emit: any; on: any; solo?: boolean; onExit?: () => void; }

export default function CheckersGame({ match, emit, on, solo = false, onExit }: GameProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { result, setResult, resetGame } = useGameStore();

  const [board, setBoard] = useState<Board>(createInitialBoard());
  const [isRedTurn, setIsRedTurn] = useState(true);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves] = useState<[number, number][]>([]);
  const [mustJumpFrom, setMustJumpFrom] = useState<[number, number] | null>(null);
  const [redPlayer, setRedPlayer] = useState<string>('');
  const [blackPlayer, setBlackPlayer] = useState<string>('');
  const [redCount, setRedCount] = useState(12);
  const [blackCount, setBlackCount] = useState(12);
  const [lastMove, setLastMove] = useState<{ from: [number,number]; to: [number,number] } | null>(null);
  const [soloFinished, setSoloFinished] = useState<'red' | 'black' | 'draw' | null>(null);

  // Solo: we are always Red (moves first, goes up)
  const isMyTurn = solo ? isRedTurn : (
    isRedTurn
      ? match?.players?.[0]?.username === user?.username
      : match?.players?.[1]?.username === user?.username
  );
  const myColor = solo ? 'red' : (match?.players?.[0]?.username === user?.username ? 'red' : 'black');

  // Multiplayer socket listeners
  useEffect(() => {
    if (solo) return;
    const offState = on('game:state', (data: any) => {
      setBoard(data.board);
      setIsRedTurn(data.isRedTurn);
      setRedPlayer(data.redPlayer);
      setBlackPlayer(data.blackPlayer);
    });
    const offMove = on('game:move', (data: any) => {
      setBoard(data.board);
      setIsRedTurn(data.isRedTurn);
      setMustJumpFrom(data.mustJumpFrom || null);
      setRedCount(data.redCount);
      setBlackCount(data.blackCount);
      setLastMove({ from: data.from, to: data.to });
      setSelected(null);
      setValidMoves([]);
    });
    const offEnded = on('match:ended', (data: any) => setResult(data));
    return () => { offState(); offMove(); offEnded(); };
  }, [on, solo]);

  const computeValidDestinations = useCallback((r: number, c: number, brd: Board, red: boolean, mjf: [number,number] | null) => {
    const allJumps = getAllJumps(brd, red);
    const mustJump = allJumps.length > 0;
    const jumpsHere = getJumpsFrom(brd, r, c, red);
    const movesHere = getMovesFrom(brd, r, c, red);
    if (mjf && (r !== mjf[0] || c !== mjf[1])) return [];
    if (mustJump) return jumpsHere.map(j => j.to);
    return [...jumpsHere.map(j => j.to), ...movesHere];
  }, []);

  const handleSquareClick = useCallback((r: number, c: number) => {
    const piece = board[r][c] as Piece;

    if (selected) {
      // Try to move to this square
      const isValid = validMoves.some(([vr, vc]) => vr === r && vc === c);
      if (isValid) {
        const [sr, sc] = selected;
        const jumps = getJumpsFrom(board, sr, sc, isRedTurn);
        const jump = jumps.find(j => j.to[0] === r && j.to[1] === c);

        if (solo) {
          // Apply locally and check for multi-jump or game end
          const newBoard = applyMoveLocal(board, [sr, sc], [r, c], jump?.mid);
          setLastMove({ from: [sr, sc], to: [r, c] });

          // Check if multi-jump possible
          let nextMJF: [number,number] | null = null;
          if (jump) {
            const movedPiece = newBoard[r][c] as Piece;
            const wasPromoted = isKing(movedPiece) && !isKing(piece);
            const further = getJumpsFrom(newBoard, r, c, isRedTurn);
            if (further.length > 0 && !wasPromoted) nextMJF = [r, c];
          }

          const newIsRedTurn = nextMJF ? isRedTurn : !isRedTurn;
          setBoard(newBoard);
          setIsRedTurn(newIsRedTurn);
          setMustJumpFrom(nextMJF);
          setSelected(null);
          setValidMoves([]);

          const { red, black } = countPieces(newBoard);
          setRedCount(red);
          setBlackCount(black);

          // Check end
          if (!nextMJF) {
            const nextAllJumps = getAllJumps(newBoard, newIsRedTurn);
            const nextAllMoves: [number,number][] = [];
            for (let tr = 0; tr < 8; tr++)
              for (let tc = 0; tc < 8; tc++)
                nextAllMoves.push(...getMovesFrom(newBoard, tr, tc, newIsRedTurn));
            const noMoves = nextAllJumps.length === 0 && nextAllMoves.length === 0;
            const noPieces = newIsRedTurn ? red === 0 : black === 0;
            if (noMoves || noPieces) setSoloFinished(isRedTurn ? 'red' : 'black');
          }
        } else {
          emit('game:action', { type: 'move', from: [sr, sc], to: [r, c] });
        }
        return;
      }
      // Clicked elsewhere — deselect or select another piece
      setSelected(null);
      setValidMoves([]);
      if (piece && isFriendly(piece, isRedTurn) && isMyTurn) {
        const dests = computeValidDestinations(r, c, board, isRedTurn, mustJumpFrom);
        if (dests.length > 0) { setSelected([r, c]); setValidMoves(dests); }
      }
      return;
    }

    // Select a piece
    if (!piece || !isFriendly(piece, isRedTurn) || !isMyTurn) return;
    if (mustJumpFrom && (r !== mustJumpFrom[0] || c !== mustJumpFrom[1])) return;
    const dests = computeValidDestinations(r, c, board, isRedTurn, mustJumpFrom);
    if (dests.length === 0) return;
    setSelected([r, c]);
    setValidMoves(dests);
  }, [board, selected, validMoves, isRedTurn, isMyTurn, mustJumpFrom, emit, solo, computeValidDestinations]);

  const turnLabel = solo
    ? (isRedTurn ? 'Your turn (Red)' : 'Black\'s turn')
    : isMyTurn ? 'Your turn' : 'Opponent\'s turn';

  const myUsername = user?.username || 'You';
  const opUsername = solo ? 'CPU' : (match?.players?.find((p: any) => p.username !== myUsername)?.username ?? 'Opponent');
  const myScore = myColor === 'red' ? redCount : blackCount;
  const opScore = myColor === 'red' ? blackCount : redCount;

  if (solo && soloFinished) {
    const won = soloFinished === 'red';
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-background p-6">
        <motion.div className="card p-10 text-center max-w-sm w-full" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="text-6xl mb-4">{won ? '👑' : '😤'}</div>
          <h2 className="text-3xl font-black text-gradient mb-2">{won ? 'You Win!' : 'You Lose!'}</h2>
          <p className="text-text-muted text-sm mb-8">Final piece count — Red: {redCount} · Black: {blackCount}</p>
          <div className="flex gap-3">
            <button className="btn-secondary btn flex-1" onClick={() => {
              setBoard(createInitialBoard()); setIsRedTurn(true); setSelected(null);
              setValidMoves([]); setMustJumpFrom(null); setLastMove(null);
              setRedCount(12); setBlackCount(12); setSoloFinished(null);
            }}>Play Again</button>
            <button className="btn-ghost btn flex-1" onClick={onExit}>Back</button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Flip board so current player sees their pieces at bottom
  const shouldFlip = myColor === 'black';
  const displayBoard = shouldFlip ? [...board].reverse().map(r => [...r].reverse()) : board;

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-border px-6 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-text-faint text-sm">
              ♟ Checkers{solo && <span className="ml-2 text-accent">(Solo)</span>}
              <span className={`ml-3 text-xs px-2 py-0.5 rounded-full font-semibold ${isMyTurn ? 'bg-success/20 text-success' : 'bg-surface-2 text-text-muted'}`}>
                {turnLabel}
              </span>
            </span>
            {solo && (
              <button onClick={onExit} className="text-xs text-text-faint hover:text-text underline">Exit</button>
            )}
          </div>
          {!solo && (
            <ScoreBar
              player1={{ username: myUsername, score: myScore }}
              player2={{ username: opUsername, score: opScore }}
              maxScore={12}
            />
          )}
          {solo && (
            <div className="flex gap-4 text-sm">
              <span className="text-red-400 font-bold">🔴 Red: {redCount}</span>
              <span className="text-text-muted font-bold">⚫ Black: {blackCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="flex flex-col items-center gap-4 w-full max-w-[480px]">
          {/* Opponent label */}
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <span className={`w-3 h-3 rounded-full ${shouldFlip ? 'bg-red-500' : 'bg-gray-800 border border-gray-500'}`} />
            <span className="font-semibold">{shouldFlip ? (solo ? 'You (Red)' : myUsername) : opUsername}</span>
            <span className="text-text-faint">({shouldFlip ? redCount : blackCount} pieces)</span>
          </div>

          {/* Board grid */}
          <div
            className="grid border-2 border-border rounded-xl overflow-hidden shadow-2xl"
            style={{ gridTemplateColumns: 'repeat(8, 1fr)', width: '100%', aspectRatio: '1' }}
          >
            {displayBoard.map((rowArr, displayRow) =>
              rowArr.map((rawPiece, displayCol) => {
                const actualRow = shouldFlip ? 7 - displayRow : displayRow;
                const actualCol = shouldFlip ? 7 - displayCol : displayCol;
                const piece = rawPiece as Piece;
                const isDark = (actualRow + actualCol) % 2 === 1;
                const isSelected = selected?.[0] === actualRow && selected?.[1] === actualCol;
                const isValidDest = validMoves.some(([vr, vc]) => vr === actualRow && vc === actualCol);
                const isLastFrom = lastMove?.from[0] === actualRow && lastMove?.from[1] === actualCol;
                const isLastTo = lastMove?.to[0] === actualRow && lastMove?.to[1] === actualCol;

                return (
                  <button
                    key={`${displayRow}-${displayCol}`}
                    onClick={() => handleSquareClick(actualRow, actualCol)}
                    className={`relative flex items-center justify-center transition-all duration-100 ${
                      isDark
                        ? isSelected
                          ? 'bg-primary/60'
                          : isLastFrom || isLastTo
                          ? 'bg-accent/30'
                          : 'bg-[#4a3728]'
                        : 'bg-[#f0d9b5]'
                    }`}
                    style={{ aspectRatio: '1' }}
                  >
                    {/* Valid move indicator */}
                    {isValidDest && isDark && !piece && (
                      <div className="w-1/3 h-1/3 rounded-full bg-primary/70 pointer-events-none" />
                    )}
                    {isValidDest && isDark && piece !== EMPTY && (
                      <div className="absolute inset-1 rounded-full ring-2 ring-primary/80 pointer-events-none" />
                    )}

                    {/* Piece */}
                    {piece !== EMPTY && (
                      <motion.div
                        className={`w-[75%] h-[75%] rounded-full flex items-center justify-center text-sm font-black shadow-lg select-none
                          ${isRed(piece)
                            ? 'bg-gradient-to-br from-red-400 to-red-700 border-2 border-red-300'
                            : 'bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-gray-500'
                          } ${isSelected ? 'scale-110 ring-2 ring-white/80' : ''}`}
                        animate={isSelected ? { scale: 1.12 } : { scale: 1 }}
                        transition={{ duration: 0.1 }}
                      >
                        {isKing(piece) && <span className="text-yellow-300 text-xs">♛</span>}
                      </motion.div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* My label */}
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <span className={`w-3 h-3 rounded-full ${shouldFlip ? 'bg-gray-800 border border-gray-500' : 'bg-red-500'}`} />
            <span className="font-semibold">{shouldFlip ? opUsername : (solo ? 'You (Red)' : myUsername)}</span>
            <span className="text-text-faint">({shouldFlip ? blackCount : redCount} pieces)</span>
          </div>
        </div>
      </div>

      {!solo && result && (
        <MatchResultModal
          result={result}
          onRematch={() => { emit('game:rematch', { matchId: match?.matchId }); setResult(null); }}
          onHome={() => { resetGame(); router.push('/play'); }}
        />
      )}
    </div>
  );
}
