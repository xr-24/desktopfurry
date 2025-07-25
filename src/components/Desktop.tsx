import React, { useState, useRef, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import Character from './Character';
import SystemClock from './SystemClock';
import MoneyDisplay from './MoneyDisplay';
import StartMenu from './StartMenu';
import ProgramManager from './ProgramManager';
import DesktopIcon from './DesktopIcon';
import DexSocial from './programs/DexSocial';
import WelcomeVideo from './WelcomeVideo';
import useMovement from '../hooks/useMovement';
import { setBackground } from '../store/programSlice';
import { restoreFromProgramState, setActiveTab, setSelectedFriend, setLastManualTab } from '../store/socialSlice';
import { updatePlayerPosition } from '../store/gameSlice';
import '../styles/desktop.css';
import { authService } from '../services/authService';
import { store } from '../store/store';

// Dynamically load pattern images
// eslint-disable-next-line @typescript-eslint/no-var-requires
const patternsContext = (require as any).context('../assets/patterns', false, /\.(png|jpe?g|gif)$/);

const patternsMap: { [key: string]: string } = patternsContext.keys().reduce((acc: Record<string, string>, file: string) => {
  const id = file.replace('./', '').replace(/\.(png|jpe?g|gif)$/, '').toLowerCase();
  acc[id] = patternsContext(file) as string;
  return acc;
}, {});

const Desktop: React.FC = () => {
  const { roomId, players } = useAppSelector((state: any) => state.game || {});
  const { id: currentPlayerId, isGaming, gamingInputDirection } = useAppSelector((state: any) => state.player || {});
  const selfPlayerData = useAppSelector((state:any)=> state.player);
  const visitedId = useAppSelector((state: any) => state.dextop.visitedId);
  const currentDextop = useAppSelector((state: any) => state.dextop.current);
  const currentUserId = useAppSelector((state:any)=> state.auth.user?.id);
  const backgroundId = useAppSelector((state: any) => state.programs.backgroundId);
  const visitors = useAppSelector((state:any)=> state.dextop.visitors);
  const socialState = useAppSelector((state: any) => state.social);
  const lastManualTab = socialState.lastManualTab;
  const dispatch = useAppDispatch();
  const trailerMode = useAppSelector((state:any)=> state.ui.trailerMode);
  
  // Desktop customization state
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [isRoomInfoOpen, setIsRoomInfoOpen] = useState(false);
  const [isDexSocialOpen, setIsDexSocialOpen] = useState(false);
  const [isDexSocialHidden, setIsDexSocialHidden] = useState(false);
  const [focusChatSignal, setFocusChatSignal] = useState(0);
  const [openedViaTKey, setOpenedViaTKey] = useState(false);
  
  // Migration: Try to restore DexSocial data from old program state
  useEffect(() => {
    const migrateExistingData = () => {
      const currentPrograms = store.getState().programs.openPrograms;
      // Look for any existing dexsocial program window data
      const dexSocialProgram = Object.values(currentPrograms).find((p: any) => p.type === 'dexsocial');
      if (dexSocialProgram && dexSocialProgram.state) {
        dispatch(restoreFromProgramState(dexSocialProgram.state));
      }
    };
    
    migrateExistingData();
  }, []); // Run once on mount
  
  // Animation recovery for remote players/visitors
  const lastPlayerUpdate = useRef<{ [playerId: string]: number }>({});
  const animationRecoveryInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize movement controls for current player
  const { position: currentPlayerPosition, isMoving, movementDirection, walkFrame, nearbyIcon, desktopIcons, facingDirection, isGrabbing, isResizing, isSitting } = useMovement();

  const programsState = useAppSelector((state:any)=> state.programs);
  // Debounced persistence when programs or background change
  const lastSavedRef = useRef<any>(null);
  useEffect(() => {
    if (!authService.isAuthenticated()) return;
    if (visitedId && visitedId !== currentUserId) return;
    const state = programsState;
    if (!state) return;

    const prevState = lastSavedRef.current;

    // Detect program types that disappeared (all windows of that type closed)
    if (prevState && prevState.openPrograms) {
      const prevTypes = new Set(Object.values(prevState.openPrograms).map((p: any) => p.type));
      const currTypes = new Set(Object.values(state.openPrograms).map((p: any) => p.type));
      const removedTypes = Array.from(prevTypes).filter((t) => !currTypes.has(t));
      removedTypes.forEach((t) => authService.deleteProgramState(t));
    }

    // Skip save if nothing changed compared with last snapshot
    if (prevState && JSON.stringify(state) === JSON.stringify(prevState)) return;

    lastSavedRef.current = state;

    const timer = setTimeout(() => {
      // Save background
      authService.updateBackground(state.backgroundId);
      // Persist each open program window
      Object.values(state.openPrograms).forEach((p: any) => {
        authService.saveProgramState(
          p.type,
          p.position,
          p.size,
          p.zIndex,
          p.isMinimized,
          p.state || {}
        );
      });
    }, 1000); // debounce 1 s

    return () => clearTimeout(timer);
  }, [programsState, visitedId]);

  // Animation recovery system for remote players/visitors
  useEffect(() => {
    // Track animation health of remote entities
    animationRecoveryInterval.current = setInterval(() => {
      const now = Date.now();
      const entityMap = getEntityMap();
      Object.keys(entityMap).forEach(playerId => {
        if (playerId === currentPlayerId) return; // Skip current player
        
        const player = entityMap[playerId];
        const lastUpdate = lastPlayerUpdate.current[playerId] || 0;
        
        // If a player hasn't updated in 5 seconds and appears to be moving, they might be stuck
        if (player?.isMoving && (now - lastUpdate) > 5000) {
          // Force a visual refresh by dispatching a minimal update
          dispatch(updatePlayerPosition({
            playerId,
            position: player.position,
            isMoving: false, // Force stop moving to reset animation
            walkFrame: 1
          }));
        }
      });
    }, 3000); // Check every 3 seconds

    return () => {
      if (animationRecoveryInterval.current) {
        clearInterval(animationRecoveryInterval.current);
      }
    };
  }, [players, visitors, visitedId, currentPlayerId, dispatch]);

  // Track when players update to detect stale animations
  useEffect(() => {
    const entityMap = getEntityMap();
    Object.keys(entityMap).forEach(playerId => {
      if (playerId !== currentPlayerId) {
        lastPlayerUpdate.current[playerId] = Date.now();
      }
    });
  }, [players, visitors, visitedId, currentPlayerId]);

  // Background pattern mapping (dynamic)
  const getBackgroundPattern = (bgId: string) => {
    return patternsMap[bgId] || patternsMap['sandstone'];
  };

  // Persist desktop state and background on unload (refresh / close)
  useEffect(() => {
    const handleSave = () => {
      // Skip saving if currently visiting another dextop
      if (store.getState().dextop.visitedId) return;

      const state = store.getState().programs as any;
      const user = authService.getStoredUser();
      if (!user) return;

      // Save background
      authService.updateBackground(state.backgroundId);

      // Save each program window
      Object.values(state.openPrograms).forEach((p: any) => {
        authService.saveProgramState(
          p.type,
          p.position,
          p.size,
          p.zIndex,
          p.isMinimized,
          p.state || {}
        );
      });
    };

    window.addEventListener('beforeunload', handleSave);
    return () => {
      handleSave();
      window.removeEventListener('beforeunload', handleSave);
    };
  }, []);

  // Global hotkey T to open/focus chat (visible)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        if (e.repeat) return;

        const active = document.activeElement as HTMLElement | null;
        const isTyping = active && (
          active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          (active as any).isContentEditable
        );

        if (isTyping) {
          // Allow normal typing inside any text field or editable element
          return;
        }

        e.preventDefault();

        if (!isDexSocialOpen) {
          // Open and focus - always use local tab for T key (don't update lastManualTab)
          dispatch(setActiveTab('local'));
          setIsDexSocialOpen(true);
          setFocusChatSignal((s) => s + 1);
          setOpenedViaTKey(true);
        } else {
          // Chat open but input not focused: close it
          setIsDexSocialOpen(false);
          setOpenedViaTKey(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDexSocialOpen, dispatch]);

  // Trailer mode: hotkey U to open invisible local chat
  useEffect(() => {
    if (!trailerMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'u' || e.key === 'U') {
        if (e.repeat) return;

        const active = document.activeElement as HTMLElement | null;
        const isTyping = active && (
          active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          (active as any).isContentEditable
        );
        if (isTyping) return;

        e.preventDefault();

        // Toggle invisible chat
        setIsDexSocialHidden(true);
        dispatch(setActiveTab('local'));
        setIsDexSocialOpen(true);
        setFocusChatSignal((s)=>s+1);
        setOpenedViaTKey(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [trailerMode]);

  // Helper to provide entity map depending on context (dextop vs legacy room)
  const getEntityMap = () => {
    if (visitedId) return visitors;
    const merged: any = { ...players };
    const selfUserId = authService.getStoredUser()?.id;
    Object.entries(visitors).forEach(([id, v]: any) => {
      if (id !== currentPlayerId && id !== selfUserId) {
        merged[id] = v;
      }
    });
    // Ensure our own player data is present with full appearance
    if (selfPlayerData?.id && !merged[selfPlayerData.id]) {
      merged[selfPlayerData.id] = {
        id: selfPlayerData.id,
        username: selfPlayerData.username || 'You',
        position: selfPlayerData.position,
        quadrant: selfPlayerData.quadrant,
        isGaming: selfPlayerData.isGaming,
        gamingInputDirection: selfPlayerData.gamingInputDirection,
        appearance: selfPlayerData.appearance,
        isMoving: isMoving,
        movementDirection: movementDirection,
        walkFrame: walkFrame,
        facingDirection: facingDirection,
        isGrabbing: isGrabbing,
        isResizing: isResizing,
        isSitting: isSitting,
        vehicle: selfPlayerData.vehicle,
      };
    }
    return merged;
  };

  const socialNotifications = useAppSelector((state:any)=> state.social);
  const hasDexNotification = (socialNotifications.unreadMessages || socialNotifications.unreadFriendRequests) > 0;
  const notificationTarget = socialNotifications.lastNotification;
  const showWelcomeMessage = useAppSelector((state: any) => state.dextop.showWelcomeMessage);
  const [showWelcomeVideo, setShowWelcomeVideo] = useState(false);

  // Show welcome video on first load
  useEffect(() => {
    if (showWelcomeMessage && currentDextop && !visitedId) {
      setShowWelcomeVideo(true);
    }
  }, [showWelcomeMessage, currentDextop, visitedId]);

  const handleDexSocialToggle = () => {
    if (!isDexSocialOpen) {
      // About to open - preserve last tab unless there are notifications
      setOpenedViaTKey(false); // Not opened via T key
      console.log('Opening DexSocial, lastManualTab from Redux:', lastManualTab);
      if (hasDexNotification && notificationTarget) {
        // If there are notifications, switch to the notification tab
        console.log('Has notifications, switching to:', notificationTarget.tab);
        if (notificationTarget.tab === 'private' && notificationTarget.friendId) {
          dispatch(setSelectedFriend(notificationTarget.friendId));
        }
        dispatch(setActiveTab(notificationTarget.tab));
        // Update lastManualTab to remember this tab for next time
        dispatch(setLastManualTab(notificationTarget.tab));
      } else {
        // If no notifications, use the last manually selected tab
        console.log('No notifications, using lastManualTab:', lastManualTab);
        dispatch(setActiveTab(lastManualTab));
      }
    }
    setIsDexSocialOpen(!isDexSocialOpen);
  };

  const handleTabChange = (tab: 'friends' | 'local' | 'private' | 'dextop') => {
    // Update lastManualTab when user manually changes tabs
    console.log('Manual tab change to:', tab, '- updating Redux lastManualTab');
    dispatch(setLastManualTab(tab));
  };

  if (!roomId) {
    return null; // Don't show desktop if not in a room
  }

  return (
    <div 
      className="desktop-container"
      style={{ 
        backgroundImage: `url(${getBackgroundPattern(backgroundId)})`,
        backgroundRepeat: 'repeat',
        backgroundSize: 'auto'
      }}
    >
      {/* Render all player characters */}
      {Object.values(getEntityMap()).map((player: any) => {
        // Use local position for current player, server position for others
        const displayPlayer = player.id === currentPlayerId 
          ? { ...player, position: currentPlayerPosition }
          : player;
        
        return (
          <Character
            key={player.id}
            player={displayPlayer}
            isCurrentPlayer={player.id === currentPlayerId}
            isMoving={player.id === currentPlayerId ? isMoving : player.isMoving}
            movementDirection={player.id === currentPlayerId ? movementDirection : player.movementDirection}
            walkFrame={player.id === currentPlayerId ? walkFrame : player.walkFrame || 1}
            facingDirection={player.id === currentPlayerId ? facingDirection : player.facingDirection || 'left'}
            isGrabbing={player.id === currentPlayerId ? isGrabbing : player.isGrabbing || false}
            isResizing={player.id === currentPlayerId ? isResizing : player.isResizing || false}
            isSitting={player.id === currentPlayerId ? isSitting : player.isSitting || false}
            isGaming={player.id === currentPlayerId ? isGaming : player.isGaming || false}
            gamingInputDirection={player.id === currentPlayerId ? gamingInputDirection : player.gamingInputDirection || null}
          />
        );
      })}
      
      {/* Desktop Icons with proximity feedback */}
      {desktopIcons.filter(i=>!i.hidden).map((iconData) => (
        <DesktopIcon
          key={iconData.id}
          id={iconData.id}
          label={iconData.label}
          icon={iconData.icon}
          position={{ x: iconData.x, y: iconData.y }}
          isNearby={nearbyIcon === iconData.id}
          onInteract={() => {
            // Interaction handled in useMovement with E key; double-click fallback here.
            // Could open program directly:
          }}
        />
      ))}

      {/* All open program windows */}
      <ProgramManager />

      {/* DexSocial widget (only visible to current player) */}
      {isDexSocialOpen && (
        <>
          <div 
            className="room-info-backdrop" 
            onClick={() => setIsDexSocialOpen(false)}
          />
          <div className={`dex-social-widget${isDexSocialHidden ? ' invisible-chat' : ''}`}>
            {(() => {
              const initialTab = openedViaTKey ? 'local' : lastManualTab;
              console.log('DexSocial initialTab:', initialTab, 'openedViaTKey:', openedViaTKey, 'lastManualTab from Redux:', lastManualTab);
              return (
                <DexSocial
                  windowId="dex-social-widget"
                  position={{ x: 0, y: 0 }}
                  size={{ width: 600, height: 350 }}
                  zIndex={10000}
                  isMinimized={false}
                  programState={socialState}
                  onClose={() => { 
                    setIsDexSocialOpen(false); 
                    setIsDexSocialHidden(false);
                    setOpenedViaTKey(false);
                  }}
                  focusTrigger={focusChatSignal}
                  onTabChange={handleTabChange}
                  initialTab={initialTab}
                  forceLocalTab={openedViaTKey}
                />
              );
            })()}
          </div>
        </>
      )}
      
      {/* Room info popup (only when opened) */}
      {isRoomInfoOpen && (
        <>
          <div 
            className="room-info-backdrop" 
            onClick={() => setIsRoomInfoOpen(false)}
          />
          <div className="room-info-popup">
            <div className="room-info-header">
              <span>ℹ️ Room Information</span>
              <button 
                className="room-info-close"
                onClick={() => setIsRoomInfoOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="room-info-content">
              <div className="room-id">Room: {roomId}</div>
              <div className="player-count">Players: {Object.keys(getEntityMap()).length}/4</div>
              <div className="controls-hint">Use WASD to move</div>
              <div className="interaction-hint">
                {nearbyIcon ? `💡 Press E to open ${nearbyIcon}` : '💡 Walk close to icons and press E'}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Win98 Taskbar */}
      <div className="win98-taskbar">
        <div className="taskbar-left">
          <button 
            className="win98-start-button"
            onClick={() => setIsStartMenuOpen(!isStartMenuOpen)}
          >
            <span>🖥️</span>
            <span>Start</span>
          </button>
        </div>
        
        <div className="taskbar-right">
          <button 
            className={`room-info-button${hasDexNotification ? ' notify' : ''}`}
            onClick={handleDexSocialToggle}
            title="Dex Social"
          >
            {hasDexNotification ? '💬*' : '💬'}
          </button>
          <button 
            className="room-info-button"
            onClick={() => setIsRoomInfoOpen(!isRoomInfoOpen)}
            title="Room Information"
          >
            ℹ️
          </button>
          <MoneyDisplay />
          <SystemClock />
        </div>
      </div>

      {/* Start Menu */}
      <StartMenu 
        isOpen={isStartMenuOpen}
        onClose={() => setIsStartMenuOpen(false)}
        onChangeBackground={(id) => dispatch(setBackground(id))}
        currentBackground={backgroundId}
      />

      {/* Welcome Video */}
      {showWelcomeVideo && (
        <WelcomeVideo onClose={() => setShowWelcomeVideo(false)} />
      )}
    </div>
  );
};

export default Desktop; 