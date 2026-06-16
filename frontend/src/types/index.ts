export interface LoginRequest {
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: number;
}

export interface VideoItem {
  vod_id: string | number;
  vod_name: string;
  vod_pic: string;
  vod_year?: string;
  vod_remarks?: string;
  type_id?: string | number;
  type_name?: string;
  site_key?: string;
}

export interface SearchResult {
  code: number;
  msg: string;
  total: number;
  list: VideoItem[];
}

export interface VideoDetail {
  vod_id: string | number;
  vod_name: string;
  vod_pic: string;
  vod_year?: string;
  vod_remarks?: string;
  vod_content?: string;
  vod_play_from?: string;
  vod_play_url?: string;
  type_id?: string | number;
  type_name?: string;
}

export interface LiveChannel {
  id: string;
  tvgId?: string;
  name: string;
  url: string;
  logo?: string;
  group?: string;
}

export interface LiveSource {
  key: string;
  name: string;
  url: string;
  ua?: string;
  epg?: string;
  channelNumber?: number;
  disabled?: boolean;
}

export interface User {
  token: string;
  expiresAt: number;
}

export interface DoubanItem {
  id: string;
  title: string;
  poster: string;
  rate: string;
  year: string;
}

export interface DoubanResult {
  code: number;
  message: string;
  list: DoubanItem[];
}

export interface BangumiCalendarData {
  weekday: {
    en: string;
    cn: string;
    ja: string;
    id: number;
  };
  items: BangumiItem[];
}

export interface BangumiItem {
  id: number;
  name: string;
  name_cn: string;
  rating: {
    score: number;
  };
  air_date: string;
  images: {
    large: string;
    common: string;
    medium: string;
    small: string;
    grid: string;
  };
}



