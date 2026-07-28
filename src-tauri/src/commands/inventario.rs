// src-tauri/src/commands/inventario.rs
use sqlx::SqlitePool;
use chrono::Local;
use crate::models::inventario::*;

// ============================================================
// CATEGORÍAS
// ============================================================

#[tauri::command]
pub async fn listar_categorias(
    pool: tauri::State<'_, SqlitePool>,
    solo_activas: Option<bool>,
) -> Result<Vec<Categoria>, String> {
    let categorias = if solo_activas.unwrap_or(false) {
        sqlx::query_as::<_, Categoria>(
            "SELECT * FROM categorias WHERE activo = 1 ORDER BY nombre"
        )
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as::<_, Categoria>(
            "SELECT * FROM categorias ORDER BY nombre"
        )
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?
    };
    Ok(categorias)
}

#[tauri::command]
pub async fn crear_categoria(
    pool: tauri::State<'_, SqlitePool>,
    datos: NuevaCategoria,
) -> Result<serde_json::Value, String> {
    if datos.nombre.trim().is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }

    let result = sqlx::query(
        "INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)"
    )
    .bind(datos.nombre.trim())
    .bind(datos.descripcion.unwrap_or_default())
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
        "message": "Categoría creada correctamente"
    }))
}

#[tauri::command]
pub async fn actualizar_categoria(
    pool: tauri::State<'_, SqlitePool>,
    id: i64,
    datos: NuevaCategoria,
) -> Result<serde_json::Value, String> {
    if datos.nombre.trim().is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }

    let ahora = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        "UPDATE categorias SET nombre = ?, descripcion = ?, updated_at = ? WHERE id = ?"
    )
    .bind(datos.nombre.trim())
    .bind(datos.descripcion.unwrap_or_default())
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
pub async fn eliminar_categoria(
    pool: tauri::State<'_, SqlitePool>,
    id: i64,
) -> Result<serde_json::Value, String> {
    // Verificar si hay productos usando esta categoría
    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM productos WHERE categoria_id = ?"
    )
    .bind(id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if count.0 > 0 {
        return Err(format!(
            "No se puede eliminar: hay {} producto(s) usando esta categoría",
            count.0
        ));
    }

    sqlx::query("DELETE FROM categorias WHERE id = ?")
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
// PROVEEDORES
// ============================================================

#[tauri::command]
pub async fn listar_proveedores(
    pool: tauri::State<'_, SqlitePool>,
    solo_activos: Option<bool>,
) -> Result<Vec<Proveedor>, String> {
    let proveedores = if solo_activos.unwrap_or(false) {
        sqlx::query_as::<_, Proveedor>(
            "SELECT * FROM proveedores WHERE activo = 1 ORDER BY nombre"
        )
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query_as::<_, Proveedor>(
            "SELECT * FROM proveedores ORDER BY nombre"
        )
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?
    };
    Ok(proveedores)
}

#[tauri::command]
pub async fn crear_proveedor(
    pool: tauri::State<'_, SqlitePool>,
    datos: NuevoProveedor,
) -> Result<serde_json::Value, String> {
    if datos.nombre.trim().is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }

    let result = sqlx::query(
        "INSERT INTO proveedores (nombre, telefono, email, direccion) VALUES (?, ?, ?, ?)"
    )
    .bind(datos.nombre.trim())
    .bind(datos.telefono)
    .bind(datos.email)
    .bind(datos.direccion)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error guardando proveedor: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "id": result.last_insert_rowid(),
        "message": "Proveedor creado correctamente"
    }))
}

