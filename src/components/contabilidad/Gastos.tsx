import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import {
  Receipt, Plus, Edit, Trash2, X, Save, Loader2,
  Filter, RefreshCw
} from "lucide-react";

interface CategoriaGasto { id: number; nombre: string; tipo: string; }
interface Gasto {
  id: number;
  categoria_id: number;
  categoria_nombre: string;
  categoria_tipo: string;
  descripcion: string;
  monto: number;
  fecha: string;
  tipo: string;
  es_autogenerado: number;
}

export default function Gastos() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [sumaTotal, setSumaTotal] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    categoria_id: null as number | null,
    descripcion: "",
    monto: 0,
    fecha: new Date().toISOString().split("T")[0],
    tipo: "VARIABLE"
  });
  const [saving, setSaving] = useState(false);

  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => { cargarCategorias(); }, []);
  useEffect(() => { cargar(); }, [page, filtroCategoria, filtroTipo, fechaDesde, fechaHasta]);

  const cargarCategorias = async () => {
    try {
      const data = await invoke<CategoriaGasto[]>("listar_categorias_gasto", { soloActivas: true });
      const categoriasVariables = data.filter(c => c.tipo === "VARIABLE");
      setCategorias(categoriasVariables);
    } catch (e) { console.error(e); }
  };

  const cargar = async () => {
    setLoading(true);
    try {
      const r: any = await invoke("listar_gastos", {
        categoriaId: filtroCategoria,
        tipo: filtroTipo || null,
        fechaDesde: fechaDesde || null,
        fechaHasta: fechaHasta || null,
        page, pageSize
      });
      setGastos(r.data || []);
      setTotal(r.total || 0);
      setSumaTotal(r.suma_total || 0);
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  const abrirCrear = () => {
    setEditingId(null);
    setForm({
      categoria_id: null, descripcion: "", monto: 0,
      fecha: new Date().toISOString().split("T")[0], tipo: "VARIABLE"
    });
    setShowModal(true);
  };

  const abrirEditar = (g: Gasto) => {
    if (g.es_autogenerado === 1) {
      return Swal.fire("Aviso", "Este gasto fue generado automáticamente. Edítalo desde la plantilla de gastos fijos.", "info");
    }
    setEditingId(g.id);
    setForm({
      categoria_id: g.categoria_id,
      descripcion: g.descripcion,
      monto: g.monto,
      fecha: g.fecha.substring(0, 10),
      tipo: g.tipo
    });
    setShowModal(true);
  };

  const guardar = async () => {
    if (!form.categoria_id) return Swal.fire("Error", "Selecciona una categoría", "error");
    if (!form.descripcion.trim()) return Swal.fire("Error", "La descripción es obligatoria", "error");
    if (form.monto <= 0) return Swal.fire("Error", "El monto debe ser mayor a 0", "error");

    setSaving(true);
    try {
      if (editingId === null) {
        await invoke("crear_gasto", { datos: form });
      } else {
        await invoke("actualizar_gasto", { id: editingId, datos: form });
      }
      Swal.fire("¡Éxito!", "Gasto guardado", "success");
      setShowModal(false);
      cargar();
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (id: number, descripcion: string) => {
    const r = await Swal.fire({
      title: "¿Eliminar gasto?",
      text: `"${descripcion}" será eliminado permanentemente`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar"
    });
    if (!r.isConfirmed) return;
    try {
      await invoke("eliminar_gasto", { id });
      Swal.fire("Eliminado", "Gasto eliminado", "success");
      cargar();
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    }
  };

  const limpiarFiltros = () => {
    setFiltroCategoria(null);
    setFiltroTipo("");
    setFechaDesde("");
    setFechaHasta("");
    setPage(1);
  };

  const tipoColor = (tipo: string) =>
    tipo === "FIJO" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Receipt className="w-6 h-6 text-blue-600" /> Registro de Gastos
        </h1>
        <button onClick={abrirCrear} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nuevo Gasto
        </button>
      </div>

      {/* Resumen */}
      <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-700">Total de gastos (según filtros)</p>
        <p className="text-3xl font-bold text-red-900">${sumaTotal.toFixed(2)}</p>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filtros:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <select value={filtroCategoria || ""}
            onChange={e => { setFiltroCategoria(e.target.value ? Number(e.target.value) : null); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg">
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select value={filtroTipo}
            onChange={e => { setFiltroTipo(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg">
            <option value="">Todos los tipos</option>
            <option value="FIJO">Fijo</option>
            <option value="VARIABLE">Variable</option>
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
        <button onClick={limpiarFiltros} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
          <RefreshCw className="w-3 h-3" /> Limpiar filtros
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
        ) : gastos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No hay gastos registrados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-center">Opciones</th>
                </tr>
              </thead>
              <tbody>
                {gastos.map(g => (
                  <tr key={g.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs">{new Date(g.fecha).toLocaleString("es-CU")}</td>
                    <td className="px-4 py-3 font-medium">{g.categoria_nombre}</td>
                    <td className="px-4 py-3">{g.descripcion}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${tipoColor(g.tipo)}`}>
                        {g.tipo === "FIJO" ? "Fijo" : "Variable"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-700">${g.monto.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => abrirEditar(g)}
                          className={`p-1.5 rounded ${g.es_autogenerado ? "text-gray-400 cursor-not-allowed" : "text-amber-600 hover:bg-amber-100"}`}
                          title={g.es_autogenerado ? "Autogenerado" : "Editar"}>
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => eliminar(g.id, g.descripcion)}
                          className={`p-1.5 rounded ${g.es_autogenerado ? "text-gray-400 cursor-not-allowed" : "text-red-600 hover:bg-red-100"}`}
                          title={g.es_autogenerado ? "Autogenerado" : "Eliminar"}>
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
          <div className="flex justify-between items-center p-4 border-t bg-gray-50">
            <p className="text-sm text-gray-600">
              Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, total)} de {total} gastos
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
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">{editingId ? "Editar" : "Nuevo"} Gasto</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría *</label>
                <select value={form.categoria_id || ""}
                  onChange={e => {
                    const catId = e.target.value ? Number(e.target.value) : null;
                    const cat = categorias.find(c => c.id === catId);
                    setForm({
                      ...form,
                      categoria_id: catId,
                      tipo: cat?.tipo || "VARIABLE"
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="">Selecciona una categoría...</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.tipo})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
                <input type="text" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ej: Reparación de equipo" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
                  <input type="number" min={0} step={0.01} value={form.monto}
                    onChange={e => setForm({ ...form, monto: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
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