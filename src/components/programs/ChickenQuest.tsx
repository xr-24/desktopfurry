import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateProgramState } from '../../store/programSlice';
import { 
  setPlayerPosition, 
  updateCamera, 
  changeRoom, 
  setInteractableNearby,
  ChickenQuestRoom 
} from '../../store/chickenQuestSlice';
import { setGamingState } from '../../store/playerSlice';
import ProgramWindow from '../ProgramWindow';
import ChickenCharacter from './ChickenCharacter';
import TrainingBoard from './TrainingBoard';

// Add pulse animation CSS
const pulseKeyframes = `
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.05); }
  }
`;

// Inject CSS if not already present
if (!document.head.querySelector('#chickenquest-styles')) {
  const style = document.createElement('style');
  style.id = 'chickenquest-styles';
  style.textContent = pulseKeyframes;
  document.head.appendChild(style);
}

interface ChickenQuestProps {
  windowId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  programState: {
    gameState: 'title' | 'playing' | 'training' | 'dialogue';
    currentRoom: ChickenQuestRoom;
    playerPosition: { x: number; y: number };
    camera: { x: number; y: number };
    interactableNearby: string | null;
    showUI: boolean;
  };
  controllerId: string;
  currentPlayerId: string;
}

// Room dimensions
const ROOM_WIDTH = 1600;
const ROOM_HEIGHT = 480;
const VIEWPORT_WIDTH = 760;
const VIEWPORT_HEIGHT = 540;

// Chicken sprite dimensions
const CHICKEN_WIDTH = 32;
const CHICKEN_HEIGHT = 32;

// Interaction range for starting game
const INTERACTION_RANGE = 80;

