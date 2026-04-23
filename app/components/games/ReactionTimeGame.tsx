'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ScoreBar from '../ui/ScoreBar';
import MatchResultModal from '../ui/MatchResultModal';
import { useGameStore } from '@/app/store/gameStore';
import { useAuthStore } from '@/app/store/authStore';
import { useRouter } from 'next/navigation';

interface ReactionTimeGameProps {
  match: any;
  emit: (event: string, data?: any) => void;
  on: (event: string, handler: (...args: any[]) => void) => () => void;
  solo?: boolean;
  onExit?: () => void;
}

type Phase = 'waiting' | 'ready' | 'signal' | 'clicked' | 'penalty';

const COLORS = [
  '#ef4444', '#f97316', '#dc2626', '#ea580c', '#fb923c', '#c2410c',
  '#f59e0b', '#eab308', '#84cc16', '#a3e635', '#ca8a04', '#65a30d',
  '#22c55e', '#10b981', '#059669', '#16a34a', '#34d399', '#4ade80',
  '#06b6d4', '#0ea5e9', '#22d3ee', '#0891b2', '#67e8f9', '#0284c7',
  '#3b82f6', '#2563eb', '#1d4ed8', '#60a5fa', '#3730a3', '#6366f1',
  '#8b5cf6', '#7c3aed', '#a855f7', '#9333ea', '#c084fc', '#7e22ce',
  '#ec4899', '#db2777', '#f43f5e', '#e11d48', '#f472b6', '#be185d',
  '#14b8a6', '#f0abfc', '#fbbf24', '#4f46e5', '#0f766e', '#b45309',
];

// Shuffle pool so colors never repeat consecutively and cycle through all before repeating
let colorPool: string[] = [];
let lastPicked = '';
function pickColor(): string {
  if (colorPool.length === 0) colorPool = [...COLORS].sort(() => Math.random() - 0.5);
  let c = colorPool.pop()!;
  if (c === lastPicked && colorPool.length > 0) { colorPool.unshift(c); c = colorPool.pop()!; }
  lastPicked = c;
  return c;
}
const MAX_ROUNDS_SOLO = 5;

