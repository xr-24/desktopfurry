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
  };
  controllerId: string;
  currentPlayerId: string;
}

// Constants for fish behavior
const FISH_CONSTANTS = {
  MOVEMENT_SPEED: 0.5, // pixels per frame
  DIRECTION_CHANGE_INTERVAL: 3000, // milliseconds
  TANK_PADDING: 80, // pixels from edge
  SWIM_SOUND_CHANCE: 0.02, // 2% chance per frame to play swim sound
  ANIMATION_FRAME_RATE: 500, // milliseconds between animation frames
}

// Decay rates and tool configuration
const DECAY_RATES = {
  HUNGER_DECAY: 1, // points per minute
  CLEANLINESS_DECAY: 0.5, // points per minute
  UPDATE_INTERVAL: 5000, // check every 5 seconds
}

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
    }
  }, [isController]);

  // Load fish data from server on mount
  useEffect(() => {
    if (!isController || programState.isLoaded) return;

    const loadFishData = async () => {
      try {
        const fishData = await authService.loadFish();
        if (fishData) {
          // Player already has a fish, load it
          const now = Date.now();
          dispatch(updateProgramState({
            windowId,
            newState: {
              setupStep: 'complete',
              selectedTank: fishData.tank_background,
              selectedFish: fishData.fish_type,
              fishName: fishData.fish_name,
              fishPosition: { x: fishData.fish_x || 50, y: fishData.fish_y || 50 },
              fishMovement: {
                direction: Math.random() * 360,
                speed: FISH_CONSTANTS.MOVEMENT_SPEED,
                targetX: 60,
                targetY: 60,
                movementTimer: now,
                isSwimming: false,
              },
              hunger: fishData.hunger_level,
              cleanliness: fishData.tank_cleanliness,
              happiness: calculateHappiness(fishData.hunger_level, fishData.tank_cleanliness),
              health: calculateHealth(fishData.tank_cleanliness),
              lastFed: new Date(fishData.last_fed).getTime(),
              lastCleaned: new Date(fishData.last_cleaned).getTime(),
              lastDecayUpdate: now,
              isLoaded: true,
            }
          }));
        } else {
          // New player, start setup
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

  // Fish movement animation loop
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

    // Check if we need a new target
    const distanceToTarget = Math.sqrt(
      Math.pow(targetX - currentX, 2) + Math.pow(targetY - currentY, 2)
    );

    let newMovement = { ...movement };
    let newPosition = { ...position };
    let isSwimming = false;

    if (distanceToTarget < 10 || now - movement.movementTimer > FISH_CONSTANTS.DIRECTION_CHANGE_INTERVAL) {
      // Generate new target
      const newTarget = generateNewTarget();
      newMovement = {
        ...movement,
        targetX: (newTarget.x / canvasWidth) * 100,
        targetY: (newTarget.y / canvasHeight) * 100,
        movementTimer: now,
        direction: Math.atan2(newTarget.y - currentY, newTarget.x - currentX) * (180 / Math.PI),
      };
    }

    // Move towards target
    if (distanceToTarget > 5) {
      const angle = Math.atan2(targetY - currentY, targetX - currentX);
      const newX = currentX + Math.cos(angle) * FISH_CONSTANTS.MOVEMENT_SPEED;
      const newY = currentY + Math.sin(angle) * FISH_CONSTANTS.MOVEMENT_SPEED;

      newPosition = {
        x: Math.max(10, Math.min(90, (newX / canvasWidth) * 100)),
        y: Math.max(10, Math.min(90, (newY / canvasHeight) * 100)),
      };

      isSwimming = true;

      // Play random swim sounds occasionally
      if (Math.random() < FISH_CONSTANTS.SWIM_SOUND_CHANCE) {
        const swimSounds = ['swim1', 'swim2', 'swim3', 'swim4'];
        const randomSound = swimSounds[Math.floor(Math.random() * swimSounds.length)];
        audioService.playSound(randomSound);
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

  // Animation frame cycling for fish sprite
  useEffect(() => {
    if (programState.setupStep !== 'complete') return;

    const interval = setInterval(() => {
      setAnimationFrame(prev => (prev + 1) % 2); // Cycle between 0 and 1
    }, FISH_CONSTANTS.ANIMATION_FRAME_RATE);

    return () => clearInterval(interval);
  }, [programState.setupStep]);

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
            movementTimer: now,
            isSwimming: false,
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



  // Handle fish interaction (feeding)
  const handleFishClick = async () => {
    if (!isController || programState.currentTool !== 'food') return;

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

          {/* Fish */}
          <div
            style={{
              position: 'absolute',
              left: `${programState.fishPosition.x}%`,
              top: `${programState.fishPosition.y}%`,
              transform: `translate(-50%, -50%) ${programState.fishMovement.direction < -90 || programState.fishMovement.direction > 90 ? 'scaleX(-1)' : ''}`,
              cursor: programState.currentTool === 'food' ? 'pointer' : 'default',
              transition: 'transform 0.3s ease',
            }}
            onClick={programState.currentTool === 'food' ? handleFishClick : undefined}
            onMouseEnter={() => setHoveredFish(true)}
            onMouseLeave={() => setHoveredFish(false)}
          >
            <img
              src={`/assets/sprites/fish/${programState.selectedFish}.png`}
              alt={programState.fishName}
              style={{ 
                width: '60px', 
                height: '45px', 
                objectFit: 'contain',
                opacity: programState.fishMovement.isSwimming ? (animationFrame === 0 ? 1 : 0.8) : 1,
                transition: 'opacity 0.1s ease'
              }}
            />
            
            {/* Fish Name */}
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

            {/* Stats Tooltip */}
            {hoveredFish && (
              <div
                style={{
                  position: 'absolute',
                  top: '-90px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#ffffcc',
                  border: '1px solid #000000',
                  padding: '8px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  whiteSpace: 'nowrap',
                  zIndex: 1000,
                  boxShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                }}
              >
                <div>🍎 Hunger: {Math.round(programState.hunger)}%</div>
                <div>❤️ Health: {Math.round(programState.health)}%</div>
                <div>😊 Happiness: {Math.round(programState.happiness)}%</div>
                <div>🧽 Tank: {Math.round(programState.cleanliness)}%</div>
              </div>
            )}
          </div>

          {/* Swimming particles effect when fish is moving */}
          {programState.fishMovement.isSwimming && (
            <div
              style={{
                position: 'absolute',
                left: `${programState.fishPosition.x + (Math.random() - 0.5) * 5}%`,
                top: `${programState.fishPosition.y + (Math.random() - 0.5) * 5}%`,
                width: '2px',
                height: '2px',
                background: '#00aaff',
                borderRadius: '50%',
                animation: 'bubble 1s ease-out forwards',
                pointerEvents: 'none',
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

          {/* Status Display */}
          <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#000080', textAlign: 'right' }}>
            <div style={{ marginBottom: '2px' }}>
              🧽 Tank: {Math.round(programState.cleanliness)}%
            </div>
            <div style={{ marginBottom: '2px' }}>
              😊 Fish: {Math.round(programState.happiness)}% happy
            </div>
            {programState.hunger < 30 && (
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
      </div>
    </ProgramWindow>
    </>
  );
};

export default SeaBuddy; 