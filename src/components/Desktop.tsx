import React, { useState, useRef, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import Character from './Character';
import SystemClock from './SystemClock';
import StartMenu from './StartMenu';
import ProgramManager from './ProgramManager';
import useMovement from '../hooks/useMovement';
import { setBackground } from '../store/programSlice';
import { updatePlayerPosition } from '../store/gameSlice';
import '../styles/desktop.css';
import { authService } from '../services/authService';
import { store } from '../store/store';

// Dynamically load pattern images
// eslint-disable-next-line @typescript-eslint/no-var-requires
const patternsContext = (require as any).context('../assets/patterns', false, /\.(png|jpe?g|gif)$/);

const patternsMap: { [key: string]: string } = patternsContext.keys().reduce((acc: Record<string, string>, file: string) => {
  const id = file.replace('./', '').replace(/\.(png|jpe?g|gif)$/, '').toLowerCase();
  acc[id] = patternsContext(file) as string;
  return acc;
}, {});

const Desktop: React.FC = () => {
  const { roomId, players } = useAppSelector((state: any) => state.game || {});
  const { id: currentPlayerId, isGaming, gamingInputDirection } = useAppSelector((state: any) => state.player || {});
  const visitedId = useAppSelector((state: any) => state.dextop.visitedId);
  const currentDextop = useAppSelector((state: any) => state.dextop.current);
  const backgroundId = useAppSelector((state: any) => state.programs.backgroundId);
  const visitors = useAppSelector((state:any)=> state.dextop.visitors);
  const dispatch = useAppDispatch();
  
  // Desktop customization state
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [isRoomInfoOpen, setIsRoomInfoOpen] = useState(false);
  
  // Animation recovery for remote players/visitors
  const lastPlayerUpdate = useRef<{ [playerId: string]: number }>({});
  const animationRecoveryInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize movement controls for current player
  const { position: currentPlayerPosition, isMoving, movementDirection, walkFrame, nearbyIcon, desktopIcons, facingDirection, isGrabbing, isResizing } = useMovement();

  const programsState = useAppSelector((state:any)=> state.programs);
  // Debounced persistence when programs or background change
  const lastSavedRef = useRef<any>(null);
  useEffect(() => {
    if (!authService.isAuthenticated()) return;
    if (visitedId && !(currentDextop?.isOwner)) return;
    const state = programsState;
    if (!state) return;

    const prevState = lastSavedRef.current;

    // Detect program types that disappeared (all windows of that type closed)
    if (prevState && prevState.openPrograms) {
      const prevTypes = new Set(Object.values(prevState.openPrograms).map((p: any) => p.type));
      const currTypes = new Set(Object.values(state.openPrograms).map((p: any) => p.type));
      const removedTypes = Array.from(prevTypes).filter((t) => !currTypes.has(t));
      removedTypes.forEach((t) => authService.deleteProgramState(t));
    }

    // Skip save if nothing changed compared with last snapshot
    if (prevState && JSON.stringify(state) === JSON.stringify(prevState)) return;

    lastSavedRef.current = state;

    const timer = setTimeout(() => {
      // Save background
      authService.updateBackground(state.backgroundId);
      // Persist each open program window
      Object.values(state.openPrograms).forEach((p: any) => {
        authService.saveProgramState(
          p.type,
          p.position,
          p.size,
          p.zIndex,
          p.isMinimized,
          p.state || {}
        );
      });
    }, 1000); // debounce 1 s

    return () => clearTimeout(timer);
  }, [programsState, visitedId]);

  // Animation recovery system for remote players/visitors
  useEffect(() => {
    // Track animation health of remote entities
    animationRecoveryInterval.current = setInterval(() => {
      const now = Date.now();
      const entityMap = getEntityMap();
      Object.keys(entityMap).forEach(playerId => {
        if (playerId === currentPlayerId) return; // Skip current player
        
        const player = entityMap[playerId];
        const lastUpdate = lastPlayerUpdate.current[playerId] || 0;
        
        // If a player hasn't updated in 5 seconds and appears to be moving, they might be stuck
        if (player?.isMoving && (now - lastUpdate) > 5000) {
          console.log(`Remote player ${playerId} animation might be stuck, forcing refresh`);
          // Force a visual refresh by dispatching a minimal update
          dispatch(updatePlayerPosition({
            playerId,
            position: player.position,
            isMoving: false, // Force stop moving to reset animation
            walkFrame: 1
          }));
        }
      });
    }, 3000); // Check every 3 seconds

    return () => {
      if (animationRecoveryInterval.current) {
        clearInterval(animationRecoveryInterval.current);
      }
    };
  }, [players, visitors, visitedId, currentPlayerId, dispatch]);

  // Track when players update to detect stale animations
  useEffect(() => {
    const entityMap = getEntityMap();
    Object.keys(entityMap).forEach(playerId => {
      if (playerId !== currentPlayerId) {
        lastPlayerUpdate.current[playerId] = Date.now();
      }
    });
  }, [players, visitors, visitedId, currentPlayerId]);

  // Background pattern mapping (dynamic)
  const getBackgroundPattern = (bgId: string) => {
    return patternsMap[bgId] || patternsMap['sandstone'];
  };

  // Persist desktop state and background on unload (refresh / close)
  useEffect(() => {
    const handleSave = () => {
      // Skip saving if currently visiting another dextop
      if (store.getState().dextop.visitedId) return;

      const state = store.getState().programs as any;
      const user = authService.getStoredUser();
      if (!user) return;

      // Save background
      authService.updateBackground(state.backgroundId);

      // Save each program window
      Object.values(state.openPrograms).forEach((p: any) => {
        authService.saveProgramState(
          p.type,
          p.position,
          p.size,
          p.zIndex,
          p.isMinimized,
          p.state || {}
        );
      });
    };

    window.addEventListener('beforeunload', handleSave);
    return () => {
      handleSave();
      window.removeEventListener('beforeunload', handleSave);
    };
  }, []);

  // Helper to provide entity map depending on context (dextop vs legacy room)
  const getEntityMap = () => {
    if (visitedId) return visitors;
    const merged: any = { ...players };
    const selfUserId = authService.getStoredUser()?.id;
    Object.entries(visitors).forEach(([id, v]: any) => {
      if (id !== currentPlayerId && id !== selfUserId) {
        merged[id] = v;
      }
    });
    return merged;
  };

  if (!roomId) {
    return null; // Don't show desktop if not in a room
  }

  return (
    <div 
      className="desktop-container"
      style={{ 
        backgroundImage: `url(${getBackgroundPattern(backgroundId)})`,
        backgroundRepeat: 'repeat',
        backgroundSize: 'auto'
      }}
    >
      {/* Render all player characters */}
      {Object.values(getEntityMap()).map((player: any) => {
        // Use local position for current player, server position for others
        const displayPlayer = player.id === currentPlayerId 
          ? { ...player, position: currentPlayerPosition }
          : player;
        
        return (
          <Character
            key={player.id}
            player={displayPlayer}
            isCurrentPlayer={player.id === currentPlayerId}
            isMoving={player.id === currentPlayerId ? isMoving : player.isMoving}
            movementDirection={player.id === currentPlayerId ? movementDirection : player.movementDirection}
            walkFrame={player.id === currentPlayerId ? walkFrame : player.walkFrame || 1}
            facingDirection={player.id === currentPlayerId ? facingDirection : player.facingDirection || 'left'}
            isGrabbing={player.id === currentPlayerId ? isGrabbing : player.isGrabbing || false}
            isResizing={player.id === currentPlayerId ? isResizing : player.isResizing || false}
            isGaming={player.id === currentPlayerId ? isGaming : player.isGaming || false}
            gamingInputDirection={player.id === currentPlayerId ? gamingInputDirection : player.gamingInputDirection || null}
          />
        );
      })}
      
      {/* Show current player even if not in players list yet */}
      {currentPlayerId && !getEntityMap()[currentPlayerId] && (
        <Character
          key="current-player-temp"
          player={{
            id: currentPlayerId,
            username: "You",
            position: currentPlayerPosition,
            quadrant: 0
          }}
          isCurrentPlayer={true}
          isMoving={isMoving}
          movementDirection={movementDirection}
          walkFrame={walkFrame}
          facingDirection={facingDirection}
          isGrabbing={isGrabbing}
          isResizing={isResizing}
          isGaming={isGaming}
          gamingInputDirection={gamingInputDirection}
        />
      )}

      {/* Desktop Icons with proximity feedback */}
      {desktopIcons.map((iconData) => (
        <div 
          key={iconData.id}
          className={`desktop-icon ${nearbyIcon === iconData.id ? 'nearby' : ''}`}
          style={{
            left: iconData.x,
            top: iconData.y,
          }}
          title={nearbyIcon === iconData.id ? `Press E to open ${iconData.label}` : `Walk close and press E to open ${iconData.label}`}
        >
          <div className="desktop-icon-image">
            {iconData.icon}
          </div>
          <div className="desktop-icon-label">
            {iconData.label}
          </div>
        </div>
      ))}

      {/* All open program windows */}
      <ProgramManager />

      {/* Room info popup (only when opened) */}
      {isRoomInfoOpen && (
        <>
          <div 
            className="room-info-backdrop" 
            onClick={() => setIsRoomInfoOpen(false)}
          />
          <div className="room-info-popup">
            <div className="room-info-header">
              <span>ℹ️ Room Information</span>
              <button 
                className="room-info-close"
                onClick={() => setIsRoomInfoOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="room-info-content">
              <div className="room-id">Room: {roomId}</div>
              <div className="player-count">Players: {Object.keys(getEntityMap()).length}/4</div>
              <div className="controls-hint">Use WASD to move</div>
              <div className="interaction-hint">
                {nearbyIcon ? `💡 Press E to open ${nearbyIcon}` : '💡 Walk close to icons and press E'}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Win98 Taskbar */}
      <div className="win98-taskbar">
        <div className="taskbar-left">
          <button 
            className="win98-start-button"
            onClick={() => setIsStartMenuOpen(!isStartMenuOpen)}
          >
            <span>🖥️</span>
            <span>Start</span>
          </button>
        </div>
        
        <div className="taskbar-right">
          <button 
            className="room-info-button"
            onClick={() => setIsRoomInfoOpen(!isRoomInfoOpen)}
            title="Room Information"
          >
            ℹ️
          </button>
          <SystemClock />
        </div>
      </div>

      {/* Start Menu */}
      <StartMenu 
        isOpen={isStartMenuOpen}
        onClose={() => setIsStartMenuOpen(false)}
        onChangeBackground={(id) => dispatch(setBackground(id))}
        currentBackground={backgroundId}
      />
    </div>
  );
};

export default Desktop; 