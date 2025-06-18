import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminPage from '../AdminPage';
import { SocketContext } from '../../context/SocketContext';
import { GameStateContext } from '../../context/GameStateContext';
import { ToastContext } from '../../context/ToastContext';
import { MemoryRouter } from 'react-router-dom';

// Mock contexts
const mockSocketContext = {
  socket: null,
  connectionState: 'connected',
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

describe('AdminPage', () => {
  it('renders the main sections', () => {
    render(
      <MemoryRouter>
        <SocketContext.Provider value={mockSocketContext}>
          <GameStateContext.Provider value={mockGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AdminPage />
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByText('Session Control')).toBeInTheDocument();
    expect(screen.getByText('Quick Stats')).toBeInTheDocument();
    expect(screen.getByText('Connected Players')).toBeInTheDocument();
  });

  it('disables "Create New Session" button when not connected', () => {
    const customSocketContext = { ...mockSocketContext, connectionState: 'disconnected' };
    render(
      <MemoryRouter>
        <SocketContext.Provider value={customSocketContext}>
          <GameStateContext.Provider value={mockGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AdminPage />
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );
    expect(screen.getByText('Create New Session')).toBeDisabled();
  });

  it('calls createSession when "Create New Session" button is clicked', () => {
    render(
      <MemoryRouter>
        <SocketContext.Provider value={mockSocketContext}>
          <GameStateContext.Provider value={mockGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AdminPage />
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );
    screen.getByText('Create New Session').click();
    expect(mockSocketContext.createSession).toHaveBeenCalled();
  });

  it('disables session control buttons when no session ID is present', () => {
    render(
      <MemoryRouter>
        <SocketContext.Provider value={mockSocketContext}>
          <GameStateContext.Provider value={mockGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AdminPage />
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );
    expect(screen.getByText('Reset Session')).toBeDisabled();
    expect(screen.getByText('End Session')).toBeDisabled();
    // Start Game and Pause/Resume buttons are not rendered initially
  });

  it('enables session control buttons when a session ID is present', () => {
    const customGameState = { ...mockGameStateContext.gameState, sessionId: 'test-session' };
    const customGameStateContext = { ...mockGameStateContext, gameState: customGameState };
    render(
      <MemoryRouter>
        <SocketContext.Provider value={mockSocketContext}>
          <GameStateContext.Provider value={customGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AdminPage />
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );
    expect(screen.getByText('Reset Session')).toBeEnabled();
    expect(screen.getByText('End Session')).toBeEnabled();
  });

  it('calls resetSession when "Reset Session" button is clicked', () => {
    const customGameState = { ...mockGameStateContext.gameState, sessionId: 'test-session' };
    const customGameStateContext = { ...mockGameStateContext, gameState: customGameState };
    render(
      <MemoryRouter>
        <SocketContext.Provider value={mockSocketContext}>
          <GameStateContext.Provider value={customGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AdminPage />
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );
    screen.getByText('Reset Session').click();
    expect(mockSocketContext.resetSession).toHaveBeenCalledWith('test-session');
  });

  it('calls endSession when "End Session" button is clicked', () => {
    const customGameState = { ...mockGameStateContext.gameState, sessionId: 'test-session' };
    const customGameStateContext = { ...mockGameStateContext, gameState: customGameState };
    render(
      <MemoryRouter>
        <SocketContext.Provider value={mockSocketContext}>
          <GameStateContext.Provider value={customGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AdminPage />
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );
    screen.getByText('End Session').click();
    expect(mockSocketContext.endSession).toHaveBeenCalledWith('test-session');
  });

  it('renders "Start Game" button when game status is "waiting"', () => {
    const customGameState = { ...mockGameStateContext.gameState, sessionId: 'test-session', status: 'waiting' };
    const customGameStateContext = { ...mockGameStateContext, gameState: customGameState };
    render(
      <MemoryRouter>
        <SocketContext.Provider value={mockSocketContext}>
          <GameStateContext.Provider value={customGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AdminPage />
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );
    expect(screen.getByText('Start Game')).toBeInTheDocument();
  });

  it('calls startGame when "Start Game" button is clicked', () => {
    const customGameState = { ...mockGameStateContext.gameState, sessionId: 'test-session', status: 'waiting', players: [{ id: 'player1', name: 'Player 1', score: 0, isActive: true, lastActive: '' }] };
    const customGameStateContext = { ...mockGameStateContext, gameState: customGameState };
    render(
      <MemoryRouter>
        <SocketContext.Provider value={mockSocketContext}>
          <GameStateContext.Provider value={customGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AdminPage />
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );
    screen.getByText('Start Game').click();
    expect(mockSocketContext.startGame).toHaveBeenCalledWith('test-session');
  });

  it('renders "Pause Game" button when game status is "active"', () => {
    const customGameState = { ...mockGameStateContext.gameState, sessionId: 'test-session', status: 'active' };
    const customGameStateContext = { ...mockGameStateContext, gameState: customGameState };
    render(
      <MemoryRouter>
        <SocketContext.Provider value={mockSocketContext}>
          <GameStateContext.Provider value={customGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AdminPage />
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );
    expect(screen.getByText('Pause Game')).toBeInTheDocument();
  });

  it('calls pauseGame when "Pause Game" button is clicked', () => {
    const customGameState = { ...mockGameStateContext.gameState, sessionId: 'test-session', status: 'active' };
    const customGameStateContext = { ...mockGameStateContext, gameState: customGameState };
    render(
      <MemoryRouter>
        <SocketContext.Provider value={mockSocketContext}>
          <GameStateContext.Provider value={customGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AdminPage />
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );
    screen.getByText('Pause Game').click();
    expect(mockSocketContext.pauseGame).toHaveBeenCalledWith('test-session');
  });

  it('renders "Resume Game" button when game status is "paused"', () => {
    const customGameState = { ...mockGameStateContext.gameState, sessionId: 'test-session', status: 'paused' };
    const customGameStateContext = { ...mockGameStateContext, gameState: customGameState };
    render(
      <MemoryRouter>
        <SocketContext.Provider value={mockSocketContext}>
          <GameStateContext.Provider value={customGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AdminPage />
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );
    expect(screen.getByText('Resume Game')).toBeInTheDocument();
  });

  it('calls resumeGame when "Resume Game" button is clicked', () => {
    const customGameState = { ...mockGameStateContext.gameState, sessionId: 'test-session', status: 'paused' };
    const customGameStateContext = { ...mockGameStateContext, gameState: customGameState };
    render(
      <MemoryRouter>
        <SocketContext.Provider value={mockSocketContext}>
          <GameStateContext.Provider value={customGameStateContext}>
            <ToastContext.Provider value={mockToastContext}>
              <AdminPage />
            </ToastContext.Provider>
          </GameStateContext.Provider>
        </SocketContext.Provider>
      </MemoryRouter>
    );
    screen.getByText('Resume Game').click();
    expect(mockSocketContext.resumeGame).toHaveBeenCalledWith('test-session');
  });
});
