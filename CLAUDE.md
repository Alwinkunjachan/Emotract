# CLAUDE.md - MERN-NLP-Emotract

## Project Overview

MERN-NLP-Emotract is a real-time chat application with an admin dashboard for user management and analytics. It consists of three services:

| Service   | Directory  | Tech Stack                        | Port  |
|-----------|------------|-----------------------------------|-------|
| User App  | `user/`    | React 19 + Vite + Styled Comp.   | 5173  |
| Admin App | `admin/`   | React 18 + Vite + TypeScript + ShadCN UI | 5174  |
| Backend   | `server/`  | Node.js + Express + Socket.io     | 5001  |

## Quick Start

### Docker (recommended)
```bash
docker-compose up --build
```

Docker Compose includes MongoDB and Redis — no local installation needed.

### Manual
```bash
# Terminal 1 - Express backend
cd server && npm start

# Terminal 2 - User frontend
cd user && npm run dev

# Terminal 3 - Admin frontend
cd admin && npm run dev
```

### Prerequisites (manual only)
- Node.js (v18+)
- MongoDB (running locally)
- Redis (running locally)

## Architecture

```
User App (React) ──► Express Backend ──► MongoDB
Admin App (React) ──►     │                │
                     Socket.io (WS)    Redis (sessions)
```

**Real-time Features (Socket.io):**
- Message delivery between users
- Online/offline status broadcast (`user-status-change` event)
- Online users list on connect (`online-users` event)
- Last seen timestamps on disconnect/logout

**Socket connects only after login and disconnects on logout** — no idle connections on public pages.

## Key Directories

```
├── admin/              # Admin dashboard (React + TypeScript)
│   └── src/
│       ├── pages/      # Auth, Dashboard (Overview + Analytics tabs), Students
│       ├── components/ # UI (ShadCN), Charts, Shared, Layout
│       ├── lib/        # API functions
│       └── routes/     # React Router config
├── user/               # User chat app (React + JavaScript)
│   └── src/
│       ├── pages/      # Chat, Login, Register, Password Reset
│       ├── components/ # ChatContainer, Contacts, ChatInput, Logout
│       ├── context/    # SocketProvider (on-demand connect/disconnect)
│       └── utils/      # API routes, axios instance, PrivateRoute
├── server/             # Express.js backend
│   ├── config/         # DB, Redis, Socket, Email, Crypto, Swagger
│   ├── controllers/v1/ # Admin, User, Message controllers
│   ├── middleware/      # Auth (JWT), isAdmin, Logger
│   ├── models/         # Mongoose schemas (Users, Messages, Chats, PasswordReset)
│   ├── routes/v1/      # Auth routes, Message routes
│   ├── migrations/     # Database migration script
│   └── utils/          # Email utilities
└── docker-compose.yml  # Full-stack orchestration (includes MongoDB + Redis)
```

## Environment Variables

Each service requires a `.env` file (see `.env.example` in each directory):

**server/.env** (critical):
- `PORT` - Server port (default: `5001`)
- `MONGO_URL` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `ENCRYPTION_KEY` - 32-byte AES-256 key for message encryption
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` - Redis connection
- `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_HOST`, `EMAIL_PORT` - SMTP config for Nodemailer
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PHONE` - Default admin credentials

**admin/.env**: `VITE_BACKEND_URL` (default: `http://localhost:5001`)
**user/.env**: `VITE_BACKEND_URL` (default: `http://localhost:5001`)

## Database

- **MongoDB** - Primary data store (Users, Messages, Chats, PasswordReset)
- **Redis** - Refresh token storage (7-day TTL), session management
- Messages are encrypted at rest with AES-256-CBC

## Authentication

- JWT-based with access tokens (15min) and refresh tokens (7 days in Redis)
- Access token sent via `Authorization: Bearer <token>` header
- Refresh token auto-rotation on 401 responses (handled by axios interceptors)
- Role-based: `USER` and `ADMIN` roles
- Admin routes protected by `verifyAccessToken` + `isAdmin` middleware

## Socket.io Events

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `add-user` | Client -> Server | `userId` | Register user as online |
| `online-users` | Server -> Client | `string[]` | Initial list of online userIds |
| `user-status-change` | Server -> All | `{ userId, isOnline, lastSeen? }` | Real-time online/offline broadcast |
| `send-msg` | Client -> Server | `{ to, from, msg }` | Send message |
| `msg-recieve` | Server -> Client | `{ from, msg }` | Deliver message |
| `logout` | Client -> Server | `userId` | User logout |

## API Base Paths

- REST API: `http://localhost:5001/api/v1/`
- Swagger docs: `http://localhost:5001/api-docs`
- WebSocket: `http://localhost:5001` (Socket.io)

## Key Conventions

- ES Modules throughout (`"type": "module"` in server)
- Soft deletes via `is_active` flag (no hard deletes on users)
- User blocking via `is_flagged` flag and `flag_count`
- All message text encrypted before storage, decrypted on retrieval
- API versioned under `/api/v1/`
- Admin frontend uses React Query for server state, Context for client state
- User frontend uses component-level useState + localStorage + sessionStorage
- Socket connects on login, disconnects on logout (not app-wide)
- Selected chat persisted in sessionStorage (survives page refresh)

## Migration Commands

```bash
cd server
npm run migrate          # Create collections, indexes, and admin user
npm run migrate:seed     # Above + seed 3 sample test users
npm run migrate:drop     # Drop all collections and re-create (DESTRUCTIVE)
npm run migrate:fresh    # Drop + re-create + seed sample data (DESTRUCTIVE)
```

## Default Admin Credentials

- Username: `admin`
- Password: `admin123` (set via ADMIN_PASSWORD in .env)
- Login at: `http://localhost:5174/login`
