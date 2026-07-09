import { describe, it, expect } from 'vitest';
import { filterYellowItems, isExactMatch, isYellowContent, normalizeString } from './filter';

describe('filter utils', () => {
  describe('isYellowContent', () => {
    it('detects yellow-list words case-insensitively', () => {
      expect(isYellowContent('伦理片')).toBe(true);
      expect(isYellowContent('日本无码')).toBe(true);
      expect(isYellowContent('Ethical Film 伦理')).toBe(true);
    });
    it('returns false for clean titles', () => {
      expect(isYellowContent('权利的游戏')).toBe(false);
      expect(isYellowContent('')).toBe(false);
    });
  });

  describe('filterYellowItems', () => {
    it('removes items whose name/type/remarks/content hit the yellow list', () => {
      const items = [
        { vod_name: '普通电影', type_name: '剧情' },
        { vod_name: '福利视频', type_name: '剧情' },
        { vod_name: '某剧', type_name: '港台三级' },
        { vod_name: '某剧2', vod_remarks: '无码' },
      ];
      const out = filterYellowItems(items);
      expect(out).toHaveLength(1);
      expect(out[0].vod_name).toBe('普通电影');
    });
    it('also checks the title field for douban-style items', () => {
      const items = [{ title: '里番动漫推荐' }, { title: '正常番剧' }];
      const out = filterYellowItems(items);
      expect(out).toHaveLength(1);
      expect(out[0].title).toBe('正常番剧');
    });
  });

  describe('normalizeString', () => {
    it('strips spaces, punctuation and lowercases', () => {
      expect(normalizeString('Game of Thrones (2011)')).toBe('gameofthrones2011');
      expect(normalizeString('权 利 的 游 戏')).toBe('权利的游戏');
    });
  });

  describe('isExactMatch', () => {
    it('matches identical normalized strings', () => {
      expect(isExactMatch('权力的游戏', '权力的游戏')).toBe(true);
    });
    it('matches when name starts with keyword and suffix is digits (year/season)', () => {
      expect(isExactMatch('权力的游戏 2011', '权力的游戏')).toBe(true);
      expect(isExactMatch('权力的游戏第2季', '权力的游戏')).toBe(false); // suffix has non-digit
    });
    it('rejects when keyword is only a mid/prefix substring', () => {
      expect(isExactMatch('权力的游戏前传', '权力的游戏')).toBe(false);
    });
    it('returns false on empty inputs', () => {
      expect(isExactMatch('', 'x')).toBe(false);
      expect(isExactMatch('x', '')).toBe(false);
    });
    it('is case-insensitive', () => {
      expect(isExactMatch('GAME OF THRONES', 'game of thrones')).toBe(true);
    });
  });
});
