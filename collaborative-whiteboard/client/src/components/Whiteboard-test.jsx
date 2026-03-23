import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./Whiteboard.css";
const Whiteboard = () => {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState("default-room");
  const [currentRoom, setCurrentRoom] = useState("");
  // Initialize socket connection
  useEffect(() => {
    console.log("Setting up socket...");
    const socket = io("http://127.0.0.1:3000", {
      transports: ["polling"]
    });
    socket.on("connect", () => {
      console.log("✅ Connected! ID:", socket.id);
      setConnected(true);
      socket.emit("join-room", roomId);
    });
    socket.on("room-joined", (data) => {
      console.log("Joined room:", data.room);
      setCurrentRoom(data.room);
    });
    socket.on("connect_error", (err) => {
      console.log("Connection error:", err.message);
    });
    socket.on("drawing", (data) => {
      console.log("📨 Received drawing:", data);
      // Draw a test dot
      const canvas = canvasRef.current;
      if (canvas) {
        const context = canvas.getContext("2d");
        context.fillStyle = data.color || "red";
        context.beginPath();
        context.arc(data.x, data.y, data.size || 5, 0, Math.PI * 2);
        context.fill();
      }
    });
    socketRef.current = socket;
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);
  const joinRoom = () => {
    if (socketRef.current && connected && roomId !== currentRoom) {
      socketRef.current.emit("join-room", roomId);
    }
  };
  const sendTestDrawing = () => {
    if (socketRef.current && connected) {
      console.log("Sending test drawing...");
      socketRef.current.emit("drawing", {
        x: 100,
        y: 100,
        color: "#ff0000",
        size: 10,
        roomId: currentRoom
      });
    }
  };
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (socketRef.current && connected && currentRoom) {
      socketRef.current.emit("clear-board", { roomId: currentRoom });
    }
  };
  return (
    <div style={{ padding: "20px", backgroundColor: "#333", color: "white", minHeight: "100vh", textAlign: "center" }}>
      <h1>Whiteboard Drawing Test</h1>
      <h2 style={{ color: connected ? "lightgreen" : "red" }}>
        {connected ? "✅ CONNECTED" : "❌ DISCONNECTED"}
      </h2>
      <div style={{ margin: "20px" }}>
        <input
          type="text"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Room name"
          style={{ padding: "10px", marginRight: "10px" }}
        />
        <button 
          onClick={joinRoom}
          style={{ padding: "10px 20px", backgroundColor: "#2ecc71", color: "white", border: "none", borderRadius: "5px", marginRight: "10px" }}
        >
          Join Room
        </button>
        <button 
          onClick={sendTestDrawing}
          style={{ padding: "10px 20px", backgroundColor: "#3498db", color: "white", border: "none", borderRadius: "5px", marginRight: "10px" }}
        >
          Send Test Drawing
        </button>
        <button 
          onClick={clearCanvas}
          style={{ padding: "10px 20px", backgroundColor: "#e74c3c", color: "white", border: "none", borderRadius: "5px" }}
        >
          Clear Canvas
        </button>
      </div>
      <p>Current Room: <strong>{currentRoom}</strong></p>
      <p>Check server terminal for drawing events when you click "Send Test Drawing"</p>
      <canvas
        ref={canvasRef}
        style={{
          width: "800px",
          height: "600px",
          backgroundColor: "white",
          margin: "20px auto",
          border: "2px solid #666",
          display: "block"
        }}
        width="800"
        height="600"
      />
      <div style={{ marginTop: "30px", color: "#aaa" }}>
        <p>Instructions:</p>
        <ol style={{ textAlign: "left", display: "inline-block" }}>
          <li>Click "Send Test Drawing" - should show in server logs</li>
          <li>Open another tab in same room - should receive drawing</li>
          <li>Test "Clear Canvas" - should clear and send to server</li>
        </ol>
      </div>
    </div>
  );
};
export default Whiteboard;
