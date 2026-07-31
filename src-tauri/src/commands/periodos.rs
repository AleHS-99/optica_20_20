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