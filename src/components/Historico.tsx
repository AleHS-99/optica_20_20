// src/components/Historico.tsx
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import {
  History, Search, Eye, Trash2, Loader2,
  ChevronLeft, ChevronRight, Calendar, X
} from "lucide-react";

interface Consulta {
  id: number;
  created: string;
  paciente_ci: string;
  paciente_nombre: string;
  refraccion: string;
  ojo_derecho: string;
  ojo_izquierdo: string;
  add: string;
  es_hoy: boolean;
}

export default function Historico() {
  // --- Estados de listado ---
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const totalPages = Math.ceil(total / pageSize);

  // ✅ Detectar si hay filtros activos
  const hayFiltros = search || fechaDesde || fechaHasta;

  // --- Cargar consultas al montar y cuando cambien página/filtros ---
  useEffect(() => {
    cargarConsultas();
  }, [page]);

  const cargarConsultas = async () => {
    setLoading(true);
    try {
      const response: any = await invoke("listar_todas_consultas", {
        search: search || null,
        fechaDesde: fechaDesde || null,
        fechaHasta: fechaHasta || null,
        page,
        pageSize
      });
      setConsultas(response.data || []);
      setTotal(response.total || 0);
    } catch (error: any) {
      Swal.fire("Error", error.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  // --- Ver Detalle ---
  const verDetalle = async (consultaId: number) => {
    try {
      const data: any = await invoke("obtener_detalle_consulta", { consultaId });
      const fecha = new Date(data.fecha).toLocaleString("es-CU");

      const html = `
        <div class="text-left space-y-2">
          <p><strong>Fecha:</strong> ${fecha}</p>
          <p><strong>Paciente:</strong> ${data.paciente.nombre} ${data.paciente.apell1} ${data.paciente.apell2} (CI: ${data.paciente.ci})</p>
          <hr class="my-2 border-gray-300"/>
          <div class="grid grid-cols-2 gap-2">
            <p><strong>Refracción:</strong> ${data.refraccion || '-'}</p>
            <p><strong>Add:</strong> ${data.add || '-'}</p>
            <p><strong>Ojo Derecho:</strong> ${data.ojo_derecho || '-'}</p>
            <p><strong>Ojo Izquierdo:</strong> ${data.ojo_izquierdo || '-'}</p>
            <p><strong>Galenos:</strong> ${data.galenos || '-'}</p>
            <p><strong>Corta y Monta:</strong> ${data.corta_y_monta || '-'}</p>
          </div>
          <p class="mt-2"><strong>Observaciones:</strong><br/>${data.observaciones || 'Ninguna'}</p>
        </div>
      `;

      Swal.fire({
        title: `Detalle de Consulta #${data.id}`,
        html: html,
        width: 600,
        confirmButtonText: "Cerrar",
        icon: "info"
      });
    } catch (error: any) {
      Swal.fire("Error", "No se pudo cargar la consulta", "error");
    }
  };

  // --- Eliminar Consulta ---
  const eliminarConsulta = async (consultaId: number) => {
    const result = await Swal.fire({
      title: "¿Eliminar consulta?",
      text: "Esta acción no se puede deshacer",
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
        const response: any = await invoke("eliminar_consulta", { consultaId });
        Swal.close();

        if (response.success) {
          Swal.fire("Eliminado", response.message, "success");
          cargarConsultas();
        } else {
          Swal.fire("Error", response.error || "No se pudo eliminar", "error");
        }
      } catch (error: any) {
        Swal.close();
        Swal.fire("Error", error.toString(), "error");
      }
    }
  };

  // --- Búsqueda con Enter o botón ---
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    cargarConsultas();
  };

  // --- Limpiar todos los filtros ---
  const limpiarFiltros = () => {
    setSearch("");
    setFechaDesde("");
    setFechaHasta("");
    setPage(1);
    // Recargar con filtros vacíos
    setTimeout(() => cargarConsultas(), 0);
  };

  // ✅ Fechas rápidas predefinidas
  const aplicarFiltroRapido = (tipo: "hoy" | "semana" | "mes" | "anio") => {
    const hoy = new Date();
    const format = (d: Date) => d.toISOString().split("T")[0];

    switch (tipo) {
      case "hoy":
        setFechaDesde(format(hoy));
        setFechaHasta(format(hoy));
        break;
      case "semana": {
        const inicio = new Date(hoy);
        inicio.setDate(hoy.getDate() - 7);
        setFechaDesde(format(inicio));
        setFechaHasta(format(hoy));
        break;
      }
      case "mes": {
        const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        setFechaDesde(format(inicio));
        setFechaHasta(format(hoy));
        break;
      }
      case "anio": {
        const inicio = new Date(hoy.getFullYear(), 0, 1);
        setFechaDesde(format(inicio));
        setFechaHasta(format(hoy));
        break;
      }
    }
    setPage(1);
    setTimeout(() => cargarConsultas(), 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <History className="w-6 h-6 text-blue-600" />
          Histórico de Consultas
        </h1>
        {total > 0 && (
          <span className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-full">
            Total: <strong>{total}</strong> consulta{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* === BARRA DE BÚSQUEDA Y FILTROS === */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-3">
        {/* Fila 1: Búsqueda de texto */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por CI, nombre, apellidos o refracción..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Buscar
          </button>
        </form>

        {/* Fila 2: Filtro de fechas */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span className="font-medium">Rango de fechas:</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
          </div>

          <button
            onClick={() => { setPage(1); cargarConsultas(); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
          >
            Aplicar
          </button>
        </div>

        {/* Fila 3: Botones rápidos + limpiar */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-500 self-center mr-2">Filtros rápidos:</span>
          <button
            onClick={() => aplicarFiltroRapido("hoy")}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded-full transition"
          >
            Hoy
          </button>
          <button
            onClick={() => aplicarFiltroRapido("semana")}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded-full transition"
          >
            Última semana
          </button>
          <button
            onClick={() => aplicarFiltroRapido("mes")}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded-full transition"
          >
            Este mes
          </button>
          <button
            onClick={() => aplicarFiltroRapido("anio")}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-blue-100 hover:text-blue-700 rounded-full transition"
          >
            Este año
          </button>

          {hayFiltros && (
            <button
              onClick={limpiarFiltros}
              className="ml-auto flex items-center gap-1 px-3 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded-full transition"
            >
              <X className="w-3 h-3" /> Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : consultas.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <History className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>{hayFiltros ? "No se encontraron consultas con los filtros aplicados." : "No hay consultas registradas."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">CI</th>
                  <th className="px-4 py-3">Paciente</th>
                  <th className="px-4 py-3">Refracción</th>
                  <th className="px-4 py-3">OD</th>
                  <th className="px-4 py-3">OI</th>
                  <th className="px-4 py-3">Add</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {consultas.map((c) => (
                  <tr key={c.id} className="bg-white border-b hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-xs">
                      {new Date(c.created).toLocaleString("es-CU")}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{c.paciente_ci}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{c.paciente_nombre}</td>
                    <td className="px-4 py-3">{c.refraccion || "-"}</td>
                    <td className="px-4 py-3">{c.ojo_derecho || "-"}</td>
                    <td className="px-4 py-3">{c.ojo_izquierdo || "-"}</td>
                    <td className="px-4 py-3">{c.add || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => verDetalle(c.id)}
                          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {c.es_hoy && (
                          <button
                            onClick={() => eliminarConsulta(c.id)}
                            className="p-1.5 text-red-600 hover:bg-red-100 rounded transition"
                            title="Eliminar (Solo consultas del día)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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
              de <span className="font-semibold">{total}</span> consultas
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
    </div>
  );
}
