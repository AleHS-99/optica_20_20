// src/components/Layout.tsx
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import {
  LayoutDashboard,
  Stethoscope,
  Key,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Database,
  Package,
  Tags,
  Truck  
} from "lucide-react";
import { useState } from "react";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [clinicaOpen, setClinicaOpen] = useState(true); // Desplegado por defecto

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: "¿Cerrar sesión?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, salir",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      await invoke("logout");
      navigate("/");
    }
  };

  // Helper para saber si una ruta está activa
  const isActive = (path: string) => location.pathname === path;
  const [inventarioOpen, setInventarioOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-slate-900 text-white transition-all duration-300 flex flex-col`}
      >
        {/* Logo / Toggle */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          {sidebarOpen && <span className="text-xl font-bold text-blue-400">Óptica 20/20</span>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded hover:bg-slate-700 transition"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Menú de Navegación */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">

          {/* Dashboard */}
          <button
            onClick={() => navigate("/app")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              isActive("/app") ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="font-medium">Dashboard</span>}
          </button>

          {/* Menú Desplegable: Clínica */}
          <div>
            <button
              onClick={() => setClinicaOpen(!clinicaOpen)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                (isActive("/app/consulta") || isActive("/app/pacientes") || isActive("/app/historico"))
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Stethoscope className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">Clínica</span>}
              </div>
              {sidebarOpen && (clinicaOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
            </button>

            {/* Submenú de Clínica */}
            {sidebarOpen && clinicaOpen && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-700 pl-2">
                <button
                  onClick={() => navigate("/app/consulta")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive("/app/consulta") ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  Nueva Consulta
                </button>
                <button
                  onClick={() => navigate("/app/pacientes")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive("/app/pacientes") ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  Pacientes
                </button>
                <button
                  onClick={() => navigate("/app/historico")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive("/app/historico") ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  Histórico
                </button>
              </div>
            )}
          </div>
          <div>
            <button
              onClick={() => setInventarioOpen(!inventarioOpen)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                (location.pathname.startsWith("/app/inventario"))
                  ? "bg-slate-800 text-white" 
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="font-medium">Inventario</span>}
              </div>
              {sidebarOpen && (inventarioOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
            </button>

            {sidebarOpen && inventarioOpen && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-slate-700 pl-2">
                <button
                  onClick={() => navigate("/app/inventario/entradas")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    location.pathname === "/app/inventario/entradas" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  Entradas
                </button>
                <button
                  onClick={() => navigate("/app/inventario/ajustes")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    location.pathname === "/app/inventario/ajustes" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  Ajustes
                </button>
                <button
                  onClick={() => navigate("/app/inventario/stock")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    location.pathname === "/app/inventario/stock" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  Stock General
                </button>
                <button
                  onClick={() => navigate("/app/inventario/productos")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    location.pathname === "/app/inventario/productos" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  Productos
                </button>
                <button
                  onClick={() => navigate("/app/inventario/categorias")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    location.pathname === "/app/inventario/categorias" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  Categorías
                </button>
                <button
                  onClick={() => navigate("/app/inventario/proveedores")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    location.pathname === "/app/inventario/proveedores" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  Proveedores
                </button>
              </div>
            )}
          </div>
          {/* Backup Restore */}
          <button
            onClick={() => navigate("/app/backup")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              isActive("/app/backup") ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Database className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="font-medium">Base de Datos</span>}
          </button>

          {/* Cambiar Contraseña */}
          <button
            onClick={() => navigate("/app/password")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              isActive("/app/password") ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Key className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="font-medium">Cambiar Contraseña</span>}
          </button>
        </nav>

        {/* Botón de Cerrar Sesión */}
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="font-medium">Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
