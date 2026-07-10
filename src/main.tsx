import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Handle navigation requests from the service worker (notification clicks)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data;
    if (data && data.type === 'navigate' && typeof data.url === 'string') {
      try { window.history.pushState({}, '', data.url); window.dispatchEvent(new PopStateEvent('popstate')); }
      catch { window.location.href = data.url; }
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
