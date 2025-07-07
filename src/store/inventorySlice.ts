import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Title {
  id: string;
  name: string;
  style_config: {
    color?: string;
    fontWeight?: string;
    textShadow?: string;
    fontSize?: string;
  };
  cost: number;
  description?: string;
  unlocked_at?: string;
}

export interface Item {
  id: string;
  name: string;
  type: string;
  asset_path: string;
  cost: number;
  description?: string;
  unlocked_at?: string;
}

interface InventoryState {
  money: number;
  titles: Title[];
  items: Item[];
  currentTitleId: string | null;
  currentItemIds: string[];
  isLoading: boolean;
  error: string | null;
}

const initialState: InventoryState = {
  money: 1000,
  titles: [],
  items: [],
  currentTitleId: null,
  currentItemIds: [],
  isLoading: false,
  error: null,
};

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    setInventoryData: (state, action: PayloadAction<{
      money: number;
      titles: Title[];
      items: Item[];
      currentTitleId: string | null;
      currentItemIds: string[];
    }>) => {
      state.money = action.payload.money;
      state.titles = action.payload.titles;
      state.items = action.payload.items;
      state.currentTitleId = action.payload.currentTitleId;
      state.currentItemIds = action.payload.currentItemIds;
      state.isLoading = false;
      state.error = null;
    },
    
    setCurrentTitle: (state, action: PayloadAction<string | null>) => {
      state.currentTitleId = action.payload;
    },
    
    setCurrentItems: (state, action: PayloadAction<string[]>) => {
      state.currentItemIds = action.payload;
    },
    
    addItem: (state, action: PayloadAction<Item>) => {
      const existingIndex = state.items.findIndex(item => item.id === action.payload.id);
      if (existingIndex === -1) {
        state.items.push(action.payload);
      }
    },
    
    addTitle: (state, action: PayloadAction<Title>) => {
      const existingIndex = state.titles.findIndex(title => title.id === action.payload.id);
      if (existingIndex === -1) {
        state.titles.push(action.payload);
      }
    },
    
    spendMoney: (state, action: PayloadAction<number>) => {
      state.money = Math.max(0, state.money - action.payload);
    },
    
    earnMoney: (state, action: PayloadAction<number>) => {
      state.money += action.payload;
    },
    
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    
    clearInventory: (state) => {
      return initialState;
    },
  },
});

export const {
  setInventoryData,
  setCurrentTitle,
  setCurrentItems,
  addItem,
  addTitle,
  spendMoney,
  earnMoney,
  setLoading,
  setError,
  clearInventory,
} = inventorySlice.actions;

export default inventorySlice.reducer; 