import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PlayerState {
  id: string | null;
  username: string;
  quadrant: number;
  position: { x: number; y: number };
  isGaming: boolean;
  gamingInputDirection: 'up' | 'down' | 'left' | 'right' | null;
  appearance: {
    hue: number;
    eyes: string;
    ears: string;
    fluff: string;
    tail: string;
    body: string;
  };
}

const initialState: PlayerState = {
  id: null,
  username: '',
  quadrant: 0,
  position: { x: 100, y: 100 }, // Default starting position
  isGaming: false,
  gamingInputDirection: null,
  appearance: { hue: 0, eyes: 'Eyes1', ears: 'none', fluff: 'none', tail: 'none', body: 'CustomBase' } as any,
};

const playerSlice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    setPlayer: (state, action: PayloadAction<{ id: string; username: string; quadrant: number }>) => {
      state.id = action.payload.id;
      state.username = action.payload.username;
      state.quadrant = action.payload.quadrant;
    },
    setUsername: (state, action: PayloadAction<string>) => {
      state.username = action.payload;
    },
    setPosition: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.position = action.payload;
    },
    setGamingState: (state, action: PayloadAction<{ isGaming: boolean; inputDirection?: 'up' | 'down' | 'left' | 'right' | null }>) => {
      state.isGaming = action.payload.isGaming;
      state.gamingInputDirection = action.payload.inputDirection || null;
    },
    setAppearance: (state, action: PayloadAction<{ hue: number; eyes: string; ears: string; fluff: string; tail: string; body?: string }>) => {
      state.appearance = { body: 'CustomBase', ...action.payload } as any;
    },
    resetPlayer: (state) => {
      state.id = null;
      state.username = '';
      state.quadrant = 0;
      state.position = { x: 100, y: 100 };
      state.isGaming = false;
      state.gamingInputDirection = null;
    },
  },
});

export const { setPlayer, setUsername, setPosition, setGamingState, setAppearance, resetPlayer } = playerSlice.actions;
export default playerSlice.reducer; 