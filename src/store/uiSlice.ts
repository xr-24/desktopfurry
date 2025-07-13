import { createSlice } from '@reduxjs/toolkit';

interface UIState {
  showHud: boolean;
  showRetro: boolean;
  trailerMode: boolean;
  gridSnappingEnabled: boolean;
  gridSize: number;
}

const initialState: UIState = {
  showHud: true,
  showRetro: false,
  trailerMode: false,
  gridSnappingEnabled: true, // Default to on
  gridSize: 50, // Grid size in pixels
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
    toggleGridSnapping(state) {
      state.gridSnappingEnabled = !state.gridSnappingEnabled;
    },
    setGridSize(state, action) {
      state.gridSize = action.payload;
    },
  },
});

export const { toggleHud, toggleRetro, toggleTrailerMode, toggleGridSnapping, setGridSize } = uiSlice.actions;
export default uiSlice.reducer; 