#[tauri::command]
pub async fn actualizar_proveedor(
    pool: tauri::State<'_, SqlitePool>,
    id: i64,
    datos: NuevoProveedor,
) -> Result<serde_json::Value, String> {
    if datos.nombre.trim().is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }

    let ahora = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        "UPDATE proveedores SET nombre = ?, telefono = ?, email = ?, direccion = ?, updated_at = ? WHERE id = ?"
    )
    .bind(datos.nombre.trim())
    .bind(datos.telefono)
    .bind(datos.email)
    .bind(datos.direccion)
    .bind(&ahora)
    .bind(id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error actualizando proveedor: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Proveedor actualizado correctamente"
    }))
}

#[tauri::command]
pub async fn eliminar_proveedor(
    pool: tauri::State<'_, SqlitePool>,
    id: i64,
) -> Result<serde_json::Value, String> {
    // Verificar si hay productos usando este proveedor
    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM productos WHERE proveedor_id = ?"
    )
    .bind(id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if count.0 > 0 {
        return Err(format!(
            "No se puede eliminar: hay {} producto(s) usando este proveedor",
            count.0
        ));
    }

    sqlx::query("DELETE FROM proveedores WHERE id = ?")
        .bind(id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error eliminando proveedor: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Proveedor eliminado correctamente"
    }))
}

// ============================================================
// PRODUCTOS
// ============================================================

/// Genera el siguiente código de producto: P-YYYY-MM-NNNN
async fn generar_codigo_producto(pool: &SqlitePool) -> Result<String, String> {
    let ahora = Local::now();
    let anio = ahora.format("%Y").to_string();
    let mes = ahora.format("%m").to_string();
    let prefijo = format!("P-{}-{}-", anio, mes);

    // Contar productos creados este mes
    let pattern = format!("{}%", prefijo);
    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM productos WHERE codigo LIKE ?"
    )
    .bind(&pattern)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let siguiente = count.0 + 1;
    Ok(format!("{}{:04}", prefijo, siguiente))
}

#[tauri::command]
pub async fn listar_productos(
    pool: tauri::State<'_, SqlitePool>,
    search: Option<String>,
    tipo: Option<String>,
    categoria_id: Option<i64>,
    solo_activos: Option<bool>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<serde_json::Value, String> {
    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(10);
    let offset = (page - 1) * page_size;

    // Construir condiciones WHERE dinámicamente
    let mut where_clauses: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(ref search_term) = search {
        if !search_term.trim().is_empty() {
            where_clauses.push(
                "(p.codigo LIKE ? OR p.nombre LIKE ? OR p.descripcion LIKE ?)".to_string()
            );
            let pattern = format!("%{}%", search_term.trim());
            bind_values.push(pattern.clone());
            bind_values.push(pattern.clone());
            bind_values.push(pattern);
        }
    }

    if let Some(ref t) = tipo {
        if !t.is_empty() {
            where_clauses.push("p.tipo = ?".to_string());
            bind_values.push(t.clone());
        }
    }

    if let Some(cat_id) = categoria_id {
        where_clauses.push("p.categoria_id = ?".to_string());
        bind_values.push(cat_id.to_string());
    }

    if solo_activos.unwrap_or(false) {
        where_clauses.push("p.activo = 1".to_string());
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let data_query = format!(
        "SELECT p.id, p.codigo, p.nombre, p.descripcion, 
                c.nombre as categoria_nombre, p.unidad_medida, p.tipo,
                pr.nombre as proveedor_nombre, p.stock_minimo,
                p.porcentaje_ganancia_default, p.precio_venta_sugerido, p.activo
         FROM productos p
         LEFT JOIN categorias c ON p.categoria_id = c.id
         LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
         {}
         ORDER BY p.created_at DESC LIMIT ? OFFSET ?",
        where_sql
    );

    let mut query = sqlx::query_as::<_, ProductoConCategoria>(&data_query);
    for val in &bind_values {
        query = query.bind(val);
    }
    query = query.bind(page_size).bind(offset);

    let productos = query
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    // Contar total
    let count_query = format!(
        "SELECT COUNT(*) FROM productos p {}", where_sql
    );
    let mut count_query_builder = sqlx::query_as::<_, (i64,)>(&count_query);
    for val in &bind_values {
        count_query_builder = count_query_builder.bind(val);
    }
    let total = count_query_builder
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "data": productos,
        "total": total.0,
        "page": page,
        "page_size": page_size
    }))
}

