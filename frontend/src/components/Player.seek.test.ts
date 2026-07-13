import { describe, it, expect, vi } from 'vitest';

// Isolate the Player module's heavy side-effecting imports so we can unit-test
// the pure seek resolver without booting a real Artplayer / Hls instance.
// (theme.ts / adblock.ts are side-effect-free at import time and are kept real.)
vi.mock('artplayer', () => ({ default: {} }));
vi.mock('hls.js', () => ({ default: class {} }));

import { resolveSwitchSeekTarget } from './Player';

// The canonical regression timestamp: "继续播放" toast showed 20:42 (1242s)
// but the player actually started from 0:00 before the fix.
const RESUME_AT_20_42 = 20 * 60 + 42; // 1242

describe('resolveSwitchSeekTarget (mid-play source-switch resume)', () => {
  it('prefers the in-state live position when non-zero — regression: resume at 20:42, not 0', () => {
    // State holds the real resume point; video element would have raced to 0.
    expect(resolveSwitchSeekTarget(RESUME_AT_20_42, 0)).toBe(RESUME_AT_20_42);
  });

  it('falls back to the raw video element time only when the state value is 0', () => {
    expect(resolveSwitchSeekTarget(0, RESUME_AT_20_42)).toBe(RESUME_AT_20_42);
  });

  it('returns 0 when both inputs are 0 (no resume point available)', () => {
    expect(resolveSwitchSeekTarget(0, 0)).toBe(0);
  });

  it('always prefers the state value regardless of the video element value (deterministic)', () => {
    // State at 20:42 even though the video element reports a tiny 5s — state wins.
    expect(resolveSwitchSeekTarget(RESUME_AT_20_42, 5)).toBe(RESUME_AT_20_42);
  });

  it('returns the smaller state value rather than the larger video element value (state wins)', () => {
    // State at 5s, video element at 20:42 — the deterministic state value is used.
    expect(resolveSwitchSeekTarget(5, RESUME_AT_20_42)).toBe(5);
  });

  it('treats a negative state value as zero and falls back to the video element time', () => {
    expect(resolveSwitchSeekTarget(-1, 100)).toBe(100);
  });

  it('returns 0 when the state value is negative and the video element time is also non-positive', () => {
    expect(resolveSwitchSeekTarget(-5, -3)).toBe(0);
  });

  it('accepts fractional positive state values', () => {
    expect(resolveSwitchSeekTarget(0.5, 0)).toBe(0.5);
  });
});
