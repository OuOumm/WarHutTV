import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DoubanItem, VideoItem } from '../types';

// Keep the card test isolated from Dexie / image CDN logic: the bug under test
// is purely about DOM layering and pointer events.
vi.mock('../store/favorites', () => ({
  favoritesStore: { isFavorite: vi.fn().mockResolvedValue(false), toggle: vi.fn() },
  subscribeFavorites: vi.fn(() => () => {}),
}));
vi.mock('../store/history', () => ({
  historyStore: { remove: vi.fn() },
}));
vi.mock('../utils/image', () => ({
  processImageUrl: (u: string) => u,
  buildDoubanSrcSet: () => undefined,
  buildBangumiSrcSet: () => undefined,
  CARD_IMAGE_SIZES: '100vw',
}));

import VideoCard from './VideoCard';

const douban: DoubanItem = {
  id: '1', title: '空枪', poster: 'https://example.com/p.jpg', rate: '7.2', year: '2026',
};
const video: VideoItem = {
  vod_id: 34868, vod_name: '凡人修仙传', vod_pic: '/placeholder.svg', site_key: 'zuida.xyz',
};

function renderCard(node: React.ReactNode) {
  const result = render(<MemoryRouter>{node}</MemoryRouter>);
  const card = result.container.querySelector('.card-base') as HTMLElement;
  const link = card.querySelector('a[href]') as HTMLAnchorElement;
  return { ...result, card, link };
}

/**
 * The decorative PlayOverlay shares `z-[3]` with the full-card navigation
 * <Link> but is rendered LATER in the DOM. Same stacking level + later paint
 * order means it wins hit-testing at the card centre. If it is not
 * `pointer-events-none`, every click on the card lands on a non-interactive
 * div and nothing happens — exactly the "clicking a card does nothing" bug.
 */
function decorativeOverlay(card: HTMLElement): HTMLElement | undefined {
  return [...card.querySelectorAll('div')].find(
    (d) => d.className.includes('z-[3]') && d.className.includes('inset-0'),
  );
}

describe('VideoCard click-through overlay (regression: card clicks were swallowed)', () => {
  it('renders a full-card navigation link to the douban search URL', () => {
    const { link } = renderCard(<VideoCard douban={douban} from="douban" />);
    expect(link.getAttribute('href')).toBe('/search?wd=%E7%A9%BA%E6%9E%AA');
    expect(link.className).toContain('inset-0');
    expect(link.className).toContain('z-[3]');
    expect(screen.getByRole('link', { name: '空枪' })).toBeTruthy();
  });

  it('renders a full-card navigation link to the VOD play route', () => {
    const { link } = renderCard(<VideoCard video={video} from="vod" />);
    expect(link.getAttribute('href')).toBe('/play/zuida.xyz/34868');
    expect(link.className).toContain('z-[3]');
  });

  it('the decorative overlay shares z-[3] and is painted after the link', () => {
    const { card, link } = renderCard(<VideoCard douban={douban} from="douban" />);
    const overlay = decorativeOverlay(card);
    expect(overlay).toBeTruthy();
    expect(overlay!.className).toContain('z-[3]');
    // DOCUMENT_POSITION_FOLLOWING (4): overlay comes after the link in DOM order.
    expect(link.compareDocumentPosition(overlay!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('the decorative overlay is pointer-events-none so the link receives clicks', () => {
    const { card } = renderCard(<VideoCard douban={douban} from="douban" />);
    const overlay = decorativeOverlay(card)!;
    expect(overlay.className).toContain('pointer-events-none');
    // pointer-events is inherited: nested pulse/play-button divs must not
    // re-enable it, or they would still intercept the click.
    for (const child of overlay.querySelectorAll('*')) {
      expect(child.className).not.toContain('pointer-events-auto');
    }
  });

  it('every full-card decorative overlay (gradient, glow, play) is click-through', () => {
    const { card } = renderCard(<VideoCard douban={douban} from="douban" />);
    const coveringDivs = [...card.querySelectorAll('div')].filter(
      (d) => d.className.includes('absolute') && d.className.includes('inset-0'),
    );
    expect(coveringDivs.length).toBeGreaterThan(0);
    // Any full-card absolute layer either opts out itself or inherits it from
    // a pointer-events-none ancestor (PlayOverlay's children).
    for (const d of coveringDivs) {
      const clickThrough = d.className.includes('pointer-events-none') ||
        !!d.parentElement?.closest('.pointer-events-none');
      expect(clickThrough).toBe(true);
    }
  });
});
