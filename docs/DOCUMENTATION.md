# MERN-NLP-Emotract - Project Documentation

## Table of Contents

1. [Introduction](#introduction)
2. [System Overview](#system-overview)
3. [User Application](#user-application)
4. [Admin Application](#admin-application)
5. [Backend Server](#backend-server)
6. [FastAPI NLP Service](#fastapi-nlp-service)
7. [Database Schema](#database-schema)
8. [Authentication & Security](#authentication--security)
9. [Real-Time Communication](#real-time-communication)
10. [Emotion Analysis Pipeline](#emotion-analysis-pipeline)

---

## Introduction

MERN-NLP-Emotract is a full-stack, research-driven chat application that integrates **Natural Language Processing (NLP)** and **affective computing** into a real-time messaging platform. The system detects emotions, hate speech, and offensive language in user messages using an ensemble of four ML models (BERT, RoBERTa, Logistic Regression, Random Forest).

### Research Datasets

The NLP models were trained using three publicly available datasets:

1. **Hate Speech and Offensive Language Dataset** (Andrii Samoshyn, 2020) - Annotated text data for detecting hate speech and offensive content.
2. **GoEmotions** (Debarshi Chanda, 2021) - Google's fine-grained emotion dataset with 27 emotion labels.
3. **Emotions Dataset** (Bhavik Jikadara, 2024) - Short text segments labeled with primary emotions.

---

## System Overview

The application follows a **microservices architecture** with four independent services:

| Service        | Technology             | Port | Purpose                          |
|----------------|------------------------|------|----------------------------------|
| User Frontend  | React 19 + Vite        | 5173 | End-user chat interface          |
| Admin Frontend | React 18 + TypeScript  | 5174 | Admin dashboard & analytics      |
| Backend API    | Express.js + Socket.io | 5000 | REST API + WebSocket server      |
| NLP Service    | FastAPI + PyTorch      | 8000 | Emotion classification inference |

**External Dependencies:**
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

### Key Components

- **Chat.jsx** - Main chat page: loads contacts, establishes socket connection, checks user block status, two-column layout (contacts sidebar + chat area)
- **ChatContainer.jsx** - Message display area with real-time message reception, auto-scroll, online status indicator
- **ChatInput.jsx** - Message input with emoji picker (emoji-picker-react)
- **Contacts.jsx** - Contact list with search, last message preview, user info
- **SuspendedUserPopup.jsx** - Modal overlay for blocked/suspended accounts
- **Settings.jsx** - Dropdown menu with avatar change and logout options

### State Management

- **Component-level `useState`** for all UI state
- **`localStorage`** for authentication tokens and user data
- **React Context** (`SocketProvider`) for Socket.io instance sharing
- No external state library (Redux, Zustand, etc.)

### Authentication Flow

1. User submits credentials on `/login`
2. Backend returns `{ accessToken, refreshToken, user }`
3. Tokens stored in `localStorage`
4. Axios interceptor attaches `Authorization: Bearer <token>` to all requests
5. On 401 response: automatic token refresh via `/auth/refresh-token`
6. On refresh failure: clear storage, redirect to `/login`

---

## Admin Application

**Directory:** `admin/`
**Stack:** React 18, TypeScript, Vite 5.1, ShadCN UI, Tailwind CSS, React Query v5

### Pages

| Route                | Component         | Description                                |
|----------------------|-------------------|--------------------------------------------|
| `/`                  | Dashboard         | Gender distribution chart, overview stats  |
| `/users`             | Students          | User listing table with search/pagination  |
| `/user/details/:id`  | StudentDetailPage | Individual user analytics & moderation     |
| `/form`              | Form              | Form management                            |
| `/login`             | SignIn             | Admin authentication                       |
| `/logout`            | Logout            | Session cleanup                            |

### Key Features

- **User Analytics:** Message counts, emotion distribution charts, sentiment trends, flagged message tracking
- **Content Moderation:** Warn user (send email), block user (notify parent), unblock user, delete user (soft delete)
- **Charts:** Gender distribution (pie), age distribution, message trends (line), emotion distribution (pie with labels)
- **Data Tables:** Paginated, searchable user listings with TanStack Table

### State Management

- **React Query (TanStack Query v5)** for server state (data fetching, caching, mutations)
- **React Context** for client state (sidebar toggle, theme)
- **Query hooks:** `useGetStudents()`, `useGetUserAnalytics(id)`, `useGetGenderDetails()`, `useBlockUser()`, `useDeleteUser()`, etc.

### UI Component Library

Built on **ShadCN UI** (Radix primitives + Tailwind CSS) with 60+ pre-configured components including Dialog, Table, Card, Sheet, Tabs, Form, Select, and more.

---

## Backend Server

**Directory:** `server/`
**Stack:** Express.js 4.21, Mongoose 8.10, Socket.io 4.8, JWT, Redis 4.7, Nodemailer

### Directory Structure

```
server/
├── config/          # DB, Redis, Socket.io, Email, Crypto, Swagger, Admin setup
├── constants/       # Email templates, emotion color mappings
├── controllers/v1/  # Business logic (admin, user, message controllers)
├── middleware/       # JWT verification, admin check, request logger
├── models/          # Mongoose schemas
├── routes/v1/       # Route definitions
├── utils/           # Emotion analysis, email sending, cron processing
└── index.js         # Entry point
```

### Controllers

**userController.js:**
- `login()` - Authenticate, generate JWT pair, store refresh token in Redis
- `register()` - Create user with validation, age verification (18+)
- `getAllUsers()` - Active non-admin users except requester
- `getAllContactsUsers()` - Users with existing chat conversations
- `setAvatar()` - Update avatar image URL
- `forgotPassword()` / `resetPassword()` - Password recovery flow
- `refreshToken()` - Token refresh via Redis lookup
- `logOut()` - Remove session from Redis, update online status

**messageController.js:**
- `addMessage()` - Create/update chat, encrypt and store message
- `getMessages()` - Retrieve and decrypt messages between two users

**adminController.js:**
- `getCompleteUsersDetails()` - All users with analytics fields
- `getUserDetails()` / `getUserAnalytics()` - Individual user data and analytics
- `blockUser()` / `unBlockUser()` - Toggle `is_flagged` status
- `deleteUser()` - Soft delete (`is_active: false`)
- `getUserGenderDetails()` - Registration trends by gender/date
- `informUserOrGuardian()` - Send warning/block emails

### Middleware

| Middleware           | Purpose                                           |
|----------------------|---------------------------------------------------|
| `verifyAccessToken`  | Validates JWT from Authorization header            |
| `isAdmin`            | Checks `req.user.role === "ADMIN"`                |
| `logger`             | Logs HTTP requests with color-coded method names   |

### Message Encryption

All messages are encrypted at rest using **AES-256-CBC**:
- Encryption key: 32-byte key from `ENCRYPTION_KEY` env var
- IV (initialization vector) prepended to ciphertext
- `safeDecrypt()` handles decryption with error recovery

---

## FastAPI NLP Service

**Directory:** `fastapi/`
**Stack:** FastAPI 0.115, PyTorch 2.6, Transformers 4.48, Scikit-learn 1.6

### Endpoints

| Method | Path              | Description                    |
|--------|-------------------|--------------------------------|
| GET    | `/`               | Health check                   |
| GET    | `/api/v1/test/`   | Test route                     |
| POST   | `/api/v1/analyze/` | Emotion analysis (main endpoint) |

### Analyze Endpoint

**Request:**
```json
{ "text": "I am so happy today!" }
```

**Response:**
```json
{
  "data": {
    "bert":    { "emotion": "joy", "probability": 0.95, "sentiment": "positive" },
    "roberta": { "emotion": "joy", "probability": 0.92, "sentiment": "positive" },
    "rf":      { "emotion": "joy", "probability": 0.88, "sentiment": "positive" },
    "lr":      { "emotion": "joy", "probability": 0.85, "sentiment": "positive" }
  },
  "message": "Prediction of emotions and sentiments was successful"
}
```

### Models

| Model               | Type         | Framework     | Emotions | Features        |
|----------------------|--------------|---------------|----------|-----------------|
| BERT                 | Transformer  | PyTorch       | 28       | Token embeddings|
| RoBERTa              | Transformer  | PyTorch       | 28       | Token embeddings|
| Logistic Regression  | Linear       | Scikit-learn  | 7        | TF-IDF vectors  |
| Random Forest        | Ensemble     | Scikit-learn  | 7        | TF-IDF vectors  |

### Emotion Labels

**28-class (BERT/RoBERTa):** admiration, amusement, anger, annoyance, approval, caring, confusion, curiosity, lust, disappointment, disapproval, disgust, embarrassment, excitement, fear, gratitude, grief, joy, love, nervousness, optimism, pride, realization, relief, remorse, sadness, surprise, neutral

**7-class (LR/RF):** sadness, joy, love, anger, fear, surprise, lust

### Sentiment Mapping

Each emotion is mapped to a sentiment category:
- **Positive:** admiration, amusement, approval, caring, excitement, gratitude, joy, love, optimism, pride, relief
- **Negative:** anger, annoyance, disappointment, disapproval, disgust, embarrassment, fear, grief, lust, nervousness, remorse, sadness
- **Neutral:** confusion, curiosity, realization, surprise

---

## Database Schema

### Users Collection

| Field             | Type     | Description                                |
|-------------------|----------|--------------------------------------------|
| username          | String   | Unique, 3-20 characters                   |
| email             | String   | Unique                                     |
| password          | String   | Bcrypt hashed, min 8 chars                |
| firstname         | String   | Required                                   |
| lastname          | String   | Required                                   |
| age               | Number   | Calculated from DOB                        |
| gender            | String   | Enum: "M", "F", "O"                       |
| phone             | String   | Unique, required                           |
| parent_email      | String   | Guardian's email for notifications         |
| aadhaar_number    | String   | Unique, Indian ID number                   |
| role              | String   | Enum: "USER", "ADMIN"                     |
| is_active         | Boolean  | Soft delete flag (default: true)           |
| is_online         | Boolean  | Real-time online status                    |
| is_flagged        | Boolean  | Blocked/moderated flag                     |
| flag_count        | Number   | Number of flagged messages                 |
| avatarImage       | String   | Avatar URL                                 |
| socket_id         | String   | Current Socket.io connection ID            |

### Messages Collection

| Field              | Type     | Description                               |
|--------------------|----------|-------------------------------------------|
| chat_id            | ObjectId | Reference to Chats collection             |
| sender_id          | ObjectId | Reference to Users collection             |
| text               | String   | AES-256 encrypted message content         |
| processing_status  | String   | Enum: "processing", "processed"           |
| is_flagged         | Boolean  | Flagged by emotion analysis               |
| message_status     | String   | Enum: "pending", "sent", "delivered", "seen" |

### Chats Collection

| Field          | Type       | Description                         |
|----------------|------------|-------------------------------------|
| participants   | [ObjectId] | Array of user IDs in conversation   |
| is_group       | Boolean    | Group chat flag (default: false)    |
| last_message   | Object     | {text, sender_id, sent_at}          |

### MessageMetadata Collection

| Field              | Type    | Description                                |
|--------------------|---------|--------------------------------------------|
| message_id         | ObjectId| Reference to Messages collection           |
| bert               | Object  | {emotion, probability, sentiment}          |
| roberta            | Object  | {emotion, probability, sentiment}          |
| logistic_regression| Object  | {emotion, probability, sentiment}          |
| random_forest      | Object  | {emotion, probability, sentiment}          |
| is_flagged         | Boolean | Content flagged as sensitive               |
| sentiment_score    | Number  | Aggregated sentiment score (-2 to +4)      |

### PasswordReset Collection

| Field     | Type     | Description                    |
|-----------|----------|--------------------------------|
| userId    | ObjectId | Reference to Users             |
| token     | String   | Reset token                    |
| expiresAt | Date     | Expiration (1 hour from creation) |

---

## Authentication & Security

### JWT Token System

- **Access Token:** 15-minute expiry, sent in `Authorization: Bearer <token>` header
- **Refresh Token:** 7-day expiry, stored in Redis keyed by user ID
- **Token Refresh:** Automatic on 401 response via axios interceptors on both frontends

### Role-Based Access Control

- **USER role:** Chat, message, profile, avatar, password management
- **ADMIN role:** All user routes + user analytics, block/unblock, delete, email notifications

### Message Encryption

- Algorithm: **AES-256-CBC**
- Key: 32-byte key from `ENCRYPTION_KEY` environment variable
- Each message gets a random IV (initialization vector)
- IV is prepended to the ciphertext for storage
- Decrypted on retrieval with `safeDecrypt()` (graceful error handling)

### Password Security

- Passwords hashed with **bcrypt** before storage
- Minimum 8 character requirement
- Passwords never returned in API responses
- Password reset via time-limited tokens (1-hour expiry)

---

## Real-Time Communication

### Socket.io Events

**Client Emits:**
| Event       | Payload            | Description                    |
|-------------|--------------------|--------------------------------|
| `add-user`  | userId             | Register user on connection    |
| `send-msg`  | {to, msg}          | Send message to recipient      |
| `logout`    | userId             | Notify server of logout        |

**Server Emits:**
| Event         | Payload   | Description                     |
|---------------|-----------|---------------------------------|
| `msg-recieve` | message   | Deliver incoming message        |

### Online Status Tracking

- Global `onlineUsers` Map on server tracks `userId -> socketId`
- User's `is_online` status updated in MongoDB on connect/disconnect
- Online status queryable via `GET /auth/online-status/:id`

---

## Emotion Analysis Pipeline

### Processing Flow

1. **Message Sent:** User sends message via Socket.io + REST API
2. **Storage:** Message encrypted (AES-256) and stored with `processing_status: "processing"`
3. **Cron Job:** `processEmotion.js` runs every 10 seconds, picks unprocessed messages
4. **Analysis:** Decrypted text sent to FastAPI (`POST /api/v1/analyze/`)
5. **Results:** Four model predictions stored in `MessageMetadata` collection
6. **Scoring:** Sentiment score calculated (-2 to +4 range based on model consensus)
7. **Flagging:** Messages flagged if emotion is "lust" with probability > 0.75
8. **User Flagging:** User's `flag_count` incremented for flagged messages
9. **Completion:** Message `processing_status` set to "processed"

### Sentiment Score Calculation

The sentiment score aggregates results from all four models:
- Each "positive" sentiment: +1
- Each "negative" sentiment: -1
- Each "neutral" sentiment: 0
- Score range: -4 to +4 (sum of four model sentiments)

### Content Moderation

When a user accumulates flagged messages, admins can:
1. **Warn** the user via email
2. **Block** the user (sets `is_flagged: true`) and notify parent via email
3. **Unblock** the user (sets `is_flagged: false`)
4. **Delete** the user (soft delete via `is_active: false`)
