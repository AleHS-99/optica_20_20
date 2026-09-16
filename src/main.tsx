import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import App from "./App";
import "./App.css";

function Root() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // 1) Listener por si el evento llega (vía rápida)
    const unlistenReady = listen("backend-ready", () => {
      if (!cancelled) setReady(true);
    });
    const unlistenError = listen<string>("backend-error", (e) => {
      if (!cancelled) setError(e.payload);
    });

    // 2) Polling como red de seguridad (por si el evento se perdió)
    const poll = async () => {
      for (let i = 0; i < 100 && !cancelled; i++) {   // 100 intentos × 100ms = 10s máximo
        try {
          const ok = await invoke<boolean>("is_backend_ready");
          if (ok) {
            if (!cancelled) setReady(true);
            return;
          }
        } catch (e) {
          // aún no estamos ready, seguimos intentando
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      if (!cancelled) {
        setError("El backend no respondió en 10 segundos. Revisa los logs.");
      }
    };
    poll();

    return () => {
      cancelled = true;
      unlistenReady.then((f) => f());
      unlistenError.then((f) => f());
    };
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50">
        <div className="text-center p-8">
          <h1 className="text-xl font-bold text-red-700">Error al inicializar</h1>
          <p className="text-red-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-sm">Iniciando sistema...</p>
        </div>
      </div>
    );
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);