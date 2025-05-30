import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ArrowPathIcon, ExclamationTriangleIcon, BugAntIcon } from '@heroicons/react/24/outline';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component that catches JavaScript errors in its child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Catch errors in any components below and re-render with error message
    this.setState({
      error,
      errorInfo
    });

    // Log error to console
    console.error('Error caught by ErrorBoundary:', error, errorInfo);

    // Call optional error handler from props
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you could also log to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: logErrorToService(error, errorInfo);
      // This could be a call to Sentry, LogRocket, etc.
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error state if props change and resetOnPropsChange is true
    if (
      this.state.hasError &&
      this.props.resetOnPropsChange &&
      prevProps.children !== this.props.children
    ) {
      this.resetErrorBoundary();
    }
  }

  resetErrorBoundary = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Otherwise, render our default fallback UI
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
          <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-xl dark:bg-slate-800">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full dark:bg-red-900/30">
              <ExclamationTriangleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            
            <h2 className="mb-4 text-2xl font-bold text-center">Something went wrong</h2>
            
            <p className="mb-6 text-center text-slate-600 dark:text-slate-300">
              The application encountered an unexpected error. We apologize for the inconvenience.
            </p>

            {/* Show detailed error in development */}
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <div className="p-4 mb-6 overflow-auto text-sm bg-slate-100 rounded-md dark:bg-slate-700 dark:text-slate-300 max-h-60">
                <div className="flex items-center gap-2 mb-2 font-semibold text-red-600 dark:text-red-400">
                  <BugAntIcon className="w-5 h-5" />
                  <span>Error Details (Development Only):</span>
                </div>
                <p className="font-mono">{this.state.error.toString()}</p>
                {this.state.errorInfo && (
                  <div className="mt-2 font-mono text-xs">
                    <p className="font-semibold">Component Stack:</p>
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={this.resetErrorBoundary}
                className="flex items-center justify-center w-full gap-2 px-4 py-3 font-medium text-white transition-colors bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <ArrowPathIcon className="w-5 h-5" />
                Try Again
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center w-full gap-2 px-4 py-3 font-medium transition-colors border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
              >
                Refresh Page
              </button>
            </div>
          </div>
          
          <p className="mt-6 text-sm text-center text-slate-500 dark:text-slate-400">
            If this problem persists, please contact support.
          </p>
        </div>
      );
    }

    // If there's no error, render children normally
    return this.props.children;
  }
}

export { ErrorBoundary };
