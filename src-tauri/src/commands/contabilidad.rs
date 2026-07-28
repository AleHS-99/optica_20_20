// src-tauri/src/commands/contabilidad.rs
use sqlx::SqlitePool;
use chrono::Local;
use crate::models::contabilidad::*;

// ============================================================
// CATEGORÍAS DE GASTO
// ============================================================

#[tauri::command]
pub async fn listar_categorias_gasto(
    pool: tauri::State<'_, SqlitePool>,
    solo_activas: Option<bool>,
) -> Result<Vec<CategoriaGasto>, String> {
    let categorias = if solo_activas.unwrap_or(false) {
        sqlx::query_as::<_, CategoriaGasto>(
            "SELECT * FROM categorias_gasto WHERE activo = 1 ORDER BY nombre"
        )
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as::<_, CategoriaGasto>(
            "SELECT * FROM categorias_gasto ORDER BY nombre"
        )
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?
    };
    Ok(categorias)
}

#[tauri::command]
pub async fn crear_categoria_gasto(
    pool: tauri::State<'_, SqlitePool>,
    datos: NuevaCategoriaGasto,
) -> Result<serde_json::Value, String> {
    if datos.nombre.trim().is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }

    let tipo = datos.tipo.unwrap_or_else(|| "VARIABLE".to_string());
    if !["FIJO", "VARIABLE"].contains(&tipo.as_str()) {
        return Err("Tipo inválido. Debe ser FIJO o VARIABLE".to_string());
    }

    let result = sqlx::query(
        "INSERT INTO categorias_gasto (nombre, descripcion, tipo) VALUES (?, ?, ?)"
    )
    .bind(datos.nombre.trim())
    .bind(datos.descripcion.unwrap_or_default())
    .bind(&tipo)
    .execute(pool.inner())
    .await
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Ya existe una categoría con ese nombre".to_string()
        } else {
            format!("Error guardando categoría: {}", e)
        }
    })?;

    Ok(serde_json::json!({
        "success": true,
        "id": result.last_insert_rowid(),
        "message": "Categoría de gasto creada correctamente"
    }))
}

#[tauri::command]
pub async fn actualizar_categoria_gasto(
    pool: tauri::State<'_, SqlitePool>,
    id: i64,
    datos: NuevaCategoriaGasto,
) -> Result<serde_json::Value, String> {
    if datos.nombre.trim().is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }

    let tipo = datos.tipo.unwrap_or_else(|| "VARIABLE".to_string());
    let ahora = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        "UPDATE categorias_gasto SET nombre = ?, descripcion = ?, tipo = ?, updated_at = ? WHERE id = ?"
    )
    .bind(datos.nombre.trim())
    .bind(datos.descripcion.unwrap_or_default())
    .bind(&tipo)
    .bind(&ahora)
    .bind(id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error actualizando categoría: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Categoría actualizada correctamente"
    }))
}

#[tauri::command]
pub async fn eliminar_categoria_gasto(
    pool: tauri::State<'_, SqlitePool>,
    id: i64,
) -> Result<serde_json::Value, String> {
    // Verificar si hay gastos usando esta categoría
    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM gastos WHERE categoria_id = ?"
    )
    .bind(id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if count.0 > 0 {
        return Err(format!(
            "No se puede eliminar: hay {} gasto(s) usando esta categoría",
            count.0
        ));
    }

    // También verificar en plantilla
    let count_plantilla: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM gastos_fijos_plantilla WHERE categoria_id = ?"
    )
    .bind(id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if count_plantilla.0 > 0 {
        return Err(format!(
            "No se puede eliminar: hay {} gasto(s) fijo(s) usando esta categoría",
            count_plantilla.0
        ));
    }

    sqlx::query("DELETE FROM categorias_gasto WHERE id = ?")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error eliminando categoría: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Categoría eliminada correctamente"
    }))
}

// ============================================================
// GASTOS
// ============================================================

