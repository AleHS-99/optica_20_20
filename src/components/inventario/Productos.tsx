import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import { Package, Plus, Edit, Trash2, X, Save, Loader2, Search, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria_nombre: string | null;
  unidad_medida: string;
  tipo: string;
  proveedor_nombre: string | null;
  stock_minimo: number;
  porcentaje_ganancia_default: number;
  precio_venta_sugerido: number;
  activo: number;
}

interface Categoria { id: number; nombre: string; }
interface Proveedor { id: number; nombre: string; }

export default function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    nombre: "", descripcion: "", categoria_id: null as number | null,
    unidad_medida: "unidad", tipo: "PRODUCTO", proveedor_id: null as number | null,
    stock_minimo: 0, porcentaje_ganancia_default: 30, precio_venta_sugerido: 0
  });
  const [saving, setSaving] = useState(false);

  const totalPages = Math.ceil(total / pageSize);


  useEffect(() => {
    cargarCategorias();
    cargarProveedores();
  }, []);

  useEffect(() => { cargar(); }, [page, search, filtroTipo, filtroCategoria]);

  const cargarCategorias = async () => {
    try {
      const data = await invoke<Categoria[]>("listar_categorias", { soloActivas: true });
      setCategorias(data);
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
      const response: any = await invoke("listar_productos", {
        search: search || null,
        tipo: filtroTipo || null,
        categoriaId: filtroCategoria,
        soloActivos: true,
        page, pageSize
      });
      setProductos(response.data || []);
      setTotal(response.total || 0);
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  const abrirCrear = () => {
    setEditingId(null);
    setForm({
      nombre: "", descripcion: "", categoria_id: null,
      unidad_medida: "unidad", tipo: "PRODUCTO", proveedor_id: null,
      stock_minimo: 0, porcentaje_ganancia_default: 30, precio_venta_sugerido: 0
    });
    setShowModal(true);
  };

  const abrirEditar = async (p: Producto) => {
    try {
      const data: any = await invoke("obtener_producto", { id: p.id });
      setEditingId(p.id);
      setForm({
        nombre: data.nombre,
        descripcion: data.descripcion,
        categoria_id: data.categoria_id,
        unidad_medida: data.unidad_medida,
        tipo: data.tipo,
        proveedor_id: data.proveedor_id,
        stock_minimo: data.stock_minimo,
        porcentaje_ganancia_default: data.porcentaje_ganancia_default,
        precio_venta_sugerido: data.precio_venta_sugerido
      });
      setShowModal(true);
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    }
  };

  const guardar = async () => {
    if (!form.nombre.trim()) {
      return Swal.fire("Error", "El nombre es obligatorio", "error");
    }
    setSaving(true);
    try {
      if (editingId === null) {
        const r: any = await invoke("crear_producto", { datos: form });
        Swal.fire({
          title: "¡Producto creado!",
          html: `<p>Código generado: <strong class="text-blue-600">${r.codigo}</strong></p>`,
          icon: "success"
        });
      } else {
        await invoke("actualizar_producto", { id: editingId, datos: form });
        Swal.fire("¡Éxito!", "Producto actualizado", "success");
      }
      setShowModal(false);
      cargar();
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (id: number, nombre: string) => {
    const r = await Swal.fire({
      title: "¿Desactivar producto?",
      text: `"${nombre}" será desactivado (no se eliminará permanentemente)`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Sí, desactivar",
      cancelButtonText: "Cancelar"
    });
    if (!r.isConfirmed) return;
    try {
      await invoke("eliminar_producto", { id });
      Swal.fire("Desactivado", "Producto desactivado", "success");
      cargar();
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    }
  };

  const limpiarFiltros = () => {
    setSearch("");
    setFiltroTipo("");
    setFiltroCategoria(null);
    setPage(1);
  };

  const tipoColor = (tipo: string) => {
    switch (tipo) {
      case "PRODUCTO": return "bg-blue-100 text-blue-700";
      case "SERVICIO": return "bg-purple-100 text-purple-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Package className="w-6 h-6 text-blue-600" /> Productos
        </h1>
        <button onClick={abrirCrear} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nuevo Producto
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por código, nombre o descripción..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <select value={filtroTipo} onChange={e => { setFiltroTipo(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Todos los tipos</option>
            <option value="PRODUCTO">Producto</option>
            <option value="SERVICIO">Servicio</option>
          </select>
          <select value={filtroCategoria || ""} onChange={e => { setFiltroCategoria(e.target.value ? Number(e.target.value) : null); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <button onClick={limpiarFiltros} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-1">
            <RefreshCw className="w-4 h-4" /> Limpiar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
        ) : productos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No hay productos registrados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">% Ganancia</th>
                  <th className="px-4 py-3">Precio Sug.</th>
                  <th className="px-4 py-3 text-center">Opciones</th>
                </tr>
              </thead>
              <tbody>
                {productos.map(p => (
                  <tr key={p.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{p.codigo}</td>
                    <td className="px-4 py-3 font-medium">{p.nombre}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${tipoColor(p.tipo)}`}>{p.tipo}</span>
                    </td>
                    <td className="px-4 py-3">{p.categoria_nombre || "-"}</td>
                    <td className="px-4 py-3">{p.proveedor_nombre || "-"}</td>
                    <td className="px-4 py-3">{p.porcentaje_ganancia_default}%</td>
                    <td className="px-4 py-3 font-semibold">${p.precio_venta_sugerido.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => abrirEditar(p)} className="p-1.5 text-amber-600 hover:bg-amber-100 rounded">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => eliminar(p.id, p.nombre)} className="p-1.5 text-red-600 hover:bg-red-100 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-4 border-t bg-gray-50">
            <p className="text-sm text-gray-600">
              Mostrando <span className="font-semibold">{(page - 1) * pageSize + 1}</span> a{" "}
              <span className="font-semibold">{Math.min(page * pageSize, total)}</span> de{" "}
              <span className="font-semibold">{total}</span> productos
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50">
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <span className="px-3 py-1.5 text-sm font-medium">Página {page} de {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50">
                Siguiente <ChevronRight className="w-4 h-4" />
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
              <h2 className="text-xl font-bold">{editingId ? "Editar" : "Nuevo"} Producto</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {editingId && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  El código se generó automáticamente al crear el producto y no se puede modificar.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" rows={2} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="PRODUCTO">Producto</option>
                    <option value="SERVICIO">Servicio</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de medida</label>
                  <input type="text" value={form.unidad_medida} onChange={e => setForm({ ...form, unidad_medida: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="unidad, caja, par..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select value={form.categoria_id || ""} onChange={e => setForm({ ...form, categoria_id: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Sin categoría</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                  <select value={form.proveedor_id || ""} onChange={e => setForm({ ...form, proveedor_id: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">Sin proveedor</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock mínimo (alerta)</label>
                  <input type="number" min={0} value={form.stock_minimo} onChange={e => setForm({ ...form, stock_minimo: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">% Ganancia default</label>
                  <input type="number" min={0} step={0.01} value={form.porcentaje_ganancia_default}
                    onChange={e => setForm({ ...form, porcentaje_ganancia_default: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio de venta sugerido</label>
                  <input type="number" min={0} step={0.01} value={form.precio_venta_sugerido}
                    onChange={e => setForm({ ...form, precio_venta_sugerido: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50 sticky bottom-0">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-200 rounded-lg" disabled={saving}>Cancelar</button>
              <button onClick={guardar} disabled={saving} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}