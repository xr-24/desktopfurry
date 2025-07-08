import React, { useRef, useEffect, useCallback } from 'react';
import ProgramWindow from '../ProgramWindow';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateProgramState } from '../../store/programSlice';
import { setGamingState, setSittingState } from '../../store/playerSlice';
import { audioService } from '../../services/audioService';

/* ------------------------------------------------------------------
   🧱  BREAKOUT – fresh implementation 2025-07-07
   ------------------------------------------------------------------
   – Single-controller + spectators (like Snake)
   – Host captures WASD/←→, paddles the ball, pushes snapshots every 100 ms
   – Avatar enters "gaming sit" posture while playing
--------------------------------------------------------------------*/

interface BreakoutState {
  gameState: 'title' | 'playing' | 'gameOver';
  paddleX: number;               // 0-100 (% of width)
  ball: { x: number; y: number; vx: number; vy: number };
  bricks: number[][];            // 1 = alive, 0 = cleared
  score: number;
  lives: number;
}

interface BreakoutProps {
  windowId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  programState: BreakoutState;
  controllerId: string;
  currentPlayerId: string;
}

/* ----------------------------- Constants ---------------------------- */
const BRICK_ROWS = 6;
const BRICK_COLS = 10;
const BRICK_H = 15;
const PADDLE_W = 80;
const PADDLE_H = 10;
const BALL_SIZE = 6;
const PADDLE_SPEED_PPS = 450; // px/s
const SYNC_INTERVAL = 100;    // ms ‑ snapshot throttle
const INTERACTION_RANGE = 80; // px – same as other games

const freshBricks = (): number[][] => Array.from({ length: BRICK_ROWS }, () => Array(BRICK_COLS).fill(1));

