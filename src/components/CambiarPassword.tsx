  // src/components/CambiarPassword.tsx
  import { useState } from "react";
  import { invoke } from "@tauri-apps/api/core";
  import Swal from "sweetalert2";
  import { Key, Save, Eye, EyeOff, Loader2 } from "lucide-react";

  export default function CambiarPassword() {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();

      // Validaciones
      if (!currentPassword || !newPassword || !confirmPassword) {
        return Swal.fire("Error", "Todos los campos son obligatorios", "error");
      }

      if (newPassword.length < 4) {
        return Swal.fire("Error", "La nueva contraseña debe tener al menos 4 caracteres", "error");
      }

      if (newPassword !== confirmPassword) {
        return Swal.fire("Error", "Las contraseñas nuevas no coinciden", "error");
      }

      if (currentPassword === newPassword) {
        return Swal.fire("Error", "La nueva contraseña debe ser diferente a la actual", "error");
      }

      setLoading(true);
      try {
        Swal.fire({ title: "Cambiando contraseña...", didOpen: () => Swal.showLoading() });

        const success = await invoke<boolean>("change_password", {
          currentPassword,
          newPassword
        });

        Swal.close();

        if (success) {
          Swal.fire({
            title: "¡Éxito!",
            text: "Contraseña cambiada correctamente",
            icon: "success",
            timer: 2000,
            showConfirmButton: false
          });

          // Limpiar formulario
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        }
      } catch (error: any) {
        Swal.close();
        Swal.fire("Error", error.toString(), "error");
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Key className="w-6 h-6 text-blue-600" />
          Cambiar Contraseña
        </h1>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Contraseña Actual */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña Actual
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Nueva Contraseña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nueva Contraseña
              </label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Mínimo 4 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirmar Nueva Contraseña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar Nueva Contraseña
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Repite la nueva contraseña"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Botón Guardar */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Cambiar Contraseña
            </button>
          </form>
        </div>

        {/* Nota informativa */}
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Nota:</strong> La contraseña se almacena de forma segura usando el algoritmo Argon2.
            Después de cambiarla, deberás usar la nueva contraseña para iniciar sesión la próxima vez.
          </p>
        </div>
      </div>
    );
  }
