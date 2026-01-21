import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./Whiteboard.css";
const Whiteboard = () => {
  const canvasRef = useRef(null);
  const socketRef = useRef(null); // Use ref to prevent recreation
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState("default-room");
  const [currentRoom, setCurrentRoom] = useState("default-room");
  const [lastPoint, setLastPoint] = useState(null);
  // Initialize socket connection - runs once
  useEffect(() => {
    console.log("🔄 Setting up socket connection...");
    // Only create socket if it doesn't exist
    if (!socketRef.current) {
      console.log("📡 Creating new socket connection...");
      const socket = io("http://127.0.0.1:3000", {
        withCredentials: true,
        transports: ["polling", "websocket"], // Try polling first
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
      socket.on("connect", () => {
        console.log("✅ Socket.IO Connected! ID:", socket.id);
        setConnected(true);
        // Join the initial room
        socket.emit("join-room", roomId);
        setCurrentRoom(roomId);
        console.log(`🚪 Joined initial room: ${roomId}`);
      });
      socket.on("welcome", (data) => {
        console.log("📨 Welcome from server:", data);
      });
      socket.on("connect_error", (err) => {
        console.error("❌ Connection error:", err.message);
        console.log("🔧 Trying polling instead of WebSocket...");
        setConnected(false);
      });
      socket.on("disconnect", (reason) => {
        console.log("🔌 Disconnected:", reason);
        setConnected(false);
      });
      socket.on("drawing", (data) => {
        console.log("📨 Received drawing:", data);
        if (data.roomId === currentRoom) {
          drawLine(data.x, data.y, data.color, data.size, false);
        }
      });
      socket.on("clear-board", (data) => {
        console.log("🧹 Clear board received");
        clearCanvas(false);
      });
      socket.on("room-joined", (data) => {
        console.log("🚪 Successfully joined room:", data.room);
        setCurrentRoom(data.room);
      });
      socketRef.current = socket;
    }
    // Cleanup - only disconnect on unmount
    return () => {
      console.log("🧹 Component unmounting...");
      // We'll keep the socket alive for now
      // if (socketRef.current) {
      //   socketRef.current.disconnect();
      //   socketRef.current = null;
      // }
    };
  }, []); // Empty dependency array - runs once
  // Handle room changes
  useEffect(() => {
    if (socketRef.current && connected && roomId !== currentRoom) {
      console.log(`🔄 Switching from room ${currentRoom} to ${roomId}`);
      // Join new room
      socketRef.current.emit("join-room", roomId);
      // Clear canvas for new room
      clearCanvas(false);
    }
  }, [roomId, connected, currentRoom]);
  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    // Set canvas size
    canvas.width = 800;
    canvas.height = 600;
    // Clear with white background
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    // Set default drawing styles
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = color;
    context.lineWidth = brushSize;
    console.log("🎨 Canvas initialized");
  }, []);
  // Update drawing style when color/size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.strokeStyle = color;
    context.lineWidth = brushSize;
  }, [color, brushSize]);
  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };
  const drawLine = (x, y, drawColor, drawSize, emit = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    // Save current style
    const currentStyle = context.strokeStyle;
    const currentWidth = context.lineWidth;
    // Apply drawing style
    context.strokeStyle = drawColor || color;
    context.lineWidth = drawSize || brushSize;
    // Draw the line
    context.lineTo(x, y);
    context.stroke();
    // Restore original style
    context.strokeStyle = currentStyle;
    context.lineWidth = currentWidth;
    // Send to server if emitting
    if (emit && socketRef.current && connected) {
      socketRef.current.emit("drawing", {
        x,
        y,
        color: drawColor || color,
        size: drawSize || brushSize,
        roomId: currentRoom
      });
    }
  };
  const startDrawing = (e) => {
    if (!connected) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const { x, y } = getCanvasCoordinates(e);
    setIsDrawing(true);
    setLastPoint({ x, y });
    // Start new path
    context.beginPath();
    context.moveTo(x, y);
  };
  const draw = (e) => {
    if (!isDrawing || !connected) return;
    const { x, y } = getCanvasCoordinates(e);
    if (lastPoint) {
      drawLine(x, y, color, brushSize, true);
      setLastPoint({ x, y });
    }
  };
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
      console.log(`🧹 Cleared canvas in room: ${currentRoom}`);
    }
  };
  const joinRoom = () => {
    if (socketRef.current && connected && roomId !== currentRoom) {
      console.log(`🚪 Manually joining room: ${roomId}`);
      // Join new room
      socketRef.current.emit("join-room", roomId);
      // Clear canvas for new room
      clearCanvas(false);
    }
  };
  return (
    <div className="whiteboard-container">
      <div className="connection-status">
        <h1>Collaborative Whiteboard</h1>
        <h2 style={{ color: connected ? "lightgreen" : "red" }}>
          {connected ? "✅ CONNECTED" : "❌ DISCONNECTED"}
        </h2>
        <div style={{ 
          backgroundColor: "#222", 
          padding: "10px", 
          borderRadius: "5px",
          margin: "10px 0",
          textAlign: "center"
        }}>
          <p style={{ color: "white", margin: "5px 0" }}>
            Current Room: <strong style={{ color: "lightgreen" }}>{currentRoom}</strong>
          </p>
          {socketRef.current && socketRef.current.id && (
            <p style={{ color: "lightgray", margin: "5px 0", fontSize: "0.9em" }}>
              Socket: {socketRef.current.id.substring(0, 8)}...
            </p>
          )}
        </div>
      </div>
      <div className="toolbar">
        <div className="tool-group">
          <label>Color: </label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            disabled={!connected}
          />
        </div>
        <div className="tool-group">
          <label>Brush Size: {brushSize}px</label>
          <input
            type="range"
            min="1"
            max="50"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            disabled={!connected}
          />
        </div>
        <div className="tool-group">
          <button 
            onClick={() => clearCanvas(true)} 
            className="clear-btn"
            disabled={!connected}
          >
            Clear Canvas
          </button>
        </div>
        <div className="tool-group" style={{ flexDirection: "column", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Enter room name"
              style={{ 
                padding: "8px 12px", 
                width: "150px",
                borderRadius: "5px",
                border: "1px solid #ccc"
              }}
              disabled={!connected}
            />
            <button 
              onClick={joinRoom}
              className="room-btn"
              disabled={!connected || roomId === currentRoom}
              style={{ 
                backgroundColor: roomId === currentRoom ? "#666" : "#2ecc71",
                cursor: roomId === currentRoom ? "default" : "pointer"
              }}
            >
              {roomId === currentRoom ? "✓ In Room" : "Switch Room"}
            </button>
          </div>
          <p style={{ 
            color: "lightgray", 
            fontSize: "0.8em", 
            marginTop: "5px",
            fontStyle: roomId !== currentRoom ? "normal" : "italic"
          }}>
            {roomId !== currentRoom 
              ? `Click "Switch Room" to join "${roomId}"` 
              : `You are currently in "${currentRoom}"`}
          </p>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className="whiteboard-canvas"
        style={{ cursor: connected ? "crosshair" : "not-allowed" }}
        title={connected ? "Click and drag to draw" : "Connect to server first"}
      />
      <div className="instructions">
        <p style={{ color: "white", textAlign: "center", marginTop: "20px" }}>
          {connected ? "🖱️ Click and drag to draw | 👥 Share Room ID to collaborate" : "⚠️ Connect to server to start drawing"}
        </p>
        <p style={{ color: "lightgray", textAlign: "center", fontSize: "0.9em" }}>
          Current Room: <strong>{currentRoom}</strong> • Drawings are only shared within the same room
        </p>
      </div>
    </div>
  );
};
export default Whiteboard;
