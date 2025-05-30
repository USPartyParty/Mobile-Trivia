import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

// Toast position
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

// Toast interface
export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration: number; // milliseconds
  createdAt: Date;
  onClose?: () => void;
  isPaused?: boolean;
  progress?: number; // 0-100
}

// Context interface
interface ToastContextValue {
  toasts: Toast[];
  addToast: (options: {
    type: ToastType;
    message: string;
    title?: string;
    duration?: number;
    onClose?: () => void;
  }) => string; // returns toast id
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
  position: ToastPosition;
  setPosition: (position: ToastPosition) => void;
  pauseToast: (id: string) => void;
  resumeToast: (id: string) => void;
}

// Create context
const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Provider props
interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number;
  defaultPosition?: ToastPosition;
  defaultDuration?: number;
}

// Default durations by type (in ms)
const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
};

// Toast icon components
const ToastIcons: Record<ToastType, React.ReactElement> = {
  success: <CheckCircleIcon className="w-5 h-5 text-emerald-500" aria-hidden="true" />,
  error: <ExclamationCircleIcon className="w-5 h-5 text-red-500" aria-hidden="true" />,
  warning: <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" aria-hidden="true" />,
  info: <InformationCircleIcon className="w-5 h-5 text-blue-500" aria-hidden="true" />,
};

// Provider component
export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  maxToasts = 5,
  defaultPosition = 'bottom-center',
  defaultDuration = 4000,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [position, setPosition] = useState<ToastPosition>(defaultPosition);

  // Generate unique ID for toasts
  const generateId = useCallback(() => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }, []);

  // Add a new toast
  const addToast = useCallback(
    ({ type, message, title, duration, onClose }: {
      type: ToastType;
      message: string;
      title?: string;
      duration?: number;
      onClose?: () => void;
    }) => {
      const id = generateId();
      const newToast: Toast = {
        id,
        type,
        message,
        title,
        duration: duration || DEFAULT_DURATIONS[type] || defaultDuration,
        createdAt: new Date(),
        onClose,
        isPaused: false,
        progress: 100,
      };

      // Add toast to the array, respecting the maximum number of toasts
      setToasts((prevToasts) => {
        const updatedToasts = [newToast, ...prevToasts];
        // If we have more than maxToasts, remove the oldest ones
        if (updatedToasts.length > maxToasts) {
          return updatedToasts.slice(0, maxToasts);
        }
        return updatedToasts;
      });

      return id;
    },
    [generateId, defaultDuration, maxToasts]
  );

  // Remove a toast by ID
  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => {
      const toast = prevToasts.find((t) => t.id === id);
      if (toast?.onClose) {
        toast.onClose();
      }
      return prevToasts.filter((toast) => toast.id !== id);
    });
  }, []);

  // Clear all toasts
  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Pause a toast's timer
  const pauseToast = useCallback((id: string) => {
    setToasts((prevToasts) =>
      prevToasts.map((toast) =>
        toast.id === id
          ? {
              ...toast,
              isPaused: true,
            }
          : toast
      )
    );
  }, []);

  // Resume a toast's timer
  const resumeToast = useCallback((id: string) => {
    setToasts((prevToasts) =>
      prevToasts.map((toast) =>
        toast.id === id
          ? {
              ...toast,
              isPaused: false,
            }
          : toast
      )
    );
  }, []);

  // Handle auto-dismiss and progress updates
  useEffect(() => {
    if (toasts.length === 0) return;

    const intervals: NodeJS.Timeout[] = [];
    const timeouts: NodeJS.Timeout[] = [];

    toasts.forEach((toast) => {
      if (toast.isPaused) return;

      // Update progress every 10ms
      const progressInterval = setInterval(() => {
        const elapsedTime = new Date().getTime() - toast.createdAt.getTime();
        const progress = Math.max(0, 100 - (elapsedTime / toast.duration) * 100);

        setToasts((prevToasts) =>
          prevToasts.map((t) =>
            t.id === toast.id ? { ...t, progress } : t
          )
        );
      }, 10);

      intervals.push(progressInterval);

      // Set timeout to remove toast
      const timeout = setTimeout(() => {
        removeToast(toast.id);
      }, toast.duration);

      timeouts.push(timeout);
    });

    // Cleanup on unmount or when toasts change
    return () => {
      intervals.forEach(clearInterval);
      timeouts.forEach(clearTimeout);
    };
  }, [toasts, removeToast]);

  // Context value
  const value = {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
    position,
    setPosition,
    pauseToast,
    resumeToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
};

// Toast container component
const ToastContainer: React.FC = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  const { toasts, removeToast, position, pauseToast, resumeToast } = context;

  // Position classes
  const positionClasses: Record<ToastPosition, string> = {
    'top-right': 'top-4 right-4 items-end',
    'top-left': 'top-4 left-4 items-start',
    'bottom-right': 'bottom-4 right-4 items-end',
    'bottom-left': 'bottom-4 left-4 items-start',
    'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
  };

  // Background colors by type
  const bgColors: Record<ToastType, string> = {
    success: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
    error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    warning: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
    info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
  };

  // Text colors by type
  const textColors: Record<ToastType, string> = {
    success: 'text-emerald-800 dark:text-emerald-200',
    error: 'text-red-800 dark:text-red-200',
    warning: 'text-amber-800 dark:text-amber-200',
    info: 'text-blue-800 dark:text-blue-200',
  };

  // Progress bar colors by type
  const progressColors: Record<ToastType, string> = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  };

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className={`fixed z-[var(--z-toast)] flex flex-col gap-2 ${positionClasses[position]}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex flex-col w-full max-w-sm overflow-hidden rounded-lg shadow-lg border ${bgColors[toast.type]} animate-slide-up`}
          role="alert"
          aria-labelledby={`toast-${toast.id}-title`}
          aria-describedby={`toast-${toast.id}-description`}
          onMouseEnter={() => pauseToast(toast.id)}
          onMouseLeave={() => resumeToast(toast.id)}
        >
          <div className="flex items-start p-4">
            <div className="flex-shrink-0">{ToastIcons[toast.type]}</div>
            <div className="ml-3 w-0 flex-1 pt-0.5">
              {toast.title && (
                <p id={`toast-${toast.id}-title`} className={`text-sm font-medium ${textColors[toast.type]}`}>
                  {toast.title}
                </p>
              )}
              <p id={`toast-${toast.id}-description`} className={`mt-1 text-sm ${textColors[toast.type]}`}>
                {toast.message}
              </p>
            </div>
            <div className="ml-4 flex-shrink-0 flex">
              <button
                type="button"
                className={`inline-flex rounded-md ${textColors[toast.type]} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                onClick={() => removeToast(toast.id)}
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1 w-full bg-gray-200 dark:bg-gray-700">
            <div
              className={`h-full ${progressColors[toast.type]} transition-all duration-100 ease-linear`}
              style={{ width: `${toast.progress}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// Custom hook for using the toast context
export const useToast = () => {
  const context = useContext(ToastContext);

  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
};

export default ToastContext;
