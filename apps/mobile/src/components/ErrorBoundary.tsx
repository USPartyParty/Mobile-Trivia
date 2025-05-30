import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ArrowPathIcon, ExclamationTriangleIcon, BugAntIcon, HomeIcon } from '@heroicons/react/24/outline';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode; // Optional custom fallback UI
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean; // Option to reset error state if props change
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Mobile-optimized Error Boundary component.
 * Catches JavaScript errors in its child component tree, logs them,
 * and displays a user-friendly fallback UI with recovery options.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      error,
      errorInfo,
    });

    console.error('Mobile ErrorBoundary caught an error:', error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In a production environment, you would log this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: reportErrorToService(error, { componentStack: errorInfo.componentStack });
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.hasError &&
      this.props.resetOnPropsChange &&
      prevProps.children !== this.props.children // A simple way to check if relevant props changed
    ) {
      this.resetErrorBoundary();
    }
  }

  resetErrorBoundary = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Mobile-friendly default fallback UI
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
          <div className="w-full max-w-sm p-6 bg-white rounded-xl shadow-xl dark:bg-slate-800">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full dark:bg-red-900/30">
              <ExclamationTriangleIcon className="w-8 h-8 text-red-500 dark:text-red-400" />
            </div>

            <h2 className="mb-3 text-xl font-bold text-center">Oops! Something went wrong.</h2>

            <p className="mb-6 text-sm text-center text-slate-600 dark:text-slate-300">
              We've encountered an unexpected issue. Please try one of the options below.
            </p>

            {/* Error details for development */}
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <div className="p-3 mb-5 overflow-auto text-xs bg-slate-100 rounded-md dark:bg-slate-700 dark:text-slate-300 max-h-40">
                <div className="flex items-center gap-1.5 mb-1.5 font-semibold text-red-500 dark:text-red-400">
                  <BugAntIcon className="w-4 h-4" />
                  <span>Dev Error Details:</span>
                </div>
                <p className="font-mono">{this.state.error.toString()}</p>
                {this.state.errorInfo?.componentStack && (
                  <details className="mt-1">
                    <summary className="cursor-pointer font-semibold">Component Stack</summary>
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Recovery Options - Touch-friendly buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={this.resetErrorBoundary}
                className="btn btn-primary w-full" // Assuming .btn and .btn-primary provide adequate padding and styling
              >
                <ArrowPathIcon className="w-5 h-5 mr-2" />
                Try Again
              </button>

              <button
                onClick={() => window.location.reload()}
                className="btn btn-outline w-full" // Assuming .btn and .btn-outline are defined
              >
                Refresh Page
              </button>
              
              <button
                onClick={() => window.location.href = '/'} // Navigate to home
                className="btn btn-outline w-full"
              >
                <HomeIcon className="w-5 h-5 mr-2" />
                Go Home
              </button>
            </div>
          </div>

          <p className="mt-6 text-xs text-center text-slate-500 dark:text-slate-400">
            If the problem persists, please contact support or try again later.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
