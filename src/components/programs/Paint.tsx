import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppDispatch } from '../../store/hooks';
import { updateProgramState } from '../../store/programSlice';
import ProgramWindow from '../ProgramWindow';
import { socketService } from '../../services/socketService';
import { audioService } from '../../services/audioService';
import '../../styles/win98.css';
import '../../styles/paint.css';

// Win98 color palette
const WIN98_COLORS = [
  '#000000', '#808080', '#800000', '#808000', 
  '#008000', '#008080', '#000080', '#800080', 
  '#C0C0C0', '#FFFFFF', '#FF0000', '#FFFF00', 
  '#00FF00', '#00FFFF', '#0000FF', '#FF00FF'
];

interface PaintProps {
  windowId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  programState: {
    canvasData: string | null;
    tool: 'brush' | 'eraser' | 'fill' | 'line' | 'rectangle' | 'circle';
    color: string;
    brushSize: number;
    undoStack: string[];
    redoStack: string[];
  };
  controllerId: string;
  currentPlayerId: string;
}

// Add flood fill helper function
const floodFill = (
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: string
) => {
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const pixels = imageData.data;

  // Get the color we're filling
  const startPos = (startY * ctx.canvas.width + startX) * 4;
  const startR = pixels[startPos];
  const startG = pixels[startPos + 1];
  const startB = pixels[startPos + 2];
  const startA = pixels[startPos + 3];

  // Convert fill color from hex to RGB
  const fillRGB = {
    r: parseInt(fillColor.slice(1, 3), 16),
    g: parseInt(fillColor.slice(3, 5), 16),
    b: parseInt(fillColor.slice(5, 7), 16)
  };

  // Don't fill if we're already on the fill color
  if (
    startR === fillRGB.r &&
    startG === fillRGB.g &&
    startB === fillRGB.b
  ) {
    return;
  }

  // Queue for flood fill
  const queue: [number, number][] = [[startX, startY]];
  
  // Helper to check if a pixel matches the start color
  const matchesStart = (pos: number) => {
    return (
      pixels[pos] === startR &&
      pixels[pos + 1] === startG &&
      pixels[pos + 2] === startB &&
      pixels[pos + 3] === startA
    );
  };

  // Helper to set a pixel to fill color
  const setFillColor = (pos: number) => {
    pixels[pos] = fillRGB.r;
    pixels[pos + 1] = fillRGB.g;
    pixels[pos + 2] = fillRGB.b;
    pixels[pos + 3] = 255;
  };

  while (queue.length > 0) {
    const [x, y] = queue.pop()!;
    const pos = (y * ctx.canvas.width + x) * 4;

    if (!matchesStart(pos)) continue;

    let left = x;
    let right = x;

    // Find the leftmost and rightmost pixels to fill on this line
    while (left > 0 && matchesStart((y * ctx.canvas.width + (left - 1)) * 4)) {
      left--;
    }
    while (right < ctx.canvas.width - 1 && matchesStart((y * ctx.canvas.width + (right + 1)) * 4)) {
      right++;
    }

    // Fill the line
    for (let i = left; i <= right; i++) {
      const fillPos = (y * ctx.canvas.width + i) * 4;
      setFillColor(fillPos);

      // Add pixels above and below to queue
      if (y > 0 && matchesStart((y - 1) * ctx.canvas.width * 4 + i * 4)) {
        queue.push([i, y - 1]);
      }
      if (y < ctx.canvas.height - 1 && matchesStart((y + 1) * ctx.canvas.width * 4 + i * 4)) {
        queue.push([i, y + 1]);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
};

const Paint: React.FC<PaintProps> = ({
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const UPDATE_INTERVAL = 50; // 50ms throttle for network updates

  // Local state for UI
  const [selectedColor, setSelectedColor] = useState(programState.color || '#000000');
  const [brushSize, setBrushSize] = useState(programState.brushSize || 2);
  const [selectedTool, setSelectedTool] = useState<typeof programState.tool>(programState.tool || 'brush');
  
  // Add refs for shape drawing
  const startPointRef = useRef<{ x: number; y: number } | null>(null);

  // after existing refs
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size (accounting for toolbar and window borders)
    canvas.width = size.width - 16; // Account for window borders
    canvas.height = size.height - 80; // Account for titlebar and toolbar
    
    // Get context and set initial styles
    const context = canvas.getContext('2d');
    if (!context) return;
    
    // Enable image smoothing
    context.imageSmoothingEnabled = true;
    
    // Set default styles
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = selectedColor;
    context.lineWidth = brushSize;
    
    // Store context reference
    contextRef.current = context;

    // Load existing canvas data if any
    if (programState.canvasData) {
      const img = new Image();
      img.onload = () => {
        if (context) {
          context.drawImage(img, 0, 0);
        }
      };
      img.src = programState.canvasData;
    } else {
      // Fill with white if no existing data
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Setup overlay canvas
    const overlay = overlayCanvasRef.current;
    if (overlay) {
      overlay.width = canvas.width;
      overlay.height = canvas.height;
      const octx = overlay.getContext('2d');
      if (octx) {
        octx.lineCap = 'round';
        octx.lineJoin = 'round';
        overlayCtxRef.current = octx;
      }
    }
  }, [size, programState.canvasData, selectedColor, brushSize]);

  // Handle tool changes
  useEffect(() => {
    if (!contextRef.current) return;
    contextRef.current.strokeStyle = selectedColor;
    contextRef.current.lineWidth = brushSize;
  }, [selectedColor, brushSize]);

  // Helper to draw shapes
  const drawShape = useCallback((
    ctx: CanvasRenderingContext2D,
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
    shape: 'line' | 'rectangle' | 'circle',
    isPreview = false
  ) => {
    ctx.beginPath();
    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = brushSize;

    switch (shape) {
      case 'line':
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(endPoint.x, endPoint.y);
        break;
      
      case 'rectangle':
        const width = endPoint.x - startPoint.x;
        const height = endPoint.y - startPoint.y;
        ctx.rect(startPoint.x, startPoint.y, width, height);
        break;
      
      case 'circle':
        const centerX = (startPoint.x + endPoint.x) / 2;
        const centerY = (startPoint.y + endPoint.y) / 2;
        const radiusX = Math.abs(endPoint.x - startPoint.x) / 2;
        const radiusY = Math.abs(endPoint.y - startPoint.y) / 2;
        const rotation = 0;
        const startAngle = 0;
        const endAngle = 2 * Math.PI;
        ctx.ellipse(centerX, centerY, radiusX, radiusY, rotation, startAngle, endAngle);
        break;
    }

    ctx.stroke();
  }, [selectedColor, brushSize]);

  // Drawing functions
  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !contextRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Scale coordinates based on canvas size vs display size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const scaledX = x * scaleX;
    const scaledY = y * scaleY;

    if (selectedTool === 'fill') {
      floodFill(contextRef.current, Math.floor(scaledX), Math.floor(scaledY), selectedColor);
      const canvasData = canvas.toDataURL();
      dispatch(updateProgramState({
        windowId,
        newState: { canvasData }
      }));
      audioService.playSound('move');
      return;
    }

    // For shape tools, store start point
    if (['line', 'rectangle', 'circle'].includes(selectedTool)) {
      startPointRef.current = { x: scaledX, y: scaledY };
      if (overlayCtxRef.current) {
        overlayCtxRef.current.clearRect(0, 0, canvas.width, canvas.height);
      }
    } else {
      // Regular drawing tools
      contextRef.current.beginPath();
      contextRef.current.moveTo(scaledX, scaledY);
      
      // Set composite operation for eraser
      if (selectedTool === 'eraser') {
        contextRef.current.globalCompositeOperation = 'destination-out';
      } else {
        contextRef.current.globalCompositeOperation = 'source-over';
      }
    }

    isDrawingRef.current = true;
    lastPointRef.current = { x: scaledX, y: scaledY };
    audioService.playSound('move');
  }, [selectedTool, selectedColor, dispatch, windowId]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !contextRef.current || !canvasRef.current) return;
    if (selectedTool === 'fill') return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Scale coordinates
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const scaledX = x * scaleX;
    const scaledY = y * scaleY;

    // Shape drawing preview
    if (['line', 'rectangle', 'circle'].includes(selectedTool) && startPointRef.current) {
      const octx = overlayCtxRef.current;
      if (octx) {
        octx.clearRect(0, 0, canvas.width, canvas.height);
        drawShape(octx, startPointRef.current, { x: scaledX, y: scaledY }, selectedTool as any, true);
      }
    } else if (lastPointRef.current) {
      // Regular drawing
      const { x: lastX, y: lastY } = lastPointRef.current;
      contextRef.current.beginPath();
      contextRef.current.moveTo(lastX, lastY);
      contextRef.current.lineTo(scaledX, scaledY);
      contextRef.current.stroke();
    }

    lastPointRef.current = { x: scaledX, y: scaledY };

    // Throttled update for regular drawing
    if (!['line', 'rectangle', 'circle'].includes(selectedTool)) {
      const now = Date.now();
      if (now - lastUpdateRef.current >= UPDATE_INTERVAL) {
        const canvasData = canvas.toDataURL();
        dispatch(updateProgramState({
          windowId,
          newState: { canvasData }
        }));
        lastUpdateRef.current = now;
      }
    }
  }, [selectedTool, dispatch, windowId]);

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    if (selectedTool === 'fill') return;
    
    const canvas = canvasRef.current;
    
    // Finalize shape drawing
    if (['line', 'rectangle', 'circle'].includes(selectedTool) && 
        startPointRef.current && 
        lastPointRef.current && 
        contextRef.current) {
      // Draw final shape
      drawShape(
        contextRef.current,
        startPointRef.current,
        lastPointRef.current,
        selectedTool as any,
        false
      );
    }

    // ---- common cleanup for all tools ----
    isDrawingRef.current = false;
    lastPointRef.current = null;
    startPointRef.current = null;

    // Reset composite operation
    if (contextRef.current) {
      contextRef.current.globalCompositeOperation = 'source-over';
    }

    // Persist final canvas state
    const canvasData = canvas.toDataURL();
    dispatch(updateProgramState({
      windowId,
      newState: { canvasData }
    }));

    // Clear overlay (if any)
    if (overlayCtxRef.current) {
      overlayCtxRef.current.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [selectedTool, dispatch, windowId, drawShape]);

  // Tool selection handler
  const handleToolSelect = (tool: typeof programState.tool) => {
    setSelectedTool(tool);
    dispatch(updateProgramState({
      windowId,
      newState: { tool }
    }));
    audioService.playSound('move');
  };

  // Color selection handler
  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    dispatch(updateProgramState({
      windowId,
      newState: { color }
    }));
    audioService.playSound('move');
  };

  // Brush size handler
  const handleBrushSize = (size: number) => {
    setBrushSize(size);
    dispatch(updateProgramState({
      windowId,
      newState: { brushSize: size }
    }));
    audioService.playSound('move');
  };

  // Reset handler
  const handleReset = () => {
    if (!contextRef.current || !canvasRef.current) return;
    contextRef.current.setTransform(1,0,0,1,0,0);
    contextRef.current.clearRect(0,0,canvasRef.current.width, canvasRef.current.height);
    contextRef.current.fillStyle = '#FFFFFF';
    contextRef.current.fillRect(0,0,canvasRef.current.width, canvasRef.current.height);
    if (overlayCtxRef.current) {
      overlayCtxRef.current.clearRect(0,0,canvasRef.current.width, canvasRef.current.height);
    }
    const canvasData = canvasRef.current.toDataURL();
    dispatch(updateProgramState({windowId,newState:{canvasData}}));
  };

  // after stopDrawing definition add effect
  useEffect(() => {
      const handleUp = () => stopDrawing();
      window.addEventListener('mouseup', handleUp);
      return () => window.removeEventListener('mouseup', handleUp);
  }, [stopDrawing]);

  return (
    <ProgramWindow
      windowId={windowId}
      title="Paint"
      icon="🎨"
      position={position}
      size={size}
      zIndex={zIndex}
      isMinimized={isMinimized}
    >
      <div className="paint-container">
        {/* Toolbar */}
        <div className="paint-toolbar">
          <div className="tool-group">
            <button
              className={`win98-btn ${selectedTool === 'brush' ? 'active' : ''}`}
              onClick={() => handleToolSelect('brush')}
              title="Brush"
            >
              🖌️
            </button>
            <button
              className={`win98-btn ${selectedTool === 'eraser' ? 'active' : ''}`}
              onClick={() => handleToolSelect('eraser')}
              title="Eraser"
            >
              ⌫
            </button>
            <button
              className={`win98-btn ${selectedTool === 'fill' ? 'active' : ''}`}
              onClick={() => handleToolSelect('fill')}
              title="Fill"
            >
              🪣
            </button>
            <button
              className={`win98-btn ${selectedTool === 'line' ? 'active' : ''}`}
              onClick={() => handleToolSelect('line')}
              title="Line"
            >
              /
            </button>
            <button
              className={`win98-btn ${selectedTool === 'rectangle' ? 'active' : ''}`}
              onClick={() => handleToolSelect('rectangle')}
              title="Rectangle"
            >
              □
            </button>
            <button
              className={`win98-btn ${selectedTool === 'circle' ? 'active' : ''}`}
              onClick={() => handleToolSelect('circle')}
              title="Circle"
            >
              ○
            </button>
            <button className="win98-btn" onClick={handleReset} title="Reset Canvas">↺</button>
          </div>

          <div className="color-group">
            {WIN98_COLORS.map((color) => (
              <button
                key={color}
                className={`win98-btn ${selectedColor === color ? 'active' : ''}`}
                style={{ background: color }}
                onClick={() => handleColorSelect(color)}
                title={color}
              />
            ))}
          </div>

          <div className="size-group">
            <input
              type="range"
              min="1"
              max="32"
              value={brushSize}
              onChange={(e) => handleBrushSize(parseInt(e.target.value))}
            />
            <span>{brushSize}px</span>
          </div>
        </div>

        {/* Canvas */}
        <div className="paint-canvas-container">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            style={{
              width: '100%',
              height: '100%'
            }}
          />
        </div>

        {/* Overlay Canvas */}
        <canvas
          ref={overlayCanvasRef}
          className="overlay-canvas"
          style={{width:'100%',height:'100%',pointerEvents:'none',position:'absolute',left:0,top:0}}
        />
      </div>
    </ProgramWindow>
  );
};

export default Paint; 