import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-8xl font-black text-gradient mb-4">404</div>
        <h1 className="text-2xl font-bold text-text mb-2">Page Not Found</h1>
        <p className="text-text-muted mb-8">This page doesn't exist or was moved.</p>
        <Link href="/" className="btn-primary btn">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
