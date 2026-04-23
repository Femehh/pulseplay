'use client';

import { motion } from 'framer-motion';

interface ScoreBarProps {
  player1: { username: string; score: number };
  player2: { username: string; score: number };
  maxScore?: number;
}

export default function ScoreBar({ player1, player2, maxScore = 10 }: ScoreBarProps) {
  const total = player1.score + player2.score || 1;
  const p1Pct = Math.round((player1.score / maxScore) * 100);
  const p2Pct = Math.round((player2.score / maxScore) * 100);

  return (
    <div className="flex items-center gap-4 w-full">
      <div className="flex flex-col items-end w-1/3">
        <span className="text-sm font-semibold text-text">{player1.username}</span>
        <span className="text-2xl font-black text-primary">{player1.score}</span>
      </div>

      <div className="flex-1 relative h-3 bg-surface-3 rounded-full overflow-hidden">
        <motion.div
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-secondary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${p1Pct}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
        <motion.div
          className="absolute right-0 top-0 h-full bg-gradient-to-l from-danger to-orange-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${p2Pct}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      </div>

      <div className="flex flex-col items-start w-1/3">
        <span className="text-sm font-semibold text-text">{player2.username}</span>
        <span className="text-2xl font-black text-danger">{player2.score}</span>
      </div>
    </div>
  );
}
