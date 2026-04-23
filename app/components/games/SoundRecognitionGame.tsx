'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import ScoreBar from '../ui/ScoreBar';
import MatchResultModal from '../ui/MatchResultModal';
import { useGameStore } from '@/app/store/gameStore';
import { useAuthStore } from '@/app/store/authStore';
import { useRouter } from 'next/navigation';

const MIN_HZ = 80;
const MAX_HZ = 1200;
const PLAY_MS = 3000;
const GUESS_MS = 15000;
const MAX_ROUNDS = 5;

// ─── Audio: two modes
//   playTarget(freq, ms)  — plays the target tone for a fixed duration then stops
//   startLive(freq)       — starts a continuous tone for guessing, returns setter to change freq
//   stopAll()             — kills everything
function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const getCtx = () => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  };

  const stopAll = useCallback(() => {
    try {
      if (gainRef.current && ctxRef.current) {
        gainRef.current.gain.cancelScheduledValues(ctxRef.current.currentTime);
        gainRef.current.gain.setValueAtTime(0, ctxRef.current.currentTime);
      }
      oscRef.current?.disconnect();
      gainRef.current?.disconnect();
    } catch (_) {}
    oscRef.current = null;
    gainRef.current = null;
  }, []);

  // Play the target tone for a fixed duration
  const playTarget = useCallback((freq: number, durationMs: number) => {
    stopAll();
    try {
      const ctx = getCtx();
      const dur = durationMs / 1000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.22, ctx.currentTime + dur - 0.06);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);
      gain.connect(ctx.destination);
      gainRef.current = gain;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start();
      osc.stop(ctx.currentTime + dur);
      osc.onended = () => { oscRef.current = null; gainRef.current = null; };
      oscRef.current = osc;
    } catch (_) {}
  }, [stopAll]);

  // Start a live continuous tone for guessing — returns a function to update frequency
  const startLive = useCallback((initialFreq: number): ((f: number) => void) => {
    stopAll();
    try {
      const ctx = getCtx();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.04);
      gain.connect(ctx.destination);
      gainRef.current = gain;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = initialFreq;
      osc.connect(gain);
      osc.start();
      oscRef.current = osc;

      // Return a setter that smoothly glides to the new freq
      return (f: number) => {
        if (oscRef.current && ctxRef.current) {
          oscRef.current.frequency.cancelScheduledValues(ctxRef.current.currentTime);
          oscRef.current.frequency.linearRampToValueAtTime(f, ctxRef.current.currentTime + 0.04);
        }
      };
    } catch (_) {}
    return () => {};
  }, [stopAll]);

  useEffect(() => () => {
    stopAll();
    try { ctxRef.current?.close(); } catch (_) {}
  }, [stopAll]);

  return { playTarget, startLive, stopAll };
}