#[tauri::command]
pub async fn listar_gastos(
    pool: tauri::State<'_, SqlitePool>,
    categoria_id: Option<i64>,
    tipo: Option<String>,
    fecha_desde: Option<String>,
    fecha_hasta: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<serde_json::Value, String> {
    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(20);
    let offset = (page - 1) * page_size;

    let mut where_clauses: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(cat_id) = categoria_id {
        where_clauses.push("g.categoria_id = ?".to_string());
        bind_values.push(cat_id.to_string());
    }

    if let Some(ref t) = tipo {
        if !t.trim().is_empty() {
            where_clauses.push("g.tipo = ?".to_string());
            bind_values.push(t.clone());
        }
    }

    if let Some(ref desde) = fecha_desde {
        if !desde.trim().is_empty() {
            where_clauses.push("date(g.fecha) >= date(?)".to_string());
            bind_values.push(desde.clone());
        }
    }

    if let Some(ref hasta) = fecha_hasta {
        if !hasta.trim().is_empty() {
            where_clauses.push("date(g.fecha) <= date(?)".to_string());
            bind_values.push(hasta.clone());
        }
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let data_query = format!(
        "SELECT g.id, g.categoria_id, c.nombre as categoria_nombre, 
                c.tipo as categoria_tipo, g.descripcion, g.monto, 
                g.fecha, g.tipo, g.es_autogenerado
         FROM gastos g
         JOIN categorias_gasto c ON g.categoria_id = c.id
         {}
         ORDER BY g.fecha DESC, g.id DESC
         LIMIT ? OFFSET ?",
        where_sql
    );

    let mut query = sqlx::query_as::<_, GastoConCategoria>(&data_query);
    for val in &bind_values {
        query = query.bind(val);
    }
    query = query.bind(page_size).bind(offset);

    let gastos = query
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    // Contar total
    let count_query = format!(
        "SELECT COUNT(*) FROM gastos g {}", where_sql
    );
    let mut count_query_builder = sqlx::query_as::<_, (i64,)>(&count_query);
    for val in &bind_values {
        count_query_builder = count_query_builder.bind(val);
    }
    let total = count_query_builder
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    // Calcular total del periodo (suma de montos con los mismos filtros)
    let sum_query = format!(
        "SELECT COALESCE(SUM(g.monto), 0.0) FROM gastos g {}", where_sql
    );
    let mut sum_query_builder = sqlx::query_as::<_, (f64,)>(&sum_query);
    for val in &bind_values {
        sum_query_builder = sum_query_builder.bind(val);
    }
    let suma_total = sum_query_builder
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "data": gastos,
        "total": total.0,
        "suma_total": suma_total.0,
        "page": page,
        "page_size": page_size
    }))
}

#[tauri::command]
pub async fn crear_gasto(
    pool: tauri::State<'_, SqlitePool>,
    datos: NuevoGasto,
) -> Result<serde_json::Value, String> {
    if datos.descripcion.trim().is_empty() {
        return Err("La descripción es obligatoria".to_string());
    }
    if datos.monto <= 0.0 {
        return Err("El monto debe ser mayor a 0".to_string());
    }

    // Verificar que la categoría existe
    let cat: Option<(String,)> = sqlx::query_as(
        "SELECT nombre FROM categorias_gasto WHERE id = ?"
    )
    .bind(datos.categoria_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if cat.is_none() {
        return Err("Categoría de gasto no encontrada".to_string());
    }

    let ahora = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let fecha = match datos.fecha {
        Some(f) if f.len() == 10 => format!("{} {}", f, &ahora[11..]),
        Some(f) => f,
        None => ahora.clone(),
    };

    let tipo = datos.tipo.unwrap_or_else(|| "VARIABLE".to_string());

    let result = sqlx::query(
        "INSERT INTO gastos (categoria_id, descripcion, monto, fecha, tipo, es_autogenerado)
         VALUES (?, ?, ?, ?, ?, 0)"
    )
    .bind(datos.categoria_id)
    .bind(datos.descripcion.trim())
    .bind(datos.monto)
    .bind(&fecha)
    .bind(&tipo)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error guardando gasto: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "id": result.last_insert_rowid(),
        "message": "Gasto registrado correctamente"
    }))
}

