import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import {
  Users, FileText, Calendar, UserCheck,
  Stethoscope, Package, Loader2,
  Clock, ArrowRight, AlertTriangle, 
  ShoppingCart, Calculator, LayoutDashboard
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
        <h1 className="text-2xl font-bold text-gray-800">Dashboard General</h1>
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

      {/* === ACCESOS RÁPIDOS (Área Clínica) === */}
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
          description="Directorio y datos clínicos"
          color="emerald"
          onClick={() => navigate("/app/pacientes")}
        />
        <QuickAccess
          icon={FileText}
          title="Histórico Clínico"
          description="Búsqueda de consultas anteriores"
          color="indigo"
          onClick={() => navigate("/app/historico")}
        />
      </div>

      {/* === CONTENIDO PRINCIPAL (2 columnas) === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Últimas consultas del día (ocupa 2 columnas) */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50/50">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Pacientes Atendidos Hoy
            </h2>
            {stats && stats.consultas_hoy > 0 && (
              <button
                onClick={() => navigate("/app/historico")}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
              >
                Ver historial completo <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {stats && stats.ultimas_consultas.length > 0 ? (
            <div className="divide-y divide-gray-100 flex-1 overflow-auto">
              {stats.ultimas_consultas.map((c) => (
                <div
                  key={c.id}
                  className="p-4 hover:bg-blue-50/50 transition flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold flex-shrink-0">
                      {c.paciente.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800 truncate">{c.paciente}</p>
                      <p className="text-xs text-gray-500 font-medium mt-0.5">CI: {c.ci}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Ref: {c.refraccion || "N/A"}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">{c.hora}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center flex-1 flex flex-col justify-center items-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-gray-900 font-medium mb-1">Sin consultas de momento</h3>
              <p className="text-gray-500 text-sm max-w-sm">
                Aún no se han registrado pacientes en el sistema durante el día de hoy.
              </p>
            </div>
          )}
        </div>

        {/* === BARRA LATERAL: INVENTARIO, VENTAS Y ADMINISTRACIÓN === */}
        <div className="space-y-4">
          
          {/* Módulos Administrativos Finalizados */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
              <LayoutDashboard className="w-5 h-5 text-gray-500" />
              Gestión Administrativa
            </h3>
            
            <div className="space-y-3">
              <ActionCard
                icon={ShoppingCart}
                title="Punto de Venta"
                description="Facturación y cobro a pacientes"
                onClick={() => navigate("/app/facturacion/lista")}
                colorClass="text-emerald-600 bg-emerald-50 hover:bg-emerald-600 hover:text-white"
              />
              
              <ActionCard
                icon={Package}
                title="Inventario y Stock"
                description="Armazones, cristales y taller"
                onClick={() => navigate("/app/inventario/stock")}
                colorClass="text-purple-600 bg-purple-50 hover:bg-purple-600 hover:text-white"
              />

              <ActionCard
                icon={Calculator}
                title="Cierre Económico"
                description="Gastos, utilidad y reportes"
                onClick={() => navigate("/app/contabilidad/cierre")}
                colorClass="text-amber-600 bg-amber-50 hover:bg-amber-600 hover:text-white"
              />
            </div>
          </div>

          <StockBajoCard />
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
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200"
  };

  return (
    <div className={`p-5 rounded-xl border ${colors[color]} ${highlight ? "ring-2 ring-offset-2 ring-current/30 shadow-sm" : ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider opacity-80">{label}</p>
          <p className="text-3xl font-black mt-1">{value}</p>
        </div>
        <Icon className="w-10 h-10 opacity-40" strokeWidth={1.5} />
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
    blue: "bg-gradient-to-br from-blue-600 to-blue-700 shadow-blue-600/20",
    emerald: "bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-emerald-600/20",
    indigo: "bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-indigo-600/20"
  };

  return (
    <button
      onClick={onClick}
      className={`${colors[color]} text-white p-5 rounded-xl shadow-lg transition-all duration-200 transform hover:-translate-y-1 hover:shadow-xl text-left border border-white/10 relative overflow-hidden group`}
    >
      <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-300">
        <Icon className="w-24 h-24" />
      </div>
      <div className="relative z-10">
        <Icon className="w-8 h-8 mb-3 text-white/90" />
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="text-sm text-white/80 mt-1 font-medium">{description}</p>
      </div>
    </button>
  );
}

// Nuevo componente que reemplaza a "FutureModuleCard"
function ActionCard({
  icon: Icon,
  title,
  description,
  onClick,
  colorClass
}: {
  icon: any;
  title: string;
  description: string;
  onClick: () => void;
  colorClass: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all rounded-lg p-3 flex items-center gap-4 group"
    >
      <div className={`p-2.5 rounded-lg transition-colors ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-semibold text-gray-800 group-hover:text-black">{title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
    </button>
  );
}

function StockBajoCard() {
  const [productosBajoStock, setProductosBajoStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargarAlertas();
  }, []);

  const cargarAlertas = async () => {
    try {
      const r: any = await invoke("listar_stock_general", {
        soloBajoStock: true,
        page: 1,
        pageSize: 5
      });
      setProductosBajoStock(r.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
      </div>
    );
  }

  if (productosBajoStock.length === 0) {
    return (
       <div className="bg-emerald-50 border-2 border-emerald-100 rounded-lg p-4 flex items-center gap-3">
         <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
           <Package className="w-5 h-5" />
         </div>
         <div>
            <h3 className="font-semibold text-emerald-900">Stock Saludable</h3>
            <p className="text-xs text-emerald-700">No hay productos por debajo del límite.</p>
         </div>
       </div>
    );
  }

  return (
    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
      <h3 className="font-semibold text-red-900 flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5" />
        Alertas de Stock Bajo
      </h3>
      <div className="space-y-2">
        {productosBajoStock.map(p => (
          <div key={p.producto_id} className="flex justify-between items-center text-sm bg-white rounded p-2 shadow-sm border border-red-100">
            <div className="min-w-0 flex-1 pr-2">
              <p className="font-medium text-gray-800 truncate">{p.producto_nombre}</p>
              <p className="text-[11px] text-gray-500">{p.producto_codigo}</p>
            </div>
            <div className="text-right flex-shrink-0 bg-red-50 px-2 py-1 rounded">
              <p className="font-bold text-red-600">{p.stock_actual}</p>
              <p className="text-[10px] text-gray-500 uppercase font-medium tracking-wide">mín: {p.stock_minimo}</p>
            </div>
          </div>
        ))}
      </div>
      <button 
        onClick={() => {}} // Opcional: Navegar a una vista filtrada de stock bajo
        className="w-full text-center text-xs text-red-600 hover:text-red-800 font-semibold mt-3 pt-2 border-t border-red-200"
      >
        Revisar inventario completo
      </button>
    </div>
  );
}
