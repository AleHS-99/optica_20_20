// src/components/NuevaConsulta.tsx
import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import {
  CheckCircle, XCircle, Loader2,
  UserPlus, FileText, Trash2, Eye, Save, X
} from "lucide-react";

interface PacienteData {
  id?: number;
  ci: string;
  nombre: string;
  apell1: string;
  apell2: string;
  telefono: string;
  direccion: string;
}

interface ConsultaData {
  id: number;
  created: string;
  refraccion: string;
  ojo_derecho: string;
  ojo_izquierdo: string;
  add: string;
  es_hoy: boolean;
  es_ultima: boolean;
}

export default function NuevaConsulta() {
  // --- Refs para scroll ---
  const consultaFormRef = useRef<HTMLDivElement>(null);
  const pacienteCardRef = useRef<HTMLDivElement>(null);

  // --- Estados del Paciente ---
  const [ci, setCi] = useState("");
  const [paciente, setPaciente] = useState<PacienteData>({
    ci: "", nombre: "", apell1: "", apell2: "", telefono: "", direccion: ""
  });
  const [pacienteExiste, setPacienteExiste] = useState(false);
  const [ciVerificado, setCiVerificado] = useState(false); // ✅ NUEVO: rastrea si ya se verificó
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [verificandoCI, setVerificandoCI] = useState(false);

  // --- Estados de la Consulta ---
  const [showConsultaForm, setShowConsultaForm] = useState(false);
  const [consultas, setConsultas] = useState<ConsultaData[]>([]);
  const [loadingConsultas, setLoadingConsultas] = useState(false);
  const [consultaData, setConsultaData] = useState({
    refraccion: "", ojo_derecho: "", ojo_izquierdo: "", add: "",
    galenos: "", corta_y_monta: "", observaciones: ""
  });

  // --- ✅ VERIFICACIÓN AUTOMÁTICA al llegar a 11 dígitos ---
  useEffect(() => {
    if (ci.length === 11 && !verificandoCI) {
      verificarCI(ci);
    }
  }, [ci]); // Se dispara cada vez que cambia el CI

  // --- 1. Verificar CI ---
  const verificarCI = async (ciToCheck: string) => {
    if (ciToCheck.length !== 11 || !/^\d+$/.test(ciToCheck)) {
      limpiarEstadoCI();
      return;
    }

    setVerificandoCI(true);
    setCiVerificado(false); // Aún no sabemos el resultado
    try {
      const response: any = await invoke("verificar_ci", { ci: ciToCheck });

      if (response.exists) {
        setPacienteExiste(true);
        setCiVerificado(true);
        setIsReadOnly(true);
        setPaciente({
          id: response.paciente.id,
          ci: response.paciente.ci,
          nombre: response.paciente.nombre,
          apell1: response.paciente.apell1,
          apell2: response.paciente.apell2,
          telefono: response.paciente.telefono || "",
          direccion: response.paciente.direccion || ""
        });
        cargarConsultas(response.paciente.id);

        Swal.fire({
          title: "Paciente encontrado",
          text: `${response.paciente.nombre} ${response.paciente.apell1}`,
          icon: "success",
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        setPacienteExiste(false);
        setCiVerificado(true); // ✅ Ya verificamos, simplemente no existe
        setIsReadOnly(false);
        setPaciente(prev => ({
          ...prev,
          ci: ciToCheck,
          nombre: "", apell1: "", apell2: "", telefono: "", direccion: ""
        }));
        setConsultas([]);
      }
    } catch (error: any) {
      Swal.fire("Error", error.toString(), "error");
      setCiVerificado(false); // En caso de error, no marcamos como verificado
    } finally {
      setVerificandoCI(false);
    }
  };

  const limpiarEstadoCI = () => {
    setPacienteExiste(false);
    setCiVerificado(false);
    setIsReadOnly(false);
    setPaciente({ ci: "", nombre: "", apell1: "", apell2: "", telefono: "", direccion: "" });
    setConsultas([]);
  };

  // --- 2. Guardar Paciente ---
  const guardarPaciente = async () => {
    if (!paciente.nombre.trim() || !paciente.apell1.trim()) {
      return Swal.fire("Error", "Nombre y primer apellido son obligatorios", "error");
    }

    try {
      Swal.fire({ title: "Guardando...", didOpen: () => Swal.showLoading() });
      const response: any = await invoke("crear_paciente", { datos: paciente });
      Swal.close();

      if (response.success) {
        setPaciente(prev => ({ ...prev, id: response.paciente_id }));
        setPacienteExiste(true);
        setCiVerificado(true);
        setIsReadOnly(true);
        cargarConsultas(response.paciente_id);
        Swal.fire("¡Éxito!", response.message, "success");
      }
    } catch (error: any) {
      Swal.close();
      Swal.fire("Error", error.toString(), "error");
    }
  };

  // --- 3. Cargar Consultas ---
  const cargarConsultas = async (pacienteId: number) => {
    setLoadingConsultas(true);
    try {
      const response: any = await invoke("obtener_historico_paciente", { pacienteId });
      setConsultas(response.data || []);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoadingConsultas(false);
    }
  };

  // --- 4. Guardar Consulta ---
  const guardarConsulta = async () => {
    if (!paciente.id) {
      return Swal.fire("Error", "Primero debe guardar o seleccionar un paciente", "error");
    }

    try {
      Swal.fire({ title: "Guardando consulta...", didOpen: () => Swal.showLoading() });
      const response: any = await invoke("crear_consulta", {
        datos: { paciente_id: paciente.id, ...consultaData }
      });
      Swal.close();

      if (response.success) {
        Swal.fire("¡Éxito!", response.message, "success");
        setShowConsultaForm(false);
        setConsultaData({
          refraccion: "", ojo_derecho: "", ojo_izquierdo: "", add: "",
          galenos: "", corta_y_monta: "", observaciones: ""
        });
        cargarConsultas(paciente.id);
      }
    } catch (error: any) {
      Swal.close();
      Swal.fire("Error", error.toString(), "error");
    }
  };

  // --- 5. Eliminar Consulta ---
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
          if (paciente.id) cargarConsultas(paciente.id);
        } else {
          Swal.fire("Error", response.error || "No se pudo eliminar", "error");
        }
      } catch (error: any) {
        Swal.close();
        Swal.fire("Error", error.toString(), "error");
      }
    }
  };

  // --- 6. Ver Detalle ---
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

  // --- Handlers de Input ---
  const handleCIChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 11);
    setCi(value);
    setPaciente(prev => ({ ...prev, ci: value }));

    // Si el usuario borra dígitos, limpiamos el estado
    if (value.length < 11) {
      limpiarEstadoCI();
    }
  };

  // --- ✅ NUEVO: Manejador del botón "Nueva Consulta" con scroll ---
  const handleNuevaConsulta = () => {
    setShowConsultaForm(true);
    // Esperamos un tick para que el DOM renderice el formulario antes de hacer scroll
    setTimeout(() => {
      consultaFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
        <FileText className="w-6 h-6 text-blue-600" />
        Nueva Consulta
      </h1>

      {/* === TARJETA 1: DATOS DEL PACIENTE === */}
      <div ref={pacienteCardRef} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5" /> Datos del Paciente
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {/* CI */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">CI *</label>
            <div className="relative">
              <input
                type="text"
                value={ci}
                onChange={handleCIChange}
                onBlur={() => {
                  // Solo verificamos si tiene 11 dígitos y aún no se verificó
                  if (ci.length === 11 && !ciVerificado && !verificandoCI) {
                    verificarCI(ci);
                  }
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition ${
                  verificandoCI
                    ? "border-yellow-500 bg-yellow-50"
                    : pacienteExiste && ciVerificado
                    ? "border-green-500 bg-green-50"
                    : !pacienteExiste && ciVerificado && ci.length === 11
                    ? "border-red-500 bg-red-50"
                    : "border-gray-300"
                }`}
                placeholder="12345678901"
                maxLength={11}
              />
              <div className="absolute right-3 top-2.5">
                {verificandoCI && <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />}
                {!verificandoCI && pacienteExiste && ciVerificado && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {!verificandoCI && !pacienteExiste && ciVerificado && ci.length === 11 && (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>

            {/* Mensajes condicionales: solo mostramos si ya se verificó */}
            {pacienteExiste && ciVerificado && (
              <p className="text-xs text-green-600 mt-1">Paciente registrado</p>
            )}
            {!pacienteExiste && ciVerificado && ci.length === 11 && (
              <p className="text-xs text-red-600 mt-1">
                Paciente no encontrado, complete los datos
              </p>
            )}
            {ci.length === 11 && !ciVerificado && !verificandoCI && (
              <p className="text-xs text-yellow-600 mt-1">
                Presione Tab o salga del campo para verificar
              </p>
            )}
          </div>

          {/* Nombre y Apellidos */}
          <input
            type="text"
            value={paciente.nombre}
            onChange={(e) => setPaciente({ ...paciente, nombre: e.target.value })}
            readOnly={isReadOnly}
            className={`px-3 py-2 border rounded-lg outline-none ${
              isReadOnly
                ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                : "border-gray-300 focus:ring-2 focus:ring-blue-500"
            }`}
            placeholder="Nombre *"
          />
          <input
            type="text"
            value={paciente.apell1}
            onChange={(e) => setPaciente({ ...paciente, apell1: e.target.value })}
            readOnly={isReadOnly}
            className={`px-3 py-2 border rounded-lg outline-none ${
              isReadOnly
                ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                : "border-gray-300 focus:ring-2 focus:ring-blue-500"
            }`}
            placeholder="1er Apellido *"
          />
          <input
            type="text"
            value={paciente.apell2}
            onChange={(e) => setPaciente({ ...paciente, apell2: e.target.value })}
            readOnly={isReadOnly}
            className={`px-3 py-2 border rounded-lg outline-none ${
              isReadOnly
                ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                : "border-gray-300 focus:ring-2 focus:ring-blue-500"
            }`}
            placeholder="2do Apellido"
          />
          <input
            type="text"
            value={paciente.telefono}
            onChange={(e) => setPaciente({ ...paciente, telefono: e.target.value })}
            readOnly={isReadOnly}
            className={`px-3 py-2 border rounded-lg outline-none ${
              isReadOnly
                ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                : "border-gray-300 focus:ring-2 focus:ring-blue-500"
            }`}
            placeholder="Teléfono"
          />
          <input
            type="text"
            value={paciente.direccion}
            onChange={(e) => setPaciente({ ...paciente, direccion: e.target.value })}
            readOnly={isReadOnly}
            className={`px-3 py-2 border rounded-lg outline-none md:col-span-2 ${
              isReadOnly
                ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                : "border-gray-300 focus:ring-2 focus:ring-blue-500"
            }`}
            placeholder="Dirección"
          />
        </div>

        <div className="mt-4 flex gap-3">
          {!pacienteExiste && ciVerificado && ci.length === 11 && (
            <button
              onClick={guardarPaciente}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <Save className="w-4 h-4" /> Guardar Paciente
            </button>
          )}
          <button
            onClick={() => {
              setCi("");
              limpiarEstadoCI();
              setShowConsultaForm(false);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            <X className="w-4 h-4" /> Limpiar
          </button>
        </div>
      </div>

      {/* === TARJETA 2: ÚLTIMAS CONSULTAS === */}
      {paciente.id && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <FileText className="w-5 h-5" /> Últimas Consultas
            </h2>
            {!showConsultaForm && (
              <button
                onClick={handleNuevaConsulta}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <FileText className="w-4 h-4" /> Nueva Consulta
              </button>
            )}
          </div>

          {loadingConsultas ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : consultas.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              No hay consultas previas para este paciente.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-600">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Refracción</th>
                    <th className="px-4 py-3">OD</th>
                    <th className="px-4 py-3">OI</th>
                    <th className="px-4 py-3">Add</th>
                    <th className="px-4 py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {consultas.map((c) => (
                    <tr key={c.id} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {new Date(c.created).toLocaleString("es-CU")}
                      </td>
                      <td className="px-4 py-3">{c.refraccion || "-"}</td>
                      <td className="px-4 py-3">{c.ojo_derecho || "-"}</td>
                      <td className="px-4 py-3">{c.ojo_izquierdo || "-"}</td>
                      <td className="px-4 py-3">{c.add || "-"}</td>
                      <td className="px-4 py-3 text-center flex justify-center gap-2">
                        <button
                          onClick={() => verDetalle(c.id)}
                          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {c.es_hoy && c.es_ultima && (
                          <button
                            onClick={() => eliminarConsulta(c.id)}
                            className="p-1.5 text-red-600 hover:bg-red-100 rounded transition"
                            title="Eliminar (Última del día)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* === TARJETA 3: FORMULARIO DE CONSULTA (con ref para scroll) === */}
      {showConsultaForm && (
        <div
          ref={consultaFormRef}
          className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-blue-600"
        >
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" /> Datos de la Consulta
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <input
              type="text"
              value={consultaData.refraccion}
              onChange={(e) => setConsultaData({ ...consultaData, refraccion: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Refracción (Ej: -2.00 -1.00 x180)"
            />
            <input
              type="text"
              value={consultaData.ojo_derecho}
              onChange={(e) => setConsultaData({ ...consultaData, ojo_derecho: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ojo Derecho"
            />
            <input
              type="text"
              value={consultaData.ojo_izquierdo}
              onChange={(e) => setConsultaData({ ...consultaData, ojo_izquierdo: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ojo Izquierdo"
            />
            <input
              type="text"
              value={consultaData.add}
              onChange={(e) => setConsultaData({ ...consultaData, add: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Add (Ej: +2.00)"
            />
            <input
              type="text"
              value={consultaData.galenos}
              onChange={(e) => setConsultaData({ ...consultaData, galenos: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Galenos"
            />
            <input
              type="text"
              value={consultaData.corta_y_monta}
              onChange={(e) => setConsultaData({ ...consultaData, corta_y_monta: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Corta y Monta"
            />
            <textarea
              value={consultaData.observaciones}
              onChange={(e) => setConsultaData({ ...consultaData, observaciones: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none md:col-span-3"
              rows={3}
              placeholder="Observaciones adicionales..."
            />
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={guardarConsulta}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              <Save className="w-4 h-4" /> Guardar Consulta
            </button>
            <button
              onClick={() => {
                setShowConsultaForm(false);
                setConsultaData({
                  refraccion: "", ojo_derecho: "", ojo_izquierdo: "", add: "",
                  galenos: "", corta_y_monta: "", observaciones: ""
                });
              }}
              className="flex items-center gap-2 px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
