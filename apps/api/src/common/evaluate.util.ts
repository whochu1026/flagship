import { rolloutBucket } from './crypto.util';

export type FlagConfig = {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetUsers: string[];
};

export type EvaluateResult = {
  key: string;
  enabled: boolean;
  reason:
    | 'FLAG_DISABLED'
    | 'TARGET_USER'
    | 'ROLLOUT_INCLUDED'
    | 'ROLLOUT_EXCLUDED'
    | 'NO_USER';
};

export function evaluateFlag(flag: FlagConfig, userId?: string): EvaluateResult {
  if (!flag.enabled) {
    return { key: flag.key, enabled: false, reason: 'FLAG_DISABLED' };
  }

  if (userId && flag.targetUsers.includes(userId)) {
    return { key: flag.key, enabled: true, reason: 'TARGET_USER' };
  }

  if (!userId) {
    // Without a user id, only fully open flags (100%) pass.
    if (flag.rolloutPercentage >= 100) {
      return { key: flag.key, enabled: true, reason: 'ROLLOUT_INCLUDED' };
    }
    return { key: flag.key, enabled: false, reason: 'NO_USER' };
  }

  if (flag.rolloutPercentage <= 0) {
    return { key: flag.key, enabled: false, reason: 'ROLLOUT_EXCLUDED' };
  }

  if (flag.rolloutPercentage >= 100) {
    return { key: flag.key, enabled: true, reason: 'ROLLOUT_INCLUDED' };
  }

  const bucket = rolloutBucket(userId, flag.key);
  if (bucket < flag.rolloutPercentage) {
    return { key: flag.key, enabled: true, reason: 'ROLLOUT_INCLUDED' };
  }
  return { key: flag.key, enabled: false, reason: 'ROLLOUT_EXCLUDED' };
}
