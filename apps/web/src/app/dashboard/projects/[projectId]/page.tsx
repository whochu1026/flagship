'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { ApiError, api, User } from '@/lib/api';

type Env = { id: string; name: string; type: string };
type Project = {
  id: string;
  name: string;
  description?: string | null;
  environments: Env[];
  apiKeys: Array<{ id: string; name: string; keyPrefix: string; createdAt: string }>;
};
type Flag = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  enabled: boolean;
  rolloutPercentage: number;
  targetUsers: string[];
  environment: Env;
};
type Audit = {
  id: string;
  action: string;
  createdAt: string;
  user: { email: string; name: string };
  flag?: { key: string; name: string } | null;
};
type EvalResult = {
  key: string;
  enabled: boolean;
  reason: string;
  environment: string;
  userId: string | null;
  cached: boolean;
};

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [envId, setEnvId] = useState('');
  const [tab, setTab] = useState<'flags' | 'evaluate' | 'keys' | 'audits'>('flags');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [createdApiKey, setCreatedApiKey] = useState('');
  const [busy, setBusy] = useState(false);

  const [flagKey, setFlagKey] = useState('checkout_v2');
  const [flagName, setFlagName] = useState('Checkout V2');
  const [flagEnabled, setFlagEnabled] = useState(true);
  const [rollout, setRollout] = useState(20);
  const [targets, setTargets] = useState('user_101,user_102');

  const [evalKey, setEvalKey] = useState('new_dashboard');
  const [evalUser, setEvalUser] = useState('user_101');
  const [evalEnv, setEvalEnv] = useState('PRODUCTION');
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);

  const flash = useCallback((ok: string) => {
    setMessage(ok);
    setError('');
    window.setTimeout(() => setMessage(''), 3200);
  }, []);

  const fail = useCallback((err: unknown) => {
    const msg = err instanceof Error ? err.message : 'Failed';
    setError(msg);
    setMessage('');
    if (err instanceof ApiError && err.status === 401) {
      router.replace('/');
    }
  }, [router]);

  const refresh = useCallback(async () => {
    const [me, proj] = await Promise.all([
      api<User>('/auth/me'),
      api<Project>(`/projects/${projectId}`),
    ]);
    setUser(me);
    setProject(proj);

    let nextEnvId = envId;
    if (!nextEnvId) {
      const prod = proj.environments.find((e) => e.type === 'PRODUCTION');
      nextEnvId = prod?.id || proj.environments[0]?.id || '';
      if (nextEnvId) setEnvId(nextEnvId);
    }

    const [fl, au] = await Promise.all([
      api<Flag[]>(
        `/projects/${projectId}/flags${nextEnvId ? `?environmentId=${nextEnvId}` : ''}`,
      ),
      api<Audit[]>(`/projects/${projectId}/audits`),
    ]);
    setFlags(fl);
    setAudits(au);
  }, [projectId, envId]);

  useEffect(() => {
    refresh().catch((err) => {
      fail(err);
      router.replace('/');
    });
  }, [refresh, router, fail]);

  async function createFlag(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/projects/${projectId}/environments/${envId}/flags`, {
        method: 'POST',
        body: JSON.stringify({
          key: flagKey.trim(),
          name: flagName.trim(),
          enabled: flagEnabled,
          rolloutPercentage: rollout,
          targetUsers: targets
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      flash(`Flag ${flagKey} created`);
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function toggleFlag(flag: Flag) {
    setBusy(true);
    try {
      await api(`/projects/${projectId}/flags/${flag.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !flag.enabled }),
      });
      flash(`Flag ${flag.key} → ${!flag.enabled ? 'ON' : 'OFF'}`);
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function deleteFlag(flag: Flag) {
    if (!window.confirm(`Delete flag "${flag.key}"?`)) return;
    setBusy(true);
    try {
      await api(`/projects/${projectId}/flags/${flag.id}`, { method: 'DELETE' });
      flash(`Flag ${flag.key} deleted`);
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function createKey(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ apiKey: string }>(`/projects/${projectId}/api-keys`, {
        method: 'POST',
        body: JSON.stringify({ name: 'sdk' }),
      });
      setCreatedApiKey(res.apiKey);
      flash('API key created — copy it now');
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function runEvaluate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setEvalResult(null);
    try {
      const res = await api<EvalResult>(`/projects/${projectId}/evaluate`, {
        method: 'POST',
        body: JSON.stringify({
          key: evalKey.trim(),
          userId: evalUser.trim() || undefined,
          environment: evalEnv,
        }),
      });
      setEvalResult(res);
      setError('');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  if (!project) {
    return (
      <main className="shell">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="shell fade-up">
      <AppHeader email={user?.email} />
      <Link href="/dashboard" className="crumb">
        ← Projects
      </Link>
      <h1 className="page-title">{project.name}</h1>
      {project.description && <p className="page-desc">{project.description}</p>}

      {(message || error) && (
        <p className={error ? 'alert-err' : 'alert-ok'} style={{ marginTop: 16 }}>
          {error || message}
        </p>
      )}

      <div className="tabs">
        {(['flags', 'evaluate', 'keys', 'audits'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`tab ${tab === t ? 'tab-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'flags' && (
        <div className="split-grid">
          <section>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'flex-start',
                marginBottom: 8,
              }}
            >
              <div>
                <h2 className="section-title">Feature flags</h2>
                <p className="section-sub">환경별로 ON/OFF · 롤아웃을 관리합니다.</p>
              </div>
              <select
                className="env-select"
                value={envId}
                onChange={(e) => setEnvId(e.target.value)}
              >
                {project.environments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name}
                  </option>
                ))}
              </select>
            </div>
            {flags.length === 0 ? (
              <p className="muted" style={{ margin: '12px 0 0', fontSize: 14 }}>
                이 환경에 Flag가 없습니다. 오른쪽에서 생성하세요.
              </p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Status</th>
                    <th>Rollout</th>
                    <th>Targets</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {flags.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <div className="mono">{f.key}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {f.name}
                        </div>
                      </td>
                      <td>
                        <span className={`status ${f.enabled ? 'status-on' : 'status-off'}`}>
                          {f.enabled ? 'ON' : 'OFF'}
                        </span>
                      </td>
                      <td className="mono">{f.rolloutPercentage}%</td>
                      <td className="mono muted" style={{ fontSize: 12 }}>
                        {(f.targetUsers || []).join(', ') || '—'}
                      </td>
                      <td>
                        <div className="actions-row">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy}
                            onClick={() => toggleFlag(f)}
                          >
                            Toggle
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy}
                            onClick={() => deleteFlag(f)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="surface surface-pad">
            <h2 className="section-title">Create flag</h2>
            <p className="section-sub">선택한 환경에 Flag를 추가합니다.</p>
            <form onSubmit={createFlag} className="form-stack">
              <div className="field">
                <label>Key</label>
                <input
                  className="mono"
                  value={flagKey}
                  onChange={(e) => setFlagKey(e.target.value)}
                  required
                  pattern="[a-z0-9_]+"
                  title="snake_case alphanumeric"
                />
              </div>
              <div className="field">
                <label>Name</label>
                <input value={flagName} onChange={(e) => setFlagName(e.target.value)} required />
              </div>
              <div className="field">
                <label>Rollout %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={rollout}
                  onChange={(e) => setRollout(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label>Target users</label>
                <input value={targets} onChange={(e) => setTargets(e.target.value)} />
              </div>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={flagEnabled}
                  onChange={(e) => setFlagEnabled(e.target.checked)}
                />
                Enabled
              </label>
              <button className="btn" type="submit" disabled={!envId || busy}>
                Create flag
              </button>
            </form>
          </section>
        </div>
      )}

      {tab === 'evaluate' && (
        <section style={{ maxWidth: 520 }}>
          <h2 className="section-title">Evaluate preview</h2>
          <p className="section-sub">사용자·환경 기준으로 Flag 평가 결과를 확인합니다.</p>
          <form onSubmit={runEvaluate} className="form-stack">
            <div className="field">
              <label>Flag key</label>
              <input className="mono" value={evalKey} onChange={(e) => setEvalKey(e.target.value)} />
            </div>
            <div className="field">
              <label>User id</label>
              <input className="mono" value={evalUser} onChange={(e) => setEvalUser(e.target.value)} />
            </div>
            <div className="field">
              <label>Environment</label>
              <select value={evalEnv} onChange={(e) => setEvalEnv(e.target.value)}>
                <option value="DEVELOPMENT">DEVELOPMENT</option>
                <option value="STAGING">STAGING</option>
                <option value="PRODUCTION">PRODUCTION</option>
              </select>
            </div>
            <button className="btn" type="submit" disabled={busy}>
              Evaluate
            </button>
          </form>
          {evalResult && (
            <div style={{ marginTop: 18 }}>
              <p style={{ margin: '0 0 10px', fontSize: 15 }}>
                Result{' '}
                <span className={`status ${evalResult.enabled ? 'status-on' : 'status-off'}`}>
                  {evalResult.enabled ? 'ON' : 'OFF'}
                </span>
                <span className="muted mono" style={{ marginLeft: 10, fontSize: 12 }}>
                  {evalResult.reason}
                  {evalResult.cached ? ' · cached' : ''}
                </span>
              </p>
              <pre className="mono eval-result">{JSON.stringify(evalResult, null, 2)}</pre>
            </div>
          )}
        </section>
      )}

      {tab === 'keys' && (
        <div className="split-grid">
          <section>
            <h2 className="section-title">SDK API keys</h2>
            <p className="section-sub">외부 서비스에서 Flag를 조회할 때 사용합니다.</p>
            {createdApiKey && (
              <div className="key-banner">
                <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600 }}>Copy now</p>
                <code className="mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                  {createdApiKey}
                </code>
              </div>
            )}
            {project.apiKeys.length === 0 ? (
              <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                아직 발급된 키가 없습니다.
              </p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Prefix</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {project.apiKeys.map((k) => (
                    <tr key={k.id}>
                      <td>{k.name}</td>
                      <td className="mono">{k.keyPrefix}…</td>
                      <td className="mono muted">{new Date(k.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section className="surface surface-pad">
            <h2 className="section-title">Issue key</h2>
            <p className="section-sub">한 번만 표시되는 raw key를 발급합니다.</p>
            <form onSubmit={createKey} className="form-stack">
              <button className="btn" type="submit" disabled={busy}>
                Create SDK key
              </button>
            </form>
            <p className="muted" style={{ marginTop: 14, fontSize: 13, lineHeight: 1.5 }}>
              <code className="mono">POST /api/v1/evaluate</code> +{' '}
              <code className="mono">X-API-Key</code>
            </p>
          </section>
        </div>
      )}

      {tab === 'audits' && (
        <section>
          <h2 className="section-title">Change history</h2>
          <p className="section-sub">설정 변경자와 액션을 추적합니다.</p>
          {audits.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              아직 변경 이력이 없습니다.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Flag</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((a) => (
                  <tr key={a.id}>
                    <td className="mono muted">{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="mono">{a.action}</td>
                    <td className="mono">{a.flag?.key || '—'}</td>
                    <td>{a.user.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </main>
  );
}
