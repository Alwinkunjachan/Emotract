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

Docker Compose includes MongoDB — no local installation needed.

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
- Auth0 tenant configured (see Auth0 Setup below)

## Architecture

```
User App (React) ──► Express Backend ──► MongoDB
Admin App (React) ──►     │
                     Socket.io (WS)
                          │
                     Auth0 (Identity)
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
│       ├── providers/  # Auth0ProviderWithNavigate, ThemeProvider
│       ├── lib/        # API functions
│       └── routes/     # React Router config
├── user/               # User chat app (React + JavaScript)
│   └── src/
│       ├── pages/      # Chat, Login, CompleteProfile
│       ├── components/ # ChatContainer, Contacts, ChatInput, Logout, SetAvatar
│       ├── context/    # SocketProvider, Auth0ProviderWithNavigate
│       └── utils/      # API routes, axios instance, PrivateRoute
├── server/             # Express.js backend
│   ├── config/         # DB, Auth0, Socket, Email, Crypto, Swagger
│   ├── controllers/v1/ # Admin, User, Message controllers
│   ├── middleware/      # Auth (Auth0 JWT + resolveUser), isAdmin, Logger
│   ├── models/         # Mongoose schemas (Users, Messages, Chats)
│   ├── routes/v1/      # Auth routes, Message routes
│   ├── migrations/     # Database migration + Auth0 migration scripts
│   └── utils/          # Email utilities
└── docker-compose.yml  # Full-stack orchestration (includes MongoDB)
```

## Environment Variables

Each service requires a `.env` file (see `.env.example` in each directory):

**server/.env** (critical):
- `PORT` - Server port (default: `5001`)
- `MONGO_URL` - MongoDB connection string
- `AUTH0_DOMAIN` - Auth0 tenant domain (e.g., `emotract-test.us.auth0.com`)
- `AUTH0_AUDIENCE` - Auth0 API identifier (e.g., `https://api.emotract.com`)
- `AUTH0_M2M_CLIENT_ID` - Auth0 Machine-to-Machine app Client ID
- `AUTH0_M2M_CLIENT_SECRET` - Auth0 Machine-to-Machine app Client Secret
- `AUTH0_WEBHOOK_SECRET` - Secret for Auth0 webhook endpoint (production use)
- `ENCRYPTION_KEY` - 32-byte AES-256 key for message encryption
- `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_HOST`, `EMAIL_PORT` - SMTP config for Nodemailer
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PHONE` - Default admin credentials
- `DEFAULT_USER_PASSWORD` - (Optional) Password used by `npm run seed:user`. Falls back to `Default@123` if unset.

**user/.env**:
- `VITE_BACKEND_URL` (default: `http://localhost:5001`)
- `VITE_AUTH0_DOMAIN` - Auth0 tenant domain
- `VITE_AUTH0_CLIENT_ID` - Auth0 SPA application Client ID
- `VITE_AUTH0_AUDIENCE` - Auth0 API identifier

**admin/.env**:
- `VITE_BACKEND_URL` (default: `http://localhost:5001`)
- `VITE_AUTH0_DOMAIN` - Auth0 tenant domain
- `VITE_AUTH0_CLIENT_ID` - Auth0 SPA application Client ID (same as user app)
- `VITE_AUTH0_AUDIENCE` - Auth0 API identifier

## Database

- **MongoDB** - Primary data store (Users, Messages, Chats)
- Messages are encrypted at rest with AES-256-CBC

## Authentication (Auth0)

- **Auth0** handles identity management, login, signup, password reset, and SSO (Google, etc.)
- Both frontends use `@auth0/auth0-react` SDK with Auth0 Universal Login (redirect)
- Auth state cached in localStorage (`cacheLocation: 'localstorage'`) for persistence across refreshes
- Backend validates Auth0-issued JWTs (RS256) using `express-oauth2-jwt-bearer`
- `resolveUser` middleware maps Auth0 `sub` claim to local MongoDB user via `auth0_id` field
- **Auto-provisioning**: Users who sign up via Auth0 Universal Login are automatically created in MongoDB on first API call. Profile data is fetched from Auth0's `/userinfo` endpoint.
- **Role assignment by app**: Signup via user app (`:5173`) → `USER` role; signup via admin app (`:5174`) → `ADMIN` role. Determined by the `Origin` header.
- **Profile completion**: Auto-provisioned users have `is_profile_complete: false` and are redirected to `/complete-profile` to enter required fields (phone, aadhaar, age, gender, parent email)
- Admin routes protected by `verifyAccessToken` + `resolveUser` + `isAdmin` middleware
- Socket.io connections authenticated with Auth0 tokens via `jose` JWKS verification
- No localStorage token management — Auth0 SDK handles tokens internally

## Socket.io Events

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `online-users` | Server -> Client | `string[]` | Initial list of online userIds (sent on connection) |
| `user-status-change` | Server -> All | `{ userId, isOnline, lastSeen? }` | Real-time online/offline broadcast |
| `send-msg` | Client -> Server | `{ to, msg }` | Send message (sender verified from Auth0 token) |
| `msg-recieve` | Server -> Client | `{ from, msg }` | Deliver message |
| `logout` | Client -> Server | — | User logout (userId from server-verified socket) |

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
- User frontend uses component-level useState + Auth0 context + sessionStorage
- Socket connects after Auth0 login (token passed in handshake), disconnects on logout
- Selected chat persisted in sessionStorage (survives page refresh)

## Migration Commands

```bash
cd server
npm run migrate          # Create collections, indexes, and validators
npm run migrate:drop     # Drop all collections and re-create (DESTRUCTIVE)
npm run migrate:auth0    # Migrate existing Mongo users to Auth0
npm run seed:user        # Create default test user in Auth0 + Mongo (idempotent)
npm run reset:chats      # Wipe all chats + messages (users untouched)
```

Default admin is also auto-created in Mongo on every server startup via `createDefaultAdmin()` ([server/config/admin.js](server/config/admin.js)). The startup admin is local-only and has no Auth0 linkage — use `npm run migrate:auth0` to link it.

### Default Test User (`npm run seed:user`)

Creates a USER-role account in BOTH Auth0 and MongoDB so you can log in immediately:

- **Email:** `alwinpkunjachan@gmail.com`
- **Username:** `alwinpkunjachan`
- **Password:** `process.env.DEFAULT_USER_PASSWORD` if set, otherwise `Default@123`

Idempotent: re-running detects existing Auth0/Mongo records and links/updates them.

### Reset Chats (`npm run reset:chats`)

`deleteMany({})` on `chats` and `messages`. Users (Mongo + Auth0) are untouched. Pass `-y` to skip the confirmation prompt: `npm run reset:chats -- -y`.

## Auth0 Migration

To migrate existing users to Auth0:
```bash
cd server
npm run migrate:auth0
```
Migrated users will need to use "Forgot Password" on Auth0 to set their new password.

## Default Admin Credentials

- Admin must be created in Auth0 and assigned the `ADMIN` role
- Login at: `http://localhost:5174/login` (auto-redirects to Auth0 Universal Login)
