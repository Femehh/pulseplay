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

function getAllMovesCount(board: Board, red: boolean) {
  let count = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      count += getMovesFrom(board, r, c, red).length;
  return count;
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
  let red = 0, black = 0, redKings = 0, blackKings = 0;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === R) red++;
      else if (board[r][c] === RK) { red++; redKings++; }
      else if (board[r][c] === B) black++;
      else if (board[r][c] === BK) { black++; blackKings++; }
    }
  return { red, black, redKings, blackKings };
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

function coordLabel(r: number, c: number) {
  return `${'abcdefgh'[c]}${8 - r}`;
}

interface MoveLog { from: string; to: string; capture: boolean; promotion: boolean; by: 'red' | 'black'; }

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
  const [redCount, setRedCount] = useState(12);
  const [blackCount, setBlackCount] = useState(12);
  const [redKings, setRedKings] = useState(0);
  const [blackKings, setBlackKings] = useState(0);
  const [lastMove, setLastMove] = useState<{ from: [number,number]; to: [number,number]; mid?: [number,number] } | null>(null);
  const [moveLog, setMoveLog] = useState<MoveLog[]>([]);
  const [soloFinished, setSoloFinished] = useState<'red' | 'black' | 'draw' | null>(null);
  const [newKingPos, setNewKingPos] = useState<[number,number] | null>(null);
  const [drawOffered, setDrawOffered] = useState(false);
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [resigned, setResigned] = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Timer
  useEffect(() => {
    if (!gameStarted || soloFinished || result) return;
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameStarted, soloFinished, result]);

  useEffect(() => {
    if (solo) setGameStarted(true);
  }, [solo]);

  // Tab visibility API — send heartbeat when tab is hidden so server knows we're alive
  useEffect(() => {
    if (solo) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        emit('player:heartbeat', { matchId: match?.matchId });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [emit, match?.matchId, solo]);

  // Auto-scroll move log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [moveLog]);

  const myColor = solo ? 'red' : (match?.players?.[0]?.username === user?.username ? 'red' : 'black');
  const isMyTurn = solo ? isRedTurn : (isRedTurn ? myColor === 'red' : myColor === 'black');
  const myUsername = user?.username || 'You';
  const opUsername = solo ? 'Black (CPU)' : (match?.players?.find((p: any) => p.username !== myUsername)?.username ?? 'Opponent');

  // Multiplayer socket listeners
  useEffect(() => {
    if (solo) return;
    const offState = on('game:state', (data: any) => {
      setBoard(data.board);
      setIsRedTurn(data.isRedTurn);
      setGameStarted(true);
      const counts = countPieces(data.board);
      setRedCount(counts.red); setBlackCount(counts.black);
      setRedKings(counts.redKings); setBlackKings(counts.blackKings);
    });
    const offMove = on('game:move', (data: any) => {
      setBoard(data.board);
      setIsRedTurn(data.isRedTurn);
      setMustJumpFrom(data.mustJumpFrom || null);
      setRedCount(data.redCount);
      setBlackCount(data.blackCount);
      setLastMove({ from: data.from, to: data.to, mid: data.mid });
      setSelected(null);
      setValidMoves([]);
      const counts = countPieces(data.board);
      setRedKings(counts.redKings); setBlackKings(counts.blackKings);
      // Check for new king
      const movedPiece = data.board[data.to[0]][data.to[1]];
      if (movedPiece === RK || movedPiece === BK) {
        setNewKingPos(data.to);
        setTimeout(() => setNewKingPos(null), 1500);
      }
      setMoveLog(prev => [...prev, {
        from: coordLabel(data.from[0], data.from[1]),
        to: coordLabel(data.to[0], data.to[1]),
        capture: !!data.mid,
        promotion: movedPiece === RK || movedPiece === BK,
        by: data.isRedTurn ? 'black' : 'red', // turn flipped after move
      }]);
    });
    const offDraw = on('game:draw_offer', () => setDrawOfferReceived(true));
    const offDrawDeclined = on('game:draw_declined', () => { setDrawOffered(false); });
    const offOpDisc = on('opponent:disconnected', () => setOpponentDisconnected(true));
    const offEnded = on('match:ended', (data: any) => { setResult(data); if (timerRef.current) clearInterval(timerRef.current); });
    return () => { offState(); offMove(); offDraw(); offDrawDeclined(); offOpDisc(); offEnded(); };
  }, [on, solo, setResult]);

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
    if (!isMyTurn) return;
    const piece = board[r][c] as Piece;

    if (selected) {
      const isValid = validMoves.some(([vr, vc]) => vr === r && vc === c);
      if (isValid) {
        const [sr, sc] = selected;
        const jumps = getJumpsFrom(board, sr, sc, isRedTurn);
        const jump = jumps.find(j => j.to[0] === r && j.to[1] === c);
        const wasKing = isKing(board[sr][sc] as Piece);

        if (solo) {
          const newBoard = applyMoveLocal(board, [sr, sc], [r, c], jump?.mid);
          const movedPiece = newBoard[r][c] as Piece;
          const promoted = !wasKing && isKing(movedPiece);
          if (promoted) { setNewKingPos([r, c]); setTimeout(() => setNewKingPos(null), 1500); }
          setLastMove({ from: [sr, sc], to: [r, c], mid: jump?.mid });
          setMoveLog(prev => [...prev, {
            from: coordLabel(sr, sc), to: coordLabel(r, c),
            capture: !!jump, promotion: promoted, by: isRedTurn ? 'red' : 'black',
          }]);

          let nextMJF: [number,number] | null = null;
          if (jump && !promoted) {
            const further = getJumpsFrom(newBoard, r, c, isRedTurn);
            if (further.length > 0) nextMJF = [r, c];
          }

          const newIsRedTurn = nextMJF ? isRedTurn : !isRedTurn;
          setBoard(newBoard); setIsRedTurn(newIsRedTurn); setMustJumpFrom(nextMJF);
          setSelected(null); setValidMoves([]);
          const counts = countPieces(newBoard);
          setRedCount(counts.red); setBlackCount(counts.black);
          setRedKings(counts.redKings); setBlackKings(counts.blackKings);

          if (!nextMJF) {
            const nextJumps = getAllJumps(newBoard, newIsRedTurn);
            const nextMoves = getAllMovesCount(newBoard, newIsRedTurn);
            const noPieces = newIsRedTurn ? counts.red === 0 : counts.black === 0;
            if (noPieces || (nextJumps.length === 0 && nextMoves === 0))
              setSoloFinished(isRedTurn ? 'red' : 'black');
          }
        } else {
          emit('game:action', { type: 'move', from: [sr, sc], to: [r, c] });
        }
        return;
      }
      setSelected(null); setValidMoves([]);
      if (piece && isFriendly(piece, isRedTurn)) {
        const dests = computeValidDestinations(r, c, board, isRedTurn, mustJumpFrom);
        if (dests.length > 0) { setSelected([r, c]); setValidMoves(dests); }
      }
      return;
    }

    if (!piece || !isFriendly(piece, isRedTurn)) return;
    if (mustJumpFrom && (r !== mustJumpFrom[0] || c !== mustJumpFrom[1])) return;
    const dests = computeValidDestinations(r, c, board, isRedTurn, mustJumpFrom);
    if (dests.length === 0) return;
    setSelected([r, c]); setValidMoves(dests);
  }, [board, selected, validMoves, isRedTurn, isMyTurn, mustJumpFrom, emit, solo, computeValidDestinations]);

  const handleResign = () => {
    if (solo) { setSoloFinished(isRedTurn ? 'black' : 'red'); return; }
    emit('game:action', { type: 'resign' });
    setResigned(true);
  };

  const handleOfferDraw = () => {
    emit('game:action', { type: 'draw_offer' });
    setDrawOffered(true);
  };

  const handleDrawResponse = (accept: boolean) => {
    emit('game:action', { type: 'draw_response', accept });
    setDrawOfferReceived(false);
    if (accept) emit('game:action', { type: 'draw_accept' });
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const shouldFlip = myColor === 'black';
  const displayBoard = shouldFlip ? [...board].reverse().map(r => [...r].reverse()) : board;

  const turnColor = isRedTurn ? 'red' : 'black';
  const turnIsMe = isMyTurn;

  if (solo && soloFinished) {
    const won = soloFinished === 'red';
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-background p-6">
        <motion.div className="card p-10 text-center max-w-sm w-full" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="text-6xl mb-4">{won ? '👑' : '😤'}</div>
          <h2 className="text-3xl font-black text-gradient mb-2">{won ? 'You Win!' : 'You Lose!'}</h2>
          <p className="text-text-muted text-sm mb-2">Red: {redCount} · Black: {blackCount}</p>
          <p className="text-text-faint text-xs mb-8">{moveLog.length} moves · {formatTime(elapsed)}</p>
          <div className="flex gap-3">
            <button className="btn-secondary btn flex-1" onClick={() => {
              setBoard(createInitialBoard()); setIsRedTurn(true); setSelected(null);
              setValidMoves([]); setMustJumpFrom(null); setLastMove(null);
              setRedCount(12); setBlackCount(12); setRedKings(0); setBlackKings(0);
              setSoloFinished(null); setMoveLog([]); setElapsed(0); setNewKingPos(null);
            }}>Play Again</button>
            <button className="btn-ghost btn flex-1" onClick={onExit}>Back</button>
          </div>
        </motion.div>
      </div>
    );
  }

  const myScore = myColor === 'red' ? redCount : blackCount;
  const opScore = myColor === 'red' ? blackCount : redCount;

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-border px-4 py-3">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-text-faint text-sm">♟ Checkers{solo && <span className="ml-2 text-accent">(Solo)</span>}</span>
              <span className="text-text-faint text-xs">{formatTime(elapsed)}</span>
            </div>
            <div className="flex items-center gap-2">
              {!solo && !result && (
                <>
                  <button
                    onClick={handleOfferDraw}
                    disabled={drawOffered}
                    className="text-xs px-2 py-1 rounded bg-surface-2 border border-border text-text-muted hover:text-text disabled:opacity-40 transition-colors"
                  >
                    {drawOffered ? 'Draw offered...' : '½ Offer Draw'}
                  </button>
                  <button
                    onClick={handleResign}
                    className="text-xs px-2 py-1 rounded bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 transition-colors"
                  >
                    Resign
                  </button>
                </>
              )}
              {solo && (
                <button onClick={onExit} className="text-xs text-text-faint hover:text-text underline">Exit</button>
              )}
            </div>
          </div>

          {!solo && (
            <ScoreBar
              player1={{ username: myUsername, score: myScore }}
              player2={{ username: opUsername, score: opScore }}
              maxScore={12}
            />
          )}

          {/* Turn banner */}
          <motion.div
            key={String(isRedTurn)}
            className={`mt-2 text-center text-xs font-bold py-1 px-3 rounded-full w-fit mx-auto ${
              turnIsMe
                ? 'bg-success/20 text-success'
                : 'bg-surface-2 text-text-muted'
            }`}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {turnIsMe
              ? `Your turn${getAllJumps(board, isRedTurn).length > 0 ? ' — capture required!' : ''}`
              : `${solo ? (isRedTurn ? 'Red' : 'Black') : opUsername}'s turn`}
          </motion.div>
        </div>
      </div>

      {/* Draw offer received */}
      <AnimatePresence>
        {drawOfferReceived && (
          <motion.div
            className="bg-warning/10 border-b border-warning/30 px-4 py-2 flex items-center justify-center gap-4 text-sm"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <span className="text-warning font-semibold">{opUsername} offers a draw</span>
            <button onClick={() => handleDrawResponse(true)} className="btn-secondary btn text-xs py-1 px-3">Accept</button>
            <button onClick={() => handleDrawResponse(false)} className="btn-ghost btn text-xs py-1 px-3">Decline</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Opponent disconnected banner */}
      <AnimatePresence>
        {opponentDisconnected && (
          <motion.div
            className="bg-danger/10 border-b border-danger/30 px-4 py-2 text-center text-sm text-danger font-semibold"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
          >
            ⚠ Opponent disconnected — waiting for reconnect...
          </motion.div>
        )}
      </AnimatePresence>

      {/* King promotion flash */}
      <AnimatePresence>
        {newKingPos && (
          <motion.div
            className="fixed top-24 left-1/2 -translate-x-1/2 z-30 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 font-black text-lg px-6 py-3 rounded-full"
            initial={{ scale: 0.5, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -20 }}
          >
            👑 King!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main layout */}
      <div className="flex-1 flex items-start justify-center gap-4 p-4 md:p-6">
        {/* Board + piece trays */}
        <div className="flex flex-col items-center gap-3">
          {/* Opponent captured pieces tray */}
          <div className="flex items-center gap-1 h-6 flex-wrap justify-center">
            {Array.from({ length: 12 - (myColor === 'red' ? blackCount : redCount) }).map((_, i) => (
              <motion.div
                key={i}
                className={`w-4 h-4 rounded-full ${myColor === 'red' ? 'bg-gray-700 border border-gray-500' : 'bg-red-500 border border-red-300'}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.05 }}
              />
            ))}
          </div>
          <div className="text-xs text-text-faint text-center">{opUsername} — {myColor === 'red' ? blackCount : redCount} pieces{(myColor === 'red' ? blackKings : redKings) > 0 ? ` (${myColor === 'red' ? blackKings : redKings}♛)` : ''}</div>

          {/* Board */}
          <div
            className="grid border-2 border-border rounded-xl overflow-hidden shadow-2xl"
            style={{ gridTemplateColumns: 'repeat(8, 1fr)', width: 'min(480px, calc(100vw - 2rem))', aspectRatio: '1' }}
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
                const isCaptured = lastMove?.mid?.[0] === actualRow && lastMove?.mid?.[1] === actualCol;
                const hasJump = getAllJumps(board, isRedTurn).some(j => j.from[0] === actualRow && j.from[1] === actualCol);
                const isNewKing = newKingPos?.[0] === actualRow && newKingPos?.[1] === actualCol;
                const mustJumpPiece = isMyTurn && hasJump && getAllJumps(board, isRedTurn).length > 0;

                return (
                  <button
                    key={`${displayRow}-${displayCol}`}
                    onClick={() => handleSquareClick(actualRow, actualCol)}
                    className={`relative flex items-center justify-center transition-all duration-100 ${
                      isDark
                        ? isSelected
                          ? 'bg-primary/60'
                          : isLastFrom
                          ? 'bg-accent/25'
                          : isLastTo
                          ? 'bg-accent/35'
                          : isCaptured
                          ? 'bg-danger/25'
                          : 'bg-[#4a3728]'
                        : 'bg-[#f0d9b5]'
                    }`}
                    style={{ aspectRatio: '1' }}
                  >
                    {isValidDest && isDark && !piece && (
                      <div className="w-1/3 h-1/3 rounded-full bg-primary/70 pointer-events-none" />
                    )}
                    {isValidDest && isDark && piece !== EMPTY && (
                      <div className="absolute inset-1 rounded-full ring-2 ring-primary/80 pointer-events-none" />
                    )}

                    {piece !== EMPTY && (
                      <motion.div
                        className={`w-[75%] h-[75%] rounded-full flex items-center justify-center shadow-lg select-none
                          ${isRed(piece)
                            ? 'bg-gradient-to-br from-red-400 to-red-700 border-2 border-red-300'
                            : 'bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-gray-500'
                          } ${isSelected ? 'ring-2 ring-white/80' : ''} ${mustJumpPiece && !selected ? 'ring-2 ring-warning/70' : ''}`}
                        animate={isNewKing ? { scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] } : isSelected ? { scale: 1.1 } : { scale: 1 }}
                        transition={{ duration: isNewKing ? 0.5 : 0.1 }}
                      >
                        {isKing(piece) && <span className="text-yellow-300 text-xs leading-none">♛</span>}
                      </motion.div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* My piece tray */}
          <div className="text-xs text-text-faint text-center">{solo ? 'You (Red)' : myUsername} — {myColor === 'red' ? redCount : blackCount} pieces{(myColor === 'red' ? redKings : blackKings) > 0 ? ` (${myColor === 'red' ? redKings : blackKings}♛)` : ''}</div>
          <div className="flex items-center gap-1 h-6 flex-wrap justify-center">
            {Array.from({ length: 12 - (myColor === 'red' ? redCount : blackCount) }).map((_, i) => (
              <motion.div
                key={i}
                className={`w-4 h-4 rounded-full ${myColor === 'red' ? 'bg-red-500 border border-red-300' : 'bg-gray-700 border border-gray-500'}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.05 }}
              />
            ))}
          </div>
        </div>

        {/* Move log sidebar */}
        <div className="hidden lg:flex flex-col w-48 gap-2 mt-0">
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">Move Log</div>
          <div ref={logRef} className="flex-1 max-h-[440px] overflow-y-auto space-y-0.5 bg-surface rounded-lg border border-border p-2">
            {moveLog.length === 0 ? (
              <div className="text-xs text-text-faint text-center py-4">No moves yet</div>
            ) : moveLog.map((m, i) => (
              <div key={i} className={`flex items-center gap-1.5 text-xs py-0.5 px-1 rounded ${i === moveLog.length - 1 ? 'bg-primary/10' : ''}`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.by === 'red' ? 'bg-red-500' : 'bg-gray-500'}`} />
                <span className="text-text-faint font-mono">{Math.floor(i / 2) + 1}{m.by === 'red' ? '.' : '…'}</span>
                <span className="text-text">{m.from}→{m.to}</span>
                {m.capture && <span className="text-danger">✕</span>}
                {m.promotion && <span className="text-yellow-400">♛</span>}
              </div>
            ))}
          </div>

          {/* Piece summary */}
          <div className="bg-surface rounded-lg border border-border p-2 space-y-1 text-xs">
            <div className="flex justify-between text-text-muted">
              <span>🔴 Red</span>
              <span className="font-bold text-text">{redCount} {redKings > 0 ? `(${redKings}♛)` : ''}</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>⚫ Black</span>
              <span className="font-bold text-text">{blackCount} {blackKings > 0 ? `(${blackKings}♛)` : ''}</span>
            </div>
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
