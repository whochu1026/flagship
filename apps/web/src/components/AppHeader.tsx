'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { setToken } from '@/lib/api';

export function AppHeader({ email }: { email?: string }) {
  const router = useRouter();
  return (
    <header className="app-header">
      <Link href="/dashboard" className="brand">
        Flag<span>Ship</span>
      </Link>
      <div className="header-actions">
        {email && <span className="header-email">{email}</span>}
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={() => {
            setToken(null);
            router.push('/');
          }}
        >
          Log out
        </button>
      </div>
    </header>
  );
}
