import { generateApiKey, rolloutBucket, sha256 } from './crypto.util';

describe('crypto.util', () => {
  it('hashes deterministically', () => {
    expect(sha256('a')).toBe(sha256('a'));
    expect(sha256('a')).not.toBe(sha256('b'));
  });

  it('generates api keys', () => {
    const key = generateApiKey();
    expect(key.raw.startsWith('fs_')).toBe(true);
    expect(key.hash).toBe(sha256(key.raw));
  });

  it('computes stable rollout buckets', () => {
    const a = rolloutBucket('user_1', 'new_dashboard');
    const b = rolloutBucket('user_1', 'new_dashboard');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(100);
  });
});
