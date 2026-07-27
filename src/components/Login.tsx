// src/components/Login.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import { Eye, EyeOff, User, Lock, UserPlus } from "lucide-react";

export default function Login() {
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Verificar si ya existe un usuario al montar el componente
  useEffect(() => {
    checkFirstRun();
  }, []);

  const checkFirstRun = async () => {
    try {
      const hasUsers = await invoke<boolean>("has_users");
      setIsFirstRun(!hasUsers);
    } catch (error) {
      Swal.fire("Error", "No se pudo conectar con el backend", "error");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return Swal.fire("Error", "Las contraseñas no coinciden", "error");
    }
    if (password.length < 4) {
      return Swal.fire("Error", "La contraseña debe tener al menos 4 caracteres", "error");
    }

    setLoading(true);
    try {
      await invoke("register_first_user", { username, password });
      Swal.fire("¡Éxito!", "Usuario creado correctamente. Ahora inicia sesión.", "success");
      setIsFirstRun(false);
      setUsername("");
      setPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      Swal.fire("Error", error.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const success = await invoke<boolean>("login", { username, password });
      if (success) {
        Swal.fire({
          title: "¡Bienvenido!",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
        navigate("/app");
      } else {
        Swal.fire("Error", "Usuario o contraseña incorrectos", "error");
      }
    } catch (error: any) {
      Swal.fire("Error", error.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  // Mientras verifica el estado inicial, mostrar un loader
  if (isFirstRun === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800">Óptica 20/20</h1>
          <p className="mt-2 text-gray-600">
            {isFirstRun ? "Configuración Inicial del Sistema" : "Inicia sesión en tu cuenta"}
          </p>
        </div>

        <form onSubmit={isFirstRun ? handleRegister : handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Usuario</label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="admin"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Contraseña</label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {isFirstRun && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirmar Contraseña</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : isFirstRun ? (
              <>
                <UserPlus className="w-5 h-5" /> Crear Usuario
              </>
            ) : (
              <>Iniciar Sesión</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
