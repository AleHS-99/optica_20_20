import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import {
  Receipt, Plus, Trash2, Save, Loader2, X, User, FileText,
  Search, CheckCircle, DollarSign
} from "lucide-react";

interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  tipo: string;
  precio_venta_sugerido: number;
  porcentaje_ganancia_default: number;
}

interface DetalleItem {
  key: string;
  tipo_item: "PRODUCTO" | "SERVICIO";
  producto_id: number | null;
  descripcion: string;
  cantidad: number;
  costo_unitario: number;
  precio_unitario: number;
  porcentaje_ganancia: number;
}

interface Paciente { id: number; ci: string; nombre: string; apell1: string; }
interface Consulta { id: number; created: string; refraccion: string; }

export default function NuevaFactura() {
  const navigate = useNavigate();

  const [ciBuscado, setCiBuscado] = useState("");
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [consultaId, setConsultaId] = useState<number | null>(null);
  const [buscandoPaciente, setBuscandoPaciente] = useState(false);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [stockInfo, setStockInfo] = useState<Map<number, { costo_promedio: number; stock_actual: number }>>(new Map());
  const [items, setItems] = useState<DetalleItem[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);

  const [descuento, setDescuento] = useState(0);
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");
  const [observaciones, setObservaciones] = useState("");

  const [montoPagoInicial, setMontoPagoInicial] = useState(0);
  const [registrarPagoAhora, setRegistrarPagoAhora] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    cargarProductos();
  }, []);