// ─── Waveform ─────────────────────────────────────────────────────────────────
function Waveform({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const tRef = useRef(0);
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
    const WAVES = [
      { color: '#06b6d4', amp: 0.28, wf: 3.5, sp: 1.2, ph: 0 },
      { color: '#7c3aed', amp: 0.20, wf: 5.0, sp: 0.9, ph: 1 },
      { color: '#10b981', amp: 0.14, wf: 7.0, sp: 1.5, ph: 2 },
    ];
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      if (activeRef.current) {
        tRef.current += 0.018;
        const t = tRef.current;
        WAVES.forEach(({ color, amp, wf, sp, ph }) => {
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.8;
          ctx.globalAlpha = 0.75;
          for (let x = 0; x < W; x++) {
            const nx = x / W;
            const y = H / 2
              + Math.sin(nx * wf * Math.PI * 2 + t * sp + ph) * (H * amp)
              + Math.sin(nx * wf * Math.PI * 4 + t * sp * 1.3 + ph) * (H * amp * 0.25);
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        });
        ctx.globalAlpha = 1;
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return <canvas ref={canvasRef} width={300} height={460} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

// ─── Hz slider (log scale) with live tone update ───────────────────────────────
function HzSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const logToHz = (pct: number) =>
    Math.round(Math.exp(Math.log(MIN_HZ) + pct * (Math.log(MAX_HZ) - Math.log(MIN_HZ))));

  const hzToLog = (hz: number) =>
    (Math.log(hz) - Math.log(MIN_HZ)) / (Math.log(MAX_HZ) - Math.log(MIN_HZ));

  const pick = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    onChange(logToHz(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))));
  }, [onChange]);

  const pct = hzToLog(value) * 100;

  return (
    <div className="w-full select-none">
      <div className="text-center mb-5">
        <span className="text-6xl font-black text-white tabular-nums leading-none">{value}</span>
        <span className="text-3xl text-white/40 ml-2">Hz</span>
      </div>
      <div
        ref={trackRef}
        className="relative h-3 rounded-full cursor-pointer touch-none"
        style={{ background: 'linear-gradient(to right,#7c3aed,#06b6d4,#10b981)' }}
        onMouseDown={(e) => { dragging.current = true; pick(e.clientX); }}
        onMouseMove={(e) => { if (dragging.current) pick(e.clientX); }}
        onMouseUp={() => { dragging.current = false; }}
        onMouseLeave={() => { dragging.current = false; }}
        onTouchStart={(e) => { e.preventDefault(); dragging.current = true; pick(e.touches[0].clientX); }}
        onTouchMove={(e) => { e.preventDefault(); if (dragging.current) pick(e.touches[0].clientX); }}
        onTouchEnd={() => { dragging.current = false; }}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white shadow-xl pointer-events-none"
          style={{ left: `${pct}%`, boxShadow: '0 0 0 3px rgba(255,255,255,0.25),0 4px 12px rgba(0,0,0,0.5)' }}
        />
      </div>
      <div className="flex justify-between text-xs text-white/25 mt-2">
        <span>{MIN_HZ}Hz</span>
        <span>{MAX_HZ}Hz</span>
      </div>
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function frequencyScore(target: number, guess: number) {
  const ratio = Math.abs(Math.log(guess / target)) / Math.log(MAX_HZ / MIN_HZ);
  return Math.max(0, Math.round(100 - ratio * 100));
}
function randomFrequency() {
  return Math.round(Math.exp(Math.log(MIN_HZ) + Math.random() * (Math.log(MAX_HZ) - Math.log(MIN_HZ))));
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Phase = 'waiting' | 'playing' | 'guessing' | 'result';
interface RoundResult { username: string; roundScore: number; totalScore: number; guessFreq: number | null; }

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SoundRecognitionGame({ match, emit, on, solo = false, onExit }: any) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { result, setResult, resetGame } = useGameStore();
  const { playTarget, startLive, stopAll } = useAudio();

  const [phase, setPhase] = useState<Phase>('waiting');
  const [round, setRound] = useState(0);
  const [targetFreq, setTargetFreq] = useState<number | null>(null);
  const [guess, setGuess] = useState(440);
  const [playTimeLeft, setPlayTimeLeft] = useState(3);
  const [guessTimeLeft, setGuessTimeLeft] = useState(GUESS_MS / 1000);
  const [submitted, setSubmitted] = useState(false);
  const [myRoundScore, setMyRoundScore] = useState<number | null>(null);
  const [submittedGuess, setSubmittedGuess] = useState(440);
  const [roundResults, setRoundResults] = useState<RoundResult[]>([]);
  const [scores, setScores] = useState<{ username: string; score: number }[]>(
    solo ? [{ username: user?.username || 'You', score: 0 }]
         : (match?.players?.map((p: any) => ({ username: p.username, score: 0 })) || [])
  );
  const [soloFinished, setSoloFinished] = useState(false);

  const phaseRef = useRef<Phase>('waiting');
  const targetFreqRef = useRef<number | null>(null);
  const guessRef = useRef(440);
  const currentRoundRef = useRef(0);
  const totalSoloScore = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // holds the live freq setter returned by startLive()
  const setLiveFreqRef = useRef<((f: number) => void) | null>(null);

  const setPhaseSync = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  useEffect(() => { targetFreqRef.current = targetFreq; }, [targetFreq]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  // Called whenever slider changes during guessing phase — updates live tone instantly
  const handleGuessChange = useCallback((v: number) => {
    guessRef.current = v;
    setGuess(v);
    setLiveFreqRef.current?.(v);
  }, []);

  // ── Begin guessing phase: start live tone at current guess ─────────────────
  const beginGuessing = useCallback((durationMs: number) => {
    setPhaseSync('guessing');
    setGuessTimeLeft(durationMs / 1000);
    // Start the live tone at the current slider position
    setLiveFreqRef.current = startLive(guessRef.current);

    let gs = durationMs / 1000;
    intervalRef.current = setInterval(() => {
      gs--;
      setGuessTimeLeft(gs);
      if (gs <= 0) clearInterval(intervalRef.current!);
    }, 1000);
  }, [startLive]);

  // ── Finish a solo round ────────────────────────────────────────────────────
  const finishSoloRound = useCallback((freq: number, r: number) => {
    stopAll();
    setLiveFreqRef.current = null;
    clearTimers();
    const g = guessRef.current;
    const sc = frequencyScore(freq, g);
    totalSoloScore.current += sc;
    setSubmittedGuess(g);
    setMyRoundScore(sc);
    setScores([{ username: user?.username || 'You', score: totalSoloScore.current }]);
    setPhaseSync('result');
    timerRef.current = setTimeout(() => soloStartRound(r + 1), 3500);
  }, [stopAll, clearTimers, user?.username]);

  // ── Solo round start ───────────────────────────────────────────────────────
  const soloStartRound = useCallback((r: number) => {
    if (r > MAX_ROUNDS) { setSoloFinished(true); return; }
    clearTimers();
    stopAll();
    setLiveFreqRef.current = null;

    currentRoundRef.current = r;
    const freq = randomFrequency();
    targetFreqRef.current = freq;
    guessRef.current = 440;

    setTargetFreq(freq);
    setRound(r);
    setSubmitted(false);
    setMyRoundScore(null);
    setGuess(440);
    setPlayTimeLeft(Math.ceil(PLAY_MS / 1000));
    setPhaseSync('playing');

    // Play target tone
    playTarget(freq, PLAY_MS);

    let ps = Math.ceil(PLAY_MS / 1000);
    intervalRef.current = setInterval(() => {
      ps--;
      setPlayTimeLeft(ps);
      if (ps <= 0) clearInterval(intervalRef.current!);
    }, 1000);

    // After target plays, switch to guessing with live tone
    timerRef.current = setTimeout(() => {
      clearInterval(intervalRef.current!);
      beginGuessing(GUESS_MS);

      // Auto-submit when time runs out
      timerRef.current = setTimeout(() => {
        finishSoloRound(freq, r);
      }, GUESS_MS);
    }, PLAY_MS);
  }, [playTarget, stopAll, clearTimers, beginGuessing, finishSoloRound]);

  const soloSubmit = useCallback(() => {
    if (submitted) return;
    const freq = targetFreqRef.current;
    if (!freq) return;
    setSubmitted(true);
    finishSoloRound(freq, currentRoundRef.current);
  }, [submitted, finishSoloRound]);

  // Solo init
  useEffect(() => {
    if (!solo) return;
    timerRef.current = setTimeout(() => soloStartRound(1), 800);
    return () => { clearTimers(); stopAll(); };
  }, [solo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Multiplayer listeners ──────────────────────────────────────────────────
  useEffect(() => {
    if (solo) return;
    const offState = on('game:state', () => {});

    const offShow = on('game:freq_show', (data: any) => {
      clearTimers(); stopAll(); setLiveFreqRef.current = null;
      targetFreqRef.current = data.freq;
      guessRef.current = 440;
      setTargetFreq(data.freq);
      setRound(data.round);
      setSubmitted(false);
      setMyRoundScore(null);
      setGuess(440);
      setPlayTimeLeft(Math.ceil(data.playDuration / 1000));
      setPhaseSync('playing');
      playTarget(data.freq, data.playDuration);
      let ps = Math.ceil(data.playDuration / 1000);
      intervalRef.current = setInterval(() => { ps--; setPlayTimeLeft(ps); if (ps <= 0) clearInterval(intervalRef.current!); }, 1000);
    });

    const offHide = on('game:freq_hide', (data: any) => {
      clearTimers();
      beginGuessing(data.guessDuration);
    });

    const offAck = on('game:freq_guess_ack', (data: any) => {
      stopAll(); setLiveFreqRef.current = null;
      setMyRoundScore(data.score);
      setSubmittedGuess(guessRef.current);
      setSubmitted(true);
    });

    const offResult = on('game:freq_result', (data: any) => {
      clearTimers(); stopAll(); setLiveFreqRef.current = null;
      setPhaseSync('result');
      setTargetFreq(data.target);
      targetFreqRef.current = data.target;
      setRoundResults(data.results);
      if (data.scores) setScores(data.scores);
    });

    const offEnded = on('match:ended', (data: any) => setResult(data));

    return () => {
      offState(); offShow(); offHide(); offAck(); offResult(); offEnded();
      clearTimers(); stopAll();
    };
  }, [on, solo]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(() => {
    if (submitted || phaseRef.current !== 'guessing') return;
    if (solo) { soloSubmit(); return; }
    stopAll(); setLiveFreqRef.current = null;
    setSubmittedGuess(guessRef.current);
    setSubmitted(true);
    clearTimers();
    emit('game:action', { type: 'freq_guess', freq: guessRef.current });
  }, [submitted, solo, soloSubmit, emit, stopAll, clearTimers]);

  const myScore = scores.find((s) => s.username === user?.username)?.score ?? 0;
  const opScore = scores.find((s) => s.username !== user?.username)?.score ?? 0;
  const opUsername = scores.find((s) => s.username !== user?.username)?.username ?? 'Opponent';
  const maxPossible = MAX_ROUNDS * 100;

  // ── Finished ───────────────────────────────────────────────────────────────
  if (solo && soloFinished) {
    const pct = Math.round((totalSoloScore.current / maxPossible) * 100);
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-background p-6">
        <motion.div className="card p-10 text-center max-w-sm w-full" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="text-6xl mb-4">🎵</div>
          <h2 className="text-3xl font-black text-gradient mb-2">Practice Complete!</h2>
          <div className="text-5xl font-black text-primary my-4">
            {totalSoloScore.current}<span className="text-lg text-text-faint">/{maxPossible}</span>
          </div>
          <div className="w-full bg-surface-3 rounded-full h-3 mb-2">
            <motion.div className="h-3 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
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

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col bg-background">
      <div className="bg-surface border-b border-border px-6 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-text-faint text-sm">
              🎵 Frequency Match · Round {round}/{MAX_ROUNDS}
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
            <ScoreBar player1={{ username: user?.username || 'You', score: myScore }} player2={{ username: opUsername, score: opScore }} maxScore={maxPossible} />
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">

        {phase === 'waiting' && (
          <motion.div className="text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="text-6xl mb-4">🎵</div>
            <p className="text-text-muted text-xl">Get ready to hear a frequency...</p>
          </motion.div>
        )}

        {/* PLAYING — hear the target */}
        {phase === 'playing' && (
          <motion.div
            className="relative rounded-3xl overflow-hidden bg-black flex flex-col justify-between p-6"
            style={{ width: 300, height: 460 }}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          >
            <Waveform active={true} />
            <div className="relative z-10 text-white/40 text-sm">{round}/{MAX_ROUNDS}</div>
            <div className="relative z-10 text-right">
              <div className="text-8xl font-black text-white leading-none tabular-nums">{playTimeLeft}</div>
              <div className="text-white/40 text-sm mt-1">Seconds to remember</div>
            </div>
          </motion.div>
        )}

        {/* GUESSING — live tone plays as you drag */}
        {phase === 'guessing' && (
          <motion.div
            className="relative rounded-3xl overflow-hidden bg-black flex flex-col justify-between p-6"
            style={{ width: 300, height: 460 }}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          >
            <Waveform active={true} />

            <div className="relative z-10 flex justify-between items-center">
              <span className="text-white/40 text-sm">{round}/{MAX_ROUNDS}</span>
              <span className="text-white/50 text-xs">drag to match the tone</span>
              <span className="text-white/40 text-sm tabular-nums">{guessTimeLeft}s</span>
            </div>

            <div className="relative z-10 flex flex-col gap-5">
              <HzSlider value={guess} onChange={handleGuessChange} />

              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(to right,#7c3aed,#06b6d4)' }}
                  animate={{ width: `${(guessTimeLeft / (GUESS_MS / 1000)) * 100}%` }}
                  transition={{ duration: 0.9 }}
                />
              </div>

              {!submitted ? (
                <button
                  onClick={handleSubmit}
                  className="w-full py-3 rounded-2xl bg-white text-black font-black text-base hover:bg-white/90 active:scale-95 transition-all"
                >
                  Lock In
                </button>
              ) : (
                <p className="text-center text-white/40 text-sm animate-pulse py-3">Waiting for result...</p>
              )}
            </div>
          </motion.div>
        )}

        {/* RESULT */}
        {phase === 'result' && targetFreq !== null && (
          <motion.div className="flex flex-col items-center gap-5 text-center" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-text-faint text-xs uppercase tracking-widest">Round {round} Result</p>
            <div>
              <div className="text-5xl font-black text-white tabular-nums">
                {targetFreq}<span className="text-xl text-white/30 ml-1">Hz</span>
              </div>
              <p className="text-text-faint text-xs mt-1">target frequency</p>
            </div>

            {solo ? (
              <div className="flex flex-col items-center gap-2">
                <p className="text-text-muted text-sm">Your guess: <span className="text-white font-bold">{submittedGuess}Hz</span></p>
                <div className={`text-6xl font-black ${(myRoundScore ?? 0) >= 80 ? 'text-success' : (myRoundScore ?? 0) >= 50 ? 'text-warning' : 'text-danger'}`}>
                  {myRoundScore ?? 0}
                </div>
                <p className="text-text-faint text-sm">/ 100 points</p>
              </div>
            ) : (
              <div className="flex gap-8">
                {roundResults.map((r) => (
                  <div key={r.username} className="text-center">
                    <p className="text-text-faint text-xs mb-1">{r.username}</p>
                    <p className="text-text-muted text-sm mb-2">{r.guessFreq ? `${r.guessFreq}Hz` : '—'}</p>
                    <div className={`text-4xl font-black ${r.roundScore >= 80 ? 'text-success' : r.roundScore >= 50 ? 'text-warning' : 'text-danger'}`}>
                      +{r.roundScore}
                    </div>
                    <p className="text-text-faint text-xs mt-1">total {r.totalScore}</p>
                  </div>
                ))}
              </div>
            )}

            <p className="text-text-faint text-sm">{round < MAX_ROUNDS ? 'Next round starting...' : 'Finishing...'}</p>
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
