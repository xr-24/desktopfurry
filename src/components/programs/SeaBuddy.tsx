import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateProgramState } from '../../store/programSlice';
import ProgramWindow from '../ProgramWindow';
import { authService } from '../../services/authService';
import { audioService } from '../../services/audioService';

interface SeaBuddyProps {
  windowId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  programState: {
    setupStep: 'tank' | 'fish' | 'name' | 'complete';
    selectedTank: string | null;
    selectedFish: string | null;
    fishName: string;
    fishPosition: { x: number; y: number };
    fishMovement: { 
      direction: number; 
      speed: number;
      targetX: number;
      targetY: number;
      movementTimer: number;
      isSwimming: boolean;
      facingDirection: 'left' | 'right';
      movementProgress: number; // 0-1 for easing calculation
      driftDirection: number; // direction to drift when idle
    };
    hunger: number;
    cleanliness: number;
    happiness: number;
    health: number;
    currentTool: 'none' | 'food' | 'clean';
    showStats: boolean;
    lastFed: number;
    lastCleaned: number;
    lastMovement: number;
    lastDecayUpdate: number;
    isLoaded: boolean;
    isDying: boolean;
    deathAnimationStartTime: number;
    isDead: boolean;
    deathPosition?: { x: number; y: number };
    deathDate?: string;
    showDestroyPrompt: boolean;
  };
  controllerId: string;
  currentPlayerId: string;
}

// Constants for fish behavior
const FISH_CONSTANTS = {
  MOVEMENT_SPEED: 3.0, // pixels per frame (base speed for active movement)
  DRIFT_SPEED: 0.3, // pixels per frame (slow floating speed when idle)
  IDLE_TIME_MIN: 5000, // minimum idle time (5 seconds)
  IDLE_TIME_MAX: 12000, // maximum idle time (12 seconds)
  MOVEMENT_DURATION: 1500, // how long movement lasts (1.5 seconds)
  TANK_PADDING: 80, // pixels from edge
  SWIM_SOUND_CHANCE: 0.1, // 10% chance per frame to play swim sound during movement
  ANIMATION_FRAME_RATE: 200, // milliseconds between animation frames (faster when moving)
  DIRECTION_THRESHOLD: 45, // degrees - only flip if direction changes by this much
  BOUNDARY_BOUNCE: 0.7, // how much to reduce speed when bouncing off boundaries
}

// Decay rates and tool configuration
const DECAY_RATES = {
  HUNGER_DECAY: 1, // points per minute
  CLEANLINESS_DECAY: 0.5, // points per minute
  UPDATE_INTERVAL: 5000, // check every 5 seconds
}

// Easing function for natural movement (fast start, slow end)
const easeOutCubic = (t: number): number => {
  return 1 - Math.pow(1 - t, 3);
};

// Helper to normalize angle difference
const angleDifference = (angle1: number, angle2: number): number => {
  let diff = angle2 - angle1;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return Math.abs(diff);
};

const TOOLS = {
  food: {
    label: 'Feed Fish',
    cursor: 'url(/assets/sprites/fish/tank/tank-items/tank-food.png) 16 16, pointer',
    sound: 'food',
    effect: { hunger: 20 },
  },
  clean: {
    label: 'Clean Tank',
    cursor: 'url(/assets/sprites/fish/tank/tank-items/tank-wipe.png) 16 16, pointer',
    sound: ['clean1', 'clean2'],
    effect: { cleanliness: 15 },
  }
}

// Load tank and fish assets dynamically
const tankAssets = ['tank-1', 'tank-2', 'tank-3', 'tank-4'];
const fishAssets = ['fish1', 'fish2', 'fish3', 'fish4', 'fish5', 'fish6', 'fish7', 'fish8'];

