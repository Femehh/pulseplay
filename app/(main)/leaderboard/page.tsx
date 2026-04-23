'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Search, ChevronLeft, ChevronRight, Flame } from 'lucide-react';
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
  currentWinStreak?: number;
  bestWinStreak?: number;
  tier: { name: string; color: string; icon: string };
}

const PAGE_SIZE = 25;
const RANK_MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const fetchData = useCallback(() => {
    setLoading(true);
    const offset = page * PAGE_SIZE;
    const fn = filter === 'ALL'
      ? api.leaderboard.global(PAGE_SIZE, offset, search)
      : api.leaderboard.byGame(filter, PAGE_SIZE, offset, search);

    fn.then((data: any) => {
      setEntries(data.entries || data);
      setTotal(data.total || (data.entries || data).length);
    }).catch(console.error).finally(() => setLoading(false));
  }, [filter, page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Refetch when tab becomes visible (e.g. returning from a match)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchData(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchData]);

  // Reset page on filter/search change
  useEffect(() => { setPage(0); }, [filter, search]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  return (
    <div className="min-h-screen bg-background bg-grid">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">
        <motion.div className="text-center mb-10" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl md:text-4xl font-black mb-2">
            Global <span className="text-gradient">Leaderboard</span>
          </h1>
          <p className="text-text-muted">Top players ranked by ELO rating</p>
        </motion.div>

        {/* Rank tiers legend */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {RANK_TIERS.map((tier) => (
            <span key={tier.name} className="badge text-xs" style={{ backgroundColor: `${tier.color}20`, color: tier.color }}>
              {tier.icon} {tier.name} {tier.minElo}+
            </span>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
            <input
              className="input pl-8 w-full"
              placeholder="Search player..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary btn text-sm px-4">Search</button>
          {search && (
            <button type="button" className="btn-ghost btn text-sm px-3" onClick={() => { setSearch(''); setSearchInput(''); }}>
              Clear
            </button>
          )}
        </form>

        {/* Game filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'ALL' ? 'bg-primary text-white' : 'bg-surface border border-border text-text-muted hover:text-text'}`}
          >
            🏆 Overall
          </button>
          {Object.entries(GAME_CONFIG).map(([key, game]) => (
            <button
              key={key}
              onClick={() => setFilter(key as GameType)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === key ? 'bg-primary text-white' : 'bg-surface border border-border text-text-muted hover:text-text'}`}
            >
              {game.icon} {game.name}
            </button>
          ))}
        </div>

        {/* Table */}
        <motion.div className="card overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-20 text-text-muted">
              <Trophy size={40} className="mx-auto mb-3 opacity-30" />
              <p>{search ? `No players matching "${search}"` : 'No rankings yet. Be the first!'}</p>
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
                      <th className="px-4 py-4 text-text-faint text-xs uppercase tracking-wider text-right hidden lg:table-cell">Streak</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <motion.tr
                    key={entry.userId}
                    className={`border-b border-border/50 last:border-0 hover:bg-surface-2 transition-colors ${i < 3 && page === 0 ? 'bg-primary/5' : ''}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <td className="px-6 py-4">
                      <span className="text-lg">
                        {i < 3 && page === 0
                          ? RANK_MEDALS[i]
                          : <span className="text-text-faint font-mono text-sm">{entry.rank}</span>}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <Link href={`/profile/${entry.username}`} className="flex items-center gap-3 hover:text-primary transition-colors">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{ backgroundColor: `${entry.tier.color}20`, color: entry.tier.color }}>
                          {entry.username[0].toUpperCase()}
                        </div>
                        <span className="font-semibold text-text">{entry.username}</span>
                        {(entry.currentWinStreak || 0) >= 3 && (
                          <span className="text-xs text-warning flex items-center gap-0.5">
                            <Flame size={11} /> {entry.currentWinStreak}
                          </span>
                        )}
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
                        <td className="px-4 py-4 text-right hidden lg:table-cell">
                          {(entry.currentWinStreak || 0) > 0 ? (
                            <span className="text-warning text-sm font-semibold flex items-center justify-end gap-1">
                              <Flame size={12} /> {entry.currentWinStreak}
                            </span>
                          ) : (
                            <span className="text-text-faint text-sm">—</span>
                          )}
                        </td>
                      </>
                    )}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-ghost btn p-2 disabled:opacity-30"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm text-text-muted">
              Page {page + 1} of {totalPages} · {total} players
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="btn-ghost btn p-2 disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
