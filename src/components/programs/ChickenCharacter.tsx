import React, { useState, useEffect, useRef } from 'react';
import { useAppSelector } from '../../store/hooks';

interface ChickenCharacterProps {
  position: { x: number; y: number };
  isMoving: boolean;
  walkFrame: number;
  facingDirection: 'left' | 'right';
  equippedItems: {
    weapon?: string;
    armor?: string;
    tool?: string;
  };
  size?: number;
}

const ChickenCharacter: React.FC<ChickenCharacterProps> = ({
  position,
  isMoving,
  walkFrame,
  facingDirection,
  equippedItems,
  size = 32,
}) => {
  const [chickenSprite, setChickenSprite] = useState<HTMLImageElement | null>(null);
  const [walkSprites, setWalkSprites] = useState<{ [key: number]: HTMLImageElement }>({});
  const [equipmentSprites, setEquipmentSprites] = useState<{ [key: string]: HTMLImageElement }>({});
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load chicken sprites
  useEffect(() => {
    // Load base chicken sprite
    const baseSprite = new Image();
    baseSprite.src = '/assets/sprites/chickenquest/chicken.png';
    baseSprite.onload = () => setChickenSprite(baseSprite);

    // Load walk animation sprites
    const loadWalkSprites = async () => {
      const sprites: { [key: number]: HTMLImageElement } = {};
      for (let i = 1; i <= 10; i++) {
        const sprite = new Image();
        sprite.src = `/assets/sprites/chickenquest/chicken-walk${i}.png`;
        sprites[i] = sprite;
      }
      setWalkSprites(sprites);
    };

    loadWalkSprites();
  }, []);

  // Load equipment sprites when equipped items change
  useEffect(() => {
    const loadEquipmentSprites = async () => {
      const sprites: { [key: string]: HTMLImageElement } = {};
      
      // Load weapon sprite
      if (equippedItems.weapon) {
        const weaponSprite = new Image();
        weaponSprite.src = `/assets/sprites/chickenquest/items/${equippedItems.weapon}.png`;
        sprites[equippedItems.weapon] = weaponSprite;
      }
      
      // Load armor sprite
      if (equippedItems.armor) {
        const armorSprite = new Image();
        armorSprite.src = `/assets/sprites/chickenquest/items/${equippedItems.armor}.png`;
        sprites[equippedItems.armor] = armorSprite;
      }
      
      // Load tool sprite
      if (equippedItems.tool) {
        const toolSprite = new Image();
        toolSprite.src = `/assets/sprites/chickenquest/items/${equippedItems.tool}.png`;
        sprites[equippedItems.tool] = toolSprite;
      }
      
      setEquipmentSprites(sprites);
    };

    loadEquipmentSprites();
  }, [equippedItems]);

  // Render character
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Determine which sprite to use
    let spriteToRender = chickenSprite;
    if (isMoving && walkSprites[walkFrame] && walkFrame >= 1 && walkFrame <= 10) {
      spriteToRender = walkSprites[walkFrame];
    }

    if (!spriteToRender) return;

    // Save context for transformations
    ctx.save();

    // Flip sprite if facing left
    if (facingDirection === 'left') {
      ctx.scale(-1, 1);
      ctx.translate(-size, 0);
    }

    // Draw base chicken sprite
    ctx.drawImage(spriteToRender, 0, 0, size, size);

    // Draw equipment overlays
    // Order: armor (behind), weapon (middle), tool (front)
    if (equippedItems.armor && equipmentSprites[equippedItems.armor]) {
      ctx.drawImage(equipmentSprites[equippedItems.armor], 0, 0, size, size);
    }
    
    if (equippedItems.weapon && equipmentSprites[equippedItems.weapon]) {
      ctx.drawImage(equipmentSprites[equippedItems.weapon], 0, 0, size, size);
    }
    
    if (equippedItems.tool && equipmentSprites[equippedItems.tool]) {
      ctx.drawImage(equipmentSprites[equippedItems.tool], 0, 0, size, size);
    }

    // Restore context
    ctx.restore();

  }, [chickenSprite, walkSprites, equipmentSprites, isMoving, walkFrame, facingDirection, equippedItems, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        imageRendering: 'pixelated',
        pointerEvents: 'none',
      }}
    />
  );
};

export default ChickenCharacter; 