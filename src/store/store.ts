import { configureStore } from '@reduxjs/toolkit';
import gameSlice from './gameSlice';
import playerSlice from './playerSlice';
import programSlice from './programSlice';
import authSlice from './authSlice';
import dextopSlice from './dextopSlice';
import socialSlice from './socialSlice';
import inventorySlice from './inventorySlice';

export const store = configureStore({
  reducer: {
    game: gameSlice,
    player: playerSlice,
    programs: programSlice,
    auth: authSlice,
    dextop: dextopSlice,
    social: socialSlice,
    inventory: inventorySlice,
  },
});

// Expose store globally for quick debugging
(window as any).store = store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 