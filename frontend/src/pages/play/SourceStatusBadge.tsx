import type { SourceItem } from './types';

interface SourceStatusBadgeProps {
  source: Pick<SourceItem, 'status' | 'speed'>;
}

export function SourceStatusBadge({ source }: SourceStatusBadgeProps) {
  if (source.status === 'testing') {
    return <span className="text-primary animate-pulse">测速中...</span>;
  }
  if (source.speed) {
    return (
      <span>
        <span className="text-blue-400">{source.speed.loadSpeed}</span>{' '}
        <span className="text-orange-500">{source.speed.pingTime}ms</span>
      </span>
    );
  }
  return <span className="text-muted">无测速数据</span>;
}
