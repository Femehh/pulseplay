'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Home, Flame, TrendingUp, TrendingDown } from 'lucide-react';
import Button from './Button';
import type { MatchResult } from '@/app/store/gameStore';
import { useAuthStore } from '@/app/store/authStore';
import { useToast } from './Toast';

interface MatchResultModalProps {
  result: MatchResult & { streakBonus?: number; rankChanges?: Record<string, { from: string; to: string }> };
  onRematch: () => void;
  onHome: () => void;
}

export default function MatchResultModal({ result, onRematch, onHome }: MatchResultModalProps) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const myUsername = user?.username;
  const didWin = result.winner?.username === myUsername;
  const isDraw = !result.winner;
  const myEloChange = myUsername ? result.eloChanges?.[myUsername] : undefined;
  const myRankChange = myUsername ? result.rankChanges?.[myUsername] : undefined;

  // Rank change toast
  useEffect(() => {
    if (!myRankChange) return;
    const promoted = didWin;
    if (promoted) {
      toast(`🎉 Rank up! ${myRankChange.from} → ${myRankChange.to}`, 'success');
    } else {
      toast(`📉 Rank down: ${myRankChange.from} → ${myRankChange.to}`, 'warning');
    }
  }, [myRankChange]);

  // Streak bonus toast
  useEffect(() => {
    if (didWin && result.streakBonus && result.streakBonus > 0) {
      toast(`🔥 Win streak bonus: +${result.streakBonus} ELO`, 'info');
    }
  }, [result.streakBonus, didWin]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="card w-full max-w-md p-8 text-center"
          initial={{ scale: 0.8, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        >
          {/* Result title */}
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }} className="mb-6">
            {isDraw ? (
              <>
                <div className="text-6xl mb-3">🤝</div>
                <h2 className="text-3xl font-black text-warning">DRAW!</h2>
                <p className="text-text-muted mt-1 text-sm">No ELO change</p>
              </>
            ) : (
              <>
                <motion.div
                  className={`text-6xl mb-3 ${didWin ? '' : 'grayscale'}`}
                  animate={didWin ? { rotate: [0, -10, 10, -5, 5, 0] } : {}}
                  transition={{ delay: 0.4, duration: 0.5 }}
                >
                  {didWin ? '🏆' : '💀'}
                </motion.div>
                <h2 className={`text-3xl font-black ${didWin ? 'text-gradient' : 'text-text-muted'}`}>
                  {didWin ? 'VICTORY!' : 'DEFEAT'}
                </h2>
                <p className="text-text-muted mt-1 text-sm">{result.winner?.username} wins!</p>
              </>
            )}
          </motion.div>

          {/* Scores — both players with their ELO */}
          <div className="flex justify-center gap-6 mb-5">
            {result.scores.map((s, i) => {
              const isWinner = result.winner?.username === s.username;
              const eloChange = result.eloChanges?.[s.username];
              const rankChange = result.rankChanges?.[s.username];
              return (
                <motion.div
                  key={s.username}
                  className={`stat-box text-center min-w-[110px] ${isWinner && !isDraw ? 'border-primary/40' : ''}`}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  <div className="text-text-muted text-xs mb-1 truncate">{s.username}</div>
                  <div className="text-3xl font-black text-text">{s.score}</div>
                  {eloChange !== undefined && !user?.isGuest && (
                    <div className={`text-xs font-bold mt-1 flex items-center justify-center gap-0.5 ${eloChange >= 0 ? 'text-success' : 'text-danger'}`}>
                      {eloChange >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {eloChange >= 0 ? '+' : ''}{eloChange} ELO
                    </div>
                  )}
                  {rankChange && (
                    <div className="text-xs text-warning mt-0.5">{rankChange.from} → {rankChange.to}</div>
                  )}
                  {isWinner && !isDraw && <div className="text-xs text-primary mt-0.5">👑 Winner</div>}
                </motion.div>
              );
            })}
          </div>

          {/* My ELO + streak bonus */}
          {myEloChange !== undefined && !user?.isGuest && (
            <motion.div
              className="space-y-2 mb-6"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.55, type: 'spring' }}
            >
              <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${myEloChange >= 0 ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                {myEloChange >= 0 ? '▲' : '▼'} {Math.abs(myEloChange)} ELO {myEloChange >= 0 ? 'gained' : 'lost'}
              </div>
              {didWin && result.streakBonus && result.streakBonus > 0 && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-warning font-semibold">
                  <Flame size={13} /> +{result.streakBonus} streak bonus included
                </div>
              )}
              {myRankChange && (
                <div className={`text-sm font-bold ${didWin ? 'text-success' : 'text-warning'}`}>
                  {didWin ? '🎉' : '📉'} {myRankChange.from} → {myRankChange.to}
                </div>
              )}
            </motion.div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={onHome} icon={<Home size={16} />}>
              Home
            </Button>
            <Button variant="primary" className="flex-1" onClick={onRematch} icon={<RotateCcw size={16} />}>
              Rematch
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
