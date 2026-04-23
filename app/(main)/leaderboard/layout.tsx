import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboard — PulsePlay',
  description: 'Global rankings for PulsePlay competitive minigames',
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
