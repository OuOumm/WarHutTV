import { describe, it, expect, beforeEach } from 'vitest';
import { historyStore } from './history';
import { db } from './db';

beforeEach(async () => {
  await db.watchHistory.clear();
});

describe('historyStore.record / get (P1-1 episodeIndex)', () => {
  it('persists episodeIndex and round-trips it', async () => {
    await historyStore.record('s1', '42', {
      vod_name: '剧集',
      vod_pic: '',
      episode: '第2集',
      episodeIndex: 1,
      progress: 10,
      duration: 0,
    });
    const rec = await historyStore.get('s1', '42');
    expect(rec).toBeDefined();
    expect(rec!.episodeIndex).toBe(1);
    expect(rec!.episode).toBe('第2集');
  });

  it('upserts by key: repeating record does not create a duplicate row', async () => {
    await historyStore.record('s1', '42', {
      vod_name: '剧集',
      vod_pic: '',
      episode: '第1集',
      progress: 1,
      duration: 0,
    });
    await historyStore.record('s1', '42', {
      vod_name: '剧集',
      vod_pic: '',
      episode: '第3集',
      progress: 2,
      duration: 0,
    });
    const all = await db.watchHistory.toArray();
    expect(all).toHaveLength(1);
    expect((await historyStore.get('s1', '42'))!.episode).toBe('第3集');
  });
});

describe('historyStore.remove (P1-2 precise delete by site:vod_id)', () => {
  it('removes only the exact site+vodId record, never a same-named other-site record', async () => {
    // Two records sharing the same vod_name + vod_id but from different sites —
    // the old removeByName bug cross-deleted both. The precise remove must not.
    await historyStore.record('douban', '111', {
      vod_name: '同名影片',
      vod_pic: '',
      episode: null,
      progress: 5,
      duration: 0,
    });
    await historyStore.record('local', '111', {
      vod_name: '同名影片',
      vod_pic: '',
      episode: null,
      progress: 5,
      duration: 0,
    });

    await historyStore.remove('douban', '111');

    expect(await historyStore.get('douban', '111')).toBeUndefined();
    expect(await historyStore.get('local', '111')).toBeDefined(); // NOT cross-deleted
  });

  it('removes nothing and does not throw for a non-existent record', async () => {
    await expect(historyStore.remove('nope', '999')).resolves.toBeUndefined();
    expect(await historyStore.get('nope', '999')).toBeUndefined();
  });
});
