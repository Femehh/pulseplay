'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Zap, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/app/store/authStore';
import { api } from '@/app/lib/api';
import Button from '@/app/components/ui/Button';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setLoading, setError, isLoading, error } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { token, user } = await api.auth.login({ username, password });
      setUser(user, token);
      router.push('/play');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleGuest() {
    setLoading(true);
    setError(null);
    try {
      const { token, user } = await api.auth.guest();
      setUser(user, token);
      router.push('/play');
    } catch (err: any) {
      setError(err.message || 'Failed to join as guest');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background bg-grid flex items-center justify-center px-4">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-glow-primary group-hover:scale-110 transition-transform">
              <Zap size={22} className="text-white" />
            </div>
            <span className="font-black text-2xl">
              Pulse<span className="text-gradient">Play</span>
            </span>
          </Link>
          <h1 className="text-2xl font-black mt-6 mb-1">Welcome back</h1>
          <p className="text-text-muted text-sm">Sign in to your account</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                type="text"
                placeholder="YourUsername"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-12"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                className="text-danger text-sm bg-danger/10 rounded-lg px-4 py-3 border border-danger/20"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                {error}
              </motion.p>
            )}

            <Button type="submit" loading={isLoading} className="w-full mt-2">
              Sign In
            </Button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 border-t border-border" />
            <span className="text-text-faint text-xs">OR</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <Button variant="secondary" onClick={handleGuest} loading={isLoading} className="w-full">
            🎮 Play as Guest
          </Button>

          <p className="text-center text-text-muted text-sm mt-6">
            No account?{' '}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Create one free
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
