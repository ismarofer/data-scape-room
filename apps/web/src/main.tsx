import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Facilitator } from "./Facilitator";
import "./styles.css";
import "./ui-guided.css";
import { applyTheme, currentTheme } from "./theme";

applyTheme(currentTheme());

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {location.pathname.startsWith("/facilitador") ? <Facilitator /> : <App />}
  </React.StrictMode>,
);
