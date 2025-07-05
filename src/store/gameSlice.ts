import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface GameState {
  roomId: string | null;
  isConnected: boolean;
  players: { [playerId: string]: Player };
  maxPlayers: number;
}

interface Player {
  id: string;
  username: string;
  position: { x: number; y: number };
  quadrant: number; // 0-3 for top-left, top-right, bottom-left, bottom-right
  isGaming?: boolean;
  gamingInputDirection?: 'up' | 'down' | 'left' | 'right' | null;
  isGrabbing?: boolean;
  isResizing?: boolean;
  isSitting?: boolean;
  // movement / animation extras
  isMoving?: boolean;
  movementDirection?: string | null;
  walkFrame?: number;
  facingDirection?: 'left' | 'right';
  appearance?: {
    hue: number;
    eyes: string;
    ears: string;
    fluff: string;
    tail: string;
    body: string;
  };
}

const initialState: GameState = {
  roomId: null,
  isConnected: false,
  players: {},
  maxPlayers: 4,
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },
    joinRoom: (state, action: PayloadAction<string>) => {
      state.roomId = action.payload;
    },
    leaveRoom: (state) => {
      state.roomId = null;
      state.players = {};
    },
    updatePlayers: (state, action: PayloadAction<{ [playerId: string]: Player }>) => {
      state.players = action.payload;
    },
    updatePlayerPosition: (state, action: PayloadAction<{ playerId: string; position: { x: number; y: number }; isMoving?: boolean; movementDirection?: string | null; walkFrame?: number; facingDirection?: 'left' | 'right'; isGaming?: boolean; gamingInputDirection?: 'up' | 'down' | 'left' | 'right' | null; isGrabbing?: boolean; isResizing?: boolean; isSitting?: boolean }>) => {
      const player = state.players[action.payload.playerId];
      if (player) {
        player.position = action.payload.position;
        if (action.payload.isMoving !== undefined) player.isMoving = action.payload.isMoving;
        if (action.payload.movementDirection !== undefined) player.movementDirection = action.payload.movementDirection;
        if (action.payload.walkFrame !== undefined) player.walkFrame = action.payload.walkFrame;
        if (action.payload.facingDirection !== undefined) player.facingDirection = action.payload.facingDirection;
        if (action.payload.isGaming !== undefined) player.isGaming = action.payload.isGaming;
        if (action.payload.gamingInputDirection !== undefined) player.gamingInputDirection = action.payload.gamingInputDirection;
        if (action.payload.isGrabbing !== undefined) player.isGrabbing = action.payload.isGrabbing;
        if (action.payload.isResizing !== undefined) player.isResizing = action.payload.isResizing;
        if (action.payload.isSitting !== undefined) player.isSitting = action.payload.isSitting;
      }
    },
  },
});

export const { setConnected, joinRoom, leaveRoom, updatePlayers, updatePlayerPosition } = gameSlice.actions;
export default gameSlice.reducer; 