const SeaBuddy: React.FC<SeaBuddyProps> = ({
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const decayIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<number>(0);
  const [nameInput, setNameInput] = useState(programState.fishName || '');
  const [hoveredFish, setHoveredFish] = useState(false);
  const [cursorStyle, setCursorStyle] = useState<React.CSSProperties>({});
  const [animationFrame, setAnimationFrame] = useState(0);

  const isController = controllerId === currentPlayerId;

  // Initialize audio system
  useEffect(() => {
    if (isController) {
      audioService.initialize();
      // Load tank-specific sounds
      audioService.loadSound('swim1', '/assets/sounds/tank/swim1.wav');
      audioService.loadSound('swim2', '/assets/sounds/tank/swim2.wav');
      audioService.loadSound('swim3', '/assets/sounds/tank/swim3.wav');
      audioService.loadSound('swim4', '/assets/sounds/tank/swim4.wav');
      audioService.loadSound('eat', '/assets/sounds/tank/eat.wav');
      audioService.loadSound('food', '/assets/sounds/tank/food.wav');
      audioService.loadSound('clean1', '/assets/sounds/tank/clean1.wav');
      audioService.loadSound('clean2', '/assets/sounds/tank/clean2.wav');
      audioService.loadSound('vaporize', '/assets/sounds/tank/vaporize.wav');
      audioService.loadSound('bones', '/assets/sounds/tank/bones-clean.aiff');
    }
  }, [isController]);

  // Load fish data from server on mount
  useEffect(() => {
    if (!isController || programState.isLoaded) return;

    const loadFishData = async () => {
      try {
        const fishData = await authService.loadFish();
        if (fishData) {
          // Player has a fish in database, load it
          const now = Date.now();
          
          // Check if fish is dead from database
          const isDead = fishData.is_dead === true;
          const deathDate = fishData.death_date ? new Date(fishData.death_date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }) : undefined;
          
          dispatch(updateProgramState({
            windowId,
            newState: {
              setupStep: 'complete',
              selectedTank: fishData.tank_background,
              selectedFish: fishData.fish_type,
              fishName: fishData.fish_name,
              fishPosition: isDead ? 
                { x: fishData.death_position_x || fishData.fish_x || 50, y: fishData.death_position_y || fishData.fish_y || 85 } :
                { x: fishData.fish_x || 50, y: fishData.fish_y || 50 },
              fishMovement: {
                // Use persisted direction/facing data if available, otherwise randomize
                direction: programState.fishMovement?.direction || Math.random() * 360,
                facingDirection: programState.fishMovement?.facingDirection || 'right',
                driftDirection: programState.fishMovement?.driftDirection || Math.random() * 360,
                // Initialize animation state (not persisted)
                speed: FISH_CONSTANTS.MOVEMENT_SPEED,
                targetX: 60,
                targetY: 60,
                movementTimer: now,
                isSwimming: false,
                movementProgress: 0,
              },
              hunger: fishData.hunger_level,
              cleanliness: fishData.tank_cleanliness,
              happiness: calculateHappiness(fishData.hunger_level, fishData.tank_cleanliness),
              health: calculateHealth(fishData.tank_cleanliness),
              lastFed: new Date(fishData.last_fed).getTime(),
              lastCleaned: new Date(fishData.last_cleaned).getTime(),
              lastDecayUpdate: now,
              isLoaded: true,
              // Set death state from database
              isDying: false,
              deathAnimationStartTime: 0,
              isDead: isDead,
              deathPosition: isDead ? { x: fishData.death_position_x || fishData.fish_x || 50, y: fishData.death_position_y || fishData.fish_y || 85 } : undefined,
              deathDate: deathDate,
              showDestroyPrompt: false,
            }
          }));
        } else {
          // No fish in database, start setup
          dispatch(updateProgramState({
            windowId,
            newState: { 
              isLoaded: true,
            }
          }));
        }
      } catch (error) {
        console.error('Failed to load fish data:', error);
        dispatch(updateProgramState({
          windowId,
          newState: { 
            isLoaded: true,
          }
        }));
      }
    };

    loadFishData();
  }, [isController, programState.isLoaded, windowId, dispatch]);

  // Calculate happiness based on hunger and cleanliness
  const calculateHappiness = (hunger: number, cleanliness: number) => {
    const hungerWeight = 0.6;
    const cleanlinessWeight = 0.4;
    return Math.round((hunger * hungerWeight) + (cleanliness * cleanlinessWeight));
  };

  // Calculate health based on tank cleanliness
  const calculateHealth = (cleanliness: number) => {
    return Math.max(20, cleanliness); // Health can't go below 20%
  };

  // Generate new movement target for fish
  const generateNewTarget = useCallback(() => {
    const tankWidth = (canvasRef.current?.width || 500) - (FISH_CONSTANTS.TANK_PADDING * 2);
    const tankHeight = (canvasRef.current?.height || 300) - (FISH_CONSTANTS.TANK_PADDING * 2);
    
    return {
      x: (Math.random() * tankWidth) + FISH_CONSTANTS.TANK_PADDING,
      y: (Math.random() * tankHeight) + FISH_CONSTANTS.TANK_PADDING,
    };
  }, []);

  // Fish movement animation loop - fish is always moving (either swimming or drifting)
  const animateFish = useCallback(() => {
    if (!isController || programState.setupStep !== 'complete') {
      return;
    }

    const now = Date.now();
    const movement = programState.fishMovement;
    const position = programState.fishPosition;

    // Convert percentage position to pixels for movement calculations
    const canvasWidth = canvasRef.current?.width || 500;
    const canvasHeight = canvasRef.current?.height || 300;
    const currentX = (position.x / 100) * canvasWidth;
    const currentY = (position.y / 100) * canvasHeight;
    const targetX = (movement.targetX / 100) * canvasWidth;
    const targetY = (movement.targetY / 100) * canvasHeight;

    let newMovement = { ...movement };
    let newPosition = { ...position };
    let isSwimming = false;

    // Handle death animation
    if (programState.isDying) {
      const deathElapsed = now - programState.deathAnimationStartTime;
      const transformDuration = 1000; // 1 second for death transformation
      const sinkDuration = 3000; // 3 seconds for sinking
      const totalDuration = transformDuration + sinkDuration;
      
      if (deathElapsed < transformDuration) {
        // Phase 1: Transformation phase - fish stops and transforms
        // Don't move the fish, just let the visual transformation happen in the render
        newPosition = { ...position }; // Stay in current position
      } else {
        // Phase 2: Sinking phase - fish sinks straight down
        const sinkElapsed = deathElapsed - transformDuration;
        const sinkProgress = Math.min(1, sinkElapsed / sinkDuration);
        
        // Store the death position if not already stored
        if (!programState.deathPosition) {
          const deathPos = { x: position.x, y: position.y };
          dispatch(updateProgramState({
            windowId,
            newState: { 
              deathPosition: deathPos
            }
          }));
          // Use the death position immediately for this frame
          const targetBottom = 85; // Near bottom of tank
          const newY = deathPos.y + (targetBottom - deathPos.y) * sinkProgress;
          newPosition = {
            x: deathPos.x,
            y: Math.min(85, newY),
          };
        } else {
          // Sink straight down from death position
          const targetBottom = 85; // Near bottom of tank
          const startY = programState.deathPosition.y;
          const newY = startY + (targetBottom - startY) * sinkProgress;
          
          newPosition = {
            x: programState.deathPosition.x, // Stay at same X position
            y: Math.min(85, newY),
          };
        }
      }

      // Mark as dead when animation completes
      if (deathElapsed >= totalDuration && !programState.isDead) {
        const deathDate = new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        
        // Save death state to database
        const deathPosition = programState.deathPosition || { x: position.x, y: position.y };
        authService.killFish(deathPosition);
        
        dispatch(updateProgramState({
          windowId,
          newState: { 
            isDead: true,
            deathDate: deathDate
          }
        }));
      }

      // Update position during death animation
      dispatch(updateProgramState({
        windowId,
        newState: {
          fishPosition: newPosition,
        }
      }));

      // Continue animation frame
      animationFrameRef.current = requestAnimationFrame(animateFish);
      return;
    }

    // Check if we need to start a new movement cycle
    const timeSinceLastMovement = now - movement.movementTimer;
    
    if (!movement.isSwimming) {
      // Fish is drifting - check if it's time to start active swimming
      const idleTime = FISH_CONSTANTS.IDLE_TIME_MIN + 
        Math.random() * (FISH_CONSTANTS.IDLE_TIME_MAX - FISH_CONSTANTS.IDLE_TIME_MIN);
      
      if (timeSinceLastMovement > idleTime) {
        // Start active swimming - pick a random target
        const newTarget = generateNewTarget();
        const newDirection = Math.atan2(newTarget.y - currentY, newTarget.x - currentX) * (180 / Math.PI);
        
        // Determine if fish should flip based on direction change
        let newFacingDirection = movement.facingDirection;
        const currentAngle = movement.facingDirection === 'right' ? 0 : 180;
        const directionChange = angleDifference(currentAngle, newDirection);
        
        if (directionChange > FISH_CONSTANTS.DIRECTION_THRESHOLD) {
          // Significant direction change - flip the fish
          // Fish sprite naturally faces left, so we flip it when moving right
          newFacingDirection = newDirection >= -90 && newDirection <= 90 ? 'right' : 'left';
        }
        
        newMovement = {
          ...movement,
          targetX: (newTarget.x / canvasWidth) * 100,
          targetY: (newTarget.y / canvasHeight) * 100,
          movementTimer: now,
          direction: newDirection,
          facingDirection: newFacingDirection,
          isSwimming: true,
          movementProgress: 0,
        };
        isSwimming = true;
      } else {
        // Continue drifting in current direction
        const driftAngle = movement.driftDirection * (Math.PI / 180);
        let newX = currentX + Math.cos(driftAngle) * FISH_CONSTANTS.DRIFT_SPEED;
        let newY = currentY + Math.sin(driftAngle) * FISH_CONSTANTS.DRIFT_SPEED;

        // Handle boundary bouncing for drift
        const padding = FISH_CONSTANTS.TANK_PADDING;
        let newDriftDirection = movement.driftDirection;
        
        if (newX <= padding || newX >= canvasWidth - padding) {
          newDriftDirection = 180 - movement.driftDirection; // Horizontal bounce
          newX = Math.max(padding, Math.min(canvasWidth - padding, newX));
        }
        if (newY <= padding || newY >= canvasHeight - padding) {
          newDriftDirection = -movement.driftDirection; // Vertical bounce
          newY = Math.max(padding, Math.min(canvasHeight - padding, newY));
        }

        newPosition = {
          x: (newX / canvasWidth) * 100,
          y: (newY / canvasHeight) * 100,
        };

        newMovement = {
          ...movement,
          driftDirection: newDriftDirection,
        };
      }
    } else {
      // Fish is actively swimming
      const distanceToTarget = Math.sqrt(
        Math.pow(targetX - currentX, 2) + Math.pow(targetY - currentY, 2)
      );

      // Calculate movement progress (0 to 1)
      const progress = Math.min(1, timeSinceLastMovement / FISH_CONSTANTS.MOVEMENT_DURATION);
      
      // Stop swimming if we reached the target or have been moving too long
      if (distanceToTarget < 5 || progress >= 1) {
        // Switch to drifting mode - use the last direction as drift direction
        newMovement = {
          ...movement,
          isSwimming: false,
          movementTimer: now, // Reset timer for next swim cycle
          movementProgress: 0,
          driftDirection: movement.direction, // Continue in same direction but slowly
        };
        isSwimming = false;
      } else {
        // Continue swimming towards target with easing
        const easedProgress = easeOutCubic(progress);
        const speed = FISH_CONSTANTS.MOVEMENT_SPEED * (1 - easedProgress * 0.6); // Slow down as we approach
        
        const angle = Math.atan2(targetY - currentY, targetX - currentX);
        const newX = currentX + Math.cos(angle) * speed;
        const newY = currentY + Math.sin(angle) * speed;

        newPosition = {
          x: Math.max(10, Math.min(90, (newX / canvasWidth) * 100)),
          y: Math.max(10, Math.min(90, (newY / canvasHeight) * 100)),
        };

        newMovement = {
          ...movement,
          movementProgress: progress,
          direction: angle * (180 / Math.PI), // Update direction as we move
        };

        isSwimming = true;

        // Play random swim sounds occasionally during active movement
        if (Math.random() < FISH_CONSTANTS.SWIM_SOUND_CHANCE) {
          const swimSounds = ['swim1', 'swim2', 'swim3', 'swim4'];
          const randomSound = swimSounds[Math.floor(Math.random() * swimSounds.length)];
          audioService.playSound(randomSound);
        }
      }
    }

    // Update movement state
    newMovement.isSwimming = isSwimming;

    // Update Redux state
    dispatch(updateProgramState({
      windowId,
      newState: {
        fishPosition: newPosition,
        fishMovement: newMovement,
      }
    }));

    // Schedule next frame
    animationFrameRef.current = requestAnimationFrame(animateFish);
  }, [isController, programState.setupStep, programState.fishMovement, programState.fishPosition, windowId, dispatch, generateNewTarget]);

  // Start fish animation when fish is loaded
  useEffect(() => {
    if (isController && programState.setupStep === 'complete' && !animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(animateFish);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isController, programState.setupStep, animateFish]);

  // Animation frame cycling for fish sprite (faster when swimming, slower when drifting)
  useEffect(() => {
    if (programState.setupStep !== 'complete') return;

    const interval = setInterval(() => {
      setAnimationFrame(prev => (prev + 1) % 2); // Cycle between 0 and 1
    }, programState.fishMovement.isSwimming ? FISH_CONSTANTS.ANIMATION_FRAME_RATE : FISH_CONSTANTS.ANIMATION_FRAME_RATE * 3);

    return () => clearInterval(interval);
  }, [programState.setupStep, programState.fishMovement.isSwimming]);

  // Condition decay system
  useEffect(() => {
    if (!isController || programState.setupStep !== 'complete') return;

    const updateDecay = () => {
      const now = Date.now();
      const timeSinceLastUpdate = now - (programState.lastDecayUpdate || now);
      const minutesElapsed = timeSinceLastUpdate / 60000; // Convert to minutes

      if (minutesElapsed < 0.1) return; // Don't update if less than 6 seconds passed

      // Calculate hunger decay
      const timeSinceLastFed = now - programState.lastFed;
      const minutesSinceFed = timeSinceLastFed / 60000;
      const hungerDecay = minutesSinceFed * DECAY_RATES.HUNGER_DECAY * 0.1; // Slower decay

      // Calculate cleanliness decay
      const timeSinceLastCleaned = now - programState.lastCleaned;
      const minutesSinceCleaned = timeSinceLastCleaned / 60000;
      const cleanlinessDecay = minutesSinceCleaned * DECAY_RATES.CLEANLINESS_DECAY * 0.1; // Slower decay

      const newHunger = Math.max(0, programState.hunger - hungerDecay);
      const newCleanliness = Math.max(0, programState.cleanliness - cleanlinessDecay);
      const newHappiness = calculateHappiness(newHunger, newCleanliness);
      const newHealth = calculateHealth(newCleanliness);

      dispatch(updateProgramState({
        windowId,
        newState: {
          hunger: newHunger,
          cleanliness: newCleanliness,
          happiness: newHappiness,
          health: newHealth,
          lastDecayUpdate: now,
        }
      }));

      // Note: Fish state persisted through feeding/cleaning actions
    };

    decayIntervalRef.current = setInterval(updateDecay, DECAY_RATES.UPDATE_INTERVAL);

    return () => {
      if (decayIntervalRef.current) {
        clearInterval(decayIntervalRef.current);
      }
    };
  }, [isController, programState.setupStep, programState.hunger, programState.cleanliness, programState.lastDecayUpdate, programState.lastFed, programState.lastCleaned, windowId, dispatch]);

  // Note: Fish state is automatically saved when feeding/cleaning
  // Position updates are handled by the animation system and persisted through feed/clean actions

  // Handle tank selection
  const selectTank = (tankId: string) => {
    if (!isController) return;
    dispatch(updateProgramState({
      windowId,
      newState: {
        selectedTank: tankId,
        setupStep: 'fish'
      }
    }));
  };

  // Handle fish selection
  const selectFish = (fishId: string) => {
    if (!isController) return;
    dispatch(updateProgramState({
      windowId,
      newState: {
        selectedFish: fishId,
        setupStep: 'name'
      }
    }));
  };

  // Handle fish naming and creation
  const createFish = async () => {
    if (!isController || !nameInput.trim()) return;

    try {
      await authService.createFish({
        fish_type: programState.selectedFish!,
        fish_name: nameInput.trim(),
        tank_background: programState.selectedTank!,
      });

      const now = Date.now();
      dispatch(updateProgramState({
        windowId,
        newState: {
          fishName: nameInput.trim(),
          setupStep: 'complete',
          fishPosition: { x: 50, y: 50 },
          fishMovement: {
            direction: Math.random() * 360,
            speed: FISH_CONSTANTS.MOVEMENT_SPEED,
            targetX: 60,
            targetY: 60,
            movementTimer: now, // Start idle timer
            isSwimming: false, // Start in idle state
            facingDirection: 'right',
            movementProgress: 0,
            driftDirection: Math.random() * 360,
          },
          hunger: 100,
          cleanliness: 100,
          happiness: 100,
          health: 100,
          lastFed: now,
          lastCleaned: now,
          lastDecayUpdate: now,
        }
      }));

      // Play a happy sound
      audioService.playSound('notif');
    } catch (error) {
      console.error('Failed to create fish:', error);
    }
  };

  // Handle tool selection
  const selectTool = (tool: 'food' | 'clean') => {
    if (!isController) return;
    
    const newTool = programState.currentTool === tool ? 'none' : tool;
    dispatch(updateProgramState({
      windowId,
      newState: { currentTool: newTool }
    }));

    // Update cursor style
    if (newTool !== 'none') {
      setCursorStyle({ cursor: TOOLS[newTool].cursor });
    } else {
      setCursorStyle({});
    }
  };



  // Handle fish interaction (feeding or clicking dead fish)
  const handleFishClick = async () => {
    if (!isController) return;
    
    // If fish is dead, show destroy prompt
    if (programState.isDead) {
      dispatch(updateProgramState({
        windowId,
        newState: { showDestroyPrompt: true }
      }));
      return;
    }
    
    // If fish is alive and we have food tool selected
    if (programState.currentTool !== 'food') return;

    try {
      await authService.feedFish();
      
      const now = Date.now();
      const newHunger = Math.min(100, programState.hunger + TOOLS.food.effect.hunger);
      const newHappiness = calculateHappiness(newHunger, programState.cleanliness);
      
      dispatch(updateProgramState({
        windowId,
        newState: {
          hunger: newHunger,
          happiness: newHappiness,
          lastFed: now,
          currentTool: 'none',
        }
      }));

      setCursorStyle({});
      
      // Play feeding sounds
      audioService.playSound(TOOLS.food.sound);
      setTimeout(() => audioService.playSound('eat'), 500);
    } catch (error) {
      console.error('Failed to feed fish:', error);
    }
  };

  // Handle tank cleaning
  const handleTankClick = async () => {
    if (!isController || programState.currentTool !== 'clean') return;

    try {
      await authService.cleanTank();
      
      const now = Date.now();
      const newCleanliness = Math.min(100, programState.cleanliness + TOOLS.clean.effect.cleanliness);
      const newHappiness = calculateHappiness(programState.hunger, newCleanliness);
      const newHealth = calculateHealth(newCleanliness);
      
      dispatch(updateProgramState({
        windowId,
        newState: {
          cleanliness: newCleanliness,
          happiness: newHappiness,
          health: newHealth,
          lastCleaned: now,
          currentTool: 'none',
        }
      }));

      setCursorStyle({});
      
      // Play cleaning sound (random selection)
      const cleanSounds = Array.isArray(TOOLS.clean.sound) ? TOOLS.clean.sound : [TOOLS.clean.sound];
      const randomSound = cleanSounds[Math.floor(Math.random() * cleanSounds.length)];
      audioService.playSound(randomSound);
    } catch (error) {
      console.error('Failed to clean tank:', error);
    }
  };

  // Handle fish clearing (death animation)
  const handleClearFish = async () => {
    if (!isController || programState.isDying || programState.isDead) return;

    try {
      // Start death animation
      const now = Date.now();
      dispatch(updateProgramState({
        windowId,
        newState: {
          isDying: true,
          deathAnimationStartTime: now,
          currentTool: 'none',
        }
      }));

      setCursorStyle({});
      
      // Play vaporize sound
      audioService.playSound('vaporize');

      // Death animation completed - fish is now marked as dead in database

    } catch (error) {
      console.error('Failed to start fish clearing:', error);
    }
  };

  // Handle creating new fish after clearing old one
  const handleNewFish = async () => {
    if (!isController) return;

    try {
      // Clear fish from database
      await authService.clearFish();

      // Reset to setup state
      dispatch(updateProgramState({
        windowId,
        newState: {
          setupStep: 'tank',
          selectedTank: null,
          selectedFish: null,
          fishName: '',
          fishPosition: { x: 50, y: 50 },
          fishMovement: {
            direction: 0,
            speed: FISH_CONSTANTS.MOVEMENT_SPEED,
            targetX: 60,
            targetY: 60,
            movementTimer: 0,
            isSwimming: false,
            facingDirection: 'right',
            movementProgress: 0,
            driftDirection: 0,
          },
          hunger: 100,
          cleanliness: 100,
          happiness: 100,
          health: 100,
          currentTool: 'none',
          showStats: false,
          lastFed: 0,
          lastCleaned: 0,
          lastMovement: 0,
          lastDecayUpdate: 0,
          isDying: false,
          deathAnimationStartTime: 0,
          isDead: false,
          deathPosition: undefined,
          deathDate: undefined,
          showDestroyPrompt: false,
        }
      }));

      // Reset name input
      setNameInput('');
    } catch (error) {
      console.error('Failed to clear fish for new fish:', error);
    }
  };

  // Handle destroying fish remains
  const handleDestroyRemains = async () => {
    if (!isController) return;

    try {
      // Play bone sound
      audioService.playSound('bones');
      
      // Clear fish from database
      await authService.clearFish();
      
      // Reset to setup state after short delay
      setTimeout(() => {
        dispatch(updateProgramState({
          windowId,
          newState: {
            setupStep: 'tank',
            selectedTank: null,
            selectedFish: null,
            fishName: '',
            fishPosition: { x: 50, y: 50 },
            fishMovement: {
              direction: 0,
              speed: FISH_CONSTANTS.MOVEMENT_SPEED,
              targetX: 60,
              targetY: 60,
              movementTimer: 0,
              isSwimming: false,
              facingDirection: 'right',
              movementProgress: 0,
              driftDirection: 0,
            },
            hunger: 100,
            cleanliness: 100,
            happiness: 100,
            health: 100,
            currentTool: 'none',
            showStats: false,
            lastFed: 0,
            lastCleaned: 0,
            lastMovement: 0,
            lastDecayUpdate: 0,
            isDying: false,
            deathAnimationStartTime: 0,
            isDead: false,
            deathPosition: undefined,
            deathDate: undefined,
            showDestroyPrompt: false,
          }
        }));

        // Reset name input
        setNameInput('');
      }, 200); // Short delay for sound to start
    } catch (error) {
      console.error('Failed to destroy remains:', error);
    }
  };

  // Handle canceling destroy prompt
  const handleCancelDestroy = () => {
    if (!isController) return;
    dispatch(updateProgramState({
      windowId,
      newState: { showDestroyPrompt: false }
    }));
  };



  // Render setup flow
  if (programState.setupStep !== 'complete') {
    return (
      <ProgramWindow
        windowId={windowId}
        title="SeaBuddy - Aquarium Setup"
        icon="🐠"
        position={position}
        size={size}
        zIndex={zIndex}
        isMinimized={isMinimized}
        isResizable={false}
      >
        <div style={{ padding: '20px', background: '#c0c0c0', height: '100%' }}>
          {programState.setupStep === 'tank' && (
            <div>
              <h3 style={{ color: '#000080', marginBottom: '15px' }}>Choose Your Tank</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                {tankAssets.map(tank => (
                  <div
                    key={tank}
                    onClick={() => selectTank(tank)}
                    style={{
                      border: programState.selectedTank === tank ? '3px solid #0000ff' : '1px solid #808080',
                      borderRadius: '5px',
                      padding: '10px',
                      cursor: 'pointer',
                      background: '#ffffff',
                      textAlign: 'center'
                    }}
                  >
                    <img 
                      src={`/assets/sprites/fish/tank/${tank}.png`}
                      alt={tank}
                      style={{ width: '150px', height: '100px', objectFit: 'cover' }}
                    />
                    <div style={{ marginTop: '5px', fontSize: '12px' }}>{tank}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {programState.setupStep === 'fish' && (
            <div>
              <h3 style={{ color: '#000080', marginBottom: '15px' }}>Choose Your Fish</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                {fishAssets.map(fish => (
                  <div
                    key={fish}
                    onClick={() => selectFish(fish)}
                    style={{
                      border: programState.selectedFish === fish ? '2px solid #0000ff' : '1px solid #808080',
                      borderRadius: '5px',
                      padding: '8px',
                      cursor: 'pointer',
                      background: '#ffffff',
                      textAlign: 'center'
                    }}
                  >
                    <img 
                      src={`/assets/sprites/fish/${fish}.png`}
                      alt={fish}
                      style={{ width: '40px', height: '30px', objectFit: 'contain' }}
                    />
                    <div style={{ fontSize: '10px', marginTop: '3px' }}>{fish}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {programState.setupStep === 'name' && (
            <div>
              <h3 style={{ color: '#000080', marginBottom: '15px' }}>Name Your Fish</h3>
              <div style={{ marginBottom: '15px' }}>
                <img 
                  src={`/assets/sprites/fish/${programState.selectedFish}.png`}
                  alt="Selected fish"
                  style={{ width: '80px', height: '60px', objectFit: 'contain' }}
                />
              </div>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter fish name..."
                maxLength={100}
                style={{
                  width: '200px',
                  padding: '8px',
                  border: '1px inset #c0c0c0',
                  marginBottom: '15px'
                }}
              />
              <br />
              <button
                onClick={createFish}
                disabled={!nameInput.trim()}
                style={{
                  padding: '8px 16px',
                  background: nameInput.trim() ? '#0000ff' : '#808080',
                  color: '#ffffff',
                  border: '2px outset #c0c0c0',
                  cursor: nameInput.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                Create Fish
              </button>
            </div>
          )}
        </div>
      </ProgramWindow>
    );
  }

  // Calculate tank overlay opacity (dirtiness)
  const dirtinessOpacity = Math.max(0, (100 - programState.cleanliness) / 200); // 0-50% opacity

  // Main aquarium view
  return (
    <>
      {/* CSS Animation for swimming bubbles */}
      <style>
        {`
          @keyframes bubble {
            0% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
            100% {
              opacity: 0;
              transform: translateY(-20px) scale(0.5);
            }
          }
        `}
      </style>
      <ProgramWindow
        windowId={windowId}
        title={`SeaBuddy - ${programState.fishName}`}
        icon="🐠"
        position={position}
        size={size}
        zIndex={zIndex}
        isMinimized={isMinimized}
      >
      <div 
        style={{ 
          position: 'relative', 
          height: '100%', 
          background: '#c0c0c0',
          ...cursorStyle 
        }}
        onClick={programState.currentTool === 'clean' ? handleTankClick : undefined}
      >
        {/* Canvas for rendering (invisible, used for calculations) */}
        <canvas
          ref={canvasRef}
          width={size.width - 20}
          height={size.height - 80}
          style={{ display: 'none' }}
        />

        {/* Tank Background */}
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: '80px', // Leave space for tools and status
            backgroundImage: `url(/assets/sprites/fish/tank/${programState.selectedTank}.png)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Dirt Overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `rgba(50, 100, 50, ${dirtinessOpacity})`,
              pointerEvents: 'none',
            }}
          />

          {/* Fish Container */}
                      <div
              style={{
                position: 'absolute',
                left: `${programState.fishPosition.x}%`,
                top: `${programState.fishPosition.y}%`,
                transform: 'translate(-50%, -50%)',
                cursor: programState.isDead ? 'pointer' : (programState.currentTool === 'food' ? 'pointer' : 'default'),
              }}
              onClick={handleFishClick}
              onMouseEnter={() => setHoveredFish(true)}
              onMouseLeave={() => setHoveredFish(false)}
            >
            {/* Fish Sprite (can be flipped and skewed) */}
            <img
              src={(() => {
                if (programState.isDying) {
                  const deathElapsed = Date.now() - programState.deathAnimationStartTime;
                  const transformDuration = 1000;
                  if (deathElapsed < transformDuration) {
                    // During transformation, still show live fish
                    return `/assets/sprites/fish/${programState.selectedFish}.png`;
                  } else {
                    // After transformation, show dead fish
                    return '/assets/sprites/fish/dead.png';
                  }
                } else if (programState.isDead) {
                  return '/assets/sprites/fish/dead.png';
                } else {
                  return `/assets/sprites/fish/${programState.selectedFish}.png`;
                }
              })()}
              alt={programState.fishName}
              style={{ 
                width: '60px', 
                height: '45px', 
                objectFit: 'contain',
                opacity: (() => {
                  if (programState.isDying) {
                    const deathElapsed = Date.now() - programState.deathAnimationStartTime;
                    const transformDuration = 1000;
                    if (deathElapsed < transformDuration) {
                      // Flickering effect during transformation
                      return 0.3 + Math.sin(Date.now() * 0.02) * 0.3;
                    } else {
                      // Semi-transparent when sinking
                      return 0.7;
                    }
                  } else if (programState.isDead) {
                    return 0.5;
                  } else {
                    return programState.fishMovement.isSwimming ? 
                      (animationFrame === 0 ? 1 : 0.85) : 
                      (animationFrame === 0 ? 1 : 0.95);
                  }
                })(),
                transition: programState.isDying ? 'transform 1s ease-out' : 'opacity 0.2s ease, transform 0.3s ease',
                transform: (() => {
                  if (programState.isDying || programState.isDead) {
                    // Just maintain facing direction, no rotation
                    return programState.fishMovement.facingDirection === 'right' ? 'scaleX(-1)' : '';
                  } else {
                    // Normal fish animation
                    return `
                      ${programState.fishMovement.facingDirection === 'right' ? 'scaleX(-1)' : ''}
                      ${programState.fishMovement.isSwimming ? 
                        `skewY(${Math.sin(programState.fishMovement.direction * Math.PI / 180) * 3}deg) 
                         skewX(${Math.cos(programState.fishMovement.direction * Math.PI / 180) * 2}deg)
                         scale(${1 + programState.fishMovement.movementProgress * 0.1})` : 
                        `skewY(${Math.sin(programState.fishMovement.driftDirection * Math.PI / 180) * 1}deg) 
                         skewX(${Math.cos(programState.fishMovement.driftDirection * Math.PI / 180) * 0.5}deg)` // Subtle drift animation
                      }
                    `.replace(/\s+/g, ' ').trim();
                  }
                })(),
              }}
            />
            
            {/* Fish Name (never flipped) - only show for living fish */}
            {!programState.isDead && (
              <div
                style={{
                  position: 'absolute',
                  top: '-25px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(0, 0, 0, 0.7)',
                  color: '#ffffff',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  whiteSpace: 'nowrap',
                }}
              >
                {programState.fishName}
              </div>
            )}

            {/* Tooltip - different for dead vs living fish */}
            {hoveredFish && (
              <div
                style={{
                  position: 'absolute',
                  top: '-90px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: programState.isDead ? '#ffcccc' : '#ffffcc',
                  border: '1px solid #000000',
                  padding: '8px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  whiteSpace: 'nowrap',
                  zIndex: 1000,
                  boxShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                }}
              >
                {programState.isDead ? (
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#800000' }}>
                      RIP {programState.fishName}
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '9px' }}>
                      {programState.deathDate}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div>🍎 Hunger: {Math.round(programState.hunger)}%</div>
                    <div>❤️ Health: {Math.round(programState.health)}%</div>
                    <div>😊 Happiness: {Math.round(programState.happiness)}%</div>
                    <div>🧽 Tank: {Math.round(programState.cleanliness)}%</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Movement particles effect - more prominent when swimming, subtle when drifting */}
          {(programState.fishMovement.isSwimming || Math.random() < 0.3) && (
            <div
              style={{
                position: 'absolute',
                left: `${programState.fishPosition.x + (Math.random() - 0.5) * (programState.fishMovement.isSwimming ? 5 : 2)}%`,
                top: `${programState.fishPosition.y + (Math.random() - 0.5) * (programState.fishMovement.isSwimming ? 5 : 2)}%`,
                width: programState.fishMovement.isSwimming ? '2px' : '1px',
                height: programState.fishMovement.isSwimming ? '2px' : '1px',
                background: programState.fishMovement.isSwimming ? '#00aaff' : '#66ccff',
                borderRadius: '50%',
                animation: `bubble ${programState.fishMovement.isSwimming ? '1s' : '2s'} ease-out forwards`,
                pointerEvents: 'none',
                opacity: programState.fishMovement.isSwimming ? 1 : 0.6,
              }}
            />
          )}
        </div>

        {/* Tool Bar */}
        <div 
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '80px',
            background: '#f0f0f0',
            border: '1px inset #c0c0c0',
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            gap: '12px',
          }}
        >
          {/* Food Tool */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              onClick={() => selectTool('food')}
              disabled={!isController}
              style={{
                width: '50px',
                height: '40px',
                background: programState.currentTool === 'food' ? '#0000ff' : '#c0c0c0',
                border: '2px outset #c0c0c0',
                cursor: isController ? 'pointer' : 'not-allowed',
                padding: '4px',
              }}
            >
              <img 
                src="/assets/sprites/fish/tank/tank-items/tank-food.png"
                alt="Food"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </button>
            <div style={{ fontSize: '9px', color: '#000080', marginTop: '2px' }}>
              {TOOLS.food.label}
            </div>
          </div>

          {/* Clean Tool */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              onClick={() => selectTool('clean')}
              disabled={!isController}
              style={{
                width: '50px',
                height: '40px',
                background: programState.currentTool === 'clean' ? '#0000ff' : '#c0c0c0',
                border: '2px outset #c0c0c0',
                cursor: isController ? 'pointer' : 'not-allowed',
                padding: '4px',
              }}
            >
              <img 
                src="/assets/sprites/fish/tank/tank-items/tank-wipe.png"
                alt="Clean"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </button>
            <div style={{ fontSize: '9px', color: '#000080', marginTop: '2px' }}>
              {TOOLS.clean.label}
            </div>
          </div>

          {/* Clear Fish / New Fish Tool */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <button
              onClick={programState.isDead ? handleNewFish : handleClearFish}
              disabled={!isController || (programState.isDying && !programState.isDead)}
              style={{
                width: '50px',
                height: '40px',
                background: programState.isDead ? '#44aa44' : '#ff4444',
                border: '2px outset #c0c0c0',
                cursor: isController && !(programState.isDying && !programState.isDead) ? 'pointer' : 'not-allowed',
                padding: '4px',
                opacity: isController && !(programState.isDying && !programState.isDead) ? 1 : 0.5,
              }}
            >
              <div style={{
                fontSize: programState.isDead ? '18px' : '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#ffffff'
              }}>
                {programState.isDead ? '🐠' : '⚡'}
              </div>
            </button>
            <div style={{ fontSize: '9px', color: programState.isDead ? '#004400' : '#800000', marginTop: '2px' }}>
              {programState.isDead ? 'New Fish' : 'Clear Fish'}
            </div>
          </div>

          {/* Status Display */}
          <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#000080', textAlign: 'right' }}>
            <div style={{ marginBottom: '2px' }}>
              🧽 Tank: {Math.round(programState.cleanliness)}%
            </div>
            <div style={{ marginBottom: '2px' }}>
              {programState.isDead ? (
                <span style={{ color: '#800000' }}>💀 Fish: deceased</span>
              ) : (
                <>😊 Fish: {Math.round(programState.happiness)}% happy</>
              )}
            </div>
            {!programState.isDead && programState.hunger < 30 && (
              <div style={{ color: '#ff0000', fontSize: '10px' }}>
                🍎 Hungry!
              </div>
            )}
            {programState.cleanliness < 30 && (
              <div style={{ color: '#ff0000', fontSize: '10px' }}>
                🧽 Dirty tank!
              </div>
            )}
          </div>
        </div>

        {/* Destroy Remains Prompt */}
        {programState.showDestroyPrompt && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#c0c0c0',
              border: '2px outset #c0c0c0',
              padding: '15px',
              zIndex: 2000,
              boxShadow: '4px 4px 8px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ marginBottom: '10px', fontSize: '12px', color: '#000080' }}>
              Destroy remains of {programState.fishName}?
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={handleDestroyRemains}
                style={{
                  padding: '5px 10px',
                  background: '#ff4444',
                  color: '#ffffff',
                  border: '2px outset #c0c0c0',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                Destroy
              </button>
              <button
                onClick={handleCancelDestroy}
                style={{
                  padding: '5px 10px',
                  background: '#c0c0c0',
                  color: '#000000',
                  border: '2px outset #c0c0c0',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </ProgramWindow>
    </>
  );
};

export default SeaBuddy;