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
    fishMovement: { direction: number; speed: number };
    hunger: number;
    cleanliness: number;
    happiness: number;
    health: number;
    currentTool: 'none' | 'food' | 'clean';
    showStats: boolean;
    lastFed: number;
    lastCleaned: number;
    lastMovement: number;
    isLoaded: boolean;
  };
  controllerId: string;
  currentPlayerId: string;
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
  const [nameInput, setNameInput] = useState(programState.fishName || '');
  const [hoveredFish, setHoveredFish] = useState(false);
  const [cursorStyle, setCursorStyle] = useState<React.CSSProperties>({});

  const isController = controllerId === currentPlayerId;

  // Load fish data from server on mount
  useEffect(() => {
    if (!isController || programState.isLoaded) return;

    const loadFishData = async () => {
      try {
        const fishData = await authService.loadFish();
        if (fishData) {
          // Player already has a fish, load it
          dispatch(updateProgramState({
            windowId,
            newState: {
              setupStep: 'complete',
              selectedTank: fishData.tank_background,
              selectedFish: fishData.fish_type,
              fishName: fishData.fish_name,
              fishPosition: { x: fishData.fish_x, y: fishData.fish_y },
              hunger: fishData.hunger_level,
              cleanliness: fishData.tank_cleanliness,
              happiness: calculateHappiness(fishData.hunger_level, fishData.tank_cleanliness),
              health: calculateHealth(fishData.tank_cleanliness),
              lastFed: new Date(fishData.last_fed).getTime(),
              lastCleaned: new Date(fishData.last_cleaned).getTime(),
              isLoaded: true,
            }
          }));
        } else {
          // New player, start setup
          dispatch(updateProgramState({
            windowId,
            newState: { isLoaded: true }
          }));
        }
      } catch (error) {
        console.error('Failed to load fish data:', error);
        dispatch(updateProgramState({
          windowId,
          newState: { isLoaded: true }
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

      dispatch(updateProgramState({
        windowId,
        newState: {
          fishName: nameInput.trim(),
          setupStep: 'complete',
          happiness: 100,
          health: 100,
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
    if (newTool === 'food') {
      setCursorStyle({ cursor: `url(/assets/sprites/fish/tank/tank-items/tank-food.png) 16 16, pointer` });
    } else if (newTool === 'clean') {
      setCursorStyle({ cursor: `url(/assets/sprites/fish/tank/tank-items/tank-wipe.png) 16 16, pointer` });
    } else {
      setCursorStyle({});
    }
  };

  // Handle fish interaction (feeding)
  const handleFishClick = async () => {
    if (!isController || programState.currentTool !== 'food') return;

    try {
      await authService.feedFish();
      
      const newHunger = Math.min(100, programState.hunger + 20);
      const newHappiness = calculateHappiness(newHunger, programState.cleanliness);
      
      dispatch(updateProgramState({
        windowId,
        newState: {
          hunger: newHunger,
          happiness: newHappiness,
          lastFed: Date.now(),
          currentTool: 'none'
        }
      }));

      setCursorStyle({});
      
      // Play eating sound
      audioService.playSound('eat');
    } catch (error) {
      console.error('Failed to feed fish:', error);
    }
  };

  // Handle tank cleaning
  const handleTankClick = async () => {
    if (!isController || programState.currentTool !== 'clean') return;

    try {
      await authService.cleanTank();
      
      const newCleanliness = Math.min(100, programState.cleanliness + 25);
      const newHappiness = calculateHappiness(programState.hunger, newCleanliness);
      const newHealth = calculateHealth(newCleanliness);
      
      dispatch(updateProgramState({
        windowId,
        newState: {
          cleanliness: newCleanliness,
          happiness: newHappiness,
          health: newHealth,
          lastCleaned: Date.now(),
          currentTool: 'none'
        }
      }));

      setCursorStyle({});
      
      // Play cleaning sound
      const cleanSound = Math.random() > 0.5 ? 'clean1' : 'clean2';
      // We'll need to preload these sounds
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
        {/* Tank Background */}
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: '60px', // Leave space for tools
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
              transform: 'translate(-50%, -50%)',
              cursor: programState.currentTool === 'food' ? 'pointer' : 'default',
            }}
            onClick={programState.currentTool === 'food' ? handleFishClick : undefined}
            onMouseEnter={() => setHoveredFish(true)}
            onMouseLeave={() => setHoveredFish(false)}
          >
            <img
              src={`/assets/sprites/fish/${programState.selectedFish}.png`}
              alt={programState.fishName}
              style={{ width: '60px', height: '45px', objectFit: 'contain' }}
            />
            
            {/* Fish Name */}
            <div
              style={{
                position: 'absolute',
                top: '-20px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0, 0, 0, 0.7)',
                color: '#ffffff',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '11px',
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
                  top: '-80px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#ffffcc',
                  border: '1px solid #000000',
                  padding: '8px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  whiteSpace: 'nowrap',
                  zIndex: 1000,
                }}
              >
                <div>Hunger: {programState.hunger}%</div>
                <div>Health: {programState.health}%</div>
                <div>Happiness: {programState.happiness}%</div>
              </div>
            )}
          </div>
        </div>

        {/* Tool Bar */}
        <div 
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '60px',
            background: '#f0f0f0',
            border: '1px inset #c0c0c0',
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            gap: '10px',
          }}
        >
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



           <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#000080' }}>
             <div>Tank: {programState.cleanliness}%</div>
             <div>Fish: {programState.happiness}% happy</div>
           </div>
         </div>
       </div>
     </ProgramWindow>
   );
 };

export default SeaBuddy; 