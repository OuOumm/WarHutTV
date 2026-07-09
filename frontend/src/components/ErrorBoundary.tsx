import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

/**
 * App-wide error boundary. Any uncaught render error inside the routed tree
 * (page/component crash) is caught here instead of taking down the whole SPA
 * with a blank screen. Shows a recoverable fallback with reload / home actions.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || '未知错误' };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Hook point for telemetry (Sentry / backend log). Keep console for now.
    console.error('[ErrorBoundary] Uncaught UI error:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return <ErrorFallback message={this.state.message} onReload={this.handleReload} />;
  }
}

function ErrorFallback({ message, onReload }: { message: string; onReload: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-glass-border bg-glass backdrop-blur-sm p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 2 0 0 0 1.71 3h16.94a2 2 2 0 0 0 1.71-3L13.71 3.86a2 2 2 0 0 0-3.42 0z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-text">页面出错了</h1>
        <p className="mt-2 text-sm text-muted break-words">
          发生了一个意外错误，你可以重试或返回首页。
        </p>
        {message && (
          <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs text-muted font-mono break-all">
            {message}
          </p>
        )}
        <div className="mt-6 flex gap-3 justify-center">
          <button
            onClick={() => navigate('/')}
            className="rounded-lg border border-glass-border px-4 py-2 text-sm text-text transition-colors hover:bg-surface"
          >
            返回首页
          </button>
          <button
            onClick={onReload}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-deep transition-opacity hover:opacity-90"
          >
            重新加载
          </button>
        </div>
      </div>
    </div>
  );
}

export default ErrorBoundary;
