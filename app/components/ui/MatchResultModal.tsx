'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, RotateCcw, Home } from 'lucide-react';
import Button from './Button';
import type { MatchResult } from '@/app/store/gameStore';
import { useAuthStore } from '@/app/store/authStore';
import { getRankBadge } from '@/app/lib/ranks';

interface MatchResultModalProps {
  result: MatchResult;
  onRematch: () => void;
  onHome: () => void;
}

export default function MatchResultModal({ result, onRematch, onHome }: MatchResultModalProps) {
  const { user } = useAuthStore();
  const myUsername = user?.username;
  const didWin = result.winner?.username === myUsername;
  const myEloChange = myUsername ? result.eloChanges[myUsername] : undefined;

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
            {result.winner ? (
              <>
                <div className={`text-6xl mb-3 ${didWin ? '' : 'grayscale'}`}>
                  {didWin ? '🏆' : '💀'}
                </div>
                <h2 className={`text-3xl font-black ${didWin ? 'text-gradient' : 'text-text-muted'}`}>
                  {didWin ? 'VICTORY!' : 'DEFEAT'}
                </h2>
                <p className="text-text-muted mt-1">
                  {result.winner.username} wins!
                </p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-3">🤝</div>
                <h2 className="text-3xl font-black text-warning">DRAW!</h2>
              </>
            )}
          </motion.div>

          {/* Scores */}
          <div className="flex justify-center gap-8 mb-6">
            {result.scores.map((s, i) => (
              <motion.div
                key={s.username}
                className="stat-box text-center min-w-[100px]"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.1 }}
              >
                <div className="text-text-muted text-sm">{s.username}</div>
                <div className="text-3xl font-black text-text">{s.score}</div>
              </motion.div>
            ))}
          </div>

          {/* ELO change */}
          {myEloChange !== undefined && !user?.isGuest && (
            <motion.div
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold mb-6 ${
                myEloChange >= 0
                  ? 'bg-success/20 text-success'
                  : 'bg-danger/20 text-danger'
              }`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 }}
            >
              {myEloChange >= 0 ? '+' : ''}{myEloChange} ELO
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
