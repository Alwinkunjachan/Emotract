# CLAUDE.md - MERN-NLP-Emotract

## Project Overview

MERN-NLP-Emotract is a research-driven, emotionally intelligent real-time chat application that uses NLP and deep learning to detect emotions, hate speech, and offensive language in user messages. It consists of four services:

| Service   | Directory  | Tech Stack                        | Port  |
|-----------|------------|-----------------------------------|-------|
| User App  | `user/`    | React 19 + Vite + Styled Comp.   | 5173  |
| Admin App | `admin/`   | React 18 + Vite + TypeScript + ShadCN UI | 5174  |
| Backend   | `server/`  | Node.js + Express + Socket.io     | 5000  |
| NLP API   | `fastapi/` | Python + FastAPI + PyTorch        | 8000  |

## Quick Start

### Docker (recommended)
```bash
docker-compose up --build
```

### Manual
```bash
# Terminal 1 - FastAPI NLP service
cd fastapi && source venv/bin/activate && uvicorn main:app --reload

# Terminal 2 - Express backend
cd server && npm start

# Terminal 3 - User frontend
cd user && npm run dev

# Terminal 4 - Admin frontend
cd admin && npm run dev
```

### Prerequisites
- Node.js (v18+)
- Python 3.12+
- MongoDB (running locally or via Docker)
- Redis (running locally or via Docker)
- Trained ML model files in `fastapi/models/` (bert/, roberta/, lr/, rf/)

## Architecture

```
User App (React) ──► Express Backend ──► MongoDB
Admin App (React) ──►     │                │
                     Socket.io (WS)    Redis (sessions)
                          │
                     FastAPI NLP ──► BERT, RoBERTa, LR, RF models
```

**Message Processing Pipeline:**
1. User sends message via Socket.io + REST API
2. Message encrypted (AES-256-CBC) and stored in MongoDB
3. Cron job (every 10s) picks unprocessed messages
4. Sends text to FastAPI for emotion analysis (4 models)
5. Results stored in `MessageMetadata` collection
6. Messages flagged if sensitive content detected (e.g., "lust" with >0.75 probability)

## Key Directories

```
├── admin/              # Admin dashboard (React + TypeScript)
│   └── src/
│       ├── pages/      # Auth, Dashboard, Students, Form
│       ├── components/ # UI (ShadCN), Charts, Shared, Layout
│       ├── lib/        # API functions
│       └── routes/     # React Router config
├── user/               # User chat app (React + JavaScript)
│   └── src/
│       ├── pages/      # Chat, Login, Register, Password Reset
│       ├── components/ # ChatContainer, Contacts, ChatInput
│       ├── context/    # SocketProvider
│       └── utils/      # API routes, axios instance, PrivateRoute
├── server/             # Express.js backend
│   ├── config/         # DB, Redis, Socket, Email, Crypto, Swagger
│   ├── controllers/v1/ # Admin, User, Message controllers
│   ├── middleware/      # Auth (JWT), isAdmin, Logger
│   ├── models/         # Mongoose schemas (Users, Messages, Chats, etc.)
│   ├── routes/v1/      # Auth routes, Message routes
│   └── utils/          # Emotion analysis, email, cron processing
├── fastapi/            # Python NLP microservice
│   ├── api/v1/         # Route handlers
│   ├── models/         # ML model loading (BERT, RoBERTa, LR, RF)
│   └── utils/          # Emotion labels, sentiment mappings
└── docker-compose.yml  # Full-stack orchestration
```

## Environment Variables

Each service requires a `.env` file (see `.env.example` in each directory):

**server/.env** (critical):
- `MONGO_URL` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `ENCRYPTION_KEY` - 32-byte AES-256 key for message encryption
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` - Redis connection
- `FASTAPI_URL` - URL of the NLP service (default: `http://127.0.0.1:8000`)
- `EMAIL_*` - SMTP config for Nodemailer (warnings, password reset)
- `ADMIN_*` - Default admin account credentials

**admin/.env**: `VITE_BACKEND_URL` (default: `http://localhost:5000`)
**user/.env**: `VITE_BACKEND_URL` (default: `http://localhost:5000`)

## Database

- **MongoDB** - Primary data store (Users, Messages, Chats, MessageMetadata, PasswordReset)
- **Redis** - Refresh token storage (7-day TTL), session management
- Messages are encrypted at rest with AES-256-CBC

## Authentication

- JWT-based with access tokens (15min) and refresh tokens (7 days in Redis)
- Access token sent via `Authorization: Bearer <token>` header
- Refresh token auto-rotation on 401 responses (handled by axios interceptors)
- Role-based: `USER` and `ADMIN` roles
- Admin routes protected by `verifyAccessToken` + `isAdmin` middleware

## API Base Paths

- REST API: `http://localhost:5000/api/v1/`
- NLP API: `http://localhost:8000/api/v1/`
- Swagger docs: `http://localhost:5000/api-docs`
- WebSocket: `http://localhost:5000` (Socket.io)

## Key Conventions

- ES Modules throughout (`"type": "module"` in server)
- Soft deletes via `is_active` flag (no hard deletes on users)
- User blocking via `is_flagged` flag and `flag_count`
- All message text encrypted before storage, decrypted on retrieval
- API versioned under `/api/v1/`
- Admin frontend uses React Query for server state, Context for client state
- User frontend uses component-level useState + localStorage

## Common Tasks

```bash
# Run tests (none configured yet)
# Lint admin
cd admin && npx eslint src/
# Check server
cd server && npm start
# Check NLP service
cd fastapi && uvicorn main:app --reload
```

## NLP Models

Four models classify emotions in messages:
- **BERT** (28 emotions, transformer-based)
- **RoBERTa** (28 emotions, transformer-based)
- **Logistic Regression** (7 emotions, TF-IDF + sklearn)
- **Random Forest** (7 emotions, TF-IDF + sklearn)

Model files are NOT in the repository - they must be trained separately and placed in:
- `fastapi/models/bert/model/` and `fastapi/models/bert/tokenizer/`
- `fastapi/models/roberta/model/` and `fastapi/models/roberta/tokenizer/`
- `fastapi/models/lr/lr_model.pkl` and `fastapi/models/lr/vectorizer.pkl`
- `fastapi/models/rf/rf_model.pkl` and `fastapi/models/rf/vectorizer.pkl`
