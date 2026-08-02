// src-tauri/src/commands/periodos.rs
use sqlx::SqlitePool;
use crate::models::cierre::PeriodoContable;

/// Verifica si una fecha dada (formato "YYYY-MM-DD" o "YYYY-MM-DD HH:MM:SS")
/// cae dentro de un período contable CERRADO.
/// 
/// Retorna:
/// - Ok(()) si la fecha está en un período ABIERTO (se puede operar)
/// - Err(mensaje) si la fecha está en un período CERRADO (no se puede operar)
pub async fn verificar_periodo_abierto(pool: &SqlitePool, fecha: &str) -> Result<(), String> {
    // Extraer el período "YYYY-MM" de la fecha
    let periodo = if fecha.len() >= 7 {
        &fecha[0..7]
    } else {
        return Err("Formato de fecha inválido".to_string());
    };

    // Buscar si existe un período cerrado para ese mes
    let periodo_cerrado: Option<(String,)> = sqlx::query_as(
        "SELECT nombre FROM periodos_contables 
         WHERE periodo = ? AND estado = 'CERRADO'"
    )
    .bind(periodo)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Error verificando período: {}", e))?;

    if let Some((nombre,)) = periodo_cerrado {
        return Err(format!(
            "❌ No se puede realizar esta operación: el período '{}' ({}) ya está cerrado. \
             Para correcciones, registre el movimiento en el mes actual.",
            nombre, periodo
        ));
    }

    Ok(())
}

/// Lista todos los períodos contables ordenados por fecha descendente
#[tauri::command]
pub async fn listar_periodos(
    pool: tauri::State<'_, SqlitePool>,
) -> Result<Vec<PeriodoContable>, String> {
    let periodos = sqlx::query_as::<_, PeriodoContable>(
        "SELECT * FROM periodos_contables ORDER BY periodo DESC"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(periodos)
}

/// Obtiene el último período cerrado (para mostrar al usuario en la UI)
#[tauri::command]
pub async fn obtener_ultimo_cierre(
    pool: tauri::State<'_, SqlitePool>,
) -> Result<serde_json::Value, String> {
    let ultimo: Option<PeriodoContable> = sqlx::query_as::<_, PeriodoContable>(
        "SELECT * FROM periodos_contables 
         WHERE estado = 'CERRADO' 
         ORDER BY periodo DESC LIMIT 1"
    )
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    match ultimo {
        Some(p) => Ok(serde_json::json!({
            "existe": true,
            "periodo": p.periodo,
            "nombre": p.nombre,
            "fecha_cierre": p.fecha_cierre,
            "utilidad_neta": p.utilidad_neta_cerrada
        })),
        None => Ok(serde_json::json!({
            "existe": false
        })),
    }
}


use chrono::{NaiveDate, Months, Days};

/// Ejecuta el cierre contable de un período específico
#[tauri::command]
pub async fn cerrar_periodo(
    pool: tauri::State<'_, SqlitePool>,
    periodo: String,      // Formato "YYYY-MM"
    usuario: String,
    observaciones: String,
) -> Result<serde_json::Value, String> {
    // 1. Validar que el período no esté ya cerrado
    let ya_cerrado: Option<(String,)> = sqlx::query_as(
        "SELECT nombre FROM periodos_contables WHERE periodo = ? AND estado = 'CERRADO'"
    )
    .bind(&periodo)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if ya_cerrado.is_some() {
        return Err(format!("El período {} ya está cerrado.", periodo));
    }

    // 2. Calcular la fecha del último día del mes para los gastos fijos
    let anio = periodo[0..4].parse::<i32>().map_err(|_| "Año inválido")?;
    let mes = periodo[5..7].parse::<u32>().map_err(|_| "Mes inválido")?;
    
    // Truco seguro en chrono: ir al día 1 del mes siguiente y restar 1 día
    let ultimo_dia = NaiveDate::from_ymd_opt(anio, mes, 1)
        .ok_or("Fecha inválida")?
        .checked_add_months(Months::new(1))
        .ok_or("Error calculando fecha")?
        .checked_sub_days(Days::new(1))
        .ok_or("Error calculando fecha")?;
    
    let fecha_gastos_str = ultimo_dia.format("%Y-%m-%d 00:00:00").to_string();

    // 3. Inyectar gastos fijos de la plantilla al libro de gastos
    // (Solo si están activos, con es_autogenerado = 1)
    let gastos_inyectados = sqlx::query(
        "INSERT INTO gastos (categoria_id, descripcion, monto, fecha, tipo, es_autogenerado)
         SELECT categoria_id, descripcion, monto, ?, 'FIJO', 1 
         FROM gastos_fijos_plantilla WHERE activo = 1"
    )
    .bind(&fecha_gastos_str)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error inyectando gastos fijos: {}", e))?
    .rows_affected();

    // 4. Calcular snapshot financiero del período (para la bitácora)
    // Ventas totales del período
    let ventas: (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(total), 0.0) FROM facturas 
         WHERE strftime('%Y-%m', fecha) = ? AND estado != 'ANULADA'"
    )
    .bind(&periodo)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Gastos totales del período (incluyendo los que acabamos de inyectar)
    let gastos: (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(monto), 0.0) FROM gastos 
         WHERE strftime('%Y-%m', fecha) = ?"
    )
    .bind(&periodo)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let utilidad_neta = ventas.0 - gastos.0;
    let nombre_periodo = ultimo_dia.format("%B %Y").to_string(); // Ej: "Julio 2026"

    // 5. Registrar el cierre en la tabla periodos_contables
    let ahora = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    sqlx::query(
        "INSERT INTO periodos_contables 
         (periodo, nombre, estado, fecha_cierre, usuario_cierre, 
          ventas_totales_cerradas, gastos_totales_cerrados, utilidad_neta_cerrada, observaciones)
         VALUES (?, ?, 'CERRADO', ?, ?, ?, ?, ?, ?)"
    )
    .bind(&periodo)
    .bind(&nombre_periodo)
    .bind(&ahora)
    .bind(&usuario)
    .bind(ventas.0)
    .bind(gastos.0)
    .bind(utilidad_neta)
    .bind(&observaciones)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error registrando cierre: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": format!("Período {} cerrado exitosamente. Se inyectaron {} gastos fijos.", nombre_periodo, gastos_inyectados),
        "gastos_inyectados": gastos_inyectados,
        "utilidad_neta": utilidad_neta
    }))
}

/// Lista el historial de cierres (Bitácora)
#[tauri::command]
pub async fn listar_cierres(
    pool: tauri::State<'_, SqlitePool>,
) -> Result<Vec<PeriodoContable>, String> {
    let cierres = sqlx::query_as::<_, PeriodoContable>(
        "SELECT * FROM periodos_contables WHERE estado = 'CERRADO' ORDER BY periodo DESC"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(cierres)
}