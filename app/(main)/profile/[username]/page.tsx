'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Trophy, Target, Zap, BarChart3, Clock } from 'lucide-react';
import Navbar from '@/app/components/layout/Navbar';
import { api } from '@/app/lib/api';
import { GAME_CONFIG } from '@/app/lib/ranks';
import Link from 'next/link';

interface UserProfile {
  id: string;
  username: string;
  avatarUrl?: string;
  createdAt: string;
  stats: {
    elo: number;
    peakElo: number;
    wins: number;
    losses: number;
    totalMatches: number;
    winRate: number;
    avgReactionTime?: number;
    tier: { name: string; color: string; icon: string };
  };
  rankings: Array<{ gameType: string; elo: number; tier: { name: string; color: string; icon: string } }>;
}

interface MatchHistory {
  id: string;
  gameType: string;
  opponent: string;
  won: boolean;
  myScore: number;
  opponentScore: number;
  eloChange: number;
  playedAt: string;
  duration: number;
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [matches, setMatches] = useState<MatchHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.users.get(username),
      api.users.matches(username),
    ])
      .then(([p, m]) => {
        setProfile(p);
        setMatches(m);
      })
      .catch(() => setError('Player not found'))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-black text-text mb-2">Player Not Found</h1>
          <Link href="/leaderboard" className="text-primary hover:underline">View leaderboard</Link>
        </div>
      </div>
    );
  }

  const { stats } = profile;

  return (
    <div className="min-h-screen bg-background bg-grid">
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 pt-24 pb-16">
        {/* Profile header */}
        <motion.div
          className="card p-6 mb-6 flex flex-col sm:flex-row gap-6 items-start"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Avatar */}
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black flex-shrink-0"
            style={{ backgroundColor: `${stats.tier.color}20`, color: stats.tier.color }}
          >
            {profile.username[0].toUpperCase()}
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl font-black text-text">{profile.username}</h1>
              <span
                className="badge text-sm"
                style={{ backgroundColor: `${stats.tier.color}20`, color: stats.tier.color }}
              >
                {stats.tier.icon} {stats.tier.name}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <div className="stat-box">
                <div className="text-text-faint text-xs">ELO</div>
                <div className="text-2xl font-black text-gradient">{stats.elo.toLocaleString()}</div>
              </div>
              <div className="stat-box">
                <div className="text-text-faint text-xs">Peak ELO</div>
                <div className="text-xl font-bold text-text">{stats.peakElo.toLocaleString()}</div>
              </div>
              <div className="stat-box">
                <div className="text-text-faint text-xs">Win Rate</div>
                <div className={`text-xl font-bold ${stats.winRate >= 50 ? 'text-success' : 'text-danger'}`}>
                  {stats.winRate}%
                </div>
              </div>
              <div className="stat-box">
                <div className="text-text-faint text-xs">Matches</div>
                <div className="text-xl font-bold text-text">{stats.totalMatches}</div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Win/Loss */}
          <motion.div
            className="card p-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-2 mb-4 text-text-muted">
              <Trophy size={16} />
              <span className="text-sm font-medium">Record</span>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <div className="text-3xl font-black text-success">{stats.wins}</div>
                <div className="text-xs text-text-faint">Wins</div>
              </div>
              <div className="text-text-faint">/</div>
              <div>
                <div className="text-3xl font-black text-danger">{stats.losses}</div>
                <div className="text-xs text-text-faint">Losses</div>
              </div>
            </div>
          </motion.div>

          {/* Reaction time */}
          {stats.avgReactionTime && (
            <motion.div
              className="card p-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <div className="flex items-center gap-2 mb-4 text-text-muted">
                <Zap size={16} />
                <span className="text-sm font-medium">Avg Reaction</span>
              </div>
              <div className="text-3xl font-black text-accent">
                {Math.round(stats.avgReactionTime)}
                <span className="text-base font-medium text-text-faint ml-1">ms</span>
              </div>
            </motion.div>
          )}

          {/* Member since */}
          <motion.div
            className="card p-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-4 text-text-muted">
              <Clock size={16} />
              <span className="text-sm font-medium">Member Since</span>
            </div>
            <div className="text-lg font-bold text-text">
              {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
          </motion.div>
        </div>

        {/* Per-game rankings */}
        {profile.rankings.length > 0 && (
          <motion.div
            className="card p-5 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-4 text-text-muted">
              <BarChart3 size={16} />
              <span className="text-sm font-medium">Per-Game Rankings</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {profile.rankings.map((r) => {
                const game = GAME_CONFIG[r.gameType as keyof typeof GAME_CONFIG];
                return (
                  <div key={r.gameType} className="stat-box text-center">
                    <div className="text-2xl mb-1">{game?.icon}</div>
                    <div className="text-xs text-text-faint mb-1">{game?.name}</div>
                    <div className="font-black text-text">{r.elo}</div>
                    <span className="text-xs" style={{ color: r.tier.color }}>{r.tier.icon} {r.tier.name}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Match history */}
        <motion.div
          className="card overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Target size={16} className="text-text-muted" />
            <h2 className="font-semibold text-text">Recent Matches</h2>
          </div>

          {matches.length === 0 ? (
            <div className="text-center py-12 text-text-faint">No matches yet</div>
          ) : (
            <div className="divide-y divide-border">
              {matches.map((m, i) => {
                const game = GAME_CONFIG[m.gameType as keyof typeof GAME_CONFIG];
                return (
                  <motion.div
                    key={m.id}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-surface-2 transition-colors"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <span className="text-xl">{game?.icon}</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-text">
                        vs <span className="text-primary">{m.opponent || 'Unknown'}</span>
                      </div>
                      <div className="text-xs text-text-faint">{game?.name}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-text">{m.myScore} – {m.opponentScore}</div>
                    </div>
                    <div className="text-right min-w-[60px]">
                      <span className={`badge text-xs ${m.won ? 'badge-success' : 'badge-danger'}`}>
                        {m.won ? 'WIN' : 'LOSS'}
                      </span>
                      {m.eloChange !== null && (
                        <div className={`text-xs mt-0.5 ${m.eloChange >= 0 ? 'text-success' : 'text-danger'}`}>
                          {m.eloChange >= 0 ? '+' : ''}{m.eloChange}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
