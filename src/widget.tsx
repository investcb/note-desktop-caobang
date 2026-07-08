import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WidgetView } from "./WidgetView";
import "./index.css";

createRoot(document.getElementById("widget-root")!).render(
  <StrictMode>
    <WidgetView />
  </StrictMode>
);
