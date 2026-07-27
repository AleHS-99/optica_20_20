// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import NuevaConsulta from "./components/NuevaConsulta";
import Pacientes from "./components/Pacientes";
import Historico from "./components/Historico";
import CambiarPassword from "./components/CambiarPassword";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública: Login (SIN sidebar) */}
        <Route path="/" element={<Login />} />

        {/* Rutas protegidas: CON sidebar (Layout) */}
        <Route path="/app" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="consulta" element={<NuevaConsulta />} />
          <Route path="pacientes" element={<Pacientes />} />
          <Route path="historico" element={<Historico />} />
          <Route path="password" element={<CambiarPassword />} />
        </Route>

        {/* Redirección por defecto para rutas desconocidas */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
