import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface DextopInfo {
  id: string;
  name: string;
  backgroundId: string;
  isPublic: boolean;
  allowVisitors: boolean;
  allowVisitorInteraction: boolean;
  visitCount: number;
  isOwner: boolean;
  ownerUsername?: string;
}

interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  unlocked_at: string;
  points?: number;
  unlocks_program?: string;
}

interface Visitor {
  id: string;
  username: string;
  position: { x: number; y: number };
  isMoving?: boolean;
  movementDirection?: string | null;
  walkFrame?: number;
  facingDirection?: 'left' | 'right';
  isGaming?: boolean;
  gamingInputDirection?: 'up' | 'down' | 'left' | 'right' | null;
  isGrabbing?: boolean;
  isResizing?: boolean;
  appearance?: {
    hue: number;
    eyes: string;
    ears: string;
    fluff: string;
    tail: string;
    body: string;
  };
}

interface DextopState {
  current: DextopInfo | null;
  visitors: { [userId: string]: Visitor };
  achievements: Achievement[];
  unlockedPrograms: string[];
  isLoading: boolean;
  error: string | null;
  visitedId?: string | null;
}

const initialState: DextopState = {
  current: null,
  visitors: {},
  achievements: [],
  unlockedPrograms: ['paint', 'notepad', 'winamp', 'bdemediaplayer', 'checkers', 'snake', 'characterEditor'],
  isLoading: false,
  error: null,
  visitedId: null,
};

const dextopSlice = createSlice({
  name: 'dextop',
  initialState,
  reducers: {
    loadDextopStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    loadDextopSuccess: (state, action: PayloadAction<{
      dextop: DextopInfo;
      achievements: Achievement[];
      unlockedPrograms: string[];
    }>) => {
      state.current = action.payload.dextop;
      state.achievements = action.payload.achievements;
      state.unlockedPrograms = action.payload.unlockedPrograms;
      state.isLoading = false;
      state.error = null;
    },
    loadDextopFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },
    updateDextopInfo: (state, action: PayloadAction<Partial<DextopInfo>>) => {
      if (state.current) {
        state.current = { ...state.current, ...action.payload };
      }
    },
    updateVisitors: (state, action: PayloadAction<{ [userId: string]: Visitor }>) => {
      state.visitors = action.payload;
    },
    addVisitor: (state, action: PayloadAction<Visitor>) => {
      state.visitors[action.payload.id] = action.payload;
    },
    removeVisitor: (state, action: PayloadAction<{ userId: string }>) => {
      delete state.visitors[action.payload.userId];
    },
    updateVisitorPosition: (state, action: PayloadAction<any>) => {
      const id = action.payload.userId || action.payload.id;
      if (!id) return;
      const prev = state.visitors[id] || {};
      state.visitors = {
        ...state.visitors,
        [id]: {
          ...prev,
          ...action.payload,
          position: { ...(action.payload.position || prev.position) },
        },
      } as any;
    },
    unlockAchievement: (state, action: PayloadAction<Achievement>) => {
      // Check if achievement is already unlocked
      const exists = state.achievements.find(a => a.code === action.payload.code);
      if (!exists) {
        state.achievements.push(action.payload);
        
        // Add unlocked program if achievement unlocks one
        if (action.payload.unlocks_program && !state.unlockedPrograms.includes(action.payload.unlocks_program)) {
          state.unlockedPrograms.push(action.payload.unlocks_program);
        }
      }
    },
    clearDextop: (state) => {
      state.current = null;
      state.visitors = {};
      state.achievements = [];
      state.unlockedPrograms = ['paint', 'notepad', 'winamp', 'bdemediaplayer', 'checkers', 'snake', 'characterEditor'];
      state.error = null;
    },
    setVisitedDextop: (state, action: PayloadAction<string>) => {
      state.visitedId = action.payload;
    },
    clearVisitedDextop: (state) => {
      state.visitedId = null;
    },
  },
});

export const {
  loadDextopStart,
  loadDextopSuccess,
  loadDextopFailure,
  updateDextopInfo,
  updateVisitors,
  addVisitor,
  removeVisitor,
  updateVisitorPosition,
  unlockAchievement,
  clearDextop,
  setVisitedDextop,
  clearVisitedDextop,
} = dextopSlice.actions;

export default dextopSlice.reducer; 