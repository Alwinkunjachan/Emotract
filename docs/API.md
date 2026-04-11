# API Reference - MERN-NLP-Emotract

Base URL: `http://localhost:5000/api/v1`

Swagger Docs: `http://localhost:5000/api-docs`

---

## Authentication

All protected endpoints require the `Authorization` header:
```
Authorization: Bearer <access_token>
```

Admin endpoints additionally require the user to have `role: "ADMIN"`.

---

## Auth Routes (`/auth`)

### POST `/auth/login`

Authenticate a user and receive JWT tokens.

**Request Body:**
```json
{
  "username": "string",
  "password": "string",
  "role": "USER" | "ADMIN"
}
```

**Success Response (200):**
```json
{
  "status": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "_id": "ObjectId",
    "username": "string",
    "email": "string",
    "firstname": "string",
    "lastname": "string",
    "isAvatarImageSet": false,
    "avatarImage": "",
    "role": "USER"
  }
}
```

**Error Response (400/401):**
```json
{
  "msg": "Incorrect Username or Password",
  "status": false
}
```

---

### POST `/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "username": "string (3-20 chars)",
  "email": "string",
  "password": "string (min 8 chars)",
  "firstname": "string",
  "lastname": "string",
  "age": "number",
  "gender": "M" | "F" | "O",
  "phone": "string (10 digits)",
  "parent_email": "string",
  "aadhaar_number": "string (format: XXXX XXXX XXXX)"
}
```

**Success Response (200):**
```json
{
  "status": true,
  "user": { ... }
}
```

**Error Response (400):**
```json
{
  "msg": "Username already used",
  "status": false
}
```

---

### POST `/auth/logout`

Log out the current user. Removes refresh token from Redis.

**Request Body:**
```json
{
  "userId": "ObjectId"
}
```

**Success Response (200):**
```json
{
  "status": true,
  "msg": "User logged out"
}
```

---

### POST `/auth/refresh-token`

Refresh an expired access token.

**Request Body:**
```json
{
  "refreshToken": "string"
}
```

**Success Response (200):**
```json
{
  "accessToken": "new_access_token"
}
```

**Error Response (403):**
```json
{
  "msg": "Invalid refresh token"
}
```

---

### POST `/auth/forgot-password`

Request a password reset email.

**Request Body:**
```json
{
  "email": "string"
}
```

**Success Response (200):**
```json
{
  "status": true,
  "msg": "Password reset link sent to your email"
}
```

---

### POST `/auth/reset-password/:token`

Reset password using the token from the email link.

**URL Params:** `token` - Password reset token

**Request Body:**
```json
{
  "password": "string (min 8 chars)"
}
```

**Success Response (200):**
```json
{
  "status": true,
  "msg": "Password reset successful"
}
```

---

## User Routes (`/auth`) - Protected

All routes below require `Authorization: Bearer <token>`.

### GET `/auth/all-users/:id`

Get all active users except the authenticated user. Used for user discovery/search.

**URL Params:** `id` - Current user's ObjectId

**Success Response (200):**
```json
[
  {
    "_id": "ObjectId",
    "username": "string",
    "email": "string",
    "avatarImage": "string",
    "isAvatarImageSet": true
  }
]
```

---

### GET `/auth/all-contact-users/:id`

Get users the current user has active chats with, including last message.

**URL Params:** `id` - Current user's ObjectId

**Success Response (200):**
```json
[
  {
    "_id": "ObjectId",
    "username": "string",
    "avatarImage": "string",
    "lastMessage": {
      "text": "string",
      "sender_id": "ObjectId",
      "sent_at": "ISO date"
    }
  }
]
```

---

### POST `/auth/setavatar/:id`

Set or update the user's avatar image.

**URL Params:** `id` - User's ObjectId

**Request Body:**
```json
{
  "image": "string (URL)"
}
```

**Success Response (200):**
```json
{
  "isSet": true,
  "image": "string (URL)"
}
```

---

### GET `/auth/online-status/:id`

Check if a specific user is currently online.

**URL Params:** `id` - Target user's ObjectId

**Success Response (200):**
```json
{
  "status": true,
  "isOnline": true | false
}
```

---

### GET `/auth/block-status/:id`

Check if a user account is blocked/flagged.

**URL Params:** `id` - Target user's ObjectId

**Success Response (200):**
```json
{
  "status": true,
  "isBlocked": true | false
}
```

---

## Admin Routes (`/auth`) - Protected + Admin Only

All routes below require `Authorization: Bearer <token>` AND `role: "ADMIN"`.

### GET `/auth/complete-users/`

Get all users with detailed information for the admin dashboard.

**Success Response (200):**
```json
{
  "status": true,
  "users": [
    {
      "_id": "ObjectId",
      "username": "string",
      "email": "string",
      "firstname": "string",
      "lastname": "string",
      "age": "number",
      "gender": "string",
      "is_flagged": false,
      "flag_count": 0,
      "is_active": true,
      "created_at": "ISO date"
    }
  ]
}
```

---

### GET `/auth/get-user-details/:id`

Get detailed profile information for a specific user.

**URL Params:** `id` - Target user's ObjectId

**Success Response (200):**
```json
{
  "status": true,
  "user": { ... }
}
```

---

### GET `/auth/get-user-analytics/:id`

Get comprehensive analytics for a specific user including message stats, emotion distribution, and sentiment trends.

**URL Params:** `id` - Target user's ObjectId

**Success Response (200):**
```json
{
  "status": true,
  "data": {
    "user": { ... },
    "chatCount": "number",
    "messageStats": {
      "total": "number",
      "flagged": "number",
      "processing": "number"
    },
    "messageTrend": [
      { "date": "YYYY-MM-DD", "count": "number" }
    ],
    "emotionDistribution": {
      "bert": { "joy": 10, "sadness": 3, ... },
      "roberta": { ... },
      "logistic_regression": { ... },
      "random_forest": { ... }
    },
    "sentimentPercentage": {
      "positive": "number (%)",
      "negative": "number (%)",
      "neutral": "number (%)"
    }
  }
}
```

---

### GET `/auth/user-gender-details/`

Get user registration statistics grouped by gender and date.

**Success Response (200):**
```json
{
  "status": true,
  "data": [
    {
      "date": "YYYY-MM-DD",
      "male": "number",
      "female": "number",
      "other": "number"
    }
  ]
}
```

---

### PATCH `/auth/block-user/:id`

Block/flag a user account.

**URL Params:** `id` - Target user's ObjectId

**Success Response (200):**
```json
{
  "status": true,
  "msg": "User blocked successfully"
}
```

---

### PATCH `/auth/unblock-user/:id`

Unblock/unflag a user account.

**URL Params:** `id` - Target user's ObjectId

**Success Response (200):**
```json
{
  "status": true,
  "msg": "User unblocked successfully"
}
```

---

### DELETE `/auth/delete-user/:id`

Soft delete a user (sets `is_active: false`).

**URL Params:** `id` - Target user's ObjectId

**Success Response (200):**
```json
{
  "status": true,
  "msg": "User deleted successfully"
}
```

---

### POST `/auth/restrict-user`

Send a warning or block notification email to a user or their parent/guardian.

**Request Body:**
```json
{
  "userId": "ObjectId",
  "type": "warn" | "block",
  "email": "string (user or parent email)",
  "message": "string (optional custom message)"
}
```

**Success Response (200):**
```json
{
  "status": true,
  "msg": "Email sent successfully"
}
```

---

## Message Routes (`/messages`) - Protected

### POST `/messages/addmsg/`

Send a new message. Creates or updates the chat between participants.

**Request Body:**
```json
{
  "from": "ObjectId (sender)",
  "to": "ObjectId (recipient)",
  "message": "string (plaintext - encrypted server-side)"
}
```

**Success Response (200):**
```json
{
  "msg": "Message added successfully"
}
```

---

### POST `/messages/getmsg/`

Retrieve all messages between two users.

**Request Body:**
```json
{
  "from": "ObjectId (current user)",
  "to": "ObjectId (other user)"
}
```

**Success Response (200):**
```json
[
  {
    "fromSelf": true | false,
    "message": "string (decrypted)",
    "sent_at": "ISO date",
    "processing_status": "processing" | "processed",
    "is_flagged": false
  }
]
```

---

## NLP Service Routes

Base URL: `http://localhost:8000`

