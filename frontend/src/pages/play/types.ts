import type { RefObject } from 'react';
import type { VideoDetail, VideoItem } from '../../types';
import type { SpeedTestResult } from '../../utils/speedtest';

export interface Episode {
  name: string;
  url: string;
}

export interface SourceItem {
  key: string;
  name: string;
  poster?: string;
  episodeCount?: number;
  speed?: SpeedTestResult | null;
  status: 'pending' | 'testing' | 'done' | 'error';
  vodId: string | number;
}

export interface SearchSiteItem extends VideoItem {
  source_name?: string;
}

export interface SearchSiteData {
  site_key: string;
  name?: string;
  list?: SearchSiteItem[];
  source_name?: string;
}

export interface DetailResponse {
  list?: VideoDetail[];
}

export interface SpeedTestResultWithDetail {
  source: SourceItem;
  result: SpeedTestResult;
  vodDetail: VideoDetail | null;
}

export interface SearchProgress {
  completed: number;
  total: number;
  currentSite: string;
}

export interface SourcePanelState {
  episodes: Episode[];
  sources: SourceItem[];
  currentSource: string;
  currentDetail: VideoDetail;
  currentEpisode: Episode | null;
  sourceLoading: boolean;
  activeTab: 'episodes' | 'sources';
  episodePage: number;
  episodesPerPage: number;
  sourceListRef: RefObject<HTMLDivElement | null>;
}

export interface PlayerViewportState {
  playUrl: string;
  optimizeComplete: boolean;
  isOptimizing: boolean;
  searchProgress: SearchProgress | null;
  sources: SourceItem[];
  currentDetail: VideoDetail;
  currentTime: number;
  sourceSwitching: boolean;
}
