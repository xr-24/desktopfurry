import { io, Socket } from 'socket.io-client';
import { store } from '../store/store';
import { setConnected, joinRoom, updatePlayers, updatePlayerPosition, leaveRoom } from '../store/gameSlice';
import { setPlayer } from '../store/playerSlice';
import { syncDesktop } from '../store/programSlice';
import { v4 as uuidv4 } from 'uuid';
import { authService } from './authService';
import { loadDextopSuccess, updateVisitors, addVisitor, removeVisitor, setVisitedDextop, clearVisitedDextop, updateVisitorPosition, updateDextopInfo, clearDextop } from '../store/dextopSlice';
import { addLocalMessage, addPrivateMessage, addFriendRequest } from '../store/socialSlice';
import { audioService } from './audioService';

// Utility to deep compare objects by JSON stringify (cheap & ok for small state)
function jsonEqual(a: any, b: any) {
  return JSON.stringify(a) === JSON.stringify(b);
}

class SocketService {
  private socket: Socket | null = null;

  // Keep last sent desktop state so we only emit diffs
  private lastDesktopState: any = null;
  private lastPlayerState: any = null;
  // Flag to ignore local store updates that originated remotely
  private ignoreNextDesktopUpdate = false;
  
  // Add heartbeat and connection recovery
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  // Message handlers
  private messageHandlers: { [windowId: string]: (message: any) => void } = {};
  private friendStatusHandlers: { [windowId: string]: (friends: any) => void } = {};

  // Cache of owner desktop state
  private ownerDesktopCache: any = null;
  // Cache of owner dextop info (metadata)
  private ownerDextopInfoCache: any = null;
  private selfDextopId: string | null = null;
  // Track previously known players to detect newly joined players and resend cosmetics
  private knownPlayerIds: Set<string> = new Set();

