import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./hooks/useTheme";
import "./App.css";

// Apply saved UI scale on launch
const savedScale = localStorage.getItem("wb_ui_scale");
if (savedScale) {
  const scale = Number(savedScale);
  if (!isNaN(scale) && scale >= 70 && scale <= 160) {
    document.documentElement.style.fontSize = `${(scale / 100) * 16}px`;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
