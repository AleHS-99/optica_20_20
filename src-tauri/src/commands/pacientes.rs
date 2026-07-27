// src-tauri/src/commands/pacientes.rs
use crate::models::paciente::{NuevoPaciente, Paciente};
use sqlx::SqlitePool;

/// Verifica si un paciente existe por CI
#[tauri::command]
pub async fn verificar_ci(
    pool: tauri::State<'_, SqlitePool>,
    ci: String,
) -> Result<serde_json::Value, String> {
    // Validar CI
    if ci.len() != 11 || !ci.chars().all(|c| c.is_ascii_digit()) {
        return Ok(serde_json::json!({
            "exists": false,
            "error": "CI inválido"
        }));
    }

    // Buscar paciente
    let paciente: Option<Paciente> = sqlx::query_as("SELECT * FROM pacientes WHERE ci = ?")
        .bind(&ci)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    match paciente {
        Some(p) => Ok(serde_json::json!({
            "exists": true,
            "paciente": {
                "id": p.id,
                "ci": p.ci,
                "nombre": p.nombre,
                "apell1": p.apell1,
                "apell2": p.apell2,
                "telefono": p.telefono,
                "direccion": p.direccion
            }
        })),
        None => Ok(serde_json::json!({
            "exists": false
        })),
    }
}

/// Crea un nuevo paciente
#[tauri::command]
pub async fn crear_paciente(
    pool: tauri::State<'_, SqlitePool>,
    datos: NuevoPaciente,
) -> Result<serde_json::Value, String> {
    // Validaciones
    if datos.ci.len() != 11 || !datos.ci.chars().all(|c| c.is_ascii_digit()) {
        return Err("El CI debe tener exactamente 11 dígitos numéricos".to_string());
    }
    if datos.nombre.trim().is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }
    if datos.apell1.trim().is_empty() {
        return Err("El primer apellido es obligatorio".to_string());
    }

    let ahora = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    // Insertar paciente
    let result = sqlx::query(
        "INSERT INTO pacientes (ci, nombre, apell1, apell2, telefono, direccion, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&datos.ci)
    .bind(&datos.nombre)
    .bind(&datos.apell1)
    .bind(datos.apell2.unwrap_or_default())
    .bind(datos.telefono)
    .bind(datos.direccion)
    .bind(&ahora)
    .bind(&ahora)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error guardando paciente: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "paciente_id": result.last_insert_rowid(),
        "message": "Paciente guardado correctamente"
    }))
}

/// Lista todos los pacientes (para DataTable)
#[tauri::command]
pub async fn listar_pacientes(
    pool: tauri::State<'_, SqlitePool>,
    search: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<serde_json::Value, String> {
    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(10);
    let offset = (page - 1) * page_size;

    let pacientes: Vec<Paciente> = if let Some(search_term) = search {
        if search_term.trim().is_empty() {
            sqlx::query_as("SELECT * FROM pacientes ORDER BY created_at DESC LIMIT ? OFFSET ?")
                .bind(page_size)
                .bind(offset)
                .fetch_all(pool.inner())
                .await
                .map_err(|e| e.to_string())?
        } else {
            let search_pattern = format!("%{}%", search_term);
            sqlx::query_as(
                "SELECT * FROM pacientes
                 WHERE ci LIKE ? OR nombre LIKE ? OR apell1 LIKE ? OR apell2 LIKE ?
                 ORDER BY created_at DESC LIMIT ? OFFSET ?",
            )
            .bind(&search_pattern)
            .bind(&search_pattern)
            .bind(&search_pattern)
            .bind(&search_pattern)
            .bind(page_size)
            .bind(offset)
            .fetch_all(pool.inner())
            .await
            .map_err(|e| e.to_string())?
        }
    } else {
        sqlx::query_as("SELECT * FROM pacientes ORDER BY created_at DESC LIMIT ? OFFSET ?")
            .bind(page_size)
            .bind(offset)
            .fetch_all(pool.inner())
            .await
            .map_err(|e| e.to_string())?
    };

    // Contar total
    let total: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM pacientes")
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "data": pacientes,
        "total": total.0,
        "page": page,
        "page_size": page_size
    }))
}

/// Elimina un paciente (y sus consultas en cascada)
#[tauri::command]
pub async fn eliminar_paciente(
    pool: tauri::State<'_, SqlitePool>,
    id: i64,
) -> Result<serde_json::Value, String> {
    sqlx::query("DELETE FROM pacientes WHERE id = ?")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error eliminando paciente: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Paciente eliminado correctamente"
    }))
}

/// Actualiza un paciente existente
#[tauri::command]
pub async fn actualizar_paciente(
    pool: tauri::State<'_, SqlitePool>,
    id: i64,
    datos: NuevoPaciente,
) -> Result<serde_json::Value, String> {
    // Validaciones
    if datos.nombre.trim().is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }
    if datos.apell1.trim().is_empty() {
        return Err("El primer apellido es obligatorio".to_string());
    }

    let ahora = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let result = sqlx::query(
        "UPDATE pacientes
         SET nombre = ?, apell1 = ?, apell2 = ?, telefono = ?, direccion = ?, updated_at = ?
         WHERE id = ?",
    )
    .bind(&datos.nombre)
    .bind(&datos.apell1)
    .bind(datos.apell2.unwrap_or_default())
    .bind(datos.telefono)
    .bind(datos.direccion)
    .bind(&ahora)
    .bind(id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error actualizando paciente: {}", e))?;

    if result.rows_affected() == 0 {
        return Err("Paciente no encontrado".to_string());
    }

    Ok(serde_json::json!({
        "success": true,
        "message": "Paciente actualizado correctamente"
    }))
}