export default function ReactionTimeGame({ match, emit, on, solo = false, onExit }: ReactionTimeGameProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { result, setResult, resetGame } = useGameStore();

  const [phase, setPhase] = useState<Phase>('waiting');
  const [round, setRound] = useState(0);
  const [maxRounds, setMaxRounds] = useState(solo ? MAX_ROUNDS_SOLO : 5);
  const [bgColor, setBgColor] = useState('#1a1a26');
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [lastRoundWinner, setLastRoundWinner] = useState<string | null>(null);
  const [penaltyMsg, setPenaltyMsg] = useState('');
  const [scores, setScores] = useState<{ username: string; score: number }[]>(
    solo
      ? [{ username: user?.username || 'You', score: 0 }]
      : (match?.players?.map((p: any) => ({ username: p.username, score: 0 })) || [])
  );
  const [soloFinished, setSoloFinished] = useState(false);
  const [soloReactionTimes, setSoloReactionTimes] = useState<number[]>([]);

  const clickedRef = useRef(false);
  const signalStartRef = useRef<number>(0);
  const signalActiveRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Solo game loop ──────────────────────────────────────────
  const soloStartRound = useCallback((currentRound: number) => {
    if (currentRound > MAX_ROUNDS_SOLO) return;
    setRound(currentRound);
    setPhase('ready');
    setBgColor('#1a1a26');
    setReactionTime(null);
    setLastRoundWinner(null);
    clickedRef.current = false;
    signalActiveRef.current = false;

    const delay = 1500 + Math.random() * 3500;
    timerRef.current = setTimeout(() => {
      const color = pickColor();
      // Set state first, then stamp the time inside rAF so the clock starts
      // only after the browser has actually painted the signal color.
      setPhase('signal');
      setBgColor(color);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          signalActiveRef.current = true;
          signalStartRef.current = Date.now();
        });
      });

      // Auto-miss after 3s
      timerRef.current = setTimeout(() => {
        if (!signalActiveRef.current) return;
        signalActiveRef.current = false;
        setPhase('clicked');
        setLastRoundWinner(null);
        setTimeout(() => {
          if (currentRound < MAX_ROUNDS_SOLO) soloStartRound(currentRound + 1);
          else setSoloFinished(true);
        }, 2000);
      }, 3000);
    }, delay);
  }, []);

  useEffect(() => {
    if (!solo) return;
    const t = setTimeout(() => soloStartRound(1), 1500);
    return () => { clearTimeout(t); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [solo, soloStartRound]);

  // ── Multiplayer socket listeners ────────────────────────────
  useEffect(() => {
    if (solo) return;

    const offState = on('game:state', (data: any) => { setMaxRounds(data.maxRounds); });
    const offRoundStart = on('game:round_start', (data: any) => {
      setRound(data.round); setPhase('ready'); setBgColor('#1a1a26');
      setReactionTime(null); setLastRoundWinner(null); clickedRef.current = false;
    });
    const offSignal = on('game:signal', (data: any) => {
      setPhase('signal');
      setBgColor(data.color);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          signalActiveRef.current = true;
          signalStartRef.current = Date.now();
        });
      });
    });
    const offRoundEnd = on('game:round_end', (data: any) => {
      setPhase('clicked');
      if (data.reactionTime) setReactionTime(data.reactionTime);
      if (data.winner) setLastRoundWinner(data.winner.username);
      else setLastRoundWinner(null);
      if (data.scores) setScores(data.scores);
    });
    const offPenalty = on('game:penalty', (data: any) => {
      setPhase('penalty'); setPenaltyMsg(data.message);
      if (data.scores) setScores(data.scores);
      setTimeout(() => setPhase('ready'), 1500);
    });
    const offEnded = on('match:ended', (data: any) => { setResult(data); });

    return () => { offState(); offRoundStart(); offSignal(); offRoundEnd(); offPenalty(); offEnded(); };
  }, [on, solo]);

  const handleClick = useCallback(() => {
    if (solo) {
      if (!signalActiveRef.current) {
        // early click
        if (timerRef.current) clearTimeout(timerRef.current);
        signalActiveRef.current = false;
        setPhase('penalty');
        setPenaltyMsg('Too early! No point.');
        setTimeout(() => {
          const nextRound = round + 1;
          if (nextRound <= MAX_ROUNDS_SOLO) soloStartRound(nextRound);
          else setSoloFinished(true);
        }, 1500);
        return;
      }
      if (clickedRef.current) return;
      clickedRef.current = true;
      signalActiveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);

      const rt = Date.now() - signalStartRef.current;
      setReactionTime(rt);
      setLastRoundWinner(user?.username || 'You');
      setSoloReactionTimes((prev) => [...prev, rt]);
      setBestTime((prev) => (prev === null || rt < prev ? rt : prev));
      setScores((prev) => prev.map((s) => ({ ...s, score: s.score + 1 })));
      setPhase('clicked');

      setTimeout(() => {
        const nextRound = round + 1;
        if (nextRound <= MAX_ROUNDS_SOLO) soloStartRound(nextRound);
        else setSoloFinished(true);
      }, 1800);
      return;
    }

    if (clickedRef.current) return;
    clickedRef.current = true;
    emit('game:action', { type: 'click' });
  }, [emit, solo, round, soloStartRound, user?.username]);

  const myScore = scores.find((s) => s.username === user?.username)?.score ?? 0;
  const opScore = scores.find((s) => s.username !== user?.username)?.score ?? 0;
  const opUsername = scores.find((s) => s.username !== user?.username)?.username ?? 'Opponent';
  const avgReaction = soloReactionTimes.length
    ? Math.round(soloReactionTimes.reduce((a, b) => a + b, 0) / soloReactionTimes.length)
    : null;

  // Solo finished screen
  if (solo && soloFinished) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-background p-6">
        <motion.div className="card p-10 text-center max-w-sm w-full" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="text-6xl mb-4">⚡</div>
          <h2 className="text-3xl font-black text-gradient mb-6">Practice Complete!</h2>
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="stat-box text-center">
              <div className="text-2xl font-black text-success">{myScore}</div>
              <div className="text-xs text-text-faint">Hits</div>
            </div>
            <div className="stat-box text-center">
              <div className="text-2xl font-black text-accent">{avgReaction ?? '—'}<span className="text-sm">ms</span></div>
              <div className="text-xs text-text-faint">Avg</div>
            </div>
            <div className="stat-box text-center">
              <div className="text-2xl font-black text-primary">{bestTime ?? '—'}<span className="text-sm">ms</span></div>
              <div className="text-xs text-text-faint">Best</div>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary btn flex-1" onClick={() => { setSoloFinished(false); setScores([{ username: user?.username || 'You', score: 0 }]); setSoloReactionTimes([]); setBestTime(null); soloStartRound(1); }}>
              Play Again
            </button>
            <button className="btn-ghost btn flex-1" onClick={onExit}>Back</button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <div className="bg-surface border-b border-border px-6 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-text-faint text-sm">⚡ Reaction Time · Round {round}/{maxRounds}{solo && <span className="ml-2 text-accent">(Solo)</span>}</span>
            {solo && <button onClick={onExit} className="text-xs text-text-faint hover:text-text underline">Exit</button>}
          </div>
          {solo ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-text-muted">{user?.username || 'You'}</span>
              <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden">
                <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${(myScore / maxRounds) * 100}%` }} />
              </div>
              <span className="text-xl font-black text-primary">{myScore}</span>
            </div>
          ) : (
            <ScoreBar
              player1={{ username: user?.username || 'You', score: myScore }}
              player2={{ username: opUsername, score: opScore }}
              maxScore={maxRounds}
            />
          )}
        </div>
      </div>

      {/* Game area */}
      <div
        className="flex-1 flex items-center justify-center cursor-pointer select-none"
        style={{ backgroundColor: bgColor }}
        onClick={handleClick}
      >
        <AnimatePresence mode="wait">
          {phase === 'waiting' && (
            <motion.div
              key="waiting"
              className="text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-6xl mb-4">⚡</div>
              <p className="text-text-muted text-xl">Get ready...</p>
            </motion.div>
          )}

          {phase === 'ready' && (
            <motion.div
              key="ready"
              className="text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="text-8xl font-black text-text-faint mb-4">WAIT</div>
              <p className="text-text-muted text-lg">Don't click yet...</p>
            </motion.div>
          )}

          {phase === 'signal' && (
            <motion.div
              key="signal"
              className="text-center signal-flash"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.05 }}
            >
              <div className="text-8xl font-black text-white drop-shadow-2xl mb-4">CLICK!</div>
              <p className="text-white/70 text-xl">GO! GO! GO!</p>
            </motion.div>
          )}

          {phase === 'clicked' && (
            <motion.div
              key="clicked"
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {lastRoundWinner ? (
                <>
                  <div className="text-6xl mb-4">
                    {lastRoundWinner === user?.username ? '🏆' : '😤'}
                  </div>
                  <h3 className="text-2xl font-black text-text mb-2">
                    {lastRoundWinner === user?.username ? 'You win the round!' : `${lastRoundWinner} wins!`}
                  </h3>
                  {reactionTime && (
                    <p className="text-text-muted">
                      Reaction time:{' '}
                      <span className="text-primary font-bold">{reactionTime}ms</span>
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="text-6xl mb-4">⏰</div>
                  <h3 className="text-2xl font-black text-text-muted">No one clicked!</h3>
                </>
              )}
              <p className="text-text-faint text-sm mt-4">Next round starting...</p>
            </motion.div>
          )}

          {phase === 'penalty' && (
            <motion.div
              key="penalty"
              className="text-center"
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-2xl font-black text-danger">{penaltyMsg}</h3>
              <p className="text-text-muted mt-2">Too early!</p>
            </motion.div>
          )}
        </AnimatePresence>
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
