import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateProgramState } from '../../store/programSlice';
import { setGamingState, setSittingState } from '../../store/playerSlice';
import ProgramWindow from '../ProgramWindow';
import { audioService } from '../../services/audioService';

interface PongProps {
  windowId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  programState: {
    gameState: 'menu' | 'waiting' | 'countdown' | 'playing' | 'gameOver' | 'title';
    mode: 'single' | 'multiplayer';
    countdown: number;
    paddles: { left: number; right: number }; // percentage from top
    ball: { x: number; y: number; vx: number; vy: number };
    score: { left: number; right: number };
    winner?: 'left' | 'right';
    opponentId?: string; // second player id in multiplayer
  };
  controllerId: string;
  currentPlayerId: string;
}

const INTERACTION_RANGE = 80;

const Pong: React.FC<PongProps> = ({
  windowId,
  position,
  size,
  zIndex,
  isMinimized,
  programState,
  controllerId,
  currentPlayerId,
}) => {
  const dispatch = useAppDispatch();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isController = controllerId === currentPlayerId;

  // Local refs for smoother gameplay (host only)
  const gameRef = useRef(programState);
  useEffect(() => {
    gameRef.current = programState;
  }, [programState]);

  // Player position for proximity detection
  const playerPosition = useAppSelector((state: any) => state.player?.position || { x: 0, y: 0 });
  const isPlayerNearby = (() => {
    const playerCenterX = playerPosition.x + 80;
    const playerCenterY = playerPosition.y + 80;

    const windowLeft = position.x;
    const windowRight = position.x + size.width;
    const windowTop = position.y;
    const windowBottom = position.y + size.height;

    const closestX = Math.max(windowLeft, Math.min(playerCenterX, windowRight));
    const closestY = Math.max(windowTop, Math.min(playerCenterY, windowBottom));

    const dist = Math.sqrt((closestX - playerCenterX) ** 2 + (closestY - playerCenterY) ** 2);
    return dist <= INTERACTION_RANGE;
  })();

  /* ----------------------------- UI STATE ----------------------------- */
  const [menuSelection, setMenuSelection] = useState<'single' | 'multiplayer'>('single');

  // Paddle movement direction: -1 up, 1 down, 0 idle
  const paddleDirRef = useRef< -1 | 0 | 1 >(0);
  // AI helpers
  const aiTargetRef = useRef<number>(50); // desired paddle position 0-100
  const aiDelayCounterRef = useRef<number>(0);

  const AI_REACTION_FRAMES = 8; // faster reaction
  const AI_SPEED = 2.5; // percent per frame (medium+)

  // Load sounds on mount (controller only to avoid double-loading)
  useEffect(() => {
    if (isController) {
      audioService.initialize();
      audioService.loadSound('move', '/assets/sounds/move.wav');
      audioService.loadSound('eat', '/assets/sounds/eat.wav');
    }
  }, [isController]);

  // Handle key presses (E to confirm, arrows/WASD to change selection, paddles during play)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only listen if window focused & player near
      if (!isPlayerNearby) return;

      if (programState.gameState === 'menu' && isController) {
        if (['ArrowUp', 'w', 'W'].includes(e.key)) {
          setMenuSelection('single');
        } else if (['ArrowDown', 's', 'S'].includes(e.key)) {
          setMenuSelection('multiplayer');
        } else if (e.key.toLowerCase() === 'e' || e.key === 'Enter') {
          if (menuSelection === 'single') {
            startSinglePlayer();
          } else {
            startWaitingForOpponent();
          }
        }
      } else if (programState.gameState === 'gameOver' && isController) {
        if (e.key.toLowerCase() === 'e' || e.key === 'Enter') {
          // Reset to menu
          updateState({
            gameState: 'menu',
            mode: 'single',
            score: { left: 0, right: 0 },
            paddles: { left: 50, right: 50 },
            ball: { x: 50, y: 50, vx: 3, vy: 3 },
            winner: undefined,
          });
          // Lock player again for menu selection
          dispatch(setSittingState(true));
          dispatch(setGamingState({ isGaming: true, inputDirection: null }));
        }
      }

      // Paddle controls during gameplay for the player controlling that paddle
      if (programState.gameState === 'playing') {
        const key = e.key.toLowerCase();
        if (['w', 'arrowup'].includes(key)) {
          paddleDirRef.current = -1;
        } else if (['s', 'arrowdown'].includes(key)) {
          paddleDirRef.current = 1;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'arrowup', 's', 'arrowdown'].includes(key)) {
        paddleDirRef.current = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPlayerNearby, programState.gameState, isController, menuSelection]);

  /* --------------------------- STATE MUTATORS -------------------------- */
  const updateState = useCallback(
    (newState: Partial<PongProps['programState']>) => {
      dispatch(updateProgramState({ windowId, newState }));
    },
    [dispatch, windowId]
  );

  const startSinglePlayer = () => {
    updateState({
      mode: 'single',
      gameState: 'countdown',
      countdown: 3,
      score: { left: 0, right: 0 },
      paddles: { left: 50, right: 50 },
      ball: { x: 50, y: 50, vx: 3, vy: 3 },
    });
  };

  const startWaitingForOpponent = () => {
    updateState({ mode: 'multiplayer', gameState: 'waiting' });
  };

  const joinAsOpponent = () => {
    updateState({ opponentId: currentPlayerId, gameState: 'countdown', countdown: 3 });
  };

  const decrementCountdown = useCallback(() => {
    if (gameRef.current.countdown <= 1) {
      // Start playing
      updateState({ gameState: 'playing', countdown: 0 });
      // Lock movement (sit)
      dispatch(setSittingState(true));
    } else {
      updateState({ countdown: gameRef.current.countdown - 1 });
    }
  }, [updateState, dispatch]);

  /* -------------------------- GAME LOOP HOST --------------------------- */
  useEffect(() => {
    if (!isController) return;

    let animationId: number;

    const FRAME_BASE = 60; // reference FPS for original velocities
    let lastTime = performance.now();

    const step = (timestamp?: number) => {
      const state = gameRef.current;

      const now = timestamp ?? performance.now();
      let dt = (now - lastTime) / 1000; // seconds
      lastTime = now;
      dt = Math.min(dt, 0.05); // clamp large delta

      // Always queue next frame so loop continues waiting for game start or resume
      animationId = requestAnimationFrame(step);

      if (state.gameState !== 'playing') {
        return;
      }

      const BALL_SIZE = 4;
      const PADDLE_HEIGHT = 40;
      const PADDLE_WIDTH = 4;
      const CANVAS_W = size.width - 20;
      const CANVAS_H = size.height - 60;

      let { x, y, vx, vy } = state.ball;

      // Scale velocities to time delta
      const stepScale = dt * FRAME_BASE;
      x += vx * stepScale;
      y += vy * stepScale;

      // Collision top/bottom
      if (y < 0 || y > CANVAS_H - BALL_SIZE) {
        vy = -vy;
      }

      // Update player paddle based on input
      const playerSide: 'left' | 'right' = currentPlayerId === controllerId ? 'left' : 'right';
      let updatedPaddles = { ...state.paddles };
      const PADDLE_SPEED = 4; // percent per frame at 60fps
      if (paddleDirRef.current !== 0) {
        const newVal = updatedPaddles[playerSide] + paddleDirRef.current * PADDLE_SPEED * stepScale;
        updatedPaddles[playerSide] = Math.max(0, Math.min(100, newVal));
      }

      // AI paddle logic (single player)
      if (state.mode === 'single') {
        aiDelayCounterRef.current += stepScale;
        if (aiDelayCounterRef.current >= AI_REACTION_FRAMES) {
          aiDelayCounterRef.current = 0;
          // Track ball y
          aiTargetRef.current = (y / (CANVAS_H - BALL_SIZE)) * 100;
        }
        const diff = aiTargetRef.current - updatedPaddles.right;
        if (Math.abs(diff) > AI_SPEED * stepScale) {
          updatedPaddles.right += Math.sign(diff) * AI_SPEED * stepScale;
        }
        updatedPaddles.right = Math.max(0, Math.min(100, updatedPaddles.right));
      }

      // Paddle positions (percentage => pixels)
      const leftPaddleY = (updatedPaddles.left / 100) * (CANVAS_H - PADDLE_HEIGHT);
      const rightPaddleY = (updatedPaddles.right / 100) * (CANVAS_H - PADDLE_HEIGHT);

      // Left paddle collision
      if (
        x <= PADDLE_WIDTH + 2 &&
        y + BALL_SIZE >= leftPaddleY &&
        y <= leftPaddleY + PADDLE_HEIGHT
      ) {
        vx = Math.abs(vx);
        audioService.playSound('move');
      }

      // Right paddle collision
      if (
        x + BALL_SIZE >= CANVAS_W - (PADDLE_WIDTH + 2) &&
        y + BALL_SIZE >= rightPaddleY &&
        y <= rightPaddleY + PADDLE_HEIGHT
      ) {
        vx = -Math.abs(vx);
        audioService.playSound('move');
      }

      // Scoring
      const score = { ...state.score };
      const WIN_SCORE = 5;
      if (x < 0) {
        score.right += 1;
        if (score.right >= WIN_SCORE) {
          updateState({ score, gameState: 'gameOver', winner: 'right' });
          return;
        }
        x = CANVAS_W / 2;
        y = CANVAS_H / 2;
        vx = 3;
        vy = 3;
        audioService.playSound('eat');
      } else if (x > CANVAS_W) {
        score.left += 1;
        if (score.left >= WIN_SCORE) {
          updateState({ score, gameState: 'gameOver', winner: 'left' });
          return;
        }
        x = CANVAS_W / 2;
        y = CANVAS_H / 2;
        vx = -3;
        vy = 3;
        audioService.playSound('eat');
      }

      updatedPaddles.right = updatedPaddles.right;

      updateState({
        ball: { x, y, vx, vy },
        score,
        paddles: updatedPaddles,
      });
    };

    animationId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationId);
  }, [isController, size.width, size.height, updateState, programState.gameState, currentPlayerId, controllerId]);

  /* ---------------------------- COUNTDOWN ------------------------------ */
  useEffect(() => {
    if (programState.gameState !== 'countdown') return;

    const timer = setTimeout(() => {
      decrementCountdown();
    }, 1000);

    return () => clearTimeout(timer);
  }, [programState.gameState, programState.countdown, decrementCountdown]);

  /* -------------------------- JOIN OPPONENT ---------------------------- */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'e') return;
      if (!isPlayerNearby) return;

      if (programState.gameState === 'waiting' && currentPlayerId !== controllerId) {
        joinAsOpponent();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [programState.gameState, isPlayerNearby, currentPlayerId, controllerId]);

  /* --------------------- PADDLE MOVEMENT (LOCAL) ---------------------- */
  const movePaddle = (delta: number) => {
    const state = gameRef.current;
    if (!state) return;

    const paddleKey = currentPlayerId === controllerId ? 'left' : 'right';
    let newPos = state.paddles[paddleKey] + (delta / (size.height - 60)) * 100;
    newPos = Math.max(0, Math.min(100, newPos));

    updateState({ paddles: { ...state.paddles, [paddleKey]: newPos } });
  };

  /* --------------------------- CANVAS DRAW ---------------------------- */
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = gameRef.current;
    const BALL_SIZE = 4;
    const PADDLE_HEIGHT = 40;
    const PADDLE_WIDTH = 4;
    const CANVAS_W = size.width - 20;
    const CANVAS_H = size.height - 60;

    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Middle line
    ctx.strokeStyle = '#555';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_W / 2, 0);
    ctx.lineTo(CANVAS_W / 2, CANVAS_H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Paddles
    const leftPaddleY = (state.paddles.left / 100) * (CANVAS_H - PADDLE_HEIGHT);
    const rightPaddleY = (state.paddles.right / 100) * (CANVAS_H - PADDLE_HEIGHT);

    ctx.fillStyle = '#fff';
    ctx.fillRect(2, leftPaddleY, PADDLE_WIDTH, PADDLE_HEIGHT);
    ctx.fillRect(CANVAS_W - (PADDLE_WIDTH + 2), rightPaddleY, PADDLE_WIDTH, PADDLE_HEIGHT);

    // Ball
    ctx.fillRect(state.ball.x, state.ball.y, BALL_SIZE, BALL_SIZE);

    // Scores
    ctx.font = '14px Better VCR, monospace';
    ctx.fillText(String(state.score.left), CANVAS_W / 4, 20);
    ctx.fillText(String(state.score.right), (CANVAS_W * 3) / 4, 20);
  }, [size.width, size.height]);

  useEffect(() => {
    drawCanvas();
  }, [programState, drawCanvas]);

  /* --------------------------- TITLE & UI ----------------------------- */
  const getWindowTitle = () => {
    switch (programState.gameState) {
      case 'title':
        return 'Pong';
      case 'menu':
        return 'Pong - Select Mode';
      case 'waiting':
        return 'Pong - Waiting for Player';
      case 'countdown':
        return `Pong - Starting in ${programState.countdown}`;
      case 'playing':
        return 'Pong';
      case 'gameOver':
        return 'Pong - Game Over';
      default:
        return 'Pong';
    }
  };

  const renderContent = () => {
    if (programState.gameState === 'title') {
      return (
        <div style={{ padding: '20px', fontFamily: 'Better VCR, monospace', textAlign: 'center' }}>
          <h3 style={{ marginTop: 0 }}>PONG</h3>
          <p>PRESS E TO START</p>
        </div>
      );
    }

    if (programState.gameState === 'menu') {
      return (
        <div style={{ padding: '20px', fontFamily: 'Better VCR, monospace', textAlign: 'center' }}>
          <h3 style={{ marginTop: 0 }}>PONG</h3>
          <p>Select Mode (↑/↓) and press E</p>
          <div style={{ marginTop: '20px', fontSize: '18px' }}>
            <div style={{ color: menuSelection === 'single' ? '#00f' : '#ccc' }}>{menuSelection === 'single' ? '▶ ' : ''}Single Player</div>
            <div style={{ color: menuSelection === 'multiplayer' ? '#00f' : '#ccc' }}>{menuSelection === 'multiplayer' ? '▶ ' : ''}Multiplayer</div>
          </div>
          {!isController && <p style={{ marginTop: '20px', color: '#f00' }}>Only controller can select</p>}
        </div>
      );
    }

    if (programState.gameState === 'waiting') {
      return (
        <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Better VCR, monospace' }}>
          <p>Waiting for another player to press E</p>
        </div>
      );
    }

    if (programState.gameState === 'gameOver') {
      const winnerText = programState.winner === 'left' ? 'Left Paddle Wins!' : 'Right Paddle Wins!';
      return (
        <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Better VCR, monospace' }}>
          <h3>{winnerText}</h3>
          <p>Final Score {programState.score.left} - {programState.score.right}</p>
          {isController && <p>Press E to return to menu</p>}
        </div>
      );
    }

    // For countdown, playing, gameOver, render canvas
    return (
      <canvas ref={canvasRef} style={{ display: 'block', margin: '0 auto' }} />
    );
  };

  /* -------------------------- MOVEMENT LOCK --------------------------- */
  useEffect(() => {
    if (programState.gameState === 'playing') {
      dispatch(setGamingState({ isGaming: true, inputDirection: null }));
      return () => {
        dispatch(setGamingState({ isGaming: false, inputDirection: null }));
        dispatch(setSittingState(false));
      };
    }
  }, [programState.gameState, dispatch]);

  /* ------------------------ Title & Menu Keys ------------------------- */
  useEffect(() => {
    const handleKeyTitle = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'e') return;
      if (!isPlayerNearby || !isController) return;
      if (programState.gameState === 'title') {
        dispatch(setSittingState(true));
        dispatch(setGamingState({ isGaming: true, inputDirection: null }));
        updateState({ gameState: 'menu' });
      }
    };
    window.addEventListener('keydown', handleKeyTitle);
    return () => window.removeEventListener('keydown', handleKeyTitle);
  }, [programState.gameState, isPlayerNearby, isController, updateState, dispatch]);

  /* -------------------------- GLOBAL CLEANUP -------------------------- */
  useEffect(() => {
    return () => {
      // Clear any gaming/sitting flags just in case
      dispatch(setGamingState({ isGaming: false, inputDirection: null }));
      dispatch(setSittingState(false));
    };
  }, [dispatch]);

  /* ------------------------------ JSX --------------------------------- */
  return (
    <ProgramWindow
      windowId={windowId}
      title={getWindowTitle()}
      icon="🏓"
      position={position}
      size={size}
      zIndex={zIndex}
      isMinimized={isMinimized}
      isResizable={true}
    >
      {renderContent()}
    </ProgramWindow>
  );
};

export default Pong; 