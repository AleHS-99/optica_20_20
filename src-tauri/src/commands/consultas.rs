// src-tauri/src/commands/consultas.rs
use crate::models::consulta::{Consulta, NuevaConsulta};
use chrono::Local;
use sqlx::SqlitePool;

/// Crea una nueva consulta
#[tauri::command]
pub async fn crear_consulta(
    pool: tauri::State<'_, SqlitePool>,
    datos: NuevaConsulta,
) -> Result<serde_json::Value, String> {
    // Validar que el paciente existe
    let paciente_exists: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM pacientes WHERE id = ?")
        .bind(datos.paciente_id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    if paciente_exists.0 == 0 {
        return Err("Paciente no encontrado".to_string());
    }
    let ahora = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    // Insertar consulta
    let result = sqlx::query(
        "INSERT INTO consultas (paciente_id, refraccion, ojo_derecho, ojo_izquierdo, \"add\", galenos, corta_y_monta, observaciones, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(datos.paciente_id)
    .bind(datos.refraccion.unwrap_or_default())
    .bind(datos.ojo_derecho.unwrap_or_default())
    .bind(datos.ojo_izquierdo.unwrap_or_default())
    .bind(datos.add.unwrap_or_default())
    .bind(datos.galenos.unwrap_or_default())
    .bind(datos.corta_y_monta.unwrap_or_default())
    .bind(datos.observaciones.unwrap_or_default())
    .bind(&ahora)
    .bind(&ahora)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error guardando consulta: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "consulta_id": result.last_insert_rowid(),
        "message": "Consulta guardada correctamente"
    }))
}

