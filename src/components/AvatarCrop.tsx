import React from 'react';

interface AvatarAppearance {
  hue: number;
  eyes: string;
  ears: string;
  fluff: string;
  tail: string;
  body: string;
}

interface AvatarCropProps {
  appearance: AvatarAppearance;
  size?: number;
  className?: string;
}

const AvatarCrop: React.FC<AvatarCropProps> = ({ 
  appearance, 
  size = 80, 
  className = '' 
}) => {
  const getAssetPath = (category: string, asset: string): string | undefined => {
    if (!asset || asset === 'none') return undefined;
    return `/assets/characters/${category}/${asset}.png`;
  };

  const cropStyle = {
    width: `${size}px`,
    height: `${size}px`,
    position: 'relative' as const,
    overflow: 'hidden',
    backgroundColor: 'white',
    border: '2px solid #c0c0c0',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const spriteContainerStyle = {
    position: 'relative' as const,
    width: '64px',
    height: '64px',
    transform: 'scale(1.2)', // Slightly larger to show more detail
    filter: `hue-rotate(${appearance.hue}deg)`,
  };

  const spriteStyle = {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '64px',
    height: '64px',
    imageRendering: 'pixelated' as const,
  };

  // Only show the upper portion (head and shoulders) by cropping
  const cropContainerStyle = {
    ...cropStyle,
    clipPath: 'inset(0 0 40% 0)', // Crop bottom 40% to show head/shoulders only
  };

  return (
    <div className={`avatar-crop ${className}`} style={cropStyle}>
      <div style={spriteContainerStyle}>
        {/* Body (base layer) */}
        {appearance.body && (
          <img
            src={getAssetPath('body', appearance.body)}
            alt="Body"
            style={spriteStyle}
            onError={(e) => {
              // Fallback to default body if image fails to load
              (e.target as HTMLImageElement).src = getAssetPath('body', 'CustomBase') || '';
            }}
          />
        )}

        {/* Fluff layer */}
        {appearance.fluff && appearance.fluff !== 'none' && (
          <img
            src={getAssetPath('fluff', appearance.fluff)}
            alt="Fluff"
            style={spriteStyle}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}

        {/* Ears layer */}
        {appearance.ears && appearance.ears !== 'none' && (
          <img
            src={getAssetPath('ears', appearance.ears)}
            alt="Ears"
            style={spriteStyle}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}

        {/* Eyes layer */}
        {appearance.eyes && appearance.eyes !== 'none' && (
          <img
            src={getAssetPath('eyes', appearance.eyes)}
            alt="Eyes"
            style={spriteStyle}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}

        {/* Tail layer (might be partially visible in crop) */}
        {appearance.tail && appearance.tail !== 'none' && (
          <img
            src={getAssetPath('tail', appearance.tail)}
            alt="Tail"
            style={spriteStyle}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
      </div>
    </div>
  );
};

export default AvatarCrop;
