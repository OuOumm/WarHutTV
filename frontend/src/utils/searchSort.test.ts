import { describe, it, expect } from 'vitest';
import { aggregateKey, sortAggregated, sortItems, yearOf } from './searchSort';
import type { VideoItem } from '../types';

const item = (name: string, year?: string): VideoItem => ({
  vod_id: name,
  vod_name: name,
  vod_pic: '',
  vod_year: year,
});

describe('yearOf', () => {
  it('parses a plain year', () => {
    expect(yearOf(item('a', '2024'))).toBe(2024);
  });

  it('returns 0 for missing, empty, or non-numeric years', () => {
    expect(yearOf(item('a'))).toBe(0);
    expect(yearOf(item('a', ''))).toBe(0);
    expect(yearOf(item('a', '未知'))).toBe(0);
    expect(yearOf({ ...item('a'), vod_year: undefined })).toBe(0);
  });

  it('takes the leading number of a decorated year', () => {
    expect(yearOf(item('a', '2024-05-01'))).toBe(2024);
  });
});

describe('aggregateKey', () => {
  it('normalises punctuation and spacing so bracketed titles group together', () => {
    expect(aggregateKey(item('《凡人修仙传》', '2020'))).toBe(
      aggregateKey(item('凡人 修仙传', '2020')),
    );
  });

  it('separates different years of the same title', () => {
    expect(aggregateKey(item('凡人', '2020'))).not.toBe(aggregateKey(item('凡人', '2024')));
  });

  it('marks a missing year as unknown rather than merging with 0', () => {
    expect(aggregateKey(item('凡人'))).toContain('unknown');
  });
});

const entry = (name: string, year: string | undefined, sourceCount: number) => ({
  key: aggregateKey(item(name, year)),
  sourceCount,
  item: item(name, year),
});

describe('sortAggregated', () => {
  const entries = [
    entry('B', '2020', 1),
    entry('A', '2024', 3),
    entry('C', undefined, 2),
  ];

  it('leaves the incoming order untouched for "default"', () => {
    expect(sortAggregated(entries, 'default').map((e) => e.item.vod_name)).toEqual(['B', 'A', 'C']);
  });

  it('orders newest first and sinks undated entries', () => {
    expect(sortAggregated(entries, 'year-desc').map((e) => e.item.vod_name)).toEqual([
      'A',
      'B',
      'C',
    ]);
  });

  it('orders oldest first but still sinks undated entries', () => {
    expect(sortAggregated(entries, 'year-asc').map((e) => e.item.vod_name)).toEqual([
      'B',
      'A',
      'C',
    ]);
  });

  it('orders by source count, highest first', () => {
    expect(sortAggregated(entries, 'sources').map((e) => e.item.vod_name)).toEqual([
      'A',
      'C',
      'B',
    ]);
  });

  it('does not mutate the caller array', () => {
    const input = [...entries];
    sortAggregated(input, 'year-desc');
    expect(input.map((e) => e.item.vod_name)).toEqual(['B', 'A', 'C']);
  });

  it('handles empty and single-entry input', () => {
    expect(sortAggregated([], 'year-desc')).toEqual([]);
    const one = [entry('A', '2020', 1)];
    expect(sortAggregated(one, 'year-desc')).toBe(one);
  });
});

describe('sortItems', () => {
  const items = [item('B', '2020'), item('A', '2024'), item('C')];

  it('leaves the incoming order untouched for "default"', () => {
    expect(sortItems(items, 'default').map((i) => i.vod_name)).toEqual(['B', 'A', 'C']);
  });

  it('orders by year descending with undated last', () => {
    expect(sortItems(items, 'year-desc').map((i) => i.vod_name)).toEqual(['A', 'B', 'C']);
  });

  it('orders by year ascending with undated last', () => {
    expect(sortItems(items, 'year-asc').map((i) => i.vod_name)).toEqual(['B', 'A', 'C']);
  });

  it('orders by how many sources carry the same title', () => {
    const counts = new Map([
      [aggregateKey(items[0]), 1],
      [aggregateKey(items[1]), 5],
      [aggregateKey(items[2]), 3],
    ]);
    expect(sortItems(items, 'sources', counts).map((i) => i.vod_name)).toEqual(['A', 'C', 'B']);
  });

  it('treats missing counts as 0', () => {
    expect(sortItems(items, 'sources', new Map()).map((i) => i.vod_name)).toEqual([
      'B',
      'A',
      'C',
    ]);
  });

  it('does not mutate the caller array', () => {
    const input = [...items];
    sortItems(input, 'year-desc');
    expect(input.map((i) => i.vod_name)).toEqual(['B', 'A', 'C']);
  });
});
