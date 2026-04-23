'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ScoreBar from '../ui/ScoreBar';
import MatchResultModal from '../ui/MatchResultModal';
import { useGameStore } from '@/app/store/gameStore';
import { useAuthStore } from '@/app/store/authStore';
import { useRouter } from 'next/navigation';

interface Tile {
  id: number;
  value?: string;
  flipped: boolean;
  matched: boolean;
  matchedByMe?: boolean;
}

const EMOJIS = ['🎮', '🎯', '🏆', '⚡', '🔥', '💎', '🚀', '🌟'];

function generateSoloBoard(): Tile[] {
  const pairs = [...EMOJIS, ...EMOJIS];
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs.map((value, id) => ({ id, value, flipped: false, matched: false }));
}

export default function MemoryTilesGame({ match, emit, on, solo = false, onExit }: any) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { result, setResult, resetGame } = useGameStore();

  const [tiles, setTiles] = useState<Tile[]>([]);
  const [scores, setScores] = useState<{ username: string; score: number }[]>(
    solo ? [{ username: user?.username || 'You', score: 0 }]
         : (match?.players?.map((p: any) => ({ username: p.username, score: 0 })) || [])
  );
  const [lastMatch, setLastMatch] = useState<{ value: string; byMe: boolean } | null>(null);
  const [soloFinished, setSoloFinished] = useState(false);
  const [soloMoves, setSoloMoves] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Solo: track two flipped tiles
  const flippedRef = useRef<number[]>([]);
  const lockRef = useRef(false);
  const movesRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Solo timer
  useEffect(() => {
    if (!solo || soloFinished || !startTime) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 500);
    return () => clearInterval(t);
  }, [solo, soloFinished, startTime]);

  // Init solo board
  useEffect(() => {
    if (!solo) return;
    setTiles(generateSoloBoard());
    setStartTime(Date.now());
  }, [solo]);

  // Multiplayer socket listeners
  useEffect(() => {
    if (solo) return;
    const offState = on('game:state', (data: any) => {
      setTiles(data.board.map((t: any) => ({ ...t, value: undefined })));
    });
    const offFlip = on('game:tile_flip', (data: any) => {
      setTiles((prev) => prev.map((t) => t.id === data.tileId ? { ...t, flipped: true, value: data.value } : t));
    });
    const offMatch = on('game:match_found', (data: any) => {
      const byMe = data.matchedBy.username === user?.username;
      setTiles((prev) => prev.map((t) => data.tileIds.includes(t.id) ? { ...t, matched: true, matchedByMe: byMe } : t));
      setLastMatch({ value: data.value, byMe });
      if (data.scores) setScores(data.scores);
      setTimeout(() => setLastMatch(null), 1500);
    });
    const offNoMatch = on('game:no_match', (data: any) => {
      setTimeout(() => {
        setTiles((prev) => prev.map((t) => data.tileIds.includes(t.id) ? { ...t, flipped: false, value: undefined } : t));
      }, 100);
    });
    const offEnded = on('match:ended', (data: any) => setResult(data));
    return () => { offState(); offFlip(); offMatch(); offNoMatch(); offEnded(); };
  }, [on, solo, user?.username]);

  const handleTileClick = useCallback((tile: Tile) => {
    if (tile.flipped || tile.matched) return;

    if (solo) {
      if (lockRef.current) return;
      if (flippedRef.current.includes(tile.id)) return;

      // Flip the tile
      setTiles((prev) => prev.map((t) => t.id === tile.id ? { ...t, flipped: true } : t));
      flippedRef.current = [...flippedRef.current, tile.id];

      if (flippedRef.current.length === 2) {
        lockRef.current = true;
        movesRef.current++;
        setSoloMoves(movesRef.current);

        const [id1, id2] = flippedRef.current;
        setTiles((prev) => {
          const t1 = prev.find((t) => t.id === id1)!;
          const t2 = prev.find((t) => t.id === id2)!;
          const isMatch = t1.value === t2.value;

          if (isMatch) {
            const next = prev.map((t) =>
              t.id === id1 || t.id === id2 ? { ...t, matched: true, matchedByMe: true } : t
            );
            setLastMatch({ value: t1.value!, byMe: true });
            setTimeout(() => setLastMatch(null), 1200);
            setScores([{ username: user?.username || 'You', score: next.filter((t) => t.matched).length / 2 }]);
            flippedRef.current = [];
            lockRef.current = false;
            if (next.every((t) => t.matched)) setSoloFinished(true);
            return next;
          } else {
            timerRef.current = setTimeout(() => {
              setTiles((p) => p.map((t) =>
                t.id === id1 || t.id === id2 ? { ...t, flipped: false } : t
              ));
              flippedRef.current = [];
              lockRef.current = false;
            }, 900);
            return prev;
          }
        });
      }
      return;
    }

    emit('game:action', { type: 'flip', tileId: tile.id });
  }, [emit, solo, user?.username]);

  const myScore = scores.find((s) => s.username === user?.username)?.score ?? 0;
  const opScore = scores.find((s) => s.username !== user?.username)?.score ?? 0;
  const opUsername = scores.find((s) => s.username !== user?.username)?.username ?? 'Opponent';
  const totalPairs = 8;
  const matchedPairs = solo
    ? tiles.filter((t) => t.matched).length / 2
    : tiles.filter((t) => t.matched && t.id % 2 === 0).length;

  if (solo && soloFinished) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-background p-6">
        <motion.div className="card p-10 text-center max-w-sm w-full" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="text-6xl mb-4">🃏</div>
          <h2 className="text-3xl font-black text-gradient mb-6">Board Cleared!</h2>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="stat-box text-center">
              <div className="text-3xl font-black text-primary">{soloMoves}</div>
              <div className="text-xs text-text-faint">Moves</div>
            </div>
            <div className="stat-box text-center">
              <div className="text-3xl font-black text-accent">{elapsed}s</div>
              <div className="text-xs text-text-faint">Time</div>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary btn flex-1" onClick={() => {
              setSoloFinished(false); setSoloMoves(0); movesRef.current = 0;
              flippedRef.current = []; lockRef.current = false;
              setScores([{ username: user?.username || 'You', score: 0 }]);
              setTiles(generateSoloBoard()); setStartTime(Date.now()); setElapsed(0);
            }}>Play Again</button>
            <button className="btn-ghost btn flex-1" onClick={onExit}>Back</button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-border px-6 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-text-faint text-sm">🃏 Memory Tiles · {matchedPairs}/{totalPairs} pairs{solo && <span className="ml-2 text-accent">(Solo)</span>}</span>
            {solo && (
              <div className="flex items-center gap-4">
                <span className="text-text-faint text-sm">{elapsed}s · {soloMoves} moves</span>
                <button onClick={onExit} className="text-xs text-text-faint hover:text-text underline">Exit</button>
              </div>
            )}
          </div>
          {!solo && (
            <ScoreBar
              player1={{ username: user?.username || 'You', score: myScore }}
              player2={{ username: opUsername, score: opScore }}
              maxScore={totalPairs}
            />
          )}
        </div>
      </div>

      {/* Match notification */}
      <AnimatePresence>
        {lastMatch && (
          <motion.div
            className={`mx-auto mt-4 px-6 py-3 rounded-full text-sm font-bold ${
              lastMatch.byMe ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
            }`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {solo ? `✓ Matched ${lastMatch.value}!` : lastMatch.byMe ? `🏆 You matched ${lastMatch.value}!` : `😤 ${opUsername} matched ${lastMatch.value}!`}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Board */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        {tiles.length === 0 ? (
          <div className="text-center">
            <div className="text-6xl mb-4">🃏</div>
            <p className="text-text-muted">Loading board...</p>
          </div>
        ) : (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', maxWidth: '480px', width: '100%' }}
          >
            {tiles.map((tile) => (
              <motion.button
                key={tile.id}
                onClick={() => handleTileClick(tile)}
                className={`aspect-square rounded-xl text-2xl md:text-3xl font-black flex items-center justify-center
                  relative overflow-hidden transition-all duration-200 ${
                    tile.matched
                      ? tile.matchedByMe || solo
                        ? 'bg-success/20 border-2 border-success cursor-default'
                        : 'bg-danger/20 border-2 border-danger cursor-default'
                      : tile.flipped
                        ? 'bg-primary/20 border-2 border-primary cursor-default'
                        : 'bg-surface-2 border border-border hover:border-primary/50 hover:bg-surface-3 cursor-pointer'
                  }`}
                whileTap={!tile.flipped && !tile.matched ? { scale: 0.93 } : {}}
              >
                <AnimatePresence mode="wait">
                  {tile.flipped || tile.matched ? (
                    <motion.span
                      key="revealed"
                      initial={{ rotateY: 90, opacity: 0 }}
                      animate={{ rotateY: 0, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      {tile.value}
                    </motion.span>
                  ) : (
                    <motion.span
                      key="hidden"
                      className="text-text-faint text-lg"
                      exit={{ rotateY: -90, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      ?
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            ))}
          </div>
        )}
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
