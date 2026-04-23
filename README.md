# ⚡ PulsePlay — Real-Time Multiplayer Minigames

A competitive multiplayer web platform with 5 real-time minigames, ELO ranking, and WebSocket-powered gameplay.

---

## 🎮 Games

| Game | Description |
|------|-------------|
| ⚡ Reaction Time | React to the color signal first — milliseconds matter |
| 🎨 Color Match | Click the ink color, not the word — Stroop effect |
| 🔊 Sound Recognition | Identify sounds faster than your opponent |
| 🎯 Aim Trainer | Hit more targets in 30 seconds |
| 🃏 Memory Tiles | Find matching pairs before your opponent |

---

## 🧱 Tech Stack

- **Frontend:** Next.js 14 (App Router) · React · TailwindCSS · Framer Motion · Zustand
- **Backend:** Node.js · Express · Socket.io
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** JWT (accounts) + guest mode
- **Real-time:** WebSockets (Socket.io) with server-authoritative game logic

---

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js 18+
- PostgreSQL (or use Docker)

### 1. Clone and install

```bash
git clone <your-repo>
cd pulseplay
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/pulseplay"
JWT_SECRET="your-secret-here"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Set up database

```bash
# Option A: Use Docker for Postgres only
docker-compose -f docker-compose.dev.yml up -d

# Option B: Use your local Postgres
# (make sure DATABASE_URL is correct)

# Run migrations
npm run db:push

# Generate Prisma client
npm run db:generate

# Seed sample data (optional)
npm run db:seed
```

### 4. Run the app

```bash
npm run dev
```

This starts:
- **Next.js** at `http://localhost:3000`
- **Socket.io server** at `http://localhost:3001`

---

## 🐳 Docker (Full Stack)

```bash
# Start everything (Postgres + Next.js + Game Server)
docker-compose up --build

# App: http://localhost:3000
# Game Server: http://localhost:3001
```

---

## 📁 Project Structure

```
pulseplay/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   ├── login/page.tsx        # Login page
│   │   └── register/page.tsx     # Register page
│   ├── (main)/
│   │   ├── play/page.tsx         # Game selection + matchmaking
│   │   ├── leaderboard/page.tsx  # Global leaderboard
│   │   └── profile/[username]/   # Player profiles
│   ├── components/
│   │   ├── games/                # Game UI components (5 games)
│   │   ├── layout/               # Navbar, Footer
│   │   └── ui/                   # Shared UI components
│   ├── hooks/
│   │   └── useSocket.ts          # Socket.io React hook
│   ├── lib/
│   │   ├── api.ts                # REST API client
│   │   ├── socket.ts             # Socket.io client
│   │   └── ranks.ts              # ELO rank tiers
│   └── store/
│       ├── authStore.ts          # Zustand auth state
│       └── gameStore.ts          # Zustand game state
│
├── server/                       # Express + Socket.io backend
│   ├── index.js                  # Server entry point
│   ├── middleware/auth.js         # JWT + guest auth
│   ├── sockets/
│   │   ├── matchmaking.js        # Queue + ELO matching
│   │   ├── gameHandler.js        # In-game events + match end
│   │   └── lobbyHandler.js       # Private lobbies
│   ├── games/
│   │   ├── matchFactory.js       # Match state creator
│   │   ├── reaction_time.js      # ⚡ Reaction Time game
│   │   ├── color_match.js        # 🎨 Color Match game
│   │   ├── sound_recognition.js  # 🔊 Sound Recognition game
│   │   ├── aim_trainer.js        # 🎯 Aim Trainer game
│   │   └── memory_tiles.js       # 🃏 Memory Tiles game
│   ├── routes/
│   │   ├── auth.js               # POST /api/auth/*
│   │   ├── users.js              # GET /api/users/*
│   │   ├── leaderboard.js        # GET /api/leaderboard
│   │   └── matches.js            # GET /api/matches/*
│   └── utils/elo.js              # ELO calculation
│
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── seed.js                   # Sample data seeder
│
├── docker-compose.yml            # Full production stack
├── docker-compose.dev.yml        # Dev (Postgres only)
└── Dockerfile
```

---

## 🌐 Deployment (Production)

### Vercel (Frontend) + Railway/Render (Backend)

1. **Deploy Next.js to Vercel:**
   ```bash
   vercel --prod
   ```
   Set env vars: `NEXT_PUBLIC_SOCKET_URL=https://your-game-server.railway.app`

2. **Deploy game server to Railway:**
   - Add `server/` to Railway
   - Set env vars: `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`
   - Start command: `node server/index.js`

3. **Database:** Use Railway's Postgres add-on or Supabase

### VPS / Docker

```bash
# On your server
git pull
docker-compose up -d --build

# Run migrations
docker-compose exec web npx prisma migrate deploy
```

---

## 🔌 Socket.io Events Reference

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `matchmaking:join` | `{ gameType, mode }` | Join matchmaking queue |
| `matchmaking:leave` | `{ gameType }` | Leave queue |
| `game:action` | `{ type, ...data }` | Game input (click, answer, hit, flip) |
| `game:rematch` | `{ matchId }` | Request rematch |
| `lobby:create` | `{ gameType }` | Create private lobby |
| `lobby:join` | `{ code }` | Join lobby by code |
| `lobby:ready` | `{ lobbyId }` | Toggle ready state |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `match:found` | `{ matchId, gameType, players }` | Match found |
| `match:countdown` | `{ count }` | Countdown tick (3, 2, 1) |
| `match:start` | `{ matchId, timestamp }` | Game begins |
| `match:ended` | `{ winner, scores, eloChanges }` | Match over |
| `game:state` | game-specific | Initial game state |
| `game:round_start` | `{ round }` | New round begins |
| `game:signal` | `{ color, timestamp }` | Reaction signal |
| `game:round_end` | `{ winner, scores, reactionTime }` | Round result |
| `game:target_spawn` | `{ target }` | Aim trainer target |
| `game:hit` | `{ targetId, hitter, scores }` | Target hit confirmed |
| `game:tile_flip` | `{ tileId, value }` | Memory tile flipped |
| `game:match_found` | `{ tileIds, matchedBy }` | Memory pair matched |
| `game:penalty` | `{ message }` | Early click penalty |

---

## ⚙️ Scripts

```bash
npm run dev          # Start dev (Next.js + Socket.io)
npm run build        # Build for production
npm run db:push      # Push schema to DB
npm run db:migrate   # Run migrations
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed sample players
```

---

## 🔒 Security

- All game inputs validated server-side
- No client-trusted scores
- JWT authentication with configurable expiry
- Server-authoritative timing (click timestamps verified server-side)
- Guests are rate-limited to prevent spam
- SQL injection prevented via Prisma ORM

---

## ➕ Extending — Adding a New Game

1. Create `server/games/your_game.js` with `onStart` and `onAction` exports
2. Add the game type to `prisma/schema.prisma` `GameType` enum
3. Add config to `app/lib/ranks.ts` `GAME_CONFIG`
4. Create `app/components/games/YourGame.tsx`
5. Import it in `app/(main)/play/page.tsx` dynamic imports

---

Built with ❤️ using Next.js, Socket.io, Prisma, and TailwindCSS.
