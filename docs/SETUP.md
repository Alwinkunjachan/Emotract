# Setup & Deployment Guide - MERN-NLP-Emotract

## Prerequisites

| Dependency   | Version   | Purpose                          |
|-------------|-----------|----------------------------------|
| Node.js     | 18+       | Backend and frontend runtime     |
| Docker      | 24+       | Containerized deployment         |
| npm         | 9+        | Node package manager             |

For manual setup (without Docker), you also need:
- MongoDB 6.0+
- Redis 7.0+

---

## Option 1: Docker Deployment (Recommended)

### Step 1: Clone the Repository

```bash
git clone https://github.com/Alwinkunjachan/MERN-NLP-Emotract.git
cd MERN-NLP-Emotract
```

### Step 2: Configure Environment Variables

Create `.env` files for each service by copying the examples:

```bash
cp server/.env.example server/.env
cp admin/.env.example admin/.env
cp user/.env.example user/.env
```

Edit `server/.env` with your configuration:

```env
PORT=5001
MONGO_URL=mongodb://mongo:27017/chat
FRONTEND_URL="http://localhost:5173"
ADMIN_URL="http://localhost:5174"

JWT_SECRET=your-secure-jwt-secret-key
ENCRYPTION_KEY=X7kP9mWqT2rY5vL8nJ3zB6cF4dH0eA1

REDIS_PASSWORD=
REDIS_HOST=redis
REDIS_PORT=6379

ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_EMAIL=admin@example.com
ADMIN_PHONE=9999999999

EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
```

### Step 3: Build and Run

```bash
docker-compose up --build
```

Docker Compose will start all services including MongoDB and Redis.

### Step 4: Access the Application

| Service    | URL                          |
|------------|------------------------------|
| User App   | http://localhost:5173        |
| Admin App  | http://localhost:5174        |
| Backend    | http://localhost:5001        |
| API Docs   | http://localhost:5001/api-docs |

### Default Admin Credentials

- **Username:** `admin`
- **Password:** `admin123`

### Docker Commands

```bash
docker-compose up --build          # Build and start
docker-compose up --build -d       # Build and start in background
docker-compose logs -f             # View logs
docker-compose logs -f backend     # View backend logs only
docker-compose restart backend     # Restart a service
docker-compose down                # Stop all
docker-compose down -v             # Stop and remove all data
```

---

## Option 2: Manual Development Setup

### Step 1: Clone and Configure

```bash
git clone https://github.com/Alwinkunjachan/MERN-NLP-Emotract.git
cd MERN-NLP-Emotract
```

Create `.env` files as described above, but use local URLs:

**server/.env:**
```env
MONGO_URL=mongodb://localhost:27017/chat
REDIS_HOST=localhost
```

### Step 2: Start External Services

Ensure MongoDB and Redis are running locally.

### Step 3: Setup Express Backend

```bash
cd server
npm install
npm start
```

The server runs on port 5001. On first startup, it creates a default admin user.

### Step 4: Setup User Frontend

```bash
cd user
npm install
npm run dev
```

### Step 5: Setup Admin Frontend

```bash
cd admin
npm install
npm run dev
```

---

## Database Migration

Run from the `server/` directory:

| Command | Description |
|---------|-------------|
| `npm run migrate` | Create collections, indexes, and admin user |
| `npm run migrate:seed` | Above + seed 3 sample test users |
| `npm run migrate:drop` | Drop all collections and re-create (DESTRUCTIVE) |
| `npm run migrate:fresh` | Drop + re-create + seed sample data (DESTRUCTIVE) |

---

## Environment Variables Reference

### Server (`server/.env`)

| Variable          | Required | Default  | Description                          |
|-------------------|----------|----------|--------------------------------------|
| `PORT`            | No       | 5001     | Express server port                  |
| `MONGO_URL`       | Yes      | -        | MongoDB connection string            |
| `FRONTEND_URL`    | No       | http://localhost:5173 | User app URL (CORS)         |
| `ADMIN_URL`       | No       | http://localhost:5174  | Admin app URL (CORS)        |
| `JWT_SECRET`      | Yes      | -        | Secret key for signing JWT tokens    |
| `ENCRYPTION_KEY`  | Yes      | -        | 32-byte AES-256 encryption key       |
| `REDIS_HOST`      | Yes      | -        | Redis server hostname                |
| `REDIS_PORT`      | Yes      | -        | Redis server port                    |
| `REDIS_PASSWORD`  | No       | -        | Redis authentication password        |
| `ADMIN_USERNAME`   | Yes     | -        | Default admin account username       |
| `ADMIN_PASSWORD`   | Yes     | -        | Default admin account password       |
| `ADMIN_EMAIL`      | Yes     | -        | Default admin account email          |
| `ADMIN_PHONE`      | Yes     | -        | Default admin account phone          |
| `EMAIL_USER`       | Yes     | -        | SMTP sender email address            |
| `EMAIL_PASS`       | Yes     | -        | SMTP email app password              |
| `EMAIL_HOST`       | Yes     | -        | SMTP server hostname                 |
| `EMAIL_PORT`       | Yes     | -        | SMTP server port                     |
| `EMAIL_SECURE`     | No      | false    | Use TLS for SMTP                     |

### Frontend (`admin/.env` and `user/.env`)

| Variable            | Default                | Description                |
|---------------------|------------------------|----------------------------|
| `VITE_BACKEND_URL`  | http://localhost:5001  | Backend API base URL       |

---

## Email Configuration

For Gmail, generate an App Password:
1. Go to https://myaccount.google.com/apppasswords
2. Generate a new app password for "Mail"
3. Use this as `EMAIL_PASS` in your `.env`

---

## Troubleshooting

### Port 5001 in use
```bash
lsof -i :5001
kill -9 $(lsof -t -i:5001)
```

### MongoDB Connection Issues
```bash
mongosh --eval "db.runCommand({ ping: 1 })"
```

### Redis Connection Issues
```bash
redis-cli ping
```
