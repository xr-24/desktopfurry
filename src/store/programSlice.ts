import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ProgramWindow {
  id: string;
  type: 'paint' | 'notepad' | 'winamp' | 'checkers' | 'snake' | 'pong' | 'characterEditor' | 'bdemediaplayer' | 'browser98' | 'terminal' | 'inventory' | 'breakout' | 'sudoku' | 'shop' | 'dexdirectory' | 'seabuddy';
  isOpen: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isMinimized: boolean;
  zIndex: number;
  controllerId: string; // Player who opened/controls it
  isMultiplayer: boolean; // Whether all players can interact
  state: any; // Program-specific state
}

interface ProgramState {
  openPrograms: { [windowId: string]: ProgramWindow };
  highestZIndex: number;
  interactionRange: number; // Pixels for E key interaction
  backgroundId: string;
}

const initialState: ProgramState = {
  openPrograms: {},
  highestZIndex: 100,
  interactionRange: 80,
  backgroundId: 'sandstone',
};

const programSlice = createSlice({
  name: 'programs',
  initialState,
  reducers: {
    openProgram: (state, action: PayloadAction<{
      type: ProgramWindow['type'];
      controllerId: string;
      position?: { x: number; y: number };
    }>) => {
      const { type, controllerId, position } = action.payload;
      const windowId = `${type}-${Date.now()}`;
      
      // Default program configurations
      const programConfigs = {
        paint: { width: 500, height: 400, isMultiplayer: true },
        notepad: { width: 400, height: 300, isMultiplayer: false },
        winamp: { width: 300, height: 200, isMultiplayer: false },
        bdemediaplayer: { width: 800, height: 600, isMultiplayer: true },
        checkers: { width: 520, height: 580, isMultiplayer: true },
        snake: { width: 400, height: 450, isMultiplayer: true },
        characterEditor: { width: 520, height: 500, isMultiplayer: false },
        browser98: { width: 800, height: 600, isMultiplayer: false },
        pong: { width: 500, height: 400, isMultiplayer: true },
        breakout: { width: 500, height: 400, isMultiplayer: false },
        sudoku: { width: 400, height: 500, isMultiplayer: false },
        terminal: { width: 500, height: 300, isMultiplayer: false },
        inventory: { width: 550, height: 450, isMultiplayer: false },
        shop: { width: 700, height: 500, isMultiplayer: false },
        dexdirectory: { width: 500, height: 270, isMultiplayer: false },
        seabuddy: { width: 600, height: 450, isMultiplayer: true },
      };
      
      const config = programConfigs[type];
      state.highestZIndex += 1;
      
      // Calculate position - center BDE Media Player, offset others
      let windowPosition = position || { x: 100, y: 80 };
      if (!position) {
        if (type === 'bdemediaplayer') {
          // Center the BDE Media Player on screen
          windowPosition = { 
            x: Math.max(50, (window.innerWidth - config.width) / 2), 
            y: Math.max(50, (window.innerHeight - config.height - 100) / 2) 
          };
        } else {
          // Offset other windows as before
          windowPosition = { 
            x: 100 + Object.keys(state.openPrograms).length * 30, 
            y: 80 
          };
        }
      }
      
      state.openPrograms[windowId] = {
        id: windowId,
        type,
        isOpen: true,
        position: windowPosition,
        size: { width: config.width, height: config.height },
        isMinimized: false,
        zIndex: state.highestZIndex,
        controllerId,
        isMultiplayer: config.isMultiplayer,
        state: getProgramInitialState(type),
      };
    },

    closeProgram: (state, action: PayloadAction<string>) => {
      delete state.openPrograms[action.payload];
    },

    minimizeProgram: (state, action: PayloadAction<string>) => {
      const program = state.openPrograms[action.payload];
      if (program) {
        program.isMinimized = !program.isMinimized;
      }
    },

    focusProgram: (state, action: PayloadAction<string>) => {
      const program = state.openPrograms[action.payload];
      if (program) {
        state.highestZIndex += 1;
        program.zIndex = state.highestZIndex;
        program.isMinimized = false;
      }
    },

    updateProgramPosition: (state, action: PayloadAction<{
      windowId: string;
      position: { x: number; y: number };
    }>) => {
      const program = state.openPrograms[action.payload.windowId];
      if (program) {
        program.position = action.payload.position;
      }
    },

    updateProgramSize: (state, action: PayloadAction<{
      windowId: string;
      size: { width: number; height: number };
    }>) => {
      const program = state.openPrograms[action.payload.windowId];
      if (program) {
        program.size = action.payload.size;
      }
    },

    updateProgramState: (state, action: PayloadAction<{
      windowId: string;
      newState: any;
    }>) => {
      const program = state.openPrograms[action.payload.windowId];
      if (program) {
        program.state = { ...program.state, ...action.payload.newState };
      }
    },

    syncProgramFromServer: (state, action: PayloadAction<ProgramWindow>) => {
      const program = action.payload;
      state.openPrograms[program.id] = program;
      
      // Update highest z-index if necessary
      if (program.zIndex > state.highestZIndex) {
        state.highestZIndex = program.zIndex;
      }
    },

    setBackground: (state, action: PayloadAction<string>) => {
      state.backgroundId = action.payload;
    },

    syncDesktop: (state, action: PayloadAction<ProgramState>) => {
      return { ...action.payload };
    },
  },
});

