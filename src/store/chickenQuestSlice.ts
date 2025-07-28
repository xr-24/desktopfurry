import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ChickenQuestStats {
  archery: number;
  swordsman: number;
  magic: number;
  fishing: number;
  charisma: number;
}

export interface ChickenQuestEquipment {
  weapon?: string;
  armor?: string;
  tool?: string;
}

export interface ChickenQuestNPC {
  id: string;
  name: string;
  position: { x: number; y: number };
  sprite: string;
  dialogueCompleted: boolean;
}

export type ChickenQuestRoom = 'town' | 'archery' | 'swordsman' | 'magic' | 'fishing' | 'dialogue';

interface ChickenQuestState {
  // Player Stats
  stats: ChickenQuestStats;
  
  // Game State
  currentRoom: ChickenQuestRoom;
  playerPosition: { x: number; y: number };
  isTraining: boolean;
  
  // Equipment & Inventory
  equippedItems: ChickenQuestEquipment;
  gold: number;
  
  // Room & World State
  camera: { x: number; y: number };
  interactableNearby: string | null; // ID of nearby interactable
  
  // NPCs
  npcs: ChickenQuestNPC[];
  
  // Training Progress
  trainingCooldown: number; // Prevents spam training
  lastTrainingTime: number;
}

const initialState: ChickenQuestState = {
  stats: {
    archery: 1,
    swordsman: 1,
    magic: 1,
    fishing: 1,
    charisma: 1,
  },
  
  currentRoom: 'town',
  playerPosition: { x: 400, y: 350 }, // Start in middle of town
  isTraining: false,
  
  equippedItems: {},
  gold: 100,
  
  camera: { x: 0, y: 0 },
  interactableNearby: null,
  
  npcs: [
    {
      id: 'town_vendor',
      name: 'Merchant Cluck',
      position: { x: 1200, y: 350 },
      sprite: 'chicken',
      dialogueCompleted: false,
    },
    {
      id: 'town_trainer',
      name: 'Master Rooster',
      position: { x: 800, y: 300 },
      sprite: 'chicken',
      dialogueCompleted: false,
    }
  ],
  
  trainingCooldown: 0,
  lastTrainingTime: 0,
};

const chickenQuestSlice = createSlice({
  name: 'chickenQuest',
  initialState,
  reducers: {
    // Player Movement
    setPlayerPosition: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.playerPosition = action.payload;
    },
    
    // Camera Control
    updateCamera: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.camera = action.payload;
    },
    
    // Room Navigation
    changeRoom: (state, action: PayloadAction<ChickenQuestRoom>) => {
      state.currentRoom = action.payload;
      // Reset player position based on room
      switch (action.payload) {
        case 'town':
          state.playerPosition = { x: 400, y: 350 };
          break;
        case 'archery':
        case 'swordsman':
        case 'magic':
        case 'fishing':
        case 'dialogue':
          state.playerPosition = { x: 100, y: 350 }; // Start at left edge of training rooms
          break;
      }
      state.camera = { x: 0, y: 0 };
      state.interactableNearby = null;
    },
    
    // Training System
    startTraining: (state, action: PayloadAction<keyof ChickenQuestStats>) => {
      state.isTraining = true;
      state.lastTrainingTime = Date.now();
    },
    
    completeTraining: (state, action: PayloadAction<keyof ChickenQuestStats>) => {
      const statType = action.payload;
      state.stats[statType] = Math.min(100, state.stats[statType] + 2);
      state.isTraining = false;
      state.trainingCooldown = 3000; // 3 second cooldown
      state.currentRoom = 'town'; // Return to town after training
      state.playerPosition = { x: 400, y: 350 };
      state.camera = { x: 0, y: 0 };
    },
    
    // Equipment System
    equipItem: (state, action: PayloadAction<{ slot: keyof ChickenQuestEquipment; itemId: string }>) => {
      const { slot, itemId } = action.payload;
      state.equippedItems[slot] = itemId;
    },
    
    unequipItem: (state, action: PayloadAction<keyof ChickenQuestEquipment>) => {
      delete state.equippedItems[action.payload];
    },
    
    // Gold Management
    spendGold: (state, action: PayloadAction<number>) => {
      state.gold = Math.max(0, state.gold - action.payload);
    },
    
    earnGold: (state, action: PayloadAction<number>) => {
      state.gold += action.payload;
    },
    
    // Interaction System
    setInteractableNearby: (state, action: PayloadAction<string | null>) => {
      state.interactableNearby = action.payload;
    },
    
    // NPC System
    updateNPCDialogue: (state, action: PayloadAction<{ npcId: string; completed: boolean }>) => {
      const npc = state.npcs.find(n => n.id === action.payload.npcId);
      if (npc) {
        npc.dialogueCompleted = action.payload.completed;
      }
    },
    
    // Cooldown Management
    updateTrainingCooldown: (state, action: PayloadAction<number>) => {
      state.trainingCooldown = Math.max(0, action.payload);
    },
    
    // Reset Game State
    resetChickenQuest: (state) => {
      return initialState;
    },
  },
});

export const {
  setPlayerPosition,
  updateCamera,
  changeRoom,
  startTraining,
  completeTraining,
  equipItem,
  unequipItem,
  spendGold,
  earnGold,
  setInteractableNearby,
  updateNPCDialogue,
  updateTrainingCooldown,
  resetChickenQuest,
} = chickenQuestSlice.actions;

export default chickenQuestSlice.reducer; 