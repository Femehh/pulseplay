'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { initSocket, getSocket } from '@/app/lib/socket';
import { useAuthStore } from '@/app/store/authStore';
import { useGameStore } from '@/app/store/gameStore';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { token, user } = useAuthStore();
  const {
    setConnected,
    setMatch,
    setMatchStatus,
    setCountdown,
    setResult,
    updateScore,
  } = useGameStore();

  useEffect(() => {
    const sock = initSocket(
      token || undefined,
      user?.isGuest ? user.id : undefined,
      user?.username
    );
    socketRef.current = sock;

    sock.on('connect', () => {
      setConnected(true);
      console.log('[Socket] Connected:', sock.id);
    });

    sock.on('disconnect', (reason) => {
      setConnected(false);
      console.log('[Socket] Disconnected:', reason);
    });

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
    });

    // Score updates from various games
    sock.on('game:round_end', (data) => {
      if (data.scores) {
        data.scores.forEach(({ username, score }: { username: string; score: number }) => {
          updateScore(username, score);
        });
      }
    });

    sock.on('game:hit', (data) => {
      if (data.scores) {
        data.scores.forEach(({ username, score }: { username: string; score: number }) => {
          updateScore(username, score);
        });
      }
    });

    sock.on('game:match_found', (data) => {
      if (data.scores) {
        data.scores.forEach(({ username, score }: { username: string; score: number }) => {
          updateScore(username, score);
        });
      }
    });

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
    };
  }, [token, user]);

  const emit = useCallback((event: string, data?: any) => {
    const sock = socketRef.current;
    if (sock?.connected) {
      sock.emit(event, data);
    }
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    const sock = socketRef.current;
    sock?.on(event, handler);
    return () => { sock?.off(event, handler); };
  }, []);

  return { socket: socketRef.current, emit, on };
}
