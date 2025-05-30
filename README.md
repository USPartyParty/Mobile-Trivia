# Taps Tokens Trivia  
Ride-Share Trivia Game System

---

## 1. Project Overview & Goals
Taps Tokens Trivia is a two-part web application designed to entertain ride-share passengers with real-time trivia.  
• **Tablet Display (in-car)** shows questions, scores, and a QR code when idle.  
• **Mobile Interface (rider phones)** lets players join via QR, answer questions, and view results.  
• **Admin Panel (driver-only)** enables quick session resets between rides.  

Primary goals  
1. Deliver a seamless, latency-free trivia experience that works without native apps.  
2. Support single-ride isolated sessions created by a unique QR code.  
3. Provide an extensible trivia engine and leaderboard with minimal driver interaction.  

---

## 2. Architecture Overview
```
+---------------+        WebSocket        +---------------------+
|  Tablet App   | <---------------------> |  Backend API / WS   |
| (React)       |                        | (Node.js/Express)   |
+-------+-------+                        +----+------------+---+
        ^                                      ^            ^
        | QR Scan                              |            |
        |                                      |            |
+-------+-------+                      +-------+-------+ +--+-----------+
|  Mobile App   |  <---- WebSocket --->|  Leaderboard  | | Admin Panel  |
| (React PWA)   |                      |  (MongoDB)    | | (React SPA)  |
+---------------+                      +---------------+ +--------------+
```
• **Front-end**: Separate React SPAs for tablet, mobile, and admin, sharing a component library.  
• **Backend**: Express server exposes REST endpoints and Socket.IO namespace for real-time game flow.  
• **Database**: MongoDB for session metadata & leaderboard.  
• **Deployment**: Single container / serverless functions + static front-end hosting.

---

## 3. Tech Stack
| Layer            | Technology |
|------------------|------------|
| Front-end        | React 18, Vite, Tailwind CSS |
| Real-time comms  | Socket.IO |
| Back-end         | Node.js 20 + Express 4 |
| Database         | MongoDB Atlas (or local Mongo) |
| Build / Dev      | PNPM, ESLint, Prettier, Husky |
| Deployment       | Docker, GitHub Actions (demo), Render / Fly.io / Railway |

---

## 4. Quick-Start Instructions

Prerequisites: **Node >= 20**, **PNPM >= 8**, and optionally **MongoDB** running locally.

```bash
# 1. Clone repository
git clone https://github.com/<your-org>/taps-tokens-trivia.git
cd taps-tokens-trivia

# 2. Install all workspaces
pnpm install

# 3. Start dev services
pnpm dev          # concurrently starts tablet, mobile, admin, and backend

# 4. Open apps
Tablet UI : http://localhost:5173
Mobile UI : http://localhost:5174
Admin UI  : http://localhost:5175
API / WS  : http://localhost:3000
```

---

## 5. Project Structure
```
.
├─ apps/
│  ├─ tablet/    # React app optimised for landscape tablet
│  ├─ mobile/    # React PWA for phones
│  └─ admin/     # Driver/admin SPA
├─ packages/
│  ├─ ui/        # Shared React components + Tailwind config
│  └─ logic/     # Trivia engine (question rotation, scoring)
├─ server/       # Node.js/Express + Socket.IO + MongoDB models
├─ .github/      # CI/CD workflows
└─ README.md
```
Monorepo is managed with **PNPM workspaces** for easy cross-package imports.

---

## 6. Development Workflow
1. **Branching**: `main` ➜ production; `dev` ➜ integration; feature branches → PRs.  
2. **Lint & Format**: `pnpm lint` and `pnpm format` run pre-commit via Husky.  
3. **Hot Reload**: Vite dev servers + Nodemon for backend.  
4. **Tests**: Vitest (front-end) and Jest/Supertest (backend).  
5. **CI**: GitHub Actions run lint, test, and build on every PR.

---

## 7. REST API Endpoints (prefix `/api`)

| Method | Endpoint                | Description                                |
|--------|-------------------------|--------------------------------------------|
| GET    | `/health`               | Health check                               |
| POST   | `/session`              | Create new game session, returns `sessionId` + QR URL |
| GET    | `/session/:id`          | Get current state (admin use)              |
| POST   | `/leaderboard`          | Submit score `{ alias, phone?, score }`    |
| GET    | `/leaderboard/top/:n`   | Fetch top *n* scores                       |

Authentication: Admin routes protected via server-side secret token (env var).

---

## 8. WebSocket Events

| Namespace | Event            | Payload                               | Direction | Purpose |
|-----------|------------------|---------------------------------------|-----------|---------|
| `/game`   | `player:join`    | `{ sessionId, playerName }`           | client→srv| Rider joins game |
| `/game`   | `player:leave`   | `{ playerId }`                        | client→srv| Rider disconnects |
| `/game`   | `question`       | `{ question, choices, index }`        | srv→all   | Send current question |
| `/game`   | `answer:submit`  | `{ playerId, choiceIndex }`           | client→srv| Player answers |
| `/game`   | `answer:result`  | `{ playerId, correct }`               | srv→client| Individual result |
| `/game`   | `game:complete`  | `{ finalScores[] }`                   | srv→all   | Game finished |
| `/admin`  | `session:reset`  | `{ sessionId }`                       | admin→srv | Reset game |
| `/admin`  | `state:update`   | `{ fullState }`                       | srv→admin | Real-time state |

---

## 9. Deployment Instructions

### One-Click Docker
```bash
docker build -t taps-trivia .
docker run -p 80:80 -e MONGO_URI=... taps-trivia
```
Container runs backend on port 80 and serves built front-end assets.

### GitHub Actions (preview)
A ready-made workflow `deploy.yml` builds all apps, pushes image to GHCR, and deploys to Render.  
Set secrets: `RENDER_API_KEY`, `MONGO_URI`, `RENDER_SERVICE_ID`.

---

## 10. Future Features & Roadmap
| Phase | Feature | Notes |
|-------|---------|-------|
| 2     | AR/voxel companions | WebGL models reacting to answers |
| 2     | Song requests       | Riders queue Spotify/YT Music     |
| 3     | Rewards integration | SMS/email prize notifications     |
| 3     | Multi-round games   | Longer sessions, category choice  |
| 4     | Driver analytics    | Aggregate engagement stats        |

---

## Contributing
Pull requests are welcome! Please open issues for feature proposals or bugs. All contributions must follow the **Code of Conduct** and **Contribution Guidelines** (see `/docs/`).

---

## License
MIT © 2025 Korey Streich
