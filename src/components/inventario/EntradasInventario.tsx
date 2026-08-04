import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import {
  PackagePlus, Plus, Trash2, X, Save, Loader2,
  RefreshCw, Filter
} from "lucide-react";

interface Producto { id: number; codigo: string; nombre: string; }
interface Proveedor { id: number; nombre: string; }

interface Entrada {
  id: number;
  producto_id: number;
  producto_codigo: string;
  producto_nombre: string;
  cantidad_inicial: number;
  cantidad_restante: number;
  costo_unitario: number;
  costo_total: number;
  fecha_entrada: string;
  proveedor_nombre: string | null;
  numero_factura_compra: string;
  observaciones: string;
}

export default function EntradasInventario() {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [filtroProducto, setFiltroProducto] = useState<number | null>(null);
  const [filtroProveedor, setFiltroProveedor] = useState<number | null>(null);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Modal nueva entrada
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    producto_id: null as number | null,
    cantidad: 0,
    costo_unitario: 0,
    fecha_entrada: "",
    proveedor_id: null as number | null,
    numero_factura_compra: "",
    observaciones: ""
  });
  const [saving, setSaving] = useState(false);
  const [stockActual, setStockActual] = useState<number | null>(null);

  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => {
    cargarProductos();
    cargarProveedores();
  }, []);

  useEffect(() => { cargar(); }, [page, filtroProducto, filtroProveedor, fechaDesde, fechaHasta]);

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

  const cargarProveedores = async () => {
    try {
      const data = await invoke<Proveedor[]>("listar_proveedores", { soloActivos: true });
      setProveedores(data);
    } catch (e) { console.error(e); }
  };

  const cargar = async () => {
    setLoading(true);
    try {
      const r: any = await invoke("listar_entradas", {
        productoId: filtroProducto,
        proveedorId: filtroProveedor,
        fechaDesde: fechaDesde || null,
        fechaHasta: fechaHasta || null,
        page, pageSize
      });
      setEntradas(r.data || []);
      setTotal(r.total || 0);
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  const abrirNuevaEntrada = () => {
    setForm({
      producto_id: null, cantidad: 0, costo_unitario: 0,
      fecha_entrada: new Date().toISOString().split("T")[0],
      proveedor_id: null, numero_factura_compra: "", observaciones: ""
    });
    setStockActual(null);
    setShowModal(true);
  };

  // Cuando cambia el producto seleccionado, cargar su stock actual
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
    if (form.costo_unitario < 0) return Swal.fire("Error", "El costo no puede ser negativo", "error");

    setSaving(true);
    try {
      const r: any = await invoke("crear_entrada", { datos: form });
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

  const eliminar = async (loteId: number, producto: string, cantidad: number) => {
    const r = await Swal.fire({
      title: "¿Eliminar entrada?",
      html: `Se eliminará la entrada de <strong>${cantidad} unidades de ${producto}</strong>.<br/>
             <span class="text-red-600 text-sm">Solo se puede eliminar si no se ha vendido nada de este lote.</span>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar"
    });
    if (!r.isConfirmed) return;

    try {
      const resp: any = await invoke("eliminar_entrada", { loteId });
      if (resp.success) {
        Swal.fire("Eliminado", resp.message, "success");
        cargar();
      }
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    }
  };

  const limpiarFiltros = () => {
    setFiltroProducto(null);
    setFiltroProveedor(null);
    setFechaDesde("");
    setFechaHasta("");
    setPage(1);
  };

  const productoSeleccionado = productos.find(p => p.id === form.producto_id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <PackagePlus className="w-6 h-6 text-blue-600" /> Entradas de Inventario
        </h1>
        <button onClick={abrirNuevaEntrada}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nueva Entrada
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
          <select value={filtroProveedor || ""}
            onChange={e => { setFiltroProveedor(e.target.value ? Number(e.target.value) : null); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Todos los proveedores</option>
            {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input type="date" value={fechaDesde} onChange={e => { setFechaDesde(e.target.value); setPage(1); }}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input type="date" value={fechaHasta} onChange={e => { setFechaHasta(e.target.value); setPage(1); }}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
          </div>
        </div>
        <button onClick={limpiarFiltros}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition">
          <RefreshCw className="w-3 h-3" /> Limpiar filtros
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
        ) : entradas.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No hay entradas registradas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3 text-right">Cantidad</th>
                  <th className="px-4 py-3 text-right">Restante</th>
                  <th className="px-4 py-3 text-right">Costo Unit.</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Factura</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {entradas.map(e => {
                  const puedeEliminar = e.cantidad_restante === e.cantidad_inicial;
                  return (
                    <tr key={e.id} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs">{new Date(e.fecha_entrada).toLocaleString("es-CU")}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{e.producto_nombre}</div>
                        <div className="text-xs text-gray-500 font-mono">{e.producto_codigo}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{e.cantidad_inicial}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={e.cantidad_restante === 0 ? "text-red-600" : "text-green-600"}>
                          {e.cantidad_restante}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">${e.costo_unitario.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-semibold">${e.costo_total.toFixed(2)}</td>
                      <td className="px-4 py-3">{e.proveedor_nombre || "-"}</td>
                      <td className="px-4 py-3 text-xs">{e.numero_factura_compra || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          {puedeEliminar && (
                            <button onClick={() => eliminar(e.id, e.producto_nombre, e.cantidad_inicial)}
                              className="p-1.5 text-red-600 hover:bg-red-100 rounded" title="Eliminar">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {!puedeEliminar && (
                            <span className="text-xs text-gray-400 italic" title="Ya consumido parcialmente">
                              En uso
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-4 border-t bg-gray-50">
            <p className="text-sm text-gray-600">
              Mostrando <span className="font-semibold">{(page - 1) * pageSize + 1}</span> a{" "}
              <span className="font-semibold">{Math.min(page * pageSize, total)}</span> de{" "}
              <span className="font-semibold">{total}</span> entradas
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

      {/* Modal Nueva Entrada */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-blue-600" /> Nueva Entrada de Inventario
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Info de stock actual si hay producto seleccionado */}
              {stockActual !== null && productoSeleccionado && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <p className="font-semibold text-blue-900">
                    {productoSeleccionado.nombre}
                  </p>
                  <p className="text-blue-700">
                    Stock actual: <strong>{stockActual} unidades</strong>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Producto *</label>
                  <select value={form.producto_id || ""}
                    onChange={e => setForm({ ...form, producto_id: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Selecciona un producto...</option>
                    {productos.map(p => (
                      <option key={p.id} value={p.id}>{p.codigo} - {p.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad *</label>
                  <input type="number" min={1} value={form.cantidad}
                    onChange={e => setForm({ ...form, cantidad: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ej: 50" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Costo Unitario *</label>
                  <input type="number" min={0} step={0.01} value={form.costo_unitario}
                    onChange={e => setForm({ ...form, costo_unitario: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ej: 500.00" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Entrada</label>
                  <input type="date" value={form.fecha_entrada}
                    onChange={e => setForm({ ...form, fecha_entrada: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor (opcional)</label>
                  <select value={form.proveedor_id || ""}
                    onChange={e => setForm({ ...form, proveedor_id: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Sin proveedor</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nº Factura de Compra</label>
                  <input type="text" value={form.numero_factura_compra}
                    onChange={e => setForm({ ...form, numero_factura_compra: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ej: FAC-2026-001" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                  <textarea value={form.observaciones}
                    onChange={e => setForm({ ...form, observaciones: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    rows={2} placeholder="Notas adicionales..." />
                </div>
              </div>

              {/* Resumen en tiempo real */}
              {form.cantidad > 0 && form.costo_unitario >= 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800">
                    <strong>Total de la entrada:</strong>{" "}
                    <span className="text-xl font-bold">
                      ${(form.cantidad * form.costo_unitario).toFixed(2)}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50 sticky bottom-0">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-200 rounded-lg" disabled={saving}>
                Cancelar
              </button>
              <button onClick={guardar} disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Registrar Entrada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}