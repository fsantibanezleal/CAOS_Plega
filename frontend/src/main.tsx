import { createRoot } from "react-dom/client";
import App from "./App";
import KineticStudio from "./KineticStudio";
import OrigamiAtlas from "./origami/OrigamiAtlas";
import "./style.css";

const params = new URLSearchParams(window.location.search);
const legacy = params.get("legacy") === "1";
const mechanism = params.get("mechanism") === "1";
createRoot(document.getElementById("root")!).render(
  legacy ? <App /> : mechanism ? <KineticStudio /> : <OrigamiAtlas />,
);
