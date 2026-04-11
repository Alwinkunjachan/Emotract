# MERN-NLP-Emotract - Project Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [System Overview](#system-overview)
3. [User Application](#user-application)
4. [Admin Application](#admin-application)
5. [Backend Server](#backend-server)
6. [Database Schema](#database-schema)
7. [Authentication & Security](#authentication--security)
8. [Real-Time Communication](#real-time-communication)

---

## Introduction

MERN-NLP-Emotract is a full-stack real-time chat application with an admin dashboard for user management, analytics, and content moderation. The system features encrypted messaging, real-time online/offline status tracking, and email-based notifications.

---

## System Overview

The application follows a **client-server architecture** with three independent services:

| Service        | Technology             | Port | Purpose                          |
|----------------|------------------------|------|----------------------------------|
| User Frontend  | React 19 + Vite        | 5173 | End-user chat interface          |
| Admin Frontend | React 18 + TypeScript  | 5174 | Admin dashboard & analytics      |
| Backend API    | Express.js + Socket.io | 5001 | REST API + WebSocket server      |

**External Dependencies (included in Docker Compose):**
- **MongoDB** - Primary document database
- **Redis** - Token storage and session management

---

## User Application

**Directory:** `user/`
**Stack:** React 19, Vite 6.1, Styled Components, Tailwind CSS, Socket.io Client

### Pages

| Route                    | Component          | Auth Required | Description                     |
|--------------------------|--------------------|---------------|---------------------------------|
| `/`                      | Chat               | Yes           | Main chat interface             |
| `/login`                 | Login              | No            | Username/password authentication|
| `/register`              | Register           | No            | New user registration           |
| `/forgot-password`       | ForgotPassword     | No            | Password recovery request       |
| `/reset-password/:token` | ResetPassword      | No            | Token-based password reset      |
| `/setAvatar`             | SetAvatar          | No            | Avatar selection (DiceBear API) |

### Key Features

- **Real-time messaging** via Socket.io with message encryption
- **Online/offline status** — green dot indicator on contact avatars, updated in real-time via socket events
- **Last seen timestamps** — shows "Last seen today at 2:30 PM" for offline users, fetched from DB on login and updated via socket
- **Unread message badges** — green badge with count on contacts with new messages
- **Chat persistence** — selected chat survives page refresh (stored in sessionStorage)
- **Socket lifecycle** — socket connects only after login, disconnects on logout
- **Contact search** — search bar to find users and start new conversations
- **Emoji picker** — built-in emoji selection in chat input
- **Suspended user popup** — modal for blocked/flagged accounts

### State Management

- **Component-level `useState`** for UI state
- **`localStorage`** for authentication tokens and user data
- **`sessionStorage`** for current chat persistence across refresh
- **React Context** (`SocketProvider`) for Socket.io instance sharing with on-demand connect/disconnect

---

## Admin Application

**Directory:** `admin/`
**Stack:** React 18, TypeScript, Vite 5.1, ShadCN UI, Tailwind CSS, React Query v5

### Pages

| Route                | Component         | Description                                |
|----------------------|-------------------|--------------------------------------------|
| `/`                  | Dashboard         | Overview + Analytics tabs with real data   |
| `/users`             | Students          | User listing table with search/pagination  |
| `/user/details/:id`  | StudentDetailPage | Individual user analytics & moderation     |
| `/login`             | SignIn             | Admin authentication                       |
| `/logout`            | Logout            | Session cleanup                            |

### Dashboard

**Overview Tab:**
- Total Users (from DB)
- Total Messages (from DB)
- Flagged Users count
- Active Now (online users)
- User Gender Chart (registration trend by gender)

**Analytics Tab:**
- Total Chats
- Flagged Messages
- Flagged Users
- Message Trend line chart (last 30 days)
- User Registration trend (last 30 days)

### Content Moderation Features

- **Warn user** — send warning email
- **Block user** — set `is_flagged: true` and notify parent via email
- **Unblock user** — set `is_flagged: false`
- **Delete user** — soft delete (`is_active: false`)

---

## Backend Server

**Directory:** `server/`
**Stack:** Express.js 4.21, Mongoose 8.10, Socket.io 4.8, JWT, Redis 4.7, Nodemailer

### Directory Structure

```
server/
├── config/          # DB, Redis, Socket.io, Email, Crypto, Swagger, Admin setup
├── controllers/v1/  # Business logic (admin, user, message controllers)
├── middleware/       # JWT verification, admin check, request logger
├── models/          # Mongoose schemas (Users, Messages, Chats, PasswordReset)
├── routes/v1/       # Route definitions
├── migrations/      # Database migration script
├── utils/           # Email sending utilities
└── index.js         # Entry point
```

### Key Endpoints

**Dashboard:** `GET /auth/dashboard-stats/` — real-time stats (total users, messages, online users, flagged, trends)

**User Management:** CRUD operations, block/unblock, analytics per user

**Messaging:** Send and retrieve encrypted messages

### Message Encryption

All messages are encrypted at rest using **AES-256-CBC** with a random IV per message.

---

## Database Schema

### Collections

| Collection     | Purpose                              |
|----------------|--------------------------------------|
| `users`        | User accounts, profiles, status      |
| `messages`     | Encrypted chat messages              |
| `chats`        | Conversations between participants   |
| `passwordresets`| Temporary password reset tokens (TTL)|

### Key User Fields

- `is_online` — real-time online status (updated via socket events)
- `last_active` — timestamp of last disconnect/logout (used for "Last seen" display)
- `is_flagged` / `flag_count` — content moderation status
- `is_active` — soft delete flag
- `socket_id` — current Socket.io connection ID

---

## Authentication & Security

### JWT Token System

- **Access Token:** 15-minute expiry, sent in `Authorization: Bearer <token>` header
- **Refresh Token:** 7-day expiry, stored in Redis keyed by user ID
- **Token Refresh:** Automatic on 401 response via axios interceptors

### Role-Based Access Control

- **USER role:** Chat, messaging, profile management
- **ADMIN role:** All user routes + dashboard stats, user analytics, block/unblock, email notifications

---

## Real-Time Communication

### Socket.io Events

| Event | Direction | Payload | When |
|-------|-----------|---------|------|
| `add-user` | Client -> Server | `userId` | After login, registers user as online |
| `online-users` | Server -> Client | `string[]` (userIds) | Once after `add-user`, initial online list |
| `user-status-change` | Server -> All others | `{ userId, isOnline, lastSeen? }` | On connect, disconnect, logout |
| `send-msg` | Client -> Server | `{ to, from, msg }` | User sends a message |
| `msg-recieve` | Server -> Client | `{ from, msg }` | Message delivery to recipient |
| `logout` | Client -> Server | `userId` | User logs out |

### Online Status Flow

1. User logs in -> Chat page mounts -> `SocketProvider.connect()` called -> socket established
2. `add-user` emitted -> server adds to Map, broadcasts `user-status-change` to others
3. Server sends `online-users` list back to the connecting user
4. On disconnect/logout -> server saves `last_active` to DB, broadcasts offline status with `lastSeen` timestamp
5. Socket disconnected on logout via `SocketProvider.disconnect()`

### Last Seen

- On login, `last_active` timestamps are fetched from DB for all contacts (one-time REST call)
- Real-time updates come via `user-status-change` socket events with `lastSeen` field
- Displayed as: "Last seen today at 2:30 PM" / "Last seen yesterday at 5:15 PM" / "Last seen Apr 10 at 5:15 PM"
