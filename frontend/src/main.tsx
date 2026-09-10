import { createRoot } from "react-dom/client";
import App from "./App";
import KineticStudio from "./KineticStudio";
import "./style.css";

const legacy =
  new URLSearchParams(window.location.search).get("legacy") === "1";
createRoot(document.getElementById("root")!).render(
  legacy ? <App /> : <KineticStudio />,
);
