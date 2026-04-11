# Setup & Deployment Guide - MERN-NLP-Emotract

## Prerequisites

| Dependency   | Version   | Purpose                          |
|-------------|-----------|----------------------------------|
| Node.js     | 18+       | Backend and frontend runtime     |
| Python      | 3.12+     | NLP service runtime              |
| MongoDB     | 6.0+      | Primary database                 |
| Redis       | 7.0+      | Token storage and sessions       |
| Docker      | 24+       | Containerized deployment         |
| npm         | 9+        | Node package manager             |
| pip         | 23+       | Python package manager           |

### ML Model Files (Required)

The trained ML model files are NOT included in the repository. You must obtain or train them and place them in the following locations:

```
fastapi/models/
├── bert/
│   ├── model/          # BertForSequenceClassification checkpoint
│   └── tokenizer/      # BertTokenizer files
├── roberta/
│   ├── model/          # RoBERTaForSequenceClassification checkpoint
│   └── tokenizer/      # RoBERTaTokenizer files
├── lr/
│   ├── lr_model.pkl    # Trained Logistic Regression model
│   └── vectorizer.pkl  # Fitted TF-IDF vectorizer
└── rf/
    ├── rf_model.pkl    # Trained Random Forest model
    └── vectorizer.pkl  # Fitted TF-IDF vectorizer
```

---

## Option 1: Docker Deployment (Recommended)

### Step 1: Clone the Repository

```bash
git clone https://github.com/s4nkar/MERN-NLP-Emotract
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
PORT=5000
MONGO_URL=mongodb://host.docker.internal:27017/chat
FRONTEND_URL="http://localhost:5173"
ADMIN_URL="http://localhost:5174"
FASTAPI_URL="http://fastapi:8000"

JWT_SECRET=your-secure-jwt-secret-key
ENCRYPTION_KEY=X7kP9mWqT2rY5vL8nJ3zB6cF4dH0eA1

REDIS_PASSWORD=your-redis-password
REDIS_HOST=localhost
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

### Step 3: Ensure MongoDB and Redis Are Running

MongoDB and Redis must be running on your host machine (they are not included in docker-compose):

```bash
# macOS (Homebrew)
brew services start mongodb-community
brew services start redis

# Linux (systemd)
sudo systemctl start mongod
sudo systemctl start redis-server
```

### Step 4: Place ML Model Files

Copy your trained model files into `fastapi/models/` (see ML Model Files section above).

### Step 5: Build and Run

```bash
docker-compose up --build
```

### Step 6: Access the Application

| Service    | URL                          |
|------------|------------------------------|
| User App   | http://localhost:5173        |
| Admin App  | http://localhost:5174        |
| Backend    | http://localhost:5000        |
| NLP API    | http://localhost:8000        |
| API Docs   | http://localhost:5000/api-docs |

### Docker Commands

```bash
# Start all services
docker-compose up

# Start in detached mode
docker-compose up -d

# Rebuild and start
docker-compose up --build

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
```

---

## Option 2: Manual Development Setup

### Step 1: Clone and Configure

```bash
git clone https://github.com/s4nkar/MERN-NLP-Emotract
cd MERN-NLP-Emotract
```

Create `.env` files as described in Docker Step 2, but use local URLs:

**server/.env:**
```env
FASTAPI_URL="http://127.0.0.1:8000"
MONGO_URL=mongodb://localhost:27017/chat
```

### Step 2: Start External Services

Ensure MongoDB and Redis are running locally (see Docker Step 3).

### Step 3: Setup FastAPI NLP Service

```bash
cd fastapi

# Create virtual environment
python -m venv venv

# Activate virtual environment
# macOS/Linux:
source venv/bin/activate
# Windows:
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload --port 8000
```

### Step 4: Setup Express Backend

```bash
cd server

# Install dependencies
npm install

# Start the server
npm start
```

The server runs on port 5000. On first startup, it automatically creates a default admin user using the `ADMIN_*` env variables.

### Step 5: Setup User Frontend

```bash
cd user

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The user app runs on http://localhost:5173.

### Step 6: Setup Admin Frontend

