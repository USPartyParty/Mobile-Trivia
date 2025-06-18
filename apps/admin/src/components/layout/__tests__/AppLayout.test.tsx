import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppLayout from '../AppLayout';
import { SocketContext } from '../../../context/SocketContext';
import { GameStateContext } from '../../../context/GameStateContext';
import { ToastContext } from '../../../context/ToastContext';
import { MemoryRouter } from 'react-router-dom';

// Mock contexts
const mockSocketContext = {
  socket: null,
  connectionState: 'connected',
  lastError: null,
  sessionId: null,
  createSession: vi.fn(),
  resetSession: vi.fn(),
  endSession: vi.fn(),
  startGame: vi.fn(),
  pauseGame: vi.fn(),
  resumeGame: vi.fn(),
};

const mockGameStateContext = {
  gameState: {
    sessionId: null,
    status: 'initializing',
    players: [],
    connectedPlayers: 0,
    maxPlayers: 0,
    currentQuestion: null,
    qrCodeUrl: null,
  },
  adminStats: {
    activeSessions: 0,
    totalPlayers: 0,
    topScore: 0,
    sessionsToday: 0,
    popularCategories: [],
  },
  isLoading: false,
  fetchGameState: vi.fn(),
  fetchAdminStats: vi.fn(),
};

const mockToastContext = {
  showToast: vi.fn(),
};

describe('AppLayout', () => {
  it('renders the main layout elements', () => {
    render(
      <MemoryRouter>
        <SocketContext.Provider value={mockSocketContext}>
          <GameStateContext.Provider value={mockGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AppLayout>
                <div>Test Content</div>
              </AppLayout>
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByText('Taps Tokens Trivia')).toBeInTheDocument(); // Header
    expect(screen.getByText('Dashboard')).toBeInTheDocument(); // Sidebar
    expect(screen.getByText('Test Content')).toBeInTheDocument(); // Children
    expect(screen.getByText(/© \d{4} Taps Tokens Trivia/)).toBeInTheDocument(); // Footer
  });

  it('displays the title prop', () => {
    const title = 'Test Page Title';
    render(
      <MemoryRouter>
        <SocketContext.Provider value={mockSocketContext}>
          <GameStateContext.Provider value={mockGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AppLayout title={title}>
                <div>Test Content</div>
              </AppLayout>
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it('shows loading indicator when isLoading is true', () => {
    const customGameStateContext = { ...mockGameStateContext, isLoading: true };
    render(
      <MemoryRouter>
        <SocketContext.Provider value={mockSocketContext}>
          <GameStateContext.Provider value={customGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AppLayout>
                <div>Test Content</div>
              </AppLayout>
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );
    expect(screen.getByRole('status')).toBeInTheDocument(); // Assuming loading indicator has role="status"
  });

  it('displays error message when lastError is present', () => {
    const errorMessage = 'Test error message';
    const customSocketContext = { ...mockSocketContext, lastError: errorMessage };
    render(
      <MemoryRouter>
        <SocketContext.Provider value={customSocketContext}>
          <GameStateContext.Provider value={mockGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AppLayout>
                <div>Test Content</div>
              </AppLayout>
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('displays "Connected" status', () => {
    render(
      <MemoryRouter>
        <SocketContext.Provider value={mockSocketContext}>
          <GameStateContext.Provider value={mockGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AppLayout>
                <div>Test Content</div>
              </AppLayout>
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('displays "Connecting..." status', () => {
    const customSocketContext = { ...mockSocketContext, connectionState: 'connecting' };
    render(
      <MemoryRouter>
        <SocketContext.Provider value={customSocketContext}>
          <GameStateContext.Provider value={mockGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AppLayout>
                <div>Test Content</div>
              </AppLayout>
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('displays "Reconnecting..." status', () => {
    const customSocketContext = { ...mockSocketContext, connectionState: 'reconnecting' };
    render(
      <MemoryRouter>
        <SocketContext.Provider value={customSocketContext}>
          <GameStateContext.Provider value={mockGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AppLayout>
                <div>Test Content</div>
              </AppLayout>
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );
    expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
  });

  it('displays "Disconnected" status', () => {
    const customSocketContext = { ...mockSocketContext, connectionState: 'disconnected' };
    render(
      <MemoryRouter>
        <SocketContext.Provider value={customSocketContext}>
          <GameStateContext.Provider value={mockGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AppLayout>
                <div>Test Content</div>
              </AppLayout>
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });
});
