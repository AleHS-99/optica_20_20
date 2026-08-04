import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import {
  Package, Loader2, Search, RefreshCw, AlertTriangle
} from "lucide-react";

interface StockProducto {
  producto_id: number;
  producto_codigo: string;
  producto_nombre: string;
  stock_actual: number;
  valor_total: number;
  costo_promedio: number;
  stock_minimo: number;
  bajo_stock: number;
}

export default function StockGeneral() {
  const [productos, setProductos] = useState<StockProducto[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [soloBajoStock, setSoloBajoStock] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => { cargar(); }, [page, search, soloBajoStock]);

  const cargar = async () => {
    setLoading(true);
    try {
      const r: any = await invoke("listar_stock_general", {
        soloBajoStock,
        search: search || null,
        page, pageSize
      });
      setProductos(r.data || []);
      setTotal(r.total || 0);
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  const valorTotalInventario = productos.reduce((sum, p) => sum + p.valor_total, 0);
  const productosBajoStock = productos.filter(p => p.bajo_stock === 1).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Package className="w-6 h-6 text-blue-600" /> Stock General
        </h1>
        <div className="flex gap-3">
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <p className="text-xs text-green-700">Valor Total Inventario</p>
            <p className="text-xl font-bold text-green-900">${valorTotalInventario.toFixed(2)}</p>
          </div>
          {productosBajoStock > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              <p className="text-xs text-red-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Productos Bajo Stock
              </p>
              <p className="text-xl font-bold text-red-900">{productosBajoStock}</p>
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por código o nombre..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg" />
          </div>
          <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200">
            <input type="checkbox" checked={soloBajoStock}
              onChange={e => { setSoloBajoStock(e.target.checked); setPage(1); }}
              className="w-4 h-4" />
            <span className="text-sm font-medium">Solo productos bajo stock</span>
          </label>
          <button onClick={() => { setSearch(""); setSoloBajoStock(false); setPage(1); }}
            className="flex items-center gap-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">
            <RefreshCw className="w-4 h-4" /> Limpiar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
        ) : productos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No hay productos en inventario.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3 text-center">Stock Actual</th>
                  <th className="px-4 py-3 text-center">Stock Mínimo</th>
                  <th className="px-4 py-3 text-right">Costo Promedio</th>
                  <th className="px-4 py-3 text-right">Valor Total</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {productos.map(p => (
                  <tr key={p.producto_id} className={`bg-white border-b hover:bg-gray-50 ${p.bajo_stock === 1 ? "bg-red-50" : ""}`}>
                    <td className="px-4 py-3 font-mono text-xs">{p.producto_codigo}</td>
                    <td className="px-4 py-3 font-medium">{p.producto_nombre}</td>
                    <td className="px-4 py-3 text-center font-semibold">{p.stock_actual}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{p.stock_minimo}</td>
                    <td className="px-4 py-3 text-right">${p.costo_promedio.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold">${p.valor_total.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      {p.bajo_stock === 1 ? (
                        <span className="flex items-center justify-center gap-1 text-red-600 font-semibold">
                          <AlertTriangle className="w-4 h-4" /> Bajo Stock
                        </span>
                      ) : (
                        <span className="text-green-600">✓ OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="flex justify-between items-center p-4 border-t bg-gray-50">
            <p className="text-sm text-gray-600">
              Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, total)} de {total} productos
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50">
                Anterior
              </button>
              <span className="px-3 py-1.5 text-sm font-medium">Página {page} de {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50">
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}