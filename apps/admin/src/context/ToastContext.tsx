import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';

// Toast types for different notification styles
export type ToastType = 'success' | 'error' | 'warning' | 'info';

// Interface for toast objects
interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  createdAt: number;
}

// Interface for the toast context
interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  dismissToast: (id: string) => void;
  dismissAllToasts: () => void;
}

// Create context with default values
const ToastContext = createContext<ToastContextType>({
  toasts: [],
  showToast: () => {},
  dismissToast: () => {},
  dismissAllToasts: () => {},
});

// Props for the ToastProvider component
interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number;
  defaultDuration?: number;
}

// Provider component
export const ToastProvider = ({
  children,
  maxToasts = 5,
  defaultDuration = 5000,
}: ToastProviderProps) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Generate a unique ID for each toast
  const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Show a new toast notification
  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = defaultDuration) => {
      const newToast: Toast = {
        id: generateId(),
        message,
        type,
        duration,
        createdAt: Date.now(),
      };

      // Add the new toast to the list, removing oldest if we exceed maxToasts
      setToasts((currentToasts) => {
        const updatedToasts = [newToast, ...currentToasts];
        return updatedToasts.slice(0, maxToasts);
      });
    },
    [defaultDuration, maxToasts]
  );

  // Dismiss a specific toast by ID
  const dismissToast = useCallback((id: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
  }, []);

  // Dismiss all toasts
  const dismissAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Auto-dismiss toasts when their duration expires
  useEffect(() => {
    if (toasts.length === 0) return;

    const timers = toasts.map((toast) => {
      return setTimeout(() => {
        dismissToast(toast.id);
      }, toast.duration);
    });

    // Clean up timers on unmount or when toasts change
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts, dismissToast]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        dismissToast,
        dismissAllToasts,
      }}
    >
      {children}
      {/* Toast container could be rendered here or in a separate component */}
    </ToastContext.Provider>
  );
};

// Custom hook for using the toast context
export const useToast = () => useContext(ToastContext);

// Toast container component for rendering the actual toast notifications
export const ToastContainer = () => {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-md shadow-lg p-4 flex items-center justify-between ${
            toast.type === 'success'
              ? 'bg-green-100 text-green-800 border-l-4 border-green-500'
              : toast.type === 'error'
              ? 'bg-red-100 text-red-800 border-l-4 border-red-500'
              : toast.type === 'warning'
              ? 'bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500'
              : 'bg-blue-100 text-blue-800 border-l-4 border-blue-500'
          } animate-fadeIn`}
        >
          <p className="font-medium">{toast.message}</p>
          <button
            onClick={() => dismissToast(toast.id)}
            className="ml-4 text-gray-500 hover:text-gray-700"
            aria-label="Dismiss"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
};
