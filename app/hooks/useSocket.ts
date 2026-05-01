'use client';

import { useEffect, useRef, useCallback } from 'react';
import { initSocket, getSocket } from '@/app/lib/socket';
import { useAuthStore } from '@/app/store/authStore';
import { useGameStore } from '@/app/store/gameStore';

export function useSocket() {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const { token, user } = useAuthStore();
  const {
    setConnected,
    setMatch,
    setMatchStatus,
    setCountdown,
    setResult,
    updateScore,
  } = useGameStore();

  // Initialise synchronously so the module-level singleton exists before any
  // child component's useEffect registers listeners via `on()`
  const sock = initSocket(
    token || undefined,
    user?.isGuest ? user.id : undefined,
    user?.username
  );

  useEffect(() => {
    sock.on('connect', () => {
      setConnected(true);
      const currentMatch = useGameStore.getState().match;
      const currentStatus = useGameStore.getState().matchStatus;
      if (currentMatch && (currentStatus === 'playing' || currentStatus === 'ended')) {
        sock.emit('match:rejoin', { matchId: currentMatch.matchId });
      }
    });

    sock.on('disconnect', () => setConnected(false));

    sock.on('match:found', (data) => {
      setMatch(data);
      setMatchStatus('found');
    });

    sock.on('match:countdown', ({ count }) => {
      setCountdown(count);
      setMatchStatus('countdown');
    });

    sock.on('match:start', () => {
      setMatchStatus('playing');
      setCountdown(0);
    });

    sock.on('match:ended', (result) => {
      setResult(result);
      setMatchStatus('ended');
      const { user: currentUser, token: currentToken, setUser } = useAuthStore.getState();
      if (currentUser && !currentUser.isGuest && result.eloChanges?.[currentUser.username] !== undefined) {
        setUser(
          { ...currentUser, elo: currentUser.elo + result.eloChanges[currentUser.username] },
          currentToken!
        );
      }
    });

    sock.on('game:round_end', (data) => {
      if (data.scores) data.scores.forEach(({ username, score }: any) => updateScore(username, score));
    });
    sock.on('game:hit', (data) => {
      if (data.scores) data.scores.forEach(({ username, score }: any) => updateScore(username, score));
    });
    sock.on('game:match_found', (data) => {
      if (data.scores) data.scores.forEach(({ username, score }: any) => updateScore(username, score));
    });

    heartbeatRef.current = setInterval(() => {
      if (sock.connected) sock.emit('ping');
    }, 20000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !sock.connected) sock.connect();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      sock.off('connect');
      sock.off('disconnect');
      sock.off('match:found');
      sock.off('match:countdown');
      sock.off('match:start');
      sock.off('match:ended');
      sock.off('game:round_end');
      sock.off('game:hit');
      sock.off('game:match_found');
      document.removeEventListener('visibilitychange', handleVisibility);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [token, user]);

  // Both emit and on use the module-level singleton directly — always available
  // because initSocket() is called synchronously above before any child effect runs
  const emit = useCallback((event: string, data?: any) => {
    try {
      const s = getSocket();
      if (s.connected) s.emit(event, data);
    } catch {}
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    let s = null;
    try { s = getSocket(); } catch { s = null; }
    s?.on(event, handler);
    return () => { s?.off(event, handler); };
  }, []);

  return { emit, on };
}
