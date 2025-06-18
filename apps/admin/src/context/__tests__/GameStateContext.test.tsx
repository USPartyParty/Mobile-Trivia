import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { GameStateProvider, useGameState } from '../GameStateContext';
import { SocketContext } from '../SocketContext';
import { ToastContext } from '../ToastContext';

// Mock dependencies
vi.mock('../SocketContext', () => ({
  useSocket: vi.fn(),
  SocketContext: createContext(null),
}));
vi.mock('../ToastContext', () => ({
  useToast: vi.fn(),
  ToastContext: createContext(null),
}));

const mockUseSocket = SocketContext.useContext as vi.Mock;
const mockUseToast = ToastContext.useContext as vi.Mock;

describe('GameStateProvider', () => {
  let mockSocket;
  let mockShowToast;

  beforeEach(() => {
    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
    };
    mockShowToast = vi.fn();
    mockUseSocket.mockReturnValue({ socket: mockSocket, connectionState: 'connected', sessionId: null });
    mockUseToast.mockReturnValue({ showToast: mockShowToast });
  });

  it('provides default game state and admin stats', () => {
    const wrapper = ({ children }) => <GameStateProvider>{children}</GameStateProvider>;
    const { result } = renderHook(() => useGameState(), { wrapper });

    expect(result.current.gameState.status).toBe('initializing');
    expect(result.current.adminStats.totalSessions).toBe(0);
    expect(result.current.isLoading).toBe(true);
  });

  // Add more tests for fetchGameState, fetchAdminStats, and socket event handlers
});
