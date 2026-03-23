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
  const [lastPoint, setLastPoint] = useState(null);
  const [userName, setUserName] = useState(`User${Math.floor(Math.random() * 1000)}`);
  const [usersInRoom, setUsersInRoom] = useState([]);
 const [lastReceivedPoint, setLastReceivedPoint] = useState(null); 
 console.log("?? Whiteboard component rendering..."); 
  // Initialize socket connection
  useEffect(() => {
    console.log("?? Socket useEffect running...");
    console.log("Setting up socket...");
    console.log("?? Setting up socket connection...");
    const getServerUrl = () => {
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        return "http://127.0.0.1:3000";
      }
      return "http://192.168.1.124:3000";
    };
    const socket = io(getServerUrl(), {
      transports: ["polling"],
      reconnection: true
    });
      socket.on("connect", () => {
    console.log("? Connected! ID:", socket.id);
    setConnected(true);
    // DO NOT auto-join room here
  });
  
  socket.on("drawing", (data) => {
    console.log("?? Received drawing from:", data.username);
    
    if (data.roomId === currentRoom) {
      console.log("? Drawing is for our room, drawing...");
      drawLine(
        data.x, 
        data.y, 
        data.color, 
        data.size, 
        false, 
        data.isContinuation
      );
    }
  });
  
  socketRef.current = socket;
  return () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };
}, [currentRoom]);

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
    console.log("?? Canvas context available:", !!context);
    console.log("?? Canvas size:", canvas.width, "x", canvas.height);
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
  // Add this useEffect to log room changes
useEffect(() => {
  console.log(`?? Current room changed: "${currentRoom}" (length: ${currentRoom.length})`);
  console.log(`?? Room input: "${roomId}" (length: ${roomId.length})`);
}, [currentRoom, roomId]);
// Add this useEffect to track currentRoom changes
useEffect(() => {
  console.log(`?? currentRoom changed to: "${currentRoom}"`);
}, [currentRoom]);
  // Drawing functions
  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / canvas.offsetWidth;
    const scaleY = canvas.height / canvas.offsetHeight;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };
  useEffect(() => {
  console.log("?? DEBUG: Checking canvas setup...");
  const canvas = canvasRef.current;
  
  if (canvas) {
    const ctx = canvas.getContext("2d");
    
    // Draw a test shape to verify canvas works
    ctx.fillStyle = "red";
    ctx.fillRect(10, 10, 50, 50);
    console.log("? Test red square drawn at (10,10)");
    
    // Check drawing properties
    console.log("?? Canvas properties:", {
      width: canvas.width,
      height: canvas.height,
      strokeStyle: ctx.strokeStyle,
      lineWidth: ctx.lineWidth,
      fillStyle: ctx.fillStyle
    });
  } else {
    console.log("? Canvas not found!");
  }
}, []);
const drawLine = (x, y, drawColor, drawSize, emit = true, isContinuation = false) => {
  console.log(`?? Drawing at (${Math.round(x)}, ${Math.round(y)}) in room: ${currentRoom}`);
  const canvas = canvasRef.current;
  if (!canvas) return;
  const context = canvas.getContext("2d");
  context.save();
  context.strokeStyle = drawColor || color;
  context.lineWidth = drawSize || brushSize;
  context.lineCap = "round";
  context.lineJoin = "round";
  
  if (!emit) {
    // For received drawings, we need to know if this is a continuation
    context.beginPath();
    
    if (isContinuation && lastReceivedPoint) {
      // Continue from last point
      context.moveTo(lastReceivedPoint.x, lastReceivedPoint.y);
    } else {
      // Start new line
      context.moveTo(x, y);
    }
    
    context.lineTo(x, y);
    context.stroke();
    
    // Store the last received point
    setLastReceivedPoint({ x, y });
  } else {
    // Local drawing
    if (!isContinuation) {
      context.beginPath();
      context.moveTo(x, y);
    }
    context.lineTo(x, y);
    context.stroke();
  }
  
  context.restore();
  
  if (emit && socketRef.current && connected && currentRoom) { 
    console.log(`?? Sending to room: ${currentRoom}`);
    socketRef.current.emit("drawing", {
      x, y,
      color: drawColor || color,
      size: drawSize || brushSize,
      roomId: currentRoom,
      isContinuation: isContinuation // Add this flag
    });
  }
};
  const startDrawing = (e) => {
  if (!connected) return;
  
  const { x, y } = getCanvasCoordinates(e);
  const canvas = canvasRef.current;
  const context = canvas.getContext("2d");
  
  // Start new path
  context.beginPath();
  context.moveTo(x, y);
  
  // Draw the first point
  drawLine(x, y, color, brushSize, true, false);
  
  setIsDrawing(true);
  setLastPoint({ x, y });
};

const draw = (e) => {
  if (!isDrawing || !connected) return;
  
  const { x, y } = getCanvasCoordinates(e);
  
  if (lastPoint) {
    // Continue the line from last point
    drawLine(x, y, color, brushSize, true, true);
    setLastPoint({ x, y });
  }
};
  
  console.log("? Drawing started with:", {
    color: context.strokeStyle,
    size: context.lineWidth
  });
}
  const stopDrawing = () => {
    if (!connected) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.closePath();
    setIsDrawing(false);
    setLastPoint(null);
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
  if (!socketRef.current || !connected || !trimmedRoomId) {
    console.log("? Cannot join room:", {
      hasSocket: !!socketRef.current,
      connected: connected,
      roomId: trimmedRoomId
    });
    return;
  }
  
   console.log(`?? Joining room: "${roomToJoin}"`);
  
  socketRef.current.emit("join-room", { 
    roomId: trimmedRoomId,
    username: userName 
  });
  setRoomId(roomToJoin);
};
  const clearSavedRoom = () => {
    localStorage.removeItem("whiteboard-room");
    setRoomId("default-room");
    if (socketRef.current && connected) {
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
        roomId: currentRoom
      });
    }
  }
  };
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      padding: "20px"
    }}>
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <h1 style={{ color: "white", marginBottom: "10px" }}>?? Collaborative Whiteboard</h1>
        <div style={{ 
          display: "inline-block",
          padding: "10px 20px",
          background: connected ? "rgba(76, 175, 80, 0.2)" : "rgba(244, 67, 54, 0.2)",
          borderRadius: "20px",
          border: `2px solid ${connected ? "#4CAF50" : "#f44336"}`
        }}>
          <span style={{ color: "white", fontWeight: "bold" }}>
            {connected ? "? CONNECTED" : "? DISCONNECTED"}
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
            onChange={(e) => setRoomId(e.target.value.trimStart())}
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
            {roomId.trim() === currentRoom.trim() ? "? In Room" : "Join Room"}
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
          >
            Clear Saved
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
          border: "3px solid #4a6fa5",
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
        }}
        width="800"
        height="600"
        title={connected ? "Click and drag to draw" : "Connect to server first"}
      />
      <div style={{ textAlign: "center", color: "rgba(255, 255, 255, 0.8)" }}>
        <p>?? Share the room name <strong>"{currentRoom}"</strong> with others to collaborate</p>
        <p style={{ fontSize: "0.9em" }}>Drawings sync automatically between all users in the same room</p>
      </div>
    </div>
  );


export default Whiteboard;