```bash
cd admin

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The admin app runs on http://localhost:5174.

---

## Environment Variables Reference

### Server (`server/.env`)

| Variable          | Required | Default                   | Description                          |
|-------------------|----------|---------------------------|--------------------------------------|
| `PORT`            | No       | 5000                      | Express server port                  |
| `MONGO_URL`       | Yes      | -                         | MongoDB connection string            |
| `FRONTEND_URL`    | No       | http://localhost:5173     | User app URL (CORS)                  |
| `ADMIN_URL`       | No       | http://localhost:5174     | Admin app URL (CORS)                 |
| `FASTAPI_URL`     | No       | http://127.0.0.1:8000    | NLP service URL                      |
| `JWT_SECRET`      | Yes      | -                         | Secret key for signing JWT tokens    |
| `ENCRYPTION_KEY`  | Yes      | -                         | 32-byte AES-256 encryption key       |
| `REDIS_HOST`      | Yes      | -                         | Redis server hostname                |
| `REDIS_PORT`      | Yes      | -                         | Redis server port                    |
| `REDIS_PASSWORD`  | Yes      | -                         | Redis authentication password        |
| `ADMIN_USERNAME`  | Yes      | -                         | Default admin account username       |
| `ADMIN_PASSWORD`  | Yes      | -                         | Default admin account password       |
| `ADMIN_EMAIL`     | Yes      | -                         | Default admin account email          |
| `ADMIN_PHONE`     | Yes      | -                         | Default admin account phone          |
| `EMAIL_USER`      | Yes      | -                         | SMTP sender email address            |
| `EMAIL_PASS`      | Yes      | -                         | SMTP email password / app password   |
| `EMAIL_HOST`      | Yes      | -                         | SMTP server hostname                 |
| `EMAIL_PORT`      | Yes      | -                         | SMTP server port                     |
| `EMAIL_SECURE`    | No       | false                     | Use TLS for SMTP                     |

### Admin Frontend (`admin/.env`)

| Variable            | Required | Default                | Description                |
|---------------------|----------|------------------------|----------------------------|
| `VITE_BACKEND_URL`  | Yes      | http://localhost:5000  | Backend API base URL       |
| `VITE_LOCALHOST_KEY` | No      | CHAT-APP-ADMIN         | localStorage key for user  |

### User Frontend (`user/.env`)

| Variable              | Required | Default                   | Description                |
|-----------------------|----------|---------------------------|----------------------------|
| `VITE_BACKEND_URL`    | Yes      | http://localhost:5000     | Backend API base URL       |
| `VITE_LOCALHOST_KEY`  | No       | chat-app-current-user     | localStorage key for user  |
| `VITE_GRAVATAR_API_KEY` | No    | -                         | Gravatar API key (optional)|

---

## Default Admin Account

On first server startup, a default admin account is created using the `ADMIN_*` environment variables. Use these credentials to log in to the admin dashboard at http://localhost:5174/login.

---

## Email Configuration

The application uses **Nodemailer** to send emails for:
- Password reset links
- User warning notifications
- Parent notification when a child's account is blocked

For Gmail, you need to generate an **App Password**:
1. Go to https://myaccount.google.com/apppasswords
2. Generate a new app password for "Mail"
3. Use this as `EMAIL_PASS` in your `.env`

---

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
mongosh --eval "db.runCommand({ ping: 1 })"

# If using Docker, ensure host.docker.internal resolves
# On Linux, you may need to add: --add-host=host.docker.internal:host-gateway
```

### Redis Connection Issues
```bash
# Check if Redis is running
redis-cli ping
# Expected response: PONG

# Check Redis with password
redis-cli -a your-password ping
```

### FastAPI Model Loading Issues
```bash
# Verify model files exist
ls -la fastapi/models/bert/model/
ls -la fastapi/models/roberta/model/
ls -la fastapi/models/lr/
ls -la fastapi/models/rf/

# Check for CUDA availability (GPU)
python -c "import torch; print(torch.cuda.is_available())"
```

### Port Conflicts
```bash
# Check what's using a port
lsof -i :5000
lsof -i :5173
lsof -i :5174
lsof -i :8000

# Kill a process on a specific port
kill -9 $(lsof -t -i:5000)
```

### Frontend Build Issues
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite
```

---

## Production Deployment Notes

For production deployment, consider the following:

1. **HTTPS:** Configure SSL/TLS certificates and reverse proxy (Nginx/Caddy)
2. **Environment:** Set `NODE_ENV=production` for the backend
3. **Build frontends:** Run `npm run build` for both `user/` and `admin/` and serve static files
4. **MongoDB:** Use a replica set or managed service (MongoDB Atlas)
5. **Redis:** Use a managed Redis instance (AWS ElastiCache, Redis Cloud)
6. **JWT Secret:** Use a strong, randomly generated secret (32+ characters)
7. **Encryption Key:** Use a cryptographically random 32-byte key
8. **Rate Limiting:** Add rate limiting middleware to Express
9. **Logging:** Configure structured logging (Winston) for production
10. **Monitoring:** Add health check endpoints and monitoring (PM2, Docker health checks)
11. **GPU:** For optimal NLP inference speed, deploy FastAPI on a GPU-enabled instance
