import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import { Truck, Plus, Edit, Trash2, X, Save, Loader2 } from "lucide-react";

interface Proveedor {
  id: number;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
}

export default function Proveedores() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ nombre: "", telefono: "", email: "", direccion: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const data = await invoke<Proveedor[]>("listar_proveedores");
      setProveedores(data);
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  const abrirCrear = () => {
    setEditingId(null);
    setForm({ nombre: "", telefono: "", email: "", direccion: "" });
    setShowModal(true);
  };

  const abrirEditar = (p: Proveedor) => {
    setEditingId(p.id);
    setForm({
      nombre: p.nombre,
      telefono: p.telefono || "",
      email: p.email || "",
      direccion: p.direccion || ""
    });
    setShowModal(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim()) {
      return Swal.fire("Error", "El nombre es obligatorio", "error");
    }
    setSaving(true);
    try {
      const datos = {
        nombre: form.nombre,
        telefono: form.telefono || null,
        email: form.email || null,
        direccion: form.direccion || null
      };
      if (editingId === null) {
        await invoke("crear_proveedor", { datos });
      } else {
        await invoke("actualizar_proveedor", { id: editingId, datos });
      }
      Swal.fire("¡Éxito!", "Proveedor guardado", "success");
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
      title: "¿Eliminar proveedor?",
      text: `"${nombre}" será eliminado`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar"
    });
    if (!r.isConfirmed) return;
    try {
      await invoke("eliminar_proveedor", { id });
      Swal.fire("Eliminado", "Proveedor eliminado", "success");
      cargar();
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Truck className="w-6 h-6 text-blue-600" /> Proveedores
        </h1>
        <button onClick={abrirCrear} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nuevo Proveedor
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
        ) : proveedores.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No hay proveedores registrados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Dirección</th>
                  <th className="px-4 py-3 text-center">Opciones</th>
                </tr>
              </thead>
              <tbody>
                {proveedores.map(p => (
                  <tr key={p.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.nombre}</td>
                    <td className="px-4 py-3">{p.telefono || "-"}</td>
                    <td className="px-4 py-3">{p.email || "-"}</td>
                    <td className="px-4 py-3">{p.direccion || "-"}</td>
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
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">{editingId ? "Editar" : "Nuevo"} Proveedor</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input type="text" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <textarea value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" rows={2} />
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