import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'; // Using outline for a lighter feel

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

// Toast position for mobile (usually top or bottom center)
export type ToastPosition = 'top-center' | 'bottom-center';

// Toast interface
export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration: number; // milliseconds
  createdAt: Date;
  onClose?: () => void;
  isPaused?: boolean; // For pausing timer on touch/hover
  progress?: number; // 0-100, for visual feedback
}

// Context interface
interface ToastContextValue {
  toasts: Toast[];
  addToast: (options: {
    type: ToastType;
    message: string;
    title?: string;
    duration?: number; // Allow overriding default duration
    onClose?: () => void;
  }) => string; // returns toast id
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
  position: ToastPosition;
  setPosition: (position: ToastPosition) => void; // Allow changing position if needed
  pauseToast: (id: string) => void;
  resumeToast: (id: string) => void;
}

// Create context
const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Provider props
interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number; // Max toasts visible at once
  defaultPosition?: ToastPosition;
  defaultDuration?: number; // Default auto-dismiss duration
}

// Default durations by type for mobile (can be shorter)
const DEFAULT_MOBILE_DURATIONS: Record<ToastType, number> = {
  success: 2500,
  error: 4000,
  warning: 3500,
  info: 2500,
};

// Toast icon components (can be styled for mobile)
const ToastIcons: Record<ToastType, React.ReactElement> = {
  success: <CheckCircleIcon className="w-5 h-5 text-emerald-500" aria-hidden="true" />,
  error: <ExclamationCircleIcon className="w-5 h-5 text-red-500" aria-hidden="true" />,
  warning: <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" aria-hidden="true" />,
  info: <InformationCircleIcon className="w-5 h-5 text-blue-500" aria-hidden="true" />,
};

// Provider component
export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  maxToasts = 3, // Fewer toasts on mobile
  defaultPosition = 'top-center',
  defaultDuration = 3000, // General default duration
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [position, setPosition] = useState<ToastPosition>(defaultPosition);

  const generateId = useCallback(() => `toast-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`, []);

  const addToast = useCallback(
    ({ type, message, title, duration, onClose }) => {
      const id = generateId();
      const newToast: Toast = {
        id,
        type,
        message,
        title,
        duration: duration || DEFAULT_MOBILE_DURATIONS[type] || defaultDuration,
        createdAt: new Date(),
        onClose,
        isPaused: false,
        progress: 100,
      };

      setToasts((prevToasts) => {
        const updatedToasts = [newToast, ...prevToasts];
        return updatedToasts.length > maxToasts ? updatedToasts.slice(0, maxToasts) : updatedToasts;
      });
      return id;
    },
    [generateId, defaultDuration, maxToasts]
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => {
      const toast = prevToasts.find((t) => t.id === id);
      toast?.onClose?.();
      return prevToasts.filter((t) => t.id !== id);
    });
  }, []);

  const clearAllToasts = useCallback(() => setToasts([]), []);

  const pauseToast = useCallback((id: string) => {
    setToasts((prevToasts) =>
      prevToasts.map((toast) => (toast.id === id ? { ...toast, isPaused: true } : toast))
    );
  }, []);

  const resumeToast = useCallback((id: string) => {
    setToasts((prevToasts) =>
      prevToasts.map((toast) => (toast.id === id ? { ...toast, isPaused: false, createdAt: new Date() } : toast)) // Reset createdAt to resume timer correctly
    );
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;

    const activeTimers = new Map<string, { timeoutId: NodeJS.Timeout; intervalId: NodeJS.Timeout }>();

    toasts.forEach((toast) => {
      if (toast.isPaused || activeTimers.has(toast.id)) return;

      const remainingDuration = toast.duration * (toast.progress / 100);

      const timeoutId = setTimeout(() => {
        removeToast(toast.id);
      }, remainingDuration);

      const intervalId = setInterval(() => {
        setToasts((prevToasts) =>
          prevToasts.map((t) => {
            if (t.id === toast.id && !t.isPaused) {
              const elapsedTimeSinceLastUpdate = 100; // Update interval
              const newProgress = Math.max(0, t.progress - (elapsedTimeSinceLastUpdate / t.duration) * 100);
              return { ...t, progress: newProgress };
            }
            return t;
          })
        );
      }, 100); // Update progress more frequently for smoother animation

      activeTimers.set(toast.id, { timeoutId, intervalId });
    });

    return () => {
      activeTimers.forEach(({ timeoutId, intervalId }) => {
        clearTimeout(timeoutId);
        clearInterval(intervalId);
      });
    };
  }, [toasts, removeToast]); // Re-run when toasts array or removeToast changes

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

