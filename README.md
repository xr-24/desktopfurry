# Retro-Desktop Game

A web-based, multiplayer "operating-system" sandbox that recreates a late-90s desktop experience in the browser.  Each user controls a pixel-pet avatar, can open classic Win-98-style program windows (Notepad, Paint, Winamp, Snake, etc.), visit friends' "dextops", chat, and earn achievements that unlock new programs.

---

## 1. Project Goals

1. **Social sandbox** – persistent personal desktop that others can visit in real-time.
2. **Mini-games & apps** – each window is its own React program; many are multiplayer-aware.
3. **Customization & progression** – avatar editor, wallpapers, achievements, unlockable software.
4. **100 % web-tech** – no plugins; React + TypeScript front-end, Node/Express + PostgreSQL back-end, Socket.IO for low-latency sync.

---

## 2. Tech Stack

| Layer            | Library / Tooling                      |
|------------------|----------------------------------------|
| **Front-end**    | React 18, TypeScript, Redux Toolkit, Socket.IO-client, HTML5 Canvas, CSS-modules (Win-98 skin) |
| **Back-end**     | Node 18, Express 4, Socket.IO 4, bcrypt, jsonwebtoken |
| **Database**     | PostgreSQL 14 (SQL schema in `database/schema.sql`) |
| **Build / Dev**  | Vite + CRA scripts, ESLint, Prettier |

---

## 3. Repository Layout (key folders)

```
retro-desktop-game/
│  README.md                ← (this file)
│  package.json             ← front-end dependencies & scripts
│  tsconfig.json            ← TypeScript setup
│
├─ public/                  ← static assets served as-is
│   └─ assets/characters/   ← sprite sheets (body, ears, eyes, …)
│
├─ src/                     ← front-end source
│   ├─ components/          ← React UI & program windows
│   │   ├─ programs/        ← Mini-apps (Snake, Paint, …)
│   │   └─ …
│   ├─ hooks/               ← Custom React hooks (`useMovement`)
│   ├─ services/            ← API / socket / audio helpers
│   ├─ store/               ← Redux slices & typed hooks
│   └─ styles/              ← Win-98 CSS & misc. stylesheets
│
└─ server/                  ← back-end service
    ├─ routes/              ← REST endpoints (`/api/*`)
    ├─ database.js          ← PG query helpers
    ├─ auth.js              ← JWT & auth helpers
    └─ server.js            ← Socket.IO & Express bootstrap
```

---

## 4. Front-End Architecture

### 4.1  State Management (Redux Toolkit)

Slice             | Purpose
------------------|---------------------------------------------------------------
`authSlice`       | Login / guest sessions (JWT in localStorage)
`playerSlice`     | Current player avatar, position, gaming & sitting flags
`gameSlice`       | Legacy "room" player map + connection status
`programSlice`    | Window manager – open windows, z-index, sizes, background
`dextopSlice`     | Cross-desktop sessions (owner info & visitors)
`socialSlice`     | Chat, friends list, notifications

All slices are combined in `store.ts` and the store is exposed on `window.store` for debugging.

### 4.2  Movement & Avatars
* **`useMovement` hook** – handles keyboard control, collision with windows, grabbing/resize, sitting, and throttled socket emission (20 fps).  
* **`Character` component** – renders layered PNG sprites, hue-shifted per user appearance, with animation fall-backs for low network conditions.

### 4.3  Program Windows
* `ProgramWindow` is a draggable / resizable shell that mimics Win-98 chrome.  
* Each app in `components/programs/` receives controller / spectator props and persists its own state inside `programSlice.openPrograms[id].state`.

### 4.4  Real-time Sync
* `socketService.ts` wraps Socket.IO events, keeps local diff caches, sends:
  * **`playerMove`** – avatar pos & animation flags
  * **`desktopStateUpdate` / `dextopStateUpdate`** – window manager snapshots
  * Chat, friend, appearance updates …
* Heartbeat + reconnection strategies included.

---

## 5. Back-End Architecture

File                | Role
------------------- | ----------------------------------------
`server.js`         | Creates Express app, HTTP/WS server, Room & Dextop maps
`routes/*`          | REST endpoints (auth, dextop CRUD, user search)
`database.js`       | PG pool + helper methods (users, programs, achievements)
`auth.js`           | Password hashing, JWT issuing, guest logic, Express middleware

### 5.1  Socket Channels
Event                     | Payload
--------------------------|-------------------------
`joinDextop / joinRoom`   | identifies user / room
`playerMoved`             | position & animation flags
`desktopState`            | full programSlice clone
`visitorStateUpdate`      | gaming input & misc. flags
…and many others for chat & friends.

### 5.2  SQL Schema Highlights
* `users`, `dextops`, `program_states`, `achievements`, `user_achievements`, `avatar_appearances`, `friendships`, `dextop_visits`.
* `TRIGGER` auto-creates a dextop row on user insert.
* Achievements can unlock new program types via `unlocks_program` column.

---

## 6. Running Locally

### 6.1 Prerequisites
* Node ≥ 18 & npm
* PostgreSQL 14 (or compatible)

### 6.2 Environment vars (create `.env` in `/server`)
```
DATABASE_URL=postgresql://user:pass@localhost:5432/desktopgame
JWT_SECRET=your-dev-secret
CLIENT_ORIGIN=http://localhost:3000
```

### 6.3 Setup Steps
```bash
# 1. install deps
npm install          # front-end
cd server && npm install  # back-end

# 2. init database
psql -U user -d desktopgame -f database/schema.sql

# 3. start both services (two terminals)
npm start            # front-end on :3000
cd server && node server.js   # back-end on :3001
```
Visit http://localhost:3000, create a guest account, and explore.

---

## 7. Contributing Guide
1. **Branch from `main`**, follow feature-branch naming (`feat/paint-undo`, `fix/socket-timeout`).
2. Run `npm run lint` and ensure no ESLint errors.
3. Write unit tests where business-logic is added (Jest + React-Testing-Library).
4. Submit PR; CI will build, lint, and run basic e2e.

---

## 8. Cheat-Sheet for New Devs
| Task | Where to look |
|------|---------------|
| Add a new mini-app window | `src/components/programs/`, update `ProgramManager.tsx`, `programSlice.getProgramInitialState()` |
| Tweak avatar sprites | `public/assets/characters/*` naming must match `Character` rules |
| Change wallpaper list | `src/assets/patterns/` + update mapping in `Desktop.tsx` |
| Add achievement logic | server `database.js` (unlock) + insert into `database/schema.sql` |
| Add REST endpoint | `server/routes/` – wire into `server.js` |
| Real-time event | Define in `server/server.js` and mirror handler in `src/services/socketService.ts` |

Happy hacking!  Reach out in `DexSocial` local chat or open an Issue for help.
