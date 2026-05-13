# Server Documentation — Emotract Backend

Express.js + Socket.io + MongoDB backend that powers both the user chat app and admin dashboard. Authentication is delegated to Auth0; messages are end-to-end encrypted at rest with AES-256-CBC.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Directory Layout](#2-directory-layout)
3. [Application Entry Point](#3-application-entry-point)
4. [Configuration Layer](#4-configuration-layer)
5. [Data Models](#5-data-models)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [REST API Reference](#7-rest-api-reference)
8. [Controllers](#8-controllers)
9. [Real-Time Layer (Socket.io)](#9-real-time-layer-socketio)
10. [Message Encryption](#10-message-encryption)
11. [Email Subsystem](#11-email-subsystem)
12. [Migrations](#12-migrations)
13. [Environment Variables](#13-environment-variables)
14. [Running the Server](#14-running-the-server)
15. [Operational Notes](#15-operational-notes)

---

## 1. Tech Stack

| Layer            | Technology                                    |
|------------------|-----------------------------------------------|
| Runtime          | Node.js (ES Modules, `"type": "module"`)      |
| HTTP framework   | Express 4.21                                  |
| Realtime         | Socket.io 4.8                                 |
| Database         | MongoDB via Mongoose 8.10                     |
| Identity         | Auth0 (`express-oauth2-jwt-bearer`, `jose`)   |
| Cache (optional) | Redis 4.7                                     |
| Email            | Nodemailer 6.10                               |
| API docs         | swagger-jsdoc + swagger-ui-express            |
| Crypto           | Node `crypto` (AES-256-CBC)                   |
| Dev runner       | nodemon                                       |

Full dependency list lives in [server/package.json](../server/package.json).

---

## 2. Directory Layout

```
server/
├── index.js                  # App bootstrap, middleware, routing, socket init
├── config/                   # Cross-cutting service configuration
│   ├── admin.js              # Default admin user provisioning
│   ├── auth0.js              # Auth0 Management API client
│   ├── crypto.js             # AES-256-CBC encrypt / decrypt / safeDecrypt
│   ├── db.js                 # Mongoose connection
│   ├── email.js              # Nodemailer transporter
│   ├── redis.js              # Optional Redis client
│   ├── socket.js             # Socket.io server + Auth0 JWT verification
│   └── swagger.js            # OpenAPI spec generation
├── constants/
│   └── emailTemplates.js     # HTML email templates
├── controllers/v1/
│   ├── adminController.js    # Admin dashboard endpoints
│   ├── messageController.js  # Chat message endpoints
│   └── userController.js     # User profile & auth endpoints
├── middleware/
│   ├── authMiddleware.js     # verifyAccessToken + resolveUser
│   ├── isAdmin.js            # Role check
│   └── logger.js             # Color-coded request logger
├── models/
│   ├── Users.js
│   ├── Chats.js
│   └── Messages.js
├── routes/v1/
│   ├── auth.js               # /api/v1/auth/*
│   └── messages.js           # /api/v1/messages/*
├── migrations/
│   ├── migrate.js            # Schema + indexes + admin user
│   └── migrateToAuth0.js     # Backfill existing users into Auth0
└── utils/
    ├── generate-gravatar.js  # SHA-256 Gravatar URL builder
    └── sendEmail.js          # Reset / parent / warning emails
```

---

## 3. Application Entry Point

[server/index.js](../server/index.js) wires up the application:

1. **Express app** with `express.json()` body parsing.
2. **CORS** — allow-list driven by `FRONTEND_URL` (user app) and `ADMIN_URL` (admin app).
3. **Request logger** — colored `METHOD protocol://host/url` line per request.
4. **MongoDB connection** via `connectDB()` (also seeds the default admin).
5. **Routes**
   - `GET /` redirects to `/api-docs`
   - `/api/v1/auth` → [routes/v1/auth.js](../server/routes/v1/auth.js)
   - `/api/v1/messages` → [routes/v1/messages.js](../server/routes/v1/messages.js)
6. **Swagger UI** mounted at `/api-docs`.
7. **HTTP server** created from the Express app, then handed to `initSocket(server)` so Socket.io shares the same port.
8. Listens on `process.env.PORT` (default `5000`; docker-compose overrides to `5001`).

---

## 4. Configuration Layer

### 4.1 `config/db.js`
Connects Mongoose to `MONGO_URL`. On success, invokes `createDefaultAdmin()` from `config/admin.js` to ensure an admin account exists in both MongoDB and Auth0.

### 4.2 `config/auth0.js`
Initializes the Auth0 **Management API** client using `AUTH0_M2M_CLIENT_ID` / `AUTH0_M2M_CLIENT_SECRET`. Used for programmatic user creation and metadata updates.

### 4.3 `config/socket.js`
Bootstraps the Socket.io server, verifies JWTs against Auth0's JWKS endpoint via `jose`, and tracks online users in `global.onlineUsers` (a `Map<userId, socketId>`). See [Section 9](#9-real-time-layer-socketio).

### 4.4 `config/crypto.js`
Three exports:
- `encrypt(text)` — AES-256-CBC with random IV; returns `iv:ciphertext` hex.
- `decrypt(payload)` — reverses the above.
- `safeDecrypt(payload)` — wraps `decrypt` with a try/catch so a legacy/plaintext row doesn't crash the response.

### 4.5 `config/email.js`
Builds a Nodemailer transporter from `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_USER` / `EMAIL_PASS`. Used by everything in `utils/sendEmail.js`.

### 4.6 `config/redis.js`
Creates a Redis client. Optional — only used when caching is enabled.

### 4.7 `config/swagger.js`
Generates the OpenAPI 3 spec via `swagger-jsdoc`, parsing the JSDoc comments above route handlers.

### 4.8 `config/admin.js`
On every startup, ensures the configured `ADMIN_EMAIL` / `ADMIN_USERNAME` user exists in MongoDB with `role: "ADMIN"` and a matching Auth0 identity.

---

## 5. Data Models

All models live in [server/models/](../server/models/) and use Mongoose schemas.

### 5.1 `Users` — [models/Users.js](../server/models/Users.js)

| Field                  | Type     | Notes                                                  |
|------------------------|----------|--------------------------------------------------------|
| `username`             | String   | required, unique, 3–20 chars                           |
| `auth0_id`             | String   | unique sparse index — maps to Auth0 `sub` claim        |
| `device_id`            | String   | default `"NA"`                                         |
| `socket_id`            | String   | populated while online, cleared on disconnect          |
| `email`                | String   | required, unique, max 50                               |
| `password`             | String   | optional (kept for legacy users; Auth0 owns auth now)  |
| `aadhaar_number`       | String   |                                                        |
| `firstname` / `lastname` | String | default `""`                                          |
| `parent_email`         | String   | used for guardian notifications                        |
| `age`                  | Number   | default `0`                                            |
| `gender`               | String   | enum `M`/`F`/`O`, default `M`                          |
| `phone`                | String   |                                                        |
| `imageUrl`             | String   | Gravatar / custom avatar URL                           |
| `age_verified`         | Boolean  | default `false`                                        |
| `is_active`            | Boolean  | soft-delete flag                                       |
| `is_online`            | Boolean  | toggled by socket lifecycle                            |
| `is_flagged`           | Boolean  | admin-imposed block                                    |
| `flag_count`           | Number   | running tally of flags                                 |
| `last_active`          | Date     | updated on disconnect                                  |
| `created_at` / `updated_at` | Date |                                                       |
| `isAvatarImageSet`     | Boolean  |                                                        |
| `avatarImage`          | String   | base64 / URL                                           |
| `is_profile_complete`  | Boolean  | gates access until `/complete-profile` is submitted    |
| `role`                 | String   | enum `USER`/`ADMIN`, default `USER`                    |

### 5.2 `Chats` — [models/Chats.js](../server/models/Chats.js)

| Field          | Type                  | Notes                                  |
|----------------|-----------------------|----------------------------------------|
| `participants` | `[ObjectId<Users>]`   | the two (or more) users in the chat    |
| `is_group`     | Boolean               | default `false`                        |
| `group_name`   | String                | UUID-generated for 1-to-1 chats        |
| `group_admins` | `[ObjectId<Users>]`   |                                        |
| `is_active`    | Boolean               |                                        |
| `last_message` | embedded `{ text, sender_id, sent_at }` | denormalized for chat lists |
| `timestamps`   | auto                  | `createdAt` / `updatedAt`              |

### 5.3 `Messages` — [models/Messages.js](../server/models/Messages.js)

| Field                | Type                  | Notes                                                |
|----------------------|-----------------------|------------------------------------------------------|
| `chat_id`            | `ObjectId<Chats>`     | required                                             |
| `sender_id`          | `ObjectId<Users>`     | required                                             |
| `text`               | String                | **encrypted before save** via `crypto.encrypt`       |
| `sent_at`            | Date                  |                                                      |
| `read_by`            | `[ObjectId<Users>]`   |                                                      |
| `is_active`          | Boolean               |                                                      |
| `processing_status`  | String                | enum `processing`/`processed` (for future NLP hook)  |
| `message_status`     | String                | enum `pending`/`sent`/`delivered`/`seen`             |
| `is_flagged`         | Boolean               |                                                      |
| `reaction`           | `{ emoji, reacted_by[], reacted_at }` |                                      |

---

## 6. Authentication & Authorization

The server **does not issue tokens**. Auth0 issues RS256-signed JWTs; the server verifies them.

### 6.1 `verifyAccessToken` — [middleware/authMiddleware.js](../server/middleware/authMiddleware.js)
Backed by `express-oauth2-jwt-bearer`. Validates:
- Issuer = `https://${AUTH0_DOMAIN}/`
- Audience = `AUTH0_AUDIENCE`
- Signature against Auth0's JWKS (cached)

On success, `req.auth.payload` contains the decoded claims (including `sub`).

### 6.2 `resolveUser`
Runs after `verifyAccessToken`:

1. Looks up `Users` by `auth0_id = req.auth.payload.sub`.
2. **Auto-provisioning** — if no user exists, calls Auth0's `/userinfo` endpoint with the bearer token, then creates a new `Users` record with `is_profile_complete: false`.
3. **Role assignment** — driven by the `Origin` request header:
   - `http://localhost:5174` (or `ADMIN_URL`) → `role: "ADMIN"`
   - everything else → `role: "USER"`
4. Attaches the resolved document to `req.user`.

### 6.3 `isAdmin` — [middleware/isAdmin.js](../server/middleware/isAdmin.js)
After `resolveUser`, returns **403 Forbidden** unless `req.user.role === "ADMIN"`.

### 6.4 Middleware ordering
Standard chain on protected routes:
```
verifyAccessToken → resolveUser → [isAdmin] → controller
```

---

## 7. REST API Reference

Base URL: `http://localhost:5001/api/v1`
Live docs: `http://localhost:5001/api-docs`

### 7.1 Auth & User routes — [routes/v1/auth.js](../server/routes/v1/auth.js)

| Method | Path                          | Auth chain                  | Purpose                                          |
|--------|-------------------------------|-----------------------------|--------------------------------------------------|
| POST   | `/auth/auth0-webhook`         | _(public — secret in body)_ | Auth0 post-registration hook → provision user    |
| PATCH  | `/auth/complete-profile`      | verifyToken + resolveUser   | Finalize required profile fields                 |
| GET    | `/auth/me`                    | verifyToken + resolveUser   | Return current user document                     |
| GET    | `/auth/all-users/:id`         | verifyToken + resolveUser   | List active, profile-complete peers              |
| GET    | `/auth/all-contact-users/:id` | verifyToken + resolveUser   | List users the caller has chatted with           |
| POST   | `/auth/setavatar/:id`         | verifyToken + resolveUser   | Save selected avatar                             |
| GET    | `/auth/online-status/:id`     | verifyToken + resolveUser   | Boolean online flag for one user                 |
| GET    | `/auth/block-status/:id`      | verifyToken + resolveUser   | Boolean flagged/blocked flag for one user        |
| POST   | `/auth/logout`                | verifyToken + resolveUser   | Mark offline, clear socket id                    |

### 7.2 Admin-scoped routes (same router, with `isAdmin`)

| Method | Path                              | Purpose                                                |
|--------|-----------------------------------|--------------------------------------------------------|
| GET    | `/auth/dashboard-stats/`          | Aggregate counts + 30-day trends                       |
| GET    | `/auth/complete-users/`           | All active users (supports `?limit=`)                  |
| GET    | `/auth/user-gender-details/`      | Gender distribution by registration date               |
| GET    | `/auth/get-user-details/:id`      | Full document for a single user                        |
| PATCH  | `/auth/block-user/:id`            | Set `is_flagged: true`                                 |
| PATCH  | `/auth/unblock-user/:id`          | Set `is_flagged: false`                                |
| DELETE | `/auth/delete-user/:id`           | Soft delete (`is_active: false`)                       |
| GET    | `/auth/get-user-analytics/:id`    | Chat / message / flag analytics for one user           |
| POST   | `/auth/restrict-user`             | Send guardian email or warning (see §8.3)              |

### 7.3 Message routes — [routes/v1/messages.js](../server/routes/v1/messages.js)

| Method | Path                  | Auth chain      | Purpose                                            |
|--------|-----------------------|-----------------|----------------------------------------------------|
| POST   | `/messages/addmsg/`   | verifyToken     | Create a message (encrypted at rest)               |
| POST   | `/messages/getmsg/`   | verifyToken     | Retrieve decrypted history between two users       |

> Note: the message routes use only `verifyAccessToken`. They do **not** call `resolveUser`, so they identify the sender directly from `req.auth.payload.sub` plus the `from`/`to` IDs in the body.

---

## 8. Controllers

### 8.1 `userController.js` — [controllers/v1/userController.js](../server/controllers/v1/userController.js)

| Function                  | Behavior                                                                                  |
|---------------------------|-------------------------------------------------------------------------------------------|
| `completeProfile`         | Validates and saves the required profile fields, sets `is_profile_complete: true`.        |
| `auth0Webhook`            | Verifies the shared secret, then creates / updates the local user from the webhook body.  |
| `getMe`                   | Returns `req.user` as-is.                                                                 |
| `getAllUsers`             | Active + profile-complete users, excluding the caller.                                    |
| `getAllContactsUsers`     | Joins `Chats` to surface only users with whom the caller has an existing chat.            |
| `setAvatar`               | Stores avatar bytes/URL on the user document.                                             |
| `getUserOnlineStatus`     | Returns `{ isOnline }` based on `Users.is_online`.                                        |
| `getUserBlockStatus`      | Returns `{ isBlocked }` based on `Users.is_flagged`.                                      |
| `logOut`                  | Sets `is_online: false`, clears `socket_id`, stamps `last_active`.                        |

### 8.2 `messageController.js` — [controllers/v1/messageController.js](../server/controllers/v1/messageController.js)

| Function     | Behavior                                                                                                       |
|--------------|----------------------------------------------------------------------------------------------------------------|
| `addMessage` | Finds or creates a `Chats` doc for the participant pair, encrypts `text`, saves to `Messages`, updates `last_message`. |
| `getMessages`| Loads the chat, returns each message with `safeDecrypt(text)` so legacy plaintext rows still render.            |

### 8.3 `adminController.js` — [controllers/v1/adminController.js](../server/controllers/v1/adminController.js)

| Function                    | Behavior                                                                                       |
|-----------------------------|------------------------------------------------------------------------------------------------|
| `getDashboardStats`         | Aggregates totals (users, online, flagged, messages, chats) plus 30-day rolling trends.        |
| `getCompleteUsersDetails`   | Lists active users with optional `?limit=`.                                                    |
| `getUserDetails`            | Single user lookup by Mongo `_id`.                                                             |
| `blockUser` / `unBlockUser` | Toggle `is_flagged`.                                                                           |
| `deleteUser`                | Soft delete via `is_active: false` (no hard delete by design).                                 |
| `getUserAnalytics`          | Per-user analytics: chats joined, messages sent, flag history, daily trends.                   |
| `informUserOrGuardian`      | Branches on `type`: `INFORM_PARENT_AND_BLOCK` (email parent + block) or `WARN_CHILD` (email user). Uses templates from `constants/emailTemplates.js`. |
| `getUserGenderDetails`      | Gender breakdown bucketed by registration date.                                                |

---

## 9. Real-Time Layer (Socket.io)

Configured in [config/socket.js](../server/config/socket.js). The Socket.io server attaches to the same HTTP server as Express, so client and admin apps connect at `http://localhost:5001`.

### 9.1 Handshake authentication
The client passes the Auth0 access token in `socket.handshake.auth.token`. The server:
1. Fetches Auth0's JWKS via `jose.createRemoteJWKSet`.
2. Verifies the token (issuer + audience + signature).
3. Loads the corresponding `Users` doc; rejects the connection if not found.
4. On success, stores `socket.userId` for the lifetime of the socket.

### 9.2 Online presence
A module-scoped `global.onlineUsers` `Map<userId, socketId>` tracks who is connected.

### 9.3 Event catalog

| Event                | Direction       | Payload                              | Trigger                                                       |
|----------------------|-----------------|--------------------------------------|---------------------------------------------------------------|
| `online-users`       | server → client | `string[]` of userIds                | Emitted to the newly connected socket                          |
| `user-status-change` | server → all    | `{ userId, isOnline, lastSeen? }`    | Broadcast on connect / disconnect / explicit logout            |
| `send-msg`           | client → server | `{ to, msg }`                        | Client wants to deliver a message                              |
| `msg-recieve`        | server → client | `{ from, msg }`                      | Server relays to the recipient's socket if online              |
| `logout`             | client → server | _(none)_                             | Client explicitly logs out                                     |
| `disconnect`         | client → server | _(reason)_                           | Underlying transport closed                                    |

### 9.4 Side effects

| Lifecycle event            | DB mutations                                                                 |
|----------------------------|------------------------------------------------------------------------------|
| Connection (after JWT OK)  | `is_online = true`, `socket_id = socket.id`                                  |
| `disconnect` / `logout`    | `is_online = false`, `socket_id = null`, `last_active = now`                 |

> Sender identity for `send-msg` is taken from `socket.userId` (server-verified), **not** from the client payload — so a client cannot spoof `from`.

---

## 10. Message Encryption

Implemented in [config/crypto.js](../server/config/crypto.js):

- **Algorithm**: `aes-256-cbc`
- **Key**: `process.env.ENCRYPTION_KEY` (32 raw bytes)
- **IV**: 16 random bytes per message
- **Storage format**: `<iv_hex>:<ciphertext_hex>` written to `Messages.text`

### Read path
Controllers call `safeDecrypt` rather than `decrypt`. If decryption throws (e.g. a legacy row written before encryption was added), the raw stored value is returned unchanged — this keeps history readable without a destructive migration.

### Key rotation
Rotating `ENCRYPTION_KEY` requires re-encrypting all rows. No rotation script is shipped — write a one-off migration if/when needed.

---

## 11. Email Subsystem

Transport: Nodemailer SMTP, configured in [config/email.js](../server/config/email.js).

Helpers in [utils/sendEmail.js](../server/utils/sendEmail.js):

| Function              | Purpose                                                       |
|-----------------------|---------------------------------------------------------------|
| `sendResetEmail`      | Password reset link (legacy path — Auth0 owns this now)       |
| `sendParentEmail`     | Notifies a flagged user's parent / guardian                   |
| `warnUsersendEmail`   | Sends a written warning directly to the flagged user          |

Templates in [constants/emailTemplates.js](../server/constants/emailTemplates.js) — plain HTML strings with placeholder substitution.

---

## 12. Migrations

Scripts in [server/migrations/](../server/migrations/):

| Script                 | Command                  | Effect                                                   |
|------------------------|--------------------------|----------------------------------------------------------|
| `migrate.js`           | `npm run migrate`        | Ensure collections, validators, and indexes              |
| `migrate.js --drop`    | `npm run migrate:drop`   | Drop and recreate all collections (DESTRUCTIVE)          |
| `migrateToAuth0.js`    | `npm run migrate:auth0`  | Push existing MongoDB users into Auth0                   |
| `seedDefaultUser.js`   | `npm run seed:user`      | Create default test user `alwinpkunjachan@gmail.com` in Auth0 + Mongo. Idempotent |
| `resetChats.js`        | `npm run reset:chats`    | `deleteMany({})` on `chats` and `messages`. Users untouched. `-- -y` to skip prompt |

Default admin is auto-created in MongoDB on server startup via `createDefaultAdmin` ([server/config/admin.js](../server/config/admin.js)) — local-only; link to Auth0 with `migrate:auth0`.

After running `migrate:auth0`, migrated users must use Auth0's **"Forgot Password"** to set a new password — old hashed passwords stay in MongoDB but Auth0 owns auth from this point on.

All Mongo-touching scripts use [server/config/runtime.js](../server/config/runtime.js) to detect Docker via `/.dockerenv` and rewrite the `mongo` service hostname to `localhost` on host runs — so the same `.env` works in both modes.

---

## 13. Environment Variables

Required in `server/.env`:

| Variable                  | Required | Purpose                                                  |
|---------------------------|----------|----------------------------------------------------------|
| `PORT`                    | no       | Default `5000` (docker-compose sets `5001`)              |
| `MONGO_URL`               | **yes**  | Mongo connection string                                  |
| `FRONTEND_URL`            | **yes**  | CORS origin for the user app                             |
| `ADMIN_URL`               | **yes**  | CORS origin for the admin app                            |
| `AUTH0_DOMAIN`            | **yes**  | e.g. `emotract-test.us.auth0.com`                        |
| `AUTH0_AUDIENCE`          | **yes**  | API identifier registered in Auth0                       |
| `AUTH0_M2M_CLIENT_ID`     | **yes**  | Machine-to-Machine client for Management API             |
| `AUTH0_M2M_CLIENT_SECRET` | **yes**  | …its secret                                              |
| `AUTH0_WEBHOOK_SECRET`    | yes (prod) | Shared secret validated by `auth0Webhook`              |
| `ENCRYPTION_KEY`          | **yes**  | 32-byte key for AES-256-CBC                              |
| `EMAIL_HOST`/`PORT`/`USER`/`PASS` | yes | Nodemailer SMTP credentials                            |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_EMAIL` / `ADMIN_PHONE` | **yes** | Default admin to seed on first boot |
| `DEFAULT_USER_PASSWORD`   | no       | Password used by `npm run seed:user` (fallback: `Default@123`) |
| `REDIS_URL` / `REDIS_PASSWORD` | no   | Only needed if Redis features are enabled                |

---

## 14. Running the Server

### Docker (recommended)
```bash
docker-compose up --build
```
Brings up MongoDB + the server on port `5001`.

### Manual
```bash
cd server
npm install
npm run migrate         # first time only
npm start               # nodemon -L index.js
```

### Healthcheck
- `GET /` → 302 → `/api-docs`
- `GET /api-docs` → Swagger UI (proves Express + Swagger booted)
- Mongo connectivity errors surface in console at startup.

---

## 15. Operational Notes

- **Soft deletes only**: users are never hard-deleted (`is_active: false` instead). The same is true for chats.
- **`global.onlineUsers`** is in-process state — horizontal scaling requires moving this into Redis or a sticky-session strategy.
- **Auth0 webhook** must run over HTTPS in production and validate `AUTH0_WEBHOOK_SECRET` — anything that calls it without the secret can forge users.
- **`Origin` header drives role assignment** during auto-provisioning. Anyone signing up through the admin app origin gets `ADMIN`. Lock this down in production (e.g. require explicit admin invite flow) before opening the admin app to the public internet.
- **Encryption key loss = data loss**: `ENCRYPTION_KEY` must be backed up. There is no decrypt-with-recovery path.
- **API versioning**: everything is mounted under `/api/v1/`. Future-breaking changes should land under `/api/v2/` rather than mutating v1.
