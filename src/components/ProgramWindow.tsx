import React, { useRef, useState, useEffect, ReactNode } from 'react';
import { useAppDispatch } from '../store/hooks';
import { 
  closeProgram, 
  minimizeProgram, 
  focusProgram, 
  updateProgramPosition,
  updateProgramSize 
} from '../store/programSlice';
import '../styles/programWindow.css';

interface ProgramWindowProps {
  windowId: string;
  title: string;
  icon: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  isResizable?: boolean;
  children: ReactNode;
  onFocus?: () => void;
}

const ProgramWindow: React.FC<ProgramWindowProps> = ({
  windowId,
  title,
  icon,
  position,
  size,
  zIndex,
  isMinimized,
  isResizable = true,
  children,
  onFocus,
}) => {
  const dispatch = useAppDispatch();
  const windowRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Focus window when clicked
  const handleWindowClick = () => {
    dispatch(focusProgram(windowId));
    onFocus?.();
  };

  // Handle window dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    
    const rect = windowRef.current?.getBoundingClientRect();
    if (!rect) return;

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });

    handleWindowClick();
  };

  // Handle window resizing
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !isResizable) return;
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    });

    handleWindowClick();
  };

  // Mouse move handler for dragging and resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragOffset.x));
        const newY = Math.max(0, Math.min(window.innerHeight - size.height - 30, e.clientY - dragOffset.y));
        
        dispatch(updateProgramPosition({
          windowId,
          position: { x: newX, y: newY },
        }));
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        const newWidth = Math.max(200, resizeStart.width + deltaX);
        const newHeight = Math.max(150, resizeStart.height + deltaY);
        
        dispatch(updateProgramSize({
          windowId,
          size: { width: newWidth, height: newHeight },
        }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isDragging ? 'move' : 'nw-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, isResizing, dragOffset, windowId, size, resizeStart, dispatch]);

  // Window control handlers
  const handleClose = () => {
    dispatch(closeProgram(windowId));
  };

  const handleMinimize = () => {
    dispatch(minimizeProgram(windowId));
  };

  const handleMaximize = () => {
    // For now, just focus the window. Could implement full maximize later
    dispatch(focusProgram(windowId));
  };

  if (isMinimized) {
    return null; // Minimized windows are handled by the taskbar
  }

  return (
    <div
      ref={windowRef}
      className="program-window"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex,
      }}
      onClick={handleWindowClick}
    >
      {/* Title Bar */}
      <div 
        className="program-window-title"
        onMouseDown={handleMouseDown}
      >
        <div className="title-left">
          <span className="window-icon">{icon}</span>
          <span className="window-title">{title}</span>
        </div>
        <div className="title-controls">
          <button 
            className="win98-title-button minimize"
            onClick={(e) => { e.stopPropagation(); handleMinimize(); }}
            title="Minimize"
          >
            _
          </button>
          <button 
            className="win98-title-button maximize"
            onClick={(e) => { e.stopPropagation(); handleMaximize(); }}
            title="Maximize"
          >
            □
          </button>
          <button 
            className="win98-title-button close"
            onClick={(e) => { e.stopPropagation(); handleClose(); }}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Window Content */}
      <div 
        className="program-window-content"
        onMouseDown={(e) => {
          // Prevent window dragging when clicking in content area
          e.stopPropagation();
        }}
      >
        {children}
      </div>

      {/* Resize Handle */}
      {isResizable && (
        <div 
          className="resize-handle"
          onMouseDown={handleResizeMouseDown}
        />
      )}
    </div>
  );
};

export default ProgramWindow; 