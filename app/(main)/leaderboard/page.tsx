'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal } from 'lucide-react';
import Navbar from '@/app/components/layout/Navbar';
import { api } from '@/app/lib/api';
import { GAME_CONFIG, RANK_TIERS } from '@/app/lib/ranks';
import type { GameType } from '@/app/store/gameStore';
import Link from 'next/link';

type Filter = 'ALL' | GameType;

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  elo: number;
  wins?: number;
  losses?: number;
  totalMatches?: number;
  winRate?: number;
  tier: { name: string; color: string; icon: string };
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fn = filter === 'ALL'
      ? api.leaderboard.global(50)
      : api.leaderboard.byGame(filter, 50);

    fn.then(setEntries).catch(console.error).finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="min-h-screen bg-background bg-grid">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl md:text-4xl font-black mb-2">
            Global <span className="text-gradient">Leaderboard</span>
          </h1>
          <p className="text-text-muted">Top players ranked by ELO rating</p>
        </motion.div>

        {/* Rank tiers legend */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {RANK_TIERS.map((tier) => (
            <span
              key={tier.name}
              className="badge text-xs"
              style={{ backgroundColor: `${tier.color}20`, color: tier.color }}
            >
              {tier.icon} {tier.name} {tier.minElo}+
            </span>
          ))}
        </div>

        {/* Game filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === 'ALL' ? 'bg-primary text-white' : 'bg-surface border border-border text-text-muted hover:text-text'
            }`}
          >
            🏆 Overall
          </button>
          {Object.entries(GAME_CONFIG).map(([key, game]) => (
            <button
              key={key}
              onClick={() => setFilter(key as GameType)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === key ? 'bg-primary text-white' : 'bg-surface border border-border text-text-muted hover:text-text'
              }`}
            >
              {game.icon} {game.name}
            </button>
          ))}
        </div>

        {/* Table */}
        <motion.div
          className="card overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-20 text-text-muted">
              <Trophy size={40} className="mx-auto mb-3 opacity-30" />
              <p>No rankings yet. Be the first!</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-6 py-4 text-text-faint text-xs uppercase tracking-wider w-16">Rank</th>
                  <th className="px-4 py-4 text-text-faint text-xs uppercase tracking-wider">Player</th>
                  <th className="px-4 py-4 text-text-faint text-xs uppercase tracking-wider">Tier</th>
                  <th className="px-4 py-4 text-text-faint text-xs uppercase tracking-wider text-right">ELO</th>
                  {filter === 'ALL' && (
                    <>
                      <th className="px-4 py-4 text-text-faint text-xs uppercase tracking-wider text-right hidden md:table-cell">W/L</th>
                      <th className="px-4 py-4 text-text-faint text-xs uppercase tracking-wider text-right hidden md:table-cell">Win%</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <motion.tr
                    key={entry.userId}
                    className={`border-b border-border/50 last:border-0 hover:bg-surface-2 transition-colors ${
                      i < 3 ? 'bg-primary/5' : ''
                    }`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <td className="px-6 py-4">
                      <span className="text-lg">
                        {i < 3 ? RANK_MEDALS[i] : <span className="text-text-faint font-mono">{entry.rank}</span>}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/profile/${entry.username}`}
                        className="flex items-center gap-3 hover:text-primary transition-colors"
                      >
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{ backgroundColor: `${entry.tier.color}20`, color: entry.tier.color }}>
                          {entry.username[0].toUpperCase()}
                        </div>
                        <span className="font-semibold text-text">{entry.username}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-4">
                      <span className="badge" style={{ backgroundColor: `${entry.tier.color}20`, color: entry.tier.color }}>
                        {entry.tier.icon} {entry.tier.name}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-black text-text tabular-nums">
                      {entry.elo.toLocaleString()}
                    </td>
                    {filter === 'ALL' && (
                      <>
                        <td className="px-4 py-4 text-right text-text-muted text-sm hidden md:table-cell tabular-nums">
                          {entry.wins ?? 0}W / {entry.losses ?? 0}L
                        </td>
                        <td className="px-4 py-4 text-right hidden md:table-cell">
                          <span className={`font-semibold ${(entry.winRate ?? 0) >= 50 ? 'text-success' : 'text-text-muted'}`}>
                            {entry.winRate ?? 0}%
                          </span>
                        </td>
                      </>
                    )}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>
      </div>
    </div>
  );
}
