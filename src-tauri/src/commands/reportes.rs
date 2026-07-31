// src-tauri/src/commands/reportes.rs
use sqlx::SqlitePool;
use chrono::Local;

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