const cargarProductos = async () => {
  try {
    const r: any = await invoke("listar_productos", {
      soloActivos: true, page: 1, pageSize: 1000
    });
    const productosData = r.data || [];
    setProductos(productosData);
    
    // ✅ NUEVO: Obtener stock/PEPS de cada producto
    const stockMap = new Map();
    for (const p of productosData) {
      if (p.tipo === "PRODUCTO") {
        try {
          const stockData: any = await invoke("obtener_stock_producto", {
            productoId: p.id
          });
          stockMap.set(p.id, {
            costo_promedio: stockData.costo_promedio || 0,
            stock_actual: stockData.stock_actual || 0
          });
        } catch (e) {
          console.error(`Error obteniendo stock de ${p.nombre}:`, e);
        }
      }
    }
    setStockInfo(stockMap);
  } catch (e) { console.error(e); }
};

  const buscarPaciente = async () => {
    if (ciBuscado.length !== 11 || !/^\d+$/.test(ciBuscado)) {
      return Swal.fire("Error", "El CI debe tener 11 dígitos", "error");
    }
    setBuscandoPaciente(true);
    try {
      const response: any = await invoke("verificar_ci", { ci: ciBuscado });
      if (response.exists) {
        setPaciente({
          id: response.paciente.id,
          ci: response.paciente.ci,
          nombre: response.paciente.nombre,
          apell1: response.paciente.apell1
        });
        const hist: any = await invoke("obtener_historico_paciente", {
          pacienteId: response.paciente.id
        });
        setConsultas(hist.data || []);
        Swal.fire({
          title: "Paciente encontrado",
          text: `${response.paciente.nombre} ${response.paciente.apell1}`,
          icon: "success",
          timer: 1200,
          showConfirmButton: false
        });
      } else {
        Swal.fire("Aviso", "Paciente no encontrado. Puede crear factura sin paciente.", "info");
        setPaciente(null);
        setConsultas([]);
      }
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setBuscandoPaciente(false);
    }
  };

  const limpiarPaciente = () => {
    setPaciente(null);
    setConsultas([]);
    setConsultaId(null);
    setCiBuscado("");
  };

  // ✅ CÁLCULO CORREGIDO: Precio basado en costo PEPS + % ganancia
  const agregarItemProducto = async (producto: Producto) => {
    let costoPEPS = 0;
    let precioSugerido = producto.precio_venta_sugerido;

    // Si es un producto (no servicio), obtener el costo PEPS actual
    if (producto.tipo === "PRODUCTO") {
      try {
        const stockInfo: any = await invoke("obtener_stock_producto", {
          productoId: producto.id
        });
        costoPEPS = stockInfo.costo_promedio || 0;
        
        // ✅ Si hay costo PEPS, calcular precio sugerido dinámicamente
        if (costoPEPS > 0) {
          precioSugerido = costoPEPS * (1 + producto.porcentaje_ganancia_default / 100);
        }
      } catch (e) {
        console.error("Error obteniendo stock:", e);
      }
    }

    const nuevoItem: DetalleItem = {
      key: `prod-${producto.id}-${Date.now()}`,
      tipo_item: producto.tipo as "PRODUCTO" | "SERVICIO",
      producto_id: producto.id,
      descripcion: producto.nombre,
      cantidad: 1,
      costo_unitario: costoPEPS,
      precio_unitario: precioSugerido,
      porcentaje_ganancia: producto.porcentaje_ganancia_default
    };
    setItems([...items, nuevoItem]);
    setShowAddItem(false);
  };

  const eliminarItem = (key: string) => {
    setItems(items.filter(i => i.key !== key));
  };

  const actualizarItem = (key: string, campo: keyof DetalleItem, valor: any) => {
    setItems(items.map(i => {
      if (i.key !== key) return i;
      const nuevo = { ...i, [campo]: valor };
      
      // Si cambia precio_unitario y hay costo, recalcular % ganancia
      if (campo === "precio_unitario" && i.costo_unitario > 0) {
        nuevo.porcentaje_ganancia = ((valor - i.costo_unitario) / i.costo_unitario) * 100;
      }
      
      return nuevo;
    }));
  };

  const subtotalItems = items.reduce((sum, i) => sum + (i.cantidad * i.precio_unitario), 0);
  const total = subtotalItems - descuento;

  const guardarFactura = async () => {
    if (items.length === 0) {
      return Swal.fire("Error", "Agrega al menos un item a la factura", "error");
    }
    if (total <= 0) {
      return Swal.fire("Error", "El total debe ser mayor a 0", "error");
    }

    setSaving(true);
    try {
      // 1. Crear factura (SIN impuestos)
      const facturaResp: any = await invoke("crear_factura", {
        datos: {
          paciente_id: paciente?.id || null,
          consulta_id: consultaId,
          descuento,
          metodo_pago: metodoPago,
          observaciones
        }
      });

      const facturaIdCreada = facturaResp.factura_id;

      // 2. Agregar cada item
      for (const item of items) {
        await invoke("agregar_item_factura", {
          datos: {
            factura_id: facturaIdCreada,
            tipo_item: item.tipo_item,
            producto_id: item.producto_id,
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            costo_unitario: item.costo_unitario,
            precio_unitario: item.precio_unitario,
            porcentaje_ganancia: item.porcentaje_ganancia
          }
        });
      }

      // 3. Registrar pago inicial si aplica
      if (registrarPagoAhora && montoPagoInicial > 0) {
        await invoke("registrar_pago", {
          datos: {
            factura_id: facturaIdCreada,
            monto: montoPagoInicial,
            metodo_pago: metodoPago
          }
        });
      }

      Swal.fire({
        title: "¡Factura creada!",
        html: `
          <p>Número: <strong class="text-blue-600">${facturaResp.numero}</strong></p>
          <p>Total: <strong>$${total.toFixed(2)}</strong></p>
        `,
        icon: "success",
        confirmButtonText: "Ver lista de facturas"
      }).then(() => {
        navigate("/app/facturacion/lista");
      });

    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Receipt className="w-6 h-6 text-blue-600" /> Nueva Factura
        </h1>
        <button
          onClick={() => navigate("/app/facturacion/lista")}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          <X className="w-4 h-4" /> Cancelar
        </button>
      </div>

      {/* SECCIÓN 1: PACIENTE Y CONSULTA */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <User className="w-5 h-5" /> Paciente (opcional)
        </h2>

        {!paciente ? (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={ciBuscado}
                onChange={e => setCiBuscado(e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="Buscar por CI (11 dígitos)..."
                maxLength={11}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              onClick={buscarPaciente}
              disabled={buscandoPaciente || ciBuscado.length !== 11}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {buscandoPaciente ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
            </button>
            <div className="text-sm text-gray-500 self-center italic">
              O deja vacío para venta directa
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">
                    {paciente.nombre} {paciente.apell1}
                  </p>
                  <p className="text-sm text-green-700">CI: {paciente.ci}</p>
                </div>
              </div>
              <button onClick={limpiarPaciente} className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1">
                <X className="w-4 h-4" /> Quitar
              </button>
            </div>

            {consultas.length > 0 && (
              <div className="mt-4 pt-4 border-t border-green-200">
                <label className="block text-sm font-medium text-green-800 mb-1">
                  Vincular a consulta (opcional):
                </label>
                <select
                  value={consultaId || ""}
                  onChange={e => setConsultaId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-green-300 rounded-lg bg-white"
                >
                  <option value="">Sin vincular a consulta</option>
                  {consultas.map(c => (
                    <option key={c.id} value={c.id}>
                      {new Date(c.created).toLocaleString("es-CU")} {c.refraccion && `- ${c.refraccion}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECCIÓN 2: ITEMS DE LA FACTURA */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <FileText className="w-5 h-5" /> Items de la Factura
          </h2>
          <button
            onClick={() => setShowAddItem(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Agregar Item
          </button>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p>No hay items en la factura</p>
            <p className="text-sm mt-1">Agrega productos o servicios</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-3 py-2">Descripción</th>
                  <th className="px-3 py-2 text-center">Cant.</th>
                  <th className="px-3 py-2 text-right">Precio Unit.</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                  <th className="px-3 py-2 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.key} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.descripcion}
                        onChange={e => actualizarItem(item.key, "descripcion", e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={item.cantidad}
                        onChange={e => actualizarItem(item.key, "cantidad", Number(e.target.value))}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.precio_unitario}
                        onChange={e => actualizarItem(item.key, "precio_unitario", Number(e.target.value))}
                        className="w-28 px-2 py-1 border border-gray-300 rounded text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">
                      ${(item.cantidad * item.precio_unitario).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => eliminarItem(item.key)}
                        className="p-1.5 text-red-600 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right">Subtotal items:</td>
                  <td className="px-3 py-2 text-right">${subtotalItems.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* SECCIÓN 3: TOTALES */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5" /> Totales y Configuración
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descuento</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={descuento}
              onChange={e => setDescuento(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
            <select
              value={metodoPago}
              onChange={e => setMetodoPago(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="MIXTO">Mixto</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <input
              type="text"
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Notas adicionales..."
            />
          </div>
        </div>

        <div className="mt-6 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>${subtotalItems.toFixed(2)}</span>
            </div>
            {descuento > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Descuento:</span>
                <span>-${descuento.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold text-blue-900 pt-2 border-t border-blue-300">
              <span>TOTAL:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={registrarPagoAhora}
              onChange={e => setRegistrarPagoAhora(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="font-medium text-amber-900">Registrar pago inicial ahora</span>
          </label>
          {registrarPagoAhora && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-amber-800 mb-1">Monto del pago</label>
              <input
                type="number"
                min={0}
                max={total}
                step={0.01}
                value={montoPagoInicial}
                onChange={e => setMontoPagoInicial(Number(e.target.value))}
                className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-white"
                placeholder="Ej: 1500.00"
              />
              {montoPagoInicial > 0 && montoPagoInicial < total && (
                <p className="text-xs text-amber-700 mt-1">
                  Saldo pendiente: ${(total - montoPagoInicial).toFixed(2)}
                </p>
              )}
              {montoPagoInicial >= total && total > 0 && (
                <p className="text-xs text-green-700 mt-1 font-semibold">
                  ✓ Factura quedará como PAGADA
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={() => navigate("/app/facturacion/lista")}
          className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          onClick={guardarFactura}
          disabled={saving || items.length === 0}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Guardar Factura
        </button>
      </div>

      {/* MODAL AGREGAR ITEM */}
      {showAddItem && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
      <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
        <h2 className="text-xl font-bold">Agregar Item a la Factura</h2>
        <button onClick={() => setShowAddItem(false)} className="p-2 hover:bg-gray-100 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {productos.map(p => {
            const info = stockInfo.get(p.id);
            const costoPEPS = info?.costo_promedio || 0;
            const stockActual = info?.stock_actual || 0;
            
            // ✅ Calcular precio sugerido dinámicamente
            const precioSugerido = p.tipo === "PRODUCTO" && costoPEPS > 0
              ? costoPEPS * (1 + p.porcentaje_ganancia_default / 100)
              : p.precio_venta_sugerido;
            
            return (
              <button
                key={p.id}
                onClick={() => agregarItemProducto(p)}
                className="p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition text-left"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-gray-800">{p.nombre}</p>
                    <p className="text-xs text-gray-500 font-mono">{p.codigo}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${
                      p.tipo === "PRODUCTO" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                    }`}>
                      {p.tipo}
                    </span>
                  </div>
                </div>
                
                {/* ✅ NUEVO: Mostrar costo PEPS y precio sugerido calculado */}
                {p.tipo === "PRODUCTO" && info && (
                  <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Costo PEPS:</span>
                      <span className="font-semibold text-gray-800">${costoPEPS.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Stock:</span>
                      <span className={`font-semibold ${stockActual === 0 ? "text-red-600" : "text-green-600"}`}>
                        {stockActual} unidades
                      </span>
                    </div>
                    <div className="flex justify-between text-sm pt-1">
                      <span className="text-gray-700 font-medium">Precio sugerido:</span>
                      <span className="font-bold text-blue-700">${precioSugerido.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-gray-500 text-right">
                      +{p.porcentaje_ganancia_default}% ganancia
                    </div>
                  </div>
                )}
                
                {/* Para servicios, mostrar precio base */}
                {p.tipo === "SERVICIO" && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700 font-medium">Precio:</span>
                      <span className="font-bold text-blue-700">${p.precio_venta_sugerido.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {productos.length === 0 && (
          <p className="text-center text-gray-500 py-8">No hay productos disponibles</p>
        )}
      </div>
    </div>
  </div>
)}
    </div>
  );
}