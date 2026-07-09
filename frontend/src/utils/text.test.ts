import { describe, it, expect } from 'vitest';
import { cleanVodContent, decodeHtmlEntities } from './text';

describe('cleanVodContent', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(cleanVodContent(undefined)).toBe('');
    expect(cleanVodContent(null)).toBe('');
    expect(cleanVodContent('')).toBe('');
  });

  it('decodes HTML entities including &nbsp;', () => {
    expect(cleanVodContent('Hello&nbsp;World')).toBe('Hello World');
    expect(cleanVodContent('A &amp; B')).toBe('A & B');
  });

  it('collapses NBSP / full-width / tab / newline whitespace into single spaces', () => {
    const input = '简介　第一部分\t\n　第二部分';
    expect(cleanVodContent(input)).toBe('简介 第一部分 第二部分');
  });

  it('strips script and style tags (XSS-safe)', () => {
    const input = '剧情介绍<script>alert(1)</script>正常文字<style>.x{color:red}</style>';
    const out = cleanVodContent(input);
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('正常文字');
  });

  it('removes residual HTML tags', () => {
    // DOMParser textContent concatenates block elements without extra space,
    // which is acceptable for a synopsis. The key invariant: no tags remain.
    const out = cleanVodContent('<p>正文</p><br/>更多');
    expect(out).not.toContain('<');
    expect(out).toBe('正文更多');
  });
});

describe('decodeHtmlEntities', () => {
  it('decodes common entities', () => {
    expect(decodeHtmlEntities('&lt;b&gt;&amp;&lt;/b&gt;')).toBe('<b>&</b>');
    expect(decodeHtmlEntities('&quot;hi&quot;')).toBe('"hi"');
  });
  it('leaves unknown entities untouched', () => {
    expect(decodeHtmlEntities('&ghost;')).toBe('&ghost;');
  });
});
