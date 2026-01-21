import React from "react"
import ReactDOM from "react-dom/client"
import Whiteboard from "./components/Whiteboard-simple.jsx"
import "./index.css"
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Whiteboard />
  </React.StrictMode>
)
console.log("✅ Whiteboard app started!")
