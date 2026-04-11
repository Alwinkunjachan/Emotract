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
│  │  - Avatar selection  │       │  - Content Moderation    │       │
│  │  - User auth         │       │  - Admin auth            │       │
│  └──────────┬───────────┘       └────────────┬─────────────┘       │
│             │ HTTP + WebSocket                │ HTTP                │
└─────────────┼────────────────────────────────┼─────────────────────┘
              │                                │
              ▼                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EXPRESS BACKEND (Port 5000)                      │
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
│  │  ┌─────────────┐  │  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │ AES-256     │  │  │ Nodemailer   │  │ node-cron      │  │   │
│  │  │ Encryption  │  │  │ Email        │  │ Emotion        │  │   │
│  │  │ /Decryption │  │  │ Service      │  │ Processing     │  │   │
│  │  └─────────────┘  │  └──────────────┘  └───────┬────────┘  │   │
│  └────────────────────┼───────────────────────────┼────────────┘   │
└───────────────────────┼───────────────────────────┼────────────────┘
                        │                           │
              ┌─────────┼───────────┐               │ HTTP (every 10s)
              │         │           │               │
              ▼         ▼           ▼               ▼
      ┌───────────┐ ┌────────┐ ┌────────────────────────────────────┐
      │  MongoDB   │ │ Redis  │ │     FASTAPI NLP SERVICE (8000)    │
      │            │ │        │ │                                    │
      │ - Users    │ │ Refresh│ │  ┌──────┐ ┌────────┐ ┌────┐ ┌──┐ │
      │ - Messages │ │ Tokens │ │  │ BERT │ │RoBERTa │ │ LR │ │RF│ │
      │ - Chats    │ │ (7d)   │ │  └──────┘ └────────┘ └────┘ └──┘ │
      │ - Metadata │ │        │ │  28 emotions  28 emo  7 emo  7 em │
      │ - PwdReset │ │        │ │                                    │
      └───────────┘ └────────┘ └────────────────────────────────────┘
```

---

## Service Communication

### Request Flow: Sending a Message

```
User App                Express Backend              MongoDB           FastAPI
   │                         │                          │                  │
   │──POST /messages/addmsg──►                          │                  │
   │──Socket "send-msg"──────►                          │                  │
   │                         │──Encrypt(AES-256)──┐     │                  │
   │                         │                    │     │                  │
   │                         │──Store message─────┼────►│                  │
   │                         │  (status:processing)     │                  │
   │                         │                          │                  │
   │                         │──Socket "msg-recieve"──► Recipient          │
   │                         │                          │                  │
   │                         │     [Cron: every 10s]    │                  │
   │                         │──Fetch unprocessed──────►│                  │
   │                         │◄─────messages────────────│                  │
   │                         │                          │                  │
   │                         │──POST /analyze/──────────┼─────────────────►│
   │                         │◄─────{bert,roberta,lr,rf}┼──────────────────│
   │                         │                          │                  │
   │                         │──Store metadata──────────►                  │
   │                         │──Update status:processed─►                  │
   │                         │──Flag if sensitive───────►                  │
```

### Request Flow: Admin User Analytics

```
Admin App              Express Backend              MongoDB
   │                        │                          │
   │──GET /get-user-        │                          │
   │   analytics/:id───────►│                          │
   │   (Bearer token)       │──verifyAccessToken──┐    │
   │                        │──isAdmin────────────┘    │
   │                        │                          │
   │                        │──Aggregate user data────►│
   │                        │──Count messages──────────►│
   │                        │──Aggregate emotions──────►│
   │                        │──Calculate sentiments────►│
   │                        │◄─────────────────────────│
   │                        │                          │
   │◄──{user, chatCount,    │                          │
   │    messageStats,       │                          │
   │    emotionDistribution,│                          │
   │    sentimentPercentage}│                          │
```

### Authentication Flow

```
Client                  Express Backend              Redis
  │                          │                          │
  │──POST /auth/login────────►                          │
  │  {username, password}    │──Verify bcrypt hash──┐   │
  │                          │                      │   │
  │                          │──Generate tokens─────┘   │
  │                          │   accessToken (15min)    │
  │                          │   refreshToken (7day)    │
  │                          │                          │
  │                          │──Store refreshToken──────►│
  │◄──{accessToken,          │                          │
  │    refreshToken, user}   │                          │
  │                          │                          │
  │  ... 15 minutes later ...│                          │
  │                          │                          │
  │──Any request (401)──────►│                          │
  │◄──401 Unauthorized───────│                          │
  │                          │                          │
  │──POST /refresh-token─────►                          │
  │  {refreshToken}          │──Verify in Redis─────────►│
  │                          │◄─────────────────────────│
  │                          │──Generate new access──┐  │
  │◄──{accessToken}──────────│                       │  │
  │                          │                       │  │
  │──Retry original request──►                       │  │
