// src/components/Pacientes.tsx
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import {
  Users, Search, Plus, Edit, Trash2, X, Save,
  ChevronLeft, ChevronRight, Loader2, RefreshCw
} from "lucide-react";

interface Paciente {
  id: number;
  ci: string;
  nombre: string;
  apell1: string;
  apell2: string;
  telefono: string | null;
  direccion: string | null;
  created_at: string;
}

interface PacienteForm {
  ci: string;
  nombre: string;
  apell1: string;
  apell2: string;
  telefono: string;
  direccion: string;
}

export default function Pacientes() {
  // --- Estados de listado ---
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // --- Estados del formulario modal ---
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PacienteForm>({
    ci: "", nombre: "", apell1: "", apell2: "", telefono: "", direccion: ""
  });
  const [saving, setSaving] = useState(false);

  const totalPages = Math.ceil(total / pageSize);

  // --- Cargar pacientes al montar y cuando cambien página/búsqueda ---
  useEffect(() => {
    cargarPacientes();
  }, [page, search]);

  const cargarPacientes = async () => {
    setLoading(true);
    try {
      const response: any = await invoke("listar_pacientes", {
        search: search || null,
        page,
        pageSize
      });
      setPacientes(response.data || []);
      setTotal(response.total || 0);
    } catch (error: any) {
      Swal.fire("Error", error.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  // --- Abrir modal para CREAR ---
  const abrirCrear = () => {
    setEditingId(null);
    setForm({ ci: "", nombre: "", apell1: "", apell2: "", telefono: "", direccion: "" });
    setShowModal(true);
  };

  // --- Abrir modal para EDITAR ---
  const abrirEditar = (p: Paciente) => {
    setEditingId(p.id);
    setForm({
      ci: p.ci,
      nombre: p.nombre,
      apell1: p.apell1,
      apell2: p.apell2 || "",
      telefono: p.telefono || "",
      direccion: p.direccion || ""
    });
    setShowModal(true);
  };

  // --- Guardar (crear o actualizar) ---
  const guardar = async () => {
    // Validaciones
    if (editingId === null) {
      // Crear: CI es obligatorio
      if (form.ci.length !== 11 || !/^\d+$/.test(form.ci)) {
        return Swal.fire("Error", "El CI debe tener exactamente 11 dígitos", "error");
      }
    }
    if (!form.nombre.trim() || !form.apell1.trim()) {
      return Swal.fire("Error", "Nombre y primer apellido son obligatorios", "error");
    }

    setSaving(true);
    try {
      if (editingId === null) {
        // CREAR
        const response: any = await invoke("crear_paciente", { datos: form });
        if (response.success) {
          Swal.fire("¡Éxito!", response.message, "success");
          setShowModal(false);
          cargarPacientes();
        }
      } else {
        // ACTUALIZAR
        const response: any = await invoke("actualizar_paciente", {
          id: editingId,
          datos: form
        });
        if (response.success) {
          Swal.fire("¡Éxito!", response.message, "success");
          setShowModal(false);
          cargarPacientes();
        }
      }
    } catch (error: any) {
      Swal.fire("Error", error.toString(), "error");
    } finally {
      setSaving(false);
    }
  };

  // --- Eliminar ---
  const eliminar = async (id: number, nombreCompleto: string) => {
    const result = await Swal.fire({
      title: "¿Eliminar paciente?",
      html: `Se eliminará a <strong>${nombreCompleto}</strong> y todas sus consultas.<br/><span class="text-red-600 text-sm">Esta acción no se puede deshacer.</span>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar"
    });

    if (result.isConfirmed) {
      try {
        Swal.fire({ title: "Eliminando...", didOpen: () => Swal.showLoading() });
        const response: any = await invoke("eliminar_paciente", { id });
        Swal.close();
        if (response.success) {
          Swal.fire("Eliminado", response.message, "success");
          cargarPacientes();
        }
      } catch (error: any) {
        Swal.close();
        Swal.fire("Error", error.toString(), "error");
      }
    }
  };

  // --- Búsqueda con debounce manual (al presionar Enter o botón) ---
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Volver a la primera página al buscar
    cargarPacientes();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Users className="w-6 h-6 text-blue-600" />
          Listado de Pacientes
        </h1>
        <button
          onClick={abrirCrear}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nuevo Paciente
        </button>
      </div>

      {/* Barra de búsqueda */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por CI, nombre o apellidos..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Buscar
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(""); setPage(1); }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" /> Limpiar
            </button>
          )}
        </form>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : pacientes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No se encontraron pacientes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3">CI</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">1er Apellido</th>
                  <th className="px-4 py-3">2do Apellido</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3 text-center">Opciones</th>
                </tr>
              </thead>
              <tbody>
                {pacientes.map((p) => (
                  <tr key={p.id} className="bg-white border-b hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-mono text-xs">{p.ci}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{p.nombre}</td>
                    <td className="px-4 py-3">{p.apell1}</td>
                    <td className="px-4 py-3">{p.apell2 || "-"}</td>
                    <td className="px-4 py-3">{p.telefono || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => abrirEditar(p)}
                          className="p-1.5 text-amber-600 hover:bg-amber-100 rounded transition"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            eliminar(p.id, `${p.nombre} ${p.apell1} ${p.apell2 || ""}`)
                          }
                          className="p-1.5 text-red-600 hover:bg-red-100 rounded transition"
                          title="Eliminar"
                        >
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

        {/* Paginación */}
        {total > 0 && (
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-4 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              Mostrando <span className="font-semibold">{(page - 1) * pageSize + 1}</span> a{" "}
              <span className="font-semibold">
                {Math.min(page * pageSize, total)}
              </span>{" "}
              de <span className="font-semibold">{total}</span> pacientes
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <span className="px-3 py-1.5 text-sm font-medium">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* === MODAL CREAR / EDITAR === */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header del modal */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                {editingId ? "Editar Paciente" : "Nuevo Paciente"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CI *</label>
                  <input
                    type="text"
                    value={form.ci}
                    onChange={(e) => setForm({ ...form, ci: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                    readOnly={editingId !== null}
                    className={`w-full px-3 py-2 border rounded-lg outline-none ${
                      editingId !== null
                        ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                        : "border-gray-300 focus:ring-2 focus:ring-blue-500"
                    }`}
                    placeholder="12345678901"
                    maxLength={11}
                  />
                  {editingId !== null && (
                    <p className="text-xs text-gray-500 mt-1">El CI no se puede modificar</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Nombre"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">1er Apellido *</label>
                  <input
                    type="text"
                    value={form.apell1}
                    onChange={(e) => setForm({ ...form, apell1: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Primer apellido"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">2do Apellido</label>
                  <input
                    type="text"
                    value={form.apell2}
                    onChange={(e) => setForm({ ...form, apell2: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Segundo apellido"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="55555555"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                  <textarea
                    value={form.direccion}
                    onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    rows={2}
                    placeholder="Dirección del paciente"
                  />
                </div>
              </div>
            </div>

            {/* Footer del modal */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 sticky bottom-0">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editingId ? "Actualizar" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
