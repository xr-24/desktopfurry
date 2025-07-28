import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL;

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

  // Helper that uses fetch keepalive for background/unload-safe POSTs
  private async postKeepAlive(path: string, payload: any): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.token ? `Bearer ${this.token}` : ''
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      return res.ok;
    } catch (err) {
      console.error('keepalive POST failed', err);
      return false;
    }
  }

  // Save program state  (now uses keepalive fetch)
  async saveProgramState(programType: string, position: any, size: any, zIndex: number, isMinimized: boolean, programData: any): Promise<boolean> {
    console.log(`🚀 API call to save ${programType} state:`, {
      programType, position, size, zIndex, isMinimized, 
      dataSize: JSON.stringify(programData).length
    });
    
    const result = this.postKeepAlive('/dextop/save-program', {
      programType, position, size, zIndex, isMinimized, programData
    });
    
    result.then(success => {
      console.log(`✅ Save ${programType} result:`, success);
    }).catch(error => {
      console.error(`❌ Save ${programType} failed:`, error);
    });
    
    return result;
  }

  // Update background (now uses keepalive fetch)
  async updateBackground(backgroundId: string): Promise<boolean> {
    return this.postKeepAlive('/dextop/background', { backgroundId });
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

  // Search users by username
  async searchUsers(query: string): Promise<any[]> {
    try {
      const response = await axios.get(`/users/search?q=${encodeURIComponent(query)}`);
      return response.data.users;
    } catch (error) {
      console.error('Failed to search users:', error);
      return [];
    }
  }

  // Visit someone else's dextop
  async visitDextop(dextopId: string): Promise<DextopData | null> {
    try {
      const response = await axios.get(`/dextop/visit/${dextopId}`);
      return response.data;
    } catch (error: any) {
      console.error('Failed to visit dextop:', error);
      return null;
    }
  }

  // Delete a program's persisted state so closed windows do not re-appear on refresh
  async deleteProgramState(programType: string): Promise<boolean> {
    try {
      await axios.delete(`/dextop/program/${encodeURIComponent(programType)}`);
      return true;
    } catch (error) {
      console.error('Failed to delete program state:', error);
      return false;
    }
  }

  // Update current title
  async updateCurrentTitle(titleId: string | null): Promise<boolean> {
    try {
      await axios.post('/inventory/title', { titleId });
      return true;
    } catch (error) {
      console.error('Failed to update current title:', error);
      return false;
    }
  }

  // Update current items
  async updateCurrentItems(itemIds: string[]): Promise<boolean> {
    try {
      await axios.post('/inventory/items', { itemIds });
      return true;
    } catch (error) {
      console.error('Failed to update current items:', error);
      return false;
    }
  }

  // Load inventory data
  async loadInventory(): Promise<any> {
    try {
      const response = await axios.get('/inventory');
      return response.data;
    } catch (error) {
      console.error('Failed to load inventory:', error);
      return null;
    }
  }

  // Shop API methods
  async loadShopItems(): Promise<any> {
    try {
      const response = await axios.get('/shop/items');
      return response.data;
    } catch (error) {
      console.error('Failed to load shop items:', error);
      return null;
    }
  }

  async purchaseItem(itemId: string): Promise<any> {
    try {
      const response = await axios.post('/shop/purchase', { itemId });
      return response.data;
    } catch (error: any) {
      console.error('Failed to purchase item:', error);
      throw new Error(error.response?.data?.error || 'Purchase failed');
    }
  }

  async loadPurchaseHistory(): Promise<any> {
    try {
      const response = await axios.get('/shop/purchases');
      return response.data;
    } catch (error) {
      console.error('Failed to load purchase history:', error);
      return null;
    }
  }

  // Adjust money balance (positive to add, negative to deduct)
  async adjustMoney(amount: number): Promise<{ success: boolean; newBalance?: number }> {
    try {
      const response = await axios.post('/inventory/money', { amount });
      return response.data;
    } catch (error: any) {
      console.error('Failed to adjust money:', error);
      return { success: false };
    }
  }

  async grantTitle(titleName: string, styleConfig: any = {}): Promise<any> {
    try {
      const response = await axios.post('/inventory/grant-title', { titleName, styleConfig });
      return response.data;
    } catch (error: any) {
      console.error('Failed to grant title:', error);
      return { success: false };
    }
  }

  async setWelcomeMessagePreference(showWelcome: boolean): Promise<boolean> {
    try {
      await axios.post('/auth/welcome-message-preference', { showWelcome });
      // Also store locally for immediate access
      localStorage.setItem('welcome_message_disabled', (!showWelcome).toString());
      return true;
    } catch (error: any) {
      console.error('Failed to save welcome message preference:', error);
      return false;
    }
  }

  getWelcomeMessagePreference(): boolean {
    const disabled = localStorage.getItem('welcome_message_disabled');
    return disabled !== 'true'; // Default to showing welcome message
  }

  // Theme-related methods
  async loadPurchasedThemes(): Promise<string[]> {
    try {
      const response = await axios.get('/shop/purchases');
      const purchases = response.data.purchases || [];
      return purchases
        .filter((purchase: any) => purchase.item_type === 'theme')
        .map((purchase: any) => {
          // Map shop item names to theme IDs
          const nameToId: { [key: string]: string } = {
            'Ocean Theme': 'ocean-theme',
            'Forest Theme': 'forest-theme', 
            'Sunset Theme': 'sunset-theme'
          };
          return nameToId[purchase.name] || purchase.name.toLowerCase().replace(/\s+/g, '-');
        });
    } catch (error) {
      console.error('Failed to load purchased themes:', error);
      return [];
    }
  }

  async saveCurrentTheme(themeId: string): Promise<boolean> {
    return this.postKeepAlive('/dextop/theme', { themeId });
  }

  async loadCurrentTheme(): Promise<string | null> {
    try {
      const response = await axios.get('/dextop/my-dextop');
      return response.data.dextop?.currentTheme || null;
    } catch (error) {
      console.error('Failed to load current theme:', error);
      return null;
    }
  }

  // Generic API call method for profile operations
  async apiCall(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', data?: any): Promise<any> {
    try {
      // Remove leading /api if it exists since baseURL already includes it
      const cleanPath = path.startsWith('/api/') ? path.substring(4) : path;
      
      const config: any = {
        method: method.toLowerCase(),
        url: cleanPath,
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        config.data = data;
      }

      console.log(`Making API call: ${method} ${cleanPath}`, data);
      const response = await axios(config);
      console.log(`API call response:`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`API call failed: ${method} ${path}`, error);
      console.error('Error details:', error.response?.data);
      return {
        success: false,
        error: error.response?.data?.error || `${method} request failed`
      };
    }
  }

  // Social API methods
  async getUnreadCounts(): Promise<{ unreadMessages: number; unreadFriendRequests: number }> {
    try {
      const response = await axios.get('/social/unread-counts');
      return response.data;
    } catch (error) {
      console.error('Failed to get unread counts:', error);
      return { unreadMessages: 0, unreadFriendRequests: 0 };
    }
  }

  async getRecentMessages(limit = 50): Promise<any[]> {
    try {
      const response = await axios.get(`/social/messages?limit=${limit}`);
      return response.data.messages || [];
    } catch (error) {
      console.error('Failed to get recent messages:', error);
      return [];
    }
  }

  async getUnreadMessages(): Promise<any[]> {
    try {
      const response = await axios.get('/social/unread-messages');
      return response.data.messages || [];
    } catch (error) {
      console.error('Failed to get unread messages:', error);
      return [];
    }
  }

  async markMessagesAsRead(messageIds: string[]): Promise<boolean> {
    try {
      await axios.post('/social/messages/mark-read', { messageIds });
      return true;
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
      return false;
    }
  }

  async getPendingFriendRequests(): Promise<any[]> {
    try {
      const response = await axios.get('/social/friend-requests');
      return response.data.requests || [];
    } catch (error) {
      console.error('Failed to get friend requests:', error);
      return [];
    }
  }

  async respondToFriendRequest(requestId: string, action: 'accept' | 'reject'): Promise<boolean> {
    try {
      await axios.post(`/social/friend-requests/${requestId}/respond`, { action });
      return true;
    } catch (error) {
      console.error('Failed to respond to friend request:', error);
      return false;
    }
  }

  // Fish management methods
  async loadFish(): Promise<any | null> {
    try {
      const response = await axios.get('/fish');
      return response.data.fish || null;
    } catch (error) {
      console.error('Failed to load fish:', error);
      return null;
    }
  }

  async createFish(fishData: { fish_type: string; fish_name: string; tank_background: string }): Promise<boolean> {
    try {
      await axios.post('/fish', fishData);
      return true;
    } catch (error) {
      console.error('Failed to create fish:', error);
      return false;
    }
  }

  async feedFish(): Promise<boolean> {
    try {
      await axios.put('/fish/feed');
      return true;
    } catch (error) {
      console.error('Failed to feed fish:', error);
      return false;
    }
  }

  async cleanTank(): Promise<boolean> {
    try {
      await axios.put('/fish/clean');
      return true;
    } catch (error) {
      console.error('Failed to clean tank:', error);
      return false;
    }
  }

  async killFish(deathPosition: { x: number; y: number }): Promise<any> {
    try {
      const response = await axios.put('/fish/kill', {
        death_position_x: deathPosition.x,
        death_position_y: deathPosition.y
      });
      return response.data;
    } catch (error) {
      console.error('Failed to kill fish:', error);
      return null;
    }
  }

  async clearFish(): Promise<boolean> {
    try {
      await axios.delete('/fish/clear');
      return true;
    } catch (error) {
      console.error('Failed to clear fish:', error);
      return false;
    }
  }

  // Debug method to decay fish stats for testing
  async decayFish(): Promise<any> {
    try {
      const response = await axios.post('/fish/decay');
      return response.data;
    } catch (error) {
      console.error('Failed to decay fish:', error);
      return null;
    }
  }
}

export const authService = new AuthService();

// Expose authService globally for debugging
if (typeof window !== 'undefined') {
  (window as any).authService = authService;
}
