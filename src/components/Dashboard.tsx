// src/components/Dashboard.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import {
  Users, FileText, Calendar, UserCheck,
  Stethoscope, Package, BarChart3, Loader2,
  Clock, ArrowRight
} from "lucide-react";

interface Stats {
  total_pacientes: number;
  total_consultas: number;
  consultas_hoy: number;
  pacientes_hoy: number;
  ultimas_consultas: {
    id: number;
    hora: string;
    paciente: string;
    ci: string;
    refraccion: string;
    add: string;
  }[];
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarStats();
  }, []);

  const cargarStats = async () => {
    try {
      const data: any = await invoke("obtener_estadisticas_dashboard");
      setStats(data);
    } catch (error: any) {
      Swal.fire("Error", error.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-600 text-sm">
          Resumen del día · {new Date().toLocaleDateString("es-CU", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
          })}
        </p>
      </div>

      {/* === TARJETAS DE ESTADÍSTICAS === */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Pacientes totales"
          value={stats?.total_pacientes || 0}
          color="blue"
        />
        <StatCard
          icon={FileText}
          label="Consultas totales"
          value={stats?.total_consultas || 0}
          color="purple"
        />
        <StatCard
          icon={Calendar}
          label="Consultas hoy"
          value={stats?.consultas_hoy || 0}
          color="green"
          highlight
        />
        <StatCard
          icon={UserCheck}
          label="Pacientes hoy"
          value={stats?.pacientes_hoy || 0}
          color="amber"
          highlight
        />
      </div>

      {/* === ACCESOS RÁPIDOS === */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAccess
          icon={Stethoscope}
          title="Nueva Consulta"
          description="Registrar consulta de paciente"
          color="blue"
          onClick={() => navigate("/app/consulta")}
        />
        <QuickAccess
          icon={Users}
          title="Pacientes"
          description="Ver y gestionar pacientes"
          color="emerald"
          onClick={() => navigate("/app/pacientes")}
        />
        <QuickAccess
          icon={FileText}
          title="Histórico"
          description="Consultas anteriores"
          color="indigo"
          onClick={() => navigate("/app/historico")}
        />
      </div>

      {/* === CONTENIDO PRINCIPAL (2 columnas) === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Últimas consultas del día (ocupa 2 columnas) */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Consultas de hoy
            </h2>
            {stats && stats.consultas_hoy > 5 && (
              <button
                onClick={() => navigate("/app/historico")}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Ver todas <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {stats && stats.ultimas_consultas.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {stats.ultimas_consultas.map((c) => (
                <div
                  key={c.id}
                  className="p-4 hover:bg-gray-50 transition flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold flex-shrink-0">
                      {c.paciente.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-800 truncate">{c.paciente}</p>
                      <p className="text-xs text-gray-500">CI: {c.ci}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-gray-700">{c.refraccion || "-"}</p>
                    <p className="text-xs text-gray-500">{c.hora}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>No hay consultas registradas hoy</p>
            </div>
          )}
        </div>

        {/* === ESPACIO RESERVADO PARA FUTUROS MÓDULOS === */}
        <div className="space-y-4">
          <FutureModuleCard
            icon={Package}
            title="Inventario"
            description="Gestión de productos y stock"
          />
          <FutureModuleCard
            icon={BarChart3}
            title="Reportes"
            description="Estadísticas y análisis"
          />
        </div>
      </div>
    </div>
  );
}

// === COMPONENTES AUXILIARES ===

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  highlight = false
}: {
  icon: any;
  label: string;
  value: number;
  color: "blue" | "purple" | "green" | "amber";
  highlight?: boolean;
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    purple: "bg-purple-50 text-purple-600 border-purple-200",
    green: "bg-green-50 text-green-600 border-green-200",
    amber: "bg-amber-50 text-amber-600 border-amber-200"
  };

  return (
    <div className={`p-5 rounded-lg border-2 ${colors[color]} ${highlight ? "ring-2 ring-offset-1 ring-current/20" : ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide opacity-75">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="w-10 h-10 opacity-50" />
      </div>
    </div>
  );
}

function QuickAccess({
  icon: Icon,
  title,
  description,
  color,
  onClick
}: {
  icon: any;
  title: string;
  description: string;
  color: "blue" | "emerald" | "indigo";
  onClick: () => void;
}) {
  const colors = {
    blue: "bg-blue-600 hover:bg-blue-700",
    emerald: "bg-emerald-600 hover:bg-emerald-700",
    indigo: "bg-indigo-600 hover:bg-indigo-700"
  };

  return (
    <button
      onClick={onClick}
      className={`${colors[color]} text-white p-5 rounded-lg shadow-sm transition transform hover:scale-[1.02] hover:shadow-md text-left`}
    >
      <Icon className="w-8 h-8 mb-2" />
      <h3 className="font-semibold text-lg">{title}</h3>
      <p className="text-sm opacity-90">{description}</p>
    </button>
  );
}

function FutureModuleCard({
  icon: Icon,
  title,
  description
}: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-5 relative overflow-hidden">
      <div className="absolute top-2 right-2">
        <span className="text-xs bg-gray-300 text-gray-600 px-2 py-0.5 rounded-full font-medium">
          Próximamente
        </span>
      </div>
      <Icon className="w-8 h-8 text-gray-400 mb-2" />
      <h3 className="font-semibold text-gray-600">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
  );
}
