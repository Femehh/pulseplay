'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/app/store/gameStore';
import { useAuthStore } from '@/app/store/authStore';
import { useRouter } from 'next/navigation';
import MatchResultModal from '../ui/MatchResultModal';
import ScoreBar from '../ui/ScoreBar';

interface HSL { h: number; s: number; l: number }

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function colorScore(target: HSL, guess: HSL): number {
  const hueDiff = Math.min(Math.abs(target.h - guess.h), 360 - Math.abs(target.h - guess.h));
  const satDiff = Math.abs(target.s - guess.s);
  const lightDiff = Math.abs(target.l - guess.l);
  const distance = (hueDiff / 180) * 60 + (satDiff / 100) * 20 + (lightDiff / 100) * 20;
  return Math.max(0, Math.round(100 - distance));
}

// ─── Vertical hue strip ────────────────────────────────────────────────────────
function HueStrip({ hue, onChange }: { hue: number; onChange: (h: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const pick = useCallback((clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    onChange(Math.round(pct * 359));
  }, [onChange]);

  return (
    <div
      ref={ref}
      className="relative w-full h-full rounded-lg cursor-crosshair select-none"
      style={{
        background: 'linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
        minWidth: 28,
      }}
      onMouseDown={(e) => { dragging.current = true; pick(e.clientY); }}
      onMouseMove={(e) => { if (dragging.current) pick(e.clientY); }}
      onMouseUp={() => { dragging.current = false; }}
      onMouseLeave={() => { dragging.current = false; }}
      onTouchStart={(e) => { dragging.current = true; pick(e.touches[0].clientY); }}
      onTouchMove={(e) => { if (dragging.current) pick(e.touches[0].clientY); }}
      onTouchEnd={() => { dragging.current = false; }}
    >
      {/* pointer — horizontal bar across the strip */}
      <div
        className="absolute left-0 right-0 pointer-events-none flex items-center"
        style={{ top: `${(hue / 359) * 100}%`, transform: 'translateY(-50%)' }}
      >
        <div className="w-full h-0.5 bg-white shadow" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.4)' }} />
      </div>
    </div>
  );
}

// ─── 2-D SL square (saturation x lightness) ───────────────────────────────────
function SLSquare({ hue, s, l, onChange }: { hue: number; s: number; l: number; onChange: (s: number, l: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const pick = useCallback((clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    // x = saturation 0→100, y = lightness 100→0 (top is bright)
    const newS = Math.round(px * 100);
    const newL = Math.round((1 - py) * 90 + 5); // keep 5-95 range
    onChange(newS, newL);
  }, [onChange]);

  const dotX = `${s}%`;
  const dotY = `${((95 - l) / 90) * 100}%`;

  return (
    <div
      ref={ref}
      className="relative w-full h-full rounded-lg cursor-crosshair select-none overflow-hidden"
      onMouseDown={(e) => { dragging.current = true; pick(e.clientX, e.clientY); }}
      onMouseMove={(e) => { if (dragging.current) pick(e.clientX, e.clientY); }}
      onMouseUp={() => { dragging.current = false; }}
      onMouseLeave={() => { dragging.current = false; }}
      onTouchStart={(e) => { dragging.current = true; pick(e.touches[0].clientX, e.touches[0].clientY); }}
      onTouchMove={(e) => { if (dragging.current) pick(e.touches[0].clientX, e.touches[0].clientY); }}
      onTouchEnd={() => { dragging.current = false; }}
    >
      {/* base hue */}
      <div className="absolute inset-0" style={{ backgroundColor: `hsl(${hue},100%,50%)` }} />
      {/* white overlay (saturation) */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #fff 0%, transparent 100%)' }} />
      {/* black overlay (lightness) */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 0%, #000 100%)' }} />

      {/* pointer dot */}
      <div
        className="absolute w-5 h-5 rounded-full border-2 border-white shadow-lg pointer-events-none"
        style={{
          left: dotX,
          top: dotY,
          transform: 'translate(-50%, -50%)',
          backgroundColor: hslToHex(hue, s, l),
          boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.5)',
        }}
      />
    </div>
  );
}

// ─── The combined picker panel ─────────────────────────────────────────────────
function ColorPicker({ value, onChange }: { value: HSL; onChange: (v: HSL) => void }) {
  return (
    <div className="flex gap-2 w-full" style={{ height: 200 }}>
      <HueStrip hue={value.h} onChange={(h) => onChange({ ...value, h })} />
      <SLSquare
        hue={value.h}
        s={value.s}
        l={value.l}
        onChange={(s, l) => onChange({ ...value, s, l })}
      />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Phase = 'waiting' | 'showing' | 'guessing' | 'result';

interface RoundResult {
  username: string;
  roundScore: number;
  totalScore: number;
  guess: HSL | null;
}

const MAX_ROUNDS_SOLO = 5;
const SHOW_MS = 3000;
const GUESS_MS = 15000;

function randomHSL(): HSL {
  return {
    h: Math.floor(Math.random() * 360),
    s: 30 + Math.floor(Math.random() * 60),
    l: 30 + Math.floor(Math.random() * 40),
  };
}

export default function ColorMatchGame({ match, emit, on, solo = false, onExit }: any) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { result, setResult, resetGame } = useGameStore();

  const [phase, setPhase] = useState<Phase>('waiting');
  const [round, setRound] = useState(0);
  const [maxRounds] = useState(solo ? MAX_ROUNDS_SOLO : 5);
  const [targetColor, setTargetColor] = useState<HSL | null>(null);
  const [guess, setGuess] = useState<HSL>({ h: 180, s: 50, l: 50 });
  const [timeLeft, setTimeLeft] = useState(GUESS_MS / 1000);
  const [submitted, setSubmitted] = useState(false);
  const [myRoundScore, setMyRoundScore] = useState<number | null>(null);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [scores, setScores] = useState<{ username: string; score: number }[]>(
    solo ? [{ username: user?.username || 'You', score: 0 }]
         : (match?.players?.map((p: any) => ({ username: p.username, score: 0 })) || [])
  );
  const [soloFinished, setSoloFinished] = useState(false);
  const [showTimeLeft, setShowTimeLeft] = useState(SHOW_MS / 1000);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentRound = useRef(0);
  const totalSoloScore = useRef(0);
  const guessRef = useRef<HSL>(guess);
  useEffect(() => { guessRef.current = guess; }, [guess]);

  // ── Solo game loop ─────────────────────────────────────────────────────────
  const soloStartRound = useCallback((r: number) => {
    if (r > MAX_ROUNDS_SOLO) { setSoloFinished(true); return; }
    currentRound.current = r;
    const color = randomHSL();
    setTargetColor(color);
    setRound(r);
    setPhase('showing');
    setSubmitted(false);
    setMyRoundScore(null);
    setGuess({ h: 180, s: 50, l: 50 });
    setShowTimeLeft(Math.ceil(SHOW_MS / 1000));

    let showSecs = Math.ceil(SHOW_MS / 1000);
    intervalRef.current = setInterval(() => {
      showSecs--;
      setShowTimeLeft(showSecs);
      if (showSecs <= 0) clearInterval(intervalRef.current!);
    }, 1000);

    timerRef.current = setTimeout(() => {
      clearInterval(intervalRef.current!);
      setPhase('guessing');
      setTimeLeft(GUESS_MS / 1000);

      let guessSecs = GUESS_MS / 1000;
      intervalRef.current = setInterval(() => {
        guessSecs--;
        setTimeLeft(guessSecs);
        if (guessSecs <= 0) {
          clearInterval(intervalRef.current!);
          // auto submit using latest guess via ref
          const g = guessRef.current;
          const sc = colorScore(color, g);
          totalSoloScore.current += sc;
          setMyRoundScore(sc);
          setScores([{ username: user?.username || 'You', score: totalSoloScore.current }]);
          setPhase('result');
          setTimeout(() => soloStartRound(r + 1), 3500);
        }
      }, 1000);
    }, SHOW_MS);
  }, [user?.username]);

  const soloSubmit = useCallback(() => {
    if (submitted || !targetColor) return;
    setSubmitted(true);
    clearInterval(intervalRef.current!);
    clearTimeout(timerRef.current!);
    const sc = colorScore(targetColor, guessRef.current);
    totalSoloScore.current += sc;
    setMyRoundScore(sc);
    setScores([{ username: user?.username || 'You', score: totalSoloScore.current }]);
    setPhase('result');
    setTimeout(() => soloStartRound(currentRound.current + 1), 3500);
  }, [submitted, targetColor, soloStartRound, user?.username]);

  useEffect(() => {
    if (!solo) return;
    const t = setTimeout(() => soloStartRound(1), 800);
    return () => { clearTimeout(t); clearTimeout(timerRef.current!); clearInterval(intervalRef.current!); };
  }, [solo, soloStartRound]);

  // ── Multiplayer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (solo) return;
    const offState = on('game:state', () => {});
    const offShow = on('game:color_show', (data: any) => {
      setRound(data.round);
      setTargetColor(data.color);
      setPhase('showing');
      setSubmitted(false);
      setMyRoundScore(null);
      setGuess({ h: 180, s: 50, l: 50 });
      let s = Math.ceil(data.showDuration / 1000);
      setShowTimeLeft(s);
      intervalRef.current = setInterval(() => { s--; setShowTimeLeft(s); if (s <= 0) clearInterval(intervalRef.current!); }, 1000);
    });
    const offHide = on('game:color_hide', (data: any) => {
      clearInterval(intervalRef.current!);
      setPhase('guessing');
      let g = Math.ceil(data.guessDuration / 1000);
      setTimeLeft(g);
      intervalRef.current = setInterval(() => { g--; setTimeLeft(g); if (g <= 0) clearInterval(intervalRef.current!); }, 1000);
    });
    const offAck = on('game:guess_ack', (data: any) => { setMyRoundScore(data.score); setSubmitted(true); });
    const offResult = on('game:round_result', (data: any) => {
      clearInterval(intervalRef.current!);
      setPhase('result');
      setTargetColor(data.target);
      setRoundResults(data.results);
      if (data.scores) setScores(data.scores);
    });
    const offEnded = on('match:ended', (data: any) => setResult(data));
    return () => { offState(); offShow(); offHide(); offAck(); offResult(); offEnded(); clearInterval(intervalRef.current!); };
  }, [on, solo]);

  const handleSubmit = useCallback(() => {
    if (submitted) return;
    if (solo) { soloSubmit(); return; }
    setSubmitted(true);
    clearInterval(intervalRef.current!);
    emit('game:action', { type: 'color_guess', ...guessRef.current });
  }, [submitted, solo, soloSubmit, emit]);

  const guessHex = hslToHex(guess.h, guess.s, guess.l);
  const targetHex = targetColor ? hslToHex(targetColor.h, targetColor.s, targetColor.l) : '#1a1a26';
  const myScore = scores.find((s) => s.username === user?.username)?.score ?? 0;
  const opScore = scores.find((s) => s.username !== user?.username)?.score ?? 0;
  const opUsername = scores.find((s) => s.username !== user?.username)?.username ?? 'Opponent';
  const maxPossible = maxRounds * 100;

  // Solo finished
  if (solo && soloFinished) {
    const pct = Math.round((totalSoloScore.current / maxPossible) * 100);
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-background p-6">
        <motion.div className="card p-10 text-center max-w-sm w-full" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="text-6xl mb-4">🎨</div>
          <h2 className="text-3xl font-black text-gradient mb-2">Practice Complete!</h2>
          <div className="text-5xl font-black text-primary my-4">
            {totalSoloScore.current}<span className="text-lg text-text-faint">/{maxPossible}</span>
          </div>
          <div className="w-full bg-surface-3 rounded-full h-3 mb-2">
            <motion.div className="h-3 rounded-full bg-gradient-to-r from-primary to-accent" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
          </div>
          <p className="text-text-muted text-sm mb-8">{pct}% accuracy</p>
          <div className="flex gap-3">
            <button className="btn-secondary btn flex-1" onClick={() => {
              setSoloFinished(false); totalSoloScore.current = 0;
              setScores([{ username: user?.username || 'You', score: 0 }]);
              soloStartRound(1);
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
            <span className="text-text-faint text-sm">
              🎨 Color Memory · Round {round}/{maxRounds}
              {solo && <span className="ml-2 text-accent">(Solo)</span>}
            </span>
            {solo && <button onClick={onExit} className="text-xs text-text-faint hover:text-text underline">Exit</button>}
          </div>
          {solo ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden">
                <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${(myScore / maxPossible) * 100}%` }} />
              </div>
              <span className="text-sm font-bold text-primary tabular-nums">{myScore}/{maxPossible}</span>
            </div>
          ) : (
            <ScoreBar
              player1={{ username: user?.username || 'You', score: myScore }}
              player2={{ username: opUsername, score: opScore }}
              maxScore={maxPossible}
            />
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">

        {/* WAITING */}
        {phase === 'waiting' && (
          <motion.div className="text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="text-6xl mb-4">🎨</div>
            <p className="text-text-muted text-xl">Get ready to memorize a color...</p>
          </motion.div>
        )}

        {/* SHOWING */}
        {phase === 'showing' && (
          <motion.div className="text-center flex flex-col items-center gap-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-text-muted text-sm uppercase tracking-widest">Memorize this color!</p>
            <motion.div
              className="rounded-3xl shadow-2xl"
              style={{ width: 220, height: 220, backgroundColor: targetHex }}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
            />
            <div className="text-text-muted text-sm">
              Disappears in <span className="font-black text-primary text-lg">{showTimeLeft}</span>s
            </div>
          </motion.div>
        )}

        {/* GUESSING — dialed.gg layout */}
        {phase === 'guessing' && (
          <motion.div
            className="flex rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            style={{ width: 560, height: 320 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Left: hue strip — full height */}
            <div className="flex bg-surface-2 p-3" style={{ width: 60 }}>
              <HueStrip hue={guess.h} onChange={(h) => setGuess((g) => ({ ...g, h }))} />
            </div>

            {/* Middle: SL square — full height minus timer */}
            <div className="flex flex-col bg-surface-2 p-3 gap-2" style={{ width: 180 }}>
              <div className="flex-1">
                <SLSquare
                  hue={guess.h}
                  s={guess.s}
                  l={guess.l}
                  onChange={(s, l) => setGuess((g) => ({ ...g, s, l }))}
                />
              </div>
              {/* Timer bar */}
              <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  animate={{ width: `${(timeLeft / (GUESS_MS / 1000)) * 100}%` }}
                  transition={{ duration: 0.9 }}
                />
              </div>
              <div className="text-center text-xs text-text-faint tabular-nums">{timeLeft}s</div>
            </div>

            {/* Right: selected color + submit */}
            <div className="flex-1 flex flex-col items-center justify-between p-4 transition-colors duration-75" style={{ backgroundColor: guessHex }}>
              <div className="self-start text-white/60 text-xs font-mono">
                {round}/{maxRounds}
              </div>

              {!submitted ? (
                <button
                  onClick={handleSubmit}
                  className="w-11 h-11 rounded-full bg-white/20 hover:bg-white/40 border border-white/40 flex items-center justify-center transition-all backdrop-blur"
                  title="Submit"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </button>
              ) : (
                <div className="text-white/70 text-xs animate-pulse">Waiting...</div>
              )}
            </div>
          </motion.div>
        )}

        {/* RESULT */}
        {phase === 'result' && targetColor && (
          <motion.div className="flex flex-col items-center gap-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-text-muted text-sm uppercase tracking-widest">Round {round} Result</p>

            <div className="flex gap-4 items-center">
              {/* Target */}
              <div className="text-center">
                <div className="w-28 h-28 rounded-2xl shadow-lg border-2 border-white/20 mb-2" style={{ backgroundColor: targetHex }} />
                <p className="text-xs text-text-faint">Target</p>
              </div>

              <div className="text-text-faint text-2xl">→</div>

              {/* Guess(es) */}
              {solo ? (
                <div className="text-center">
                  <div className="w-28 h-28 rounded-2xl shadow-lg border-2 border-primary/40 mb-2" style={{ backgroundColor: guessHex }} />
                  <p className="text-xs text-text-faint">Your guess</p>
                </div>
              ) : (
                roundResults.map((r) => (
                  <div key={r.username} className="text-center">
                    <div
                      className="w-28 h-28 rounded-2xl shadow-lg border-2 border-primary/40 mb-2"
                      style={{ backgroundColor: r.guess ? hslToHex(r.guess.h, r.guess.s, r.guess.l) : '#1a1a26' }}
                    />
                    <p className="text-xs text-text-faint">{r.username}</p>
                  </div>
                ))
              )}
            </div>

            {/* Score */}
            {solo ? (
              <div className="text-center">
                <div className={`text-5xl font-black ${(myRoundScore ?? 0) >= 80 ? 'text-success' : (myRoundScore ?? 0) >= 50 ? 'text-warning' : 'text-danger'}`}>
                  {myRoundScore ?? 0}
                </div>
                <div className="text-text-faint text-sm">/ 100 points</div>
              </div>
            ) : (
              <div className="flex gap-4">
                {roundResults.map((r) => (
                  <div key={r.username} className="text-center">
                    <div className="text-xs text-text-faint mb-1">{r.username}</div>
                    <div className={`text-3xl font-black ${r.roundScore >= 80 ? 'text-success' : r.roundScore >= 50 ? 'text-warning' : 'text-danger'}`}>
                      +{r.roundScore}
                    </div>
                    <div className="text-xs text-text-muted">total {r.totalScore}</div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-text-faint text-sm">{round < maxRounds ? 'Next color coming...' : 'Finishing...'}</p>
          </motion.div>
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
