'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, RotateCcw, Home } from 'lucide-react';
import Button from './Button';
import type { MatchResult } from '@/app/store/gameStore';
import { useAuthStore } from '@/app/store/authStore';

interface MatchResultModalProps {
  result: MatchResult;
  onRematch: () => void;
  onHome: () => void;
}

export default function MatchResultModal({ result, onRematch, onHome }: MatchResultModalProps) {
  const { user } = useAuthStore();
  const myUsername = user?.username;
  const didWin = result.winner?.username === myUsername;
  const isDraw = !result.winner;
  const myEloChange = myUsername ? result.eloChanges?.[myUsername] : undefined;

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
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="mb-6"
          >
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
                <p className="text-text-muted mt-1 text-sm">
                  {result.winner?.username} wins!
                </p>
              </>
            )}
          </motion.div>

          {/* Scores */}
          <div className="flex justify-center gap-6 mb-5">
            {result.scores.map((s, i) => {
              const isWinner = result.winner?.username === s.username;
              const eloChange = result.eloChanges?.[s.username];
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
                    <div className={`text-xs font-bold mt-1 ${eloChange >= 0 ? 'text-success' : 'text-danger'}`}>
                      {eloChange >= 0 ? '+' : ''}{eloChange} ELO
                    </div>
                  )}
                  {isWinner && !isDraw && <div className="text-xs text-primary mt-0.5">👑 Winner</div>}
                </motion.div>
              );
            })}
          </div>

          {/* My ELO badge */}
          {myEloChange !== undefined && !user?.isGuest && (
            <motion.div
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold mb-6 ${
                myEloChange >= 0
                  ? 'bg-success/20 text-success'
                  : 'bg-danger/20 text-danger'
              }`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.55, type: 'spring' }}
            >
              {myEloChange >= 0 ? '▲' : '▼'} {Math.abs(myEloChange)} ELO {myEloChange >= 0 ? 'gained' : 'lost'}
            </motion.div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={onHome}
              icon={<Home size={16} />}
            >
              Home
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={onRematch}
              icon={<RotateCcw size={16} />}
            >
              Rematch
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
