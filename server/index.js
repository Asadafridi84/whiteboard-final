const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const PORT = process.env.PORT || 10000;
const app = express();
const server = http.createServer(app);
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://127.0.0.1:5173", 
    "http://192.168.1.124:5173",
    "https://whiteboard-final-xcsn.vercel.app"
  ],
  credentials: true
}));

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173", 
      "http://192.168.1.124:5173",
      "https://whiteboard-final-xcsn.vercel.app", // YOUR VERCEL DOMAIN
      "https://*.vercel.app" // Allow all Vercel apps
    ],
    credentials: true,
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});s
// Store room history
const roomHistory = {};
// Store room users
const roomUsers = {};
io.on("connection", (socket) => {
  console.log("🎯 NEW CLIENT CONNECTED!");
  console.log("Socket ID:", socket.id);
  console.log("Origin:", socket.handshake.headers.origin);
  console.log("Transport:", socket.conn.transport.name);
  // Initialize user data
  socket.username = `User${Math.floor(Math.random() * 1000)}`;
  socket.currentRoom = null;
  console.log(`   👤 Default username: ${socket.username}`);
  // Send welcome message
  socket.emit("welcome", {
    message: "Connected to whiteboard server!",
    id: socket.id,
    username: socket.username,
    timestamp: new Date().toISOString()
  });
  // JOIN-ROOM HANDLER
  socket.on("join-room", (data) => {
    let roomId, username;
    // Handle both string (old) and object (new) formats
    if (typeof data === "string") {
      roomId = data.trim();
      username = socket.username;
    } else {
      roomId = (data.roomId || "").trim();
      username = data.username || socket.username;
    }
    console.log(`📌 ${socket.id} (${username}) joining room: ${roomId}`);
    // Leave previous room if any
    if (socket.currentRoom && socket.currentRoom !== roomId) {
      console.log(`   ← Leaving previous room: ${socket.currentRoom}`);
      socket.leave(socket.currentRoom);
      // Remove from old room"s user list
      if (roomUsers[socket.currentRoom] && socket.username) {
        roomUsers[socket.currentRoom] = roomUsers[socket.currentRoom]
          .filter(u => u !== socket.username);
        // Notify old room
        socket.to(socket.currentRoom).emit("user-left", { 
          username: socket.username 
        });
        console.log(`   Removed ${socket.username} from room: ${socket.currentRoom}`);
      }
    }
    // Join new room
    socket.join(roomId);
    socket.currentRoom = roomId;
    socket.username = username;
    // Initialize room data if needed
    if (!roomHistory[roomId]) {
      roomHistory[roomId] = [];
      console.log(`   📁 Created new room history: ${roomId}`);
    }
    if (!roomUsers[roomId]) {
      roomUsers[roomId] = [];
      console.log(`   👥 Created new user list for room: ${roomId}`);
    }
    // Add user to room (if not already there)
    if (!roomUsers[roomId].includes(username)) {
      roomUsers[roomId].push(username);
      console.log(`   ➕ Added ${username} to room: ${roomId}`);
    }
    // Notify room about new user (except sender)
    socket.to(roomId).emit("user-joined", { 
      username: username,
      roomId: roomId
    });
    console.log(`   → ${socket.id} is now in room: ${roomId}`);
    console.log(`   👥 Users in ${roomId}:`, roomUsers[roomId]);
    // Send room joined confirmation with user list
    socket.emit("room-joined", { 
      room: roomId,
      users: roomUsers[roomId],
      message: `Joined room "${roomId}" successfully`
    });
    // Send drawing history for this room
    socket.emit("drawing-history", { 
      roomId, 
      drawings: roomHistory[roomId] 
    });
  });
  // LEAVE ROOM
  socket.on("leave-room", (roomId) => {
    console.log(`🚪 ${socket.id} leaving room: ${roomId}`);
    if (roomUsers[roomId] && socket.username) {
      // Remove user from room list
      roomUsers[roomId] = roomUsers[roomId]
        .filter(u => u !== socket.username);
      // Notify room
      socket.to(roomId).emit("user-left", { 
        username: socket.username 
      });
      console.log(`   Removed ${socket.username} from room: ${roomId}`);
    }
    socket.leave(roomId);
    if (socket.currentRoom === roomId) {
      socket.currentRoom = null;
    }
  });
  // DRAWING HANDLER
  socket.on("drawing", (data) => {
    console.log(`🎨 Drawing from ${socket.id} (${socket.username || "unknown"}) in room ${data.roomId}`);
    // Store drawing in room history
    if (!roomHistory[data.roomId]) {
      roomHistory[data.roomId] = [];
    }
    roomHistory[data.roomId].push({
      ...data,
      username: socket.username,
      timestamp: new Date().toISOString()
    });
    // Keep history manageable (last 1000 drawings)
    if (roomHistory[data.roomId].length > 1000) {
      roomHistory[data.roomId] = roomHistory[data.roomId].slice(-500);
    }
    // Broadcast to others in the same room
    socket.to(data.roomId).emit("drawing", {
      ...data,
      username: socket.username  // Add username to drawing data
    });
    // Log broadcast info
    const room = io.sockets.adapter.rooms.get(data.roomId);
    if (room) {
      console.log(`   📤 Broadcasting to ${room.size - 1} other clients in room ${data.roomId}`);
    }
  });
  // CLEAR BOARD
  socket.on("clear-board", (data) => {
    const roomId = data?.roomId || "default-room";
    console.log(`🧹 ${socket.id} (${socket.username}) cleared room ${roomId}`);
    // Clear room history
    roomHistory[roomId] = [];
    // Broadcast clear event to everyone in room (INCLUDING sender)
    io.to(roomId).emit("clear-board", { 
      roomId,
      clearedBy: socket.username
    });
  });
  // GET USERS IN ROOM
  socket.on("get-users", (data) => {
    const roomId = data?.roomId || socket.currentRoom;
    if (roomId && roomUsers[roomId]) {
      socket.emit("users-list", { 
        roomId: roomId,
        users: roomUsers[roomId]
      });
    }
  });
  // UPDATE USERNAME
  socket.on("update-username", (newUsername) => {
    const oldUsername = socket.username;
    if (!newUsername || newUsername.trim() === "") {
      socket.emit("error", { message: "Username cannot be empty" });
      return;
    }
    socket.username = newUsername;
    // Update in room if user is in a room
    if (socket.currentRoom && roomUsers[socket.currentRoom]) {
      const index = roomUsers[socket.currentRoom].indexOf(oldUsername);
      if (index !== -1) {
        roomUsers[socket.currentRoom][index] = newUsername;
      }
      // Notify room about username change
      socket.to(socket.currentRoom).emit("username-changed", {
        oldUsername,
        newUsername,
        roomId: socket.currentRoom
      });
    }
    console.log(`🔄 ${socket.id} changed username: ${oldUsername} → ${newUsername}`);
    socket.emit("username-updated", { 
      newUsername,
      message: "Username updated successfully"
    });
  });
  // DISCONNECT HANDLER
  socket.on("disconnect", (reason) => {
    console.log(`🔌 ${socket.id} (${socket.username || "unknown"}) disconnected: ${reason}`);
    // Remove user from room if they were in one
    if (socket.currentRoom && socket.username) {
      const room = socket.currentRoom;
      if (roomUsers[room]) {
        // Remove user from room
        roomUsers[room] = roomUsers[room]
          .filter(u => u !== socket.username);
        console.log(`   Removed ${socket.username} from room: ${room}`);
        console.log(`   Remaining users in ${room}:`, roomUsers[room]);
        // Notify room
        socket.to(room).emit("user-left", { 
          username: socket.username,
          roomId: room
        });
        // Clean up empty rooms
        if (roomUsers[room].length === 0) {
          delete roomUsers[room];
          console.log(`   🗑️ Room ${room} user list cleared (empty)`);
        }
      }
    }
  });
});
// HTTP ENDPOINTS
// Server status with detailed room info
app.get("/status", (req, res) => {
  const rooms = Object.keys(roomUsers);
  res.json({
    status: "running",
    server: "Collaborative Whiteboard Server",
    version: "2.0.0",
    activeRooms: rooms.length,
    rooms: rooms.map(room => ({
      name: room,
      userCount: (roomUsers[room] || []).length,
      users: roomUsers[room] || [],
      drawingsCount: (roomHistory[room] || []).length
    })),
    totalUsers: Object.values(roomUsers).flat().length,
    connections: io.engine.clientsCount,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});
// Get specific room info
app.get("/room/:roomId", (req, res) => {
  const roomId = req.params.roomId;
  res.json({
    roomId,
    exists: !!roomUsers[roomId],
    users: roomUsers[roomId] || [],
    userCount: (roomUsers[roomId] || []).length,
    drawingsCount: (roomHistory[roomId] || []).length,
    isActive: io.sockets.adapter.rooms.has(roomId)
  });
});
// Get all active rooms
app.get("/rooms", (req, res) => {
  const rooms = Array.from(io.sockets.adapter.rooms.keys())
    .filter(room => !room.includes("#") && room !== ""); // Filter out system rooms
  res.json({
    activeRooms: rooms,
    count: rooms.length
  });
});
// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});
// SERVER START
server.listen(PORT, "0.0.0.0", () => {
  console.log("=".repeat(60));
  console.log("🚀 COLLABORATIVE WHITEBOARD SERVER v2.0");
  console.log("=".repeat(60));
  
  // ✅ UPDATED: Shows Railway URL when deployed
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    console.log(`📍 Railway: https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  }
  
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`📍 Local: http://127.0.0.1:${PORT}`);
  console.log("📡 Socket.IO with user tracking enabled");
  console.log("👤 User management: Active");
  console.log("💾 Room persistence: Enabled");
  console.log("=".repeat(60));
  console.log("\n📊 API Endpoints:");
  
  // ✅ UPDATED: Shows correct URLs
  const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN 
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${PORT}`;
    
  console.log(`  • Status: ${baseUrl}/status`);
  console.log(`  • Health: ${baseUrl}/health`);
  console.log(`  • Rooms: ${baseUrl}/rooms`);
  console.log(`  • Room info: ${baseUrl}/room/[room-name]`);
  
  console.log("\n🎯 Waiting for connections...");
  console.log("=".repeat(60));
});


