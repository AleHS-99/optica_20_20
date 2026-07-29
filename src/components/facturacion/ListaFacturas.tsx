import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import {
  Receipt, Plus, Eye, Loader2, Filter, RefreshCw
} from "lucide-react";

interface Factura {
  id: number;
  numero: string;
  paciente_nombre: string | null;
  paciente_ci: string | null;
  fecha: string;
  subtotal: number;
  descuento: number;
  total: number;
  estado: string;
  metodo_pago: string | null;
  total_pagado: number;
  saldo_pendiente: number;
}

export default function ListaFacturas() {
  const navigate = useNavigate();
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => { cargar(); }, [page, filtroEstado, fechaDesde, fechaHasta]);

  const cargar = async () => {
    setLoading(true);
    try {
      const r: any = await invoke("listar_facturas", {
        estado: filtroEstado || null,
        fechaDesde: fechaDesde || null,
        fechaHasta: fechaHasta || null,
        page, pageSize
      });
      setFacturas(r.data || []);
      setTotal(r.total || 0);
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  const estadoColor = (estado: string) => {
    switch (estado) {
      case "PENDIENTE": return "bg-red-100 text-red-700";
      case "PARCIAL": return "bg-amber-100 text-amber-700";
      case "PAGADA": return "bg-green-100 text-green-700";
      case "ANULADA": return "bg-gray-100 text-gray-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const limpiarFiltros = () => {
    setFiltroEstado("");
    setFechaDesde("");
    setFechaHasta("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Receipt className="w-6 h-6 text-blue-600" /> Facturas
        </h1>
        <button
          onClick={() => navigate("/app/facturacion/nueva")}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Nueva Factura
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filtros:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={filtroEstado}
            onChange={e => { setFiltroEstado(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg">
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="PARCIAL">Parcial</option>
            <option value="PAGADA">Pagada</option>
            <option value="ANULADA">Anulada</option>
          </select>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input type="date" value={fechaDesde}
              onChange={e => { setFechaDesde(e.target.value); setPage(1); }}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input type="date" value={fechaHasta}
              onChange={e => { setFechaHasta(e.target.value); setPage(1); }}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>
        <button onClick={limpiarFiltros}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
          <RefreshCw className="w-3 h-3" /> Limpiar filtros
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
        ) : facturas.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No hay facturas registradas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Pagado</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map(f => (
                  <tr key={f.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs">{new Date(f.fecha).toLocaleString("es-CU")}</td>
                    <td className="px-4 py-3 font-mono font-semibold">{f.numero}</td>
                    <td className="px-4 py-3">
                      {f.paciente_nombre ? (
                        <div>
                          <div className="font-medium">{f.paciente_nombre}</div>
                          <div className="text-xs text-gray-500">CI: {f.paciente_ci}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Venta directa</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">${f.total.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-green-600">${f.total_pagado.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={f.saldo_pendiente > 0 ? "text-red-600 font-semibold" : "text-gray-500"}>
                        ${f.saldo_pendiente.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${estadoColor(f.estado)}`}>
                        {f.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => navigate(`/app/facturacion/detalle/${f.id}`)}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                        title="Ver detalle"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="flex justify-between items-center p-4 border-t bg-gray-50">
            <p className="text-sm text-gray-600">
              Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, total)} de {total} facturas
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50">
                Anterior
              </button>
              <span className="px-3 py-1.5 text-sm font-medium">Página {page} de {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50">
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}