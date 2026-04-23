'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Lock, Globe, X, Bot, Clock } from 'lucide-react';
import Navbar from '@/app/components/layout/Navbar';
import Button from '@/app/components/ui/Button';
import { GAME_CONFIG } from '@/app/lib/ranks';
import { useSocket } from '@/app/hooks/useSocket';
import { useGameStore, type GameType } from '@/app/store/gameStore';
import { useAuthStore } from '@/app/store/authStore';
import CountdownOverlay from '@/app/components/ui/CountdownOverlay';
import { useToast } from '@/app/components/ui/Toast';
import dynamic from 'next/dynamic';

// Dynamically import game components
const GameComponents: Record<string, React.ComponentType<any>> = {
  REACTION_TIME: dynamic(() => import('@/app/components/games/ReactionTimeGame')),
  COLOR_MATCH: dynamic(() => import('@/app/components/games/ColorMatchGame')),
  SOUND_RECOGNITION: dynamic(() => import('@/app/components/games/SoundRecognitionGame')),
  AIM_TRAINER: dynamic(() => import('@/app/components/games/AimTrainerGame')),
  MEMORY_TILES: dynamic(() => import('@/app/components/games/MemoryTilesGame')),
  CHECKERS: dynamic(() => import('@/app/components/games/CheckersGame')),
};

function PlayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { emit, on } = useSocket();
  const { matchStatus, match, countdown, result, currentGame, setCurrentGame, setMatchStatus, resetGame } = useGameStore();

  const [selectedGame, setSelectedGame] = useState<GameType>(
    (searchParams.get('game') as GameType) || 'REACTION_TIME'
  );
  const [lobbyCode, setLobbyCode] = useState('');
  const [privateCode, setPrivateCode] = useState('');
  const [tab, setTab] = useState<'quick' | 'private' | 'solo'>('quick');
  const [soloActive, setSoloActive] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [matchDuration, setMatchDuration] = useState(0);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const matchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Handle match found → navigate
  useEffect(() => {
    if (matchStatus === 'found' || matchStatus === 'countdown' || matchStatus === 'playing') {
      setCurrentGame(selectedGame);
    }
  }, [matchStatus]);

  // Match duration timer
  useEffect(() => {
    if (matchStatus === 'playing') {
      setMatchDuration(0);
      matchTimerRef.current = setInterval(() => setMatchDuration(d => d + 1), 1000);
    } else {
      if (matchTimerRef.current) clearInterval(matchTimerRef.current);
    }
    return () => { if (matchTimerRef.current) clearInterval(matchTimerRef.current); };
  }, [matchStatus]);

  // Poll queue size while queuing
  useEffect(() => {
    if (matchStatus !== 'queuing') return;
    const interval = setInterval(() => {
      emit('matchmaking:status', { gameType: selectedGame });
    }, 5000);
    return () => clearInterval(interval);
  }, [matchStatus, selectedGame, emit]);

  // Listen for lobby events
  useEffect(() => {
    const offCreated = on('lobby:created', ({ code }: { code: string }) => {
      setPrivateCode(code);
    });
    const offError = on('error', ({ message }: { message: string }) => {
      toast(message, 'error');
    });
    const offQueueStatus = on('matchmaking:status', ({ playersInQueue }: any) => {
      setQueueSize(playersInQueue);
    });
    const offOpDisc = on('opponent:disconnected', () => {
      setOpponentDisconnected(true);
      toast('Opponent disconnected — waiting for reconnect...', 'warning');
      setTimeout(() => setOpponentDisconnected(false), 10000);
    });
    const offRematchReq = on('game:rematch_requested', ({ from }: { from: string }) => {
      toast(`${from} wants a rematch!`, 'info');
    });
    return () => { offCreated(); offError(); offQueueStatus(); offOpDisc(); offRematchReq(); };
  }, [on, toast]);

  const handleQuickMatch = () => {
    if (!user) { router.push('/login'); return; }
    emit('matchmaking:join', { gameType: selectedGame });
    setMatchStatus('queuing');
  };

  const handleLeaveQueue = () => {
    emit('matchmaking:leave', { gameType: selectedGame });
    resetGame();
  };

  const handleCreateLobby = () => {
    if (!user) { router.push('/login'); return; }
    emit('lobby:create', { gameType: selectedGame });
  };

  const handleJoinLobby = () => {
    if (!lobbyCode.trim()) return;
    emit('lobby:join', { code: lobbyCode.trim().toUpperCase() });
  };

  const GameComponent = currentGame ? GameComponents[currentGame] : null;

  // Show solo game
  if (soloActive && currentGame && GameComponent) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-16">
          <GameComponent
            match={null}
            emit={() => {}}
            on={() => () => {}}
            solo
            onExit={() => { setSoloActive(false); setCurrentGame(null); }}
          />
        </div>
      </div>
    );
  }

  // Show multiplayer active game (keep mounted during 'ended' so modal can show)
  if ((matchStatus === 'playing' || matchStatus === 'ended') && GameComponent) {
    const formatDur = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        {/* Match duration pill */}
        {matchStatus === 'playing' && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 bg-surface border border-border rounded-full px-3 py-1 flex items-center gap-1.5 text-xs text-text-muted shadow">
            <Clock size={11} />
            {formatDur(matchDuration)}
          </div>
        )}
        {opponentDisconnected && (
          <div className="fixed top-20 left-0 right-0 z-30 text-center text-xs bg-warning/10 border-b border-warning/30 text-warning py-1.5 font-medium">
            ⚠ Opponent disconnected — waiting for reconnect...
          </div>
        )}
        <div className="pt-16">
          <GameComponent match={match} emit={emit} on={on} solo={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-grid">
      <Navbar />

      {/* Countdown overlay */}
      <CountdownOverlay
        count={countdown}
        visible={matchStatus === 'countdown' || matchStatus === 'found'}
        players={match?.players}
      />

      <div className="max-w-5xl mx-auto px-4 pt-24 pb-16">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl md:text-4xl font-black mb-2">
            Choose Your <span className="text-gradient">Game</span>
          </h1>
          <p className="text-text-muted">Select a game mode and find an opponent instantly</p>
        </motion.div>

        {/* Game selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {Object.entries(GAME_CONFIG).map(([key, game]) => (
            <motion.button
              key={key}
              onClick={() => setSelectedGame(key as GameType)}
              className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                selectedGame === key
                  ? 'border-primary bg-primary/10 shadow-glow-primary'
                  : 'border-border bg-surface hover:border-border-light hover:bg-surface-2'
              }`}
              whileTap={{ scale: 0.97 }}
            >
              <div className="text-2xl mb-2">{game.icon}</div>
              <div className="text-sm font-semibold text-text leading-tight">{game.name}</div>
            </motion.button>
          ))}
        </div>

        {/* Selected game info */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedGame}
            className="card p-6 mb-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl bg-gradient-to-br ${GAME_CONFIG[selectedGame].gradient} shadow-lg`}>
                {GAME_CONFIG[selectedGame].icon}
              </div>
              <div>
                <h2 className="text-xl font-black">{GAME_CONFIG[selectedGame].name}</h2>
                <p className="text-text-muted text-sm">{GAME_CONFIG[selectedGame].description}</p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Match tabs */}
        <div className="flex gap-1 bg-surface rounded-xl p-1 mb-6 w-fit">
          <button
            onClick={() => setTab('quick')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'quick' ? 'bg-primary text-white shadow-glow-primary' : 'text-text-muted hover:text-text'
            }`}
          >
            <Globe size={15} />
            Quick Match
          </button>
          <button
            onClick={() => setTab('private')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'private' ? 'bg-primary text-white shadow-glow-primary' : 'text-text-muted hover:text-text'
            }`}
          >
            <Lock size={15} />
            Private Lobby
          </button>
          <button
            onClick={() => setTab('solo')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'solo' ? 'bg-accent text-white shadow-glow-accent' : 'text-text-muted hover:text-text'
            }`}
          >
            <Bot size={15} />
            Solo Practice
          </button>
        </div>

        <AnimatePresence mode="wait">
          {tab === 'solo' ? (
            <motion.div
              key="solo"
              className="card p-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl bg-gradient-to-br ${GAME_CONFIG[selectedGame].gradient} shadow-lg mb-5`}>
                {GAME_CONFIG[selectedGame].icon}
              </div>
              <h3 className="text-xl font-bold text-text mb-2">Practice Mode</h3>
              <p className="text-text-muted text-sm mb-2">
                Play <strong>{GAME_CONFIG[selectedGame].name}</strong> solo — no opponent, no ELO changes.
              </p>
              <p className="text-text-faint text-xs mb-8">Perfect for learning the game before jumping into ranked matches.</p>
              <Button
                size="lg"
                variant="secondary"
                className="text-base px-10 border-accent/40 hover:border-accent text-accent hover:bg-accent/10"
                onClick={() => {
                  setCurrentGame(selectedGame);
                  setSoloActive(true);
                }}
                icon={<Bot size={18} />}
              >
                Start Solo Practice
              </Button>
            </motion.div>
          ) : tab === 'quick' ? (
            <motion.div
              key="quick"
              className="card p-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {matchStatus === 'queuing' ? (
                <div>
                  <div className="relative w-20 h-20 mx-auto mb-6">
                    <div className="w-20 h-20 rounded-full border-4 border-primary/20 animate-spin-slow border-t-primary" />
                    <div className="absolute inset-0 flex items-center justify-center text-2xl">
                      {GAME_CONFIG[selectedGame].icon}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Finding opponent...</h3>
                  <p className="text-text-muted text-sm mb-1">Matching by ELO rating</p>
                  {queueSize > 0 && (
                    <p className="text-text-faint text-xs mb-4 flex items-center justify-center gap-1">
                      <Users size={11} /> {queueSize} player{queueSize !== 1 ? 's' : ''} in queue
                    </p>
                  )}
                  <div className="mb-6" />
                  <Button variant="danger" onClick={handleLeaveQueue} icon={<X size={15} />}>
                    Cancel Search
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-center gap-4 mb-6 text-text-muted">
                    <div className="flex items-center gap-2">
                      <Users size={18} />
                      <span className="text-sm">Auto-matched by ELO</span>
                    </div>
                  </div>
                  <Button size="lg" onClick={handleQuickMatch} className="text-lg px-10 shadow-glow-primary">
                    ⚡ Find Match
                  </Button>
                  {!user && (
                    <p className="text-text-faint text-sm mt-4">
                      You'll be asked to login or play as guest
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="private"
              className="card p-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Create lobby */}
                <div>
                  <h3 className="font-bold text-text mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-xs text-primary font-bold">1</span>
                    Create a Lobby
                  </h3>
                  <Button variant="secondary" onClick={handleCreateLobby} className="w-full mb-3">
                    Create Private Lobby
                  </Button>
                  {privateCode && (
                    <motion.div
                      className="bg-surface-2 border border-primary/30 rounded-lg p-4 text-center"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    >
                      <p className="text-text-muted text-xs mb-1">Share this code:</p>
                      <p className="text-2xl font-black text-primary tracking-widest">{privateCode}</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(privateCode)}
                        className="text-xs text-text-faint hover:text-text mt-2 underline"
                      >
                        Copy to clipboard
                      </button>
                    </motion.div>
                  )}
                </div>

                {/* Join lobby */}
                <div>
                  <h3 className="font-bold text-text mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center text-xs text-accent font-bold">2</span>
                    Join a Lobby
                  </h3>
                  <input
                    className="input mb-3 uppercase tracking-widest text-center text-lg font-bold"
                    placeholder="ENTER CODE"
                    value={lobbyCode}
                    onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
                    maxLength={8}
                  />
                  <Button
                    variant="secondary"
                    onClick={handleJoinLobby}
                    disabled={!lobbyCode.trim()}
                    className="w-full"
                  >
                    Join Lobby
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense>
      <PlayContent />
    </Suspense>
  );
}
