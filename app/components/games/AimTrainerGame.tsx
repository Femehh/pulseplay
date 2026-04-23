'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ScoreBar from '../ui/ScoreBar';
import MatchResultModal from '../ui/MatchResultModal';
import { useGameStore } from '@/app/store/gameStore';
import { useAuthStore } from '@/app/store/authStore';
import { useRouter } from 'next/navigation';

interface Target {
  id: string;
  x: number;
  y: number;
  radius: number;
  spawnedAt?: number;
}

const CANVAS_W = 800;
const CANVAS_H = 500;
const TARGET_RADIUS_SOLO = 35;
const SOLO_DURATION = 30;
const SOLO_SPAWN_INTERVAL = 800;
const SOLO_MAX_TARGETS = 5;
const SOLO_TARGET_LIFESPAN = 2500;

function genSoloTarget() {
  const m = TARGET_RADIUS_SOLO + 10;
  return {
    id: Math.random().toString(36).slice(2, 10),
    x: m + Math.random() * (CANVAS_W - m * 2),
    y: m + Math.random() * (CANVAS_H - m * 2),
    radius: TARGET_RADIUS_SOLO,
    spawnedAt: Date.now(),
  };
}

export default function AimTrainerGame({ match, emit, on, solo = false, onExit }: any) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { result, setResult, resetGame } = useGameStore();

  const [targets, setTargets] = useState<Target[]>([]);
  const [timeLeft, setTimeLeft] = useState(SOLO_DURATION);
  const [started, setStarted] = useState(false);
  const [scores, setScores] = useState<{ username: string; score: number }[]>(
    solo ? [{ username: user?.username || 'You', score: 0 }]
         : (match?.players?.map((p: any) => ({ username: p.username, score: 0 })) || [])
  );
  const [hitEffect, setHitEffect] = useState<{ x: number; y: number; id: string } | null>(null);
  const [soloFinished, setSoloFinished] = useState(false);
  const [soloHits, setSoloHits] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const spawnRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const soloHitsRef = useRef(0);

  // Solo game loop
  useEffect(() => {
    if (!solo) return;
    setStarted(true);
    setTimeLeft(SOLO_DURATION);

    spawnRef.current = setInterval(() => {
      setTargets((prev) => {
        const now = Date.now();
        const fresh = prev.filter((t) => now - (t.spawnedAt ?? now) < SOLO_TARGET_LIFESPAN);
        if (fresh.length >= SOLO_MAX_TARGETS) return fresh;
        const t = genSoloTarget();
        setTimeout(() => setTargets((p) => p.filter((x) => x.id !== t.id)), SOLO_TARGET_LIFESPAN);
        return [...fresh, t];
      });
    }, SOLO_SPAWN_INTERVAL);

    countdownRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(spawnRef.current!);
          clearInterval(countdownRef.current!);
          setTargets([]);
          setSoloFinished(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => { clearInterval(spawnRef.current!); clearInterval(countdownRef.current!); };
  }, [solo]);

  // Multiplayer socket listeners
  useEffect(() => {
    if (solo) return;
    let timer: NodeJS.Timeout;
    const offState = on('game:state', (data: any) => {
      setStarted(true); setTimeLeft(30);
      timer = setInterval(() => { setTimeLeft((t) => { if (t <= 1) { clearInterval(timer); return 0; } return t - 1; }); }, 1000);
    });
    const offSpawn = on('game:target_spawn', (data: any) => { setTargets((prev) => [...prev, data.target]); });
    const offExpire = on('game:target_expire', ({ targetId }: any) => { setTargets((prev) => prev.filter((t) => t.id !== targetId)); });
    const offHit = on('game:hit', (data: any) => { setTargets((prev) => prev.filter((t) => t.id !== data.targetId)); if (data.scores) setScores(data.scores); });
    const offEnded = on('match:ended', (data: any) => setResult(data));
    return () => { offState(); offSpawn(); offExpire(); offHit(); offEnded(); clearInterval(timer); };
  }, [on, solo]);

  const handleTargetClick = useCallback((e: React.MouseEvent, target: Target) => {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const effectX = (target.x / CANVAS_W) * rect.width;
    const effectY = (target.y / CANVAS_H) * rect.height;
    setHitEffect({ x: effectX, y: effectY, id: target.id });
    setTimeout(() => setHitEffect(null), 300);

    if (solo) {
      setTargets((prev) => prev.filter((t) => t.id !== target.id));
      soloHitsRef.current++;
      setSoloHits(soloHitsRef.current);
      setScores([{ username: user?.username || 'You', score: soloHitsRef.current }]);
      return;
    }

    emit('game:action', { type: 'hit', targetId: target.id, x: Math.round(x), y: Math.round(y) });
  }, [emit, solo, user?.username]);

  const myScore = scores.find((s) => s.username === user?.username)?.score ?? soloHits;
  const opScore = scores.find((s) => s.username !== user?.username)?.score ?? 0;
  const opUsername = scores.find((s) => s.username !== user?.username)?.username ?? 'Opponent';
  const timeColor = timeLeft <= 5 ? 'text-danger' : timeLeft <= 10 ? 'text-warning' : 'text-text';

  if (solo && soloFinished) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-background p-6">
        <motion.div className="card p-10 text-center max-w-sm w-full" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="text-6xl mb-4">🎯</div>
          <h2 className="text-3xl font-black text-gradient mb-2">Time's Up!</h2>
          <div className="text-6xl font-black text-primary my-6">{soloHits}</div>
          <p className="text-text-muted mb-8">targets hit in {SOLO_DURATION} seconds</p>
          <div className="flex gap-3">
            <button className="btn-secondary btn flex-1" onClick={() => { setSoloFinished(false); setSoloHits(0); soloHitsRef.current = 0; setScores([{ username: user?.username || 'You', score: 0 }]); }}>Play Again</button>
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
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-text-faint text-sm">🎯 Aim Trainer{solo && <span className="ml-2 text-accent">(Solo)</span>}</span>
            <div className="flex items-center gap-4">
              {solo && <span className="text-lg font-black text-primary">{soloHits} hits</span>}
              <span className={`text-2xl font-black ${timeColor} tabular-nums`}>{timeLeft}s</span>
              {solo && <button onClick={onExit} className="text-xs text-text-faint hover:text-text underline">Exit</button>}
            </div>
          </div>
          {!solo && (
            <ScoreBar
              player1={{ username: user?.username || 'You', score: myScore }}
              player2={{ username: opUsername, score: opScore }}
              maxScore={30}
            />
          )}
        </div>
      </div>

      {/* Game canvas */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div
          ref={canvasRef}
          className="relative w-full bg-surface-2 border border-border rounded-2xl overflow-hidden cursor-crosshair"
          style={{ maxWidth: CANVAS_W, aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
        >
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {!started && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">🎯</div>
                <p className="text-text-muted text-xl">Starting...</p>
              </div>
            </div>
          )}

          {/* Targets */}
          {targets.map((target) => {
            const pct = { x: (target.x / CANVAS_W) * 100, y: (target.y / CANVAS_H) * 100 };
            const rPct = (target.radius / CANVAS_W) * 100;

            return (
              <motion.button
                key={target.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 rounded-full target-pulse"
                style={{
                  left: `${pct.x}%`,
                  top: `${pct.y}%`,
                  width: `${rPct * 2}%`,
                  aspectRatio: '1',
                  background: 'radial-gradient(circle at 40% 35%, #ef4444, #b91c1c)',
                  boxShadow: '0 0 20px rgba(239,68,68,0.5)',
                  border: '3px solid rgba(255,255,255,0.3)',
                }}
                onClick={(e) => handleTargetClick(e, target)}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.85 }}
              >
                <div className="absolute inset-0 flex items-center justify-center text-white/50 text-xs font-bold">
                  +1
                </div>
              </motion.button>
            );
          })}

          {/* Hit effect */}
          <AnimatePresence>
            {hitEffect && (
              <motion.div
                key={hitEffect.id}
                className="absolute pointer-events-none text-success text-lg font-black"
                style={{ left: hitEffect.x, top: hitEffect.y }}
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ opacity: 0, y: -30, scale: 1.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                +1
              </motion.div>
            )}
          </AnimatePresence>
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
