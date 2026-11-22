import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MAX_SEARCH_HISTORY,
  addSearchHistory,
  clearSearchHistory,
  readSearchHistory,
  removeSearchHistory,
} from './searchHistory';

const KEY = 'searchHistory';

describe('searchHistory', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('starts empty', () => {
    expect(readSearchHistory()).toEqual([]);
  });

  it('keeps the newest keyword first', () => {
    addSearchHistory('凡人');
    addSearchHistory('斗破');
    expect(readSearchHistory()).toEqual(['斗破', '凡人']);
  });

  it('moves a repeated keyword to the front instead of duplicating it', () => {
    addSearchHistory('凡人');
    addSearchHistory('斗破');
    addSearchHistory('凡人');
    expect(readSearchHistory()).toEqual(['凡人', '斗破']);
  });

  it('trims whitespace and ignores blank input', () => {
    addSearchHistory('  凡人  ');
    addSearchHistory('   ');
    expect(readSearchHistory()).toEqual(['凡人']);
  });

  it('caps the list at MAX_SEARCH_HISTORY, dropping the oldest', () => {
    for (let i = 1; i <= MAX_SEARCH_HISTORY + 4; i++) addSearchHistory(`词${i}`);
    const list = readSearchHistory();
    expect(list).toHaveLength(MAX_SEARCH_HISTORY);
    expect(list[0]).toBe(`词${MAX_SEARCH_HISTORY + 4}`);
    expect(list).not.toContain('词1');
  });

  it('removes a single keyword', () => {
    addSearchHistory('凡人');
    addSearchHistory('斗破');
    expect(removeSearchHistory('凡人')).toEqual(['斗破']);
    expect(readSearchHistory()).toEqual(['斗破']);
  });

  it('clears everything', () => {
    addSearchHistory('凡人');
    expect(clearSearchHistory()).toEqual([]);
    expect(readSearchHistory()).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('survives a corrupt stored value by degrading to empty', () => {
    localStorage.setItem(KEY, '{ not json');
    expect(readSearchHistory()).toEqual([]);
  });

  it('drops non-string entries from a tampered list', () => {
    localStorage.setItem(KEY, JSON.stringify(['凡人', 42, null, { a: 1 }, '斗破']));
    expect(readSearchHistory()).toEqual(['凡人', '斗破']);
  });

  it('accepts a JSON array that is longer than the cap', () => {
    localStorage.setItem(KEY, JSON.stringify(Array.from({ length: 30 }, (_, i) => `词${i}`)));
    expect(readSearchHistory()).toHaveLength(MAX_SEARCH_HISTORY);
  });
});
