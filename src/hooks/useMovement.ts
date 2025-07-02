import { useEffect, useRef, useCallback, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setPosition } from '../store/playerSlice';
import { openProgram, updateProgramPosition, updateProgramSize } from '../store/programSlice';
import { socketService } from '../services/socketService';

const MOVEMENT_SPEED = 8;
const INTERACTION_RANGE = 60;
const DESKTOP_BOUNDS = {
  minX: 10,
  minY: 10,
  maxX: window.innerWidth - 60,
  maxY: window.innerHeight - 80,
};

// Desktop icons data
const DESKTOP_ICONS = [
  { id: 'paint', label: 'Paint', icon: '🎨', x: 50, y: 60, type: 'paint' as const },
  { id: 'notepad', label: 'Notepad', icon: '📝', x: 50, y: 160, type: 'notepad' as const },
  { id: 'winamp', label: 'Muze', icon: '🎵', x: 50, y: 260, type: 'winamp' as const },
  { id: 'checkers', label: 'Checkers', icon: '🔴', x: 50, y: 360, type: 'checkers' as const },
  { id: 'snake', label: 'SNEK', icon: '🐍', x: 150, y: 60, type: 'snake' as const },
];

const useMovement = () => {
  const dispatch = useAppDispatch();
  const [localPosition, setLocalPosition] = useState({ x: 200, y: 200 });
  const [isMoving, setIsMoving] = useState(false);
  const [movementDirection, setMovementDirection] = useState<string | null>(null);
  const [walkFrame, setWalkFrame] = useState(1); // 1 or 2 for walk animation
  const [nearbyIcon, setNearbyIcon] = useState<string | null>(null);
  const [facingDirection, setFacingDirection] = useState<'left' | 'right'>('left'); // Track last facing direction
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [grabbedWindowId, setGrabbedWindowId] = useState<string | null>(null);
  const [grabOffset, setGrabOffset] = useState({ x: 0, y: 0 });
  
  // New resize-related state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeAnchor, setResizeAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [resizeStartPosition, setResizeStartPosition] = useState({ x: 0, y: 0 });
  const [resizeSide, setResizeSide] = useState({ horizontal: 'left', vertical: 'top' });
  
  // Refs for grabbing state to avoid closure issues in updatePosition
  const isGrabbingRef = useRef(false);
  const grabbedWindowIdRef = useRef<string | null>(null);
  const grabOffsetRef = useRef({ x: 0, y: 0 });
  
  // Refs for resizing state
  const isResizingRef = useRef(false);
  const resizeAnchorRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const resizeStartPositionRef = useRef({ x: 0, y: 0 });
  const resizeSideRef = useRef({ horizontal: 'left', vertical: 'top' });
  
  const roomId = useAppSelector((state: any) => state.game?.roomId);
  const currentPlayerId = useAppSelector((state: any) => state.player?.id);
  const { openPrograms } = useAppSelector((state: any) => state.programs);
  const openProgramsRef = useRef(openPrograms);
  
  const keysPressed = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number | null>(null);
  const isAnimationRunningRef = useRef(false);
  const positionRef = useRef({ x: 200, y: 200 });
  const nearbyIconRef = useRef<string | null>(null);

  // Helper function to calculate distance between player and icon
  const getDistanceToIcon = (iconX: number, iconY: number, playerX: number, playerY: number) => {
    // Adjust for player center position (player is ~160px wide/tall, centered)
    const playerCenterX = playerX + 80; // Half of character width
    const playerCenterY = playerY + 80; // Half of character height
    
    // Adjust for icon center position (icons are 64x80, positioned at top-left)
    const iconCenterX = iconX + 32; // Half of icon width
    const iconCenterY = iconY + 40; // Half of icon height
    
    const dx = iconCenterX - playerCenterX;
    const dy = iconCenterY - playerCenterY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Helper function to find nearby icons
  const findNearbyIcon = (playerX: number, playerY: number) => {
    for (const icon of DESKTOP_ICONS) {
      const distance = getDistanceToIcon(icon.x, icon.y, playerX, playerY);
      if (distance <= INTERACTION_RANGE) {
        return icon.id;
      }
    }
    return null;
  };

  // Helper function to open a program
  const openProgramForIcon = useCallback((iconId: string) => {
    console.log('🔧 Attempting to open program:', iconId, 'Current player:', currentPlayerId);
    const icon = DESKTOP_ICONS.find(i => i.id === iconId);
    if (!icon || !currentPlayerId) {
      console.log('❌ Cannot open program - missing icon or player ID');
      return;
    }

    console.log('✅ Opening program:', icon.type);
    dispatch(openProgram({
      type: icon.type,
      controllerId: currentPlayerId,
      position: { x: localPosition.x + 100, y: localPosition.y - 50 }
    }));
  }, [currentPlayerId, localPosition.x, localPosition.y, dispatch]);

  // Helper function to check collision with program windows
  const checkWindowCollision = (newX: number, newY: number) => {
    // Make collision box much smaller and centered - only check core character area
    const padding = 40; // Much more padding - character is 160px, so this leaves 80x80 core
    const playerRect = {
      x: newX + padding,
      y: newY + padding, 
      width: 80, // Much smaller collision box (was 120, originally 160)
      height: 80 // Much smaller collision box (was 120, originally 160)
    };

    const currentPlayerRect = {
      x: positionRef.current.x + padding,
      y: positionRef.current.y + padding,
      width: 80,
      height: 80
    };

    for (const window of Object.values(openProgramsRef.current)) {
      const program = window as any;
      if (program.isMinimized) continue;
      
      // Skip collision with the window being grabbed  
      if (isGrabbingRef.current && program.id === grabbedWindowIdRef.current) continue;

      // Only check collision with the main content area, not title bar (first 30px)
      // This allows players to get close to the title bar for grabbing
      const titleBarHeight = 30;
      const windowRect = {
        x: program.position.x + 10, // Add 10px border padding
        y: program.position.y + titleBarHeight, // Skip title bar
        width: program.size.width - 20, // Subtract border padding
        height: program.size.height - titleBarHeight - 10 // Skip title bar and bottom border
      };

      // Check if currently overlapping with this window
      const currentlyOverlapping = (
        currentPlayerRect.x < windowRect.x + windowRect.width &&
        currentPlayerRect.x + currentPlayerRect.width > windowRect.x &&
        currentPlayerRect.y < windowRect.y + windowRect.height &&
        currentPlayerRect.y + currentPlayerRect.height > windowRect.y
      );

      // Check if new position would overlap
      const wouldOverlap = (
        playerRect.x < windowRect.x + windowRect.width &&
        playerRect.x + playerRect.width > windowRect.x &&
        playerRect.y < windowRect.y + windowRect.height &&
        playerRect.y + playerRect.height > windowRect.y
      );

      if (wouldOverlap) {
        // If already overlapping, allow movement that reduces overlap (escape movement)
        if (currentlyOverlapping) {
          const windowCenterX = windowRect.x + windowRect.width / 2;
          const windowCenterY = windowRect.y + windowRect.height / 2;
          const currentDistanceFromCenter = Math.sqrt(
            Math.pow(currentPlayerRect.x + currentPlayerRect.width / 2 - windowCenterX, 2) +
            Math.pow(currentPlayerRect.y + currentPlayerRect.height / 2 - windowCenterY, 2)
          );
          const newDistanceFromCenter = Math.sqrt(
            Math.pow(playerRect.x + playerRect.width / 2 - windowCenterX, 2) +
            Math.pow(playerRect.y + playerRect.height / 2 - windowCenterY, 2)
          );
          
          // Allow movement if it increases distance from window center (escape movement)
          if (newDistanceFromCenter > currentDistanceFromCenter) {
            continue; // Allow this movement
          }
        }
        
        return true; // Block movement into or further into window
      }
    }
    return false;
  };

      // Helper function to find nearby grabbable window
  const findNearbyWindow = (playerX: number, playerY: number) => {
    const playerCenterX = playerX + 80;
    const playerCenterY = playerY + 80;



    for (const window of Object.values(openProgramsRef.current)) {
      const program = window as any;
      if (program.isMinimized) continue;

      // Calculate distance to nearest edge of window instead of center
      const windowLeft = program.position.x;
      const windowRight = program.position.x + program.size.width;
      const windowTop = program.position.y;
      const windowBottom = program.position.y + program.size.height;

      // Find closest point on window to player center
      const closestX = Math.max(windowLeft, Math.min(playerCenterX, windowRight));
      const closestY = Math.max(windowTop, Math.min(playerCenterY, windowBottom));

      const distance = Math.sqrt(
        Math.pow(closestX - playerCenterX, 2) + 
        Math.pow(closestY - playerCenterY, 2)
      );

      // Reasonable grab range for windows (smaller since we're measuring to edges now)
      const grabRange = 80;

      if (distance <= grabRange) {
        return program.id;
      }
    }
    
    // Fallback: Check if player is simply inside any window bounds (more forgiving)
    for (const window of Object.values(openProgramsRef.current)) {
      const program = window as any;
      if (program.isMinimized) continue;

      const isInsideX = playerCenterX >= program.position.x && 
                       playerCenterX <= program.position.x + program.size.width;
      const isInsideY = playerCenterY >= program.position.y && 
                       playerCenterY <= program.position.y + program.size.height;
      
      if (isInsideX && isInsideY) {
        return program.id;
      }
    }
    return null;
  };

  // Helper function to start grabbing a window
  const startGrabbing = (windowId: string) => {
    const program = openProgramsRef.current[windowId];
    if (!program) return;

    setIsGrabbing(true);
    setGrabbedWindowId(windowId);
    
    // Calculate offset from player to window using current position ref
    const playerCenterX = positionRef.current.x + 80;
    const playerCenterY = positionRef.current.y + 80;
    const offset = {
      x: program.position.x - playerCenterX,
      y: program.position.y - playerCenterY
    };
    setGrabOffset(offset);

    // Update refs for immediate use in updatePosition callback
    isGrabbingRef.current = true;
    grabbedWindowIdRef.current = windowId;
    grabOffsetRef.current = offset;


  };

  // Helper function to stop grabbing
  const stopGrabbing = () => {
    setIsGrabbing(false);
    setGrabbedWindowId(null);
    setGrabOffset({ x: 0, y: 0 });
    setIsResizing(false);
    setResizeAnchor({ x: 0, y: 0, width: 0, height: 0 });
    setResizeStartPosition({ x: 0, y: 0 });
    setResizeSide({ horizontal: 'left', vertical: 'top' });
    
    // Update refs for immediate use in updatePosition callback
    isGrabbingRef.current = false;
    grabbedWindowIdRef.current = null;
    grabOffsetRef.current = { x: 0, y: 0 };
    isResizingRef.current = false;
    resizeAnchorRef.current = { x: 0, y: 0, width: 0, height: 0 };
    resizeStartPositionRef.current = { x: 0, y: 0 };
    resizeSideRef.current = { horizontal: 'left', vertical: 'top' };
  };

  // Helper function to start resizing
  const startResizing = () => {
    if (!grabbedWindowIdRef.current) return;
    
    const program = openProgramsRef.current[grabbedWindowIdRef.current];
    if (!program) return;

    // Store initial window state as resize anchor
    const anchor = {
      x: program.position.x,
      y: program.position.y, 
      width: program.size.width,
      height: program.size.height
    };

    // Store player's current position as resize start point
    const startPos = {
      x: positionRef.current.x,
      y: positionRef.current.y
    };

    // Determine which side of the window the player is on
    const playerCenterX = positionRef.current.x + 80;
    const playerCenterY = positionRef.current.y + 80;
    const windowCenterX = program.position.x + program.size.width / 2;
    const windowCenterY = program.position.y + program.size.height / 2;

    const side = {
      horizontal: playerCenterX < windowCenterX ? 'left' : 'right',
      vertical: playerCenterY < windowCenterY ? 'top' : 'bottom'
    };
    
    setIsResizing(true);
    setResizeAnchor(anchor);
    setResizeStartPosition(startPos);
    setResizeSide(side);
    isResizingRef.current = true;
    resizeAnchorRef.current = anchor;
    resizeStartPositionRef.current = startPos;
    resizeSideRef.current = side;
  };

  // Helper function to stop resizing (but continue grabbing)
  const stopResizing = () => {
    setIsResizing(false);
    isResizingRef.current = false;
    // Stay in grab mode - don't drop the window
    // Don't recalculate grab offset - keep the original one from when grab started
  };

  // Helper function to resize grabbed window based on character movement
  const resizeGrabbedWindow = (playerX: number, playerY: number) => {
    if (!isResizingRef.current || !grabbedWindowIdRef.current) return;

    const anchor = resizeAnchorRef.current;
    const startPos = resizeStartPositionRef.current;
    const side = resizeSideRef.current;
    
    // Calculate how far the player has moved from their starting position
    const deltaX = playerX - startPos.x;
    const deltaY = playerY - startPos.y;
    
    let newWidth, newHeight, newX, newY;

    // Resize based on which side the player is on
    if (side.horizontal === 'left') {
      // Player on left side: moving left = expand left, moving right = shrink from left
      newWidth = Math.max(200, Math.min(800, anchor.width - deltaX));
      newX = Math.max(0, Math.min(window.innerWidth - newWidth, anchor.x + deltaX));
    } else {
      // Player on right side: moving left = shrink from right, moving right = expand right
      newWidth = Math.max(200, Math.min(800, anchor.width + deltaX));
      newX = anchor.x; // Keep left edge fixed
    }

    if (side.vertical === 'top') {
      // Player on top side: moving up = expand up, moving down = shrink from top
      newHeight = Math.max(150, Math.min(600, anchor.height - deltaY));
      newY = Math.max(0, Math.min(window.innerHeight - newHeight - 30, anchor.y + deltaY));
    } else {
      // Player on bottom side: moving up = shrink from bottom, moving down = expand down
      newHeight = Math.max(150, Math.min(600, anchor.height + deltaY));
      newY = anchor.y; // Keep top edge fixed
    }

    console.log('🔧 RESIZE CALCULATION:', {
      playerPos: { x: playerX, y: playerY },
      startPos: startPos,
      delta: { x: deltaX, y: deltaY },
      side: side,
      anchor: { x: anchor.x, y: anchor.y, width: anchor.width, height: anchor.height },
      result: { x: newX, y: newY, width: newWidth, height: newHeight }
    });
    
    dispatch(updateProgramSize({
      windowId: grabbedWindowIdRef.current,
      size: { width: newWidth, height: newHeight }
    }));
    
    dispatch(updateProgramPosition({
      windowId: grabbedWindowIdRef.current,
      position: { x: newX, y: newY }
    }));
  };

  // Helper function to move grabbed window
  const moveGrabbedWindow = (playerX: number, playerY: number) => {
    if (!isGrabbingRef.current || !grabbedWindowIdRef.current) return;

    const program = openProgramsRef.current[grabbedWindowIdRef.current];
    if (!program) return;

    const playerCenterX = playerX + 80;
    const playerCenterY = playerY + 80;
    
    const newWindowX = Math.max(0, Math.min(
      window.innerWidth - program.size.width, 
      playerCenterX + grabOffsetRef.current.x
    ));
    const newWindowY = Math.max(0, Math.min(
      window.innerHeight - program.size.height - 30, 
      playerCenterY + grabOffsetRef.current.y
    ));

    dispatch(updateProgramPosition({
      windowId: grabbedWindowIdRef.current,
      position: { x: newWindowX, y: newWindowY }
    }));
  };

  const updatePosition = useCallback(() => {
    if (!roomId) return;

    // Reset the running flag at the start of each frame
    isAnimationRunningRef.current = false;

    // Safety check: if no keys are pressed, don't continue
    if (keysPressed.current.size === 0) {
      setIsMoving(false);
      setMovementDirection(null);
      return;
    }



    let newX = positionRef.current.x;
    let newY = positionRef.current.y;
    let currentDirection = null;

    // Check which keys are pressed and update position with collision detection
    if (keysPressed.current.has('w')) {
      const testY = newY - MOVEMENT_SPEED;
      if (!checkWindowCollision(newX, testY)) {
        newY = testY;
        currentDirection = 'up';
      }
    }
    if (keysPressed.current.has('s')) {
      const testY = newY + MOVEMENT_SPEED;
      if (!checkWindowCollision(newX, testY)) {
        newY = testY;
        currentDirection = 'down';
      }
    }
    if (keysPressed.current.has('a')) {
      const testX = newX - MOVEMENT_SPEED;
      if (!checkWindowCollision(testX, newY)) {
        newX = testX;
        currentDirection = 'left';
      }
    }
    if (keysPressed.current.has('d')) {
      const testX = newX + MOVEMENT_SPEED;
      if (!checkWindowCollision(testX, newY)) {
        newX = testX;
        currentDirection = 'right';
      }
    }

    // Diagonal movement
    if (keysPressed.current.has('w') && keysPressed.current.has('a')) currentDirection = 'up-left';
    if (keysPressed.current.has('w') && keysPressed.current.has('d')) currentDirection = 'up-right';
    if (keysPressed.current.has('s') && keysPressed.current.has('a')) currentDirection = 'down-left';
    if (keysPressed.current.has('s') && keysPressed.current.has('d')) currentDirection = 'down-right';

    // Apply boundary constraints
    newX = Math.max(DESKTOP_BOUNDS.minX, Math.min(DESKTOP_BOUNDS.maxX, newX));
    newY = Math.max(DESKTOP_BOUNDS.minY, Math.min(DESKTOP_BOUNDS.maxY, newY));



    // Update movement state
    const moving = keysPressed.current.size > 0;
    setIsMoving(moving);
    setMovementDirection(moving ? currentDirection : null);
    
    // Update facing direction based on horizontal movement (but not when grabbing)
    if (!isGrabbingRef.current && currentDirection && currentDirection.includes('left')) {
      setFacingDirection('left');
    } else if (!isGrabbingRef.current && currentDirection && currentDirection.includes('right')) {
      setFacingDirection('right');
    }

    // Move or resize grabbed window based on current mode
    if (isGrabbingRef.current) {
      if (isResizingRef.current) {
        resizeGrabbedWindow(newX, newY);
      } else {
        moveGrabbedWindow(newX, newY);
      }
    }

    // Only update if position actually changed
    if (newX !== positionRef.current.x || newY !== positionRef.current.y) {
      const newPosition = { x: newX, y: newY };
      positionRef.current = newPosition;
      setLocalPosition(newPosition);
      dispatch(setPosition(newPosition));
      socketService.movePlayer(newPosition);
      
      // Check for nearby icons
      const nearby = findNearbyIcon(newX, newY);
      if (nearby !== nearbyIconRef.current) {
        nearbyIconRef.current = nearby;
        setNearbyIcon(nearby);
      }
    }

    // Continue the animation loop if any keys are pressed
    if (keysPressed.current.size > 0) {
      // Only start new frame if one isn't already running
      if (!isAnimationRunningRef.current) {
        isAnimationRunningRef.current = true;
        animationFrameRef.current = requestAnimationFrame(updatePosition);
      }
    } else {
      // Stop moving when no keys pressed
      setIsMoving(false);
      setMovementDirection(null);
      // Clean up animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      isAnimationRunningRef.current = false;
    }
  }, [roomId, dispatch]);

  // Sync positionRef with localPosition state
  useEffect(() => {
    positionRef.current = localPosition;
  }, [localPosition]);

  // Sync openProgramsRef with openPrograms state
  useEffect(() => {
    openProgramsRef.current = openPrograms;
  }, [openPrograms]);



  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      
      // Check if user is typing in an input field
      const target = event.target as HTMLElement;
      const isTyping = target && (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.contentEditable === 'true' ||
        target.closest('input') ||
        target.closest('textarea')
      );
      
      // Handle E key for opening programs (but not when typing)
      if (key === 'e' && !isTyping) {
        // Check if player is near a program window first
        const nearbyWindow = findNearbyWindow(positionRef.current.x, positionRef.current.y);
        
        // If near a program window, let the program handle the E key
        if (nearbyWindow) {
          const program = openProgramsRef.current[nearbyWindow];
          
          // Only let Snake games in title state handle the E key
          if (program && program.type === 'snake' && program.state.gameState === 'title') {
            return; // Don't prevent default - let Snake handle it
          }
        }
        
        event.preventDefault();
        
        // Only handle icon opening with E key if not near a program window
        const currentNearbyIcon = nearbyIconRef.current;
        if (currentNearbyIcon && !isGrabbingRef.current) {
          openProgramForIcon(currentNearbyIcon);
        }
        return;
      }

      // Handle Space key for grabbing windows (but not when typing)
      if (key === ' ' && !isTyping) {
        event.preventDefault();
        
        // Check for nearby windows to grab
        const nearbyWindow = findNearbyWindow(positionRef.current.x, positionRef.current.y);
        
        if (nearbyWindow && !isGrabbingRef.current) {
          startGrabbing(nearbyWindow);
          return;
        }
        return;
      }

      // Handle Shift key for resize mode (but not when typing)
      if (key === 'shift' && !isTyping && isGrabbingRef.current && !isResizingRef.current) {
        event.preventDefault();
        startResizing();
        return;
      }
      
      // Handle movement keys (but not when typing or when a game is capturing input)
      if (['w', 'a', 's', 'd'].includes(key) && !isTyping) {
        // Check if player is near an active game that should capture input
        const nearbyWindow = findNearbyWindow(positionRef.current.x, positionRef.current.y);
        if (nearbyWindow) {
          const program = openProgramsRef.current[nearbyWindow];
          if (program && program.type === 'snake' && program.state.gameState === 'playing') {
            // Let the Snake game handle the input
            return;
          }
        }
        
        event.preventDefault();
        
        // Add the key to the set
        const wasEmpty = keysPressed.current.size === 0;
        keysPressed.current.add(key);
        
        // If this is the first key pressed, start the animation loop
        if (wasEmpty && !isAnimationRunningRef.current) {
          // Cancel any existing frame first (safety measure)
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          isAnimationRunningRef.current = true;
          animationFrameRef.current = requestAnimationFrame(updatePosition);
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      
      // Handle Space key release to stop grabbing
      if (key === ' ' && isGrabbingRef.current) {
        stopGrabbing();
        return;
      }

      // Handle Shift key release to stop resizing (but continue grabbing)
      if (key === 'shift' && isResizingRef.current) {
        stopResizing();
        return;
      }
      
      // Always allow key release regardless of focus (to prevent stuck keys)
      if (['w', 'a', 's', 'd'].includes(key)) {
        keysPressed.current.delete(key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      // Cleanup animation frame and reset state
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      isAnimationRunningRef.current = false;
      keysPressed.current.clear();
    };
      }, [updatePosition]);

  // Update bounds when window resizes
  useEffect(() => {
    const handleResize = () => {
      DESKTOP_BOUNDS.maxX = window.innerWidth - 60;
      DESKTOP_BOUNDS.maxY = window.innerHeight - 80;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle walk animation frame switching
  useEffect(() => {
    let walkAnimationInterval: NodeJS.Timeout | null = null;
    
    if (isMoving) {
      // Switch between walk frames every 60ms while moving (5x faster)
      walkAnimationInterval = setInterval(() => {
        setWalkFrame(prev => prev === 1 ? 2 : 1);
      }, 60);
    } else {
      // Reset to frame 1 when not moving
      setWalkFrame(1);
    }

    return () => {
      if (walkAnimationInterval) {
        clearInterval(walkAnimationInterval);
      }
    };
  }, [isMoving]);

  // Return the current position and movement state for the Character component to use
  return { 
    position: localPosition, 
    isMoving, 
    movementDirection,
    walkFrame,
    nearbyIcon,
    desktopIcons: DESKTOP_ICONS,
    facingDirection,
    isGrabbing,
    isResizing
  };
};

export default useMovement; 