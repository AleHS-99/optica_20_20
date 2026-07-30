import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import { Tags, Plus, Edit, Trash2, X, Save, Loader2 } from "lucide-react";

interface CategoriaGasto {
  id: number;
  nombre: string;
  descripcion: string;
  tipo: string;
  activo: number;
}

export default function CategoriasGasto() {
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ nombre: "", descripcion: "", tipo: "VARIABLE" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const data = await invoke<CategoriaGasto[]>("listar_categorias_gasto");
      setCategorias(data);
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  const abrirCrear = () => {
    setEditingId(null);
    setForm({ nombre: "", descripcion: "", tipo: "VARIABLE" });
    setShowModal(true);
  };

  const abrirEditar = (c: CategoriaGasto) => {
    setEditingId(c.id);
    setForm({ nombre: c.nombre, descripcion: c.descripcion, tipo: c.tipo });
    setShowModal(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim()) {
      return Swal.fire("Error", "El nombre es obligatorio", "error");
    }
    setSaving(true);
    try {
      if (editingId === null) {
        await invoke("crear_categoria_gasto", { datos: form });
      } else {
        await invoke("actualizar_categoria_gasto", { id: editingId, datos: form });
      }
      Swal.fire("¡Éxito!", "Categoría guardada", "success");
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
      title: "¿Eliminar categoría?",
      text: `"${nombre}" será eliminada permanentemente`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar"
    });
    if (!r.isConfirmed) return;
    try {
      await invoke("eliminar_categoria_gasto", { id });
      Swal.fire("Eliminada", "Categoría eliminada", "success");
      cargar();
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    }
  };

  const tipoColor = (tipo: string) => {
    switch (tipo) {
      case "FIJO": return "bg-blue-100 text-blue-700";
      case "VARIABLE": return "bg-amber-100 text-amber-700";
      case "FINANCIERO": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Tags className="w-6 h-6 text-blue-600" /> Categorías de Gastos
        </h1>
        <button onClick={abrirCrear} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nueva Categoría
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
        ) : categorias.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No hay categorías registradas.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3 text-center">Opciones</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map(c => (
                <tr key={c.id} className="bg-white border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.nombre}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${tipoColor(c.tipo)}`}>
                      {c.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.descripcion || "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => abrirEditar(c)} className="p-1.5 text-amber-600 hover:bg-amber-100 rounded">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => eliminar(c.id, c.nombre)} className="p-1.5 text-red-600 hover:bg-red-100 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">{editingId ? "Editar" : "Nueva"} Categoría</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="VARIABLE">Variable (gastos esporádicos)</option>
                  <option value="FIJO">Fijo (gastos mensuales recurrentes)</option>
                  <option value="FINANCIERO">Financiero (Intereses, etc)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" rows={3} />
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