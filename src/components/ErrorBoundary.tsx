'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-800">
              오류가 발생했습니다
            </h2>
            <p className="max-w-md text-sm text-gray-500">
              페이지를 새로고침하거나 잠시 후 다시 시도해 주세요.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              새로고침
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
