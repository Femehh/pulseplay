'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-text mb-2">Something went wrong</h1>
        <p className="text-text-muted mb-8 text-sm">{error.message || 'An unexpected error occurred'}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-primary btn">Try Again</button>
          <Link href="/" className="btn-secondary btn">Home</Link>
        </div>
      </div>
    </div>
  );
}