  connect() {
    const serverUrl = process.env.REACT_APP_SOCKET_URL;

    const token = authService.getToken();

    this.socket = io(serverUrl, {
      // Add connection options for better reliability
      forceNew: true,
      timeout: 20000,
      transports: ['websocket', 'polling'],
      auth: {
        token: token || undefined,
      },
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
      store.dispatch(setConnected(true));
      this.reconnectAttempts = 0;
      this.startHeartbeat();

      // Preload notification sound
      audioService.initialize();
      audioService.loadSound('notif', '/assets/sounds/notif.wav');

      const tk = authService.getToken();
      if (tk) {
        this.socket!.emit('authenticate', tk);
        // Automatically join my own dextop as the main room
        const me = authService.getStoredUser();
        if (me && me.id) {
          this.socket!.emit('joinDextop', { token: tk, dextopId: me.id });
        }
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      store.dispatch(setConnected(false));
      this.stopHeartbeat();
      
      // Attempt reconnection if not manual disconnect
      if (reason !== 'io client disconnect' && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        setTimeout(() => {
          if (this.socket) {
            this.socket.connect();
          }
        }, 1000 * this.reconnectAttempts);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.log('Connection error:', error);
      store.dispatch(setConnected(false));
    });

    this.socket.on('roomJoined', (data: { roomId: string; playerId: string; username: string; quadrant: number }) => {
      store.dispatch(joinRoom(data.roomId));
      store.dispatch(setPlayer({ id: data.playerId, username: data.username, quadrant: data.quadrant }));
      const appearance = store.getState().player.appearance;
      if (appearance) setTimeout(() => this.updateAppearance(appearance), 0);

      // Ensure all local program windows are assigned to this player as controller
      const progSlice = store.getState().programs;
      const patchedOpen: any = {};
      let needsPatch = false;
      Object.values(progSlice.openPrograms).forEach((p: any) => {
        if (p.controllerId !== data.playerId) {
          needsPatch = true;
          patchedOpen[p.id] = { ...p, controllerId: data.playerId };
        } else {
          patchedOpen[p.id] = p;
        }
      });
      if (needsPatch) {
        const patchedState = { ...progSlice, openPrograms: patchedOpen };
        store.dispatch(syncDesktop(patchedState));
        // Send patched version to server to sync others
        if (this.socket) {
          this.socket.emit('desktopStateUpdate', { roomId: data.roomId, desktopState: patchedState });
          this.lastDesktopState = patchedState;
        }
      }
    });

    this.socket.on('playersUpdate', (players: any) => {
      // Detect if any new players have joined that we have not seen before
      const incomingIds = Object.keys(players || {});
      const hasNewPlayer = incomingIds.some(id => !this.knownPlayerIds.has(id));
      store.dispatch(updatePlayers(players));
      // Update our local snapshot
      this.knownPlayerIds = new Set(incomingIds);

      // If someone new joined the room, broadcast our cosmetics again so they receive them
      if (hasNewPlayer) {
        this.broadcastCosmetics();
      }
    });

    this.socket.on('playerMoved', (data: any) => {
      store.dispatch(updatePlayerPosition(data));
    });

    // Prime lastDesktopState with current slice
    this.lastDesktopState = store.getState().programs;

    // Reset so first subscriber tick sends full state, guaranteeing others get cosmetics
    this.lastPlayerState = null as any;

    // Subscribe once to program slice changes to broadcast
    const sanitize = (progState:any) => {
      const clone = JSON.parse(JSON.stringify(progState));
      for (const id of Object.keys(clone.openPrograms)) {
        const t = clone.openPrograms[id].type;
        if (t === 'characterEditor' || t === 'inventory') {
          delete clone.openPrograms[id];
        }
      }
      return clone;
    };

    const sendDesktopState = () => {
      if (this.ignoreNextDesktopUpdate) return;
      const raw = store.getState().programs;
      const state = sanitize(raw);
      if (jsonEqual(state, sanitize(this.lastDesktopState))) return;

      if (!this.socket) return;

      // Determine if we are owner or visitor in a dextop session
      const dextopState = store.getState().dextop;
      const dextopId = dextopState.current?.id || dextopState.visitedId;

      if (dextopId) {
        // Send via unified dextop channel regardless of owner/visitor
        this.socket.emit('dextopStateUpdate', { dextopId, desktopState: state });
      } else {
        // Legacy room fallback
        const roomId = store.getState().game.roomId;
        if (roomId) this.socket.emit('desktopStateUpdate', { roomId, desktopState: state });
      }
      this.lastDesktopState = state;
    };

    store.subscribe(sendDesktopState);

    // Subscribe once to player slice changes to broadcast gaming state
    const sendPlayerState = () => {
      const rootState = store.getState();
      const player = rootState.player;

      // Guard: avoid broadcasting placeholder visitor packets before the client
      // has received its definitive player ID from the server. Emitting with a
      // null / undefined userId causes the server to create an "unknown" visitor
      // entry that lingers until page reload. Only proceed once we have a valid
      // player.id.
      if (!player.id) {
        return;
      }
      const inventory = rootState.inventory;
      const equippedTitleFull = inventory.currentTitleId ? inventory.titles.find((t:any)=>t.id===inventory.currentTitleId) : null;
      const equippedItemsFull = inventory.currentItemIds.map((id:string)=>{
        const itm = inventory.items.find((i:any)=>i.id===id);
        return itm ? { id: itm.id, name: itm.name, asset_path: itm.asset_path } : { id } as any;
      });
      // Build a minimal object representing the fields we care about broadcasting
      const payloadFingerprint = {
        isGaming: player.isGaming,
        dir: player.gamingInputDirection,
        veh: player.vehicle,
        spd: player.speedMultiplier,
        items: inventory.currentItemIds,
        title: inventory.currentTitleId,
        titleHash: equippedTitleFull ? JSON.stringify({id:equippedTitleFull.id,style:equippedTitleFull.style_config}) : 'none',
        eqHash: JSON.stringify(equippedItemsFull.map(e=>e.asset_path||e.id)),
      };
      const commonPayloadFields = {
        isGaming: player.isGaming,
        gamingInputDirection: player.gamingInputDirection,
        vehicle: player.vehicle,
        speedMultiplier: player.speedMultiplier,
        currentItemIds: inventory.currentItemIds,
        currentTitleId: inventory.currentTitleId,
        equippedTitle: equippedTitleFull,
        equippedItems: equippedItemsFull,
      };

      // Skip compare on very first run so initial state is broadcast
      if (this.lastPlayerState && jsonEqual(payloadFingerprint, this.lastPlayerState)) return;

      // Determine context: legacy room or dextop session (owner or visitor)
      const dextopId = rootState.dextop.visitedId || rootState.dextop.current?.id;
      if (dextopId && this.socket) {
        // In dextop context broadcast via dedicated visitor channel
        this.socket.emit('visitorStateUpdate', { dextopId, userId: player.id, ...commonPayloadFields });
        this.lastPlayerState = payloadFingerprint;
        return;
      }

      // Legacy room context
      const roomId = rootState.game.roomId;
      if (roomId && this.socket) {
        this.socket.emit('playerStateUpdate', { roomId, playerId: player.id, ...commonPayloadFields });
        this.lastPlayerState = payloadFingerprint;
      }
    };

    store.subscribe(sendPlayerState);

    // Add new socket event handlers for social features
    this.socket.on('dextopMessage', (message: any) => {
      const currentUserId = authService.getStoredUser()?.id || '';
      store.dispatch(addLocalMessage({ message, currentUserId }));
      Object.values(this.messageHandlers).forEach(handler => handler(message));
      if (message.senderId !== currentUserId) {
        audioService.resume();
        audioService.playSound('notif');
      }
    });

    this.socket.on('localMessage', (message: any) => {
      const currentUserId = authService.getStoredUser()?.id || '';
      store.dispatch(addLocalMessage({ message, currentUserId }));
      Object.values(this.messageHandlers).forEach(handler => handler(message));
      if (message.senderId !== currentUserId) {
        audioService.resume();
        audioService.playSound('notif');
      }
    });

    this.socket.on('privateMessage', (message: any) => {
      const currentUserId = authService.getStoredUser()?.id || '';
      store.dispatch(addPrivateMessage({ message, currentUserId }));
      Object.values(this.messageHandlers).forEach(handler => handler(message));
      if (message.senderId !== currentUserId) {
        audioService.resume();
        audioService.playSound('notif');
      }
    });

    this.socket.on('friendStatusUpdate', (friends: any) => {
      Object.values(this.friendStatusHandlers).forEach(handler => handler(friends));
    });

    // Handle offline messages received on connection
    this.socket.on('offlineMessages', (messages: any[]) => {
      console.log('Received offline messages:', messages);
      const currentUserId = authService.getStoredUser()?.id;
      
      messages.forEach(message => {
        if (message.senderId !== currentUserId) {
          store.dispatch(addPrivateMessage({ message, currentUserId }));
        }
      });
    });

    // Handle offline friend requests received on connection
    this.socket.on('offlineFriendRequests', (requests: any[]) => {
      console.log('Received offline friend requests:', requests);
      
      requests.forEach(request => {
        store.dispatch(addFriendRequest({
          id: request.id,
          from: request.from,
          username: request.username
        }));
      });
    });

    this.socket.on('friendRequest', (data: { requestId: string; from: string; username: string }) => {
      // Store request and notify
      store.dispatch(addFriendRequest({ id: data.requestId, from: data.from, username: data.username }));
      audioService.resume();
      audioService.playSound('notif');
    });

    this.socket.on('friendRequestAccepted', (data: { friend: any; friendsList?: any }) => {
      // Update friends list with the complete updated list
      if (data.friendsList) {
        Object.values(this.friendStatusHandlers).forEach(handler => 
          handler(data.friendsList)
        );
      } else {
        // Fallback to just updating the single friend
        Object.values(this.friendStatusHandlers).forEach(handler => 
          handler({ [data.friend.id]: data.friend })
        );
      }
    });

    this.socket.on('joinDextopByCode', ({ code }) => {
      console.log('Server instructed to join dextop', code);
      const tk2 = authService.getToken();
      if (tk2 && this.socket) {
        this.socket.emit('joinDextop', { token: tk2, dextopId: code });
      }
    });

    // Handle dextop visitor system
    this.socket.on('dextopJoined', async ({ dextopId, userId, username }) => {
      console.log('Joined dextop', dextopId);

      const myUserId = authService.getStoredUser()?.id;
      const isMe = userId === myUserId; // Whether the socket event refers to the current logged-in user

      // Record my personal dextop id the FIRST time I hear about it so we can differentiate later
      if (isMe && !this.selfDextopId) {
        this.selfDextopId = dextopId;
      }

      // Am I (the current user) returning to my OWN dextop?
      const isReturningHome = dextopId === this.selfDextopId;

      if (isReturningHome) {
        // Returning home
        if (this.ownerDesktopCache) {
          store.dispatch(syncDesktop(this.ownerDesktopCache));
          this.ownerDesktopCache = null;
        }
        if (this.ownerDextopInfoCache) {
          store.dispatch(updateDextopInfo({ ...this.ownerDextopInfoCache, isOwner: true }));
          this.ownerDextopInfoCache = null;
        } else {
          store.dispatch(updateDextopInfo({ id: dextopId, isOwner: true }));
        }
        store.dispatch(clearVisitedDextop());
        store.dispatch(joinRoom(dextopId));
        store.dispatch(setPlayer({ id: userId, username, quadrant: 0 }));
        // Ensure all program windows have correct controllerId
        const progSliceOwner = store.getState().programs;
        const patchedOpenOwner: any = {};
        let needsPatchOwner = false;
        Object.values(progSliceOwner.openPrograms).forEach((p: any) => {
          if (p.controllerId !== userId) {
            needsPatchOwner = true;
            patchedOpenOwner[p.id] = { ...p, controllerId: userId };
          } else {
            patchedOpenOwner[p.id] = p;
          }
        });
        if (needsPatchOwner) {
          const patchedStateOwner = { ...progSliceOwner, openPrograms: patchedOpenOwner };
          store.dispatch(syncDesktop(patchedStateOwner));
        }
        return;
      }

      // Visiting someone else
      // Cache current owner desktop once
      if (!this.ownerDesktopCache) {
        this.ownerDesktopCache = store.getState().programs;
        this.ownerDextopInfoCache = store.getState().dextop.current;
      }

      const data = await authService.visitDextop(dextopId);
      if (!data) return;

      store.dispatch(setVisitedDextop(dextopId));
      store.dispatch(loadDextopSuccess({
        dextop: { ...data.dextop, isOwner: false },
        achievements: [],
        unlockedPrograms: data.unlockedPrograms || []
      }));

      const openPrograms: any = {};
      let highestZ = 100;
      for (const p of data.programs) {
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
      store.dispatch(syncDesktop({
        openPrograms,
        highestZIndex: highestZ,
        interactionRange: 80,
        backgroundId: data.dextop.backgroundId || 'sandstone',
      }));

      store.dispatch(joinRoom(dextopId));
      store.dispatch(setPlayer({ id: userId, username, quadrant: 0 }));
      // After joining a dextop (as owner or visitor), broadcast our current cosmetics so everyone sees them
      setTimeout(() => this.broadcastCosmetics(), 0);
    });

    this.socket.on('visitorsUpdate', (visitors:any)=>{
      store.dispatch(updateVisitors(visitors.reduce((acc:any,v:any)=>{acc[v.id]=v;return acc;},{})));
    });
    this.socket.on('visitorJoined', (visitor:any)=>{
      store.dispatch(addVisitor(visitor));
      // A new visitor appeared on the current dextop – resend cosmetics so they see them
      this.broadcastCosmetics();
    });
    this.socket.on('visitorLeft', ({userId}:any)=>{
      store.dispatch(removeVisitor({userId}));
    });

    this.socket.on('visitorMoved', (payload: any) => {
      const { userId, ...rest } = payload;
      store.dispatch(updateVisitorPosition({
        userId,
        ...rest
      }));
    });

    this.socket.on('visitorStateUpdate', (payload: any) => {
      const { userId, ...rest } = payload;
      store.dispatch(updateVisitorPosition({
        userId,
        ...rest,
      }));
    });

    // Receive full desktop state from server (legacy rooms)
    const handleIncomingDesktop = (desktopState:any) => {
      // Sanitize incoming state (remove CharacterEditor sessions)
      for (const id of Object.keys(desktopState.openPrograms || {})) {
        const t = desktopState.openPrograms[id].type;
        if (t === 'characterEditor' || t === 'inventory') {
          delete desktopState.openPrograms[id];
        }
      }

      this.ignoreNextDesktopUpdate = true;
      this.lastDesktopState = desktopState;
      store.dispatch(syncDesktop(desktopState));
      setTimeout(() => { this.ignoreNextDesktopUpdate = false; }, 0);
    };

    this.socket.on('desktopState', handleIncomingDesktop);
    this.socket.on('dextopState', handleIncomingDesktop);
  }

  createRoom(username: string) {
    if (this.socket) {
      this.socket.emit('createRoom', { username });
    }
  }

  joinExistingRoom(roomId: string, username: string) {
    if (this.socket) {
      this.socket.emit('joinRoom', { roomId, username });
    }
  }

  movePlayer(data: {
    position: { x: number; y: number };
    isMoving: boolean;
    movementDirection: string | null;
    walkFrame: number;
    facingDirection: 'left' | 'right';
    isGrabbing?: boolean;
    isResizing?: boolean;
    isSitting?: boolean;
    vehicle?: 'none' | 'ufo';
    speedMultiplier?: number;
  }) {
    if (!this.socket || !this.socket.connected) return;

    const timestampedData = { ...data, timestamp: Date.now() };

    // Treat both owners (current) and visitors (visitedId) as being in a dextop
    const dextopState = store.getState().dextop;
    const inDextop = !!dextopState.current || !!dextopState.visitedId;

    if (inDextop) {
      this.socket.emit('dextopPlayerMove', timestampedData);
    } else {
      this.socket.emit('playerMove', timestampedData);
    }
  }

  updateAppearance(appearance: { hue: number; eyes: string; ears: string; fluff: string; tail: string }) {
    const roomId = store.getState().game.roomId;
    const playerId = store.getState().player.id;
    if (this.socket && roomId && playerId) {
      this.socket.emit('appearanceUpdate', { roomId, playerId, appearance });
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Add heartbeat and connection recovery
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket) {
        this.socket.emit('heartbeat');
      }
    }, 10000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // New methods for social features
  registerMessageHandler(windowId: string, handler: (message: any) => void) {
    this.messageHandlers[windowId] = handler;
  }

  unregisterMessageHandler(windowId: string) {
    delete this.messageHandlers[windowId];
  }

  registerFriendStatusHandler(windowId: string, handler: (friends: any) => void) {
    this.friendStatusHandlers[windowId] = handler;
  }

  unregisterFriendStatusHandler(windowId: string) {
    delete this.friendStatusHandlers[windowId];
  }

  sendLocalMessage(content: string) {
    if (!this.socket) return;
    
    const stateRoot = store.getState();
    const message = {
      id: uuidv4(),
      sender: stateRoot.auth.user?.username,
      senderId: stateRoot.auth.user?.id,
      content,
      timestamp: Date.now(),
      type: 'local' as const,
      color: stateRoot.player.chatColorHue,
    };

    const dextopId = (stateRoot.dextop.current as any)?.id || stateRoot.dextop.visitedId;

    if (dextopId) {
      // In dextop session, broadcast via dedicated channel
      this.socket.emit('dextopMessage', {
        dextopId,
        message
      });
    } else {
      // Legacy room chat
      this.socket.emit('localMessage', {
        roomId: stateRoot.game.roomId,
        message
      });
    }
  }

  sendPrivateMessage(recipientId: string, content: string) {
    if (!this.socket) return;

    const stateRoot = store.getState();
    const message = {
      id: uuidv4(),
      sender: stateRoot.auth.user?.username,
      senderId: stateRoot.auth.user?.id,
      content,
      timestamp: Date.now(),
      type: 'private' as const,
      recipientId,
      color: stateRoot.player.chatColorHue,
    };

    this.socket.emit('privateMessage', {
      recipientId,
      message
    });
  }

  sendFriendRequest(username: string) {
    if (!this.socket) return;
    this.socket.emit('friendRequest', { username });
  }

  // Public helper to immediately broadcast full cosmetics (items + title)
  broadcastCosmetics() {
    const rootState = store.getState();
    const player = rootState.player;
    const inventory = rootState.inventory;
    if (!player?.id || !this.socket) return;

    const equippedItemsFull = inventory.currentItemIds.map((id:string)=>{
      const itm = inventory.items.find((i:any)=>i.id===id);
      return itm ? { id: itm.id, name: itm.name, asset_path: itm.asset_path } : { id } as any;
    });
    const equippedTitleFull = inventory.currentTitleId ? inventory.titles.find((t:any)=>t.id===inventory.currentTitleId) : null;

    const payloadCommon = {
      isGaming: player.isGaming,
      gamingInputDirection: player.gamingInputDirection,
      vehicle: player.vehicle,
      speedMultiplier: player.speedMultiplier,
      currentItemIds: inventory.currentItemIds,
      currentTitleId: inventory.currentTitleId,
      equippedTitle: equippedTitleFull,
      equippedItems: equippedItemsFull,
    };

    const dextopId = rootState.dextop.visitedId || rootState.dextop.current?.id;
    if (dextopId) {
      this.socket.emit('visitorStateUpdate', { dextopId, userId: player.id, ...payloadCommon });
    } else {
      const roomId = rootState.game.roomId;
      if (roomId) {
        this.socket.emit('playerStateUpdate', { roomId, playerId: player.id, ...payloadCommon });
      }
    }
  }

  acceptFriendRequest(requestId: string) {
    if (!this.socket) return;
    this.socket.emit('acceptFriendRequest', { requestId });
  }

  rejectFriendRequest(requestId: string) {
    if (!this.socket) return;
    this.socket.emit('rejectFriendRequest', { requestId });
  }

  getFriendsList() {
    if (!this.socket) return;
    this.socket.emit('getFriendsList');
  }

  joinFriendDextop(friendId: string) {
    if (!this.socket) return;
    this.socket.emit('joinFriendDextop', { friendId });
  }

  leaveDextop() {
    // Graceful disconnect then reload page to ensure completely fresh state
    try {
      this.disconnect();
    } finally {
      window.location.reload();
    }
  }

  authenticate() {
    const tk = authService.getToken();
    if (this.socket && tk) {
      this.socket.emit('authenticate', tk);

      // Ensure we (re)join our own dextop after late authentication.
      // This covers the case where the socket connected before the user logged in
      // (no token yet), so the initial automatic joinDextop never fired.
      const me = authService.getStoredUser();
      if (me && me.id) {
        this.socket.emit('joinDextop', { token: tk, dextopId: me.id });
      }
    }
  }
}

export const socketService = new SocketService();

// Expose for debugging in browser console
if (typeof window !== 'undefined') {
  (window as any).socketService = socketService;
} 