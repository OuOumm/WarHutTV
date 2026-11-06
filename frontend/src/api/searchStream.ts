import { handleAuthFailure } from './client';

export interface SearchStreamStartEvent {
  keyword: string;
  site_count: number;
}

export interface SearchStreamResultEvent<T> {
  site: string;
  name: string;
  data: T;
  completed: number;
  total: number;
}

export interface SearchStreamErrorEvent {
  site: string;
  name: string;
  error: string;
  /** True when the backend discarded the source (e.g. per-site timeout). */
  discarded?: boolean;
  completed?: number;
  total?: number;
}

export interface SearchStreamStatusEvent {
  completed: number;
  total: number;
}

export interface SearchStreamHandlers<T> {
  onStart?: (event: SearchStreamStartEvent) => void;
  onResult?: (event: SearchStreamResultEvent<T>) => void;
  onErrorEvent?: (event: SearchStreamErrorEvent) => void;
  onTimeout?: (event: SearchStreamStatusEvent) => void;
  onDone?: (event: SearchStreamStatusEvent) => void;
}

interface StreamSearchOptions {
  signal?: AbortSignal;
  page?: number;
}

interface SseMessage {
  event: string;
  data: string;
}

export async function streamSearchResults<T>(
  keyword: string,
  handlers: SearchStreamHandlers<T>,
  options: StreamSearchOptions = {},
): Promise<void> {
  const params = new URLSearchParams({ wd: keyword });
  if (options.page) params.set('pg', String(options.page));

  const response = await fetch(`/api/search/stream?${params.toString()}`, {
    credentials: 'include',
    signal: options.signal,
    headers: { Accept: 'text/event-stream' },
  });

  if (!response.ok) {
    // Surface auth failures consistently with the rest of the app.
    if (response.status === 401) handleAuthFailure();
    throw new Error(`搜索连接失败: ${response.status}`);
  }
  if (!response.body) {
    throw new Error('搜索连接不支持流式响应');
  }
  // A proxy or SPA fallback can answer 200 with HTML. Without this check the
  // parser would silently consume zero events and the UI would say "no
  // results" instead of surfacing a broken response.
  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    throw new Error(`搜索连接返回了非流式响应: ${contentType || 'unknown'}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer = processSseBuffer(buffer + decoder.decode(value, { stream: true }), handlers);
    }

    buffer += decoder.decode();
    processSseBuffer(`${buffer}\n\n`, handlers);
  } finally {
    reader.releaseLock();
  }
}

function processSseBuffer<T>(buffer: string, handlers: SearchStreamHandlers<T>): string {
  const normalized = buffer.replaceAll('\r\n', '\n');
  const chunks = normalized.split('\n\n');
  const rest = chunks.pop() || '';

  for (const chunk of chunks) {
    const message = parseSseMessage(chunk);
    if (!message) continue;
    dispatchSseMessage(message, handlers);
  }

  return rest;
}

function parseSseMessage(chunk: string): SseMessage | null {
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of chunk.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

function dispatchSseMessage<T>(message: SseMessage, handlers: SearchStreamHandlers<T>) {
  // Unknown events (e.g. the `ping` heartbeat) are ignored on purpose: the
  // parser must never throw because a newer backend sent something new.
  if (message.event !== 'start' && message.event !== 'result' &&
      message.event !== 'error' && message.event !== 'timeout' &&
      message.event !== 'done') {
    return;
  }

  let data: unknown;
  try {
    data = JSON.parse(message.data);
  } catch {
    // A truncated frame (connection cut mid-write) must not abort the whole
    // stream — the remaining sites can still deliver results.
    console.warn('[search] skipped malformed SSE frame', message.event, message.data);
    return;
  }

  switch (message.event) {
    case 'start':
      handlers.onStart?.(data as SearchStreamStartEvent);
      return;
    case 'result':
      handlers.onResult?.(data as SearchStreamResultEvent<T>);
      return;
    case 'error':
      handlers.onErrorEvent?.(data as SearchStreamErrorEvent);
      return;
    case 'timeout':
      handlers.onTimeout?.(data as SearchStreamStatusEvent);
      return;
    case 'done':
      handlers.onDone?.(data as SearchStreamStatusEvent);
      return;
    default:
      return;
  }
}
