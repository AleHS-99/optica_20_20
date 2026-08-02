// src-tauri/src/commands/reportes.rs
use chrono::Local;
use sqlx::SqlitePool;
use serde::Serialize;

/// Obtiene estadísticas adicionales para el dashboard financiero
#[tauri::command]
pub async fn obtener_stats_financieras(
    pool: tauri::State<'_, SqlitePool>,
) -> Result<serde_json::Value, String> {
    let ahora = Local::now();
    let mes_actual = ahora.format("%Y-%m").to_string();

    // Ventas del mes
    let ventas_mes: (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(total), 0.0)
         FROM facturas
         WHERE estado != 'ANULADA'
         AND fecha LIKE ?",
    )
    .bind(format!("{}%", mes_actual))
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Gastos del mes
    let gastos_mes: (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(monto), 0.0)
         FROM gastos
         WHERE fecha LIKE ?",
    )
    .bind(format!("{}%", mes_actual))
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Facturas pendientes de pago
    let facturas_pendientes: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)
         FROM facturas
         WHERE estado IN ('PENDIENTE', 'PARCIAL')
         AND estado != 'ANULADA'",
    )
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Total por cobrar
    let por_cobrar: (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(saldo), 0.0) FROM (
            SELECT f.total - COALESCE(SUM(p.monto), 0.0) as saldo
            FROM facturas f
            LEFT JOIN pagos p ON f.id = p.factura_id
            WHERE f.estado IN ('PENDIENTE', 'PARCIAL')
            GROUP BY f.id
        )",
    )
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Valor del inventario
    let valor_inventario: (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(cantidad_restante * costo_unitario), 0.0)
         FROM lotes_inventario
         WHERE activo = 1",
    )
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "ventas_mes": ventas_mes.0,
        "gastos_mes": gastos_mes.0,
        "utilidad_mes": ventas_mes.0 - gastos_mes.0,
        "facturas_pendientes": facturas_pendientes.0,
        "por_cobrar": por_cobrar,
        "valor_inventario": valor_inventario.0
    }))
}

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use std::fs;

/// Recibe los bytes del PDF generados por el frontend y abre un diálogo
/// para que el usuario elija dónde guardar su reporte de cierre.
#[tauri::command]
pub async fn guardar_reporte_pdf(
    app: AppHandle,
    pdf_bytes: Vec<u8>,
    periodo: String,
) -> Result<serde_json::Value, String> {
    
    // Nombre sugerido por defecto (ej: cierre_economico_Julio_2026.pdf)
    let default_name = format!("cierre_economico_{}.pdf", periodo.replace("/", "-"));

    // Abrir el diálogo para elegir la ubicación
    let file_path = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("Documento PDF", &["pdf"])
        .blocking_save_file();

    let destino = match file_path {
        Some(fp) => match fp {
            tauri_plugin_dialog::FilePath::Path(p) => p,
            tauri_plugin_dialog::FilePath::Url(u) => u.to_file_path().map_err(|_| "Ruta inválida".to_string())?,
        },
        None => return Ok(serde_json::json!({
            "success": false,
            "cancelled": true,
            "message": "Guardado cancelado por el usuario"
        })),
    };

    // Escribir los bytes del PDF en la ruta seleccionada
    fs::write(&destino, pdf_bytes)
        .map_err(|e| format!("Error guardando el PDF: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": format!("Reporte guardado exitosamente en: {}", destino.display()),
        "path": destino.display().to_string()
    }))
}

#[derive(Serialize)]
pub struct ItemVenta {
    pub descripcion: String,
    pub cantidad: f64,
    pub precio_unitario: f64,
    pub costo_unitario: f64,
    pub subtotal: f64,
    pub costo_total: f64,
}

#[derive(Serialize)]
pub struct GastoDetalle {
    pub categoria: String,
    pub descripcion: String,
    pub monto: f64,
}

#[derive(Serialize)]
pub struct DetalleCierre {
    pub periodo: String,
    pub nombre_periodo: String,
    pub ventas_totales: f64,
    pub costo_ventas: f64,
    pub utilidad_bruta: f64,
    pub gastos_fijos: f64,
    pub gastos_variables: f64,
    pub gastos_financieros: f64,
    pub utilidad_operativa: f64,
    pub utilidad_antes_impuestos: f64,
    pub impuesto_porcentaje: f64,
    pub monto_impuesto: f64,
    pub utilidad_neta: f64,
    pub items_ventas: Vec<ItemVenta>,
    pub gastos_detalle: Vec<GastoDetalle>,
    pub observaciones: String,
    pub es_impuesto_estimado: bool,
}

