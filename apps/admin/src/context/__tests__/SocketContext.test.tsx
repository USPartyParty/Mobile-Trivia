import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SocketProvider, useSocket } from '../SocketContext';
import { ToastContext } from '../ToastContext';
import { io } from 'socket.io-client';

// Mock dependencies
vi.mock('socket.io-client', () => ({
  io: vi.fn(),
}));
vi.mock('../ToastContext', () => ({
  useToast: vi.fn(),
  ToastContext: createContext(null),
}));

const mockIo = io as vi.Mock;
const mockUseToast = ToastContext.useContext as vi.Mock;

describe('SocketProvider', () => {
  let mockSocketInstance;
  let mockShowToast;

  beforeEach(() => {
    mockSocketInstance = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      io: {
        on: vi.fn(),
      }
    };
    mockIo.mockReturnValue(mockSocketInstance);
    mockShowToast = vi.fn();
    mockUseToast.mockReturnValue({ showToast: mockShowToast });
  });

  it('initializes socket connection and provides default values', () => {
    const wrapper = ({ children }) => <SocketProvider>{children}</SocketProvider>;
    const { result } = renderHook(() => useSocket(), { wrapper });

    expect(mockIo).toHaveBeenCalledWith('http://localhost:3000/admin', expect.any(Object));
    expect(result.current.connectionState).toBe('connecting');
    expect(result.current.socket).toBe(mockSocketInstance);
  });

  // Add more tests for socket event handlers and admin functions
});
