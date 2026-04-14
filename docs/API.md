# API Reference - Emotract

Base URL: `http://localhost:5001/api/v1`

Swagger Docs: `http://localhost:5001/api-docs`

---

## Authentication

All protected endpoints require an **Auth0 access token** in the `Authorization` header:
```
Authorization: Bearer <auth0_access_token>
```

Tokens are obtained via the Auth0 SDK (`getAccessTokenSilently()`). The backend validates them using Auth0's JWKS endpoint (RS256).

Admin endpoints additionally require the user to have `role: "ADMIN"` in the local database.

---

## Auth Routes (`/auth`)

### PATCH `/auth/complete-profile` (Protected)

Complete the user's profile after Auth0 signup. Required on first login.

**Request Body:**
```json
{
  "firstname": "string",
  "lastname": "string",
  "phone": "string (10 digits)",
  "aadhaar_number": "string (format: XXXX XXXX XXXX)",
  "parent_email": "string (email)",
  "age": "number",
  "gender": "M" | "F" | "O"
}
```

**Success Response (200):**
```json
{
  "status": true,
  "user": { ... }
}
```

---

### GET `/auth/me` (Protected)

Get the authenticated user's full profile from MongoDB.

**Success Response (200):**
```json
{
  "status": true,
  "user": {
    "_id": "ObjectId",
    "auth0_id": "auth0|...",
    "username": "string",
    "email": "string",
    "firstname": "string",
    "lastname": "string",
    "role": "USER" | "ADMIN",
    "is_profile_complete": true,
    "isAvatarImageSet": false,
    "avatarImage": "",
    "is_online": false,
    "is_flagged": false
  }
}
```

---

### POST `/auth/logout` (Protected)

Log out the current user. Updates online status in MongoDB.

**Success Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

### POST `/auth/auth0-webhook` (Public, secret-protected)

Webhook for Auth0 to notify the backend when a user registers. For production use with a publicly accessible backend.

**Headers:**
```
x-auth0-webhook-secret: <AUTH0_WEBHOOK_SECRET>
```

**Request Body:**
```json
{
  "auth0_id": "auth0|...",
  "email": "string",
  "username": "string",
  "firstname": "string",
  "lastname": "string"
}
```

---

## User Routes (`/auth`) - Protected

### GET `/auth/all-users/:id`

Get all active users with completed profiles (excluding the current user). Used for contact search.

**URL Params:** `id` - Current user's ObjectId

**Success Response (200):**
```json
[
  {
    "_id": "ObjectId",
    "username": "string",
    "email": "string",
    "avatarImage": "string"
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
    "last_active": "ISO date",
    "lastMessage": {
      "text": "string",
      "sender": "You" | "Them",
      "sentAt": "ISO date"
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

**Success Response (200):**
```json
{
  "is_online": true | false
}
```

---

### GET `/auth/block-status/:id`

Check if a user account is blocked/flagged.

**Success Response (200):**
```json
{
  "is_blocked": true | false
}
```

---

## Admin Routes (`/auth`) - Protected + Admin Only

All routes below require `role: "ADMIN"`.

### GET `/auth/dashboard-stats/`

Get dashboard statistics.

**Success Response (200):**
```json
{
  "totalUsers": "number",
  "onlineUsers": "number",
  "flaggedUsers": "number",
  "totalMessages": "number",
  "flaggedMessages": "number",
  "totalChats": "number",
  "messageTrend": [{ "_id": "YYYY-MM-DD", "total": "number", "flagged": "number" }],
  "registrationTrend": [{ "_id": "YYYY-MM-DD", "count": "number" }]
}
```

---

### GET `/auth/complete-users/`

Get all users with detailed information.

---

### GET `/auth/get-user-details/:id`

Get detailed profile for a specific user.

---

### GET `/auth/get-user-analytics/:id`

Get analytics for a specific user including message stats and trends.

---

### GET `/auth/user-gender-details/`

Get user registration statistics grouped by gender and date.

---

### PATCH `/auth/block-user/:id`

Block/flag a user account.

---

### PATCH `/auth/unblock-user/:id`

Unblock/unflag a user account.

---

### DELETE `/auth/delete-user/:id`

Soft delete a user (sets `is_active: false`).

---

### POST `/auth/restrict-user`

Send warning or block notification email to user or parent/guardian.

**Request Body:**
```json
{
  "type": "INFORM_PARENT_AND_BLOCK" | "WARN_CHILD",
  "id": "ObjectId",
  "email": "string",
  "parent_email": "string",
  "child_name": "string"
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
  "message": "string (plaintext - encrypted server-side)",
  "is_group": false
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
    "is_flagged": false
  }
]
```

---

## WebSocket Events

Connection URL: `http://localhost:5001`

Authentication: Auth0 access token passed via `socket.handshake.auth.token`

### Client -> Server

| Event       | Payload                    | Description              |
|-------------|----------------------------|--------------------------|
| `send-msg`  | `{ to: string, msg: string }` | Send message (sender auto-verified from token) |
| `logout`    | —                          | User logout (userId from socket) |

### Server -> Client

| Event                | Payload                                      | Description                     |
|----------------------|----------------------------------------------|---------------------------------|
| `online-users`       | `string[]` (array of userIds)                | Initial online users list (on connect) |
| `user-status-change` | `{ userId: string, isOnline: boolean, lastSeen?: string }` | Real-time status broadcast |
| `msg-recieve`        | `{ from: string, msg: string }`              | Incoming message delivery       |

---

## Error Responses

| Status | Description                  | Body                                              |
|--------|------------------------------|---------------------------------------------------|
| 401    | Unauthorized (invalid token) | HTML error page from express-oauth2-jwt-bearer     |
| 403    | Forbidden (deactivated/not admin) | `{ "message": "..." }`                       |
| 404    | User not found               | `{ "message": "User not found in local database" }` |
| 500    | Internal server error        | `{ "message": "Internal server error" }`          |
