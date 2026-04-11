# Architecture - MERN-NLP-Emotract

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
│  │  - Last seen         │       │  - Admin auth            │       │
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
│  │  /auth    │→ │ user         │  │ JWT verify   │  │  Real-time│  │
│  │  /messages│→ │ message      │  │ isAdmin      │  │  events   │  │
│  │  /api-docs│  │ admin        │  │ logger       │  │           │  │
│  └──────────┘  └──────┬───────┘  └──────────────┘  └───────────┘  │
│                       │                                             │
│  ┌────────────────────┼────────────────────────────────────────┐   │
│  │                    │         SERVICES                        │   │
│  │  ┌─────────────┐  │  ┌──────────────┐                      │   │
│  │  │ AES-256     │  │  │ Nodemailer   │                      │   │
│  │  │ Encryption  │  │  │ Email        │                      │   │
│  │  │ /Decryption │  │  │ Service      │                      │   │
│  │  └─────────────┘  │  └──────────────┘                      │   │
│  └────────────────────┼────────────────────────────────────────┘   │
└───────────────────────┼────────────────────────────────────────────┘
                        │
              ┌─────────┼───────────┐
              │         │           │
              ▼         ▼           ▼
      ┌───────────┐ ┌────────┐
      │  MongoDB   │ │ Redis  │
      │            │ │        │
      │ - Users    │ │ Refresh│
      │ - Messages │ │ Tokens │
      │ - Chats    │ │ (7d)   │
      │ - PwdReset │ │        │
      └───────────┘ └────────┘
```

---

## Socket.io Communication Flow

### Online Status Flow

```
User B logs in:
  Browser B                    Server                      Browser A
     |                           |                            |
     |-- add-user(userIdB) ----->|                            |
     |                           |-- DB: is_online=true       |
     |                           |-- Map: set(B, socketId)    |
     |<-- online-users([A,B]) ---|                            |
     |                           |-- user-status-change ------>|
     |                           |   {userId:B, isOnline:true} |
     |                           |                            |
     |                           |  (A's Contacts.jsx shows   |
     |                           |   green dot on B's avatar)  |

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
                                 |                            |
                                 |  (A sees: green dot gone,  |
                                 |   "Last seen today 2:30 PM")|
```

### Message Delivery Flow

```
User A sends message to User B:
  Browser A                    Server                      Browser B
     |                           |                            |
     |-- emit("send-msg", {  -->|                            |
     |     to: B, from: A,      |                            |
     |     msg: "Hello"})        |                            |
     |                           |-- lookup B in onlineUsers  |
     |-- POST /messages/addmsg ->|-- encrypt & store in DB    |
     |                           |                            |
     |                           |-- emit("msg-recieve") ---->|
     |                           |   { from: A, msg: "Hello" }|
     |                           |                            |
     |                           |  (B's Chat.jsx checks:     |
     |                           |   from === currentChat?    |
     |                           |   Yes → show in chat       |
     |                           |   No → unread badge + 1)   |
```

---

## Data Models

```
┌──────────────┐       ┌──────────────┐       ┌────────────────────┐
│    Users     │       │    Chats     │       │     Messages       │
├──────────────┤       ├──────────────┤       ├────────────────────┤
│ _id          │◄──┐   │ _id          │◄──────│ chat_id            │
│ username     │   │   │ participants │───────►│ sender_id ─────────┼──►Users
│ email        │   │   │ is_group     │       │ text (encrypted)   │
│ password     │   ├───│ group_admins │       │ is_flagged         │
│ role         │   │   │ last_message │       │ message_status     │
│ is_flagged   │   │   └──────────────┘       └────────────────────┘
│ is_online    │   │
│ last_active  │   │   ┌──────────────────────┐
│ socket_id    │   │   │  PasswordReset       │
│ is_active    │   └───│  userId              │
└──────────────┘       │  token               │
                       │  expiresAt           │
                       └──────────────────────┘
```

---

## Technology Stack

### Frontend (User App)
| Layer          | Technology                 |
|----------------|----------------------------|
| Framework      | React 19                   |
| Build Tool     | Vite 6.1                   |
| Styling        | Styled Components + Tailwind CSS |
| HTTP           | Axios (with interceptors)  |
| WebSocket      | Socket.io Client           |

### Frontend (Admin App)
| Layer          | Technology                 |
|----------------|----------------------------|
| Framework      | React 18 + TypeScript      |
| Build Tool     | Vite 5.1                   |
| UI Components  | ShadCN UI (Radix + Tailwind) |
| State          | React Query v5 + Context   |
| Charts         | Recharts                   |
| Forms          | React Hook Form + Zod      |
| HTTP           | Axios (with interceptors)  |

### Backend
| Layer          | Technology                 |
|----------------|----------------------------|
| Framework      | Express.js 4.21            |
| Database       | MongoDB (Mongoose 8.10)    |
| Cache          | Redis 4.7                  |
| Auth           | JWT + Bcrypt               |
| WebSocket      | Socket.io 4.8              |
| Encryption     | AES-256-CBC (Node crypto)  |
| Email          | Nodemailer                 |
| API Docs       | Swagger/OpenAPI            |

### Infrastructure
| Component      | Technology                 |
|----------------|----------------------------|
| Containers     | Docker + Docker Compose    |
| Database       | MongoDB (in Docker)        |
| Cache/Sessions | Redis (in Docker)          |