```

---

## Data Models & Relationships

```
┌──────────────┐       ┌──────────────┐       ┌────────────────────┐
│    Users     │       │    Chats     │       │     Messages       │
├──────────────┤       ├──────────────┤       ├────────────────────┤
│ _id          │◄──┐   │ _id          │◄──────│ chat_id            │
│ username     │   │   │ participants │───────►│ sender_id ─────────┼──►Users
│ email        │   │   │ is_group     │       │ text (encrypted)   │
│ password     │   ├───│ group_admins │       │ processing_status  │
│ role         │   │   │ last_message │       │ is_flagged         │
│ is_flagged   │   │   └──────────────┘       │ message_status     │
│ flag_count   │   │                          └─────────┬──────────┘
│ is_online    │   │                                    │
│ is_active    │   │                                    │
└──────────────┘   │   ┌──────────────────────┐         │
                   │   │  MessageMetadata     │         │
                   │   ├──────────────────────┤         │
                   │   │ message_id ──────────┼─────────┘
                   │   │ bert {emotion,prob}  │
                   │   │ roberta {emotion}    │
                   │   │ logistic_regression  │
                   │   │ random_forest        │
                   │   │ sentiment_score      │
                   │   │ is_flagged           │
                   │   └──────────────────────┘
                   │
                   │   ┌──────────────────────┐
                   └───│  PasswordReset       │
                       ├──────────────────────┤
                       │ userId               │
                       │ token                │
                       │ expiresAt            │
                       └──────────────────────┘
```

---

## Emotion Analysis Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    FASTAPI NLP SERVICE                           │
│                                                                 │
│  Input Text ──────────────────────────────────────────────┐     │
│       │                                                   │     │
│       ├──► BERT Tokenizer ──► BERT Model ──► Softmax ──► │     │
│       │    (WordPiece)        (28 classes)    (probs)     │     │
│       │                                                   │     │
│       ├──► RoBERTa Tokenizer ► RoBERTa ──► Softmax ──►   │     │
│       │    (BPE)               (28 classes)  (probs)      │     │
│       │                                                   │     │
│       ├──► TF-IDF Vectorizer ► Logistic Reg ► Probs ──►  │     │
│       │                        (7 classes)                │     │
│       │                                                   │     │
│       └──► TF-IDF Vectorizer ► Random Forest ► Probs ──► │     │
│                                (7 classes)                │     │
│                                                           │     │
│                              ┌────────────────────────────┘     │
│                              ▼                                  │
│                    Emotion-to-Sentiment Mapping                 │
│                    ┌─────────────────────────┐                  │
│                    │ Positive: joy, love,    │                  │
│                    │   admiration, pride...  │                  │
│                    │ Negative: anger, fear,  │                  │
│                    │   sadness, lust...      │                  │
│                    │ Neutral: confusion,     │                  │
│                    │   curiosity, surprise   │                  │
│                    └─────────────────────────┘                  │
│                              │                                  │
│                              ▼                                  │
│                    Response: {bert, roberta, rf, lr}             │
│                    Each: {emotion, probability, sentiment}       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack Summary

### Frontend (User App)
| Layer          | Technology                 |
|----------------|----------------------------|
| Framework      | React 19                   |
| Build Tool     | Vite 6.1                   |
| Styling        | Styled Components + Tailwind CSS |
| Icons          | Lucide React, React Icons  |
| HTTP           | Axios (with interceptors)  |
| WebSocket      | Socket.io Client           |
| Emoji          | emoji-picker-react         |
| Notifications  | React Toastify             |

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
| Theme          | next-themes (dark mode)    |

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
| Scheduler      | node-cron                  |
| API Docs       | Swagger/OpenAPI            |

### NLP Service
| Layer          | Technology                 |
|----------------|----------------------------|
| Framework      | FastAPI 0.115              |
| Deep Learning  | PyTorch 2.6 + Transformers 4.48 |
| Traditional ML | Scikit-learn 1.6           |
| Validation     | Pydantic 2.10              |
| Server         | Uvicorn                    |

### Infrastructure
| Component      | Technology                 |
|----------------|----------------------------|
| Containers     | Docker + Docker Compose    |
| Database       | MongoDB                    |
| Cache/Sessions | Redis                      |
| Reverse Proxy  | N/A (direct port access)   |

---

## Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                       │
│                                                         │
│  ┌─── Authentication ─────────────────────────────┐     │
│  │  - JWT Access Token (15min expiry)             │     │
│  │  - JWT Refresh Token (7-day, stored in Redis)  │     │
│  │  - Bcrypt password hashing                     │     │
│  │  - Role-based access (USER / ADMIN)            │     │
│  └────────────────────────────────────────────────┘     │
│                                                         │
│  ┌─── Data Protection ────────────────────────────┐     │
│  │  - AES-256-CBC message encryption at rest      │     │
│  │  - Random IV per message                       │     │
│  │  - Passwords never in API responses            │     │
│  │  - Soft deletes (no permanent data loss)       │     │
│  └────────────────────────────────────────────────┘     │
│                                                         │
│  ┌─── Network ────────────────────────────────────┐     │
│  │  - CORS restricted to frontend origins         │     │
│  │  - withCredentials for cross-origin cookies    │     │
│  │  - HTTPS-ready (configurable)                  │     │
│  └────────────────────────────────────────────────┘     │
│                                                         │
│  ┌─── Content Safety ────────────────────────────┐      │
│  │  - NLP-based emotion detection                │      │
│  │  - Automated message flagging                 │      │
│  │  - Admin moderation tools                     │      │
│  │  - Parent notification system                 │      │
│  └───────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```
