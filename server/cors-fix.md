# Fixing CORS & Adding Simple Admin Authentication  
_for the Taps Tokens Trivia backend (`server/`)_

---

## 1 · Why you are seeing “CORS” & “Unauthorized” in Admin UI

| Symptom | Root cause |
|---------|------------|
| `Access-Control-Allow-Origin` header missing | Express server is not sending the CORS headers for requests coming from `https://trivia-admin-ui.onrender.com`. |
| `Unauthorized: Invalid admin token` | Admin endpoints require a token, but the UI isn’t sending (or is sending the wrong) token, and Socket.IO rejects the connection too. |

We will:  
1. Allow the Tablet, Mobile **and** Admin origins through CORS.  
2. Protect `/api/admin/*` + `/admin` namespace with a shared `ADMIN_TOKEN`.

---

## 2 · Adding CORS support in Express

### 2.1 Install CORS middleware

```bash
pnpm add cors                      # already in many stacks, but ensure installed
```

### 2.2 Configure in `server/src/index.js`

```js
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

const app = express();
const server = http.createServer(app);

// 1️⃣  CORS – allow Render static sites & localhost for dev
const ALLOWED_ORIGINS = [
  'https://trivia-tablet-display.onrender.com',
  'https://trivia-mobile-ui.onrender.com',
  'https://trivia-admin-ui.onrender.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175'
];

app.use(
  cors({
    origin: (origin, cb) => {
      // allow REST tools / curl (no origin) & specified origins
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true
  })
);

// JSON parsing, routes, etc.
app.use(express.json());

/* example protected route */
import { verifyAdmin } from './middleware/auth.js';
app.get('/api/admin/stats', verifyAdmin, async (req, res) => {
  const stats = await buildStats();
  res.json(stats);
});

/* 2️⃣  SOCKET.IO with CORS */
const io = new SocketIOServer(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

//  admin namespace
const adminNs = io.of('/admin');
adminNs.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token === process.env.ADMIN_TOKEN) return next();
  next(new Error('Unauthorized admin'));
});

adminNs.on('connection', socket => {
  console.log('Admin connected', socket.id);
  // emit state, listen for control commands…
});

server.listen(process.env.PORT || 3000, () =>
  console.log('API listening')
);
```

---

## 3 · Simple Admin Auth Middleware

Create `server/src/middleware/auth.js`:

```js
export function verifyAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token && token === process.env.ADMIN_TOKEN) return next();
  return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
}
```

### Environment variable on Render

Add **`ADMIN_TOKEN`** (choose a long random string) to your *Web Service*.

---

## 4 · Consuming Auth in the Admin UI

`apps/admin/src/context/SocketContext.tsx` already sends:

```ts
auth: { token: localStorage.getItem('adminToken') || '' }
```

Add this once after login (or during local testing):

```js
localStorage.setItem('adminToken', 'YOUR_SAME_ADMIN_TOKEN');
```

For REST fetches (`/api/admin/*`) the GameState context should include:

```ts
const response = await fetch(`${API_URL}/api/admin/stats`, {
  headers: { Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}` }
});
```

---

## 5 · Local testing checklist

1. `export ADMIN_TOKEN=supersecret`  
2. `pnpm --filter server dev`  
3. In browser console:  
   ```js
   localStorage.setItem('adminToken', 'supersecret')
   ```  
4. Visit `http://localhost:5175` (Admin UI) → should connect & load stats.

---

## 6 · FAQ

| Question | Answer |
|----------|--------|
| I still see CORS errors? | Confirm the **exact** origin in Render site URL is in `ALLOWED_ORIGINS`. Re-deploy server after editing list. |
| Multiple environments? | Use `process.env.NODE_ENV` to toggle allowed origins list or accept regex patterns. |
| Is the token secure? | It’s a minimal solution. For production, move to JWTs + proper login and HTTPS-only secure cookies. |

---

**That’s it!**  
Deploy the updated server, set the `ADMIN_TOKEN`, and your Admin UI should connect without CORS or authorization errors.
