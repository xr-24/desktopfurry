import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  asset_path: string;
  metadata: any;
  item_type: 'item' | 'title' | 'program' | 'theme' | 'background';
  is_purchased: boolean;
}

export interface ShopItemsByCategory {
  cosmetics: ShopItem[];
  themes: ShopItem[];
  backgrounds: ShopItem[];
  games: ShopItem[];
  misc: ShopItem[];
}

export interface PurchaseHistoryItem {
  id: string;
  shop_item_id: string;
  name: string;
  category: string;
  item_type: string;
  asset_path: string;
  price_paid: number;
  purchased_at: string;
}

interface ShopState {
  items: ShopItemsByCategory;
  userMoney: number;
  activeTab: 'cosmetics' | 'themes' | 'backgrounds' | 'games' | 'misc';
  purchaseHistory: PurchaseHistoryItem[];
  isLoading: boolean;
  error: string | null;
  isPurchasing: boolean;
}

const initialState: ShopState = {
  items: {
    cosmetics: [],
    themes: [],
    backgrounds: [],
    games: [],
    misc: []
  },
  userMoney: 0,
  activeTab: 'cosmetics',
  purchaseHistory: [],
  isLoading: false,
  error: null,
  isPurchasing: false,
};

const shopSlice = createSlice({
  name: 'shop',
  initialState,
  reducers: {
    setActiveTab: (state, action: PayloadAction<'cosmetics' | 'themes' | 'backgrounds' | 'games' | 'misc'>) => {
      state.activeTab = action.payload;
    },
    
    loadShopStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    
    loadShopSuccess: (state, action: PayloadAction<{ items: ShopItemsByCategory; userMoney: number }>) => {
      state.items = action.payload.items;
      state.userMoney = action.payload.userMoney;
      state.isLoading = false;
      state.error = null;
    },
    
    loadShopFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },
    
    purchaseStart: (state) => {
      state.isPurchasing = true;
      state.error = null;
    },
    
    purchaseSuccess: (state, action: PayloadAction<{ 
      itemId: string; 
      newBalance: number; 
      purchasedItem: { id: string; name: string; category: string; item_type: string } 
    }>) => {
      const { itemId, newBalance, purchasedItem } = action.payload;
      state.userMoney = newBalance;
      state.isPurchasing = false;
      state.error = null;
      
      // Mark the item as purchased in the appropriate category
      const category = purchasedItem.category as keyof ShopItemsByCategory;
      if (state.items[category]) {
        const item = state.items[category].find(item => item.id === itemId);
        if (item) {
          item.is_purchased = true;
        }
      }
    },
    
    purchaseFailure: (state, action: PayloadAction<string>) => {
      state.isPurchasing = false;
      state.error = action.payload;
    },
    
    loadPurchaseHistorySuccess: (state, action: PayloadAction<PurchaseHistoryItem[]>) => {
      state.purchaseHistory = action.payload;
    },
    
    updateUserMoney: (state, action: PayloadAction<number>) => {
      state.userMoney = action.payload;
    },
    
    clearShopError: (state) => {
      state.error = null;
    },
    
    clearShop: (state) => {
      return initialState;
    },
  },
});

export const {
  setActiveTab,
  loadShopStart,
  loadShopSuccess,
  loadShopFailure,
  purchaseStart,
  purchaseSuccess,
  purchaseFailure,
  loadPurchaseHistorySuccess,
  updateUserMoney,
  clearShopError,
  clearShop,
} = shopSlice.actions;

export default shopSlice.reducer; 