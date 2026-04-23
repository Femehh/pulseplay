import { create } from 'zustand';

export type GameType = 'REACTION_TIME' | 'COLOR_MATCH' | 'SOUND_RECOGNITION' | 'AIM_TRAINER' | 'MEMORY_TILES' | 'CHECKERS';
export type MatchStatus = 'idle' | 'queuing' | 'found' | 'countdown' | 'playing' | 'ended';

export interface PlayerInfo {
  id: string;
  username: string;
  elo: number;
}

export interface MatchInfo {
  matchId: string;
  gameType: GameType;
  players: PlayerInfo[];
}

export interface MatchResult {
  matchId: string;
  winner: { username: string; id: string } | null;
  scores: { username: string; score: number }[];
  eloChanges: Record<string, number>;
}

interface GameState {
  // Connection
  connected: boolean;
  setConnected: (v: boolean) => void;

  // Matchmaking
  matchStatus: MatchStatus;
  currentGame: GameType | null;
  match: MatchInfo | null;
  countdown: number;
  result: MatchResult | null;

  // In-game scores (real-time)
  scores: Record<string, number>;

  // Actions
  setMatchStatus: (status: MatchStatus) => void;
  setCurrentGame: (game: GameType | null) => void;
  setMatch: (match: MatchInfo | null) => void;
  setCountdown: (n: number) => void;
  setResult: (result: MatchResult | null) => void;
  updateScore: (username: string, score: number) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  connected: false,
  matchStatus: 'idle',
  currentGame: null,
  match: null,
  countdown: 0,
  result: null,
  scores: {},

  setConnected: (connected) => set({ connected }),
  setMatchStatus: (matchStatus) => set({ matchStatus }),
  setCurrentGame: (currentGame) => set({ currentGame }),
  setMatch: (match) => set({ match }),
  setCountdown: (countdown) => set({ countdown }),
  setResult: (result) => set({ result }),
  updateScore: (username, score) =>
    set((s) => ({ scores: { ...s.scores, [username]: score } })),
  resetGame: () =>
    set({
      matchStatus: 'idle',
      match: null,
      countdown: 0,
      result: null,
      scores: {},
    }),
}));
