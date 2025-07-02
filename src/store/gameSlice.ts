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
    updatePlayerPosition: (state, action: PayloadAction<{ playerId: string; position: { x: number; y: number } }>) => {
      if (state.players[action.payload.playerId]) {
        state.players[action.payload.playerId].position = action.payload.position;
      }
    },
  },
});

export const { setConnected, joinRoom, leaveRoom, updatePlayers, updatePlayerPosition } = gameSlice.actions;
export default gameSlice.reducer; 