// Toast container component - styled for mobile
const ToastContainer: React.FC = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('ToastContainer must be used within a ToastProvider');

  const { toasts, removeToast, position, pauseToast, resumeToast } = context;

  const positionClasses: Record<ToastPosition, string> = {
    'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
  };

  const typeStyles: Record<ToastType, { bg: string; text: string; progress: string; border: string }> = {
    success: { bg: 'bg-emerald-50 dark:bg-emerald-800/30', text: 'text-emerald-700 dark:text-emerald-200', progress: 'bg-emerald-500', border: 'border-emerald-300 dark:border-emerald-700' },
    error: { bg: 'bg-red-50 dark:bg-red-800/30', text: 'text-red-700 dark:text-red-200', progress: 'bg-red-500', border: 'border-red-300 dark:border-red-700' },
    warning: { bg: 'bg-amber-50 dark:bg-amber-800/30', text: 'text-amber-700 dark:text-amber-200', progress: 'bg-amber-500', border: 'border-amber-300 dark:border-amber-700' },
    info: { bg: 'bg-blue-50 dark:bg-blue-800/30', text: 'text-blue-700 dark:text-blue-200', progress: 'bg-blue-500', border: 'border-blue-300 dark:border-blue-700' },
  };

  if (toasts.length === 0) return null;

  return (
    <div
      className={`fixed z-[var(--z-toast)] flex flex-col w-full px-4 pointer-events-none ${positionClasses[position]}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex flex-col w-full max-w-md mt-2 overflow-hidden rounded-lg shadow-lg border pointer-events-auto ${typeStyles[toast.type].bg} ${typeStyles[toast.type].border} animate-slide-up`}
          role="alert"
          onTouchStart={() => pauseToast(toast.id)}
          onTouchEnd={() => resumeToast(toast.id)}
          onMouseEnter={() => pauseToast(toast.id)} // Keep for web/mouse interaction
          onMouseLeave={() => resumeToast(toast.id)}
        >
          <div className="flex items-start p-3"> {/* Smaller padding */}
            <div className="flex-shrink-0 mt-0.5">{ToastIcons[toast.type]}</div>
            <div className="ml-2.5 w-0 flex-1"> {/* Smaller margin */}
              {toast.title && (
                <p className={`text-sm font-semibold ${typeStyles[toast.type].text}`}>
                  {toast.title}
                </p>
              )}
              <p className={`text-sm ${typeStyles[toast.type].text} ${toast.title ? 'mt-0.5' : ''}`}>
                {toast.message}
              </p>
            </div>
            <div className="ml-3 flex-shrink-0 flex">
              <button
                type="button"
                className={`inline-flex rounded-md p-1 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-white ${typeStyles[toast.type].text} hover:opacity-80`}
                onClick={() => removeToast(toast.id)}
                aria-label="Close"
              >
                <XMarkIcon className="h-4 w-4" aria-hidden="true" /> {/* Smaller icon */}
              </button>
            </div>
          </div>
          {/* Progress bar */}
          <div className={`h-1 w-full ${typeStyles[toast.type].bg.replace('bg-', 'bg-opacity-50-')} `}> {/* Slightly transparent background for progress bar track */}
            <div
              className={`h-full ${typeStyles[toast.type].progress}`}
              style={{ width: `${toast.progress}%`, transition: 'width 0.1s linear' }} // Smooth progress
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