/// Obtiene las últimas 5 consultas de un paciente
#[tauri::command]
pub async fn obtener_historico_paciente(
    pool: tauri::State<'_, SqlitePool>,
    paciente_id: i64,
) -> Result<serde_json::Value, String> {
    let consultas: Vec<Consulta> = sqlx::query_as(
        "SELECT * FROM consultas WHERE paciente_id = ? ORDER BY created_at DESC LIMIT 5",
    )
    .bind(paciente_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let hoy = Local::now().format("%Y-%m-%d").to_string();

    let data: Vec<serde_json::Value> = consultas
        .iter()
        .enumerate()
        .map(|(idx, c)| {
            let es_ultima = idx == 0;
            let fecha_consulta = &c.created_at[..10];
            let es_hoy = fecha_consulta == hoy;

            serde_json::json!({
                "id": c.id,
                "created": c.created_at,
                "refraccion": c.refraccion,
                "ojo_derecho": c.ojo_derecho,
                "ojo_izquierdo": c.ojo_izquierdo,
                "add": c.add,
                "es_hoy": es_hoy,
                "es_ultima": es_ultima
            })
        })
        .collect();

    Ok(serde_json::json!({ "data": data }))
}

/// Elimina una consulta (solo si es la última del día)
#[tauri::command]
pub async fn eliminar_consulta(
    pool: tauri::State<'_, SqlitePool>,
    id: i64,
) -> Result<serde_json::Value, String> {
    // ✅ NUEVO: Verificar si la consulta tiene facturas asociadas
    let facturas_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM facturas WHERE consulta_id = ?"
    )
    .bind(id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if facturas_count.0 > 0 {
        return Err(format!(
            "No se puede eliminar: esta consulta tiene {} factura(s) asociada(s). \
             Las facturas son registros contables que no pueden quedar sin consulta.",
            facturas_count.0
        ));
    }

    sqlx::query("DELETE FROM consultas WHERE id = ?")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error eliminando consulta: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Consulta eliminada correctamente"
    }))
}
/// Obtiene el detalle completo de una consulta
#[tauri::command]
pub async fn obtener_detalle_consulta(
    pool: tauri::State<'_, SqlitePool>,
    consulta_id: i64,
) -> Result<serde_json::Value, String> {
    let consulta: Option<Consulta> = sqlx::query_as("SELECT * FROM consultas WHERE id = ?")
        .bind(consulta_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    let consulta = match consulta {
        Some(c) => c,
        None => return Err("Consulta no encontrada".to_string()),
    };

    // Obtener datos del paciente
    let paciente: Option<crate::models::paciente::Paciente> =
        sqlx::query_as("SELECT * FROM pacientes WHERE id = ?")
            .bind(consulta.paciente_id)
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    let paciente = match paciente {
        Some(p) => p,
        None => return Err("Paciente no encontrado".to_string()),
    };

    Ok(serde_json::json!({
        "id": consulta.id,
        "fecha": consulta.created_at,
        "paciente": {
            "ci": paciente.ci,
            "nombre": paciente.nombre,
            "apell1": paciente.apell1,
            "apell2": paciente.apell2,
            "telefono": paciente.telefono,
            "direccion": paciente.direccion
        },
        "refraccion": consulta.refraccion,
        "ojo_derecho": consulta.ojo_derecho,
        "ojo_izquierdo": consulta.ojo_izquierdo,
        "add": consulta.add,
        "galenos": consulta.galenos,
        "corta_y_monta": consulta.corta_y_monta,
        "observaciones": consulta.observaciones
    }))
}

/// Lista todas las consultas (histórico general) con filtros de búsqueda y fecha
#[tauri::command]
pub async fn listar_todas_consultas(
    pool: tauri::State<'_, SqlitePool>,
    search: Option<String>,
    fecha_desde: Option<String>, // ✅ NUEVO: formato "YYYY-MM-DD"
    fecha_hasta: Option<String>, // ✅ NUEVO: formato "YYYY-MM-DD"
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<serde_json::Value, String> {
    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(10);
    let offset = (page - 1) * page_size;

    let hoy = Local::now().format("%Y-%m-%d").to_string();

    // ✅ Construir condiciones WHERE dinámicamente
    let mut where_clauses: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    // Filtro de texto (CI, nombre, apellidos, refracción)
    if let Some(ref search_term) = search {
        if !search_term.trim().is_empty() {
            where_clauses.push(
                "(p.ci LIKE ? OR p.nombre LIKE ? OR p.apell1 LIKE ? OR p.apell2 LIKE ? OR c.refraccion LIKE ?)".to_string()
            );
            let pattern = format!("%{}%", search_term.trim());
            bind_values.push(pattern.clone());
            bind_values.push(pattern.clone());
            bind_values.push(pattern.clone());
            bind_values.push(pattern.clone());
            bind_values.push(pattern);
        }
    }

    // Filtro de fecha DESDE
    if let Some(ref desde) = fecha_desde {
        if !desde.trim().is_empty() {
            where_clauses.push("date(c.created_at) >= date(?)".to_string());
            bind_values.push(desde.clone());
        }
    }

    // Filtro de fecha HASTA
    if let Some(ref hasta) = fecha_hasta {
        if !hasta.trim().is_empty() {
            where_clauses.push("date(c.created_at) <= date(?)".to_string());
            bind_values.push(hasta.clone());
        }
    }

    // ✅ Construir la query final
    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    // Query para obtener datos
    let data_query = format!(
        "SELECT c.id, c.created_at, p.ci, p.nombre, p.apell1, p.apell2, c.refraccion, c.ojo_derecho, c.ojo_izquierdo, c.\"add\"
         FROM consultas c
         JOIN pacientes p ON c.paciente_id = p.id
         {}
         ORDER BY c.created_at DESC LIMIT ? OFFSET ?",
        where_sql
    );

    // Query para contar total (con los mismos filtros)
    let count_query = format!(
        "SELECT COUNT(*) FROM consultas c JOIN pacientes p ON c.paciente_id = p.id {}",
        where_sql
    );

    // ✅ Ejecutar query de datos con binds dinámicos
    let mut query = sqlx::query_as::<_, crate::models::consulta::ConsultaConPaciente>(&data_query);
    for val in &bind_values {
        query = query.bind(val);
    }
    query = query.bind(page_size).bind(offset);

    let consultas = query
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    // ✅ Ejecutar query de conteo con los mismos binds
    let mut count_query_builder = sqlx::query_as::<_, (i64,)>(&count_query);
    for val in &bind_values {
        count_query_builder = count_query_builder.bind(val);
    }
    let total = count_query_builder
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    // ✅ Formatear resultados
    let data: Vec<serde_json::Value> = consultas
        .iter()
        .map(|c| {
            let fecha_consulta = &c.created_at[..10];
            let es_hoy = fecha_consulta == hoy;

            let paciente_nombre = format!("{} {} {}", c.nombre, c.apell1, c.apell2)
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ");

            serde_json::json!({
                "id": c.id,
                "created": c.created_at,
                "paciente_ci": c.ci,
                "paciente_nombre": paciente_nombre,
                "refraccion": c.refraccion,
                "ojo_derecho": c.ojo_derecho,
                "ojo_izquierdo": c.ojo_izquierdo,
                "add": c.add,
                "es_hoy": es_hoy
            })
        })
        .collect();

    Ok(serde_json::json!({
        "data": data,
        "total": total.0,
        "page": page,
        "page_size": page_size
    }))
}

/// Obtiene estadísticas para el Dashboard en una sola consulta
#[tauri::command]
pub async fn obtener_estadisticas_dashboard(
    pool: tauri::State<'_, SqlitePool>,
) -> Result<serde_json::Value, String> {
    let hoy = Local::now().format("%Y-%m-%d").to_string();

    // Total de pacientes
    let total_pacientes: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM pacientes")
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    // Total de consultas
    let total_consultas: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM consultas")
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    // Consultas del día
    let consultas_hoy: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM consultas WHERE date(created_at) = date(?)")
            .bind(&hoy)
            .fetch_one(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

    // Pacientes únicos atendidos hoy
    let pacientes_hoy: (i64,) = sqlx::query_as(
        "SELECT COUNT(DISTINCT paciente_id) FROM consultas WHERE date(created_at) = date(?)",
    )
    .bind(&hoy)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Últimas 5 consultas del día (con datos del paciente)
    let ultimas: Vec<crate::models::consulta::ConsultaConPaciente> = sqlx::query_as(
        "SELECT c.id, c.created_at, p.ci, p.nombre, p.apell1, p.apell2, c.refraccion, c.ojo_derecho, c.ojo_izquierdo, c.\"add\"
         FROM consultas c
         JOIN pacientes p ON c.paciente_id = p.id
         WHERE date(c.created_at) = date(?)
         ORDER BY c.created_at DESC LIMIT 5"
    )
    .bind(&hoy)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let ultimas_data: Vec<serde_json::Value> = ultimas
        .iter()
        .map(|c| {
            let hora = if c.created_at.len() > 16 {
                &c.created_at[11..16]
            } else {
                ""
            };
            let paciente_nombre = format!("{} {}", c.nombre, c.apell1).trim().to_string();

            serde_json::json!({
                "id": c.id,
                "hora": hora,
                "paciente": paciente_nombre,
                "ci": c.ci,
                "refraccion": c.refraccion,
                "add": c.add
            })
        })
        .collect();

    Ok(serde_json::json!({
        "total_pacientes": total_pacientes.0,
        "total_consultas": total_consultas.0,
        "consultas_hoy": consultas_hoy.0,
        "pacientes_hoy": pacientes_hoy.0,
        "ultimas_consultas": ultimas_data
    }))
}
