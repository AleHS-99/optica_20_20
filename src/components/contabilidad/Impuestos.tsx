import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import { Percent, Plus, Edit, Trash2, X, Save, Loader2 } from "lucide-react";

interface Impuesto {
  id: number;
  nombre: string;
  porcentaje: number;
  activo: number;
}

export default function Impuestos() {
  const [impuestos, setImpuestos] = useState<Impuesto[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ nombre: "", porcentaje: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const data = await invoke<Impuesto[]>("listar_impuestos");
      setImpuestos(data);
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  const abrirCrear = () => {
    setEditingId(null);
    setForm({ nombre: "", porcentaje: 0 });
    setShowModal(true);
  };

  const abrirEditar = (i: Impuesto) => {
    setEditingId(i.id);
    setForm({ nombre: i.nombre, porcentaje: i.porcentaje });
    setShowModal(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim()) return Swal.fire("Error", "El nombre es obligatorio", "error");
    if (form.porcentaje < 0) return Swal.fire("Error", "El porcentaje no puede ser negativo", "error");

    setSaving(true);
    try {
      if (editingId === null) {
        await invoke("crear_impuesto", { datos: form });
      } else {
        await invoke("actualizar_impuesto", { id: editingId, datos: form });
      }
      Swal.fire("¡Éxito!", "Impuesto guardado", "success");
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
      title: "¿Eliminar impuesto?",
      text: `"${nombre}" será eliminado`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar"
    });
    if (!r.isConfirmed) return;
    try {
      await invoke("eliminar_impuesto", { id });
      Swal.fire("Eliminado", "Impuesto eliminado", "success");
      cargar();
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Percent className="w-6 h-6 text-blue-600" /> Impuestos
        </h1>
        <button onClick={abrirCrear} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nuevo Impuesto
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Nota:</strong> Los impuestos definidos aquí estarán disponibles al crear facturas.
          Puedes definir múltiples impuestos y aplicarlos según el tipo de venta.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
        ) : impuestos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No hay impuestos configurados.</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3 text-right">Porcentaje</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-center">Opciones</th>
              </tr>
            </thead>
            <tbody>
              {impuestos.map(i => (
                <tr key={i.id} className={`bg-white border-b hover:bg-gray-50 ${i.activo === 0 ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-medium">{i.nombre}</td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-700">{i.porcentaje.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      i.activo === 1 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {i.activo === 1 ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => abrirEditar(i)} className="p-1.5 text-amber-600 hover:bg-amber-100 rounded">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => eliminar(i.id, i.nombre)} className="p-1.5 text-red-600 hover:bg-red-100 rounded">
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
              <h2 className="text-xl font-bold">{editingId ? "Editar" : "Nuevo"} Impuesto</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ej: IVA, Impuesto ventas" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Porcentaje *</label>
                <input type="number" min={0} step={0.01} value={form.porcentaje}
                  onChange={e => setForm({ ...form, porcentaje: Number(e.target.value) })}
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