import React, { useState, useEffect, useCallback } from 'react';
import ProgramWindow from '../ProgramWindow';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateProgramState } from '../../store/programSlice';
import { setGamingState, setSittingState } from '../../store/playerSlice';

interface SudokuState {
  gameState: 'title' | 'playing' | 'gameOver';
  board: Cell[][];
  difficulty: 'easy' | 'medium' | 'hard';
  startTime: number | null;
  endTime: number | null;
  isCompleted: boolean;
}

interface SudokuProps {
  windowId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  programState: SudokuState;
  controllerId: string;
  currentPlayerId: string;
}

type Cell = { value: number; readonly: boolean };

const INTERACTION_RANGE = 80;

// Very easy demo puzzle (0 = blank)
const DEFAULT_PUZZLE: number[][] = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9],
];

const PRESET_PUZZLES: number[][][] = [
  DEFAULT_PUZZLE,
  [
    [0,0,0,2,6,0,7,0,1],
    [6,8,0,0,7,0,0,9,0],
    [1,9,0,0,0,4,5,0,0],
    [8,2,0,1,0,0,0,4,0],
    [0,0,4,6,0,2,9,0,0],
    [0,5,0,0,0,3,0,2,8],
    [0,0,9,3,0,0,0,7,4],
    [0,4,0,0,5,0,0,3,6],
    [7,0,3,0,1,8,0,0,0],
  ],
  [
    [0,2,0,6,0,8,0,0,0],
    [5,8,0,0,0,9,7,0,0],
    [0,0,0,0,4,0,0,0,0],
    [3,7,0,0,0,0,5,0,0],
    [6,0,0,0,0,0,0,0,4],
    [0,0,8,0,0,0,0,1,3],
    [0,0,0,0,2,0,0,0,0],
    [0,0,9,8,0,0,0,3,6],
    [0,0,0,3,0,6,0,9,0],
  ],
];

const buildBoardFromPuzzle = (puzzle: number[][]): Cell[][] =>
  puzzle.map((row) =>
    row.map((v) => ({ value: v, readonly: v !== 0 }))
  );