#[tauri::command]
pub async fn actualizar_gasto(
    pool: tauri::State<'_, SqlitePool>,
    id: i64,
    datos: NuevoGasto,
) -> Result<serde_json::Value, String> {
    if datos.descripcion.trim().is_empty() {
        return Err("La descripción es obligatoria".to_string());
    }
    if datos.monto <= 0.0 {
        return Err("El monto debe ser mayor a 0".to_string());
    }

    // Verificar que no sea autogenerado
    let gasto: Option<(i32,)> = sqlx::query_as(
        "SELECT es_autogenerado FROM gastos WHERE id = ?"
    )
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    match gasto {
        Some((autogen,)) if autogen == 1 => {
            return Err("No se puede editar un gasto autogenerado desde la plantilla. Edita la plantilla.".to_string());
        }
        None => return Err("Gasto no encontrado".to_string()),
        _ => {}
    }

    let ahora = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let fecha = match datos.fecha {
        Some(f) if f.len() == 10 => format!("{} {}", f, &ahora[11..]),
        Some(f) => f,
        None => ahora.clone(),
    };

    let tipo = datos.tipo.unwrap_or_else(|| "VARIABLE".to_string());

    sqlx::query(
        "UPDATE gastos SET categoria_id = ?, descripcion = ?, monto = ?, fecha = ?, tipo = ?, updated_at = ? WHERE id = ?"
    )
    .bind(datos.categoria_id)
    .bind(datos.descripcion.trim())
    .bind(datos.monto)
    .bind(&fecha)
    .bind(&tipo)
    .bind(&ahora)
    .bind(id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error actualizando gasto: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Gasto actualizado correctamente"
    }))
}

#[tauri::command]
pub async fn eliminar_gasto(
    pool: tauri::State<'_, SqlitePool>,
    id: i64,
) -> Result<serde_json::Value, String> {
    // Verificar que no sea autogenerado
    let gasto: Option<(i32,)> = sqlx::query_as(
        "SELECT es_autogenerado FROM gastos WHERE id = ?"
    )
    .bind(id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    match gasto {
        Some((autogen,)) if autogen == 1 => {
            return Err("No se puede eliminar un gasto autogenerado. Desactívalo de la plantilla.".to_string());
        }
        None => return Err("Gasto no encontrado".to_string()),
        _ => {}
    }

    sqlx::query("DELETE FROM gastos WHERE id = ?")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error eliminando gasto: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Gasto eliminado correctamente"
    }))
}

// ============================================================
// PLANTILLA DE GASTOS FIJOS
// ============================================================

#[tauri::command]
pub async fn listar_gastos_fijos_plantilla(
    pool: tauri::State<'_, SqlitePool>,
) -> Result<Vec<GastoFijoConCategoria>, String> {
    let plantilla = sqlx::query_as::<_, GastoFijoConCategoria>(
        "SELECT gf.id, gf.categoria_id, c.nombre as categoria_nombre,
                gf.descripcion, gf.monto, gf.activo
         FROM gastos_fijos_plantilla gf
         JOIN categorias_gasto c ON gf.categoria_id = c.id
         ORDER BY c.nombre, gf.descripcion"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(plantilla)
}

#[tauri::command]
pub async fn crear_gasto_fijo(
    pool: tauri::State<'_, SqlitePool>,
    datos: NuevoGastoFijo,
) -> Result<serde_json::Value, String> {
    if datos.descripcion.trim().is_empty() {
        return Err("La descripción es obligatoria".to_string());
    }
    if datos.monto <= 0.0 {
        return Err("El monto debe ser mayor a 0".to_string());
    }

    // Verificar que la categoría existe y es de tipo FIJO
    let cat: Option<(String, String)> = sqlx::query_as(
        "SELECT nombre, tipo FROM categorias_gasto WHERE id = ?"
    )
    .bind(datos.categoria_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let (_, tipo_cat) = match cat {
        Some(c) => c,
        None => return Err("Categoría no encontrada".to_string()),
    };

    if tipo_cat != "FIJO" {
        return Err("Solo se pueden agregar gastos fijos a categorías de tipo FIJO".to_string());
    }

    let result = sqlx::query(
        "INSERT INTO gastos_fijos_plantilla (categoria_id, descripcion, monto) VALUES (?, ?, ?)"
    )
    .bind(datos.categoria_id)
    .bind(datos.descripcion.trim())
    .bind(datos.monto)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error guardando gasto fijo: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "id": result.last_insert_rowid(),
        "message": "Gasto fijo agregado a la plantilla"
    }))
}

