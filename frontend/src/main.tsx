import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker for PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const dispatchUpdateAvailable = (registration: ServiceWorkerRegistration) => {
      const waitingWorker = registration.waiting;
      const activeController = navigator.serviceWorker.controller;

      if (!waitingWorker || !activeController) return;
      if (waitingWorker.scriptURL === activeController.scriptURL) return;

      window.dispatchEvent(new CustomEvent("sw-update-available", { detail: { registration } }));
    };

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      dispatchUpdateAvailable(registration);

      // Check for updates periodically (every 30 min)
      setInterval(() => registration.update(), 30 * 60 * 1000);

      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          // New SW installed & there's already an active one → update available
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            dispatchUpdateAvailable(registration);
          }
        });
      });
    }).catch(() => {});
  });
}
