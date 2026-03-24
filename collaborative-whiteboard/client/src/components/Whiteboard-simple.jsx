import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./Whiteboard.css";

const Whiteboard = () => {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState("default-room");
  const [currentRoom, setCurrentRoom] = useState("default-room");
  const [userName, setUserName] = useState(`User${Math.floor(Math.random() * 1000)}`);
  const [usersInRoom, setUsersInRoom] = useState([]);

  const currentRoomRef = useRef("default-room");
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);

  // Update ref when state changes
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  console.log("🔄 Whiteboard component rendering...");

  useEffect(() => {
    console.log("🔌 Setting up socket connection...");
    
// Make sure it's VITE_SOCKET_URL (with VITE_ prefix)
const socket = io(import.meta.env.VITE_SOCKET_URL, {
  transports: ["polling", "websocket"],
  reconnection: true,
  reconnectionAttempts: 5,
  timeout: 10000
});

// this to check what URL is being used
console.log("🔌 Connecting to server:", import.meta.env.VITE_SOCKET_URL); 
    
    socketRef.current = socket;
    
    socket.on("connect", () => {
      console.log("✅ Connected! ID:", socket.id);
      setConnected(true);
      
      // Join default room on initial connection
      socket.emit("join-room", { 
        roomId: "default-room", 
        username: userName 
      });
    });
    
    socket.on("room-joined", (data) => {
      console.log("✅ Joined room:", data.room);
      console.log("👥 Users in room:", data.users);
      setCurrentRoom(data.room);
      setUsersInRoom(data.users || []);
    });
    
    socket.on("user-joined", (data) => {
      console.log("👤 User joined:", data.username);
      setUsersInRoom(prev => [...prev, data.username]);
      });
    
    socket.on("user-left", (data) => {
      console.log("👤 User left:", data.username);
        setUsersInRoom(prev => prev.filter(user => user !== data.username));
    });
    
     socket.on("drawing", (data) => {
      console.log("📨 Received drawing for room:", data.roomId);
      console.log("Our current room (from ref):", currentRoomRef.current);

      if (data.roomId === currentRoomRef.current) {
        console.log("✅ Drawing is for our room - DRAWING IT");
        drawOnCanvas(data.x, data.y, data.color, data.size, data.isStart);
      } else {
        console.log(`❌ Ignoring drawing from different room: ${data.roomId}`);
      }
    });
    
    socket.on("clear-board", (data) => {
      if (data.roomId === currentRoomRef.current) {
        clearCanvas(false);
        console.log("🧹 Canvas cleared by server");
      }
    });
    
    socket.on("connect_error", (err) => {
      console.error("Connection error:", err.message);
    });
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Canvas initialization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    canvas.width = 800;
    canvas.height = 600;
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = color;
    context.lineWidth = brushSize;
    console.log("Canvas initialized");
  }, []);
  
  // Update drawing style
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.strokeStyle = color;
    context.lineWidth = brushSize;
  }, [color, brushSize]);
  
  // LocalStorage for room persistence
  useEffect(() => {
    const savedRoom = localStorage.getItem("whiteboard-room");
    if (savedRoom && savedRoom !== currentRoom) {
      setRoomId(savedRoom);
    }
  }, []);
  
  useEffect(() => {
    if (currentRoom && currentRoom !== "default-room") {
      localStorage.setItem("whiteboard-room", currentRoom);
    }
  }, [currentRoom]);
  
  // Log room changes
  useEffect(() => {
    console.log(`🔄 Current room changed: "${currentRoom}"`);
    console.log(`🔄 Room input: "${roomId}"`);
  }, [currentRoom, roomId]);
  const getCanvasCoordinates = (e) => {
    console.log("🔍 getCanvasCoordinates called with event:", e);
    console.log("🔍 Event type:", e.type);
    console.log("🔍 Event has touches?", e.touches ? "YES" : "NO");
  
    const canvas = canvasRef.current;
    console.log("🔍 Canvas exists?", canvas ? "YES" : "NO");
  
    const rect = canvas.getBoundingClientRect();
    console.log("🔍 Canvas rect:", rect);
  
    const scaleX = canvas.width / canvas.offsetWidth;
    const scaleY = canvas.height / canvas.offsetHeight;
    console.log("🔍 Scale X:", scaleX, "Scale Y:", scaleY);
    
  // Get coordinates from either mouse or touch event
  let clientX, clientY;
  
  if (e.touches) {
    // Touch event
    console.log("🔍 This IS a touch event!");
    console.log("🔍 touches.length:", e.touches.length);
    
    if (e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
      console.log("🔍 Touch clientX:", clientX, "clientY:", clientY);
    } else {
      console.log("🔍 No touches found!");
      clientX = 0;
      clientY = 0;
    }
  } else if (e.clientX !== undefined) {
    // Mouse event
    console.log("🔍 This is a MOUSE event");
    clientX = e.clientX;
    clientY = e.clientY;
    console.log("🔍 Mouse clientX:", clientX, "clientY:", clientY);
  } else {
    // Fallback for synthetic events
    console.log("🔍 Fallback - synthetic event");
    clientX = e.clientX || 0;
    clientY = e.clientY || 0;
  }
  
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;
  
  console.log("🔍 Final coordinates:", x, y);
  
  return { x, y };
};
// Force touch events on canvas
useEffect(() => {
  console.log("🔥🔥🔥 FORCED TOUCH EFFECT IS RUNNING 🔥🔥🔥");
  const canvas = canvasRef.current;
  if (!canvas) {
    console.log("❌ Canvas not found!");
    return;
  }
  
  console.log("✅ Canvas found, adding touch listeners...");
  console.log("📱 Canvas element:", canvas);
  console.log("📱 Setting up forced touch listeners");
  
  // Define touch handlers
  const handleTouchStart = (e) => {
    e.preventDefault();
    console.log("📱 FORCED touch start", e.touches[0]);
    
    const touch = e.touches[0];
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / canvas.offsetWidth;
    const scaleY = canvas.height / canvas.offsetHeight;

    console.log("📏 Canvas rect:", rect);
    console.log("📏 Touch client coordinates:", touch.clientX, touch.clientY);
    console.log("📏 Scale factors:", scaleX, scaleY);
    
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;

    console.log("📏 Calculated canvas coordinates:", x, y);
    
    // Draw locally
    drawOnCanvas(x, y, color, brushSize, true);
    
    // Send to server
    if (socketRef.current && connected) {
      console.log("📤 Sending touch drawing with coordinates:", x, y);
      socketRef.current.emit("drawing", {
        x, y,
        color: color,
        size: brushSize,
        roomId: currentRoom,
        isStart: true
      });
    }
    
    isDrawingRef.current = true;
    lastPointRef.current = { x, y };
    setIsDrawing(true);
  };
  
  const handleTouchMove = (e) => {
    e.preventDefault();
    if (!isDrawingRef.current || !connected) return;
    
    const touch = e.touches[0];
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / canvas.offsetWidth;
    const scaleY = canvas.height / canvas.offsetHeight;
    
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;

    console.log("📏 Touch move coordinates:", x, y);
    
    // Draw locally
    drawOnCanvas(x, y, color, brushSize, false);
    
    // Send to server
    if (socketRef.current && connected) {
      socketRef.current.emit("drawing", {
        x, y,
        color: color,
        size: brushSize,
        roomId: currentRoom,
        isStart: false
      });
    }
    
    lastPointRef.current = { x, y };
  };
  
  const handleTouchEnd = (e) => {
    e.preventDefault();
    isDrawingRef.current = false;
    lastPointRef.current = null;
    setIsDrawing(false);
  };
  
  // Add event listeners
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', handleTouchEnd);
  canvas.addEventListener('touchcancel', handleTouchEnd);
  
  console.log("✅ Touch listeners added to canvas");
  canvas.style.border = "5px solid green"; // This will turn the border green if listeners are added  
  
  // Cleanup
  return () => {
    canvas.removeEventListener('touchstart', handleTouchStart);
    canvas.removeEventListener('touchmove', handleTouchMove);
    canvas.removeEventListener('touchend', handleTouchEnd);
    canvas.removeEventListener('touchcancel', handleTouchEnd);
  };
}, [color, brushSize, connected, currentRoom]); // Dependencies
const drawOnCanvas = (x, y, drawColor, drawSize, isStart = false) => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const context = canvas.getContext("2d");
  context.strokeStyle = drawColor || color;
  context.lineWidth = drawSize || brushSize;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (isStart) {
    context.beginPath();
    context.moveTo(x, y);
  } else {
    context.lineTo(x, y);
    context.stroke();
  }
};