#[tauri::command]
pub async fn crear_producto(
    pool: tauri::State<'_, SqlitePool>,
    datos: NuevoProducto,
) -> Result<serde_json::Value, String> {
    if datos.nombre.trim().is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }

    // Validar tipo
    let tipo = datos.tipo.unwrap_or_else(|| "PRODUCTO".to_string());
    if !["PRODUCTO", "SERVICIO"].contains(&tipo.as_str()) {
        return Err("Tipo inválido. Debe ser PRODUCTO o SERVICIO".to_string());
    }

    // Generar código automático
    let codigo = generar_codigo_producto(pool.inner()).await?;

    let result = sqlx::query(
        "INSERT INTO productos (codigo, nombre, descripcion, categoria_id, unidad_medida, tipo, proveedor_id, stock_minimo, porcentaje_ganancia_default, precio_venta_sugerido)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&codigo)
    .bind(datos.nombre.trim())
    .bind(datos.descripcion.unwrap_or_default())
    .bind(datos.categoria_id)
    .bind(datos.unidad_medida.unwrap_or_else(|| "unidad".to_string()))
    .bind(&tipo)
    .bind(datos.proveedor_id)
    .bind(datos.stock_minimo.unwrap_or(0))
    .bind(datos.porcentaje_ganancia_default.unwrap_or(30.0))
    .bind(datos.precio_venta_sugerido.unwrap_or(0.0))
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error guardando producto: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "id": result.last_insert_rowid(),
        "codigo": codigo,
        "message": "Producto creado correctamente"
    }))
}

#[tauri::command]
pub async fn actualizar_producto(
    pool: tauri::State<'_, SqlitePool>,
    id: i64,
    datos: NuevoProducto,
) -> Result<serde_json::Value, String> {
    if datos.nombre.trim().is_empty() {
        return Err("El nombre es obligatorio".to_string());
    }

    let ahora = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        "UPDATE productos SET nombre = ?, descripcion = ?, categoria_id = ?, 
         unidad_medida = ?, proveedor_id = ?, stock_minimo = ?, 
         porcentaje_ganancia_default = ?, precio_venta_sugerido = ?, updated_at = ?
         WHERE id = ?"
    )
    .bind(datos.nombre.trim())
    .bind(datos.descripcion.unwrap_or_default())
    .bind(datos.categoria_id)
    .bind(datos.unidad_medida.unwrap_or_else(|| "unidad".to_string()))
    .bind(datos.proveedor_id)
    .bind(datos.stock_minimo.unwrap_or(0))
    .bind(datos.porcentaje_ganancia_default.unwrap_or(30.0))
    .bind(datos.precio_venta_sugerido.unwrap_or(0.0))
    .bind(&ahora)
    .bind(id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error actualizando producto: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Producto actualizado correctamente"
    }))
}

/// Elimina un producto (eliminación lógica: activo = 0)
#[tauri::command]
pub async fn eliminar_producto(
    pool: tauri::State<'_, SqlitePool>,
    id: i64,
) -> Result<serde_json::Value, String> {
    let ahora = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    sqlx::query(
        "UPDATE productos SET activo = 0, updated_at = ? WHERE id = ?"
    )
    .bind(&ahora)
    .bind(id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error eliminando producto: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Producto desactivado correctamente"
    }))
}

/// Obtiene un producto por ID (para editar)
#[tauri::command]
pub async fn obtener_producto(
    pool: tauri::State<'_, SqlitePool>,
    id: i64,
) -> Result<Producto, String> {
    sqlx::query_as::<_, Producto>("SELECT * FROM productos WHERE id = ?")
        .bind(id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Producto no encontrado".to_string())
}