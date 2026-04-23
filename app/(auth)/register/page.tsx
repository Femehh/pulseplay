'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Zap, Eye, EyeOff, Check } from 'lucide-react';
import { useAuthStore } from '@/app/store/authStore';
import { api } from '@/app/lib/api';
import Button from '@/app/components/ui/Button';

export default function RegisterPage() {
  const router = useRouter();
  const { setUser, setLoading, setError, isLoading, error } = useAuthStore();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);

  const pwStrength = [
    form.password.length >= 8,
    /[A-Z]/.test(form.password),
    /[0-9]/.test(form.password),
  ];

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { token, user } = await api.auth.register(form);
      setUser(user, token);
      router.push('/play');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGuest() {
    setLoading(true);
    try {
      const { token, user } = await api.auth.guest();
      setUser(user, token);
      router.push('/play');
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
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-glow-primary">
              <Zap size={22} className="text-white" />
            </div>
            <span className="font-black text-2xl">Pulse<span className="text-gradient">Play</span></span>
          </Link>
          <h1 className="text-2xl font-black mt-6 mb-1">Create account</h1>
          <p className="text-text-muted text-sm">Free forever. No credit card required.</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <div>
              <label className="label">Username <span className="text-text-faint">(3–20 chars)</span></label>
              <input
                className="input"
                placeholder="CoolGamer99"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                minLength={3}
                maxLength={20}
                required
              />
            </div>

            <div>
              <label className="label">Email <span className="text-text-faint">(optional)</span></label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-12"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  minLength={6}
                  required
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password strength */}
              {form.password && (
                <div className="mt-2 flex gap-2">
                  {['8+ chars', 'Uppercase', 'Number'].map((req, i) => (
                    <div key={req} className={`flex items-center gap-1 text-xs ${pwStrength[i] ? 'text-success' : 'text-text-faint'}`}>
                      <Check size={10} />
                      {req}
                    </div>
                  ))}
                </div>
              )}
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
              Create Account
            </Button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 border-t border-border" />
            <span className="text-text-faint text-xs">OR</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <Button variant="secondary" onClick={handleGuest} loading={isLoading} className="w-full">
            🎮 Play as Guest (no account)
          </Button>

          <p className="text-center text-text-muted text-sm mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
