import React, { useState, useRef, useEffect } from 'react';
import { useAppSelector } from '../store/hooks';

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
  vehicle?: 'none' | 'ufo';
  currentTitleId?: string | null;
  currentItemIds?: string[];
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
  isSitting?: boolean;
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
  isSitting = false,
  isGaming = false,
  gamingInputDirection = null
}) => {
  // Add animation recovery for non-current players
  const [localWalkFrame, setLocalWalkFrame] = useState(walkFrame);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnimationUpdateRef = useRef<number>(Date.now());

  // For remote players, add animation recovery
  useEffect(() => {
    if (isCurrentPlayer) return;

    // Update local walk frame when prop changes
    setLocalWalkFrame(walkFrame);
    lastAnimationUpdateRef.current = Date.now();

    // Clear any existing timeout
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }

    // If player is moving but frame hasn't updated in a while, force local animation
    if (isMoving) {
      animationTimeoutRef.current = setTimeout(() => {
        const now = Date.now();
        const timeSinceUpdate = now - lastAnimationUpdateRef.current;
        
        // If no frame update in 200ms but player is still moving, start local animation
        if (timeSinceUpdate > 200) {
          console.log(`Starting local animation recovery for player ${player.id}`);
          const interval = setInterval(() => {
            setLocalWalkFrame(prev => prev === 1 ? 2 : 1);
          }, 100); // Match closer to normal animation speed
          
          // Stop local animation after a reasonable time
          setTimeout(() => {
            clearInterval(interval);
            console.log(`Stopping local animation recovery for player ${player.id}`);
          }, 2000);
        }
      }, 250);
    }

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [walkFrame, isMoving, isCurrentPlayer, player.id]);

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
    isSitting ? 'sitting' : '',
    movementDirection ? `moving-${movementDirection}` : ''
  ].filter(Boolean).join(' ');

  // Determine if sprite should be flipped. While gaming, sprite assets already include left/right variants, so disable flip.
  const shouldFlip = !isGaming && facingDirection === 'right';

  const baseName = player.appearance?.body || 'CustomBase';
  const prefix = baseName.replace('Base', ''); // "Custom"

  // Preload walk animation frames (walk + grab-walk) once per sprite set
  useEffect(() => {
    const sources = [
      `${prefix}-Walk1.png`,
      `${prefix}-Walk2.png`,
      `${prefix}Grab-Walk1.png`,
      `${prefix}Grab-Walk2.png`,
    ];
    sources.forEach((file) => {
      const img = new Image();
      img.src = `/assets/characters/body/${file}`;
    });
  }, [prefix]);

  // Use localWalkFrame for remote players, walkFrame for current player
  const effectiveWalkFrame = isCurrentPlayer ? walkFrame : localWalkFrame;

  const fileForState = () => {
    // Gaming (sitting)
    if (isGaming) {
      const dir = gamingInputDirection ? `-${gamingInputDirection.charAt(0).toUpperCase()}${gamingInputDirection.slice(1)}` : '';
      return `${prefix}Sit${dir}`;
    }

    // Regular sitting (not gaming)
    if (isSitting) {
      return `${prefix}Sit-NoGame`;
    }

    // Grabbing
    if (isGrabbing) {
      if (isMoving) {
        return `${prefix}Grab-Walk${effectiveWalkFrame}`;
      }
      return `${prefix}Grab`;
    }

    // Walking (not grabbing)
    if (isMoving) {
      return `${prefix}-Walk${effectiveWalkFrame}`;
    }

    // Idle
    return baseName; // CustomBase
  };

  // Offset sprite downward when sitting – include gaming sit sprites too
  const yOffset = (isSitting || isGaming) ? 40 : 0;

  // Get inventory data for titles and items
  const { titles, items, currentTitleId: invTitleId, currentItemIds: invItemIds } = useAppSelector((state: any) => state.inventory);
  
  // Get current title for this player
  const getCurrentTitle = () => {
    const titleId = isCurrentPlayer ? invTitleId : player.currentTitleId;
    if (!titleId) return null;
    return titles.find((title: any) => title.id === titleId);
  };

  // Get current items for this player
  const getCurrentItems = () => {
    const itemIds = isCurrentPlayer ? invItemIds : player.currentItemIds;
    if (!itemIds?.length) return [];
    return itemIds
      .map((itemId: string) => items.find((item: any) => item.id === itemId))
      .filter(Boolean);
  };

  const currentTitle = getCurrentTitle();
  const currentItems = getCurrentItems();

  return (
    <div
      className={characterClasses}
      style={{
        left: player.position.x,
        top: player.position.y + yOffset,
      }}
    >
      {/* Title above username */}
      {currentTitle && (
        <div 
          className="character-title"
          style={currentTitle.style_config}
        >
          {currentTitle.name}
        </div>
      )}
      
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
          src={`/assets/characters/body/${fileForState()}.png`} 
          alt={player.username}
          className="sprite-layer"
          style={{ zIndex: 2, filter: `hue-rotate(${player.appearance?.hue || 0}deg)` }}
        />

        {player.appearance?.fluff && player.appearance.fluff !== 'none' && (
          <img 
            src={`/assets/characters/fluff/${player.appearance.fluff}.png`} 
            alt="fluff"
            className="sprite-layer"
            style={{ zIndex: 4, filter: `hue-rotate(${player.appearance?.hue || 0}deg)` }}
          />
        )}
        {player.appearance?.ears && player.appearance.ears !== 'none' && (
          <img 
            src={`/assets/characters/ears/${player.appearance.ears}.png`} 
            alt="ears"
            className="sprite-layer"
            style={{ zIndex: 5, filter: `hue-rotate(${player.appearance?.hue || 0}deg)` }}
          />
        )}
        {player.appearance?.eyes && player.appearance.eyes !== 'none' && (
          <img 
            src={`/assets/characters/eyes/${player.appearance.eyes}.png`} 
            alt="eyes"
            className="sprite-layer"
            style={{ zIndex: 6 }}
          />
        )}

        {/* Vehicle overlay (e.g., UFO) */}
        {player.vehicle === 'ufo' && (
          <img
            src="/assets/characters/items/vehicles/ufo.png"
            alt="ufo"
            className="sprite-layer"
            style={{ zIndex: 10 }}
          />
        )}

        {/* Item overlays - highest z-index */}
        {currentItems.map((item: any, index: number) => (
          <img
            key={item.id}
            src={item.asset_path}
            alt={item.name}
            className="sprite-layer item-overlay"
            style={{ 
              zIndex: 15 + index, // Ensure items are on top of everything
              imageRendering: 'pixelated'
            }}
            onError={(e) => {
              const fallback = `/assets/characters/items/misc/${item.name.toLowerCase().replace(/\s+/g, '')}.png`;
              if ((e.target as HTMLImageElement).src !== window.location.origin + fallback) {
                (e.target as HTMLImageElement).src = fallback;
              }
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default Character; 