const ChickenQuest: React.FC<ChickenQuestProps> = ({
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
  const chickenQuestState = useAppSelector((state: any) => state.chickenQuest);
  
  // Canvas refs for room and collision detection
  const gameCanvasRef = useRef<HTMLCanvasElement>(null);
  const roomImageRef = useRef<HTMLImageElement>(null);
  const collisionImageRef = useRef<HTMLImageElement>(null);
  
  // Local game state (like Snake - NOT in Redux to avoid re-renders)
  const gameStateRef = useRef({
    playerPosition: { x: 400, y: 350 },
    camera: { x: 0, y: 0 },
    currentRoom: 'town' as ChickenQuestRoom,
    facingDirection: 'right' as 'left' | 'right',
    isMoving: false,
    walkFrame: 1,
    interactableNearby: null as string | null,
    gameStatus: 'title' as 'title' | 'playing'
  });
  
  // Animation and input state
  const animationFrameRef = useRef<number>(0);
  const keysPressed = useRef<Set<string>>(new Set());
  const lastAnimationTime = useRef<number>(0);
  const [showTrainingBoard, setShowTrainingBoard] = useState(false);
  const [isPlayerNearby, setIsPlayerNearby] = useState(false);
  const [displayStatus, setDisplayStatus] = useState<'title' | 'playing'>('title');
  
  // Spectator sync
  const lastSpectatorSyncRef = useRef<number>(0);
  const SPECTATOR_SYNC_INTERVAL = 100;
  
  // Only controller can move the character
  const isController = controllerId === currentPlayerId;
  
  // Movement speed
  const MOVE_SPEED = 3;
  
  // Get current player position for proximity detection
  const currentPlayerPosition = useAppSelector((state: any) => state.player?.position || { x: 0, y: 0 });
  
  // Check if game is active (use local state like Snake)
  const isGameActive = displayStatus === 'playing';

  // Load room assets
  const loadRoomAssets = useCallback((roomName: ChickenQuestRoom) => {
    if (roomImageRef.current) {
      roomImageRef.current.src = `/assets/sprites/chickenquest/rooms/${roomName}-bg.png`;
    }
    if (collisionImageRef.current) {
      collisionImageRef.current.src = `/assets/sprites/chickenquest/rooms/${roomName}-collision.png`;
    }
  }, []);

  // Initialize room assets
  useEffect(() => {
    roomImageRef.current = new Image();
    collisionImageRef.current = new Image();
    loadRoomAssets(chickenQuestState.currentRoom);
  }, [chickenQuestState.currentRoom, loadRoomAssets]);

  // Check if player is near the window (match useMovement logic like Snake)
  useEffect(() => {
    if (!isController) return;

    const playerCenterX = currentPlayerPosition.x + 80; // Half of character width (160px)
    const playerCenterY = currentPlayerPosition.y + 80; // Half of character height (160px)
    
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

  // Game input handling (only when game is active) - matches Snake pattern
  useEffect(() => {
    if (!isController || !isGameActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      
      // Movement keys
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
        event.preventDefault();
        event.stopPropagation();
        keysPressed.current.add(key);
      }
      
      // Interaction key
      if (key === 'e') {
        event.preventDefault();
        event.stopPropagation();
        keysPressed.current.add(key);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      keysPressed.current.delete(key);
    };

    // Add event listener with capture to intercept before useMovement
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [isController, isGameActive]);

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

  // Check collision at given position
  const checkCollision = useCallback((x: number, y: number): string | null => {
    // If collision image isn't loaded yet, allow movement (don't block)
    if (!collisionImageRef.current || !collisionImageRef.current.complete) {
      return null;
    }
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    canvas.width = collisionImageRef.current.width;
    canvas.height = collisionImageRef.current.height;
    ctx.drawImage(collisionImageRef.current, 0, 0);
    
    try {
      // Make sure coordinates are within bounds
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) {
        return 'wall'; // Out of bounds = wall
      }
      
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const r = pixel[0];
      const g = pixel[1];
      const b = pixel[2];
      const a = pixel[3];
      
      // Check collision colors
      if (r === 255 && g === 0 && b === 0 && a === 255) return 'wall'; // Red = wall
      if (r === 0 && g === 0 && b === 255 && a === 255) return 'training_board'; // Blue = training board
      if (r === 0 && g === 255 && b === 0 && a === 255) return 'room_transition'; // Green = room transition
      if (r === 255 && g === 255 && b === 0 && a === 255) return 'npc'; // Yellow = NPC
      
      return null; // Transparent/black = walkable
    } catch (e) {
      return null; // On error, allow movement
    }
  }, []);

  // Update camera position to follow player
  const updateCameraPosition = useCallback((playerX: number, playerY: number) => {
    const viewportCenterX = VIEWPORT_WIDTH / 2;
    const cameraX = Math.max(0, Math.min(ROOM_WIDTH - VIEWPORT_WIDTH, playerX - viewportCenterX));
    
    dispatch(updateCamera({ x: cameraX, y: 0 }));
  }, [dispatch]);

  // Start game function (matches Snake pattern EXACTLY)
  const startGame = useCallback(() => {
    
    // Reset local game state (like Snake does)
    gameStateRef.current = {
      playerPosition: { x: 400, y: 350 },
      camera: { x: 0, y: 0 },
      currentRoom: 'town',
      facingDirection: 'right',
      isMoving: false,
      walkFrame: 1,
      interactableNearby: null,
      gameStatus: 'playing'
    };
    
    // Set gaming state for sitting sprite
    if (isController) {
      dispatch(setGamingState({ isGaming: true }));
    }
    
    // Update display state (local)
    setDisplayStatus('playing');
    
    // Sync to Redux (minimal state for spectators)
    dispatch(updateProgramState({
      windowId,
      newState: { gameState: 'playing' }
    }));
  }, [dispatch, windowId, isController]);

  // End game function 
  const endGame = useCallback(() => {
    dispatch(setGamingState({ isGaming: false }));
    dispatch(updateProgramState({
      windowId,
      newState: { gameState: 'title' }
    }));
  }, [dispatch, windowId]);

  // Cleanup gaming state on unmount
  useEffect(() => {
    return () => {
      if (isController) {
        dispatch(setGamingState({ isGaming: false }));
      }
    };
  }, [dispatch, isController]);

  // Game loop for movement and collision (like Snake - uses local gameStateRef)
  const gameLoop = useCallback(() => {
    const gameState = gameStateRef.current;
    
    if (!isController || gameState.gameStatus !== 'playing') {
      animationFrameRef.current = requestAnimationFrame(gameLoop);
      return;
    }
    
    const now = Date.now();
    const deltaTime = now - lastAnimationTime.current;
    lastAnimationTime.current = now;
    
    let newX = gameState.playerPosition.x;
    let newY = gameState.playerPosition.y;
    let isMoving = false;
    
    // Movement logic
    
    // Handle movement input
    if (keysPressed.current.has('a') || keysPressed.current.has('arrowleft')) {
      newX -= MOVE_SPEED;
      isMoving = true;
      gameState.facingDirection = 'left';
    }
    if (keysPressed.current.has('d') || keysPressed.current.has('arrowright')) {
      newX += MOVE_SPEED;
      isMoving = true;
      gameState.facingDirection = 'right';
    }
    if (keysPressed.current.has('w') || keysPressed.current.has('arrowup')) {
      newY -= MOVE_SPEED;
      isMoving = true;
    }
    if (keysPressed.current.has('s') || keysPressed.current.has('arrowdown')) {
      newY += MOVE_SPEED;
      isMoving = true;
    }
    
    // Bounds checking
    newX = Math.max(0, Math.min(ROOM_WIDTH - CHICKEN_WIDTH, newX));
    newY = Math.max(0, Math.min(ROOM_HEIGHT - CHICKEN_HEIGHT, newY));
    
    // Collision detection (but allow movement if no collision image loaded)
    const collision = checkCollision(newX + CHICKEN_WIDTH / 2, newY + CHICKEN_HEIGHT / 2);
    
    if (collision === 'wall') {
      // Can't move into walls
      newX = gameState.playerPosition.x;
      newY = gameState.playerPosition.y;
      isMoving = false;
    }
    
    // Update local game state (NOT Redux)
    if (newX !== gameState.playerPosition.x || newY !== gameState.playerPosition.y) {
      gameState.playerPosition.x = newX;
      gameState.playerPosition.y = newY;
      
      // Update camera
      const viewportCenterX = VIEWPORT_WIDTH / 2;
      const cameraX = Math.max(0, Math.min(ROOM_WIDTH - VIEWPORT_WIDTH, newX - viewportCenterX));
      gameState.camera.x = cameraX;
    }
    
    // Check for nearby interactables (only check below the character)
    const interactionCheckX = newX + CHICKEN_WIDTH / 2;
    const interactionCheckY = newY + CHICKEN_HEIGHT + 20;
    const nearbyCollision = checkCollision(interactionCheckX, interactionCheckY);
    gameState.interactableNearby = nearbyCollision === 'training_board' || nearbyCollision === 'npc' ? nearbyCollision : null;
    
    // Handle interaction
    if (keysPressed.current.has('e') && gameState.interactableNearby) {
      if (gameState.interactableNearby === 'training_board') {
        setShowTrainingBoard(true);
      } else if (gameState.interactableNearby === 'npc') {
        console.log('Interact with NPC');
      }
      keysPressed.current.delete('e');
    }
    
    // Update animation state
    gameState.isMoving = isMoving;
    if (isMoving && deltaTime > 100) {
      gameState.walkFrame = gameState.walkFrame >= 10 ? 1 : gameState.walkFrame + 1;
    }
    
    // Sync to Redux occasionally for spectators (like Snake does)
    if (now - lastSpectatorSyncRef.current > SPECTATOR_SYNC_INTERVAL) {
      dispatch(setPlayerPosition({ x: newX, y: newY }));
      dispatch(updateCamera({ x: gameState.camera.x, y: gameState.camera.y }));
      lastSpectatorSyncRef.current = now;
    }
    
    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [isController, chickenQuestState, dispatch, checkCollision, updateCameraPosition]);

  // Start game loop
  useEffect(() => {
    if (isController && isGameActive) {
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameLoop, isController, isGameActive]);

  // Render game
  const renderGame = useCallback(() => {
    const canvas = gameCanvasRef.current;
    if (!canvas || !roomImageRef.current) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw room background
    ctx.drawImage(
      roomImageRef.current,
      chickenQuestState.camera.x,
      chickenQuestState.camera.y,
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT,
      0,
      0,
      VIEWPORT_WIDTH,
      VIEWPORT_HEIGHT
    );
    
    // Chicken character will be rendered separately as an overlay
    
    // Draw interaction prompt
    if (chickenQuestState.interactableNearby) {
      const chickenSpriteX = chickenQuestState.playerPosition.x - chickenQuestState.camera.x;
      const chickenSpriteY = chickenQuestState.playerPosition.y - chickenQuestState.camera.y;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(chickenSpriteX - 20, chickenSpriteY - 40, 80, 20);
      ctx.fillStyle = 'white';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Press E', chickenSpriteX + CHICKEN_WIDTH / 2, chickenSpriteY - 26);
    }
    
  }, [chickenQuestState]);

  // Render loop
  useEffect(() => {
    const renderLoop = () => {
      renderGame();
      requestAnimationFrame(renderLoop);
    };
    renderLoop();
  }, [renderGame]);

  // Render title screen
  const renderTitleScreen = () => {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #4a90e2, #7b68ee)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'Better VCR, MS Sans Serif, sans-serif',
        color: 'white',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '20px',
          textShadow: '3px 3px 0px #000'
        }}>
          🐔 ChickenQuest
        </div>
        <div style={{
          fontSize: '16px',
          marginBottom: '40px',
          textShadow: '2px 2px 0px #000'
        }}>
          A Lite RPG Adventure
        </div>
        {isPlayerNearby ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            color: 'black',
            padding: '15px 30px',
            border: '3px solid #ffff00',
            borderRadius: '10px',
            fontSize: '18px',
            fontWeight: 'bold',
            animation: 'pulse 1.5s ease-in-out infinite',
            transform: 'scale(1.05)'
          }}>
            🎮 PRESS E TO START
          </div>
        ) : (
          <div style={{
            background: 'rgba(0, 0, 0, 0.7)',
            color: '#ccc',
            padding: '15px 30px',
            border: '2px solid #666',
            borderRadius: '10px',
            fontSize: '14px'
          }}>
            Walk closer to this window and press E to start
          </div>
        )}
        <div style={{
          marginTop: '30px',
          fontSize: '12px',
          opacity: 0.8,
          lineHeight: '1.5'
        }}>
          Train your chicken in Archery, Swordsmanship, Magic, Fishing & Charisma<br />
          Complete minigames to increase stats and unlock new equipment!
        </div>
      </div>
    );
  };

  if (isMinimized) return null;

  return (
    <ProgramWindow
      windowId={windowId}
      title="🐔 ChickenQuest"
      icon="🐔"
      position={position}
      size={size}
      zIndex={zIndex}
      isMinimized={isMinimized}
    >
      {displayStatus === 'title' ? renderTitleScreen() : (
        <div style={{
          width: '100%',
          height: '100%',
          background: '#1a1a1a',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Better VCR, MS Sans Serif, sans-serif'
        }}>
          {/* Game Viewport Container */}
          <div style={{
            position: 'relative',
            width: VIEWPORT_WIDTH,
            height: VIEWPORT_HEIGHT - 60,
            border: '2px solid #666',
            overflow: 'hidden',
            background: '#000'
          }}>
            {/* Game Canvas (Room Background) */}
            <canvas
              ref={gameCanvasRef}
              width={VIEWPORT_WIDTH}
              height={VIEWPORT_HEIGHT - 60}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                imageRendering: 'pixelated',
              }}
            />
            
                      {/* Chicken Character Overlay */}
          <ChickenCharacter
            position={{
              x: gameStateRef.current.playerPosition.x - gameStateRef.current.camera.x,
              y: gameStateRef.current.playerPosition.y - gameStateRef.current.camera.y
            }}
            isMoving={gameStateRef.current.isMoving}
            walkFrame={gameStateRef.current.walkFrame}
            facingDirection={gameStateRef.current.facingDirection}
            equippedItems={chickenQuestState.equippedItems}
            size={CHICKEN_WIDTH}
          />
          </div>
          
          {/* UI Panel */}
          <div style={{
            height: '60px',
            background: '#c0c0c0',
            padding: '5px',
            borderTop: '1px solid #808080',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px'
          }}>
            <div>
              <strong>Room:</strong> {gameStateRef.current.currentRoom} | 
              <strong> Position:</strong> ({Math.round(gameStateRef.current.playerPosition.x)}, {Math.round(gameStateRef.current.playerPosition.y)})
            </div>
            <div>
              <strong>Stats:</strong> A:{chickenQuestState.stats.archery} S:{chickenQuestState.stats.swordsman} M:{chickenQuestState.stats.magic} F:{chickenQuestState.stats.fishing} C:{chickenQuestState.stats.charisma}
            </div>
            <div>
              <strong>Gold:</strong> {chickenQuestState.gold}
            </div>
          </div>
          
          {/* Controls hint */}
          <div style={{
            position: 'absolute',
            top: '5px',
            left: '5px',
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '5px',
            fontSize: '10px',
            borderRadius: '3px'
          }}>
            {isController ? 'WASD/Arrows: Move | E: Interact' : 'Watching ' + controllerId}
          </div>

          {/* Training Board Modal */}
          <TrainingBoard
            isVisible={showTrainingBoard}
            onClose={() => setShowTrainingBoard(false)}
          />
        </div>
      )}
    </ProgramWindow>
  );
};

export default ChickenQuest; 