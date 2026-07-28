// src/components/BackupRestore.tsx
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import { Database, Download, Upload, Loader2, Shield, AlertTriangle } from "lucide-react";

export default function BackupRestore() {
  const [loadingBackup, setLoadingBackup] = useState(false);
  const [loadingRestore, setLoadingRestore] = useState(false);

  const handleBackup = async () => {
    setLoadingBackup(true);
    try {
      const response: any = await invoke("crear_backup");

      if (response.cancelled) {
        return;
      }

      if (response.success) {
        Swal.fire({
          title: "¡Backup creado!",
          html: `
            <p class="text-sm">Tu base de datos se guardó correctamente.</p>
            <p class="text-xs text-gray-500 mt-2 break-all">${response.path}</p>
          `,
          icon: "success",
          confirmButtonText: "Aceptar"
        });
      }
    } catch (error: any) {
      Swal.fire("Error", error.toString(), "error");
    } finally {
      setLoadingBackup(false);
    }
  };

  const handleRestore = async () => {
    // Confirmación inicial
    const confirm1 = await Swal.fire({
      title: "¿Restaurar base de datos?",
      html: `
        <p>Esta acción <strong>reemplazará</strong> todos los datos actuales con los del backup.</p>
        <p class="text-sm text-gray-600 mt-2">Se creará automáticamente un backup de seguridad antes de restaurar.</p>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, continuar",
      cancelButtonText: "Cancelar"
    });

    if (!confirm1.isConfirmed) return;

    // Segunda confirmación por seguridad
    const confirm2 = await Swal.fire({
      title: "¿Estás completamente seguro?",
      text: "Los datos actuales se perderán y se reemplazarán por los del backup.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, restaurar",
      cancelButtonText: "Cancelar"
    });

    if (!confirm2.isConfirmed) return;

    setLoadingRestore(true);
    try {
      const response: any = await invoke("restaurar_backup");

      if (response.cancelled) {
        return;
      }

      if (response.success) {
        await Swal.fire({
          title: "¡Restauración exitosa!",
          html: `
            <p class="text-sm">La base de datos se restauró correctamente.</p>
            <p class="text-xs text-gray-500 mt-2">Se creó un backup de seguridad en:</p>
            <p class="text-xs break-all text-blue-600">${response.auto_backup}</p>
            <p class="text-sm mt-3"><strong>La aplicación se reiniciará para aplicar los cambios.</strong></p>
          `,
          icon: "success",
          confirmButtonText: "Reiniciar ahora",
          allowOutsideClick: false
        });

        // Recargar la aplicación
        window.location.reload();
      }
    } catch (error: any) {
      Swal.fire("Error", error.toString(), "error");
    } finally {
      setLoadingRestore(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
        <Database className="w-6 h-6 text-blue-600" />
        Backup y Restauración
      </h1>

      {/* Información general */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">¿Por qué hacer backups?</p>
            <p>
              Los backups te permiten proteger tus datos ante fallos del sistema, 
              errores accidentales o antes de actualizar a una nueva versión. 
              Se recomienda hacer un backup al menos una vez por semana.
            </p>
          </div>
        </div>
      </div>

      {/* Tarjeta de Backup */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <Download className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-800">Crear Backup</h2>
              <p className="text-sm text-gray-600 mt-1">
                Guarda una copia de seguridad de todos tus datos (pacientes, consultas, usuarios) 
                en la ubicación que elijas.
              </p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <ul className="text-sm text-gray-600 space-y-2 mb-4">
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✓</span>
              <span>Se guardará como un archivo <code className="bg-gray-100 px-1 rounded">.db</code> con la fecha actual</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✓</span>
              <span>Puedes guardarlo en tu PC, USB, Google Drive, etc.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✓</span>
              <span>No interrumpe el uso de la aplicación</span>
            </li>
          </ul>
          <button
            onClick={handleBackup}
            disabled={loadingBackup}
            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingBackup ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            Crear Backup Ahora
          </button>
        </div>
      </div>

      {/* Tarjeta de Restauración */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Upload className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-800">Restaurar desde Backup</h2>
              <p className="text-sm text-gray-600 mt-1">
                Reemplaza los datos actuales con los de un backup previo. 
                Úsalo si necesitas recuperar datos perdidos.
              </p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">Importante:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Los datos actuales serán reemplazados</li>
                <li>Se creará automáticamente un backup de seguridad antes de restaurar</li>
                <li>La aplicación se reiniciará después de la restauración</li>
              </ul>
            </div>
          </div>
          <button
            onClick={handleRestore}
            disabled={loadingRestore}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingRestore ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
            Restaurar desde Backup
          </button>
        </div>
      </div>
    </div>
  );
}