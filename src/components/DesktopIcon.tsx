import React, { useState, useRef, useEffect } from 'react';
import { useAppDispatch } from '../store/hooks';
import { setIconPosition } from '../store/iconSlice';

interface DesktopIconProps {
  id: string;
  label: string;
  icon: string;
  position: { x: number; y: number };
  onInteract: (iconId: string) => void;
  isNearby?: boolean;
}

const DesktopIcon: React.FC<DesktopIconProps> = ({ id, label, icon, position, onInteract, isNearby }) => {
  const dispatch = useAppDispatch();
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleDoubleClick = () => {
    onInteract(id);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setIsDragging(true);
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent) => {
      const newX = Math.max(10, Math.min(window.innerWidth - 64, e.clientX - dragOffset.current.x));
      const newY = Math.max(10, Math.min(window.innerHeight - 80, e.clientY - dragOffset.current.y));
      dispatch(setIconPosition({ id, x: newX, y: newY }));
    };

    const handleUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, dispatch, id]);

  return (
    <div 
      className={`desktop-icon ${isNearby ? 'nearby' : ''}`}
      style={{
        left: position.x,
        top: position.y,
      }}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      title={`${isNearby ? 'Press E to open ' : 'Walk close and press E to open '}${label}`}
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