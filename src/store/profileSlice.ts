import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UserProfile {
  user_id: string;
  username: string;
  biography: string;
  profile_background_id: string;
  interest_tags: string;
  privacy_setting: 'public' | 'friends' | 'private';
  created_at: string;
  updated_at: string;
  // Avatar appearance data
  hue?: number;
  eyes?: string;
  ears?: string;
  fluff?: string;
  tail?: string;
  body?: string;
  // Additional fields for search results
  is_friend?: boolean;
}

export interface ProfilePagination {
  currentPage: number;
  totalPages: number;
  totalResults: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface ProfileState {
  // Current user's profile
  currentProfile: UserProfile | null;
  isLoadingProfile: boolean;
  profileError: string | null;
  
  // Profile editing
  isEditing: boolean;
  editingProfile: Partial<UserProfile> | null;
  isSaving: boolean;
  saveError: string | null;
  
  // Profile search/browsing
  searchResults: UserProfile[];
  searchQuery: string;
  isSearching: boolean;
  searchError: string | null;
  pagination: ProfilePagination | null;
  
  // Available backgrounds for profile selection
  availableBackgrounds: Array<{
    id: string;
    name: string;
    pattern: string;
  }>;
}

const initialState: ProfileState = {
  currentProfile: null,
  isLoadingProfile: false,
  profileError: null,
  
  isEditing: false,
  editingProfile: null,
  isSaving: false,
  saveError: null,
  
  searchResults: [],
  searchQuery: '',
  isSearching: false,
  searchError: null,
  pagination: null,
  
  availableBackgrounds: [],
};

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    // Load current user's profile
    loadProfileStart: (state) => {
      state.isLoadingProfile = true;
      state.profileError = null;
    },
    loadProfileSuccess: (state, action: PayloadAction<UserProfile>) => {
      state.isLoadingProfile = false;
      state.currentProfile = action.payload;
      state.profileError = null;
    },
    loadProfileFailure: (state, action: PayloadAction<string>) => {
      state.isLoadingProfile = false;
      state.profileError = action.payload;
    },
    
    // Profile editing
    startEditing: (state) => {
      state.isEditing = true;
      state.editingProfile = state.currentProfile ? { ...state.currentProfile } : null;
      state.saveError = null;
    },
    cancelEditing: (state) => {
      state.isEditing = false;
      state.editingProfile = null;
      state.saveError = null;
    },
    updateEditingProfile: (state, action: PayloadAction<Partial<UserProfile>>) => {
      if (state.editingProfile) {
        state.editingProfile = { ...state.editingProfile, ...action.payload };
      }
    },
    
    // Save profile changes
    saveProfileStart: (state) => {
      state.isSaving = true;
      state.saveError = null;
    },
    saveProfileSuccess: (state, action: PayloadAction<UserProfile>) => {
      state.isSaving = false;
      state.isEditing = false;
      state.currentProfile = action.payload;
      state.editingProfile = null;
      state.saveError = null;
    },
    saveProfileFailure: (state, action: PayloadAction<string>) => {
      state.isSaving = false;
      state.saveError = action.payload;
    },
    
    // Profile search
    searchProfilesStart: (state, action: PayloadAction<{ query: string; page?: number }>) => {
      state.isSearching = true;
      state.searchError = null;
      state.searchQuery = action.payload.query;
      // Clear results if it's a new search (page 1 or no page specified)
      if (!action.payload.page || action.payload.page === 1) {
        state.searchResults = [];
      }
    },
    searchProfilesSuccess: (state, action: PayloadAction<{
      profiles: UserProfile[];
      pagination: ProfilePagination;
      append?: boolean;
    }>) => {
      state.isSearching = false;
      state.searchError = null;
      
      if (action.payload.append) {
        // Append results for pagination
        state.searchResults = [...state.searchResults, ...action.payload.profiles];
      } else {
        // Replace results for new search
        state.searchResults = action.payload.profiles;
      }
      
      state.pagination = action.payload.pagination;
    },
    searchProfilesFailure: (state, action: PayloadAction<string>) => {
      state.isSearching = false;
      state.searchError = action.payload;
    },
    
    // Clear search results
    clearSearchResults: (state) => {
      state.searchResults = [];
      state.searchQuery = '';
      state.pagination = null;
      state.searchError = null;
    },
    
    // Set available backgrounds
    setAvailableBackgrounds: (state, action: PayloadAction<Array<{
      id: string;
      name: string;
      pattern: string;
    }>>) => {
      state.availableBackgrounds = action.payload;
    },
    
    // Clear all errors
    clearErrors: (state) => {
      state.profileError = null;
      state.saveError = null;
      state.searchError = null;
    },
  },
});

export const {
  loadProfileStart,
  loadProfileSuccess,
  loadProfileFailure,
  startEditing,
  cancelEditing,
  updateEditingProfile,
  saveProfileStart,
  saveProfileSuccess,
  saveProfileFailure,
  searchProfilesStart,
  searchProfilesSuccess,
  searchProfilesFailure,
  clearSearchResults,
  setAvailableBackgrounds,
  clearErrors,
} = profileSlice.actions;

export default profileSlice.reducer;
