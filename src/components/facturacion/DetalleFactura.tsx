import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import {
  Receipt, ArrowLeft, Plus, Loader2, DollarSign,
  Calendar, CreditCard, AlertCircle, CheckCircle2, XCircle
} from "lucide-react";

interface Factura {
  id: number;
  numero: string;
  paciente_nombre: string | null;
  paciente_ci: string | null;
  fecha: string;
  subtotal: number;
  descuento: number;
  total: number;
  estado: string;
  metodo_pago: string | null;
  total_pagado: number;
  saldo_pendiente: number;
}

interface Item {
  id: number;
  tipo_item: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  costo_unitario: number;
  porcentaje_ganancia: number;
}

interface Pago {
  id: number;
  monto: number;
  metodo_pago: string;
  fecha: string;
  referencia: string;
  observaciones: string;
}

export default function DetalleFactura() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [factura, setFactura] = useState<Factura | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [formPago, setFormPago] = useState({
    monto: 0,
    metodo_pago: "EFECTIVO",
    referencia: "",
    observaciones: ""
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) cargarDetalle(Number(id));
  }, [id]);

  const cargarDetalle = async (facturaId: number) => {
    setLoading(true);
    try {
      const data: any = await invoke("obtener_factura_detalle", { facturaId });
      setFactura(data.factura);
      setItems(data.items || []);
      setPagos(data.pagos || []);
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  const abrirPago = () => {
    if (!factura) return;
    setFormPago({
      monto: factura.saldo_pendiente,
      metodo_pago: "EFECTIVO",
      referencia: "",
      observaciones: ""
    });
    setShowPagoModal(true);
  };

  const registrarPago = async () => {
    if (!factura) return;
    if (formPago.monto <= 0) return Swal.fire("Error", "El monto debe ser mayor a 0", "error");
    if (formPago.monto > factura.saldo_pendiente) {
      return Swal.fire("Error", `El monto no puede superar el saldo pendiente ($${factura.saldo_pendiente.toFixed(2)})`, "error");
    }

    setSaving(true);
    try {
      const r: any = await invoke("registrar_pago", {
        datos: {
          factura_id: factura.id,
          monto: formPago.monto,
          metodo_pago: formPago.metodo_pago,
          referencia: formPago.referencia,
          observaciones: formPago.observaciones
        }
      });
      Swal.fire("¡Éxito!", r.message, "success");
      setShowPagoModal(false);
      cargarDetalle(factura.id);
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setSaving(false);
    }
  };

  const anularFactura = async () => {
    if (!factura) return;
    if (factura.estado === "ANULADA") {
      return Swal.fire("Aviso", "Esta factura ya está anulada", "info");
    }

    const result = await Swal.fire({
      title: "¿Anular factura?",
      html: `La factura <strong>${factura.numero}</strong> será marcada como anulada.<br/>
             <span class="text-red-600 text-sm">Esta acción no puede deshacerse.</span>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Sí, anular",
      cancelButtonText: "Cancelar"
    });

    if (!result.isConfirmed) return;

    try {
      Swal.fire({ title: "Anulando...", didOpen: () => Swal.showLoading() });
      await invoke("anular_factura", { facturaId: factura.id });
      Swal.close();
      Swal.fire("Anulada", "La factura ha sido anulada", "success");
      cargarDetalle(factura.id);
    } catch (e: any) {
      Swal.close();
      Swal.fire("Error", e.toString(), "error");
    }
  };

  const estadoConfig = (estado: string) => {
    switch (estado) {
      case "PENDIENTE": return { color: "bg-red-100 text-red-700 border-red-200", icon: XCircle };
      case "PARCIAL": return { color: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertCircle };
      case "PAGADA": return { color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 };
      case "ANULADA": return { color: "bg-gray-100 text-gray-700 border-gray-200", icon: XCircle };
      default: return { color: "bg-gray-100 text-gray-700 border-gray-200", icon: AlertCircle };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!factura) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Factura no encontrada</p>
        <button onClick={() => navigate("/app/facturacion/lista")} className="mt-4 text-blue-600 hover:underline">
          Volver a la lista
        </button>
      </div>
    );
  }

  const { color: estadoColor, icon: EstadoIcon } = estadoConfig(factura.estado);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/app/facturacion/lista")}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Receipt className="w-6 h-6 text-blue-600" />
              Factura {factura.numero}
            </h1>
            <p className="text-sm text-gray-500">
              Emitida el {new Date(factura.fecha).toLocaleString("es-CU")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {factura.estado !== "ANULADA" && factura.estado !== "PAGADA" && (
            <button
              onClick={abrirPago}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Plus className="w-4 h-4" /> Registrar Pago
            </button>
          )}
          {factura.estado !== "ANULADA" && (
            <button
              onClick={anularFactura}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <XCircle className="w-4 h-4" /> Anular
            </button>
          )}
        </div>
      </div>

      {/* Info general */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda: Datos */}
        <div className="lg:col-span-2 space-y-6">
          {/* Estado y totales */}
          <div className={`border-2 rounded-lg p-4 ${estadoColor}`}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <EstadoIcon className="w-6 h-6" />
                <span className="font-bold text-lg">Estado: {factura.estado}</span>
              </div>
              <div className="text-right">
                <p className="text-sm">Total</p>
                <p className="text-2xl font-bold">${factura.total.toFixed(2)}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-current/20">
              <div>
                <p className="text-xs opacity-75">Subtotal</p>
                <p className="font-semibold">${factura.subtotal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs opacity-75">Descuento</p>
                <p className="font-semibold">${factura.descuento.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs opacity-75">Pagado</p>
                <p className="font-semibold">${factura.total_pagado.toFixed(2)}</p>
              </div>
            </div>
            {factura.saldo_pendiente > 0 && (
              <div className="mt-3 pt-3 border-t border-current/20 flex justify-between">
                <span className="font-semibold">Saldo pendiente:</span>
                <span className="font-bold text-xl">${factura.saldo_pendiente.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-800">Items de la Factura</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Descripción</th>
                  <th className="px-4 py-2 text-center">Cant.</th>
                  <th className="px-4 py-2 text-right">Precio</th>
                  <th className="px-4 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="font-medium">{item.descripcion}</div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        item.tipo_item === "PRODUCTO" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                      }`}>
                        {item.tipo_item}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">{item.cantidad}</td>
                    <td className="px-4 py-2 text-right">${item.precio_unitario.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right font-semibold">${item.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Historial de pagos */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h2 className="font-semibold text-gray-800">Historial de Pagos</h2>
              <span className="text-sm text-gray-600">{pagos.length} pago(s)</span>
            </div>
            {pagos.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <DollarSign className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No hay pagos registrados</p>
              </div>
            ) : (
              <div className="divide-y">
                {pagos.map(pago => (
                  <div key={pago.id} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium">{pago.metodo_pago}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(pago.fecha).toLocaleString("es-CU")}
                          </p>
                          {pago.referencia && (
                            <p className="text-xs text-gray-500 mt-1">Ref: {pago.referencia}</p>
                          )}
                          {pago.observaciones && (
                            <p className="text-xs text-gray-600 mt-1 italic">{pago.observaciones}</p>
                          )}
                        </div>
                      </div>
                      <p className="font-bold text-green-700 text-lg">+${pago.monto.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha: Info del paciente */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Receipt className="w-4 h-4" /> Información
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500">Número</p>
                <p className="font-mono font-semibold">{factura.numero}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Fecha</p>
                <p className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(factura.fecha).toLocaleString("es-CU")}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Método de pago</p>
                <p className="font-medium">{factura.metodo_pago || "No definido"}</p>
              </div>
              {factura.paciente_nombre ? (
                <>
                  <hr className="my-2" />
                  <div>
                    <p className="text-xs text-gray-500">Paciente</p>
                    <p className="font-semibold">{factura.paciente_nombre}</p>
                    <p className="text-xs text-gray-500">CI: {factura.paciente_ci}</p>
                  </div>
                </>
              ) : (
                <>
                  <hr className="my-2" />
                  <div>
                    <p className="text-xs text-gray-500">Tipo de venta</p>
                    <p className="italic text-gray-500">Venta directa (sin paciente)</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Barra de progreso de pago */}
          {factura.total > 0 && factura.estado !== "ANULADA" && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-800 mb-3">Progreso de Pago</h3>
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold inline-block text-blue-600">
                      {((factura.total_pagado / factura.total) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold inline-block text-gray-600">
                      ${factura.total_pagado.toFixed(2)} / ${factura.total.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                  <div
                    style={{ width: `${Math.min(100, (factura.total_pagado / factura.total) * 100)}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-600 transition-all"
                  />
                </div>
              </div>
              {factura.saldo_pendiente > 0 && (
                <p className="text-sm text-amber-700 mt-3 font-medium">
                  Faltan ${factura.saldo_pendiente.toFixed(2)} por cobrar
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de pago */}
      {showPagoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold">Registrar Pago</h2>
              <button onClick={() => setShowPagoModal(false)} className="p-2 hover:bg-gray-100 rounded">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  Saldo pendiente: <strong className="text-lg">${factura.saldo_pendiente.toFixed(2)}</strong>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
                <input
                  type="number"
                  min={0.01}
                  max={factura.saldo_pendiente}
                  step={0.01}
                  value={formPago.monto}
                  onChange={e => setFormPago({ ...formPago, monto: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setFormPago({ ...formPago, monto: factura.saldo_pendiente })}
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Cobrar todo
                  </button>
                  <button
                    onClick={() => setFormPago({ ...formPago, monto: factura.saldo_pendiente / 2 })}
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    50%
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de pago *</label>
                <select
                  value={formPago.metodo_pago}
                  onChange={e => setFormPago({ ...formPago, metodo_pago: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
                <input
                  type="text"
                  value={formPago.referencia}
                  onChange={e => setFormPago({ ...formPago, referencia: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Ej: Número de transferencia"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea
                  value={formPago.observaciones}
                  onChange={e => setFormPago({ ...formPago, observaciones: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
              <button onClick={() => setShowPagoModal(false)} className="px-4 py-2 bg-gray-200 rounded-lg" disabled={saving}>
                Cancelar
              </button>
              <button
                onClick={registrarPago}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                Registrar Pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}