import { createHash, randomBytes } from 'crypto';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = `fs_${randomBytes(24).toString('hex')}`;
  return {
    raw,
    prefix: raw.slice(0, 10),
    hash: sha256(raw),
  };
}

/** Stable 0–99 bucket for percentage rollout. */
export function rolloutBucket(userId: string, flagKey: string): number {
  const digest = createHash('sha256').update(`${flagKey}:${userId}`).digest();
  return digest.readUInt32BE(0) % 100;
}
