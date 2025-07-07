# 📦  Adding New Programs to **Retro-Desktop-Game**

This file is a living "how-to" for dropping a new app ("Program") onto the Binbows-95 desktop.  Follow the numbered checklist and you will inherit *all* the plumbing (window chrome, z-index, network sync, persistence, achievements) for free.

---
## 1.  TL;DR – 6-Step Checklist

1. **Extend the type union**  
   `src/store/programSlice.ts → export interface ProgramWindow['type']`
2. **Add a default config**  
   Same file, inside the `programConfigs` map (width/height, `isMultiplayer`).
3. **Create your component** under `src/components/programs/YourProgram.tsx`  
   Wrap *all* UI in `<ProgramWindow …>` and consume:
   ```tsx
   interface Props {
     windowId; position; size; zIndex; isMinimized;
     programState; controllerId; currentPlayerId;
   }
   ```
4. **Switch-case** – add `case 'yourProgram'` inside `ProgramManager.tsx`.
5. **Desktop access**  
   • For a permanent icon: add entry in `DESKTOP_ICONS` array inside `useMovement.ts`.  
   • For Start-Menu only: add a menu item that dispatches `openProgram({ type:'yourProgram', controllerId })`.
6. **(Optional) Gate unlock**  
   Add the string to `dextopSlice.initialState.unlockedPrograms` *or* unlock via an achievement.

> ✅  After step 4 the window will spawn, drag, resize, minimize, save / restore on refresh and broadcast to the network automatically.

---
## 2.  Program *Flavours*
Different apps need slightly different rules.  Pick the template that fits.

| Flavour                           | Example(s)        | Key Rules |
|----------------------------------|-------------------|-----------|
| **Local-Only** (owner sees only) | CharacterEditor   | `isMultiplayer:false`, *never* write large binary blobs to Redux.  Add its `type` to the **sanitize** function in `socketService` so it is stripped before broadcasting. |
| **Single-Controller + Spectators** | Notepad, Winamp   | `controllerId` decides who edits.  UI should disable inputs when `controllerId !== currentPlayerId`.  Use `updateProgramState` for changes; spectators receive read-only sync. |
| **Fully Multiplayer**            | Paint (shared canvas) | Set `isMultiplayer:true`.  ANY player may dispatch `updateProgramState`; keep updates small/throttled. |
| **Gaming (locks movement)**      | Snake, future Pong | Host must dispatch `setGamingState({ isGaming:true, inputDirection })`.  On game-over or window close, dispatch `setGamingState({ isGaming:false })`.  The component is responsible for WASD capture & sit animation cues. |

---
## 3.  `ProgramWindow` Props Recap
```txt
windowId           // unique key – pass directly from props
position, size     // respect & update via updateProgramPosition / updateProgramSize
zIndex             // immutable from inside program
isMinimized        // if true, return null
controllerId       // player who can mutate state
currentPlayerId    // id of *this* client's player (use to gate inputs)
programState       // your serialized Redux state slice
```

### Changing State
Use the `updateProgramState` action; **never** mutate local Redux directly.
```ts
dispatch(updateProgramState({ windowId, newState: { field: value } }));
```

---
## 4.  Networking & Persistence Cheatsheet

* **Window geometry** is auto-saved via Desktop's debounced effect → `authService.saveProgramState`.  Do *nothing*.
* **Program data** – whatever you stash in `programState` is included in the same save call.
* **Sanitising** – heavy private data?  Modify the `sanitize()` helper in `socketService` to strip it before emitting.
* **Throttling** – use `const UPDATE_INTERVAL = 50` pattern (see `Paint` & `Snake`).

---
## 5.  Achievements / Unlocks (Optional)
```ts
import { authService } from '…/services/authService';
// Example: unlock when score >= 200
if (score >= 200) authService.unlockAchievement('SNAKE_EXPERT', { score });
```
Unlock codes are defined in `database/schema.sql → achievements`.

---
## 6.  Common Patterns & Helpers

* **Proximity "E" key** – reuse `findNearbyWindow` from `useMovement` if your program needs to start from idle/title screen (see Snake).
* **Grab / Resize** – nothing special to add.  ProgramWindow already supplies resize handle; if you need in-world grabbing behaviour just observe `isGrabbing` prop sent from `useMovement`.
* **Audio** – preload sounds in `audioService`, then `audioService.playSound('notif')`.
* **YouTube** – copy the lazy `loadYouTubeAPI()` helper from Winamp / BDEMediaPlayer.

---
## 7.  File & Folder Conventions
* Component lives in `src/components/programs/YourProgram.tsx`.
* Static assets → `public/assets/yourProgram/…` (served directly) or import via Webpack.
* CSS goes in `src/styles` with `.css` suffix and is imported at top of component **before** `ProgramWindow` import (Win95 CSS expects cascade order).

---
## 8.  Smoke-Test Your App
1. Open as host – verify full interaction.
2. Open second browser as spectator – confirm sync / read-only visuals.
3. Refresh host – ensure window reappears with position & state.
4. Minimize & restore – state should persist.
5. Close, re-open – initial state should be fresh (unless you intentionally persisted data).
6. Visit another player's dextop – ensure sanitize rules hide local-only apps.

If those six tests pass, your program is "plug-n-play" compatible.

---
## 9.  Real-Time Game Loop Pattern  (copy from **Snake**)

Need a moving ball, paddle or Tetromino that *everyone* can watch?  Follow the **Snake** template:

1. **Local refs for smoothness**  
   Keep authoritative game objects (positions, velocities, score) in a `useRef()` object (e.g. `gameStateRef`).  This avoids 60 fps React re-renders.
2. **Controller vs. Spectator**  
   ```ts
   const isHost = controllerId === currentPlayerId;
   ```
   • Host updates the ref every tick and decides when to push snapshots.  
   • Spectators read *only* from `programState`.
3. **Throttle snapshots**  
   ```ts
   const SYNC_INTERVAL = 100; // ms
   const lastSync = useRef(0);
   if (isHost && now - lastSync.current > SYNC_INTERVAL) {
     dispatch(updateProgramState({ windowId, newState: snapshot }));
     lastSync.current = now;
   }
   ```
   The snapshot should be **small** (board array, scores, direction).  Heavy refs (e.g. full canvas pixel data) stay local.
4. **Gaming posture & input broadcast**  
   Host sets `setGamingState({ isGaming:true, inputDirection })` every frame so other clients can draw the sit-and-game animation over the avatar.  On game-over send `isGaming:false`.
5. **Spectator render path**  
   ```ts
   const source = isHost ? gameStateRef.current : programState;
   drawCanvas(source);
   ```
6. **Edge cases**  
   • On host disconnect, whoever opens the window next becomes the new controller (your existing controllerId design already handles this).  
   • If you need deterministic sync (Pong, Tetris), include `timestamp` in snapshot so spectators can interpolate.

> **Drop-in template:** copy `Snake.tsx`, strip the game logic, keep the skeleton (`isHost`, refs, snapshot throttling) and you have a ready-made multiplayer loop.

---
Happy hacking!  🍻 