// Helper function to get initial state for each program type
function getProgramInitialState(type: ProgramWindow['type']) {
  switch (type) {
    case 'paint':
      return {
        canvas: null, // Will be managed by the component
        tool: 'brush',
        color: '#000000',
        brushSize: 2,
      };
    case 'notepad':
      return {
        content: '',
        filename: 'Untitled.txt',
        isDirty: false,
        fontFamily: 'Comic Sans MS',
        fontSize: 32,
        textColor: '#000000',
        backgroundColor: '#ffffff',
        isBold: false,
        isItalic: false,
      };
    case 'winamp':
      return {
        playlist: [],
        currentTrack: 0,
        isPlaying: false,
        volume: 50,
        currentTime: 0,
        totalTime: 0,
      };
    case 'bdemediaplayer':
      return {
        playlist: [],
        currentTrack: 0,
        isPlaying: false,
        volume: 50,
        currentTime: 0,
        totalTime: 0,
        isFullscreen: false,
      };
    case 'checkers':
      return {
        board: initializeCheckersBoard(),
        currentPlayer: 'red',
        selectedPiece: null,
        gamePhase: 'setup', // setup, playing, finished
        redPlayer: null, // Player ID assigned to red
        blackPlayer: null, // Player ID assigned to black
        winner: null,
        validMoves: [],
        redPieces: 12,
        blackPieces: 12,
        lastMove: null,
      };
    case 'snake':
      return {
        gameState: 'title', // 'title', 'playing', 'paused', 'gameOver'
        snake: [{ x: 10, y: 10 }], // Starting position
        food: { x: 15, y: 15 },
        direction: 'right',
        score: 0,
        highScore: 0,
        speed: 150, // milliseconds between moves
        gridSize: 20, // pixels per grid cell
      };
    case 'sudoku':
      return {
        board: null, // Component will initialize with puzzle & readonly flags
      };
    case 'characterEditor':
      return {};
    case 'browser98':
      return {
        currentUrl: 'https://www.gameinformer.com',
        history: [],
        historyIndex: -1,
        snapshotTimestamp: null,
      };
    case 'pong':
      return {
        gameState: 'title', // 'title', 'menu', 'waiting', 'countdown', 'playing', 'gameOver'
        mode: 'single', // or 'multiplayer'
        countdown: 3,
        paddles: { left: 50, right: 50 }, // percentage positions
        ball: { x: 250, y: 200, vx: 2, vy: 2 },
        score: { left: 0, right: 0 },
      };
    case 'breakout':
      return {
        gameState: 'title',
        paddleX: 50, // percentage (0-100)
        ball: { x: 250, y: 300, vx: 3, vy: -3 },
        bricks: [], // will be generated on first play
        score: 0,
        lives: 3,
      };
    case 'terminal':
      return {
        history: [],
      };
    case 'inventory':
      return {
        activeTab: 'titles', // 'titles' or 'items'
        showTitleModal: false,
        showItemModal: false,
        selectedTitle: null,
        selectedItem: null,
      };
    case 'shop':
      return {
        activeTab: 'cosmetics', // 'cosmetics' | 'themes' | 'backgrounds' | 'games' | 'misc'
      };
    case 'dexdirectory':
      return {
        activeTab: 'profile', // 'profile' | 'browse'
      };
    case 'seabuddy':
      const now = Date.now();
      return {
        setupStep: 'tank', // 'tank' | 'fish' | 'name' | 'complete'
        selectedTank: null,
        selectedFish: null,
        fishName: '',
        fishPosition: { x: 50, y: 50 },
        fishMovement: { 
          direction: Math.random() * 360, 
          speed: 2.0,
          targetX: 60,
          targetY: 60,
          movementTimer: now,
          isSwimming: false,
          facingDirection: 'right',
          movementProgress: 0,
          driftDirection: Math.random() * 360,
        },
        hunger: 100,
        cleanliness: 100,
        happiness: 100,
        health: 100,
        currentTool: 'none',
        showStats: false,
        lastFed: now,
        lastCleaned: now,
        lastMovement: now,
        lastDecayUpdate: now,
        isLoaded: false,
      };
    default:
      return {};
  }
}

// Initialize a standard checkers board
function initializeCheckersBoard() {
  const board = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Place red pieces (top)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = { color: 'red', isKing: false };
      }
    }
  }
  
  // Place black pieces (bottom)
  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = { color: 'black', isKing: false };
      }
    }
  }
  
  return board;
}

export const {
  openProgram,
  closeProgram,
  minimizeProgram,
  focusProgram,
  updateProgramPosition,
  updateProgramSize,
  updateProgramState,
  syncProgramFromServer,
  setBackground,
  syncDesktop,
} = programSlice.actions;

export default programSlice.reducer;
