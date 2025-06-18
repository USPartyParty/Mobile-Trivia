import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ToastProvider, useToast, ToastContainer } from '../ToastContext';
import { render, screen } from '@testing-library/react';

describe('ToastProvider and useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('shows and dismisses a toast message', () => {
    const wrapper = ({ children }) => <ToastProvider>{children}</ToastProvider>;
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.showToast('Test message', 'success');
    });

    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].message).toBe('Test message');
    expect(result.current.toasts[0].type).toBe('success');

    act(() => {
      result.current.dismissToast(result.current.toasts[0].id);
    });
    expect(result.current.toasts.length).toBe(0);
  });

  it('auto-dismisses a toast after the specified duration', () => {
    const wrapper = ({ children }) => <ToastProvider defaultDuration={1000}>{children}</ToastProvider>;
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.showToast('Auto dismiss test');
    });
    expect(result.current.toasts.length).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.toasts.length).toBe(0);
  });

  it('dismisses all toasts', () => {
    const wrapper = ({ children }) => <ToastProvider>{children}</ToastProvider>;
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.showToast('Toast 1');
      result.current.showToast('Toast 2');
    });
    expect(result.current.toasts.length).toBe(2);

    act(() => {
      result.current.dismissAllToasts();
    });
    expect(result.current.toasts.length).toBe(0);
  });
});

describe('ToastContainer', () => {
  it('renders toasts correctly', () => {
    const toasts = [
      { id: '1', message: 'Success Toast', type: 'success', duration: 5000, createdAt: Date.now() },
      { id: '2', message: 'Error Toast', type: 'error', duration: 5000, createdAt: Date.now() },
    ];
    const mockDismissToast = vi.fn();

    render(
      <ToastContext.Provider value={{ toasts, dismissToast: mockDismissToast, showToast: vi.fn(), dismissAllToasts: vi.fn() }}>
        <ToastContainer />
      </ToastContext.Provider>
    );

    expect(screen.getByText('Success Toast')).toBeInTheDocument();
    expect(screen.getByText('Error Toast')).toBeInTheDocument();
  });

  it('does not render when there are no toasts', () => {
    render(
      <ToastContext.Provider value={{ toasts: [], dismissToast: vi.fn(), showToast: vi.fn(), dismissAllToasts: vi.fn() }}>
        <ToastContainer />
      </ToastContext.Provider>
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(); // Assuming toasts have role="alert"
  });
});
