# Emotract - Project Documentation

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

Emotract is a full-stack real-time chat application with an admin dashboard for user management, analytics, and content moderation. The system features Auth0-based authentication (with SSO support), encrypted messaging, real-time online/offline status tracking, and email-based notifications.

---

## System Overview

The application follows a **client-server architecture** with three independent services:

| Service        | Technology             | Port | Purpose                          |
|----------------|------------------------|------|----------------------------------|
| User Frontend  | React 19 + Vite        | 5173 | End-user chat interface          |
| Admin Frontend | React 18 + TypeScript  | 5174 | Admin dashboard & analytics      |
| Backend API    | Express.js + Socket.io | 5001 | REST API + WebSocket server      |

**External Dependencies:**
- **MongoDB** — Primary document database (included in Docker Compose)
- **Auth0** — Identity provider (cloud service, handles login/signup/SSO/password reset)

---

## User Application

**Directory:** `user/`
**Stack:** React 19, Vite 6.1, Styled Components, Tailwind CSS, Socket.io Client, Auth0 React SDK

### Pages

| Route                | Component        | Auth Required | Description                     |
|----------------------|------------------|---------------|---------------------------------|
| `/`                  | Chat             | Yes           | Main chat interface             |
| `/login`             | Login            | No            | Auto-redirects to Auth0 Universal Login |
| `/complete-profile`  | CompleteProfile  | Yes           | First-login profile fields      |
| `/setAvatar`         | SetAvatar        | Yes           | Avatar selection (DiceBear API) |

### Key Features

- **Auth0 Universal Login** — auto-redirect to Auth0 for login/signup, with SSO (Google, etc.)
- **Profile completion** — first-time users fill in phone, aadhaar, age, gender, parent email
- **Real-time messaging** via Socket.io with message encryption
- **Online/offline status** — green dot indicator on contact avatars
- **Last seen timestamps** — "Last seen today at 2:30 PM" for offline users
- **Unread message badges** — green badge with count on contacts with new messages
- **New contact auto-add** — when an unknown user sends a message, they appear in the sidebar automatically
- **Chat persistence** — selected chat survives page refresh (sessionStorage)
- **Auto-focus chat input** — input field focuses when a contact is selected
- **Contact search** — search bar to find users and start new conversations
- **Emoji picker** — built-in emoji selection in chat input
- **Suspended user popup** — modal for blocked/flagged accounts
- **Login error handling** — shows error message with "Try Again" button

### State Management

- **Auth0 SDK** for authentication state (`cacheLocation: 'localstorage'`)
- **Component-level `useState`** for UI state
- **`sessionStorage`** for current chat persistence across refresh
- **React Context** (`SocketProvider`) for Socket.io instance with Auth0 token authentication

---

## Admin Application

**Directory:** `admin/`
**Stack:** React 18, TypeScript, Vite 5.1, ShadCN UI, Tailwind CSS, React Query v5, Auth0 React SDK

### Pages

| Route                | Component         | Description                                |
|----------------------|-------------------|--------------------------------------------|
| `/`                  | Dashboard         | Overview + Analytics tabs with real data   |
| `/users`             | Students          | User listing table with search/pagination  |
| `/user/details/:id`  | StudentDetailPage | Individual user analytics & moderation     |
| `/login`             | SignIn             | Auto-redirects to Auth0 Universal Login    |
| `/logout`            | Logout            | Auth0 session cleanup                      |

### Dashboard

**Overview Tab:**
- Total Users, Total Messages, Flagged Users, Active Now (online)
- User Gender Chart (registration trend by gender)

**Analytics Tab:**
- Total Chats, Flagged Messages, Flagged Users
- Message Trend line chart (last 30 days)
- User Registration trend (last 30 days)

### Content Moderation

- **Warn user** — send warning email
- **Block user** — set `is_flagged: true` and notify parent via email
- **Unblock user** — set `is_flagged: false`
- **Delete user** — soft delete (`is_active: false`)

### Admin Access Control

- Role checked via `/me` endpoint (`role: "ADMIN"`)
- Users who sign up via the admin app (`:5174`) are automatically assigned the `ADMIN` role
- Non-admin users see "Access Denied" message

---

## Backend Server

**Directory:** `server/`
**Stack:** Express.js 4.21, Mongoose 8.10, Socket.io 4.8, Auth0 (express-oauth2-jwt-bearer + jose), Nodemailer

