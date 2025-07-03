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
}

const initialState: DextopState = {
  current: null,
  visitors: {},
  achievements: [],
  unlockedPrograms: ['paint', 'notepad', 'winamp', 'bdemediaplayer', 'checkers', 'snake', 'characterEditor'],
  isLoading: false,
  error: null,
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
    updateVisitorPosition: (state, action: PayloadAction<{
      userId: string;
      position: { x: number; y: number };
      isMoving?: boolean;
      movementDirection?: string | null;
      walkFrame?: number;
      facingDirection?: 'left' | 'right';
      isGaming?: boolean;
      gamingInputDirection?: 'up' | 'down' | 'left' | 'right' | null;
      isGrabbing?: boolean;
      isResizing?: boolean;
    }>) => {
      const visitor = state.visitors[action.payload.userId];
      if (visitor) {
        visitor.position = action.payload.position;
        if (action.payload.isMoving !== undefined) visitor.isMoving = action.payload.isMoving;
        if (action.payload.movementDirection !== undefined) visitor.movementDirection = action.payload.movementDirection;
        if (action.payload.walkFrame !== undefined) visitor.walkFrame = action.payload.walkFrame;
        if (action.payload.facingDirection !== undefined) visitor.facingDirection = action.payload.facingDirection;
        if (action.payload.isGaming !== undefined) visitor.isGaming = action.payload.isGaming;
        if (action.payload.gamingInputDirection !== undefined) visitor.gamingInputDirection = action.payload.gamingInputDirection;
        if (action.payload.isGrabbing !== undefined) visitor.isGrabbing = action.payload.isGrabbing;
        if (action.payload.isResizing !== undefined) visitor.isResizing = action.payload.isResizing;
      }
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
} = dextopSlice.actions;

export default dextopSlice.reducer; 