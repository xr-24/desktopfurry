import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Configure axios defaults
axios.defaults.baseURL = API_BASE;

interface AuthResponse {
  success: boolean;
  user?: {
    id: string;
    username: string;
    email?: string;
    userType: 'guest' | 'registered';
    guestToken?: string;
  };
  token?: string;
  error?: string;
}

interface DextopData {
  dextop: {
    id: string;
    name: string;
    backgroundId: string;
    isPublic: boolean;
    allowVisitors: boolean;
    allowVisitorInteraction: boolean;
    visitCount: number;
  };
  programs: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    zIndex: number;
    isMinimized: boolean;
    state: any;
  }>;
  avatar: {
    hue: number;
    eyes: string;
    ears: string;
    fluff: string;
    tail: string;
    body: string;
  };
  achievements: Array<{
    id: string;
    code: string;
    name: string;
    description: string;
    icon: string;
    unlocked_at: string;
  }>;
  unlockedPrograms: string[];
}

class AuthService {
  private token: string | null = null;

  constructor() {
    // Load token from localStorage on init
    this.token = localStorage.getItem('auth_token');
    if (this.token) {
      this.setAuthHeader(this.token);
    }
  }

  private setAuthHeader(token: string) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  private clearAuthHeader() {
    delete axios.defaults.headers.common['Authorization'];
  }

  // Store auth data
  private storeAuth(user: any, token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user_data', JSON.stringify(user));
    
    // Store guest token separately for easier access
    if (user.guestToken) {
      localStorage.setItem('guest_token', user.guestToken);
    }
    
    this.setAuthHeader(token);
  }

  // Get stored user data
  getStoredUser() {
    const userData = localStorage.getItem('user_data');
    return userData ? JSON.parse(userData) : null;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.token;
  }

  // Create guest account
  async createGuest(username: string): Promise<AuthResponse> {
    try {
      const response = await axios.post('/auth/guest', { username });
      const data = response.data;
      
      if (data.success) {
        this.storeAuth(data.user, data.token);
      }
      
      return data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to create guest account'
      };
    }
  }

  // Register new account
  async register(username: string, email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await axios.post('/auth/register', { username, email, password });
      const data = response.data;
      
      if (data.success) {
        this.storeAuth(data.user, data.token);
      }
      
      return data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed'
      };
    }
  }

  // Login
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await axios.post('/auth/login', { email, password });
      const data = response.data;
      
      if (data.success) {
        this.storeAuth(data.user, data.token);
      }
      
      return data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  }

  // Resume guest session
  async resumeGuestSession(): Promise<AuthResponse> {
    const guestToken = localStorage.getItem('guest_token');
    if (!guestToken) {
      return { success: false, error: 'No guest session found' };
    }

    try {
      const response = await axios.post('/auth/guest-resume', { guestToken });
      const data = response.data;
      
      if (data.success) {
        this.storeAuth(data.user, data.token);
      }
      
      return data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to resume session'
      };
    }
  }

  // Migrate guest to registered account
  async migrateToAccount(username: string, email: string, password: string): Promise<AuthResponse> {
    const guestToken = localStorage.getItem('guest_token');
    if (!guestToken) {
      return { success: false, error: 'No guest session to migrate' };
    }

    try {
      const response = await axios.post('/auth/migrate', { 
        guestToken, username, email, password 
      });
      const data = response.data;
      
      if (data.success) {
        this.storeAuth(data.user, data.token);
        localStorage.removeItem('guest_token'); // Remove guest token after migration
      }
      
      return data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Migration failed'
      };
    }
  }

  // Verify token
  async verifyToken(): Promise<boolean> {
    if (!this.token) return false;

    try {
      await axios.get('/auth/verify');
      return true;
    } catch (error) {
      this.logout();
      return false;
    }
  }

  // Load user's dextop
  async loadMyDextop(): Promise<DextopData | null> {
    try {
      const response = await axios.get('/dextop/my-dextop');
      return response.data;
    } catch (error) {
      console.error('Failed to load dextop:', error);
      return null;
    }
  }

  // Save program state
  async saveProgramState(programType: string, position: any, size: any, zIndex: number, isMinimized: boolean, programData: any): Promise<boolean> {
    try {
      await axios.post('/dextop/save-program', {
        programType, position, size, zIndex, isMinimized, programData
      });
      return true;
    } catch (error) {
      console.error('Failed to save program state:', error);
      return false;
    }
  }

  // Update background
  async updateBackground(backgroundId: string): Promise<boolean> {
    try {
      await axios.post('/dextop/background', { backgroundId });
      return true;
    } catch (error) {
      console.error('Failed to update background:', error);
      return false;
    }
  }

  // Update avatar
  async updateAvatar(appearance: any): Promise<boolean> {
    try {
      await axios.post('/dextop/avatar', { appearance });
      return true;
    } catch (error) {
      console.error('Failed to update avatar:', error);
      return false;
    }
  }

  // Unlock achievement
  async unlockAchievement(achievementCode: string, context?: any): Promise<any> {
    try {
      const response = await axios.post('/dextop/achievement', { achievementCode, context });
      return response.data;
    } catch (error) {
      console.error('Failed to unlock achievement:', error);
      return { success: false };
    }
  }

  // Logout
  logout() {
    this.token = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('guest_token');
    this.clearAuthHeader();
  }

  // Get current token for socket connection
  getToken(): string | null {
    return this.token;
  }
}

export const authService = new AuthService(); 