import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Play — PulsePlay',
  description: 'Choose a game and find a match instantly',
};

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
