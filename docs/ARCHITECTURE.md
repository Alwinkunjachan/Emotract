# Architecture - Emotract

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                   │
│                                                                     │
│  ┌──────────────────────┐       ┌──────────────────────────┐       │
│  │   User App (React)   │       │   Admin App (React+TS)   │       │
│  │   Port 5173          │       │   Port 5174              │       │
│  │                      │       │                          │       │
│  │  - Chat Interface    │       │  - Dashboard & Charts    │       │
│  │  - Real-time msgs    │       │  - User Analytics        │       │
│  │  - Online status     │       │  - Content Moderation    │       │
│  │  - Auth0 login/SSO   │       │  - Auth0 admin login     │       │
│  └──────────┬───────────┘       └────────────┬─────────────┘       │
│             │ HTTP + WebSocket                │ HTTP                │
└─────────────┼────────────────────────────────┼─────────────────────┘
              │                                │
              ▼                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EXPRESS BACKEND (Port 5001)                      │
│                                                                     │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  Routes   │  │ Controllers  │  │  Middleware   │  │  Socket.io│  │
│  │  /auth    │→ │ user         │  │ Auth0 JWT    │  │  Real-time│  │
│  │  /messages│→ │ message      │  │ resolveUser  │  │  Auth0 JWT│  │
│  │  /api-docs│  │ admin        │  │ isAdmin      │  │  verify   │  │
│  └──────────┘  └──────┬───────┘  └──────────────┘  └───────────┘  │
│                       │                                             │
│  ┌────────────────────┼────────────────────────────────────────┐   │
│  │                    │         SERVICES                        │   │
│  │  ┌─────────────┐  │  ┌──────────────┐  ┌──────────────┐    │   │
│  │  │ AES-256     │  │  │ Nodemailer   │  │ Auth0 Mgmt   │    │   │
│  │  │ Encryption  │  │  │ Email        │  │ API Client   │    │   │
│  │  │ /Decryption │  │  │ Service      │  │              │    │   │
│  │  └─────────────┘  │  └──────────────┘  └──────────────┘    │   │
│  └────────────────────┼────────────────────────────────────────┘   │
└───────────────────────┼────────────────────────────────────────────┘
                        │
              ┌─────────┼───────────┐
              │         │           │
              ▼         ▼           ▼
      ┌───────────┐          ┌──────────────┐
      │  MongoDB   │          │   Auth0      │
      │            │          │              │
      │ - Users    │          │ - Identity   │
      │ - Messages │          │ - SSO/OAuth  │
      │ - Chats    │          │ - Passwords  │
      └───────────┘          └──────────────┘
```

---

## Authentication Flow

### Signup (New User)

```
Browser                       Auth0                    Backend                 MongoDB
   |                            |                        |                       |
   |-- loginWithRedirect() ---->|                        |                       |
   |                            |-- Universal Login UI   |                       |
   |                            |   (Sign up tab)        |                       |
   |                            |<-- user creates acct -->|                       |
   |<-- redirect with code -----|                        |                       |
   |                            |                        |                       |
   |-- GET /auth/me (token) --->|                        |                       |
   |                            |     verifyAccessToken  |                       |
   |                            |     resolveUser:       |                       |
   |                            |       user not found   |                       |
   |                            |       fetch /userinfo  |                       |
   |                            |       auto-provision --|-- create user ------->|
   |                            |       (role from       |   (is_profile_complete|
   |                            |        Origin header)  |    = false)           |
   |<-- { user, is_profile_complete: false } ------------|                       |
   |                            |                        |                       |
   |-- redirect to /complete-profile                     |                       |
   |-- PATCH /auth/complete-profile -------------------->|-- update user ------->|
   |<-- { user, is_profile_complete: true } -------------|                       |
   |                            |                        |                       |
   |-- redirect to / (Chat)     |                        |                       |
```

### Role Assignment

- Signup via **User App** (`:5173`) → `Origin: http://localhost:5173` → role = `USER`
- Signup via **Admin App** (`:5174`) → `Origin: http://localhost:5174` → role = `ADMIN`

---

## Socket.io Communication Flow

### Connection Authentication