// Then define drawLine function
const drawLine = (x, y, drawColor, drawSize, emit = true, isStart = false) => {
  console.log(`🎨 Drawing at (${Math.round(x)}, ${Math.round(y)}) in room: ${currentRoom}`);
  
  // Call drawOnCanvas directly
  drawOnCanvas(x, y, drawColor, drawSize, isStart);
  
  if (emit && socketRef.current && connected && currentRoom) {
    console.log(`📤 Sending to room: ${currentRoom}`);
    socketRef.current.emit("drawing", {
      x, y,
      color: drawColor || color,
      size: drawSize || brushSize,
      roomId: currentRoom,
      isStart: isStart
    });
  }
};
   
   const drawReceivedLine = (x, y, drawColor, drawSize, isStart = false) => {
    console.log(`🎨 Received drawing at (${x}, ${y})`);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const context = canvas.getContext("2d");
    context.save();
    
    context.strokeStyle = drawColor || color;
    context.lineWidth = drawSize || brushSize;
    context.lineCap = "round";
    context.lineJoin = "round";
    
    if (isStart) {
      context.beginPath();
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
      context.stroke();
    }
    
    context.restore();
  };
  const startDrawing = (e) => {
    console.log("🖊️ startDrawing called with event type:", e.type);
    console.log("🖊️ Event target:", e.target);
  
    if (!connected) {
      console.log("🖊️ Not connected, returning");
      return;
   }
   console.log("🖊️ Getting coordinates...");
   const { x, y } = getCanvasCoordinates(e);
   console.log(`🖊️ Got coordinates: (${x}, ${y})`);
  
   drawOnCanvas(x, y, color, brushSize, true);

   if (socketRef.current && connected) {
     console.log(`📤 Sending to room: ${currentRoom}`);
     socketRef.current.emit("drawing", {
       x, y,
       color: color,
       size: brushSize,
       roomId: currentRoom,
       isStart: true
     });
   }
  
   isDrawingRef.current = true;
   lastPointRef.current = { x, y };
   setIsDrawing(true);
 };
    
  const draw = (e) => {
    if (!isDrawingRef.current || !connected) return;
    
    const { x, y } = getCanvasCoordinates(e);
    
    // Draw locally
    drawOnCanvas(x, y, color, brushSize, false);
    
    // Send to server
    if (socketRef.current && connected) {
      socketRef.current.emit("drawing", {
        x, y,
        color: color,
        size: brushSize,
        roomId: currentRoom,
        isStart: false
      });
    }
    
    lastPointRef.current = { x, y };
  };
  
  const stopDrawing = () => {
    console.log("✋ Drawing stopped");
    isDrawingRef.current = false;
    lastPointRef.current = null;
    setIsDrawing(false);
  };
  
  const clearCanvas = (emit = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (emit && socketRef.current && connected && currentRoom) {
      socketRef.current.emit("clear-board", { roomId: currentRoom });
    }
  };
  
  
  const joinRoom = () => {
    const trimmedRoomId = roomId.trim();
    const roomToJoin = trimmedRoomId || "default-room";
    
    if (!socketRef.current || !connected) {
      console.log("❌ Cannot join room: Not connected");
      return;
    }
   
    if (roomToJoin === currentRoom) {
    console.log(`🚪 Already in room: "${roomToJoin}"`);
    return;
    }

    console.log(`🚪 Joining room: "${roomToJoin}"`);
    console.log(`📊 Leaving current room: "${currentRoom}"`);

      if (currentRoom && currentRoom !== roomToJoin) {
        socketRef.current.emit("leave-room", currentRoom);
    }
    socketRef.current.emit("join-room", { 
      roomId: roomToJoin,
      username: userName 
    });
       setRoomId(roomToJoin);
    // Note: currentRoom will be updated when server sends "room-joined" event
  };

  const clearSavedRoom = () => {
    localStorage.removeItem("whiteboard-room");
    setRoomId("default-room");

    if (socketRef.current && connected) {
      // Leave current room first
      if (currentRoom && currentRoom !== "default-room") {
        socketRef.current.emit("leave-room", currentRoom);
      }
      // Join default room
      socketRef.current.emit("join-room", { 
        roomId: "default-room", 
        username: userName 
      });
    }
  };
  
  const testBroadcast = () => {
    if (socketRef.current && connected) {
      socketRef.current.emit("drawing", {
        x: 100,
        y: 100,
        color: "#ff0000",
        size: 10,
        roomId: currentRoom,
        isStart: false
      });
    }
  };

  return (
    <div className="whiteboard-simple" style={{
      minHeight: "100vh",
      padding: "20px"
    }}>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <h1 style={{ color: "white", marginBottom: "10px" }}>🎨 Collaborative Whiteboard</h1>
        <div style={{ 
          display: "inline-block",
          padding: "10px 20px",
          background: connected ? "rgba(76, 175, 80, 0.2)" : "rgba(244, 67, 54, 0.2)",
          borderRadius: "20px",
          border: `2px solid ${connected ? "#4CAF50" : "#f44336"}`
        }}>
          <span style={{ color: "white", fontWeight: "bold" }}>
            {connected ? "✅ CONNECTED" : "❌ DISCONNECTED"}
          </span>
        </div>
      </div>
      <div style={{ 
        maxWidth: "900px", 
        margin: "0 auto",
        background: "rgba(255, 255, 255, 0.1)",
        borderRadius: "15px",
        padding: "20px",
        marginBottom: "20px"
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", justifyContent: "center", marginBottom: "15px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ color: "white", fontWeight: "bold" }}>Color:</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              disabled={!connected}
              style={{ width: "50px", height: "40px", cursor: connected ? "pointer" : "not-allowed" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ color: "white", fontWeight: "bold" }}>Brush: {brushSize}px</span>
            <input
              type="range"
              min="1"
              max="50"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              disabled={!connected}
              style={{ width: "150px" }}
            />
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button 
              onClick={clearCanvas}
              disabled={!connected}
              style={{ 
                background: "#E74C3C",
                color: "white",
                padding: "10px 15px",
                border: "none",
                borderRadius: "5px",
                cursor: connected ? "pointer" : "not-allowed",
                fontWeight: "bold"
              }}
            >
              Clear Canvas
            </button>
            <button 
              onClick={testBroadcast}
              disabled={!connected}
              style={{ 
                background: "#9B59B6",
                color: "white",
                padding: "10px 15px",
                border: "none",
                borderRadius: "5px",
                cursor: connected ? "pointer" : "not-allowed",
                fontWeight: "bold"
              }}
            >
              Test
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center", alignItems: "center" }}>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Your name"
            style={{
              padding: "10px 15px",
              borderRadius: "5px",
              border: "1px solid #ccc",
              width: "150px"
            }}
          />
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Room name"
            style={{ 
              padding: "10px 15px",
              borderRadius: "5px",
              border: "1px solid #ccc",
              width: "150px"
            }}
            disabled={!connected}
            onBlur={(e) => setRoomId(e.target.value.trim())}
          />
          <button 
            onClick={joinRoom}
            disabled={!connected || roomId.trim() === currentRoom.trim()}
            style={{ 
              background: roomId.trim() === currentRoom.trim() ? "#27ae60" : "#3498db",
              color: "white",
              padding: "10px 20px",
              border: "none",
              borderRadius: "5px",
              cursor: connected && roomId !== currentRoom ? "pointer" : "not-allowed",
              fontWeight: "bold"
            }}
          >
            {roomId.trim() === currentRoom.trim() ? "✓ In Room" : "Join Room"}
          </button>
          <button 
            onClick={clearSavedRoom}
            disabled={!connected}
            style={{
              background: "#e67e22",
              color: "white",
              padding: "10px 15px",
              border: "none",
              borderRadius: "5px",
              cursor: connected ? "pointer" : "not-allowed",
              fontWeight: "bold"
            }}
            >Clear Saved Room
          </button>
        </div>
      </div>
      <div style={{ 
        maxWidth: "850px", 
        margin: "0 auto 20px auto",
        background: "rgba(0, 0, 0, 0.2)",
        borderRadius: "10px",
        padding: "15px"
      }}>
        <p style={{ color: "white", textAlign: "center", margin: "0 0 10px 0" }}>
          <strong>Room:</strong> <span style={{ color: "lightgreen" }}>{currentRoom}</span>
          {" • "}
          <strong>Users:</strong> <span style={{ color: "lightblue" }}>{usersInRoom.length}</span>
        </p>
        {usersInRoom.length > 0 && (
          <div style={{ 
            display: "flex", 
            flexWrap: "wrap", 
            gap: "10px", 
            justifyContent: "center" 
          }}>
            {usersInRoom.map((user, index) => (
              <div 
                key={index}
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  padding: "5px 15px",
                  borderRadius: "20px",
                  color: "white",
                  fontSize: "0.9em"
                }}
              >
                {user} {user === userName && "(You)"}
              </div>
            ))}
          </div>
        )}
      </div>
      <canvas
        ref={canvasRef}
        // Mouse events (for desktop)
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
  
         style={{
           cursor: connected ? "crosshair" : "not-allowed",
           backgroundColor: "white",
           borderRadius: "10px",
           display: "block",
           margin: "0 auto 20px auto",
           maxWidth: "100%",
           border: "3px solid #4a6fa5",
           boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
           touchAction: "none",
           userSelect: "none",
           WebkitUserSelect: "none"
         }}
         width="800"
         height="600"
         title={connected ? "Touch and drag to draw" : "Connect to server first"}
       />
       <div style={{ textAlign: "center", color: "rgba(255, 255, 255, 0.8)" }}>
         <p>💡 Share the room name <strong>"{currentRoom}"</strong> with others to collaborate</p>
         <p style={{ fontSize: "0.9em" }}>Drawings sync automatically between all users in the same room</p>
       </div>
     </div>
   );
 };

export default Whiteboard;