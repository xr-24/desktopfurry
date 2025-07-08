import React, { useState, useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateProgramState } from '../../store/programSlice';
import ProgramWindow from '../ProgramWindow';
import { audioService } from '../../services/audioService';

interface CheckersProps {
  windowId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
  programState: {
    board: Array<Array<{ color: 'red' | 'black'; isKing: boolean } | null>>;
    currentPlayer: 'red' | 'black';
    selectedPiece: { row: number; col: number } | null;
    gamePhase: 'setup' | 'playing' | 'finished';
    redPlayer: string | null;
    blackPlayer: string | null;
    winner: 'red' | 'black' | null;
    validMoves: Array<{ row: number; col: number; captures?: Array<{ row: number; col: number }> }>;
    redPieces: number;
    blackPieces: number;
    lastMove: { from: { row: number; col: number }; to: { row: number; col: number } } | null;
  };
  controllerId: string;
  currentPlayerId: string;
}

const INTERACTION_RANGE = 80;

const Checkers: React.FC<CheckersProps> = ({
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
  
  // Check if player is nearby
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

  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  // Initialize state with defaults
  const board = programState.board || [];
  const currentPlayer = programState.currentPlayer || 'red';
  const selectedPiece = programState.selectedPiece || null;
  const gamePhase = programState.gamePhase || 'setup';
  const redPlayer = programState.redPlayer || null;
  const blackPlayer = programState.blackPlayer || null;
  const winner = programState.winner || null;
  const validMoves = programState.validMoves || [];
  const redPieces = programState.redPieces || 12;
  const blackPieces = programState.blackPieces || 12;
  const lastMove = programState.lastMove || null;

  // Determine player's assigned color and if they can interact
  const playerColor = redPlayer === currentPlayerId ? 'red' : blackPlayer === currentPlayerId ? 'black' : null;
  const isPlayersTurn = playerColor === currentPlayer;
  const canInteract = isPlayerNearby && playerColor && isPlayersTurn && gamePhase === 'playing';

  const updateGameState = useCallback((newState: any) => {
    dispatch(updateProgramState({
      windowId,
      newState,
    }));
  }, [dispatch, windowId]);

  const joinAsRed = useCallback(() => {
    if (!redPlayer && currentPlayerId) {
      updateGameState({
        redPlayer: currentPlayerId,
      });
    }
  }, [redPlayer, currentPlayerId, updateGameState]);

  const joinAsBlack = useCallback(() => {
    if (!blackPlayer && currentPlayerId) {
      updateGameState({
        blackPlayer: currentPlayerId,
      });
    }
  }, [blackPlayer, currentPlayerId, updateGameState]);

  const startGame = useCallback(() => {
    if (redPlayer && blackPlayer) {
      updateGameState({
        gamePhase: 'playing',
        currentPlayer: 'red',
        selectedPiece: null,
        validMoves: [],
        winner: null,
        redPieces: 12,
        blackPieces: 12,
        lastMove: null,
      });
    }
  }, [redPlayer, blackPlayer, updateGameState]);

  const leaveGame = useCallback(() => {
    if (currentPlayerId === redPlayer) {
      updateGameState({
        redPlayer: null,
        gamePhase: 'setup',
      });
    } else if (currentPlayerId === blackPlayer) {
      updateGameState({
        blackPlayer: null,
        gamePhase: 'setup',
      });
    }
  }, [currentPlayerId, redPlayer, blackPlayer, updateGameState]);

  const resetGame = useCallback(() => {
    // Re-initialize the board
    const newBoard = Array(8).fill(null).map(() => Array(8).fill(null));
    
    // Place red pieces (top)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          newBoard[row][col] = { color: 'red', isKing: false };
        }
      }
    }
    
    // Place black pieces (bottom)
    for (let row = 5; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          newBoard[row][col] = { color: 'black', isKing: false };
        }
      }
    }

    updateGameState({
      board: newBoard,
      gamePhase: 'setup',
      currentPlayer: 'red',
      selectedPiece: null,
      validMoves: [],
      winner: null,
      redPlayer: null,
      blackPlayer: null,
      redPieces: 12,
      blackPieces: 12,
      lastMove: null,
    });
  }, [updateGameState]);

  const isValidSquare = (row: number, col: number): boolean => {
    return (row + col) % 2 === 1; // Only dark squares
  };

  const isInBounds = (row: number, col: number): boolean => {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  };

  const getValidMoves = useCallback((board: any[][], row: number, col: number) => {
    const piece = board[row][col];
    if (!piece) return [];

    const moves: Array<{ row: number; col: number; captures?: Array<{ row: number; col: number }> }> = [];
    const directions = piece.isKing
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] // Kings can move in all directions
      : piece.color === 'red'
      ? [[1, -1], [1, 1]] // Red moves down
      : [[-1, -1], [-1, 1]]; // Black moves up

    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;

      if (!isInBounds(newRow, newCol) || !isValidSquare(newRow, newCol)) continue;

      if (!board[newRow][newCol]) {
        // Empty square - simple move
        moves.push({ row: newRow, col: newCol });
      } else if (board[newRow][newCol].color !== piece.color) {
        // Enemy piece - check for capture
        const jumpRow = newRow + dr;
        const jumpCol = newCol + dc;

        if (isInBounds(jumpRow, jumpCol) && isValidSquare(jumpRow, jumpCol) && !board[jumpRow][jumpCol]) {
          moves.push({
            row: jumpRow,
            col: jumpCol,
            captures: [{ row: newRow, col: newCol }]
          });
        }
      }
    }

    return moves;
  }, []);

  const getMultiJumpCaptures = useCallback((board: any[][], startRow: number, startCol: number, visited: Set<string> = new Set()): Array<{ row: number; col: number; captures: Array<{ row: number; col: number }> }> => {
    const piece = board[startRow][startCol];
    if (!piece) return [];

    const allMoves: Array<{ row: number; col: number; captures: Array<{ row: number; col: number }> }> = [];
    const directions = piece.isKing
      ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
      : piece.color === 'red'
      ? [[1, -1], [1, 1]]
      : [[-1, -1], [-1, 1]];

    for (const [dr, dc] of directions) {
      const enemyRow = startRow + dr;
      const enemyCol = startCol + dc;
      const landRow = startRow + 2 * dr;
      const landCol = startCol + 2 * dc;

      if (!isInBounds(enemyRow, enemyCol) || !isInBounds(landRow, landCol)) continue;
      if (!isValidSquare(landRow, landCol)) continue;

      const enemy = board[enemyRow][enemyCol];
      if (!enemy || enemy.color === piece.color) continue;
      if (board[landRow][landCol]) continue;

      const captureKey = `${enemyRow}-${enemyCol}`;
      if (visited.has(captureKey)) continue;

      // Create a temporary board for further jumps
      const tempBoard = board.map(row => [...row]);
      tempBoard[landRow][landCol] = piece;
      tempBoard[startRow][startCol] = null;
      tempBoard[enemyRow][enemyCol] = null;

      const newVisited = new Set(visited);
      newVisited.add(captureKey);

      // Check for additional jumps
      const furtherCaptures = getMultiJumpCaptures(tempBoard, landRow, landCol, newVisited);

      if (furtherCaptures.length > 0) {
        // Add multi-jump sequences
        for (const furtherCapture of furtherCaptures) {
          allMoves.push({
            row: furtherCapture.row,
            col: furtherCapture.col,
            captures: [{ row: enemyRow, col: enemyCol }, ...furtherCapture.captures]
          });
        }
      } else {
        // Single capture
        allMoves.push({
          row: landRow,
          col: landCol,
          captures: [{ row: enemyRow, col: enemyCol }]
        });
      }
    }

    return allMoves;
  }, []);

  const makeMove = useCallback((fromRow: number, fromCol: number, toRow: number, toCol: number, captures?: Array<{ row: number; col: number }>) => {
    const newBoard = board.map(row => [...row]);
    const piece = newBoard[fromRow][fromCol];
    
    if (!piece) return;

    // Move piece
    newBoard[toRow][toCol] = { ...piece };
    newBoard[fromRow][fromCol] = null;

    // Check for king promotion
    if (!piece.isKing) {
      if ((piece.color === 'red' && toRow === 7) || (piece.color === 'black' && toRow === 0)) {
        newBoard[toRow][toCol]!.isKing = true;
      }
    }

    // Remove captured pieces
    let newRedPieces = redPieces;
    let newBlackPieces = blackPieces;
    
    if (captures) {
      for (const capture of captures) {
        const capturedPiece = newBoard[capture.row][capture.col];
        if (capturedPiece) {
          if (capturedPiece.color === 'red') newRedPieces--;
          else newBlackPieces--;
          newBoard[capture.row][capture.col] = null;
        }
      }
    }

    // Check for game over
    let newWinner = null;
    let newGamePhase = gamePhase;
    
    if (newRedPieces === 0) {
      newWinner = 'black';
      newGamePhase = 'finished';
    } else if (newBlackPieces === 0) {
      newWinner = 'red';
      newGamePhase = 'finished';
    }

    // Switch players
    const nextPlayer = currentPlayer === 'red' ? 'black' : 'red';

    updateGameState({
      board: newBoard,
      currentPlayer: nextPlayer,
      selectedPiece: null,
      validMoves: [],
      redPieces: newRedPieces,
      blackPieces: newBlackPieces,
      winner: newWinner,
      gamePhase: newGamePhase,
      lastMove: { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } }
    });

    // Play move sound
    audioService.playSound('move');
  }, [board, currentPlayer, redPieces, blackPieces, gamePhase, updateGameState]);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (!canInteract || winner) return;

    const piece = board[row][col];

    if (selectedPiece) {
      // Try to move selected piece
      const validMove = validMoves.find(move => move.row === row && move.col === col);
      if (validMove) {
        makeMove(selectedPiece.row, selectedPiece.col, row, col, validMove.captures);
      } else {
        // Select new piece or deselect
        if (piece && piece.color === playerColor) {
          const moves = getValidMoves(board, row, col);
          updateGameState({
            selectedPiece: { row, col },
            validMoves: moves,
          });
        } else {
          updateGameState({
            selectedPiece: null,
            validMoves: [],
          });
        }
      }
    } else {
      // Select piece - only allow selecting own pieces
      if (piece && piece.color === playerColor) {
        const moves = getValidMoves(board, row, col);
        updateGameState({
          selectedPiece: { row, col },
          validMoves: moves,
        });
      }
    }
  }, [canInteract, winner, board, selectedPiece, validMoves, playerColor, getValidMoves, makeMove, updateGameState]);

  const renderBoard = () => {
    const cellSize = Math.min((size.width - 40) / 8, (size.height - 80) / 8);
    
    return (
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gridTemplateRows: 'repeat(8, 1fr)',
          width: cellSize * 8,
          height: cellSize * 8,
          border: '2px solid #8B4513',
          margin: '10px auto',
          backgroundColor: '#DEB887'
        }}
      >
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isSelected = selectedPiece?.row === rowIndex && selectedPiece?.col === colIndex;
            const isValidMove = validMoves.some(move => move.row === rowIndex && move.col === colIndex);
            const isLastMoveSquare = lastMove && 
              ((lastMove.from.row === rowIndex && lastMove.from.col === colIndex) || 
               (lastMove.to.row === rowIndex && lastMove.to.col === colIndex));
            const isHovered = hoveredCell?.row === rowIndex && hoveredCell?.col === colIndex;
            const isDarkSquare = isValidSquare(rowIndex, colIndex);

            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: isDarkSquare ? 
                    (isSelected ? '#FFD700' : isLastMoveSquare ? '#98FB98' : '#8B4513') : 
                    '#DEB887',
                  border: isValidMove ? '2px solid #00FF00' : isHovered ? '2px solid #FFD700' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canInteract ? 'pointer' : 'default',
                  position: 'relative',
                }}
                onClick={() => handleCellClick(rowIndex, colIndex)}
                onMouseEnter={() => setHoveredCell({ row: rowIndex, col: colIndex })}
                onMouseLeave={() => setHoveredCell(null)}
              >
                {cell && (
                  <div
                    style={{
                      width: cellSize * 0.8,
                      height: cellSize * 0.8,
                      borderRadius: '50%',
                      backgroundColor: cell.color === 'red' ? '#FF4500' : '#2F4F4F',
                      border: `2px solid ${cell.color === 'red' ? '#8B0000' : '#000000'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: cellSize * 0.4,
                      fontWeight: 'bold',
                      color: 'white',
                      textShadow: '1px 1px 1px rgba(0,0,0,0.5)',
                    }}
                  >
                    {cell.isKing ? '♔' : ''}
                  </div>
                )}
                {isValidMove && (
                  <div
                    style={{
                      position: 'absolute',
                      width: cellSize * 0.3,
                      height: cellSize * 0.3,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(0, 255, 0, 0.6)',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  if (isMinimized) return null;

  return (
    <ProgramWindow
      windowId={windowId}
      title="Checkers"
      icon="🔴"
      position={position}
      size={size}
      zIndex={zIndex}
      isMinimized={isMinimized}
    >
      <div style={{ 
        padding: '10px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f0f0f0',
        fontFamily: 'Better VCR, monospace',
        overflow: 'hidden'
      }}>
        {/* Game Status */}
        <div style={{
          textAlign: 'center',
          marginBottom: '10px',
          fontSize: '14px',
          minHeight: '90px',
        }}>
          {gamePhase === 'setup' && (
            <div>
              <div style={{ marginBottom: '8px', fontSize: '16px', fontWeight: 'bold' }}>Welcome to Checkers!</div>
              
              {/* Player assignments */}
              <div style={{ marginBottom: '8px', fontSize: '12px' }}>
                <div style={{ marginBottom: '4px' }}>
                  🔴 Red Player: {redPlayer ? `Player ${redPlayer.slice(-4)}` : 'Waiting...'}
                  {!redPlayer && isPlayerNearby && (
                    <button 
                      onClick={joinAsRed}
                      style={{
                        marginLeft: '8px',
                        padding: '2px 8px',
                        fontSize: '10px',
                        backgroundColor: '#FF4500',
                        color: 'white',
                        border: '1px solid #8B0000',
                        cursor: 'pointer'
                      }}
                    >
                      Join as Red
                    </button>
                  )}
                  {redPlayer === currentPlayerId && (
                    <button 
                      onClick={leaveGame}
                      style={{
                        marginLeft: '8px',
                        padding: '2px 8px',
                        fontSize: '10px',
                        backgroundColor: '#c0c0c0',
                        border: '1px solid #666',
                        cursor: 'pointer'
                      }}
                    >
                      Leave
                    </button>
                  )}
                </div>
                <div style={{ marginBottom: '4px' }}>
                  ⚫ Black Player: {blackPlayer ? `Player ${blackPlayer.slice(-4)}` : 'Waiting...'}
                  {!blackPlayer && isPlayerNearby && (
                    <button 
                      onClick={joinAsBlack}
                      style={{
                        marginLeft: '8px',
                        padding: '2px 8px',
                        fontSize: '10px',
                        backgroundColor: '#2F4F4F',
                        color: 'white',
                        border: '1px solid #000',
                        cursor: 'pointer'
                      }}
                    >
                      Join as Black
                    </button>
                  )}
                  {blackPlayer === currentPlayerId && (
                    <button 
                      onClick={leaveGame}
                      style={{
                        marginLeft: '8px',
                        padding: '2px 8px',
                        fontSize: '10px',
                        backgroundColor: '#c0c0c0',
                        border: '1px solid #666',
                        cursor: 'pointer'
                      }}
                    >
                      Leave
                    </button>
                  )}
                </div>
              </div>

              {redPlayer && blackPlayer ? (
                <button 
                  onClick={startGame}
                  style={{
                    padding: '5px 15px',
                    fontSize: '12px',
                    backgroundColor: '#90EE90',
                    border: '2px outset #90EE90',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Start Game
                </button>
              ) : (
                <div style={{ fontSize: '11px', color: '#666' }}>
                  Waiting for both players to join...
                </div>
              )}

              {!isPlayerNearby && (
                <div style={{ fontSize: '10px', color: '#666', marginTop: '5px' }}>
                  Move closer to join the game
                </div>
              )}
            </div>
          )}
          
          {gamePhase === 'playing' && !winner && (
            <div>
              <div style={{ 
                color: currentPlayer === 'red' ? '#FF4500' : '#2F4F4F',
                fontWeight: 'bold',
                marginBottom: '5px',
                fontSize: '16px'
              }}>
                {currentPlayer.toUpperCase()}'s Turn
              </div>
              
              <div style={{ fontSize: '12px', marginBottom: '5px' }}>
                🔴 {redPlayer ? `Player ${redPlayer.slice(-4)}` : 'Empty'} | 
                ⚫ {blackPlayer ? `Player ${blackPlayer.slice(-4)}` : 'Empty'}
              </div>
              
              <div style={{ fontSize: '12px', marginBottom: '5px' }}>
                Red: {redPieces} pieces | Black: {blackPieces} pieces
              </div>

              {playerColor && (
                <div style={{ 
                  fontSize: '11px', 
                  color: playerColor === 'red' ? '#FF4500' : '#2F4F4F',
                  fontWeight: 'bold'
                }}>
                  You are {playerColor === 'red' ? '🔴 Red' : '⚫ Black'}
                  {isPlayersTurn ? ' - Your turn!' : ' - Wait for your turn'}
                </div>
              )}

              {!playerColor && isPlayerNearby && (
                <div style={{ fontSize: '10px', color: '#666' }}>
                  You are spectating this game
                </div>
              )}

              {!isPlayerNearby && (
                <div style={{ fontSize: '10px', color: '#666' }}>
                  Move closer to interact
                </div>
              )}
            </div>
          )}
          
          {winner && (
            <div>
              <div style={{ 
                color: winner === 'red' ? '#FF4500' : '#2F4F4F',
                fontWeight: 'bold',
                fontSize: '18px',
                marginBottom: '5px'
              }}>
                {winner === 'red' ? '🔴' : '⚫'} {winner.toUpperCase()} WINS!
              </div>
              <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                Winner: {winner === 'red' ? 
                  (redPlayer ? `Player ${redPlayer.slice(-4)}` : 'Red Player') : 
                  (blackPlayer ? `Player ${blackPlayer.slice(-4)}` : 'Black Player')
                }
              </div>
              <button 
                onClick={resetGame}
                style={{
                  padding: '5px 15px',
                  fontSize: '12px',
                  backgroundColor: '#c0c0c0',
                  border: '2px outset #c0c0c0',
                  cursor: 'pointer'
                }}
              >
                New Game
              </button>
            </div>
          )}
        </div>

        {/* Game Board */}
        <div style={{ 
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden'
        }}>
          {renderBoard()}
        </div>

        {/* Instructions */}
        <div style={{
          fontSize: '10px',
          color: '#666',
          textAlign: 'center',
          marginTop: '5px',
          lineHeight: '1.2'
        }}>
          True Multiplayer - Join as Red or Black • Only move your pieces on your turn
        </div>
      </div>
    </ProgramWindow>
  );
};

export default Checkers; 