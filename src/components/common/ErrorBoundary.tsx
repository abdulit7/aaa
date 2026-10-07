import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ClipboardList } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('GateMaster caught an unhandled page error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-xl shadow-lg border border-red-200 p-6 sm:p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-red-50/50">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {this.props.fallbackTitle || 'Page Display Error'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                An unexpected error prevented this page from rendering properly.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs font-mono text-red-700 overflow-x-auto max-h-36">
                {this.state.error.message}
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#15803d] hover:bg-[#16a34a] text-white rounded-lg font-semibold text-sm shadow-sm transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </button>
              <a
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg font-semibold text-sm transition-colors"
              >
                <Home className="w-4 h-4" />
                Dashboard
              </a>
              <a
                href="/register"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg font-semibold text-sm transition-colors"
              >
                <ClipboardList className="w-4 h-4" />
                Register
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