```
Browser                        Server
   |                             |
   |-- getAccessTokenSilently()  |
   |-- io(host, { auth: token }) |
   |                             |-- jose: jwtVerify(token, JWKS)
   |                             |-- MongoDB: findOne({ auth0_id })
   |                             |-- socket.userId = user._id
   |                             |
   |<-- "online-users" [ids] ----|
   |                             |-- broadcast "user-status-change"
```

### Online Status Flow

```
User B logs in:
  Browser B                    Server                      Browser A
     |                           |                            |
     |-- socket connects ------->|                            |
     |                           |-- DB: is_online=true       |
     |                           |-- Map: set(B, socketId)    |
     |<-- online-users([A,B]) ---|                            |
     |                           |-- user-status-change ------>|
     |                           |   {userId:B, isOnline:true} |

User B closes tab:
  Browser B                    Server                      Browser A
     |          (TCP drops)      |                            |
     X                           |-- disconnect event fires   |
                                 |-- DB: is_online=false      |
                                 |-- DB: last_active=now      |
                                 |-- Map: delete(B)           |
                                 |-- user-status-change ------>|
                                 |   {userId:B, isOnline:false,|
                                 |    lastSeen: timestamp}     |
```

### Message Delivery Flow

```
User A sends message to User B:
  Browser A                    Server                      Browser B
     |                           |                            |
     |-- emit("send-msg", {  -->|                            |
     |     to: B, msg: "Hello"}) |                            |
     |                           |-- sender = socket.userId   |
     |-- POST /messages/addmsg ->|-- encrypt & store in DB    |
     |                           |                            |
     |                           |-- emit("msg-recieve") ---->|
     |                           |   { from: A, msg: "Hello" }|
```

---

## Data Models

```
┌──────────────────┐       ┌──────────────┐       ┌────────────────────┐
│      Users       │       │    Chats     │       │     Messages       │
├──────────────────┤       ├──────────────┤       ├────────────────────┤
│ _id              │◄──┐   │ _id          │◄──────│ chat_id            │
│ auth0_id         │   │   │ participants │───────►│ sender_id ─────────┼──►Users
│ username         │   │   │ is_group     │       │ text (encrypted)   │
│ email            │   ├───│ group_admins │       │ is_flagged         │
│ role (USER/ADMIN)│   │   │ last_message │       │ message_status     │
│ is_profile_complete│ │   └──────────────┘       └────────────────────┘
│ is_flagged       │   │
│ is_online        │   │
│ last_active      │   │
│ socket_id        │   │
│ is_active        │   │
└──────────────────┘   │
```

---

## Technology Stack

### Frontend (User App)
| Layer          | Technology                 |
|----------------|----------------------------|
| Framework      | React 19                   |
| Build Tool     | Vite 6.1                   |
| Styling        | Styled Components + Tailwind CSS |
| Auth           | Auth0 React SDK            |
| HTTP           | Axios (with Auth0 token interceptors) |
| WebSocket      | Socket.io Client           |

### Frontend (Admin App)
| Layer          | Technology                 |
|----------------|----------------------------|
| Framework      | React 18 + TypeScript      |
| Build Tool     | Vite 5.1                   |
| UI Components  | ShadCN UI (Radix + Tailwind) |
| Auth           | Auth0 React SDK            |
| State          | React Query v5 + Context   |
| Charts         | Recharts                   |
| Forms          | React Hook Form + Zod      |
| HTTP           | Axios (with Auth0 token interceptors) |

### Backend
| Layer          | Technology                 |
|----------------|----------------------------|
| Framework      | Express.js 4.21            |
| Database       | MongoDB (Mongoose 8.10)    |
| Auth           | Auth0 (express-oauth2-jwt-bearer + jose) |
| WebSocket      | Socket.io 4.8              |
| Encryption     | AES-256-CBC (Node crypto)  |
| Email          | Nodemailer                 |
| API Docs       | Swagger/OpenAPI            |

### Infrastructure
| Component      | Technology                 |
|----------------|----------------------------|
| Containers     | Docker + Docker Compose    |
| Database       | MongoDB (in Docker)        |
| Identity       | Auth0 (cloud)              |