#[tauri::command]
pub async fn obtener_detalle_cierre(
    pool: tauri::State<'_, SqlitePool>,
    periodo: String,
) -> Result<DetalleCierre, String> {
    // Validar que el período esté cerrado (opcional, pero recomendado)
    let cerrado: Option<(String,)> = sqlx::query_as(
        "SELECT periodo, nombre FROM periodos_contables WHERE nombre = ? AND estado = 'CERRADO'"
    )
    .bind(&periodo)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;


    let nombre_periodo = match cerrado {
        Some((periodo,)) => periodo,
        None => return Err("El período no está cerrado o no existe".to_string()),
    };
    // 1. Ventas totales y detalles de items vendidos
    // Items de facturas no anuladas del período
    let items: Vec<(String, f64, f64, f64, f64, f64)> = sqlx::query_as(
        "SELECT df.descripcion, df.cantidad, df.precio_unitario, df.costo_unitario, df.subtotal, (df.cantidad * df.costo_unitario) as costo_total
         FROM detalle_factura df
         JOIN facturas f ON df.factura_id = f.id
         WHERE strftime('%Y-%m', f.fecha) = ? AND f.estado != 'ANULADA'"
    )
    .bind(&nombre_periodo)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let mut items_ventas = Vec::new();
    let mut ventas_totales = 0.0;
    let mut costo_ventas = 0.0;

    for (desc, cant, precio, costo, subtotal, costo_total) in items {
        items_ventas.push(ItemVenta {
            descripcion: desc,
            cantidad: cant,
            precio_unitario: precio,
            costo_unitario: costo,
            subtotal: subtotal,
            costo_total: costo_total,
        });
        ventas_totales += subtotal;
        costo_ventas += costo_total;
    }

    let mut gastos_detalle = Vec::new();
    let mut gastos_fijos = 0.0;
    let mut gastos_variables = 0.0;
    let mut gastos_financieros = 0.0;

    //for (categoria, desc, monto) in gastos {
        // Determinar tipo de categoría para clasificar (necesitamos obtener tipo)
        // Mejor hacer otra consulta para obtener el tipo de cada categoría o incluir en la query
        // Podemos incluir c.tipo en la query
        // Pero para simplificar, haremos una segunda consulta dentro del loop? No, mejor modificar la query inicial para incluir c.tipo.
    //}

    // Voy a rehacer la consulta de gastos incluyendo el tipo de categoría para clasificar.
    let gastos_detalle_raw: Vec<(String, String, f64, String)> = sqlx::query_as(
        "SELECT c.nombre as categoria, g.descripcion, g.monto, c.tipo
         FROM gastos g
         JOIN categorias_gasto c ON g.categoria_id = c.id
         WHERE strftime('%Y-%m', g.fecha) = ?"
    )
    .bind(&nombre_periodo)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    for (categoria, desc, monto, tipo) in gastos_detalle_raw {
        gastos_detalle.push(GastoDetalle {
            categoria: categoria,
            descripcion: desc,
            monto: monto,
        });
        match tipo.as_str() {
            "FIJO" => gastos_fijos += monto,
            "VARIABLE" => gastos_variables += monto,
            "FINANCIERO" => gastos_financieros += monto,
            _ => {}
        }
    }

    // 3. Utilidades
    let utilidad_bruta = ventas_totales - costo_ventas;
    let gastos_operativos = gastos_fijos + gastos_variables;
    let utilidad_operativa = utilidad_bruta - gastos_operativos;
    let utilidad_antes_impuestos = utilidad_operativa - gastos_financieros;

    // 4. Impuestos
    let imp_configurado: Option<(f64,)> = sqlx::query_as(
        "SELECT porcentaje FROM impuestos WHERE activo = 1 LIMIT 1"
    )
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let (impuesto_porcentaje, es_impuesto_estimado) = match imp_configurado {
        Some((p,)) if p > 0.0 => (p, false),
        _ => (20.0, true),
    };

    let monto_impuesto = if utilidad_antes_impuestos > 0.0 {
        utilidad_antes_impuestos * (impuesto_porcentaje / 100.0)
    } else {
        0.0
    };

    let utilidad_neta = utilidad_antes_impuestos - monto_impuesto;

    // 5. Observaciones: obtener del registro de cierre (podemos buscarlo)
    let obs: Option<(String,)> = sqlx::query_as(
        "SELECT observaciones FROM periodos_contables WHERE nombre = ? AND estado = 'CERRADO'"
    )
    .bind(&periodo)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let observaciones = obs.map(|o| o.0).unwrap_or_default();

    Ok(DetalleCierre {
        periodo: periodo.clone(),
        nombre_periodo,
        ventas_totales,
        costo_ventas,
        utilidad_bruta,
        gastos_fijos,
        gastos_variables,
        gastos_financieros,
        utilidad_operativa,
        utilidad_antes_impuestos,
        impuesto_porcentaje,
        monto_impuesto,
        utilidad_neta,
        items_ventas,
        gastos_detalle,
        observaciones,
        es_impuesto_estimado,
    })
}