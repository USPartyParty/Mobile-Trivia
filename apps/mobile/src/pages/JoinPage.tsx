import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useGameState } from '../context/GameStateContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import {
  QrCodeIcon,
  UserIcon,
  KeyIcon,
  ArrowRightOnRectangleIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

const QR_READER_ELEMENT_ID = "qr-code-reader-region";

const JoinPage: React.FC = () => {
  const params = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const { state, connectAndJoinSession, dispatch, leaveSession } = useGameState();
  const { isConnected } = useSocket();
  const { addToast } = useToast();

  const [sessionIdInput, setSessionIdInput] = useState<string>('');
  const [playerNameInput, setPlayerNameInput] = useState<string>(state.playerName || '');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [qrScanError, setQrScanError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Effect to handle session ID from URL parameters
  useEffect(() => {
    if (params.sessionId) {
      setSessionIdInput(params.sessionId);
    }
  }, [params.sessionId]);

  // Effect to handle redirection if already in a game
  useEffect(() => {
    if (state.playerId && state.sessionId && isConnected) {
      const activeGameStatuses: typeof state.gameStatus[] = ['waiting', 'countdown', 'active', 'revealed', 'paused'];
      if (activeGameStatuses.includes(state.gameStatus)) {
        // If user is on /join but already in a game, redirect.
        // Or if on /join/:currentSessionId, also redirect.
        if (!params.sessionId || params.sessionId === state.sessionId) {
          navigate(`/game/${state.sessionId}`, { replace: true });
        }
      }
    }
  }, [state.gameStatus, state.playerId, state.sessionId, navigate, params.sessionId, isConnected]);

  // Cleanup QR scanner on component unmount or when scanning is stopped
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop()
          .then(() => console.log("QR Scanner stopped on cleanup."))
          .catch(err => console.error("Error stopping QR scanner on cleanup:", err));
        html5QrCodeRef.current = null;
      }
    };
  }, []);

  const startQrScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (e) {
        console.warn("Error stopping previous scanner instance:", e);
      }
      html5QrCodeRef.current = null;
    }

    setQrScanError(null);
    const newScanner = new Html5Qrcode(QR_READER_ELEMENT_ID, {
      verbose: false,
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
    });
    html5QrCodeRef.current = newScanner;

    const qrCodeSuccessCallback = (decodedText: string) => {
      setSessionIdInput(decodedText);
      setIsScanning(false); // This will trigger the cleanup effect for the scanner
      addToast({ type: 'success', message: 'QR Code Scanned!', duration: 2000 });
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop()
          .catch(err => console.error("Error stopping scanner after success:", err));
        html5QrCodeRef.current = null;
      }
    };

    const config = {
      fps: 10,
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const qrBoxSize = Math.max(200, Math.min(300, minEdge * 0.75)); // Ensure a reasonable size
        return { width: qrBoxSize, height: qrBoxSize };
      },
      rememberLastUsedCamera: true,
      aspectRatio: 1.0,
    };

    try {
      await newScanner.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        (errorMessage: string) => {
          // console.warn(`QR Scan Error: ${errorMessage}`); // Can be noisy
        }
      );
    } catch (err: any) {
      console.error("Failed to start QR scanner:", err);
      let message = "Failed to start QR scanner. ";
      if (err.name === "NotAllowedError") {
        message += "Camera permission denied. Please grant camera access in your browser settings.";
      } else if (err.name === "NotFoundError") {
        message += "No camera found. Please ensure you have a working camera.";
      } else {
        message += err.message || "Please ensure camera permissions are granted.";
      }
      setQrScanError(message);
      addToast({type: 'error', title: 'Scanner Error', message});
      setIsScanning(false); // Turn off scanning mode on error
      html5QrCodeRef.current = null;
    }
  }, [addToast]);

  const stopQrScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        console.log("QR Scanner stopped manually.");
      } catch (err) {
        console.error("Error stopping QR scanner manually:", err);
      } finally {
        html5QrCodeRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (isScanning) {
      startQrScanner();
    } else {
      stopQrScanner();
    }
  }, [isScanning, startQrScanner, stopQrScanner]);


  const handleJoinGame = async () => {
    if (!playerNameInput.trim()) {
      addToast({ type: 'warning', title: 'Name Required', message: 'Please enter your name.' });
      return;
    }
    if (!sessionIdInput.trim()) {
      addToast({ type: 'warning', title: 'Session ID Required', message: 'Please enter or scan a Session ID.' });
      return;
    }

    setIsSubmitting(true);
    dispatch({ type: 'CLEAR_ERROR' });

    // If player is already in a session AND trying to join a DIFFERENT session
    if (state.playerId && state.sessionId && state.sessionId !== sessionIdInput.trim()) {
      addToast({ type: 'info', message: 'Leaving previous session...', duration: 1500 });
      leaveSession(); // This will disconnect socket and reset game state

      // Wait for state to reset before attempting to join new session
      setTimeout(() => {
        connectAndJoinSession(sessionIdInput.trim(), playerNameInput.trim(), undefined);
      }, 500); // Delay to allow disconnect and state reset
    } else {
      // New join, or rejoining the same session (pass existing player ID if available and session matches)
      const existingPlayerIdForSession = (state.playerId && state.sessionId === sessionIdInput.trim()) ? state.playerId : undefined;
      connectAndJoinSession(sessionIdInput.trim(), playerNameInput.trim(), existingPlayerIdForSession);
    }
  };

  // Update submitting state based on context isLoading
   useEffect(() => {
    if (!state.isLoading) {
      setIsSubmitting(false);
    }
  }, [state.isLoading]);

  // Display context errors
  useEffect(() => {
    if (state.lastError) {
      addToast({ type: 'error', title: 'Join Error', message: state.lastError });
      dispatch({ type: 'CLEAR_ERROR' }); // Clear error after displaying
      setIsSubmitting(false); // Ensure submitting is reset on error
    }
  }, [state.lastError, addToast, dispatch]);


  return (
    <div className="flex flex-col items-center justify-center flex-grow p-4 space-y-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">Join Trivia Game</h1>
        <p className="text-slate-600 dark:text-slate-300">
          Enter your name and the Session ID, or scan a QR code to join the fun!
        </p>
      </div>

      {/* QR Scanner Section */}
      {isScanning && (
        <div className="w-full max-w-xs mx-auto space-y-3 mobile-card p-4 shadow-lg">
          <div id={QR_READER_ELEMENT_ID} className="w-full aspect-square rounded-md overflow-hidden border-2 border-dashed border-indigo-300 dark:border-indigo-700 bg-slate-50 dark:bg-slate-800">
            {/* QR Scanner will render here */}
            <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
              Initializing Scanner...
            </div>
          </div>
          {qrScanError && <p className="form-error-text text-center">{qrScanError}</p>}
          <button
            onClick={() => setIsScanning(false)}
            className="btn btn-outline btn-full"
            aria-label="Cancel QR Code Scan"
          >
            <VideoCameraSlashIcon className="w-5 h-5 mr-2" />
            Cancel Scan
          </button>
        </div>
      )}

      {/* Manual Join Form */}
      {!isScanning && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleJoinGame(); }}
          className="w-full max-w-md space-y-5 mobile-card p-6 shadow-lg"
        >
          <div>
            <label htmlFor="playerName" className="form-label flex items-center">
              <UserIcon className="w-4 h-4 mr-2 text-slate-500" />
              Your Name
            </label>
            <input
              type="text"
              id="playerName"
              value={playerNameInput}
              onChange={(e) => setPlayerNameInput(e.target.value)}
              placeholder="Enter your display name"
              className="form-input"
              required
              maxLength={20}
              disabled={state.isLoading || isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="sessionId" className="form-label flex items-center">
              <KeyIcon className="w-4 h-4 mr-2 text-slate-500" />
              Session ID
            </label>
            <input
              type="text"
              id="sessionId"
              value={sessionIdInput}
              onChange={(e) => setSessionIdInput(e.target.value)}
              placeholder="Enter Session ID"
              className="form-input"
              required
              maxLength={36} // UUID length
              disabled={state.isLoading || isSubmitting}
            />
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={state.isLoading || isSubmitting || !playerNameInput.trim() || !sessionIdInput.trim()}
              aria-label="Join Game"
            >
              {(state.isLoading || isSubmitting) ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <ArrowRightOnRectangleIcon className="w-5 h-5 mr-2" />
                  Join Game
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsScanning(true);
                setQrScanError(null); // Clear previous scan errors
              }}
              className="btn btn-outline btn-full"
              disabled={state.isLoading || isSubmitting}
              aria-label="Scan QR Code"
            >
              <QrCodeIcon className="w-5 h-5 mr-2" />
              Scan QR Code
            </button>
          </div>
        </form>
      )}
      
      {/* Connection Status (subtle) */}
      <div className="text-xs text-slate-500 dark:text-slate-400 pt-4">
        Connection: {isConnected ? <span className="text-emerald-500">Online</span> : <span className="text-red-500">Offline</span>}
        {state.isLoading && " (Loading...)"}
      </div>
    </div>
  );
};

export default JoinPage;
