import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { 
  setPlayerPosition, 
  updateCamera, 
  changeRoom, 
  setInteractableNearby,
  ChickenQuestRoom 
} from '../../store/chickenQuestSlice';
import ProgramWindow from '../ProgramWindow';
import ChickenCharacter from './ChickenCharacter';
import TrainingBoard from './TrainingBoard';

interface ChickenQuestProps {
  windowId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  programState: {
    gameState: 'playing' | 'training' | 'dialogue';
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
  
  // Animation and input state
  const animationFrameRef = useRef<number>(0);
  const keysPressed = useRef<Set<string>>(new Set());
  const lastAnimationTime = useRef<number>(0);
  const walkAnimationFrame = useRef<number>(1);
  const [facingDirection, setFacingDirection] = useState<'left' | 'right'>('right');
  const [isMovingState, setIsMovingState] = useState(false);
  const [showTrainingBoard, setShowTrainingBoard] = useState(false);
  
  // Only controller can move the character
  const isController = controllerId === currentPlayerId;
  
  // Movement speed
  const MOVE_SPEED = 3;
  const INTERACTION_RANGE = 40;

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

  // Keyboard input handling
  useEffect(() => {
    if (!isController) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      keysPressed.current.add(event.key.toLowerCase());
      event.preventDefault();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keysPressed.current.delete(event.key.toLowerCase());
      event.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isController]);

  // Check collision at given position
  const checkCollision = useCallback((x: number, y: number): string | null => {
    if (!collisionImageRef.current) return null;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    canvas.width = collisionImageRef.current.width;
    canvas.height = collisionImageRef.current.height;
    ctx.drawImage(collisionImageRef.current, 0, 0);
    
    try {
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
      return null;
    }
  }, []);

  // Update camera position to follow player
  const updateCameraPosition = useCallback((playerX: number, playerY: number) => {
    const viewportCenterX = VIEWPORT_WIDTH / 2;
    const cameraX = Math.max(0, Math.min(ROOM_WIDTH - VIEWPORT_WIDTH, playerX - viewportCenterX));
    
    dispatch(updateCamera({ x: cameraX, y: 0 }));
  }, [dispatch]);

  // Game loop for movement and collision
  const gameLoop = useCallback(() => {
    if (!isController) return;
    
    const now = Date.now();
    const deltaTime = now - lastAnimationTime.current;
    lastAnimationTime.current = now;
    
    let newX = chickenQuestState.playerPosition.x;
    let newY = chickenQuestState.playerPosition.y;
    let isMoving = false;
    
    // Handle movement input
    if (keysPressed.current.has('a') || keysPressed.current.has('arrowleft')) {
      newX -= MOVE_SPEED;
      isMoving = true;
      setFacingDirection('left');
    }
    if (keysPressed.current.has('d') || keysPressed.current.has('arrowright')) {
      newX += MOVE_SPEED;
      isMoving = true;
      setFacingDirection('right');
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
    
    // Collision detection
    const collision = checkCollision(newX + CHICKEN_WIDTH / 2, newY + CHICKEN_HEIGHT / 2);
    
    if (collision === 'wall') {
      // Can't move into walls
      newX = chickenQuestState.playerPosition.x;
      newY = chickenQuestState.playerPosition.y;
      isMoving = false;
    }
    
    // Update position if changed
    if (newX !== chickenQuestState.playerPosition.x || newY !== chickenQuestState.playerPosition.y) {
      dispatch(setPlayerPosition({ x: newX, y: newY }));
      updateCameraPosition(newX, newY);
    }
    
    // Check for nearby interactables
    const nearbyCollision = checkCollision(newX + CHICKEN_WIDTH / 2, newY + CHICKEN_HEIGHT / 2 + INTERACTION_RANGE);
    if (nearbyCollision === 'training_board' || nearbyCollision === 'npc') {
      dispatch(setInteractableNearby(nearbyCollision));
    } else {
      dispatch(setInteractableNearby(null));
    }
    
    // Handle interaction
    if (keysPressed.current.has('e') && chickenQuestState.interactableNearby) {
      if (chickenQuestState.interactableNearby === 'training_board') {
        setShowTrainingBoard(true);
      } else if (chickenQuestState.interactableNearby === 'npc') {
        // TODO: Start dialogue
        console.log('Interact with NPC');
      }
      keysPressed.current.delete('e');
    }
    
    // Update walk animation
    setIsMovingState(isMoving);
    if (isMoving && deltaTime > 100) {
      walkAnimationFrame.current = walkAnimationFrame.current >= 10 ? 1 : walkAnimationFrame.current + 1;
    }
    
    animationFrameRef.current = requestAnimationFrame(gameLoop);
  }, [isController, chickenQuestState, dispatch, checkCollision, updateCameraPosition]);

  // Start game loop
  useEffect(() => {
    if (isController) {
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameLoop, isController]);

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
              x: chickenQuestState.playerPosition.x - chickenQuestState.camera.x,
              y: chickenQuestState.playerPosition.y - chickenQuestState.camera.y
            }}
            isMoving={isMovingState}
            walkFrame={walkAnimationFrame.current}
            facingDirection={facingDirection}
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
            <strong>Room:</strong> {chickenQuestState.currentRoom} | 
            <strong> Position:</strong> ({Math.round(chickenQuestState.playerPosition.x)}, {Math.round(chickenQuestState.playerPosition.y)})
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
    </ProgramWindow>
  );
};

export default ChickenQuest; 