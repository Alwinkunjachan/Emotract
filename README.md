# Emotract

A full-stack real-time chat application built with the MERN stack, featuring Auth0 authentication (with SSO), encrypted messaging, real-time online/offline status tracking, an admin dashboard with analytics, and email-based content moderation.

## Tech Stack

**Frontend:** React, TypeScript, Tailwind CSS, Socket.IO Client, ShadCN UI, Recharts, Auth0

**Backend:** Node.js, Express.js, MongoDB, Socket.IO, Auth0, Nodemailer

**Infrastructure:** Docker, Docker Compose

## Getting Started

```bash
git clone https://github.com/Alwinkunjachan/Emotract.git
cd Emotract
docker-compose up --build
```

Refer to the [Setup Guide](docs/SETUP.md) for detailed configuration, Auth0 setup, and environment variables.

## Documentation

| Document | Description |
|----------|-------------|
| [Setup Guide](docs/SETUP.md) | Installation, Auth0 config, environment variables, Docker commands |
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, Socket.io events, data models |
| [API Reference](docs/API.md) | REST endpoints, WebSocket events, request/response formats |
| [Full Documentation](docs/DOCUMENTATION.md) | Comprehensive project documentation |
| [MongoDB Atlas Setup](docs/MONGODB_ATLAS_SETUP.md) | Cloud MongoDB configuration guide |
