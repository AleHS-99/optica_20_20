import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign,
  Calendar, Loader2, RefreshCw, Package, AlertCircle
} from "lucide-react";

interface EstadoResultados {
  periodo: { desde: string; hasta: string };
  ventas_totales: number;
  costo_ventas: number;
  utilidad_bruta: number;
  gastos_operativos: number;
  gastos_por_categoria: { categoria: string; total: number }[];
  utilidad_operativa: number;
  gastos_financieros: number;
  utilidad_antes_impuestos: number;
  impuestos: number;
  utilidad_neta: number;
}

interface StatsFinancieras {
  ventas_mes: number;
  gastos_mes: number;
  utilidad_mes: number;
  facturas_pendientes: number;
  por_cobrar: number;
  valor_inventario: number;
}

export default function EstadoResultados() {
  const [estado, setEstado] = useState<EstadoResultados | null>(null);
  const [stats, setStats] = useState<StatsFinancieras | null>(null);
  const [loading, setLoading] = useState(true);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [estadoData, statsData]: any = await Promise.all([
        invoke("obtener_estado_resultados", {
          fechaDesde: fechaDesde || null,
          fechaHasta: fechaHasta || null
        }),
        invoke("obtener_stats_financieras")
      ]);
      setEstado(estadoData);
      setStats(statsData);
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltro = () => {
    cargarDatos();
  };

  const limpiarFiltro = () => {
    setFechaDesde("");
    setFechaHasta("");
    cargarDatos();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!estado || !stats) {
    return <div className="text-center py-12 text-gray-500">Error cargando datos</div>;
  }

  const formatMoney = (value: any) => {
  const num = Number(value);
  return `$${(isNaN(num) ? 0 : num).toFixed(2)}`;
};

const formatPercent = (value: any, total: any) => {
  const v = Number(value);
  const t = Number(total);
  if (isNaN(v) || isNaN(t) || t === 0) return "0%";
  return `${((v / t) * 100).toFixed(1)}%`;
};

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          Estado de Resultados
        </h1>
        <button
          onClick={cargarDatos}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {/* Filtro de fechas */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
          <Calendar className="w-4 h-4" />
          <span className="font-medium">Periodo:</span>
          <span className="text-gray-500">
            {new Date(estado.periodo.desde).toLocaleDateString("es-CU")} -{" "}
            {new Date(estado.periodo.hasta).toLocaleDateString("es-CU")}
          </span>
        </div>
        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <button
            onClick={aplicarFiltro}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Aplicar
          </button>
          <button
            onClick={limpiarFiltro}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Mes actual
          </button>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700">Ventas del mes</p>
              <p className="text-2xl font-bold text-green-900">{formatMoney(stats.ventas_mes)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700">Gastos del mes</p>
              <p className="text-2xl font-bold text-red-900">{formatMoney(stats.gastos_mes)}</p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-600 opacity-50" />
          </div>
        </div>
        <div className={`bg-gradient-to-br ${stats.utilidad_mes >= 0 ? "from-blue-50 to-blue-100 border-blue-200" : "from-orange-50 to-orange-100 border-orange-200"} border rounded-lg p-4`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm ${stats.utilidad_mes >= 0 ? "text-blue-700" : "text-orange-700"}`}>
                Utilidad del mes
              </p>
              <p className={`text-2xl font-bold ${stats.utilidad_mes >= 0 ? "text-blue-900" : "text-orange-900"}`}>
                {formatMoney(stats.utilidad_mes)}
              </p>
            </div>
            <DollarSign className={`w-8 h-8 ${stats.utilidad_mes >= 0 ? "text-blue-600" : "text-orange-600"} opacity-50`} />
          </div>
        </div>
      </div>

      {/* Estado de Resultados detallado */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-semibold text-gray-800">Estado de Resultados Detallado</h2>
        </div>
        <div className="p-6 space-y-4">
          {/* Ventas */}
          <div className="flex justify-between items-center pb-3 border-b">
            <span className="font-medium text-gray-700">Ventas Totales</span>
            <span className="text-xl font-bold text-green-700">{formatMoney(estado.ventas_totales)}</span>
          </div>

          {/* Costo de ventas */}
          <div className="flex justify-between items-center pb-3 border-b">
            <span className="text-gray-600">(-) Costo de Ventas</span>
            <span className="text-lg font-semibold text-red-600">{formatMoney(estado.costo_ventas)}</span>
          </div>

          {/* Utilidad Bruta */}
          <div className="flex justify-between items-center pb-3 border-b-2 border-blue-300 bg-blue-50 -mx-6 px-6 py-3">
            <span className="font-bold text-blue-900">= UTILIDAD BRUTA</span>
            <div className="text-right">
              <span className="text-xl font-bold text-blue-700">{formatMoney(estado.utilidad_bruta)}</span>
              <span className="text-xs text-blue-600 ml-2">
                ({formatPercent(estado.utilidad_bruta, estado.ventas_totales)})
              </span>
            </div>
          </div>

          {/* Gastos operativos */}
          <div className="pl-4 space-y-2">
            <p className="text-sm text-gray-600 font-medium">Gastos Operativos:</p>
            {estado.gastos_por_categoria.map((g, i) => (
              <div key={i} className="flex justify-between items-center text-sm pl-4">
                <span className="text-gray-600">{g.categoria}</span>
                <span className="text-red-600">{formatMoney(g.total)}</span>
              </div>
            ))}
            {estado.gastos_por_categoria.length === 0 && (
              <p className="text-sm text-gray-400 italic pl-4">Sin gastos registrados</p>
            )}
          </div>

          <div className="flex justify-between items-center pb-3 border-b">
            <span className="text-gray-600">(-) Total Gastos Operativos</span>
            <span className="text-lg font-semibold text-red-600">{formatMoney(estado.gastos_operativos)}</span>
          </div>

          {/* Utilidad Operativa */}
          <div className="flex justify-between items-center pb-3 border-b-2 border-blue-300 bg-blue-50 -mx-6 px-6 py-3">
            <span className="font-bold text-blue-900">= UTILIDAD OPERATIVA</span>
            <div className="text-right">
              <span className="text-xl font-bold text-blue-700">{formatMoney(estado.utilidad_operativa)}</span>
              <span className="text-xs text-blue-600 ml-2">
                ({formatPercent(estado.utilidad_operativa, estado.ventas_totales)})
              </span>
            </div>
          </div>

          {/* Gastos financieros */}
          <div className="flex justify-between items-center pb-3 border-b">
            <span className="text-gray-600">(-) Gastos Financieros</span>
            <span className="text-lg font-semibold text-red-600">{formatMoney(estado.gastos_financieros)}</span>
          </div>

          {/* Utilidad antes de impuestos */}
          <div className="flex justify-between items-center pb-3 border-b-2 border-blue-300 bg-blue-50 -mx-6 px-6 py-3">
            <span className="font-bold text-blue-900">= UTILIDAD ANTES DE IMPUESTOS</span>
            <div className="text-right">
              <span className="text-xl font-bold text-blue-700">{formatMoney(estado.utilidad_antes_impuestos)}</span>
              <span className="text-xs text-blue-600 ml-2">
                ({formatPercent(estado.utilidad_antes_impuestos, estado.ventas_totales)})
              </span>
            </div>
          </div>

          {/* Impuestos */}
          <div className="flex justify-between items-center pb-3 border-b">
            <span className="text-gray-600">(-) Impuestos</span>
            <span className="text-lg font-semibold text-red-600">{formatMoney(estado.impuestos)}</span>
          </div>

          {/* Utilidad Neta */}
          <div className={`flex justify-between items-center pt-3 border-t-4 ${estado.utilidad_neta >= 0 ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"} -mx-6 px-6 py-4`}>
            <span className={`font-bold text-2xl ${estado.utilidad_neta >= 0 ? "text-green-900" : "text-red-900"}`}>
              = UTILIDAD NETA
            </span>
            <div className="text-right">
              <span className={`text-3xl font-bold ${estado.utilidad_neta >= 0 ? "text-green-700" : "text-red-700"}`}>
                {formatMoney(estado.utilidad_neta)}
              </span>
              <span className={`text-sm ml-2 ${estado.utilidad_neta >= 0 ? "text-green-600" : "text-red-600"}`}>
                ({formatPercent(estado.utilidad_neta, estado.ventas_totales)})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Información adicional */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            Cuentas por Cobrar
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Facturas pendientes:</span>
              <span className="font-semibold">{stats.facturas_pendientes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total por cobrar:</span>
              <span className="font-bold text-amber-700">{formatMoney(stats.por_cobrar)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Valor del Inventario
          </h3>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Valor total actual:</span>
            <span className="text-2xl font-bold text-blue-700">{formatMoney(stats.valor_inventario)}</span>
          </div>
        </div>
      </div>

      {/* Nota informativa */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Nota:</strong> Este reporte muestra datos en tiempo real del periodo seleccionado.
          Los impuestos se calcularán automáticamente al realizar el cierre contable mensual.
        </p>
      </div>
    </div>
  );
}