import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface DesktopIcon {
  id: string;
  label: string;
  icon: string; // unicode or image path
  x: number;
  y: number;
  type: string; // program type or 'dummy'
  isDummy?: boolean;
  hidden?: boolean;
}

// Default static icons that were hard-coded in useMovement.
export const defaultIcons: DesktopIcon[] = [
  { id: 'paint', label: 'Paint', icon: '🎨', x: 50, y: 60, type: 'paint', hidden: false },
  { id: 'notepad', label: 'Notepad', icon: '📝', x: 50, y: 160, type: 'notepad', hidden: false },
  { id: 'winamp', label: 'Muze', icon: '🎵', x: 50, y: 260, type: 'winamp', hidden: false },
  { id: 'bdemediaplayer', label: 'BDE Media Player', icon: '🚧', x: 50, y: 360, type: 'bdemediaplayer', hidden: false },
  { id: 'checkers', label: 'Checkers', icon: '🔴', x: 50, y: 460, type: 'checkers', hidden: false },
  { id: 'snake', label: 'SNEK', icon: '🐍', x: 150, y: 60, type: 'snake', hidden: false },
  { id: 'browser98', label: "Web Conquistador '98", icon: '⚜️', x: 150, y: 160, type: 'browser98', hidden: false },
  { id: 'pong', label: 'Pong', icon: '🏓', x: 150, y: 260, type: 'pong', hidden: false },
  { id: 'breakout', label: 'Breakout', icon: '🧱', x: 150, y: 360, type: 'breakout', hidden: false },
  { id: 'sudoku', label: 'Sudoku', icon: '🔢', x: 150, y: 460, type: 'sudoku', hidden: false },
  { id: 'seabuddy', label: 'SeaBuddy', icon: '🐠', x: 250, y: 60, type: 'seabuddy', hidden: false },
];

interface IconsState {
  icons: DesktopIcon[];
}

// Helper to load icons from localStorage if present for current user
function loadInitialIcons(): DesktopIcon[] {
  try {
    const stored = localStorage.getItem('desktop_icons');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // Merge with default icons to ensure new icons are added
        const existingIds = new Set(parsed.map((icon: DesktopIcon) => icon.id));
        const newIcons = defaultIcons.filter(icon => !existingIds.has(icon.id));
        return [...parsed, ...newIcons];
      }
    }
  } catch (err) {
    console.error('Failed to load icons from storage', err);
  }
  return defaultIcons;
}

const persistIcons = (icons: DesktopIcon[]) => {
  try {
    localStorage.setItem('desktop_icons', JSON.stringify(icons));
  } catch (err) {
    console.warn('Failed to save icons', err);
  }
};

const initialState: IconsState = {
  icons: loadInitialIcons(),
};

const iconSlice = createSlice({
  name: 'icons',
  initialState,
  reducers: {
    setIconPosition: (
      state,
      action: PayloadAction<{ id: string; x: number; y: number }>
    ) => {
      const icon = state.icons.find((i) => i.id === action.payload.id);
      if (icon) {
        icon.x = action.payload.x;
        icon.y = action.payload.y;
        persistIcons(state.icons);
      }
    },
    addDummyIcon: (
      state,
      action: PayloadAction<{ label: string; iconChar: string }>
    ) => {
      const id = `dummy-${Date.now()}`;
      state.icons.push({
        id,
        label: action.payload.label,
        icon: action.payload.iconChar,
        x: 200,
        y: 100,
        type: 'dummy',
        isDummy: true,
        hidden: false,
      });
      persistIcons(state.icons);
    },
    deleteDummyIcons: (state) => {
      state.icons = state.icons.filter((i) => !i.isDummy);
      persistIcons(state.icons);
    },
    setAllIcons: (state, action: PayloadAction<DesktopIcon[]>) => {
      state.icons = action.payload;
      persistIcons(state.icons);
    },
    hideIcon: (state, action: PayloadAction<string>) => {
      const icon = state.icons.find(i=>i.id===action.payload);
      if (icon) { icon.hidden = true; persistIcons(state.icons); }
    },
    restoreIcons: (state) => {
      state.icons.forEach(i=>{ i.hidden=false; });
      persistIcons(state.icons);
    },
    hideAllIcons: (state) => {
      state.icons.forEach(i=>{ i.hidden = true; });
      persistIcons(state.icons);
    },
    resetToDefaults: (state) => {
      state.icons = defaultIcons.map(i=>({ ...i, hidden:false }));
      persistIcons(state.icons);
    },
  },
});

export const { setIconPosition, addDummyIcon, deleteDummyIcons, setAllIcons, hideIcon, restoreIcons, hideAllIcons, resetToDefaults } =
  iconSlice.actions;
export default iconSlice.reducer; 