/* ==================================================================== */
const Breakout: React.FC<BreakoutProps> = ({
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

  /* ---- Role -------------------------------------------------------- */
  const isHost = controllerId === currentPlayerId;

  /* ---- Refs for game loop ----------------------------------------- */
  const gameRef = useRef<BreakoutState>(programState);        // authoritative state (host)
  const lastFrameRef = useRef<number>(performance.now());
  const lastSyncRef = useRef<number>(0);
  const paddleDirRef = useRef<-1 | 0 | 1>(0);
  const joystickTimeout = useRef<NodeJS.Timeout | null>(null);

  /* ---- Player position for proximity check ------------------------ */
  const playerPos = useAppSelector((s: any) => s.player.position || { x: 0, y: 0 });
  const isPlayerNearby = (() => {
    const pcx = playerPos.x + 80;
    const pcy = playerPos.y + 80;
    const left = position.x;
    const right = position.x + size.width;
    const top = position.y;
    const bottom = position.y + size.height;
    const cx = Math.max(left, Math.min(pcx, right));
    const cy = Math.max(top, Math.min(pcy, bottom));
    return Math.hypot(cx - pcx, cy - pcy) <= INTERACTION_RANGE;
  })();

  /* ---- Utilities --------------------------------------------------- */
  const pushState = useCallback((newPartial: Partial<BreakoutState>) => {
    dispatch(updateProgramState({ windowId, newState: newPartial }));
  }, [dispatch, windowId]);

  const startGame = () => {
    const init: BreakoutState = {
      gameState: 'playing',
      paddleX: 50,
      ball: { x: size.width / 2, y: size.height - 70, vx: 3, vy: -3 },
      bricks: freshBricks(),
      score: 0,
      lives: 3,
    };
    gameRef.current = init;
    pushState(init);
    dispatch(setSittingState(true));
    dispatch(setGamingState({ isGaming: true }));
  };

  const endGame = (finalScore: number) => {
    gameRef.current.gameState = 'gameOver';
    pushState({ gameState: 'gameOver', score: finalScore });
    dispatch(setGamingState({ isGaming: false }));
    dispatch(setSittingState(false));
  };

  /* ------------------------- Key Handling -------------------------- */
  useEffect(() => {
    if (!isHost) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Only handle events when player is nearby to avoid interfering with window management
      if (!isPlayerNearby) return;

      const key = e.key.toLowerCase();

      // Start game (title / gameOver)
      if ((programState.gameState === 'title' || programState.gameState === 'gameOver') &&
          ['e', 'enter'].includes(key)) {
        e.preventDefault();
        startGame();
        return;
      }

      // Only handle game controls when actually playing
      if (gameRef.current.gameState !== 'playing') return;

      // Handle paddle controls
      if (['arrowleft', 'a'].includes(key)) {
        e.preventDefault();
        paddleDirRef.current = -1;
        if (joystickTimeout.current) clearTimeout(joystickTimeout.current);
        dispatch(setGamingState({ isGaming: true, inputDirection: 'left' }));
        joystickTimeout.current = setTimeout(() => {
          dispatch(setGamingState({ isGaming: true, inputDirection: null }));
          joystickTimeout.current = null;
        }, 150);
      } else if (['arrowright', 'd'].includes(key)) {
        e.preventDefault();
        paddleDirRef.current = 1;
        if (joystickTimeout.current) clearTimeout(joystickTimeout.current);
        dispatch(setGamingState({ isGaming: true, inputDirection: 'right' }));
        joystickTimeout.current = setTimeout(() => {
          dispatch(setGamingState({ isGaming: true, inputDirection: null }));
          joystickTimeout.current = null;
        }, 150);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      // Only handle when nearby and playing
      if (!isPlayerNearby || gameRef.current.gameState !== 'playing') return;

      const key = e.key.toLowerCase();
      if (['arrowleft', 'a', 'arrowright', 'd'].includes(key)) {
        e.preventDefault();
        paddleDirRef.current = 0;
      }
    };

    // Use normal event listeners (not capture phase) to avoid interfering with window dragging
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (joystickTimeout.current) clearTimeout(joystickTimeout.current);
    };
  }, [isHost, programState.gameState, isPlayerNearby, dispatch]);

  /* ------------------------- Host Game Loop ------------------------ */
  // Cleanup gaming state when component unmounts or window closes
  useEffect(() => {
    return () => {
      if (isHost && (gameRef.current.gameState === 'playing')) {
        dispatch(setGamingState({ isGaming: false }));
        dispatch(setSittingState(false));
      }
      if (joystickTimeout.current) {
        clearTimeout(joystickTimeout.current);
        joystickTimeout.current = null;
      }
    };
  }, [isHost, dispatch]);

  useEffect(() => {
    if (!isHost || gameRef.current.gameState !== 'playing') return;

    let frameId: number;

    const step = () => {
      const now = performance.now();
      const dt = Math.min((now - lastFrameRef.current) / 1000, 0.05); // seconds
      lastFrameRef.current = now;

      const state = gameRef.current;

      /* --- Paddle movement --- */
      if (paddleDirRef.current !== 0) {
        const deltaPx = paddleDirRef.current * PADDLE_SPEED_PPS * dt;
        const deltaPercent = deltaPx / (size.width - PADDLE_W) * 100;
        state.paddleX = Math.max(0, Math.min(100, state.paddleX + deltaPercent));
      }

      /* --- Ball movement (frame-rate independent) --- */
      let { x, y, vx, vy } = state.ball;
      const FRAME_BASE = 60; // reference 60 fps baseline (vx,vy tuned for this)
      const stepScale = dt * FRAME_BASE;
      x += vx * stepScale;
      y += vy * stepScale;

      // Walls
      if (x < 10) { x = 10; vx = -vx; }
      if (x > size.width - 10 - BALL_SIZE) { x = size.width - 10 - BALL_SIZE; vx = -vx; }
      if (y < 40) { y = 40; vy = -vy; }

      // Paddle collision
      const paddlePx = (state.paddleX / 100) * (size.width - PADDLE_W);
      const paddleY = size.height - 50;
      if ( y + BALL_SIZE >= paddleY && y + BALL_SIZE <= paddleY + PADDLE_H && x + BALL_SIZE >= paddlePx && x <= paddlePx + PADDLE_W ) {
        vy = -Math.abs(vy);
        // tweak angle based on hit position
        const hit = (x + BALL_SIZE / 2) - (paddlePx + PADDLE_W / 2);
        vx += hit * 0.05;
      }

      // Brick collisions
      let scoreInc = 0;
      const BRICK_W = (size.width - 40) / BRICK_COLS;
      const bricks = state.bricks.map(r => [...r]);
      let bricksLeft = false;
      outer: for (let r = 0; r < BRICK_ROWS; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
          if (bricks[r][c] === 0) continue;
          bricksLeft = true;
          const bx = 20 + c * BRICK_W;
          const by = 60 + r * BRICK_H;
          if ( x + BALL_SIZE > bx && x < bx + BRICK_W && y + BALL_SIZE > by && y < by + BRICK_H ) {
            bricks[r][c] = 0; scoreInc = 10; vy = -vy; break outer;
          }
        }
      }

      // Bottom edge = lose life
      let lives = state.lives;
      if (y > size.height) {
        lives -= 1;
        if (lives <= 0) {
          endGame(state.score);
          return; // stop loop – endGame cancels gaming state
        }
        // reset ball
        x = size.width / 2; y = size.height - 70; vx = 3; vy = -3;
      }

      // Win: all bricks cleared → next level (regenerate bricks)
      if (!bricksLeft) {
        for (let r = 0; r < BRICK_ROWS; r++) for (let c = 0; c < BRICK_COLS; c++) bricks[r][c] = 1;
        vy = -Math.abs(vy) * 1.1;
      }

      // Commit local ref
      state.ball = { x, y, vx, vy };
      state.bricks = bricks;
      state.lives = lives;
      state.score += scoreInc;

      // Draw locally every frame (host only)
      drawCanvas(state);

      // Throttle snapshot to Redux for spectators
      if (now - lastSyncRef.current > SYNC_INTERVAL || scoreInc !== 0) {
        pushState({ ball: state.ball, bricks, paddleX: state.paddleX, score: state.score, lives });
        lastSyncRef.current = now;
      }

      frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [isHost, size.width, size.height, pushState, drawCanvas]);

  /* ------------------------ Canvas Rendering ----------------------- */
  function drawCanvas(src: BreakoutState) {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    if (canvas.width !== size.width || canvas.height !== size.height) {
      canvas.width = size.width;
      canvas.height = size.height;
    }

    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size.width, size.height);

    if (src.gameState !== 'playing') return;

    const BRICK_W = (size.width - 40) / BRICK_COLS;
    for (let r = 0; r < BRICK_ROWS; r++) for (let c = 0; c < BRICK_COLS; c++) {
      if (src.bricks[r]?.[c]) {
        ctx.fillStyle = `hsl(${r * 60},70%,50%)`;
        ctx.fillRect(20 + c * BRICK_W, 60 + r * BRICK_H, BRICK_W - 2, BRICK_H - 2);
      }
    }

    const paddlePx = (src.paddleX / 100) * (size.width - PADDLE_W);
    ctx.fillStyle = '#fff';
    ctx.fillRect(paddlePx, size.height - 50, PADDLE_W, PADDLE_H);

    ctx.fillStyle = '#f44';
    ctx.fillRect(src.ball.x, src.ball.y, BALL_SIZE, BALL_SIZE);

    ctx.fillStyle = '#fff';
    ctx.font = '12px Better VCR, monospace';
    ctx.fillText(`Score: ${src.score}`, 20, 20);
    ctx.fillText(`Lives: ${src.lives}`, size.width - 100, 20);
  }

  // On any prop change, redraw from correct source
  useEffect(() => {
    const src = isHost ? gameRef.current : programState;
    drawCanvas(src);
  }, [programState, isHost]);

  /* -------------------------- Audio ------------------------------- */
  useEffect(() => {
    if (isHost) {
      audioService.initialize();
      audioService.loadSound('breakout_hit', '/assets/sounds/move.wav');
    }
  }, [isHost]);

  /* --------------------------- Render ------------------------------ */
  const getWindowTitle = () => {
    switch (programState.gameState) {
      case 'title':
        return 'Breakout';
      case 'playing':
        return `Breakout - Score: ${programState.score} Lives: ${programState.lives}`;
      case 'gameOver':
        return 'Breakout - Game Over';
      default:
        return 'Breakout';
    }
  };

  const renderContent = () => {
    if (programState.gameState === 'title') {
      return (
        <div style={{ 
          padding: '40px 20px', 
          fontFamily: 'Better VCR, monospace', 
          textAlign: 'center',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #001133, #003366)'
        }}>
          <div style={{ 
            fontSize: '32px', 
            fontWeight: 'bold', 
            color: '#00ffff',
            marginBottom: '20px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
          }}>
            🧱 BREAKOUT
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: '#ffffff',
            marginBottom: '30px',
            lineHeight: '1.6'
          }}>
            Break all the bricks to win!<br/>
            Use ← → or A D to move paddle
          </div>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 'bold', 
            color: '#ffff00',
            padding: '10px 20px',
            border: '2px solid #ffff00',
            borderRadius: '4px',
            backgroundColor: 'rgba(255,255,0,0.1)'
          }}>
            PRESS E TO START
          </div>
          {!isHost && (
            <div style={{ 
              marginTop: '20px', 
              fontSize: '12px', 
              color: '#ff6666' 
            }}>
              Only {controllerId} can start the game
            </div>
          )}
        </div>
      );
    }

    if (programState.gameState === 'gameOver') {
      return (
        <div style={{ 
          padding: '40px 20px', 
          fontFamily: 'Better VCR, monospace', 
          textAlign: 'center',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #330011, #660033)'
        }}>
          <div style={{ 
            fontSize: '28px', 
            fontWeight: 'bold', 
            color: '#ff6666',
            marginBottom: '20px'
          }}>
            GAME OVER
          </div>
          <div style={{ 
            fontSize: '18px', 
            color: '#ffffff',
            marginBottom: '20px'
          }}>
            Final Score: {programState.score}
          </div>
          {isHost && (
            <div style={{ 
              fontSize: '14px', 
              color: '#ffff00',
              padding: '10px 20px',
              border: '2px solid #ffff00',
              borderRadius: '4px',
              backgroundColor: 'rgba(255,255,0,0.1)'
            }}>
              PRESS E TO PLAY AGAIN
            </div>
          )}
        </div>
      );
    }

    // Playing state - show the canvas game
    return (
      <div style={{ padding: '10px', textAlign: 'center' }}>
        <canvas
          ref={canvasRef}
          width={size.width - 20}
          height={size.height - 70}
          style={{ 
            border: '2px inset #c0c0c0',
            backgroundColor: '#000000'
          }}
        />
      </div>
    );
  };

  if (isMinimized) return null;

  return (
    <ProgramWindow
      windowId={windowId}
      title={getWindowTitle()}
      icon="🧱"
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

export default Breakout; 