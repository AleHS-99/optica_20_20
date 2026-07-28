import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import {
  Calendar, Plus, Edit, Trash2, X, Save, Loader2,
  ToggleLeft, ToggleRight
} from "lucide-react";

interface CategoriaGasto { id: number; nombre: string; tipo: string; }
interface GastoFijo {
  id: number;
  categoria_id: number;
  categoria_nombre: string;
  descripcion: string;
  monto: number;
  activo: number;
}

export default function GastosFijos() {
  const [plantilla, setPlantilla] = useState<GastoFijo[]>([]);
  const [categoriasFijas, setCategoriasFijas] = useState<CategoriaGasto[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    categoria_id: null as number | null,
    descripcion: "",
    monto: 0
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const [plantillaData, categorias] = await Promise.all([
        invoke<GastoFijo[]>("listar_gastos_fijos_plantilla"),
        invoke<CategoriaGasto[]>("listar_categorias_gasto", { soloActivas: true })
      ]);
      setPlantilla(plantillaData);
      setCategoriasFijas(categorias.filter(c => c.tipo === "FIJO"));
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  const abrirCrear = () => {
    setEditingId(null);
    setForm({ categoria_id: null, descripcion: "", monto: 0 });
    setShowModal(true);
  };

  const abrirEditar = (g: GastoFijo) => {
    setEditingId(g.id);
    setForm({
      categoria_id: g.categoria_id,
      descripcion: g.descripcion,
      monto: g.monto
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
        await invoke("crear_gasto_fijo", { datos: form });
      } else {
        await invoke("actualizar_gasto_fijo", { id: editingId, datos: form });
      }
      Swal.fire("¡Éxito!", "Gasto fijo guardado", "success");
      setShowModal(false);
      cargar();
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (id: number) => {
    try {
      await invoke("toggle_gasto_fijo", { id });
      cargar();
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    }
  };

  const eliminar = async (id: number, descripcion: string) => {
    const r = await Swal.fire({
      title: "¿Eliminar de la plantilla?",
      text: `"${descripcion}" será eliminado de la plantilla de gastos fijos`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar"
    });
    if (!r.isConfirmed) return;
    try {
      await invoke("eliminar_gasto_fijo", { id });
      Swal.fire("Eliminado", "Gasto fijo eliminado", "success");
      cargar();
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    }
  };

  const totalMensualActivo = plantilla
    .filter(p => p.activo === 1)
    .reduce((sum, p) => sum + p.monto, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-blue-600" /> Plantilla de Gastos Fijos
        </h1>
        <button onClick={abrirCrear} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nuevo Gasto Fijo
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>¿Qué es esto?</strong> Aquí defines los gastos fijos mensuales (alquiler, salarios, internet, etc.).
          Estos gastos se generarán automáticamente al cerrar cada mes. Puedes activar/desactivar cada uno según necesites.
        </p>
      </div>

      {/* Resumen */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">Total mensual (solo activos)</p>
        <p className="text-3xl font-bold text-blue-900">${totalMensualActivo.toFixed(2)}</p>
        <p className="text-xs text-blue-600 mt-1">
          {plantilla.filter(p => p.activo === 1).length} de {plantilla.length} gastos activos
        </p>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
        ) : plantilla.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p>No hay gastos fijos en la plantilla.</p>
            <p className="text-sm mt-1">Agrega gastos mensuales recurrentes como alquiler, salarios, etc.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3 text-right">Monto Mensual</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-center">Opciones</th>
                </tr>
              </thead>
              <tbody>
                {plantilla.map(g => (
                  <tr key={g.id} className={`bg-white border-b hover:bg-gray-50 ${g.activo === 0 ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 font-medium">{g.categoria_nombre}</td>
                    <td className="px-4 py-3">{g.descripcion}</td>
                    <td className="px-4 py-3 text-right font-semibold">${g.monto.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActivo(g.id)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          g.activo === 1
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                        title={g.activo === 1 ? "Activo - Click para desactivar" : "Inactivo - Click para activar"}
                      >
                        {g.activo === 1 ? (
                          <><ToggleRight className="w-4 h-4" /> Activo</>
                        ) : (
                          <><ToggleLeft className="w-4 h-4" /> Inactivo</>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => abrirEditar(g)} className="p-1.5 text-amber-600 hover:bg-amber-100 rounded">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => eliminar(g.id, g.descripcion)} className="p-1.5 text-red-600 hover:bg-red-100 rounded">
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
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">{editingId ? "Editar" : "Nuevo"} Gasto Fijo</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría (FIJO) *</label>
                <select value={form.categoria_id || ""}
                  onChange={e => setForm({ ...form, categoria_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="">Selecciona una categoría fija...</option>
                  {categoriasFijas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                {categoriasFijas.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No hay categorías de tipo FIJO. Crea una primero en "Categorías de Gastos".
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción *</label>
                <input type="text" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ej: Alquiler del local" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto Mensual *</label>
                <input type="number" min={0} step={0.01} value={form.monto}
                  onChange={e => setForm({ ...form, monto: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
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