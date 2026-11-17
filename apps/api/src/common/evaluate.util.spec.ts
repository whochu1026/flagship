import { evaluateFlag } from './evaluate.util';

describe('evaluateFlag', () => {
  const base = {
    key: 'new_dashboard',
    enabled: true,
    rolloutPercentage: 0,
    targetUsers: [] as string[],
  };

  it('returns false when disabled', () => {
    expect(evaluateFlag({ ...base, enabled: false }, 'u1').enabled).toBe(false);
  });

  it('includes target users even at 0% rollout', () => {
    const res = evaluateFlag(
      { ...base, targetUsers: ['user_101'], rolloutPercentage: 0 },
      'user_101',
    );
    expect(res.enabled).toBe(true);
    expect(res.reason).toBe('TARGET_USER');
  });

  it('includes everyone at 100%', () => {
    expect(
      evaluateFlag({ ...base, rolloutPercentage: 100 }, 'anyone').enabled,
    ).toBe(true);
  });

  it('excludes non-targets at 0%', () => {
    expect(
      evaluateFlag({ ...base, rolloutPercentage: 0 }, 'user_999').enabled,
    ).toBe(false);
  });
});
