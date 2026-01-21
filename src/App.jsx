import React from "react";
function App() {
  return React.createElement("div", {
    style: {
      padding: "50px",
      textAlign: "center",
      backgroundColor: "darkblue",
      color: "white",
      minHeight: "100vh"
    }
  }, 
    React.createElement("h1", null, "✅ Vite Test Page"),
    React.createElement("p", null, "If you can see this, Vite is running!"),
    React.createElement("button", {
      onClick: () => alert("Vite is working!"),
      style: { padding: "10px 20px", margin: "20px" }
    }, "Test Button")
  );
}
export default App;
