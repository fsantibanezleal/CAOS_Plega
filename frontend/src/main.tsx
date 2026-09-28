import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import GuideApp from "./guide/GuideApp";
import "./style.css";

const App = lazy(() => import("./App"));
const KineticStudio = lazy(() => import("./KineticStudio"));
const OrigamiAtlas = lazy(() => import("./origami/OrigamiAtlas"));

const params = new URLSearchParams(window.location.search);
const legacy = params.get("legacy") === "1";
const mechanism = params.get("mechanism") === "1";
const sections = params.get("sections") === "1";
createRoot(document.getElementById("root")!).render(
  <Suspense
    fallback={
      <div className="route-loading" role="status">
        PLEGA
      </div>
    }
  >
    {legacy ? (
      <App />
    ) : mechanism ? (
      <KineticStudio />
    ) : sections ? (
      <OrigamiAtlas />
    ) : (
      <GuideApp />
    )}
  </Suspense>,
);
