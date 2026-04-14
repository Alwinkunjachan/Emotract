import { Server } from 'socket.io';
import { createRequire } from 'module';
import User from '../models/Users.js';

// Use jose with explicit crypto polyfill for Node 18
import { webcrypto } from 'crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
import { createRemoteJWKSet, jwtVerify } from 'jose';

// JWKS endpoint for Auth0 token verification (cached by jose)
let JWKS;
function getJWKS() {
  if (!JWKS) {
    JWKS = createRemoteJWKSet(
      new URL(`https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`)
    );
  }
  return JWKS;
}

export const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: ["http://localhost:5173", "http://localhost:5174"],
      credentials: true,
    },
  });

  global.onlineUsers = new Map();

  // Auth0 token verification middleware for socket connections
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    try {
      const { payload } = await jwtVerify(token, getJWKS(), {
        audience: process.env.AUTH0_AUDIENCE,
        issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      });

      const user = await User.findOne({ auth0_id: payload.sub });
      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }
      if (!user.is_active) {
        return next(new Error("Authentication error: Account deactivated"));
      }

      // Attach verified userId to socket for all subsequent events
      socket.userId = user._id.toString();
      next();
    } catch (err) {
      console.error("Socket auth error:", err.message);
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;
    console.log(`Socket connected: ${userId} (${socket.id})`);

    // Auto-register as online using server-verified userId
    global.onlineUsers.set(userId, socket.id);

    (async () => {
      try {
        await User.findByIdAndUpdate(userId, { is_online: true, socket_id: socket.id });
      } catch (err) {
        console.error("Error updating user online status:", err);
      }
    })();

    // Send the full list of online userIds to the newly connected user
    socket.emit("online-users", Array.from(global.onlineUsers.keys()));

    // Notify all other users that this user came online
    socket.broadcast.emit("user-status-change", { userId, isOnline: true });

    socket.on("send-msg", (data) => {
      const sendUserSocket = global.onlineUsers.get(data.to);
      if (sendUserSocket) {
        socket.to(sendUserSocket).emit("msg-recieve", {
          from: userId,
          msg: data.msg,
        });
      }
    });

    socket.on("logout", async () => {
      global.onlineUsers.delete(userId);
      const lastSeen = new Date();

      try {
        await User.findByIdAndUpdate(userId, { is_online: false, socket_id: null, last_active: lastSeen });
        socket.broadcast.emit("user-status-change", { userId, isOnline: false, lastSeen });
      } catch (err) {
        console.error("Error updating user logout status:", err);
      }
    });

    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${userId} (${socket.id})`);
      global.onlineUsers.delete(userId);
      const lastSeen = new Date();

      try {
        await User.findByIdAndUpdate(userId, { is_online: false, socket_id: null, last_active: lastSeen });
        socket.broadcast.emit("user-status-change", { userId, isOnline: false, lastSeen });
      } catch (err) {
        console.error("Error updating user offline status:", err);
      }
    });
  });

  return io;
};
