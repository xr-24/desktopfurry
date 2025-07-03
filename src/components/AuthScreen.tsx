import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { loginStart, loginSuccess, loginFailure } from '../store/authSlice';
import { loadDextopSuccess } from '../store/dextopSlice';
import { setAppearance } from '../store/playerSlice';
import { authService } from '../services/authService';
import { socketService } from '../services/socketService';
import '../styles/win98.css';

const AuthScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, isLoading, error } = useAppSelector((state) => state.auth);
  
  const [mode, setMode] = useState<'welcome' | 'guest' | 'login' | 'register' | 'migrate'>('welcome');
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
          if (userData) {
            dispatch(loginSuccess(userData));
            await loadUserDextop();
          }
        }
      } else {
        // Try to resume guest session
        const guestResult = await authService.resumeGuestSession();
        if (guestResult.success && guestResult.user) {
          dispatch(loginSuccess(guestResult.user));
          await loadUserDextop();
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
      
      // Set avatar appearance
      dispatch(setAppearance(dextopData.avatar));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setFormError(null);
  };

  const handleGuestLogin = async () => {
    if (!formData.username.trim()) {
      setFormError('Username is required');
      return;
    }

    setIsSubmitting(true);
    dispatch(loginStart());

    const result = await authService.createGuest(formData.username.trim());
    
    if (result.success && result.user) {
      dispatch(loginSuccess(result.user));
      await loadUserDextop();
    } else {
      dispatch(loginFailure(result.error || 'Failed to create guest account'));
      setFormError(result.error || 'Failed to create guest account');
    }
    
    setIsSubmitting(false);
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
      socketService.createRoom(result.user.username);
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
          onClick={() => setMode('guest')}
        >
          🎮 Start as Guest
        </button>
        <p className="auth-subtitle">Jump right in! No signup required.</p>
        
        <div className="auth-divider">or</div>
        
        <button 
          className="win98-button"
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
      
      <div className="auth-note">
        💡 Guests can save progress and upgrade to a full account later!
      </div>
    </div>
  );

  const renderGuestForm = () => (
    <div className="auth-content">
      <h2>🎮 Guest Account</h2>
      <p>Choose a username to get started:</p>
      
      <div className="form-group">
        <label htmlFor="username">Username:</label>
        <input
          id="username"
          name="username"
          type="text"
          className="win98-input"
          value={formData.username}
          onChange={handleInputChange}
          placeholder="Enter your username"
          maxLength={20}
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
          onClick={handleGuestLogin}
          disabled={isSubmitting || !formData.username.trim()}
        >
          {isSubmitting ? 'Creating...' : 'Start Playing'}
        </button>
        <button 
          className="win98-button"
          onClick={() => setMode('welcome')}
          disabled={isSubmitting}
        >
          Back
        </button>
      </div>
      
      <div className="auth-note">
        💾 Your progress will be saved locally. Create a full account later to access it from anywhere!
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
        {mode === 'guest' && renderGuestForm()}
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