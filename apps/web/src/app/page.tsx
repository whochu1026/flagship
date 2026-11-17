'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [email, setEmail] = useState('demo@flagship.test');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const busy = loading || demoLoading;

  async function login(path: '/auth/login' | '/auth/demo', body?: object) {
    setError('');
    const res = await api<{ accessToken: string }>(path, {
      method: 'POST',
      auth: false,
      body: body ? JSON.stringify(body) : undefined,
    });
    setToken(res.accessToken);
    router.push('/dashboard');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await login('/auth/login', { email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function onDemo() {
    setDemoLoading(true);
    try {
      await login('/auth/demo');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo failed');
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <main className="shell shell-home">
      <header className="topbar topbar-home fade-up">
        <div className="brand">
          Flag<span>Ship</span>
        </div>
        <div className="topbar-right">
          <button className="btn btn-sm" type="button" disabled={busy} onClick={onDemo}>
            {demoLoading ? '…' : 'Demo'}
          </button>
          <Link href="/register" className="btn btn-ghost btn-sm">
            회원가입
          </Link>
        </div>
      </header>

      <div className="landing">
        <section className="landing-copy fade-up">
          <h1 className="hero-brand">
            Flag<span>Ship</span>
          </h1>
          <p className="hero-line">
            코드 배포 없이 기능을 켜고 끄고, 사용자별로 점진적으로 기능을 공개하세요.
          </p>

          <form onSubmit={onSubmit} className="form-stack auth-form">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={busy}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={busy}
              />
            </div>
            {error && <p className="alert-err">{error}</p>}
            <button className="btn btn-ink" type="submit" disabled={busy}>
              {loading ? 'Signing in…' : 'Log in'}
            </button>
          </form>
        </section>

        <aside className="hero-visual" aria-hidden>
          <div className="hero-sheet">
            <strong>new_dashboard · production</strong>
            <div className="on">enabled  true</div>
            <div>rollout  30%</div>
            <div>targets  user_101, user_102</div>
            <div className="on">eval user_101 → ON (TARGET)</div>
            <div className="off">eval user_999 → OFF (ROLLOUT)</div>
          </div>
        </aside>
      </div>
    </main>
  );
}
