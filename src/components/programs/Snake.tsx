import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateProgramState } from '../../store/programSlice';
import { setGamingState } from '../../store/playerSlice';
import ProgramWindow from '../ProgramWindow';
import { audioService } from '../../services/audioService';

interface SnakeProps {
  windowId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  programState: {
    gameState: 'title' | 'playing' | 'paused' | 'gameOver';
    snake: Array<{ x: number; y: number }>;
    food: { x: number; y: number };
    direction: 'up' | 'down' | 'left' | 'right';
    score: number;
    highScore: number;
    speed: number;
    gridSize: number;
  };
  controllerId: string;
  currentPlayerId: string;
}

const INTERACTION_RANGE = 80; // Same as icon interaction range

const Snake: React.FC<SnakeProps> = ({
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
  const gameLoopRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const gameSpeedRef = useRef<number>(120); // Faster base speed for better responsiveness
  
  // Local game state (not in Redux to avoid re-renders)
  const gameStateRef = useRef({
    snake: [{ x: 10, y: 10 }],
    food: { x: 15, y: 15 },
    direction: 'right' as 'up' | 'down' | 'left' | 'right',
    score: 0,
    gameStatus: 'title' as 'title' | 'playing' | 'paused' | 'gameOver'
  });
  
  // Input buffering for more responsive controls
  const inputBufferRef = useRef<string | null>(null);
  const lastDirectionChangeRef = useRef<number>(0);
  
  // Spectator sync - update Redux periodically for other players to watch
  const lastSpectatorSyncRef = useRef<number>(0);
  const SPECTATOR_SYNC_INTERVAL = 100; // Sync every 100ms for spectators
  
  // Joystick spring-back timer
  const joystickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isPlayerNearby, setIsPlayerNearby] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayStatus, setDisplayStatus] = useState<'title' | 'playing' | 'paused' | 'gameOver'>('title');
  const [directionIndicator, setDirectionIndicator] = useState<{ direction: string; timestamp: number } | null>(null);
  
  // Get current player position for proximity detection
  const currentPlayerPosition = useAppSelector((state: any) => state.player?.position || { x: 0, y: 0 });
  const currentGamingState = useAppSelector((state: any) => state.player?.gamingInputDirection || null);
  
  const isController = controllerId === currentPlayerId;
  const isGameActive = programState.gameState === 'playing';

  // Calculate grid dimensions based on window size
  const gameWidth = size.width - 20; // Account for padding
  const gameHeight = size.height - 60; // Account for title bar and padding
  const gridCols = Math.floor(gameWidth / programState.gridSize);
  const gridRows = Math.floor(gameHeight / programState.gridSize);

  // Use refs to avoid recreating intervals
  const stateRef = useRef(programState);
  const gridRef = useRef({ cols: gridCols, rows: gridRows });
  
  useEffect(() => {
    stateRef.current = programState;
    gridRef.current = { cols: gridCols, rows: gridRows };
  }, [programState, gridCols, gridRows]);

  // Check if player is near the window (match useMovement logic)
  useEffect(() => {
    if (!isController) return;

    const playerCenterX = currentPlayerPosition.x + 80; // Half of character width
    const playerCenterY = currentPlayerPosition.y + 80; // Half of character height
    
    // Calculate distance to nearest edge of window (like useMovement does)
    const windowLeft = position.x;
    const windowRight = position.x + size.width;
    const windowTop = position.y;
    const windowBottom = position.y + size.height;

    // Find closest point on window to player center
    const closestX = Math.max(windowLeft, Math.min(playerCenterX, windowRight));
    const closestY = Math.max(windowTop, Math.min(playerCenterY, windowBottom));

    const distance = Math.sqrt(
      Math.pow(closestX - playerCenterX, 2) + 
      Math.pow(closestY - playerCenterY, 2)
    );
    
    setIsPlayerNearby(distance <= INTERACTION_RANGE);
  }, [currentPlayerPosition, position, size, isController]);

  const generateFood = useCallback((snake: Array<{ x: number; y: number }>): { x: number; y: number } => {
    const grid = gridRef.current;
    let food: { x: number; y: number };
    
    // Create a temporary set for this food generation (more efficient than .some())
    const snakePositions = new Set<string>();
    for (const segment of snake) {
      snakePositions.add(`${segment.x},${segment.y}`);
    }
    
    do {
      food = {
        x: Math.floor(Math.random() * grid.cols),
        y: Math.floor(Math.random() * grid.rows)
      };
    } while (snakePositions.has(`${food.x},${food.y}`));
    
    return food;
  }, []);

  // Canvas rendering function - OPTIMIZED VERSION
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Cache grid size to avoid repeated property access
    const gridSize = stateRef.current.gridSize;
    
    // Controller uses local state for smooth gameplay, spectators use Redux state
    const gameState = isController ? gameStateRef.current : {
      snake: programState.snake || [{ x: 10, y: 10 }],
      food: programState.food || { x: 15, y: 15 },
      direction: programState.direction || 'right',
      score: programState.score || 0,
      gameStatus: programState.gameState || 'title'
    };

    // Disable expensive shadow effects globally
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // Clear canvas once
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Optimize snake rendering - batch all body segments
    if (gameState.snake.length > 0) {
      // Draw all body segments at once (no glow effects)
      ctx.fillStyle = '#009900';
      for (let i = 1; i < gameState.snake.length; i++) {
        const segment = gameState.snake[i];
        ctx.fillRect(
          segment.x * gridSize + 1,
          segment.y * gridSize + 1,
          gridSize - 2,
          gridSize - 2
        );
      }

      // Draw head separately (brighter but no glow)
      const head = gameState.snake[0];
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(
        head.x * gridSize + 1,
        head.y * gridSize + 1,
        gridSize - 2,
        gridSize - 2
      );
    }

    // Draw food as rectangle instead of circle (much faster)
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(
      gameState.food.x * gridSize + 1,
      gameState.food.y * gridSize + 1,
      gridSize - 2,
      gridSize - 2
    );

    // Draw direction indicator for immediate feedback
    if (directionIndicator && (Date.now() - directionIndicator.timestamp < 200)) {
      const head = gameState.snake[0];
      const headCenterX = head.x * gridSize + gridSize / 2;
      const headCenterY = head.y * gridSize + gridSize / 2;
      
      ctx.fillStyle = '#ffff00';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      
      const arrows = { up: '↑', down: '↓', left: '←', right: '→' };
      const arrow = arrows[directionIndicator.direction as keyof typeof arrows] || '';
      
      ctx.fillText(arrow, headCenterX, headCenterY - 15);
    }
  }, []); // Remove dependency to prevent recreations

  const gameOver = useCallback(() => {
    const gameState = gameStateRef.current;
    gameStateRef.current.gameStatus = 'gameOver';
    
    // Clear gaming state (stand up from sitting)
    if (isController) {
      // Clear any pending joystick timeout
      if (joystickTimeoutRef.current) {
        clearTimeout(joystickTimeoutRef.current);
        joystickTimeoutRef.current = null;
      }
      dispatch(setGamingState({ isGaming: false }));
      audioService.playSound('gameover');
    }
    
    // Update display state
    setDisplayStatus('gameOver');
    
    // Only sync final score to Redux
    dispatch(updateProgramState({
      windowId,
      newState: {
        gameState: 'gameOver',
        score: gameState.score,
        highScore: Math.max(programState.highScore, gameState.score)
      }
    }));
  }, [windowId, dispatch, programState.highScore, isController]);

  // Optimized collision detection using Set for O(1) lookup
  const snakePositionsSetRef = useRef<Set<string>>(new Set());
  
  const updateSnakePositionsSet = useCallback((snake: Array<{ x: number; y: number }>) => {
    snakePositionsSetRef.current.clear();
    for (const segment of snake) {
      snakePositionsSetRef.current.add(`${segment.x},${segment.y}`);
    }
  }, []);

  // Create stable refs for functions to avoid recreating updateGame
  const gameOverRef = useRef<(() => void) | null>(null);
  const generateFoodRef = useRef<((snake: Array<{ x: number; y: number }>) => { x: number; y: number }) | null>(null);
  const updateSnakePositionsSetRef = useRef<((snake: Array<{ x: number; y: number }>) => void) | null>(null);
  const renderCanvasRef = useRef<(() => void) | null>(null);

  // Update refs when functions change
  useEffect(() => {
    gameOverRef.current = gameOver;
    generateFoodRef.current = generateFood;
    updateSnakePositionsSetRef.current = updateSnakePositionsSet;
    renderCanvasRef.current = renderCanvas;
  }, [gameOver, generateFood, updateSnakePositionsSet, renderCanvas]);

  const updateGame = useCallback((timestamp: number) => {
    const gameState = gameStateRef.current;
    
    if (gameState.gameStatus !== 'playing') {
      gameLoopRef.current = null;
      return;
    }
    
    // Process buffered input immediately for responsiveness
    if (inputBufferRef.current) {
      const newDirection = inputBufferRef.current;
      const currentDirection = gameState.direction;
      
      // Apply direction change if valid (can't reverse into self)
      const validChange = 
        (newDirection === 'up' && currentDirection !== 'down') ||
        (newDirection === 'down' && currentDirection !== 'up') ||
        (newDirection === 'left' && currentDirection !== 'right') ||
        (newDirection === 'right' && currentDirection !== 'left');
        
      if (validChange) {
        gameState.direction = newDirection as 'up' | 'down' | 'left' | 'right';
        lastDirectionChangeRef.current = timestamp;
        if (isController) {
          audioService.playSound('move');
        }
      }
      
      inputBufferRef.current = null; // Clear buffer
    }
    
    // Dynamic speed based on snake length for better game feel
    const baseSpeed = 120;
    const speedIncrease = Math.floor(gameState.snake.length / 5) * 10; // Faster every 5 segments
    const currentSpeed = Math.max(60, baseSpeed - speedIncrease); // Cap at minimum 60ms
    
    // Throttle to dynamic game speed
    if (timestamp - lastUpdateTimeRef.current < currentSpeed) {
      gameLoopRef.current = requestAnimationFrame(updateGame);
      return;
    }
    
    lastUpdateTimeRef.current = timestamp;
    const grid = gridRef.current;
    
    const head = gameState.snake[0];
    let newHead = { ...head };
    
    // Move head based on current direction
    switch (gameState.direction) {
      case 'up':
        newHead.y -= 1;
        break;
      case 'down':
        newHead.y += 1;
        break;
      case 'left':
        newHead.x -= 1;
        break;
      case 'right':
        newHead.x += 1;
        break;
    }
    
    // Check wall collision
    if (newHead.x < 0 || newHead.x >= grid.cols || newHead.y < 0 || newHead.y >= grid.rows) {
      gameOverRef.current?.();
      return;
    }
    
    // Optimized self collision detection - O(1) instead of O(n)
    const newHeadKey = `${newHead.x},${newHead.y}`;
    if (snakePositionsSetRef.current.has(newHeadKey)) {
      gameOverRef.current?.();
      return;
    }
    
    const newSnake = [newHead, ...gameState.snake];
    let newFood = gameState.food;
    let newScore = gameState.score;
    
    // Check food collision
    if (newHead.x === gameState.food.x && newHead.y === gameState.food.y) {
      newScore += 10;
      newFood = generateFoodRef.current?.(newSnake) ?? newFood;
      if (isController) {
        audioService.playSound('eat');
      }
    } else {
      // Remove tail if no food eaten
      newSnake.pop();
    }
    
    // Update local state (no Redux dispatch = no re-render)
    gameStateRef.current.snake = newSnake;
    gameStateRef.current.food = newFood;
    gameStateRef.current.score = newScore;
    
    // Update collision detection set
    updateSnakePositionsSetRef.current?.(newSnake);
    
    // Update display score occasionally (not every frame)
    if (newScore !== displayScore) {
      setDisplayScore(newScore);
    }
    
    // Sync state to Redux for spectators (only if controller)
    if (isController && timestamp - lastSpectatorSyncRef.current >= SPECTATOR_SYNC_INTERVAL) {
      lastSpectatorSyncRef.current = timestamp;
      dispatch(updateProgramState({
        windowId,
        newState: {
          snake: newSnake,
          food: newFood,
          direction: gameState.direction,
          score: newScore,
          gameState: 'playing'
        }
      }));
    }
    
    // Render and continue loop
    renderCanvasRef.current?.();
    gameLoopRef.current = requestAnimationFrame(updateGame);
  }, [displayScore]); // Minimal dependencies

  // Game loop - uses requestAnimationFrame for better performance
  useEffect(() => {
    if (displayStatus !== 'playing') {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    // Start game loop
    if (!gameLoopRef.current) {
      gameLoopRef.current = requestAnimationFrame(updateGame);
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [displayStatus, updateGame]);

  // Handle keyboard input for game controls
  useEffect(() => {
    const gameActive = displayStatus === 'playing';
    if (!isController || !isPlayerNearby || !gameActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      
      // Prevent default movement and capture input for game
      if (['w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault();
        event.stopPropagation();
        
        // Map key to direction and buffer it for immediate processing
        let newDirection: string | null = null;
        let spriteDirection: string | null = null;
        switch (key) {
          case 'w':
            newDirection = 'up';
            spriteDirection = 'up';
            break;
          case 's':
            newDirection = 'down';
            spriteDirection = 'down';
            break;
          case 'a':
            newDirection = 'left';
            spriteDirection = 'right'; // Character facing away, so left input = right sprite
            break;
          case 'd':
            newDirection = 'right';
            spriteDirection = 'left'; // Character facing away, so right input = left sprite
            break;
        }
        
        // Buffer the input for immediate processing in game loop
        if (newDirection) {
          inputBufferRef.current = newDirection;
          // Show immediate visual feedback
          setDirectionIndicator({ direction: newDirection, timestamp: Date.now() });
          
          // Update sitting sprite direction (with corrected left-right logic)
          if (isController && spriteDirection) {
            // Clear any existing timeout
            if (joystickTimeoutRef.current) {
              clearTimeout(joystickTimeoutRef.current);
            }
            
            dispatch(setGamingState({ 
              isGaming: true, 
              inputDirection: spriteDirection as 'up' | 'down' | 'left' | 'right'
            }));
            
            // Joystick spring-back behavior - return to neutral quickly
            joystickTimeoutRef.current = setTimeout(() => {
              dispatch(setGamingState({ isGaming: true, inputDirection: null }));
              joystickTimeoutRef.current = null;
            }, 150);
          }
        }
      }
      
      // Pause/unpause with space
      if (key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        
        const newStatus = displayStatus === 'playing' ? 'paused' : 'playing';
        gameStateRef.current.gameStatus = newStatus;
        setDisplayStatus(newStatus);
        
        // Update gaming state based on pause/play
        if (isController) {
          dispatch(setGamingState({ 
            isGaming: newStatus === 'playing',
            inputDirection: newStatus === 'playing' ? currentGamingState : null
          }));
        }
        
        dispatch(updateProgramState({
          windowId,
          newState: { gameState: newStatus }
        }));
      }
    };

    // Add event listener with capture to intercept before useMovement
    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isController, isPlayerNearby, displayStatus, windowId, dispatch]);

  // Handle E key for starting game from title screen
  useEffect(() => {
    if (!isController || !isPlayerNearby || displayStatus !== 'title') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'e') {
        event.preventDefault();
        event.stopPropagation();
        startGame();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isController, isPlayerNearby, displayStatus]);

  const startGame = () => {
    const newSnake = [{ x: Math.floor(gridCols / 2), y: Math.floor(gridRows / 2) }];
    const newFood = generateFood(newSnake);
    
    // Reset local game state
    gameStateRef.current = {
      snake: newSnake,
      food: newFood,
      direction: 'right',
      score: 0,
      gameStatus: 'playing'
    };
    
    // Initialize collision detection set
    updateSnakePositionsSet(newSnake);
    
    // Set gaming state for sitting sprite
    if (isController) {
      dispatch(setGamingState({ isGaming: true }));
    }
    
    // Update display state
    setDisplayStatus('playing');
    setDisplayScore(0);
    
    // Sync to Redux (minimal state)
    dispatch(updateProgramState({
      windowId,
      newState: {
        gameState: 'playing',
        score: 0,
      }
    }));
  };

  const resetGame = () => {
    // Reset local state
    gameStateRef.current = {
      snake: [{ x: 10, y: 10 }],
      food: { x: 15, y: 15 },
      direction: 'right',
      score: 0,
      gameStatus: 'title'
    };
    
    // Clear gaming state (stand up from sitting)
    if (isController) {
      // Clear any pending joystick timeout
      if (joystickTimeoutRef.current) {
        clearTimeout(joystickTimeoutRef.current);
        joystickTimeoutRef.current = null;
      }
      dispatch(setGamingState({ isGaming: false }));
    }
    
    // Update display state
    setDisplayStatus('title');
    setDisplayScore(0);
    
    // Sync to Redux
    dispatch(updateProgramState({
      windowId,
      newState: {
        gameState: 'title',
        score: 0,
      }
    }));
  };

  // Initialize audio
  useEffect(() => {
    if (isController) {
      audioService.initialize();
      // Load sound effects
      audioService.loadSound('move', '/assets/sounds/move.wav');
      audioService.loadSound('eat', '/assets/sounds/eat.wav');
      audioService.loadSound('gameover', '/assets/sounds/gameover.wav');
    }
  }, [isController]);

  // Initialize canvas when component mounts
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Set up canvas with proper pixel density
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false; // Keep pixels crisp
        renderCanvas();
      }
    }
  }, [renderCanvas]);

  // Initialize display state from Redux state on mount
  useEffect(() => {
    setDisplayStatus(programState.gameState);
    setDisplayScore(programState.score);
  }, [programState.gameState, programState.score]);

  // Clear direction indicator after timeout
  useEffect(() => {
    if (directionIndicator) {
      const timeout = setTimeout(() => {
        setDirectionIndicator(null);
      }, 200);
      
      return () => clearTimeout(timeout);
    }
  }, [directionIndicator]);

  // Spectators: re-render when Redux state updates
  useEffect(() => {
    if (!isController && programState.gameState === 'playing') {
      renderCanvas();
    }
  }, [programState.snake, programState.food, programState.direction, isController, renderCanvas]);

  const getWindowTitle = () => {
    const baseTitle = "SNEK";
    const controllerInfo = !isController ? ` (Watching ${controllerId})` : '';
    const pausedInfo = (isController ? displayStatus : programState.gameState) === 'paused' ? ' [PAUSED]' : '';
    return `${baseTitle}${controllerInfo}${pausedInfo}`;
  };

  const renderGame = () => {
    if (displayStatus === 'title') {
      return (
        <div className="snake-title-screen">
          <div className="snake-logo">🐍 SNEK</div>
          <div className="snake-start-hint">
            <strong>PRESS E TO START</strong>
          </div>
        </div>
      );
    }

    if (displayStatus === 'gameOver') {
      return (
        <div className="snake-game-over">
          <div className="snake-game-over-text">GAME OVER</div>
          <div className="snake-final-score">Final Score: {displayScore}</div>
          {displayScore === programState.highScore && (
            <div className="snake-new-record">NEW HIGH SCORE!</div>
          )}
          <button onClick={resetGame} disabled={!isController}>
            Play Again
          </button>
        </div>
      );
    }

    // Render game board with canvas
    return (
      <div className="snake-game-area" style={{ 
        width: gameWidth, 
        height: gameHeight,
        position: 'relative',
        border: '2px inset #c0c0c0'
      }}>
        {/* Canvas for high-performance rendering */}
        <canvas
          ref={canvasRef}
          width={gameWidth}
          height={gameHeight}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            imageRendering: 'pixelated' // Keep crisp pixels
          }}
        />
        
        {/* Pause overlay */}
        {displayStatus === 'paused' && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#ffff00',
            padding: '20px',
            borderRadius: '4px',
            fontFamily: 'Better VCR, monospace',
            fontSize: '24px',
            fontWeight: 'bold',
            textAlign: 'center',
            border: '2px solid #ffff00'
          }}>
            PAUSED<br/>
            <span style={{ fontSize: '14px' }}>Press Space to Continue</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <ProgramWindow
      windowId={windowId}
      title={getWindowTitle()}
      icon="🐍"
      position={position}
      size={size}
      zIndex={zIndex}
      isMinimized={isMinimized}
      isResizable={true}
    >
      <div className="snake-program">
        {renderGame()}
      </div>
    </ProgramWindow>
  );
};

export default Snake; 