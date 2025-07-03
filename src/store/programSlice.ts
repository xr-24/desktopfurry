import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ProgramWindow {
  id: string;
  type: 'paint' | 'notepad' | 'winamp' | 'checkers' | 'snake' | 'characterEditor';
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
        checkers: { width: 450, height: 450, isMultiplayer: true },
        snake: { width: 400, height: 450, isMultiplayer: true },
        characterEditor: { width: 520, height: 500, isMultiplayer: false },
      };
      
      const config = programConfigs[type];
      state.highestZIndex += 1;
      
      state.openPrograms[windowId] = {
        id: windowId,
        type,
        isOpen: true,
        position: position || { x: 100 + Object.keys(state.openPrograms).length * 30, y: 80 },
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
    case 'checkers':
      return {
        board: initializeCheckersBoard(),
        currentPlayer: 'red',
        selectedPiece: null,
        gamePhase: 'setup', // setup, playing, finished
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
    case 'characterEditor':
      return {};
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