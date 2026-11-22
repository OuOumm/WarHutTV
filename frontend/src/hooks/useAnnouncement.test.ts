import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAnnouncement } from './useAnnouncement';

const mockConfig = { current: null as null | { announcement: string; site_name: string } };

vi.mock('../store/config', () => ({
  useConfig: () => ({ config: mockConfig.current, refresh: vi.fn() }),
}));

const DISMISS_KEY = 'warhut-announcement-dismissed';

describe('useAnnouncement', () => {
  beforeEach(() => {
    localStorage.clear();
    mockConfig.current = { announcement: '网站仅作展示', site_name: 'WarHutTV' };
  });

  afterEach(() => {
    localStorage.clear();
    mockConfig.current = null;
  });

  it('shows a non-empty announcement on a fresh visit', async () => {
    const { result } = renderHook(() => useAnnouncement(true));
    await waitFor(() => expect(result.current.isVisible).toBe(true));
  });

  it('does not show anything once the same content was dismissed', async () => {
    localStorage.setItem(DISMISS_KEY, JSON.stringify({ content: '网站仅作展示', dismissedAt: 1 }));

    const { result } = renderHook(() => useAnnouncement(true));
    // Give the effect a chance to run, then assert it stayed hidden.
    await waitFor(() => expect(mockConfig.current).not.toBeNull());
    expect(result.current.isVisible).toBe(false);
  });

  it('shows again when the operator changes the text', async () => {
    localStorage.setItem(DISMISS_KEY, JSON.stringify({ content: '旧公告', dismissedAt: 1 }));

    const { result } = renderHook(() => useAnnouncement(true));
    await waitFor(() => expect(result.current.isVisible).toBe(true));
  });

  it('stays hidden for a blank announcement instead of opening an empty dialog', async () => {
    mockConfig.current = { announcement: '   ', site_name: 'WarHutTV' };

    const { result } = renderHook(() => useAnnouncement(true));
    await waitFor(() => expect(mockConfig.current).not.toBeNull());
    expect(result.current.isVisible).toBe(false);
  });

  it('stays hidden while signed out', async () => {
    const { result } = renderHook(() => useAnnouncement(false));
    await waitFor(() => expect(mockConfig.current).not.toBeNull());
    expect(result.current.isVisible).toBe(false);
  });

  it('persists the dismissal marker so the next visit is quiet', async () => {
    const { result } = renderHook(() => useAnnouncement(true));
    await waitFor(() => expect(result.current.isVisible).toBe(true));

    act(() => result.current.dismiss());

    expect(result.current.isVisible).toBe(false);
    expect(JSON.parse(localStorage.getItem(DISMISS_KEY)!)).toMatchObject({ content: '网站仅作展示' });
  });

  it('survives a corrupted dismissal marker by treating it as "not dismissed"', async () => {
    localStorage.setItem(DISMISS_KEY, '{ broken');

    const { result } = renderHook(() => useAnnouncement(true));
    await waitFor(() => expect(result.current.isVisible).toBe(true));
  });
});
