import React from 'react';

interface DesktopIconProps {
  id: string;
  label: string;
  icon: string;
  position: { x: number; y: number };
  onInteract: (iconId: string) => void;
}

const DesktopIcon: React.FC<DesktopIconProps> = ({ id, label, icon, position, onInteract }) => {
  const handleDoubleClick = () => {
    onInteract(id);
  };

  return (
    <div 
      className="desktop-icon"
      style={{
        left: position.x,
        top: position.y,
      }}
      onDoubleClick={handleDoubleClick}
      title={`Double-click to open ${label} or press E when nearby`}
    >
      <div className="desktop-icon-image">
        {icon}
      </div>
      <div className="desktop-icon-label">
        {label}
      </div>
    </div>
  );
};

export default DesktopIcon; 