#[tauri::command]
pub async fn actualizar_gasto_fijo(
    pool: tauri::State<'_, SqlitePool>,
    id: i64,
    datos: NuevoGastoFijo,
) -> Result<serde_json::Value, String> {
    if datos.descripcion.trim().is_empty() {
        return Err("La descripción es obligatoria".to_string());
    }
    if datos.monto <= 0.0 {
        return Err("El monto debe ser mayor a 0".to_string());
    }

    let ahora = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        "UPDATE gastos_fijos_plantilla SET categoria_id = ?, descripcion = ?, monto = ?, updated_at = ? WHERE id = ?"
    )
    .bind(datos.categoria_id)
    .bind(datos.descripcion.trim())
    .bind(datos.monto)
    .bind(&ahora)
    .bind(id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error actualizando gasto fijo: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Gasto fijo actualizado"
    }))
}

#[tauri::command]
pub async fn toggle_gasto_fijo(
    pool: tauri::State<'_, SqlitePool>,
    id: i64,
) -> Result<serde_json::Value, String> {
    let ahora = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        "UPDATE gastos_fijos_plantilla SET activo = CASE WHEN activo = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?"
    )
    .bind(&ahora)
    .bind(id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error actualizando estado: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Estado actualizado"
    }))
}

#[tauri::command]
pub async fn eliminar_gasto_fijo(
    pool: tauri::State<'_, SqlitePool>,
    id: i64,
) -> Result<serde_json::Value, String> {
    sqlx::query("DELETE FROM gastos_fijos_plantilla WHERE id = ?")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error eliminando gasto fijo: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Gasto fijo eliminado de la plantilla"
    }))
}

// ============================================================
// IMPUESTOS
// ============================================================

#[tauri::command]
pub async fn listar_impuestos(
    pool: tauri::State<'_, SqlitePool>,
    solo_activos: Option<bool>,
) -> Result<Vec<Impuesto>, String> {
    let impuestos = if solo_activos.unwrap_or(false) {
        sqlx::query_as::<_, Impuesto>(
            "SELECT * FROM impuestos WHERE activo = 1 ORDER BY nombre"
        )
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as::<_, Impuesto>(
            "SELECT * FROM impuestos ORDER BY nombre"
        )
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?
    };
    Ok(impuestos)
}

#[tauri::command]
pub async fn crear_impuesto(
    pool: tauri::State<'_, SqlitePool>,
    datos: NuevoImpuesto,
) -> Result<serde_json::Value, String> {
    if datos.nombre.trim().is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }
    if datos.porcentaje < 0.0 {
        return Err("El porcentaje no puede ser negativo".to_string());
    }

    let result = sqlx::query(
        "INSERT INTO impuestos (nombre, porcentaje) VALUES (?, ?)"
    )
    .bind(datos.nombre.trim())
    .bind(datos.porcentaje)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error guardando impuesto: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "id": result.last_insert_rowid(),
        "message": "Impuesto creado correctamente"
    }))
}

#[tauri::command]
pub async fn actualizar_impuesto(
    pool: tauri::State<'_, SqlitePool>,
    id: i64,
    datos: NuevoImpuesto,
) -> Result<serde_json::Value, String> {
    if datos.nombre.trim().is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }
    if datos.porcentaje < 0.0 {
        return Err("El porcentaje no puede ser negativo".to_string());
    }

    let ahora = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        "UPDATE impuestos SET nombre = ?, porcentaje = ?, updated_at = ? WHERE id = ?"
    )
    .bind(datos.nombre.trim())
    .bind(datos.porcentaje)
    .bind(&ahora)
    .bind(id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error actualizando impuesto: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Impuesto actualizado correctamente"
    }))
}

#[tauri::command]
pub async fn eliminar_impuesto(
    pool: tauri::State<'_, SqlitePool>,
    id: i64,
) -> Result<serde_json::Value, String> {
    // Verificar si hay facturas usando este impuesto (cuando exista la tabla facturas)
    // Por ahora, permitimos eliminar sin restricciones
    sqlx::query("DELETE FROM impuestos WHERE id = ?")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error eliminando impuesto: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Impuesto eliminado correctamente"
    }))
}