### Directory Structure

```
server/
├── config/          # DB, Auth0 Management Client, Socket.io, Email, Crypto, Swagger
├── controllers/v1/  # Business logic (admin, user, message controllers)
├── middleware/       # Auth0 JWT verification, resolveUser, isAdmin, logger
├── models/          # Mongoose schemas (Users, Messages, Chats)
├── routes/v1/       # Route definitions
├── migrations/      # Database migration + Auth0 migration scripts
├── utils/           # Email sending utilities
└── index.js         # Entry point
```

### Authentication Middleware Chain

1. **`verifyAccessToken`** — validates Auth0 JWT (RS256, JWKS auto-fetched via `express-oauth2-jwt-bearer`)
2. **`resolveUser`** — maps Auth0 `sub` claim to local MongoDB user via `auth0_id`. Auto-provisions new users on first API call.
3. **`isAdmin`** — checks `req.user.role === "ADMIN"` (for admin routes only)

### Auto-Provisioning

When a user authenticates via Auth0 but doesn't exist in MongoDB:
1. Middleware fetches profile from Auth0's `/userinfo` endpoint
2. Creates local user with `username`, `email`, and `is_profile_complete: false`
3. Role assigned based on `Origin` header: `:5173` → USER, `:5174` → ADMIN
4. User is redirected to `/complete-profile` to fill in required fields

### Message Encryption

All messages are encrypted at rest using **AES-256-CBC** with a random IV per message.

---

## Database Schema

### Collections

| Collection     | Purpose                              |
|----------------|--------------------------------------|
| `users`        | User accounts, profiles, Auth0 link  |
| `messages`     | Encrypted chat messages              |
| `chats`        | Conversations between participants   |

### Key User Fields

| Field | Type | Description |
|-------|------|-------------|
| `auth0_id` | String (unique, sparse) | Link to Auth0 user |
| `is_profile_complete` | Boolean | Whether profile fields are filled |
| `is_online` | Boolean | Real-time online status |
| `last_active` | Date | Timestamp of last disconnect/logout |
| `is_flagged` / `flag_count` | Boolean / Number | Content moderation status |
| `is_active` | Boolean | Soft delete flag |
| `socket_id` | String | Current Socket.io connection ID |
| `role` | String (USER/ADMIN) | Role-based access control |

---

## Authentication & Security

### Auth0 Integration

- **Login/Signup** — handled entirely by Auth0 Universal Login (redirect-based)
- **SSO** — Google and other providers configured in Auth0 dashboard
- **Password Reset** — delegated to Auth0
- **Token Management** — Auth0 React SDK handles tokens internally (`cacheLocation: 'localstorage'`)
- **Backend Validation** — RS256 JWT verification via JWKS endpoint
- **Socket Authentication** — Auth0 token verified using `jose` library during socket handshake

### Role-Based Access Control

- **USER role:** Chat, messaging, profile management
- **ADMIN role:** All user routes + dashboard stats, user analytics, block/unblock, email notifications
- Role determined by which app the user signs up from (Origin header)

---

## Real-Time Communication

### Socket.io Events

| Event | Direction | Payload | When |
|-------|-----------|---------|------|
| `online-users` | Server -> Client | `string[]` (userIds) | On socket connect, initial online list |
| `user-status-change` | Server -> All others | `{ userId, isOnline, lastSeen? }` | On connect, disconnect, logout |
| `send-msg` | Client -> Server | `{ to, msg }` | User sends a message (sender from socket.userId) |
| `msg-recieve` | Server -> Client | `{ from, msg }` | Message delivery to recipient |
| `logout` | Client -> Server | — | User logs out (userId from socket) |

### Online Status Flow

1. User logs in → Auth0 callback → Chat page mounts → `SocketProvider.connect()` with Auth0 token
2. Server verifies token, sets `socket.userId`, adds to `onlineUsers` Map
3. Server sends `online-users` list to connecting user, broadcasts `user-status-change` to others
4. On disconnect/logout → server saves `last_active` to DB, broadcasts offline status with `lastSeen`

### New Contact Detection

When a message arrives from a user not in the current contacts list:
1. Socket `msg-recieve` handler detects unknown sender
2. Fetches sender info from `/all-users` endpoint
3. Adds sender to contacts list with last message preview and unread badge
4. No page refresh needed
