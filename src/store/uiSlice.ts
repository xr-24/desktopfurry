import { createSlice } from '@reduxjs/toolkit';

interface UIState {
  showHud: boolean;
  showRetro: boolean;
  trailerMode: boolean;
}

const initialState: UIState = {
  showHud: true,
  showRetro: false,
  trailerMode: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleHud(state) {
      state.showHud = !state.showHud;
    },
    toggleRetro(state) {
      state.showRetro = !state.showRetro;
    },
    toggleTrailerMode(state) {
      state.trailerMode = !state.trailerMode;
    },
  },
});

export const { toggleHud, toggleRetro, toggleTrailerMode } = uiSlice.actions;
export default uiSlice.reducer; 