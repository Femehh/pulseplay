'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Zap, Trophy, Users, Gamepad2, ChevronRight, Shield } from 'lucide-react';
import Navbar from './components/layout/Navbar';
import { GAME_CONFIG } from './lib/ranks';

const FEATURES = [
  { icon: '⚡', title: 'Ultra-Low Latency', desc: 'Sub-50ms WebSocket gameplay. Every millisecond matters.' },
  { icon: '🛡️', title: 'Anti-Cheat', desc: 'Server-authoritative logic. No client-trusted scores.' },
  { icon: '🏆', title: 'ELO Rankings', desc: 'Competitive matchmaking. Climb from Bronze to Grandmaster.' },
  { icon: '🎮', title: '5 Minigames', desc: 'Reaction, Color Match, Sound, Aim Trainer & Memory Tiles.' },
];

const STATS = [
  { label: 'Active Players', value: '12,482' },
  { label: 'Matches Today', value: '98,341' },
  { label: 'Avg Reaction', value: '243ms' },
  { label: 'Rank Tiers', value: '7' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background bg-grid">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-4 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-mesh-gradient pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-medium mb-6">
              <Zap size={14} />
              Real-time multiplayer · 5 competitive games
            </span>
          </motion.div>

          <motion.h1
            className="text-5xl md:text-7xl font-black leading-none tracking-tight mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Compete. React.{' '}
            <span className="text-gradient">Dominate.</span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-text-muted max-w-2xl mx-auto mb-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Real-time 1v1 minigames that test your reflexes, perception, and skill.
            Climb the global leaderboard. No installs — just play.
          </motion.p>

          <motion.div
            className="flex flex-wrap items-center justify-center gap-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Link href="/play" className="btn-primary btn btn-lg text-base shadow-glow-primary">
              <Gamepad2 size={20} />
              Play Now — Free
            </Link>
            <Link href="/leaderboard" className="btn-secondary btn btn-lg text-base">
              <Trophy size={18} />
              View Rankings
            </Link>
          </motion.div>
        </div>

        {/* Stats strip */}
        <motion.div
          className="max-w-3xl mx-auto mt-20 grid grid-cols-2 md:grid-cols-4 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          {STATS.map((stat) => (
            <div key={stat.label} className="stat-box text-center">
              <div className="text-2xl font-black text-gradient">{stat.value}</div>
              <div className="text-xs text-text-faint">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Games grid */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-black mb-3">
              5 Competitive{' '}
              <span className="text-gradient">Minigames</span>
            </h2>
            <p className="text-text-muted">Each game tests a different skill. Master them all.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(GAME_CONFIG).map(([key, game], i) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <Link href={`/play?game=${key}`} className="game-card group block">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-gradient-to-br ${game.gradient} shadow-lg group-hover:scale-110 transition-transform`}
                  >
                    {game.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-text text-lg group-hover:text-primary transition-colors">
                      {game.name}
                    </h3>
                    <p className="text-text-muted text-sm mt-1">{game.description}</p>
                  </div>
                  <div className="flex items-center gap-1 text-primary text-sm font-medium">
                    Play now <ChevronRight size={14} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-surface/50">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            className="text-3xl font-black text-center mb-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Built for <span className="text-gradient">Competitors</span>
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map((feat, i) => (
              <motion.div
                key={feat.title}
                className="card p-6 flex gap-4 items-start"
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <span className="text-3xl">{feat.icon}</span>
                <div>
                  <h3 className="font-bold text-text mb-1">{feat.title}</h3>
                  <p className="text-text-muted text-sm">{feat.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 text-center">
        <motion.div
          className="max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-5xl font-black mb-4">
            Ready to test your{' '}
            <span className="text-gradient">reflexes?</span>
          </h2>
          <p className="text-text-muted mb-8">
            Jump in as a guest or create a free account to save your stats and climb the leaderboard.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/play" className="btn-primary btn btn-lg shadow-glow-primary">
              <Zap size={20} />
              Start Playing Free
            </Link>
            <Link href="/register" className="btn-secondary btn btn-lg">
              Create Account
            </Link>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-border py-8 px-4 text-center text-text-faint text-sm">
        <p>© 2024 PulsePlay · Real-time multiplayer minigames</p>
      </footer>
    </div>
  );
}
