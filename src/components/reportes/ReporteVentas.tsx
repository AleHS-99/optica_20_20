// src/components/reportes/ReporteVentas.tsx
import { Fragment, useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import {
  BarChart3, Calendar, FileDown, Loader2, ChevronDown, ChevronRight,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface DesgloseCosto {
  costo_unitario: number;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
  costo_total: number;
  ganancia: number;
}

interface ProductoReporte {
  producto_id: number;
  producto_codigo: string;
  producto_nombre: string;
  cantidad_total: number;
  costo_promedio: number;
  precio_promedio: number;
  subtotal_total: number;
  costo_total: number;
  ganancia_total: number;
  desglose: DesgloseCosto[];
}

interface ResumenVentas {
  fecha_desde: string;
  fecha_hasta: string;
  ventas_totales: number;
  costo_ventas: number;
  ganancias: number;
  cantidad_facturas: number;
  cantidad_items: number;
}

interface ReporteVentas {
  resumen: ResumenVentas;
  productos: ProductoReporte[];
}

const hoyISO = () => new Date().toISOString().split("T")[0];

export default function ReporteVentas() {
  const [fechaDesde, setFechaDesde] = useState(hoyISO());
  const [fechaHasta, setFechaHasta] = useState(hoyISO());
  const [data, setData] = useState<ReporteVentas | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaDesde, fechaHasta]);

  const cargar = async () => {
    setLoading(true);
    try {
      const r: any = await invoke("obtener_reporte_ventas", {
        fechaDesde,
        fechaHasta,
      });
      setData(r);
      // Auto-expandir productos que tengan más de un costo
      const autoExpand = new Set<number>();
      (r.productos as ProductoReporte[]).forEach((p) => {
        if (p.desglose.length > 1) autoExpand.add(p.producto_id);
      });
      setExpanded(autoExpand);
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatearFecha = (f: string) => {
    const [y, m, d] = f.split("-");
    return `${d}/${m}/${y}`;
  };

  const setHoy = () => {
    const h = hoyISO();
    setFechaDesde(h);
    setFechaHasta(h);
  };

  const setEsteMes = () => {
    const h = new Date();
    const inicio = new Date(h.getFullYear(), h.getMonth(), 1);
    setFechaDesde(inicio.toISOString().split("T")[0]);
    setFechaHasta(h.toISOString().split("T")[0]);
  };

  // ============================================================
  // PDF
  // ============================================================
  const generarPDF = async () => {
    if (!data) return;
    try {
      const doc = new jsPDF();

      doc.setFontSize(20);
      doc.setTextColor(15, 23, 42);
      doc.text("Reporte de Ventas", 14, 22);

      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139);
      const rango =
        fechaDesde === fechaHasta
          ? `Fecha: ${formatearFecha(fechaDesde)}`
          : `Período: ${formatearFecha(fechaDesde)} al ${formatearFecha(fechaHasta)}`;
      doc.text(`${rango}  |  Óptica 20/20`, 14, 30);

      let startY = 40;

      // --- Resumen ---
      autoTable(doc, {
        startY,
        head: [["Ventas del Período", "Costo de Ventas", "Ganancias del Período"]],
        body: [[
          `$${data.resumen.ventas_totales.toFixed(2)}`,
          `$${data.resumen.costo_ventas.toFixed(2)}`,
          `$${data.resumen.ganancias.toFixed(2)}`,
        ]],
        theme: "grid",
        headStyles: { fillColor: [15, 23, 42], halign: "center" },
        bodyStyles: { halign: "center", fontStyle: "bold", fontSize: 12 },
      });

      startY = (doc as any).lastAutoTable.finalY + 4;

      // --- Info extra ---
      autoTable(doc, {
        startY,
        body: [[
          `Facturas: ${data.resumen.cantidad_facturas}`,
          `Items vendidos: ${data.resumen.cantidad_items.toFixed(0)}`,
        ]],
        theme: "plain",
        styles: { fontSize: 10, textColor: [100, 116, 139] },
        columnStyles: { 0: { halign: "left" }, 1: { halign: "right" } },
      });

      startY = (doc as any).lastAutoTable.finalY + 10;

      // --- Detalle por producto ---
      if (data.productos.length > 0) {
        const bodyRows: any[] = [];

        data.productos.forEach((p) => {
          // Fila resumen del producto
          bodyRows.push([
            { content: `${p.producto_nombre}\n${p.producto_codigo}`, styles: { fontStyle: "bold", fillColor: [241, 245, 249] } },
            { content: p.cantidad_total.toFixed(0), styles: { fontStyle: "bold", fillColor: [241, 245, 249], halign: "center" } },
            { content: `$${p.costo_promedio.toFixed(2)}`, styles: { fontStyle: "bold", fillColor: [241, 245, 249], halign: "right" } },
            { content: `$${p.precio_promedio.toFixed(2)}`, styles: { fontStyle: "bold", fillColor: [241, 245, 249], halign: "right" } },
            { content: `$${p.subtotal_total.toFixed(2)}`, styles: { fontStyle: "bold", fillColor: [241, 245, 249], halign: "right" } },
            { content: `$${p.costo_total.toFixed(2)}`, styles: { fontStyle: "bold", fillColor: [241, 245, 249], halign: "right" } },
            { content: `$${p.ganancia_total.toFixed(2)}`, styles: { fontStyle: "bold", fillColor: [241, 245, 249], halign: "right" } },
          ]);

          // Sub-filas de desglose (solo si hay más de un costo)
          if (p.desglose.length > 1) {
            p.desglose.forEach((d) => {
              bodyRows.push([
                { content: `   ↳ costo $${d.costo_unitario.toFixed(2)}`, styles: { textColor: [71, 85, 105], fontSize: 9 } },
                { content: d.cantidad.toFixed(0), styles: { halign: "center", fontSize: 9 } },
                { content: `$${d.costo_unitario.toFixed(2)}`, styles: { halign: "right", fontSize: 9 } },
                { content: `$${d.precio_unitario.toFixed(2)}`, styles: { halign: "right", fontSize: 9 } },
                { content: `$${d.subtotal.toFixed(2)}`, styles: { halign: "right", fontSize: 9 } },
                { content: `$${d.costo_total.toFixed(2)}`, styles: { halign: "right", fontSize: 9 } },
                { content: `$${d.ganancia.toFixed(2)}`, styles: { halign: "right", fontSize: 9 } },
              ]);
            });
          }
        });

        autoTable(doc, {
          startY,
          head: [["Producto", "Cant.", "Costo Prom.", "Precio Prom.", "Subtotal", "Costo Total", "Ganancia"]],
          body: bodyRows,
          theme: "striped",
          headStyles: { fillColor: [15, 23, 42] },
          styles: { fontSize: 10, cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 55 },
            1: { halign: "center", cellWidth: 15 },
            2: { halign: "right" },
            3: { halign: "right" },
            4: { halign: "right" },
            5: { halign: "right" },
            6: { halign: "right" },
          },
        });

        startY = (doc as any).lastAutoTable.finalY + 10;
      } else {
        doc.setFontSize(11);
        doc.text("No hay ventas registradas en este período.", 14, startY);
      }

      // Pie
      const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(
        "Documento generado automáticamente por Sistema Óptica 20/20",
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );

      const pdfBytes = new Uint8Array(doc.output("arraybuffer"));

      const nombreArchivo =
        fechaDesde === fechaHasta
          ? `reporte_ventas_${fechaDesde}.pdf`
          : `reporte_ventas_${fechaDesde}_a_${fechaHasta}.pdf`;

      const respGuardar: any = await invoke("guardar_reporte_pdf", {
        pdfBytes: Array.from(pdfBytes),
        periodo: fechaDesde,             // se ignora porque mandamos nombreArchivo
        nombreArchivo,
      });

      if (respGuardar.success) {
        Swal.fire({
          title: "PDF Guardado",
          text: respGuardar.message,
          icon: "success",
          toast: true,
          position: "bottom-end",
          showConfirmButton: false,
          timer: 3000,
        });
      }
    } catch (e: any) {
      console.error(e);
      Swal.fire("Error", "No se pudo generar o guardar el PDF", "error");
    }
  };

  // ============================================================
  // UI
  // ============================================================
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-blue-600" /> Reporte de Ventas
        </h1>
        <button
          onClick={generarPDF}
          disabled={!data || data.productos.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <FileDown className="w-4 h-4" /> Exportar PDF
        </button>
      </div>

      {/* Filtro de fechas */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
          <Calendar className="w-4 h-4" />
          <span className="font-medium">Rango de fechas:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="md:col-span-2 flex items-end gap-2">
            <button
              onClick={setHoy}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Hoy
            </button>
            <button
              onClick={setEsteMes}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Este mes
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        </div>
      ) : !data ? null : (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-linear-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-5">
              <p className="text-sm text-blue-700 font-medium">Ventas del Período</p>
              <p className="text-3xl font-bold text-blue-900 mt-1">
                ${data.resumen.ventas_totales.toFixed(2)}
              </p>
              <p className="text-xs text-blue-600 mt-2">
                {data.resumen.cantidad_facturas} factura(s) · {data.resumen.cantidad_items.toFixed(0)} items
              </p>
            </div>
            <div className="bg-linear-to-br from-red-50 to-red-100 border border-red-200 rounded-lg p-5">
              <p className="text-sm text-red-700 font-medium">Costo de Ventas</p>
              <p className="text-3xl font-bold text-red-900 mt-1">
                ${data.resumen.costo_ventas.toFixed(2)}
              </p>
              <p className="text-xs text-red-600 mt-2">Costo PEPS de los productos vendidos</p>
            </div>
            <div className="bg-linear-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-5">
              <p className="text-sm text-green-700 font-medium">Ganancias del Período</p>
              <p className="text-3xl font-bold text-green-900 mt-1">
                ${data.resumen.ganancias.toFixed(2)}
              </p>
              <p className="text-xs text-green-600 mt-2">Ventas − Costo de ventas</p>
            </div>
          </div>

          {/* Tabla detalle por producto */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-800">Detalle por Producto</h2>
              <p className="text-xs text-gray-500 mt-1">
                Si un producto tiene más de un costo unitario, se muestra su desglose debajo.
              </p>
            </div>

            {data.productos.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No hay ventas registradas en este período.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left">Producto</th>
                      <th className="px-4 py-3 text-center">Cant.</th>
                      <th className="px-4 py-3 text-right">Costo Prom.</th>
                      <th className="px-4 py-3 text-right">Precio Prom.</th>
                      <th className="px-4 py-3 text-right">Subtotal</th>
                      <th className="px-4 py-3 text-right">Costo Total</th>
                      <th className="px-4 py-3 text-right">Ganancia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.productos.map((p) => {
                      const tieneDesglose = p.desglose.length > 1;
                      const isOpen = expanded.has(p.producto_id);

                      return (
                        <Fragment key={p.producto_id}>
                          <tr
                            className={`border-b bg-white ${tieneDesglose ? "cursor-pointer hover:bg-gray-50" : ""}`}
                            onClick={() => tieneDesglose && toggleExpand(p.producto_id)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {tieneDesglose && (
                                  isOpen
                                    ? <ChevronDown className="w-4 h-4 text-gray-500" />
                                    : <ChevronRight className="w-4 h-4 text-gray-500" />
                                )}
                                <div>
                                  <div className="font-medium text-gray-800">{p.producto_nombre}</div>
                                  <div className="text-xs text-gray-500 font-mono">{p.producto_codigo}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-semibold">{p.cantidad_total.toFixed(0)}</td>
                            <td className="px-4 py-3 text-right">${p.costo_promedio.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">${p.precio_promedio.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">${p.subtotal_total.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">${p.costo_total.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-green-700">
                              ${p.ganancia_total.toFixed(2)}
                            </td>
                          </tr>

                          {tieneDesglose && isOpen && p.desglose.map((d, idx) => (
                            <tr key={`${p.producto_id}-${idx}`} className="bg-slate-50/70 border-b">
                              <td className="px-4 py-2 pl-12 text-xs text-slate-600">
                                ↳ costo unitario ${d.costo_unitario.toFixed(2)}
                              </td>
                              <td className="px-4 py-2 text-center text-xs">{d.cantidad.toFixed(0)}</td>
                              <td className="px-4 py-2 text-right text-xs">${d.costo_unitario.toFixed(2)}</td>
                              <td className="px-4 py-2 text-right text-xs">${d.precio_unitario.toFixed(2)}</td>
                              <td className="px-4 py-2 text-right text-xs">${d.subtotal.toFixed(2)}</td>
                              <td className="px-4 py-2 text-right text-xs">${d.costo_total.toFixed(2)}</td>
                              <td className="px-4 py-2 text-right text-xs text-green-700">
                                ${d.ganancia.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}