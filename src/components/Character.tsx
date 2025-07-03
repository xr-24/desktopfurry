import React from 'react';

interface Player {
  id: string;
  username: string;
  position: { x: number; y: number };
  quadrant: number;
  appearance?: {
    hue: number;
    eyes: string;
    ears: string;
    fluff: string;
    tail: string;
    body: string;
  };
  characterParts?: never; // deprecated
}

interface CharacterProps {
  player: Player;
  isCurrentPlayer: boolean;
  isMoving?: boolean;
  movementDirection?: string | null;
  walkFrame?: number;
  facingDirection?: 'left' | 'right';
  isGrabbing?: boolean;
  isResizing?: boolean;
  isGaming?: boolean;
  gamingInputDirection?: 'up' | 'down' | 'left' | 'right' | null;
}

const Character: React.FC<CharacterProps> = ({ 
  player, 
  isCurrentPlayer, 
  isMoving = false, 
  movementDirection = null,
  walkFrame = 1,
  facingDirection = 'left',
  isGrabbing = false,
  isResizing = false,
  isGaming = false,
  gamingInputDirection = null
}) => {
  // Different colors for each quadrant
  const getPlayerColor = (quadrant: number) => {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24'];
    return colors[quadrant] || '#95a5a6';
  };

  // Build CSS classes for animation
  const characterClasses = [
    'character',
    isCurrentPlayer ? 'current-player' : 'other-player',
    isMoving ? 'moving' : '',
    isResizing ? 'resizing' : '',
    movementDirection ? `moving-${movementDirection}` : ''
  ].filter(Boolean).join(' ');

  // Determine if sprite should be flipped (sprite faces left by default, flip when facing right)
  const shouldFlip = facingDirection === 'right';

  const baseName = player.appearance?.body || 'CustomBase';

  return (
    <div
      className={characterClasses}
      style={{
        left: player.position.x,
        top: player.position.y,
      }}
    >
      <div className="character-username">
        {player.username}
      </div>
      <div 
        className="character-sprite"
        style={{
          // Apply horizontal flip when needed *and* scale sprite 30% larger
          transform: `${shouldFlip ? 'scaleX(-1) ' : ''}scale(1.3)`,
          // Add a subtle drop shadow for depth
          filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.5))'
        }}
      >
        {/* Character layers rendered in order: tail, body, fluff, ears, eyes */}
        {player.appearance?.tail && player.appearance.tail !== 'none' && (
          <img 
            src={`/assets/characters/tail/${player.appearance.tail}.png`} 
            alt="tail"
            className="sprite-layer"
            style={{ zIndex: 1, filter: `hue-rotate(${player.appearance?.hue || 0}deg)` }}
          />
        )}
        <img 
          src={`/assets/characters/body/${baseName}${
            isGaming 
              ? gamingInputDirection 
                ? `-sit-${gamingInputDirection}` 
                : '-sit'
              : isMoving && isGrabbing 
                ? `-grab-walk${walkFrame}` 
                : isMoving 
                  ? `-walk${walkFrame}` 
                  : isGrabbing 
                    ? '-grab' 
                    : ''
          }.png`} 
          alt={player.username}
          className="sprite-layer"
          style={{ zIndex: 2, filter: `hue-rotate(${player.appearance?.hue || 0}deg)` }}
        />
        {player.appearance?.fluff && player.appearance.fluff !== 'none' && (
          <img 
            src={`/assets/characters/fluff/${player.appearance.fluff}.png`} 
            alt="fluff"
            className="sprite-layer"
            style={{ zIndex: 3, filter: `hue-rotate(${player.appearance?.hue || 0}deg)` }}
          />
        )}
        {player.appearance?.ears && player.appearance.ears !== 'none' && (
          <img 
            src={`/assets/characters/ears/${player.appearance.ears}.png`} 
            alt="ears"
            className="sprite-layer"
            style={{ zIndex: 4, filter: `hue-rotate(${player.appearance?.hue || 0}deg)` }}
          />
        )}
        {player.appearance?.eyes && (
          <img 
            src={`/assets/characters/eyes/${player.appearance.eyes}.png`} 
            alt="eyes"
            className="sprite-layer"
            style={{ zIndex: 5 }}
          />
        )}
      </div>
    </div>
  );
};

export default Character; 