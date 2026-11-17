'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { ApiError, api, User } from '@/lib/api';

type Project = {
  id: string;
  name: string;
  description?: string | null;
  environments: Array<{ id: string; name: string; type: string }>;
  _count: { flags: number; apiKeys: number };
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setUser(await api<User>('/auth/me'));
        setProjects(await api<Project[]>('/projects'));
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/');
          return;
        }
        router.replace('/');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function createProject(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const project = await api<Project>('/projects', {
        method: 'POST',
        body: JSON.stringify({ name, description: description || undefined }),
      });
      router.push(`/dashboard/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="shell fade-up">
      <AppHeader email={user?.email} />
      <h1 className="page-title">Projects</h1>
      <p className="page-desc">환경별 Feature Flag를 프로젝트 단위로 관리합니다.</p>

      <div className="dash-grid" style={{ marginTop: 28 }}>
        <section>
          <h2 className="section-title">Your projects</h2>
          <p className="section-sub">클릭하면 Flag · Evaluate · Keys · Audits로 이동합니다.</p>
          {projects.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              프로젝트가 없습니다. 오른쪽에서 생성하세요.
            </p>
          ) : (
            <div className="list-stack">
              {projects.map((p) => (
                <Link key={p.id} href={`/dashboard/projects/${p.id}`} className="list-row">
                  <div className="list-row-top">
                    <strong>{p.name}</strong>
                    <span className="mono list-row-meta">{p._count.flags} flags</span>
                  </div>
                  {p.description && <p className="list-row-desc">{p.description}</p>}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="surface surface-pad fade-up-delay">
          <h2 className="section-title">New project</h2>
          <p className="section-sub">Dev / Staging / Prod 환경이 함께 생성됩니다.</p>
          <form onSubmit={createProject} className="form-stack">
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            {error && <p className="alert-err">{error}</p>}
            <button className="btn" type="submit">
              Create project
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