### GET `/`

Health check endpoint.

**Response:** `"Fast Api Server Running Dev mode..."`

---

### GET `/api/v1/test/`

Test endpoint.

**Response:**
```json
{
  "message": "Test route working"
}
```

---

### POST `/api/v1/analyze/`

Analyze text for emotions using all four ML models.

**Request Body:**
```json
{
  "text": "string"
}
```

**Success Response (200):**
```json
{
  "data": {
    "bert": {
      "emotion": "string",
      "probability": "float (0-1)",
      "sentiment": "positive" | "negative" | "neutral"
    },
    "roberta": {
      "emotion": "string",
      "probability": "float (0-1)",
      "sentiment": "positive" | "negative" | "neutral"
    },
    "rf": {
      "emotion": "string",
      "probability": "float (0-1)",
      "sentiment": "positive" | "negative" | "neutral"
    },
    "lr": {
      "emotion": "string",
      "probability": "float (0-1)",
      "sentiment": "positive" | "negative" | "neutral"
    }
  },
  "message": "Prediction of emotions and sentiments was successful"
}
```

**Error Response (500):**
```json
{
  "data": {},
  "message": "Error while processing the text: <error details>"
}
```

---

## Error Responses

All endpoints may return these common error responses:

| Status | Description                  | Body                                              |
|--------|------------------------------|---------------------------------------------------|
| 401    | Unauthorized (no/bad token)  | `{ "msg": "Access Denied. No token provided" }`   |
| 403    | Forbidden (not admin/expired)| `{ "msg": "Access Denied! Only admins..." }`      |
| 404    | Resource not found           | `{ "msg": "User not found", "status": false }`    |
| 500    | Internal server error        | `{ "msg": "Internal Server Error" }`              |

---

## WebSocket Events

Connection URL: `http://localhost:5000`

### Client -> Server

| Event       | Payload                          | Description              |
|-------------|----------------------------------|--------------------------|
| `add-user`  | `userId: string`                 | Register socket for user |
| `send-msg`  | `{ to: string, msg: string }`    | Send message to user     |
| `logout`    | `userId: string`                 | Disconnect user          |

### Server -> Client

| Event         | Payload            | Description               |
|---------------|--------------------|---------------------------|
| `msg-recieve` | `{ msg: string }`  | Incoming message delivery |