const Sudoku: React.FC<SudokuProps> = ({
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
  const isController = controllerId === currentPlayerId;

  // Player position for proximity detection
  const playerPosition = useAppSelector((state: any) => state.player?.position || { x: 0, y: 0 });
  const isPlayerNearby = (() => {
    const playerCenterX = playerPosition.x + 80;
    const playerCenterY = playerPosition.y + 80;

    const windowLeft = position.x;
    const windowRight = position.x + size.width;
    const windowTop = position.y;
    const windowBottom = position.y + size.height;

    const closestX = Math.max(windowLeft, Math.min(playerCenterX, windowRight));
    const closestY = Math.max(windowTop, Math.min(playerCenterY, windowBottom));

    const dist = Math.sqrt((closestX - playerCenterX) ** 2 + (closestY - playerCenterY) ** 2);
    return dist <= INTERACTION_RANGE;
  })();

  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [difficultySelection, setDifficultySelection] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [invalidCells, setInvalidCells] = useState<Set<string>>(new Set());

  // Initialize game state if not exists
  const gameState = programState.gameState || 'title';
  const board = programState.board || buildBoardFromPuzzle(DEFAULT_PUZZLE);

  const updateGameState = useCallback((newState: Partial<SudokuState>) => {
    dispatch(updateProgramState({
      windowId,
      newState,
    }));
  }, [dispatch, windowId]);

  const startGame = () => {
    const puzzle = PRESET_PUZZLES[Math.floor(Math.random() * PRESET_PUZZLES.length)];
    const newBoard = buildBoardFromPuzzle(puzzle);
    
    // Clear any previous invalid cells
    setInvalidCells(new Set());
    setSelected(null);
    
    updateGameState({
      gameState: 'playing',
      board: newBoard,
      difficulty: difficultySelection,
      startTime: Date.now(),
      endTime: null,
      isCompleted: false,
    });

    // Set gaming state for player
    dispatch(setSittingState(true));
    dispatch(setGamingState({ isGaming: true }));
  };

  const findInvalidCells = useCallback((board: Cell[][]): Set<string> => {
    const invalid = new Set<string>();

    // Check rows
    for (let row = 0; row < 9; row++) {
      const seen = new Map<number, number>();
      for (let col = 0; col < 9; col++) {
        const value = board[row][col].value;
        if (value !== 0) {
          if (seen.has(value)) {
            // Mark both conflicting cells as invalid
            invalid.add(`${row}-${seen.get(value)}`);
            invalid.add(`${row}-${col}`);
          } else {
            seen.set(value, col);
          }
        }
      }
    }

    // Check columns
    for (let col = 0; col < 9; col++) {
      const seen = new Map<number, number>();
      for (let row = 0; row < 9; row++) {
        const value = board[row][col].value;
        if (value !== 0) {
          if (seen.has(value)) {
            // Mark both conflicting cells as invalid
            invalid.add(`${seen.get(value)}-${col}`);
            invalid.add(`${row}-${col}`);
          } else {
            seen.set(value, row);
          }
        }
      }
    }

    // Check 3x3 boxes
    for (let boxRow = 0; boxRow < 3; boxRow++) {
      for (let boxCol = 0; boxCol < 3; boxCol++) {
        const seen = new Map<number, { row: number; col: number }>();
        for (let row = boxRow * 3; row < boxRow * 3 + 3; row++) {
          for (let col = boxCol * 3; col < boxCol * 3 + 3; col++) {
            const value = board[row][col].value;
            if (value !== 0) {
              if (seen.has(value)) {
                // Mark both conflicting cells as invalid
                const prev = seen.get(value)!;
                invalid.add(`${prev.row}-${prev.col}`);
                invalid.add(`${row}-${col}`);
              } else {
                seen.set(value, { row, col });
              }
            }
          }
        }
      }
    }

    return invalid;
  }, []);

  const isValidSudoku = useCallback((board: Cell[][]): boolean => {
    // Check if board is complete first
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row][col].value === 0) return false;
      }
    }

    // Validate rows
    for (let row = 0; row < 9; row++) {
      const seen = new Set<number>();
      for (let col = 0; col < 9; col++) {
        const value = board[row][col].value;
        if (value < 1 || value > 9 || seen.has(value)) {
          return false;
        }
        seen.add(value);
      }
    }

    // Validate columns
    for (let col = 0; col < 9; col++) {
      const seen = new Set<number>();
      for (let row = 0; row < 9; row++) {
        const value = board[row][col].value;
        if (value < 1 || value > 9 || seen.has(value)) {
          return false;
        }
        seen.add(value);
      }
    }

    // Validate 3x3 boxes
    for (let boxRow = 0; boxRow < 3; boxRow++) {
      for (let boxCol = 0; boxCol < 3; boxCol++) {
        const seen = new Set<number>();
        for (let row = boxRow * 3; row < boxRow * 3 + 3; row++) {
          for (let col = boxCol * 3; col < boxCol * 3 + 3; col++) {
            const value = board[row][col].value;
            if (value < 1 || value > 9 || seen.has(value)) {
              return false;
            }
            seen.add(value);
          }
        }
      }
    }

    return true;
  }, []);

  const checkWin = useCallback((currentBoard: Cell[][]) => {
    if (isValidSudoku(currentBoard)) {
      updateGameState({
        gameState: 'gameOver',
        endTime: Date.now(),
        isCompleted: true,
      });

      dispatch(setGamingState({ isGaming: false }));
      dispatch(setSittingState(false));
      return true;
    }
    return false;
  }, [isValidSudoku, updateGameState, dispatch]);

  // Keyboard handling for menu navigation and starting game
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlayerNearby) return;

      if (gameState === 'title' && isController) {
        if (['ArrowUp', 'w', 'W'].includes(e.key)) {
          e.preventDefault();
          setDifficultySelection(prev => 
            prev === 'hard' ? 'medium' : prev === 'medium' ? 'easy' : 'easy'
          );
        } else if (['ArrowDown', 's', 'S'].includes(e.key)) {
          e.preventDefault();
          setDifficultySelection(prev => 
            prev === 'easy' ? 'medium' : prev === 'medium' ? 'hard' : 'hard'
          );
        } else if (['e', 'Enter'].includes(e.key)) {
          e.preventDefault();
          startGame();
        }
             } else if (gameState === 'gameOver' && isController) {
         if (['e', 'Enter'].includes(e.key)) {
           e.preventDefault();
           setInvalidCells(new Set());
           setSelected(null);
           updateGameState({ gameState: 'title' });
           dispatch(setGamingState({ isGaming: false }));
           dispatch(setSittingState(false));
         }
       }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isPlayerNearby, isController, difficultySelection, updateGameState, dispatch]);

  // Cleanup gaming state when component unmounts or window closes
  useEffect(() => {
    return () => {
      if (isController && (gameState === 'playing')) {
        dispatch(setGamingState({ isGaming: false }));
        dispatch(setSittingState(false));
      }
    };
  }, [isController, gameState, dispatch]);

  // Game input handling
  const handleCellClick = (r: number, c: number) => {
    if (!isController || gameState !== 'playing') return;
    setSelected({ row: r, col: c });
  };

  const handleGameKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isController || !selected || gameState !== 'playing') return;
      
      let num: number;
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        num = 0;
      } else {
        num = parseInt(e.key, 10);
        if (isNaN(num) || num < 1 || num > 9) return;
      }

      const newBoard = board.map((row) => row.map((cell) => ({ ...cell })));
      const cell = newBoard[selected.row][selected.col];
      if (cell.readonly) return;
      
      cell.value = num;
      
      // Update invalid cells for visual feedback
      const newInvalidCells = findInvalidCells(newBoard);
      setInvalidCells(newInvalidCells);
      
      updateGameState({ board: newBoard });
      
      // Check for win condition only if no invalid cells
      if (newInvalidCells.size === 0) {
        setTimeout(() => checkWin(newBoard), 100);
      }
    },
         [isController, selected, gameState, board, updateGameState, checkWin, findInvalidCells]
  );

  useEffect(() => {
    if (gameState === 'playing') {
      window.addEventListener('keydown', handleGameKeyDown);
      return () => window.removeEventListener('keydown', handleGameKeyDown);
    }
  }, [handleGameKeyDown, gameState]);

  const getWindowTitle = () => {
    switch (gameState) {
      case 'title':
        return 'Sudoku';
      case 'playing':
        return `Sudoku - ${programState.difficulty || 'easy'}`;
      case 'gameOver':
        return 'Sudoku - Complete!';
      default:
        return 'Sudoku';
    }
  };

  const renderContent = () => {
    if (gameState === 'title') {
      return (
        <div style={{ 
          padding: '40px 20px', 
          fontFamily: 'Better VCR, monospace', 
          textAlign: 'center',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #004400, #008800)'
        }}>
          <div style={{ 
            fontSize: '32px', 
            fontWeight: 'bold', 
            color: '#00ff88',
            marginBottom: '20px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
          }}>
            🔢 SUDOKU
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: '#ffffff',
            marginBottom: '30px',
            lineHeight: '1.6'
          }}>
            Fill the 9×9 grid with digits 1-9<br/>
            Each row, column, and 3×3 box must contain all digits<br/>
            Click a cell and type a number to fill it
          </div>
          
          <div style={{ marginBottom: '30px' }}>
            <div style={{ color: '#ffffff', marginBottom: '10px', fontSize: '14px' }}>
              Select Difficulty (↑/↓):
            </div>
            <div style={{ fontSize: '16px' }}>
              <div style={{ 
                color: difficultySelection === 'easy' ? '#00ff88' : '#aaaaaa',
                fontWeight: difficultySelection === 'easy' ? 'bold' : 'normal'
              }}>
                {difficultySelection === 'easy' ? '▶ ' : '  '}Easy
              </div>
              <div style={{ 
                color: difficultySelection === 'medium' ? '#00ff88' : '#aaaaaa',
                fontWeight: difficultySelection === 'medium' ? 'bold' : 'normal'
              }}>
                {difficultySelection === 'medium' ? '▶ ' : '  '}Medium
              </div>
              <div style={{ 
                color: difficultySelection === 'hard' ? '#00ff88' : '#aaaaaa',
                fontWeight: difficultySelection === 'hard' ? 'bold' : 'normal'
              }}>
                {difficultySelection === 'hard' ? '▶ ' : '  '}Hard
              </div>
            </div>
          </div>

          <div style={{ 
            fontSize: '16px', 
            fontWeight: 'bold', 
            color: '#ffff00',
            padding: '10px 20px',
            border: '2px solid #ffff00',
            borderRadius: '4px',
            backgroundColor: 'rgba(255,255,0,0.1)'
          }}>
            PRESS E TO START
          </div>
          {!isController && (
            <div style={{ 
              marginTop: '20px', 
              fontSize: '12px', 
              color: '#ff6666' 
            }}>
              Only {controllerId} can start the game
            </div>
          )}
        </div>
      );
    }

    if (gameState === 'gameOver') {
      const playTime = programState.startTime && programState.endTime 
        ? Math.floor((programState.endTime - programState.startTime) / 1000)
        : 0;
      const minutes = Math.floor(playTime / 60);
      const seconds = playTime % 60;

      return (
        <div style={{ 
          padding: '40px 20px', 
          fontFamily: 'Better VCR, monospace', 
          textAlign: 'center',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #440044, #880088)'
        }}>
          <div style={{ 
            fontSize: '28px', 
            fontWeight: 'bold', 
            color: '#ff88ff',
            marginBottom: '20px'
          }}>
            🎉 CONGRATULATIONS!
          </div>
          <div style={{ 
            fontSize: '18px', 
            color: '#ffffff',
            marginBottom: '10px'
          }}>
            Puzzle Completed!
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: '#ffffff',
            marginBottom: '20px'
          }}>
            Time: {minutes}:{seconds.toString().padStart(2, '0')}
          </div>
          {isController && (
            <div style={{ 
              fontSize: '14px', 
              color: '#ffff00',
              padding: '10px 20px',
              border: '2px solid #ffff00',
              borderRadius: '4px',
              backgroundColor: 'rgba(255,255,0,0.1)'
            }}>
              PRESS E TO PLAY AGAIN
            </div>
          )}
        </div>
      );
    }

    // Playing state - show the game board
    return (
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(9, 35px)',
            gridTemplateRows: 'repeat(9, 35px)',
            marginBottom: '10px'
          }}
        >
          {board.map((row, r) => row.map((cell, c) => renderCell(cell, r, c)))}
        </div>
        
        {/* Status messages */}
        {invalidCells.size > 0 && (
          <div style={{ 
            textAlign: 'center', 
            fontSize: '12px',
            color: '#cc0000',
            fontFamily: 'Better VCR, monospace',
            marginBottom: '5px'
          }}>
            ⚠️ Invalid cells highlighted in red
          </div>
        )}
        
        {!isController && (
          <div style={{ 
            textAlign: 'center', 
            fontSize: '10px',
            color: '#666'
          }}>
            Read-only – {controllerId} controls
          </div>
        )}
        
        {isController && gameState === 'playing' && (
          <div style={{ 
            textAlign: 'center', 
            fontSize: '10px',
            color: '#666',
            fontFamily: 'Better VCR, monospace'
          }}>
            Click a cell and type 1-9 • Backspace to clear
          </div>
        )}
      </div>
    );
  };

  /* -------------------- rendering helpers -------------------- */
  const thick = '#000';
  const thin = '#666';

  const renderCell = (cell: Cell, r: number, c: number) => {
    const isSelected = selected?.row === r && selected?.col === c;
    const isInvalid = invalidCells.has(`${r}-${c}`);

    // Decide border thickness to delineate 3×3 sub-blocks
    const borderLeft = c % 3 === 0 ? `2px solid ${thick}` : `1px solid ${thin}`;
    const borderTop = r % 3 === 0 ? `2px solid ${thick}` : `1px solid ${thin}`;
    const borderRight = c === 8 ? `2px solid ${thick}` : 'none';
    const borderBottom = r === 8 ? `2px solid ${thick}` : 'none';

    let border = undefined;
    let background = cell.readonly ? '#e0e0e0' : '#fff';
    let color = '#000';

    if (isSelected) {
      border = `2px solid #2196f3`;
    } else if (isInvalid) {
      background = cell.readonly ? '#ffcccc' : '#ffe6e6';
      color = '#cc0000';
    }

    return (
      <div
        key={`${r}-${c}`}
        onClick={() => handleCellClick(r, c)}
        style={{
          width: 35,
          height: 35,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
          cursor: isController && !cell.readonly && gameState === 'playing' ? 'pointer' : 'default',
          background,
          color,
          fontFamily: 'Better VCR, monospace',
          fontSize: 18,
          fontWeight: isInvalid ? 'bold' : 'normal',
          border,
          borderLeft,
          borderTop,
          borderRight,
          borderBottom,
        }}
      >
        {cell.value !== 0 ? cell.value : ''}
      </div>
    );
  };

  return (
    <ProgramWindow
      windowId={windowId}
      title={getWindowTitle()}
      icon="🔢"
      position={position}
      size={size}
      zIndex={zIndex}
      isMinimized={isMinimized}
      isResizable={true}
    >
      {renderContent()}
    </ProgramWindow>
  );
};

export default Sudoku; 