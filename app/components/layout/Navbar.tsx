'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Trophy, User, LogOut, Menu, X, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/app/store/authStore';
import { useGameStore } from '@/app/store/gameStore';
import { getRankTier } from '@/app/lib/ranks';
import { disconnectSocket } from '@/app/lib/socket';

const NAV_LINKS = [
  { href: '/play', label: 'Play', icon: '🎮' },
  { href: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearUser } = useAuthStore();
  const { connected } = useGameStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const rank = user?.elo ? getRankTier(user.elo) : null;

  const handleLogout = () => {
    disconnectSocket();
    clearUser();
    router.push('/');
    setProfileOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <nav className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-glow-primary group-hover:scale-110 transition-transform">
            <Zap size={18} className="text-white" />
          </div>
          <span className="font-black text-xl tracking-tight">
            Pulse<span className="text-gradient">Play</span>
          </span>
        </Link>

        {/* Center nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                pathname.startsWith(link.href)
                  ? 'bg-primary/20 text-primary'
                  : 'text-text-muted hover:text-text hover:bg-surface-2'
              }`}
            >
              <span>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <div className="hidden sm:flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-danger'}`} />
            <span className="text-xs text-text-faint">{connected ? 'Online' : 'Offline'}</span>
          </div>

          {user ? (
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 border border-border hover:border-border-light transition-all duration-200"
              >
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-sm">
                  {user.username[0].toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-semibold text-text leading-none">{user.username}</div>
                  {rank && (
                    <div className="text-xs text-text-faint leading-none mt-0.5">
                      {rank.icon} {rank.name} · {user.elo} ELO
                    </div>
                  )}
                </div>
                <ChevronDown size={14} className={`text-text-faint transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    className="absolute right-0 top-full mt-2 w-48 card py-1 z-50"
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Link
                      href={`/profile/${user.username}`}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
                      onClick={() => setProfileOpen(false)}
                    >
                      <User size={14} />
                      Profile
                    </Link>
                    <div className="divider my-1" />
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors w-full"
                    >
                      <LogOut size={14} />
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="btn-ghost btn text-sm">
                Login
              </Link>
              <Link href="/register" className="btn-primary btn text-sm">
                Sign Up
              </Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden btn-ghost btn p-2"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="md:hidden border-t border-border bg-background"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="p-4 flex flex-col gap-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                    pathname.startsWith(link.href)
                      ? 'bg-primary/20 text-primary'
                      : 'text-text-muted hover:bg-surface-2'
                  }`}
                >
                  {link.icon} {link.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
