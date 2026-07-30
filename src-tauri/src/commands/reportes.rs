// src-tauri/src/commands/reportes.rs
use sqlx::SqlitePool;
use chrono::Local;

/// Obtiene el Estado de Resultados en tiempo real
/// Calcula las 4 utilidades sin necesidad de cierre
#[tauri::command]
pub async fn obtener_estado_resultados(
    pool: tauri::State<'_, SqlitePool>,
    fecha_desde: Option<String>,
    fecha_hasta: Option<String>,
) -> Result<serde_json::Value, String> {
    let ahora = Local::now();
    
    // Si no se especifican fechas, usar el mes actual
    let (desde, hasta) = match (fecha_desde, fecha_hasta) {
        (Some(d), Some(h)) => (d, h),
        _ => {
            let primer_dia = ahora.format("%Y-%m-01").to_string();
            let ultimo_dia = ahora.format("%Y-%m-%d").to_string();
            (primer_dia, ultimo_dia)
        }
    };

    // 1. VENTAS TOTALES (suma de facturas no anuladas en el periodo)
    let ventas: (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(total), 0.0) 
         FROM facturas 
         WHERE estado != 'ANULADA' 
         AND date(fecha) >= date(?) 
         AND date(fecha) <= date(?)"
    )
    .bind(&desde)
    .bind(&hasta)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // 2. COSTO DE VENTAS (COGS) - Suma de costos PEPS de productos vendidos
    // Buscamos movimientos de tipo VENTA en detalle_factura
    let cogs: (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(df.costo_unitario * df.cantidad), 0.0)
         FROM detalle_factura df
         JOIN facturas f ON df.factura_id = f.id
         WHERE f.estado != 'ANULADA'
         AND df.tipo_item = 'PRODUCTO'
         AND date(f.fecha) >= date(?)
         AND date(f.fecha) <= date(?)"
    )
    .bind(&desde)
    .bind(&hasta)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // 3. GASTOS OPERATIVOS (suma de gastos en el periodo)
    let gastos_operativos: (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(monto), 0.0)
         FROM gastos
         WHERE date(fecha) >= date(?)
         AND date(fecha) <= date(?)"
    )
    .bind(&desde)
    .bind(&hasta)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // 4. GASTOS FINANCIEROS (por ahora 0, se puede expandir después)
    let gastos_financieros = 0.0;

    // 5. IMPUESTOS (por ahora 0, se calculará en Fase 9 con cierres)
    let impuestos = 0.0;

    // CÁLCULOS
    let utilidad_bruta = ventas.0 - cogs.0;
    let utilidad_operativa = utilidad_bruta - gastos_operativos.0;
    let utilidad_antes_impuestos = utilidad_operativa - gastos_financieros;
    let utilidad_neta = utilidad_antes_impuestos - impuestos;

    // Desglose de gastos por categoría
    let gastos_por_categoria: Vec<serde_json::Value> = sqlx::query_as(
        "SELECT c.nombre as categoria, COALESCE(SUM(g.monto), 0.0) as total
         FROM gastos g
         JOIN categorias_gasto c ON g.categoria_id = c.id
         WHERE date(g.fecha) >= date(?)
         AND date(g.fecha) <= date(?)
         GROUP BY c.id, c.nombre
         ORDER BY total DESC"
    )
    .bind(&desde)
    .bind(&hasta)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?
    .iter()
    .map(|(cat, total): &(String, f64)| {
        serde_json::json!({
            "categoria": cat,
            "total": total
        })
    })
    .collect();

    Ok(serde_json::json!({
        "periodo": {
            "desde": desde,
            "hasta": hasta
        },
        "ventas_totales": ventas.0,
        "costo_ventas": cogs.0,
        "utilidad_bruta": utilidad_bruta,
        "gastos_operativos": gastos_operativos.0,
        "gastos_por_categoria": gastos_por_categoria,
        "utilidad_operativa": utilidad_operativa,
        "gastos_financieros": gastos_financieros,
        "utilidad_antes_impuestos": utilidad_antes_impuestos,
        "impuestos": impuestos,
        "utilidad_neta": utilidad_neta
    }))
}

/// Obtiene estadísticas adicionales para el dashboard financiero
#[tauri::command]
pub async fn obtener_stats_financieras(
    pool: tauri::State<'_, SqlitePool>,
) -> Result<serde_json::Value, String> {
    let ahora = Local::now();
    let mes_actual = ahora.format("%Y-%m").to_string();
    let primer_dia_mes = ahora.format("%Y-%m-01").to_string();
    let hoy = ahora.format("%Y-%m-%d").to_string();

    // Ventas del mes
    let ventas_mes: (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(total), 0.0)
         FROM facturas
         WHERE estado != 'ANULADA'
         AND fecha LIKE ?"
    )
    .bind(format!("{}%", mes_actual))
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Gastos del mes
    let gastos_mes: (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(monto), 0.0)
         FROM gastos
         WHERE fecha LIKE ?"
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
         AND estado != 'ANULADA'"
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
        )"
    )
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Valor del inventario
    let valor_inventario: (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(cantidad_restante * costo_unitario), 0.0)
         FROM lotes_inventario
         WHERE activo = 1"
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