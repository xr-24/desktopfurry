import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Theme {
  id: string;
  name: string;
  colors: {
    primary: string;      // Window backgrounds, taskbar
    secondary: string;    // Button backgrounds  
    accent: string;       // Title bars, highlights
    text: string;         // Primary text color
    textSecondary: string; // Secondary text
    border: string;       // Window borders
    shadow: string;       // Drop shadows
    desktop: string;      // Desktop background color
  };
  fonts?: {
    primary: string;      // Main UI font
    monospace: string;    // Terminal/code font
  };
  isPurchased: boolean;
  isFree: boolean;
}

interface ThemeState {
  currentTheme: string;
  availableThemes: Theme[];
  purchasedThemes: string[];
  isLoading: boolean;
  error: string | null;
}

// Default Win98 theme
const defaultTheme: Theme = {
  id: 'win98-default',
  name: 'Classic Win98',
  colors: {
    primary: '#c0c0c0',
    secondary: '#dfdfdf', 
    accent: '#0080ff',
    text: '#000000',
    textSecondary: '#404040',
    border: '#808080',
    shadow: '#404040',
    desktop: '#008080'
  },
  fonts: {
    primary: '"Better VCR", "MS Sans Serif", sans-serif',
    monospace: '"Better VCR", monospace'
  },
  isPurchased: true,
  isFree: true
};

// Predefined themes that match the shop items
const predefinedThemes: Theme[] = [
  defaultTheme,
  {
    id: 'ocean-theme',
    name: 'Ocean Theme',
    colors: {
      primary: '#b3d9ff',
      secondary: '#e6f3ff',
      accent: '#0066cc',
      text: '#003366',
      textSecondary: '#004499',
      border: '#0080ff',
      shadow: '#003366',
      desktop: '#004080'
    },
    isPurchased: false,
    isFree: false
  },
  {
    id: 'forest-theme', 
    name: 'Forest Theme',
    colors: {
      primary: '#c8e6c8',
      secondary: '#e8f5e8',
      accent: '#228B22',
      text: '#1a4d1a',
      textSecondary: '#006400',
      border: '#90EE90',
      shadow: '#1a4d1a',
      desktop: '#2d5a2d'
    },
    isPurchased: false,
    isFree: false
  },
  {
    id: 'sunset-theme',
    name: 'Sunset Theme', 
    colors: {
      primary: '#ffcc99',
      secondary: '#ffe6cc',
      accent: '#ff6600',
      text: '#663300',
      textSecondary: '#cc3300',
      border: '#ff9966',
      shadow: '#663300',
      desktop: '#cc4400'
    },
    isPurchased: false,
    isFree: false
  }
];

const initialState: ThemeState = {
  currentTheme: 'win98-default',
  availableThemes: predefinedThemes,
  purchasedThemes: ['win98-default'],
  isLoading: false,
  error: null
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setCurrentTheme: (state, action: PayloadAction<string>) => {
      const theme = state.availableThemes.find(t => t.id === action.payload);
      if (theme && (theme.isFree || state.purchasedThemes.includes(action.payload))) {
        state.currentTheme = action.payload;
        // Apply theme to CSS custom properties
        applyThemeToDOM(theme);
        // Save to localStorage
        localStorage.setItem('selectedTheme', action.payload);
      }
    },
    
    setPurchasedThemes: (state, action: PayloadAction<string[]>) => {
      state.purchasedThemes = action.payload;
      // Update theme availability
      state.availableThemes = state.availableThemes.map(theme => ({
        ...theme,
        isPurchased: theme.isFree || action.payload.includes(theme.id)
      }));
    },
    
    addPurchasedTheme: (state, action: PayloadAction<string>) => {
      if (!state.purchasedThemes.includes(action.payload)) {
        state.purchasedThemes.push(action.payload);
        // Update theme availability
        const theme = state.availableThemes.find(t => t.id === action.payload);
        if (theme) {
          theme.isPurchased = true;
        }
      }
    },
    
    loadThemesStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    
    loadThemesSuccess: (state, action: PayloadAction<{ purchasedThemes: string[] }>) => {
      state.isLoading = false;
      state.purchasedThemes = action.payload.purchasedThemes;
      // Update theme availability
      state.availableThemes = state.availableThemes.map(theme => ({
        ...theme,
        isPurchased: theme.isFree || action.payload.purchasedThemes.includes(theme.id)
      }));
    },
    
    loadThemesFailure: (state, action: PayloadAction<string>) => {
      state.isLoading = false;
      state.error = action.payload;
    },
    
    initializeTheme: (state) => {
      // Load saved theme from localStorage
      const savedTheme = localStorage.getItem('selectedTheme');
      if (savedTheme && state.availableThemes.find(t => t.id === savedTheme)) {
        const theme = state.availableThemes.find(t => t.id === savedTheme);
        if (theme && (theme.isFree || state.purchasedThemes.includes(savedTheme))) {
          state.currentTheme = savedTheme;
          applyThemeToDOM(theme);
        }
      } else {
        // Apply default theme
        const defaultTheme = state.availableThemes.find(t => t.id === 'win98-default');
        if (defaultTheme) {
          applyThemeToDOM(defaultTheme);
        }
      }
    }
  }
});

// Helper function to apply theme to DOM
function applyThemeToDOM(theme: Theme) {
  // Remove any existing theme stylesheets
  const existingThemeLinks = document.querySelectorAll('link[data-theme]');
  existingThemeLinks.forEach(link => link.remove());
  
  // If it's not the default theme, load the theme CSS file
  if (theme.id !== 'win98-default') {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `/styles/themes/${theme.id}.css`;
    link.setAttribute('data-theme', theme.id);
    document.head.appendChild(link);
  }
  
  // Also apply via CSS variables as fallback
  const root = document.documentElement;
  root.style.setProperty('--win98-gray', theme.colors.primary);
  root.style.setProperty('--win98-light-gray', theme.colors.secondary);
  root.style.setProperty('--win98-dark-gray', theme.colors.border);
  root.style.setProperty('--win98-darker-gray', theme.colors.shadow);
  root.style.setProperty('--win98-blue', theme.colors.accent);
  root.style.setProperty('--win98-dark-blue', theme.colors.accent);
  root.style.setProperty('--win98-desktop-teal', theme.colors.desktop);
  
  // Apply text colors
  root.style.setProperty('--theme-text-primary', theme.colors.text);
  root.style.setProperty('--theme-text-secondary', theme.colors.textSecondary);
  
  // Apply fonts if specified
  if (theme.fonts) {
    root.style.setProperty('--theme-font-primary', theme.fonts.primary);
    if (theme.fonts.monospace) {
      root.style.setProperty('--theme-font-monospace', theme.fonts.monospace);
    }
  }
}

export const {
  setCurrentTheme,
  setPurchasedThemes,
  addPurchasedTheme,
  loadThemesStart,
  loadThemesSuccess,
  loadThemesFailure,
  initializeTheme
} = themeSlice.actions;

export default themeSlice.reducer;
