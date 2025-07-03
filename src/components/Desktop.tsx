import React, { useState } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import Character from './Character';
import SystemClock from './SystemClock';
import StartMenu from './StartMenu';
import ProgramManager from './ProgramManager';
import useMovement from '../hooks/useMovement';
import { setBackground } from '../store/programSlice';
import '../styles/desktop.css';

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
  const backgroundId = useAppSelector((state: any) => state.programs.backgroundId);
  const dispatch = useAppDispatch();
  
  // Desktop customization state
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [isRoomInfoOpen, setIsRoomInfoOpen] = useState(false);
  
  // Initialize movement controls for current player
  const { position: currentPlayerPosition, isMoving, movementDirection, walkFrame, nearbyIcon, desktopIcons, facingDirection, isGrabbing, isResizing } = useMovement();

  // Background pattern mapping (dynamic)
  const getBackgroundPattern = (bgId: string) => {
    return patternsMap[bgId] || patternsMap['sandstone'];
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
      {Object.values(players || {}).map((player: any) => {
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
      {currentPlayerId && (!players || !players[currentPlayerId]) && (
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
              <div className="player-count">Players: {Object.keys(players || {}).length}/4</div>
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