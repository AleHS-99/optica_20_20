// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import NuevaConsulta from "./components/NuevaConsulta";
import Pacientes from "./components/Pacientes";
import Historico from "./components/Historico";
import CambiarPassword from "./components/CambiarPassword";
import BackupRestore from "./components/BackupRestore";
import Productos from "./components/inventario/Productos";
import Categorias from "./components/inventario/Categorias";
import Proveedores from "./components/inventario/Proveedores";
import EntradasInventario from "./components/inventario/EntradasInventario";
import AjustesInventario from "./components/inventario/AjustesInventario";
import StockGeneral from "./components/inventario/StockGeneral";

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
          <Route path="backup" element={<BackupRestore />} />
          <Route path="inventario/productos" element={<Productos />} />
          <Route path="inventario/categorias" element={<Categorias />} />
          <Route path="inventario/proveedores" element={<Proveedores />} />
          <Route path="inventario/entradas" element={<EntradasInventario />} />
          <Route path="inventario/ajustes" element={<AjustesInventario />} />
          <Route path="inventario/stock" element={<StockGeneral />} />
        </Route>

        {/* Redirección por defecto para rutas desconocidas */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
