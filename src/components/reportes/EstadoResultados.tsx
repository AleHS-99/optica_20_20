import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import { FileText, TrendingUp, TrendingDown, AlertTriangle, Info, ChevronLeft, ChevronRight } from "lucide-react";

interface DatosPeriodo {
  ventas_totales: number;
  costo_ventas: number;
  utilidad_bruta: number;
  gastos_operativos_fijos: number;
  gastos_operativos_variables: number;
  utilidad_operativa: number;
  gastos_financieros: number;
  utilidad_antes_impuestos: number;
  impuesto_porcentaje: number;
  monto_impuesto: number;
  utilidad_neta: number;
  es_impuesto_estimado: boolean;
}

interface ReporteData {
  actual: DatosPeriodo;
  anterior: DatosPeriodo;
  anio_anterior: DatosPeriodo;
  total_fijos_plantilla: number;
  incluir_fijos_plantilla: boolean;
}

export default function EstadoResultados() {
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [incluirFijos, setIncluirFijos] = useState(false);
  const [data, setData] = useState<ReporteData | null>(null);
  const [loading, setLoading] = useState(false);

  // ✅ Detectar si el periodo seleccionado es el mes actual
  const mesActual = new Date().toISOString().slice(0, 7);
  const esMesActual = periodo === mesActual;

  useEffect(() => {
    cargarReporte();
  }, [periodo, incluirFijos]);

  // ✅ Si el usuario cambia a un mes anterior, desactivar el checkbox automáticamente
  useEffect(() => {
    if (!esMesActual) {
      setIncluirFijos(false);
    }
  }, [periodo, esMesActual]);

  const cambiarMes = (delta: number) => {
    const [anio, mes] = periodo.split('-').map(Number);
    const fecha = new Date(anio, mes - 1 + delta, 1);
    const nuevoPeriodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    setPeriodo(nuevoPeriodo);
  };

  const cargarReporte = async () => {
    setLoading(true);
    try {
      // ✅ Solo enviar el parámetro si es el mes actual
      const response: any = await invoke("calcular_estado_resultados", {
        periodo,
        incluirFijosPlantilla: esMesActual ? incluirFijos : false
      });
      setData(response);
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  const Variacion = ({ actual, anterior }: { actual: number; anterior: number }) => {
    if (anterior === 0) return <span className="text-gray-400 text-xs">N/A</span>;
    const diff = actual - anterior;
    const pct = (diff / Math.abs(anterior)) * 100;
    const isPositive = diff >= 0;
    return (
      <div className="text-right">
        <div className={`text-xs font-semibold flex items-center justify-end gap-1 ${isPositive ? "text-green-600" : "text-red-600"}`}>
          {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {pct.toFixed(1)}%
        </div>
        <div className="text-xs text-gray-500">${Math.abs(diff).toFixed(2)}</div>
      </div>
    );
  };

  const Fila = ({ label, actual, anterior, esNegrita = false, esSubtotal = false }: any) => (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className={`px-4 py-3 text-left ${esNegrita ? "font-bold text-gray-900" : "text-gray-700"} ${esSubtotal ? "pl-8" : ""}`}>
        {label}
      </td>
      <td className={`px-4 py-3 text-right font-mono ${esNegrita ? "font-bold text-gray-900" : "text-gray-700"}`}>
        ${actual.toFixed(2)}
      </td>
      <td className="px-4 py-3 text-right font-mono text-gray-500">
        ${anterior.toFixed(2)}
      </td>
      <td className="px-4 py-3">
        <Variacion actual={actual} anterior={anterior} />
      </td>
    </tr>
  );

  if (loading) {
    return <div className="flex justify-center items-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  if (!data) return null;

  const { actual, anterior } = data;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" /> Estado de Resultados
        </h1>
        <div className="flex items-center gap-2">
        <button
          onClick={() => cambiarMes(-1)}
          className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          title="Mes anterior"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <input
          type="month"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <button
          onClick={() => cambiarMes(1)}
          className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          title="Mes siguiente"
        >
          <ChevronRight className="w-5 h-5 text-gray-700" />
        </button>
      </div>
      </div>

      {/* ✅ NUEVO: Panel inteligente de gastos fijos */}
      {esMesActual ? (
        // CASO 1: Mes actual (abierto) → Mostrar checkbox funcional
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={incluirFijos}
              onChange={(e) => setIncluirFijos(e.target.checked)}
              className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1">
              <p className="font-semibold text-blue-900">
                Incluir gastos fijos de la plantilla
              </p>
              <p className="text-sm text-blue-700 mt-1">
                {data.total_fijos_plantilla > 0 ? (
                  <>
                    Se sumarán <strong>${data.total_fijos_plantilla.toFixed(2)}</strong> en gastos fijos operativos 
                    (alquiler, salarios, etc. definidos en la plantilla).
                  </>
                ) : (
                  <>No hay gastos fijos activos en la plantilla. Ve a <strong>Contabilidad &gt; Gastos Fijos</strong> para definirlos.</>
                )}
              </p>
              <p className="text-xs text-blue-600 mt-2 italic">
                💡 Los gastos fijos se incluirán automáticamente al cerrar el mes. 
                Este checkbox es solo para previsualizar el estado de resultados antes del cierre.
              </p>
            </div>
          </label>
        </div>
      ) : (
        // CASO 2: Mes anterior (cerrado) → Mostrar mensaje informativo
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 flex gap-3">
          <Info className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-800">
            <p className="font-semibold">Periodo anterior analizado</p>
            <p className="mt-1">
              Los gastos fijos de este periodo <strong>ya están incluidos</strong> en los registros contables. 
              No es necesario aplicar la plantilla nuevamente.
            </p>
            <p className="text-xs text-green-700 mt-2 italic">
              💡 Al cerrar un mes, los gastos fijos activos de la plantilla se registran automáticamente.
            </p>
          </div>
        </div>
      )}

      {actual.es_impuesto_estimado && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Impuesto Estimado Aplicado</p>
            <p>No hay impuestos configurados. Se utiliza una tasa estimada del {actual.impuesto_porcentaje}%.</p>
          </div>
        </div>
      )}

      {/* ✅ CORREGIDO: Tabla con estructura completa para alineación perfecta */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Concepto
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Periodo Actual
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Mes Anterior
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Variación
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <Fila label="Ventas Totales" actual={actual.ventas_totales} anterior={anterior.ventas_totales} esNegrita />
            <Fila label="Costo de Ventas (PEPS)" actual={actual.costo_ventas} anterior={anterior.costo_ventas} esSubtotal />
            <Fila label="UTILIDAD BRUTA" actual={actual.utilidad_bruta} anterior={anterior.utilidad_bruta} esNegrita />
            
            <tr className="bg-gray-50/50">
              <td colSpan={4} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                Gastos Operativos
              </td>
            </tr>
            <Fila 
              label={`Gastos Fijos${esMesActual && incluirFijos ? ' (incluye plantilla)' : ' (registrados)'}`} 
              actual={actual.gastos_operativos_fijos} 
              anterior={anterior.gastos_operativos_fijos} 
              esSubtotal 
            />
            <Fila label="Gastos Variables" actual={actual.gastos_operativos_variables} anterior={anterior.gastos_operativos_variables} esSubtotal />
            
            <Fila label="UTILIDAD OPERATIVA (EBIT)" actual={actual.utilidad_operativa} anterior={anterior.utilidad_operativa} esNegrita />
            
            <tr className="bg-gray-50/50">
              <td colSpan={4} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                Gastos No Operativos
              </td>
            </tr>
            <Fila label="Gastos Financieros" actual={actual.gastos_financieros} anterior={anterior.gastos_financieros} esSubtotal />
            
            <Fila label="UTILIDAD ANTES DE IMPUESTOS (EBT)" actual={actual.utilidad_antes_impuestos} anterior={anterior.utilidad_antes_impuestos} esNegrita />
            <Fila label={`Impuestos (${actual.impuesto_porcentaje}%)${actual.es_impuesto_estimado ? ' *Estimado' : ''}`} actual={actual.monto_impuesto} anterior={anterior.monto_impuesto} esSubtotal />
            
            <tr className="bg-blue-50 border-t-2 border-blue-200">
              <td className="px-4 py-4 text-left font-bold text-blue-900 text-lg">UTILIDAD NETA</td>
              <td className="px-4 py-4 text-right font-bold text-blue-900 text-lg font-mono">${actual.utilidad_neta.toFixed(2)}</td>
              <td className="px-4 py-4 text-right font-bold text-blue-700 text-lg font-mono">${anterior.utilidad_neta.toFixed(2)}</td>
              <td className="px-4 py-4">
                <Variacion actual={actual.utilidad_neta} anterior={anterior.utilidad_neta} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div className="text-center text-xs text-gray-400">
        * Las variaciones se calculan respecto al mes anterior.
      </div>
    </div>
  );
}