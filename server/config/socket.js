// socket.js
import { Server } from 'socket.io';
import User from '../models/Users.js';

// Reverse lookup: find userId by socketId from the in-memory Map
function getUserIdBySocketId(socketId) {
  for (const [userId, sId] of global.onlineUsers.entries()) {
    if (sId === socketId) return userId;
  }
  return null;
}

export const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
  });

  global.onlineUsers = new Map();

  io.on("connection", (socket) => {

    socket.on("add-user", async (userId) => {
      global.onlineUsers.set(userId, socket.id);

      try {
        await User.findByIdAndUpdate(userId, { is_online: true, socket_id: socket.id });
      } catch (err) {
        console.error("Error updating user online status:", err);
      }

      // Send the full list of online userIds to the newly connected user
      socket.emit("online-users", Array.from(global.onlineUsers.keys()));

      // Notify all other users that this user came online
      socket.broadcast.emit("user-status-change", { userId, isOnline: true });
    });

    socket.on("send-msg", (data) => {
      const sendUserSocket = global.onlineUsers.get(data.to);
      if (sendUserSocket) {
        socket.to(sendUserSocket).emit("msg-recieve", {
          from: data.from,
          msg: data.msg,
        });
      }
    });

    socket.on("logout", async (userId) => {
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
      const userId = getUserIdBySocketId(socket.id);
      if (!userId) return;

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
