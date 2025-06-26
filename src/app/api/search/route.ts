import { NextResponse } from 'next/server';

import { API_CONFIG, ApiSite, getApiSites, getCacheTime } from '@/lib/config';

export interface SearchResult {
  id: string;
  title: string;
  poster: string;
  episodes?: number;
  source: string;
  source_name: string;
}

interface ApiSearchItem {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_remarks?: string;
  vod_play_url?: string;
}

async function searchFromApi(
  apiSite: ApiSite,
  query: string
): Promise<SearchResult[]> {
  try {
    const apiBaseUrl = apiSite.api;
    const apiUrl =
      apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(query);
    const apiName = apiSite.name;

    // 添加超时处理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(apiUrl, {
      headers: API_CONFIG.search.headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (
      !data ||
      !data.list ||
      !Array.isArray(data.list) ||
      data.list.length === 0
    ) {
      return [];
    }

    // 处理第一页结果
    const results = data.list.map((item: ApiSearchItem) => {
      let episodes: number | undefined = undefined;

      // 使用正则表达式从 vod_play_url 提取 m3u8 链接
      if (item.vod_play_url) {
        const m3u8Regex = /\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
        const matches = item.vod_play_url.match(m3u8Regex);
        episodes = matches ? matches.length : undefined;
      }

      return {
        id: item.vod_id,
        title: item.vod_name,
        poster: item.vod_pic,
        episodes,
        source: apiSite.key,
        source_name: apiName,
      };
    });

    // 获取总页数
    const pageCount = data.pagecount || 1;
    // 确定需要获取的额外页数
    const pagesToFetch = Math.min(
      pageCount - 1,
      API_CONFIG.search.maxPages - 1
    );

    // 如果有额外页数，获取更多页的结果
    if (pagesToFetch > 0) {
      const additionalPagePromises = [];

      for (let page = 2; page <= pagesToFetch + 1; page++) {
        const pageUrl =
          apiBaseUrl +
          API_CONFIG.search.pagePath
            .replace('{query}', encodeURIComponent(query))
            .replace('{page}', page.toString());

        const pagePromise = (async () => {
          try {
            const pageController = new AbortController();
            const pageTimeoutId = setTimeout(
              () => pageController.abort(),
              8000
            );

            const pageResponse = await fetch(pageUrl, {
              headers: API_CONFIG.search.headers,
              signal: pageController.signal,
            });

            clearTimeout(pageTimeoutId);

            if (!pageResponse.ok) return [];

            const pageData = await pageResponse.json();

            if (!pageData || !pageData.list || !Array.isArray(pageData.list))
              return [];

            return pageData.list.map((item: ApiSearchItem) => {
              let episodes: number | undefined = undefined;

              // 使用正则表达式从 vod_play_url 提取 m3u8 链接
              if (item.vod_play_url) {
                const m3u8Regex = /\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
                const matches = item.vod_play_url.match(m3u8Regex);
                episodes = matches ? matches.length : undefined;
              }

              return {
                id: item.vod_id,
                title: item.vod_name,
                poster: item.vod_pic,
                episodes,
                source: apiSite.key,
                source_name: apiName,
              };
            });
          } catch (error) {
            return [];
          }
        })();

        additionalPagePromises.push(pagePromise);
      }

      // 等待所有额外页的结果
      const additionalResults = await Promise.all(additionalPagePromises);

      // 合并所有页的结果
      additionalResults.forEach((pageResults) => {
        if (pageResults.length > 0) {
          results.push(...pageResults);
        }
      });
    }

    return results;
  } catch (error) {
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    const cacheTime = getCacheTime();
    return NextResponse.json(
      { results: [] },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}`,
        },
      }
    );
  }

  const apiSites = getApiSites();
  const searchPromises = apiSites.map((site) => searchFromApi(site, query));

  try {
    const results = await Promise.all(searchPromises);
    const flattenedResults = results.flat();
    const cacheTime = getCacheTime();

    return NextResponse.json(
      { results: flattenedResults },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}`,
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: '搜索失败' }, { status: 500 });
  }
}
