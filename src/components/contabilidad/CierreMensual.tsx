import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Swal from "sweetalert2";
import {
  Lock,
  Calendar,
  FileText,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";

interface Cierre {
  id: number;
  periodo: string;
  nombre: string;
  estado: string;
  fecha_cierre: string | null;
  usuario_cierre: string | null;
  ventas_totales_cerradas: number;
  gastos_totales_cerrados: number;
  utilidad_neta_cerrada: number;
  observaciones: string;
}
import jsPDF from "jspdf"; // <-- Importar jsPDF
import autoTable from "jspdf-autotable"; // <-- Importar autoTable

export default function CierreMensual() {
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [observaciones, setObservaciones] = useState("");
  const [cierres, setCierres] = useState<Cierre[]>([]);
  const [loading, setLoading] = useState(false);
  const [cargandoCierres, setCargandoCierres] = useState(true);

  useEffect(() => {
    cargarBitacora();
  }, []);

  const cargarBitacora = async () => {
    setCargandoCierres(true);
    try {
      const data = await invoke<Cierre[]>("listar_cierres");
      setCierres(data);
    } catch (e: any) {
      Swal.fire("Error", e.toString(), "error");
    } finally {
      setCargandoCierres(false);
    }
  };


  const generarYGuardarPDF = async (nombrePeriodo: string) => {
    try {
      const doc = new jsPDF();
      
      const detalle: any = await invoke("obtener_detalle_cierre", { periodo: nombrePeriodo }); 
      console.log("Respuesta del backend:", detalle); 
      
      // Título
      doc.setFontSize(20);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("Reporte de Cierre Económico", 14, 22);
      
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`Período: ${nombrePeriodo} | Óptica 20/20`, 14, 30);
      
      let startY = 40;

      // --- Tabla de Ventas ---
      // CORRECCIÓN: Usar "items_ventas" en lugar de "ventas_items"
      if (detalle.items_ventas && detalle.items_ventas.length > 0) {
        const ventasBody = detalle.items_ventas.map((item: any) => [
          item.descripcion,
          item.cantidad.toFixed(1),
          `$${item.precio_unitario.toFixed(2)}`,
          `$${item.costo_unitario.toFixed(2)}`,
          `$${item.subtotal.toFixed(2)}`,
          `$${item.costo_total.toFixed(2)}`, // CORRECCIÓN: Usar "costo_total" que ya viene de Rust
        ]);

        autoTable(doc, {
          startY,
          head: [['Descripción', 'Cant.', 'Precio Unit.', 'Costo Unit.', 'Subtotal', 'Costo Total']],
          body: ventasBody,
          theme: 'striped',
          headStyles: { fillColor: [15, 23, 42] },
          columnStyles: {
            0: { cellWidth: 'auto' },
            1: { halign: 'center' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' },
          },
        });

        startY = (doc as any).lastAutoTable.finalY + 10;
      } else {
        doc.setFontSize(11);
        doc.text("No hay ventas registradas en este período.", 14, startY);
        startY += 10;
      }

      // --- Resumen de Ventas ---
      autoTable(doc, {
        startY,
        head: [['Concepto', 'Monto']],
        body: [
          ['Ventas Totales', `$${detalle.ventas_totales.toFixed(2)}`],
          ['Costo de Ventas', `$${detalle.costo_ventas.toFixed(2)}`],
          ['Utilidad Bruta', `$${detalle.utilidad_bruta.toFixed(2)}`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { halign: 'right' },
        },
      });

      startY = (doc as any).lastAutoTable.finalY + 10;

      // --- Tabla de Gastos ---
      // CORRECCIÓN: Usar "gastos_detalle" en lugar de "gastos_items"
      if (detalle.gastos_detalle && detalle.gastos_detalle.length > 0) {
        const gastosBody = detalle.gastos_detalle.map((g: any) => [
          g.categoria, // CORRECCIÓN: Usar "categoria" en lugar de "categoria_nombre"
          g.descripcion,
          `$${g.monto.toFixed(2)}`,
        ]);

        autoTable(doc, {
          startY,
          head: [['Categoría', 'Descripción', 'Monto']],
          body: gastosBody,
          theme: 'striped',
          headStyles: { fillColor: [15, 23, 42] },
          columnStyles: {
            0: { fontStyle: 'bold' },
            2: { halign: 'right' },
          },
        });

        startY = (doc as any).lastAutoTable.finalY + 10;
      } else {
        doc.setFontSize(11);
        doc.text("No hay gastos registrados en este período.", 14, startY);
        startY += 10;
      }

      // CORRECCIÓN: Calcular total_gastos sumando los campos que vienen de Rust
      const totalGastosCalculado = detalle.gastos_fijos + detalle.gastos_variables + (detalle.gastos_financieros || 0);

      // --- Resumen de Gastos y Cuadro Financiero ---
      const finRows = [
        ['Gastos Fijos', `$${detalle.gastos_fijos.toFixed(2)}`],
        ['Gastos Variables', `$${detalle.gastos_variables.toFixed(2)}`],
        ['Gastos Financieros', `$${detalle.gastos_financieros.toFixed(2)}`],
        ['Total Gastos', `$${totalGastosCalculado.toFixed(2)}`], // Usamos la variable calculada arriba
        ['Utilidad Operativa', `$${detalle.utilidad_operativa.toFixed(2)}`],
        ['Utilidad Antes de Impuestos', `$${detalle.utilidad_antes_impuestos.toFixed(2)}`],
        [
          `Impuesto (${detalle.impuesto_porcentaje.toFixed(2)}%)${detalle.es_impuesto_estimado ? ' *Estimado' : ''}`,
          `$${detalle.monto_impuesto.toFixed(2)}`
        ],
        ['Utilidad Neta', `$${detalle.utilidad_neta.toFixed(2)}`],
      ];

      autoTable(doc, {
        startY,
        head: [['Concepto', 'Monto']],
        body: finRows,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] },
        columnStyles: {
          0: { fontStyle: 'bold' },
          1: { halign: 'right' },
        },
        willDrawCell: (data) => {
          // Resaltar Utilidad Neta
          if (data.row.index === finRows.length - 1 && data.section === 'body') {
            doc.setTextColor(22, 163, 74); // verde
            doc.setFont("helvetica", "bold");
          }
          // Resaltar Utilidad Operativa y Antes de Impuestos
          if (data.row.index === 4 || data.row.index === 5) {
            doc.setTextColor(15, 23, 42);
            doc.setFont("helvetica", "bold");
          }
        },
      });

      startY = (doc as any).lastAutoTable.finalY + 15;

      // --- Observaciones ---
      if (detalle.observaciones) {
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text("Observaciones:", 14, startY);
        doc.setFont("helvetica", "normal");
        doc.text(detalle.observaciones, 14, startY + 10);
        startY += 20;
      }

      // --- Pie de página ---
      const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text(
        "Documento generado automáticamente por Sistema Óptica 20/20",
        (pageWidth/2),
        pageHeight - 10,
        { align: 'center' }
      );

      // --- Guardar PDF ---
      const pdfArrayBuffer = doc.output('arraybuffer');
      const pdfBytes = new Uint8Array(pdfArrayBuffer);

      const respGuardar: any = await invoke("guardar_reporte_pdf", {
        pdfBytes: Array.from(pdfBytes),
        periodo: nombrePeriodo,
      });

      if (respGuardar.success) {
        Swal.fire({
          title: "PDF Guardado",
          text: respGuardar.message,
          icon: "success",
          toast: true,
          position: 'bottom-end',
          showConfirmButton: false,
          timer: 3000,
        });
      }

    } catch (error) {
      console.error("Error generando PDF:", error);
      Swal.fire("Error", "No se pudo generar o guardar el PDF", "error");
    }
  };


  const ejecutarCierre = async () => {
    // Validación básica
    const r = await Swal.fire({
      title: "¿Ejecutar cierre contable?",
      html: `
        <p>Estás a punto de cerrar el período <strong>${periodo}</strong>.</p>
        <ul class="text-left text-sm text-gray-600 mt-2 space-y-1">
          <li>• Se inyectarán los gastos fijos activos de la plantilla.</li>
          <li>• El período quedará <strong>bloqueado</strong> y no se podrán modificar facturas ni gastos de este mes.</li>
          <li>• Esta acción no se puede deshacer.</li>
        </ul>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Sí, cerrar período",
      cancelButtonText: "Cancelar",
    });

    if (!r.isConfirmed) return;

    setLoading(true);
    try {
      const usuario = "Admin";

      const resp: any = await invoke("cerrar_periodo", {
        periodo,
        usuario,
        observaciones: observaciones.trim(),
      });

      if (resp.success) {
        // 1. Mostrar éxito del cierre
        await Swal.fire({
          title: "¡Cierre Exitoso!",
          html: `
            <p>${resp.message}</p>
            <p class="text-sm text-gray-600 mt-2">Utilidad Neta: <strong>$${resp.utilidad_neta.toFixed(2)}</strong></p>
          `,
          icon: "success",
        });
        
        // 3. Generar y guardar PDF
        await generarYGuardarPDF(periodo);

        setObservaciones("");
        cargarBitacora();
      }
    } catch (e: any) {
      Swal.fire("Error al cerrar", e.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  const cambiarMes = (delta: number) => {
    const [anio, mes] = periodo.split("-").map(Number);
    const fecha = new Date(anio, mes - 1 + delta, 1);
    const nuevoPeriodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
    setPeriodo(nuevoPeriodo);
  };

  

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Lock className="w-6 h-6 text-blue-600" /> Cierre Contable Mensual
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Ejecuta el cierre para congelar los datos del mes e inyectar los
          gastos fijos automáticamente.
        </p>
      </div>

      {/* Panel de Ejecución de Cierre */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" /> Nuevo Cierre
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Período a cerrar *
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => cambiarMes(-1)}
                className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                title="Mes anterior"
              >
                <ChevronLeft className="w-5 h-5 text-gray-700" />
              </button>
              <input
                type="month"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                onClick={() => cambiarMes(1)}
                className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                title="Mes siguiente"
              >
                <ChevronRight className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observaciones (Opcional)
            </label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: Cierre normal, sin novedades..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              rows={1}
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={ejecutarCierre}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Lock className="w-5 h-5" />
            )}
            Ejecutar Cierre del Período
          </button>
          <span className="text-sm text-gray-500 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" /> Acción irreversible
          </span>
        </div>
      </div>

      {/* Bitácora de Cierres */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" /> Bitácora de Cierres
          </h2>
          <button
            onClick={cargarBitacora}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Actualizar
          </button>
        </div>

        {cargandoCierres ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : cierres.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <CheckCircle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p>No hay períodos cerrados aún.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-6 py-3">Período</th>
                  <th className="px-6 py-3">Fecha de Cierre</th>
                  <th className="px-6 py-3">Usuario</th>
                  <th className="px-6 py-3 text-right">Ventas</th>
                  <th className="px-6 py-3 text-right">Gastos</th>
                  <th className="px-6 py-3 text-right">Utilidad Neta</th>
                  <th className="px-6 py-3">Observaciones</th>
                  <th className="px-6 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cierres.map((c) => (
                  <tr key={c.id} className="bg-white hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {c.nombre}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {c.fecha_cierre
                        ? new Date(c.fecha_cierre).toLocaleString("es-CU")
                        : "-"}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {c.usuario_cierre || "-"}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-green-700">
                      ${c.ventas_totales_cerradas.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-red-700">
                      ${c.gastos_totales_cerrados.toFixed(2)}
                    </td>
                    <td
                      className={`px-6 py-4 text-right font-mono font-bold ${c.utilidad_neta_cerrada >= 0 ? "text-blue-700" : "text-red-700"}`}
                    >
                      ${c.utilidad_neta_cerrada.toFixed(2)}
                    </td>
                    <td
                      className="px-6 py-4 text-gray-500 max-w-xs truncate"
                      title={c.observaciones}
                    >
                      {c.observaciones || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                          onClick={() => generarYGuardarPDF(c.nombre)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Descargar Reporte PDF"
                      >
                          <Download className="w-5 h-5" />
                      </button>
                  </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
