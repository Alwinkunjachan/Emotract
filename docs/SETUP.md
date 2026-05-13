# Setup & Deployment Guide - Emotract

## Prerequisites

| Dependency   | Version   | Purpose                          |
|-------------|-----------|----------------------------------|
| Node.js     | 18+       | Backend and frontend runtime     |
| Docker      | 24+       | Containerized deployment         |
| npm         | 9+        | Node package manager             |
| Auth0       | -         | Identity provider (free tier)    |

For manual setup (without Docker), you also need:
- MongoDB 6.0+

---

## Auth0 Setup (Required)

### 1. Create Auth0 Tenant

1. Go to [auth0.com](https://auth0.com) and sign up
2. Create a tenant (e.g., `emotract-test`)

### 2. Create Auth0 API

1. Go to **Applications > APIs > Create API**
2. Name: `Emotract API`
3. Identifier: `https://api.emotract.com`
4. Signing Algorithm: **RS256**
5. Enable **"Allow Skipping User Consent"** in Settings

### 3. Create SPA Application

1. Go to **Applications > Applications > Create Application**
2. Name: `Emotract App`, Type: **Single Page Application**
3. Under **Settings**, configure:
   - Allowed Callback URLs: `http://localhost:5173/login, http://localhost:5174/login`
   - Allowed Logout URLs: `http://localhost:5173/login, http://localhost:5174/login`
   - Allowed Web Origins: `http://localhost:5173, http://localhost:5174`
4. Note the **Domain** and **Client ID**

### 4. Create Machine-to-Machine Application

1. **Applications > Applications > Create Application**
2. Name: `Emotract Backend`, Type: **Machine to Machine**
3. Authorize for **Auth0 Management API** with scopes:
   - `create:users`, `read:users`, `update:users`, `delete:users`
   - `read:roles`, `create:role_members`
4. Note the **Client ID** and **Client Secret**

### 5. Create Roles

1. Go to **User Management > Roles**
2. Create: `USER` and `ADMIN`

### 6. Create Post-Login Action

1. Go to **Actions > Triggers > Post Login**
2. Create action `Add Roles to Token`:
```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://emotract.com';
  const roles = event.authorization?.roles || [];
  api.accessToken.setCustomClaim(`${namespace}/roles`, roles);
};
```
3. Deploy and add to the Login flow

### 7. Enable Username Login

1. Go to **Authentication > Database > Username-Password-Authentication**
2. Enable **"Requires Username"**

### 8. Enable Google SSO (Optional)

1. Create OAuth credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Application type: **Web application**
   - Authorized JavaScript origins: `https://your-tenant.us.auth0.com`
   - Authorized redirect URIs: `https://your-tenant.us.auth0.com/login/callback`
2. In Auth0: **Authentication > Social > Google** — enter Client ID and Secret
3. Enable for your SPA app

---

## Option 1: Docker Deployment (Recommended)

### Step 1: Clone the Repository

```bash
git clone https://github.com/Alwinkunjachan/Emotract.git
cd Emotract
```

### Step 2: Configure Environment Variables

```bash
cp server/.env.example server/.env
cp admin/.env.example admin/.env
cp user/.env.example user/.env
```

Edit `server/.env`:
```env
PORT=5001
MONGO_URL=mongodb://mongo:27017/chat
FRONTEND_URL="http://localhost:5173"
ADMIN_URL="http://localhost:5174"
ENCRYPTION_KEY=X7kP9mWqT2rY5vL8nJ3zB6cF4dH0eA1

# Auth0
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://api.emotract.com
AUTH0_M2M_CLIENT_ID=<M2M Client ID>
AUTH0_M2M_CLIENT_SECRET=<M2M Client Secret>

# Admin seed
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@123
ADMIN_EMAIL=admin@example.com
ADMIN_PHONE=9999999999

# Email (optional)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
```

Edit `user/.env` and `admin/.env`:
```env
VITE_BACKEND_URL="http://localhost:5001"
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=<SPA Client ID>
VITE_AUTH0_AUDIENCE=https://api.emotract.com
```

### Step 3: Build and Run

```bash
docker-compose up --build -d
```

### Step 4: Run Migration

```bash
docker-compose exec backend npm run migrate
docker-compose exec backend npm run seed:user   # optional: create default test user
```

`migrate` creates collections, indexes, and validators. The default admin is auto-created in MongoDB on server startup (Mongo-only — link it to Auth0 with `npm run migrate:auth0`). `seed:user` is optional and creates a default test user in both Auth0 and MongoDB so you can log in immediately.

### Step 5: Access the Application

| Service    | URL                          |
|------------|------------------------------|
| User App   | http://localhost:5173        |
| Admin App  | http://localhost:5174        |
| Backend    | http://localhost:5001        |
| API Docs   | http://localhost:5001/api-docs |

### Docker Commands

```bash
docker-compose up --build -d       # Build and start in background
docker-compose logs -f             # View all logs
docker-compose logs -f backend     # View backend logs only
docker-compose restart backend     # Restart a service
docker-compose down                # Stop all
docker-compose down -v             # Stop and remove all data
```

---

## Option 2: Manual Development Setup

### Step 1: Clone and Configure

```bash
git clone https://github.com/Alwinkunjachan/Emotract.git
cd Emotract
```

Create `.env` files as above. The same `MONGO_URL` works in both Docker and host modes — [server/config/runtime.js](../server/config/runtime.js) detects `/.dockerenv` at runtime and rewrites the `mongo` service hostname to `localhost` on host runs.

### Step 2: Start MongoDB

Ensure MongoDB is running locally.

### Step 3: Setup Express Backend

```bash
cd server
npm install
npm run migrate
npm run seed:user   # optional: default test user in Auth0 + Mongo
npm start
```

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
| `npm run migrate` | Create collections, indexes, and validators |
| `npm run migrate:drop` | Drop all collections and re-create (DESTRUCTIVE) |
| `npm run migrate:auth0` | Link existing MongoDB users to Auth0 (creates Auth0 accounts) |
| `npm run seed:user` | Create default test user `alwinpkunjachan@gmail.com` in Auth0 + MongoDB (idempotent) |
| `npm run reset:chats` | Wipe `chats` + `messages` collections (users untouched). Pass `-- -y` to skip the prompt |

Default admin is auto-created in MongoDB on every server start ([server/config/admin.js](../server/config/admin.js)) — local-only, link to Auth0 with `migrate:auth0`.

---

## Environment Variables Reference

### Server (`server/.env`)

| Variable                | Required | Default  | Description                          |
|-------------------------|----------|----------|--------------------------------------|
| `PORT`                  | No       | 5001     | Express server port                  |
| `MONGO_URL`             | Yes      | -        | MongoDB connection string            |
| `FRONTEND_URL`          | No       | http://localhost:5173 | User app URL (CORS)         |
| `ADMIN_URL`             | No       | http://localhost:5174 | Admin app URL (CORS)        |
| `AUTH0_DOMAIN`          | Yes      | -        | Auth0 tenant domain                  |
| `AUTH0_AUDIENCE`        | Yes      | -        | Auth0 API identifier                 |
| `AUTH0_M2M_CLIENT_ID`   | Yes      | -        | Auth0 M2M application Client ID     |
| `AUTH0_M2M_CLIENT_SECRET`| Yes     | -        | Auth0 M2M application Client Secret |
| `AUTH0_WEBHOOK_SECRET`  | No       | -        | Secret for Auth0 webhook (production)|
| `ENCRYPTION_KEY`        | Yes      | -        | 32-byte AES-256 encryption key       |
| `ADMIN_USERNAME`        | Yes      | -        | Default admin account username       |
| `ADMIN_PASSWORD`        | Yes      | -        | Default admin account password (must meet Auth0 policy: uppercase, lowercase, number, special char) |
| `ADMIN_EMAIL`           | Yes      | -        | Default admin account email          |
| `ADMIN_PHONE`           | Yes      | -        | Default admin account phone          |
| `DEFAULT_USER_PASSWORD` | No       | `Default@123` | Password used by `npm run seed:user` |
| `EMAIL_USER`            | No       | -        | SMTP sender email address            |
| `EMAIL_PASS`            | No       | -        | SMTP email app password              |
| `EMAIL_HOST`            | No       | -        | SMTP server hostname                 |
| `EMAIL_PORT`            | No       | -        | SMTP server port                     |

### Frontend (`admin/.env` and `user/.env`)

| Variable              | Required | Description                |
|-----------------------|----------|----------------------------|
| `VITE_BACKEND_URL`    | Yes      | Backend API base URL       |
| `VITE_AUTH0_DOMAIN`   | Yes      | Auth0 tenant domain        |
| `VITE_AUTH0_CLIENT_ID`| Yes      | Auth0 SPA Client ID        |
| `VITE_AUTH0_AUDIENCE` | Yes      | Auth0 API identifier       |

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

### Auth0 "Unknown host" Error
Make sure the domain includes the region: `your-tenant.us.auth0.com` (not `your-tenant.auth0.com`)

### Auth0 Password Policy Error
Auth0 requires passwords with: lowercase, uppercase, number, and special character (e.g., `Admin@123`)

### Infinite Redirect Loop
Clear browser site data (DevTools > Application > Storage > Clear site data) and try again
