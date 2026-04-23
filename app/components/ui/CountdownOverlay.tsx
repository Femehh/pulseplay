'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface CountdownOverlayProps {
  count: number;
  visible: boolean;
  players?: { username: string; elo: number }[];
}

export default function CountdownOverlay({ count, visible, players }: CountdownOverlayProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="countdown-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="text-center">
            {players && (
              <motion.div
                className="flex items-center justify-center gap-8 mb-12"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                <div className="text-center">
                  <div className="text-xl font-bold text-text">{players[0]?.username}</div>
                  <div className="text-text-muted text-sm">{players[0]?.elo} ELO</div>
                </div>
                <div className="text-text-faint text-2xl font-bold">VS</div>
                <div className="text-center">
                  <div className="text-xl font-bold text-text">{players[1]?.username}</div>
                  <div className="text-text-muted text-sm">{players[1]?.elo} ELO</div>
                </div>
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={count}
                className="countdown-number"
                initial={{ scale: 1.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                {count > 0 ? count : 'GO!'}
              </motion.div>
            </AnimatePresence>

            {count > 0 && (
              <motion.p
                className="text-text-muted mt-4 text-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                Get ready...
              </motion.p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
