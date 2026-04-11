# MongoDB Atlas Setup Guide - MERN-NLP-Emotract

This guide walks you through setting up MongoDB Atlas (cloud-hosted MongoDB) for the MERN-NLP-Emotract project.

---

## Step 1: Create a MongoDB Atlas Account

1. Go to [https://www.mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Click **"Try Free"** and create an account (or sign in with Google/GitHub)
3. Complete the onboarding form

---

## Step 2: Create a Cluster

1. After signing in, click **"Build a Database"**
2. Choose a plan:
   - **M0 Free** — good for development/testing (512 MB storage)
   - **M10+** — recommended for production
3. Choose a **cloud provider** (AWS, GCP, or Azure) and **region** closest to your users
4. Give your cluster a name (e.g., `emotract-cluster`)
5. Click **"Create Deployment"**

The cluster takes 1-3 minutes to provision.

---

## Step 3: Set Up Database Access (User)

1. In the left sidebar, go to **Security > Database Access**
2. Click **"Add New Database User"**
3. Authentication Method: **Password**
4. Enter a username and password:
   - Example username: `emotract_admin`
   - Example password: Use a strong, generated password
   - **Save this password** — you'll need it for the connection string
5. Database User Privileges: Select **"Read and write to any database"**
6. Click **"Add User"**

---

## Step 4: Set Up Network Access (IP Whitelist)

1. In the left sidebar, go to **Security > Network Access**
2. Click **"Add IP Address"**
3. Options:
   - **For development:** Click **"Allow Access from Anywhere"** (adds `0.0.0.0/0`)
   - **For production:** Add only your server's IP address
4. Click **"Confirm"**

> **Security Note:** For production, never use `0.0.0.0/0`. Always restrict to your server's IP.

---

## Step 5: Get Your Connection String

1. Go to **Deployment > Database** and click **"Connect"** on your cluster
2. Select **"Drivers"**
3. Choose Driver: **Node.js**, Version: **6.0 or later**
4. Copy the connection string. It looks like:

```
mongodb+srv://emotract_admin:<password>@emotract-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=emotract-cluster
```

5. Replace `<password>` with the database user password from Step 3
6. Add the database name `chat` before the `?`:

```
mongodb+srv://emotract_admin:YOUR_PASSWORD@emotract-cluster.xxxxx.mongodb.net/chat?retryWrites=true&w=majority&appName=emotract-cluster
```

---

## Step 6: Update Your .env File

Open `server/.env` and update the `MONGO_URL`:

```env
# Before (local MongoDB)
MONGO_URL=mongodb://localhost:27017/chat

# After (MongoDB Atlas)
MONGO_URL=mongodb+srv://emotract_admin:YOUR_PASSWORD@emotract-cluster.xxxxx.mongodb.net/chat?retryWrites=true&w=majority&appName=emotract-cluster
```

Replace:
- `emotract_admin` with your database username
- `YOUR_PASSWORD` with your database password
- `emotract-cluster.xxxxx.mongodb.net` with your actual cluster address

---

## Step 7: Run the Migration

Now run the migration script to set up all collections, indexes, and the default admin user:

```bash
cd server

# Basic migration (collections + indexes + admin user)
npm run migrate

# Migration with sample test users
npm run migrate:seed
```

You should see output like:

```
========================================
  MERN-NLP-Emotract Database Migration
========================================

  MongoDB URL: mongodb+srv://...
  Seed data:   No
  Drop first:  No

[OK] Connected to MongoDB

Creating collections...

  Created users
  Created chats
  Created messages
  Created messagemetadatas
  Created passwordresets

Creating indexes...

  + users.idx_users_username
  + users.idx_users_email
  + users.idx_users_phone
  ...

Seeding default admin...

  Created Default admin: admin

========================================
  Migration Complete!
========================================

  users                    1 docs  |  9 indexes
  chats                    0 docs  |  4 indexes
  messages                 0 docs  |  7 indexes
  messagemetadatas         0 docs  |  7 indexes
  passwordresets           0 docs  |  4 indexes
```

---

## Step 8: Verify in Atlas Dashboard

1. Go to **Deployment > Database** and click **"Browse Collections"**
2. You should see the `chat` database with 5 collections:
   - `users` (with the admin user)
   - `chats`
   - `messages`
   - `messagemetadatas`
   - `passwordresets`
3. Click on `users` to verify the admin account was created

---

## Step 9: Update Docker Compose (if using Docker)

If deploying with Docker, update `docker-compose.yml` to use the Atlas URL:

```yaml
backend:
  environment:
    - MONGO_URL=mongodb+srv://emotract_admin:YOUR_PASSWORD@emotract-cluster.xxxxx.mongodb.net/chat?retryWrites=true&w=majority&appName=emotract-cluster
```

Or better, use an `.env` file and reference it:

```yaml
backend:
  env_file:
    - ./server/.env
```

---

## Migration Commands Reference

Run these from the `server/` directory:

| Command | Description |
|---------|-------------|
| `npm run migrate` | Create collections, indexes, and admin user |
| `npm run migrate:seed` | Above + seed 3 sample test users |
| `npm run migrate:drop` | **Drop all collections** and re-create (DESTRUCTIVE) |
| `npm run migrate:fresh` | Drop + re-create + seed sample data (DESTRUCTIVE) |

---

## What the Migration Creates

### Collections

| Collection | Purpose |
|-----------|---------|
| `users` | User accounts and profiles |
| `chats` | Conversations between users |
| `messages` | Chat messages (encrypted at rest) |
| `messagemetadatas` | NLP emotion analysis results |
| `passwordresets` | Temporary password reset tokens (auto-expire) |

### Indexes

| Collection | Index | Purpose |
|-----------|-------|---------|
| users | `username` (unique) | Fast login lookup |
| users | `email` (unique) | Unique email constraint |
| users | `phone` (unique) | Unique phone constraint |
| users | `aadhaar_number` (unique, sparse) | Unique ID, allows nulls |
| users | `role` | Filter by USER/ADMIN |
| users | `is_active` | Filter active users |
| users | `is_flagged` | Find moderated users |
| users | `created_at` (desc) | Sort by newest |
| chats | `participants` | Find chats for a user |
| chats | `is_active` | Filter active chats |
| chats | `updatedAt` (desc) | Sort by recent activity |
| messages | `chat_id` | All messages in a chat |
| messages | `sender_id` | All messages by a user |
| messages | `chat_id + sent_at` (compound) | Paginated chat history |
| messages | `processing_status` | Find unprocessed messages (cron job) |
| messages | `is_flagged` | Find flagged messages |
| messagemetadatas | `message_id` (unique) | 1:1 link to message |
| messagemetadatas | `is_flagged` | Find flagged metadata |
| messagemetadatas | `sentiment_score` | Sort/filter by sentiment |
| messagemetadatas | `bert.emotion` | Query by BERT emotion |
| messagemetadatas | `roberta.emotion` | Query by RoBERTa emotion |
| passwordresets | `userId` | Find reset for user |
| passwordresets | `token` (unique) | Lookup by token |
| passwordresets | `expiresAt` (TTL) | Auto-delete expired tokens |

### Validators

Each collection has a JSON Schema validator that enforces:
- Required fields
- Field types (string, number, boolean, objectId)
- Enum values (gender, role, processing_status, etc.)

Validation level is set to `moderate` — validates inserts and updates, but allows existing documents that don't match.

---

## Atlas Features to Enable (Recommended)

### 1. Enable Backup (Production)

1. Go to your cluster > **Backup** tab
2. Enable **Continuous Backup** or **Cloud Backup**
3. Set a retention policy (e.g., 7 days)

### 2. Set Up Alerts

1. Go to **Project Settings > Alerts**
2. Add alerts for:
   - Connections exceed threshold
   - Disk usage exceeds 80%
   - Replication lag

### 3. Enable Performance Advisor

1. Go to your cluster > **Performance Advisor** tab
2. It suggests indexes based on your query patterns
3. Review after the app has been running for a few days

### 4. Enable Access Logging (M10+)

1. Go to **Security > Database Access > Advanced**
2. Enable audit logging for compliance

---

## Troubleshooting

### "MongoServerError: bad auth"
- Double-check username and password in the connection string
- Make sure the password doesn't contain special characters that need URL encoding (use `encodeURIComponent()`)
- Verify the user exists in **Database Access**

### "MongoNetworkError: connection timed out"
- Check **Network Access** — your IP must be whitelisted
- If behind a VPN, whitelist the VPN's IP
- Try `0.0.0.0/0` temporarily to confirm it's an IP issue

### "MongooseServerSelectionError: Could not connect"
- Ensure the cluster is active (not paused — M0 clusters pause after 60 days of inactivity)
- Check your internet connection
- Verify the cluster address in the connection string

### Special Characters in Password
If your password contains `@`, `:`, `/`, `?`, `#`, or other special characters, URL-encode them:

```javascript
// In Node.js
const password = encodeURIComponent("p@ss:word#123");
// Result: p%40ss%3Aword%23123
```

Then use the encoded password in your connection string.

### Migration Fails with Validator Error
If you see validator errors on existing data, the migration uses `validationLevel: "moderate"` which only validates new writes. Existing documents that don't match the schema are left as-is.

---

## Cost Estimates (Atlas Pricing)

| Tier | Storage | RAM | Price |
|------|---------|-----|-------|
| **M0 (Free)** | 512 MB | Shared | Free forever |
| **M2** | 2 GB | Shared | ~$9/month |
| **M5** | 5 GB | Shared | ~$25/month |
| **M10** | 10 GB | 2 GB | ~$57/month |
| **M20** | 20 GB | 4 GB | ~$140/month |

For this project:
- **Development/Testing:** M0 Free is sufficient
- **Small Production (<1000 users):** M2 or M5
- **Medium Production:** M10+ with backups enabled
