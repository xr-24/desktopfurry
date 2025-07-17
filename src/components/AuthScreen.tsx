import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { loginStart, loginSuccess, loginFailure } from '../store/authSlice';
import { loadDextopSuccess } from '../store/dextopSlice';
import { setAppearance } from '../store/playerSlice';
import { authService } from '../services/authService';
import { socketService } from '../services/socketService';
import '../styles/win98.css';
import { syncDesktop } from '../store/programSlice';
import { setInventoryData } from '../store/inventorySlice';

const AuthScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading, error } = useAppSelector((state) => state.auth);
  
  const [mode, setMode] = useState<'welcome' | 'login' | 'register' | 'migrate'>('welcome');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Try to resume session on component mount
  useEffect(() => {
    const tryResumeSession = async () => {
      if (authService.isAuthenticated()) {
        const isValid = await authService.verifyToken();
        if (isValid) {
          const userData = authService.getStoredUser();
          if (userData && userData.userType !== 'guest') {
            dispatch(loginSuccess(userData));
            await loadUserDextop();
            socketService.authenticate();
            // socketService.createRoom(userData.username); // removed to avoid legacy room duplication
          }
        }
      }
    };

    tryResumeSession();
  }, [dispatch]);

  const loadUserDextop = async () => {
    const dextopData = await authService.loadMyDextop();
    if (dextopData) {
      dispatch(loadDextopSuccess({
        dextop: { ...dextopData.dextop, isOwner: true },
        achievements: dextopData.achievements,
        unlockedPrograms: dextopData.unlockedPrograms
      }));
      
      dispatch(setAppearance(dextopData.avatar));

      const openPrograms: any = {};
      let highestZ = 100;
      for (const p of dextopData.programs) {
        const windowId = p.id || `${p.type}-${Date.now()}`;
        openPrograms[windowId] = {
          id: windowId,
          type: p.type,
          isOpen: true,
          position: p.position,
          size: p.size,
          isMinimized: p.isMinimized,
          zIndex: p.zIndex,
          controllerId: '',
          isMultiplayer: true,
          state: p.state || {},
        };
        if (p.zIndex > highestZ) highestZ = p.zIndex;
      }
      dispatch(syncDesktop({
        openPrograms,
        highestZIndex: highestZ,
        interactionRange: 80,
        backgroundId: dextopData.dextop.backgroundId || 'sandstone',
      }));

      // Populate inventory slice with server data (money, titles, items, selections)
      const inventoryData = (dextopData as any).inventory;
      if (inventoryData) {
        dispatch(setInventoryData({
          money: inventoryData.money,
          titles: inventoryData.titles,
          items: inventoryData.items,
          currentTitleId: inventoryData.currentTitleId,
          currentItemIds: inventoryData.currentItemIds,
        }));
      }

      socketService.updateAppearance(dextopData.avatar);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setFormError(null);
  };



  const handleLogin = async () => {
    if (!formData.email.trim() || !formData.password) {
      setFormError('Email and password are required');
      return;
    }

    setIsSubmitting(true);
    dispatch(loginStart());

    const result = await authService.login(formData.email.trim(), formData.password);
    
    if (result.success && result.user) {
      dispatch(loginSuccess(result.user));
      await loadUserDextop();
      socketService.authenticate();
      // socketService.createRoom(result.user.username); // removed
    } else {
      dispatch(loginFailure(result.error || 'Login failed'));
      setFormError(result.error || 'Login failed');
    }
    
    setIsSubmitting(false);
  };

  const handleRegister = async () => {
    if (!formData.username.trim() || !formData.email.trim() || !formData.password) {
      setFormError('All fields are required');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setFormError('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    dispatch(loginStart());

    const result = await authService.register(
      formData.username.trim(), 
      formData.email.trim(), 
      formData.password
    );
    
    if (result.success && result.user) {
      dispatch(loginSuccess(result.user));
      await loadUserDextop();
      socketService.authenticate();
      // socketService.createRoom(result.user.username); // removed
    } else {
      dispatch(loginFailure(result.error || 'Registration failed'));
      setFormError(result.error || 'Registration failed');
    }
    
    setIsSubmitting(false);
  };

  const handleMigrate = async () => {
    if (!formData.username.trim() || !formData.email.trim() || !formData.password) {
      setFormError('All fields are required');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    dispatch(loginStart());

    const result = await authService.migrateToAccount(
      formData.username.trim(), 
      formData.email.trim(), 
      formData.password
    );
    
    if (result.success && result.user) {
      dispatch(loginSuccess(result.user));
      await loadUserDextop();
      socketService.authenticate();
      // socketService.createRoom(result.user.username); // removed
    } else {
      dispatch(loginFailure(result.error || 'Migration failed'));
      setFormError(result.error || 'Migration failed');
    }
    
    setIsSubmitting(false);
  };

  // Don't show auth screen if already authenticated
  if (isAuthenticated) {
    return null;
  }

  const renderWelcomeScreen = () => (
    <div className="auth-content">
      <h2>🖥️ Welcome to Retro Dextop!</h2>
      <p>Your nostalgic multiplayer desktop experience awaits.</p>
      
      <div className="auth-options">
        <button 
          className="win98-button primary"
          onClick={() => setMode('login')}
        >
          🔑 I Have an Account
        </button>
        <button 
          className="win98-button"
          onClick={() => setMode('register')}
        >
          📝 Create Account
        </button>
      </div>
      
      <div className="auth-discord">
        <button 
          className="win98-button discord-button"
          onClick={() => window.open('https://discord.gg/c7AzUmzz2R', '_blank')}
        >
          💬 Join Our Discord
        </button>
        <p className="discord-subtitle">Connect with other players!</p>
      </div>
    </div>
  );



  const renderLoginForm = () => (
    <div className="auth-content">
      <h2>🔑 Login</h2>
      
      <div className="form-group">
        <label htmlFor="email">Email:</label>
        <input
          id="email"
          name="email"
          type="email"
          className="win98-input"
          value={formData.email}
          onChange={handleInputChange}
          placeholder="Enter your email"
          disabled={isSubmitting}
        />
      </div>

      <div className="form-group">
        <label htmlFor="password">Password:</label>
        <input
          id="password"
          name="password"
          type="password"
          className="win98-input"
          value={formData.password}
          onChange={handleInputChange}
          placeholder="Enter your password"
          disabled={isSubmitting}
        />
      </div>

      {(formError || error) && (
        <div className="auth-error">
          ⚠️ {formError || error}
        </div>
      )}

      <div className="auth-actions">
        <button 
          className="win98-button primary"
          onClick={handleLogin}
          disabled={isSubmitting || !formData.email.trim() || !formData.password}
        >
          {isSubmitting ? 'Logging in...' : 'Login'}
        </button>
        <button 
          className="win98-button"
          onClick={() => setMode('welcome')}
          disabled={isSubmitting}
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderRegisterForm = () => (
    <div className="auth-content">
      <h2>📝 Create Account</h2>
      
      <div className="form-group">
        <label htmlFor="username">Username:</label>
        <input
          id="username"
          name="username"
          type="text"
          className="win98-input"
          value={formData.username}
          onChange={handleInputChange}
          placeholder="Choose a username"
          maxLength={20}
          disabled={isSubmitting}
        />
      </div>

      <div className="form-group">
        <label htmlFor="email">Email:</label>
        <input
          id="email"
          name="email"
          type="email"
          className="win98-input"
          value={formData.email}
          onChange={handleInputChange}
          placeholder="Enter your email"
          disabled={isSubmitting}
        />
      </div>

      <div className="form-group">
        <label htmlFor="password">Password:</label>
        <input
          id="password"
          name="password"
          type="password"
          className="win98-input"
          value={formData.password}
          onChange={handleInputChange}
          placeholder="Create a password (6+ characters)"
          disabled={isSubmitting}
        />
      </div>

      <div className="form-group">
        <label htmlFor="confirmPassword">Confirm Password:</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          className="win98-input"
          value={formData.confirmPassword}
          onChange={handleInputChange}
          placeholder="Confirm your password"
          disabled={isSubmitting}
        />
      </div>

      {(formError || error) && (
        <div className="auth-error">
          ⚠️ {formError || error}
        </div>
      )}

      <div className="auth-actions">
        <button 
          className="win98-button primary"
          onClick={handleRegister}
          disabled={isSubmitting || !formData.username.trim() || !formData.email.trim() || !formData.password || !formData.confirmPassword}
        >
          {isSubmitting ? 'Creating Account...' : 'Create Account'}
        </button>
        <button 
          className="win98-button"
          onClick={() => setMode('welcome')}
          disabled={isSubmitting}
        >
          Back
        </button>
      </div>
    </div>
  );

  return (
    <div className="win98-desktop">
      <div className="auth-container win98-window">
        <div className="win98-window-title">
          <span>🎮 Retro Dextop - Authentication</span>
        </div>
        
        {mode === 'welcome' && renderWelcomeScreen()}
        {mode === 'login' && renderLoginForm()}
        {mode === 'register' && renderRegisterForm()}
      </div>

      {/* Win98 Taskbar */}
      <div className="win98-taskbar">
        <button className="win98-start-button">
          <span>🖥️</span>
          <span>Retro Dextop</span>
        </button>
      </div>
    </div>
  );
};

export default AuthScreen; 