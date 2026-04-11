# MERN-NLP-Emotract
### Real-Time Chat Application with Admin Dashboard, Encrypted Messaging, and Scalable Architecture

**MERN-NLP-Emotract** is a full-stack real-time chat application built with the MERN stack, featuring encrypted messaging, real-time online/offline status tracking, an admin dashboard with analytics, and email-based content moderation.

---

## Features

- Real-time chat with **WebSockets (Socket.IO)**
- **AES-256-CBC** message encryption at rest
- Real-time **online/offline status** with green dot indicators
- **Last seen timestamps** for offline users
- **Unread message badges** with count
- Admin dashboard with **real-time analytics** (user stats, message trends, registration trends)
- User management: **warn, block, unblock, delete** users
- Email notifications to users and parents via **Nodemailer**
- Secure authentication with **JWT** (access + refresh tokens)
- Caching and session handling using **Redis**
- Fully containerized with **Docker** (includes MongoDB + Redis)
- Responsive frontend built with **React** and **Tailwind CSS**

---

## Technologies Used

### Backend
- **Node.js + Express.js** - Backend services and route handling
- **MongoDB + Mongoose** - NoSQL database and ODM
- **Redis** - In-memory caching and session management
- **Socket.IO** - Real-time, bidirectional communication
- **JWT + Bcrypt** - Authentication and password hashing
- **Nodemailer** - Email notifications
- **Swagger/OpenAPI** - API documentation

### Frontend
- **React 19** (User App) - Dynamic chat interface with Styled Components
- **React 18 + TypeScript** (Admin App) - Dashboard with ShadCN UI components
- **Tailwind CSS** - Utility-first CSS for responsive UI
- **React Query v5** - Server state management (Admin)
- **Recharts** - Data visualization (Admin dashboard charts)

### Infrastructure
- **Docker + Docker Compose** - Containerized deployment (includes MongoDB + Redis)

---

## Getting Started

### Docker (Recommended)

```bash
git clone https://github.com/Alwinkunjachan/MERN-NLP-Emotract.git
cd MERN-NLP-Emotract
```

Create environment files:
```bash
cp server/.env.example server/.env
cp admin/.env.example admin/.env
cp user/.env.example user/.env
```

Edit `server/.env` with your configuration (see [Setup Guide](docs/SETUP.md)).

Start all services:
```bash
docker-compose up --build
```

### Access the Application

| Service    | URL                          |
|------------|------------------------------|
| User App   | http://localhost:5173        |
| Admin App  | http://localhost:5174        |
| Backend    | http://localhost:5001        |
| API Docs   | http://localhost:5001/api-docs |

### Default Admin Login

- **Username:** `admin`
- **Password:** `admin123`

---

## Documentation

- [Project Documentation](docs/DOCUMENTATION.md) - Detailed technical docs
- [API Reference](docs/API.md) - All REST endpoints and WebSocket events
- [Architecture](docs/ARCHITECTURE.md) - System design and data flow diagrams
- [Setup Guide](docs/SETUP.md) - Docker and manual setup instructions
- [MongoDB Atlas Guide](docs/MONGODB_ATLAS_SETUP.md) - Cloud database setup
