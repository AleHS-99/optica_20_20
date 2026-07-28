import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import {
  PackageMinus, Plus, Save, Loader2, X, Filter, RefreshCw
} from "lucide-react";

interface Producto { id: number; codigo: string; nombre: string; }

interface Movimiento {
  id: number;
  producto_codigo: string;
  producto_nombre: string;
  tipo: string;
  cantidad: number;
  costo_unitario: number;
  costo_total: number;
  motivo: string;
  fecha: string;
}

export default function AjustesInventario() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [filtroProducto, setFiltroProducto] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  // Modal nuevo ajuste
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    producto_id: null as number | null,
    cantidad: 0,
    tipo: "AJUSTE_NEG",
    motivo: "",
    fecha: new Date().toISOString().split("T")[0]
  });
  const [saving, setSaving] = useState(false);
  const [stockActual, setStockActual] = useState<number | null>(null);

  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => {
    cargarProductos();
  }, []);

  useEffect(() => { cargar(); }, [page, filtroProducto, filtroTipo, fechaDesde, fechaHasta]);

  const cargarProductos = async () => {
    try {
      const r: any = await invoke("listar_productos", {
        soloActivos: true, page: 1, pageSize: 1000
      });
      const productosNormales = (r.data || []).filter(
        (p: any) => p.tipo === "PRODUCTO"
      );
      setProductos(productosNormales);
    } catch (e) { console.error(e); }
  };

  const cargar = async () => {
    setLoading(true);
    try {
      const r: any = await invoke("listar_movimientos", {
        productoId: filtroProducto,
        tipo: filtroTipo || null,
        fechaDesde: fechaDesde || null,
        fechaHasta: fechaHasta || null,
        page, pageSize
      });
      setMovimientos(r.data || []);
      setTotal(r.total || 0);
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  const abrirNuevoAjuste = () => {
    setForm({
      producto_id: null, cantidad: 0, tipo: "AJUSTE_NEG",
      motivo: "", fecha: new Date().toISOString().split("T")[0]
    });
    setStockActual(null);
    setShowModal(true);
  };

  useEffect(() => {
    if (form.producto_id) {
      invoke("obtener_stock_producto", { productoId: form.producto_id })
        .then((r: any) => setStockActual(r.stock_actual))
        .catch(() => setStockActual(null));
    } else {
      setStockActual(null);
    }
  }, [form.producto_id]);

  const guardar = async () => {
    if (!form.producto_id) return Swal.fire("Error", "Selecciona un producto", "error");
    if (form.cantidad <= 0) return Swal.fire("Error", "La cantidad debe ser mayor a 0", "error");
    if (!form.motivo.trim()) return Swal.fire("Error", "El motivo es obligatorio", "error");

    setSaving(true);
    try {
      const r: any = await invoke("crear_salida_manual", {
        productoId: form.producto_id,
        cantidad: form.cantidad,
        tipo: form.tipo,
        motivo: form.motivo,
        fecha: form.fecha
      });
      if (r.success) {
        Swal.fire("¡Éxito!", r.message, "success");
        setShowModal(false);
        cargar();
      }
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setSaving(false);
    }
  };

  const limpiarFiltros = () => {
    setFiltroProducto(null);
    setFiltroTipo("");
    setFechaDesde("");
    setFechaHasta("");
    setPage(1);
  };

  const tipoColor = (tipo: string) => {
    switch (tipo) {
      case "COMPRA": return "bg-green-100 text-green-700";
      case "VENTA": return "bg-blue-100 text-blue-700";
      case "AJUSTE_POS": return "bg-emerald-100 text-emerald-700";
      case "AJUSTE_NEG": return "bg-red-100 text-red-700";
      case "DEVOLUCION_CLIENTE": return "bg-purple-100 text-purple-700";
      case "DEVOLUCION_PROVEEDOR": return "bg-amber-100 text-amber-700";
      case "CONSUMO_INTERNO": return "bg-gray-100 text-gray-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const tipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      "COMPRA": "Compra",
      "VENTA": "Venta",
      "AJUSTE_POS": "Ajuste +",
      "AJUSTE_NEG": "Ajuste -",
      "DEVOLUCION_CLIENTE": "Dev. Cliente",
      "DEVOLUCION_PROVEEDOR": "Dev. Proveedor",
      "CONSUMO_INTERNO": "Consumo Interno"
    };
    return labels[tipo] || tipo;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <PackageMinus className="w-6 h-6 text-blue-600" /> Ajustes de Inventario
        </h1>
        <button onClick={abrirNuevoAjuste}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nuevo Ajuste
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filtros:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <select value={filtroProducto || ""}
            onChange={e => { setFiltroProducto(e.target.value ? Number(e.target.value) : null); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Todos los productos</option>
            {productos.map(p => <option key={p.id} value={p.id}>{p.codigo} - {p.nombre}</option>)}
          </select>
          <select value={filtroTipo}
            onChange={e => { setFiltroTipo(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Todos los tipos</option>
            <option value="COMPRA">Compra</option>
            <option value="VENTA">Venta</option>
            <option value="AJUSTE_POS">Ajuste Positivo</option>
            <option value="AJUSTE_NEG">Ajuste Negativo</option>
            <option value="DEVOLUCION_CLIENTE">Devolución Cliente</option>
            <option value="DEVOLUCION_PROVEEDOR">Devolución Proveedor</option>
            <option value="CONSUMO_INTERNO">Consumo Interno</option>
          </select>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input type="date" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setPage(1); }}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input type="date" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setPage(1); }}
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
        ) : movimientos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No hay movimientos registrados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3 text-right">Cantidad</th>
                  <th className="px-4 py-3 text-right">Costo Unit.</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map(m => (
                  <tr key={m.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs">{new Date(m.fecha).toLocaleString("es-CU")}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{m.producto_nombre}</div>
                      <div className="text-xs text-gray-500 font-mono">{m.producto_codigo}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${tipoColor(m.tipo)}`}>
                        {tipoLabel(m.tipo)}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${m.cantidad > 0 ? "text-green-600" : "text-red-600"}`}>
                      {m.cantidad > 0 ? "+" : ""}{m.cantidad}
                    </td>
                    <td className="px-4 py-3 text-right">${m.costo_unitario.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold">${m.costo_total.toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{m.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="flex justify-between items-center p-4 border-t bg-gray-50">
            <p className="text-sm text-gray-600">
              Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, total)} de {total} movimientos
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold">Nuevo Ajuste de Inventario</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {stockActual !== null && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <p className="font-semibold text-blue-900">Stock actual: {stockActual} unidades</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Producto *</label>
                  <select value={form.producto_id || ""}
                    onChange={e => setForm({ ...form, producto_id: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="">Selecciona un producto...</option>
                    {productos.map(p => <option key={p.id} value={p.id}>{p.codigo} - {p.nombre}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Movimiento *</label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="AJUSTE_NEG">Ajuste Negativo (Baja)</option>
                    <option value="AJUSTE_POS">Ajuste Positivo (Corrección)</option>
                    <option value="DEVOLUCION_CLIENTE">Devolución de Cliente</option>
                    <option value="DEVOLUCION_PROVEEDOR">Devolución a Proveedor</option>
                    <option value="CONSUMO_INTERNO">Consumo Interno</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad *</label>
                  <input type="number" min={1} value={form.cantidad}
                    onChange={e => setForm({ ...form, cantidad: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input type="date" value={form.fecha}
                    onChange={e => setForm({ ...form, fecha: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo *</label>
                  <textarea value={form.motivo}
                    onChange={e => setForm({ ...form, motivo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3} placeholder="Ej: Producto dañado, error de conteo, etc." />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50 sticky bottom-0">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-200 rounded-lg" disabled={saving}>
                Cancelar
              </button>
              <button onClick={guardar} disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}