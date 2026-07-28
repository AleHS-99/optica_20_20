// src-tauri/src/commands/entradas.rs
use sqlx::SqlitePool;
use chrono::Local;
use crate::models::inventario::*;

/// Registra una nueva entrada de inventario (compra)
/// Crea un lote y un movimiento de tipo COMPRA
#[tauri::command]
pub async fn crear_entrada(
    pool: tauri::State<'_, SqlitePool>,
    datos: NuevaEntrada,
) -> Result<serde_json::Value, String> {
    // Validaciones
    if datos.cantidad <= 0 {
        return Err("La cantidad debe ser mayor a 0".to_string());
    }
    if datos.costo_unitario < 0.0 {
        return Err("El costo unitario no puede ser negativo".to_string());
    }

    // Verificar que el producto existe y está activo
    let producto: Option<(i64, String, i32)> = sqlx::query_as(
        "SELECT id, nombre, activo FROM productos WHERE id = ?"
    )
    .bind(datos.producto_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let (_, nombre_producto, activo) = match producto {
        Some(p) => p,
        None => return Err("Producto no encontrado".to_string()),
    };

    if activo == 0 {
        return Err("No se puede registrar entrada para un producto desactivado".to_string());
    }

    let ahora = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let fecha_entrada = match datos.fecha_entrada {
        Some(f) if f.len() == 10 => format!("{} {}", f, &ahora[11..]), // "YYYY-MM-DD" + " HH:MM:SS"
        Some(f) => f,
        None => ahora.clone(),
    };

    // Crear el lote
    let lote_result = sqlx::query(
        "INSERT INTO lotes_inventario 
         (producto_id, cantidad_inicial, cantidad_restante, costo_unitario, 
          fecha_entrada, proveedor_id, numero_factura_compra, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(datos.producto_id)
    .bind(datos.cantidad)
    .bind(datos.cantidad) // cantidad_restante = cantidad_inicial al inicio
    .bind(datos.costo_unitario)
    .bind(&fecha_entrada)
    .bind(datos.proveedor_id)
    .bind(datos.numero_factura_compra.unwrap_or_default())
    .bind(datos.observaciones.unwrap_or_default())
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error creando lote: {}", e))?;

    let lote_id = lote_result.last_insert_rowid();

    // Crear el movimiento de tipo COMPRA
    sqlx::query(
        "INSERT INTO movimientos_inventario 
         (producto_id, lote_id, tipo, cantidad, costo_unitario, 
          referencia_tipo, referencia_id, motivo, fecha)
         VALUES (?, ?, 'COMPRA', ?, ?, 'LOTE', ?, ?, ?)"
    )
    .bind(datos.producto_id)
    .bind(lote_id)
    .bind(datos.cantidad)
    .bind(datos.costo_unitario)
    .bind(lote_id)
    .bind(format!("Entrada de {} unidades de {}", datos.cantidad, nombre_producto))
    .bind(&fecha_entrada)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error creando movimiento: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "lote_id": lote_id,
        "message": format!("Entrada registrada: {} unidades de {} a ${:.2} c/u", 
                          datos.cantidad, nombre_producto, datos.costo_unitario)
    }))
}

/// Lista todas las entradas (lotes) con filtros
#[tauri::command]
pub async fn listar_entradas(
    pool: tauri::State<'_, SqlitePool>,
    producto_id: Option<i64>,
    proveedor_id: Option<i64>,
    fecha_desde: Option<String>,
    fecha_hasta: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<serde_json::Value, String> {
    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(10);
    let offset = (page - 1) * page_size;

    // Construir WHERE dinámico
    let mut where_clauses: Vec<String> = Vec::new();
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(pid) = producto_id {
        where_clauses.push("l.producto_id = ?".to_string());
        bind_values.push(pid.to_string());
    }

    if let Some(prov_id) = proveedor_id {
        where_clauses.push("l.proveedor_id = ?".to_string());
        bind_values.push(prov_id.to_string());
    }

    if let Some(ref desde) = fecha_desde {
        if !desde.trim().is_empty() {
            where_clauses.push("date(l.fecha_entrada) >= date(?)".to_string());
            bind_values.push(desde.clone());
        }
    }

    if let Some(ref hasta) = fecha_hasta {
        if !hasta.trim().is_empty() {
            where_clauses.push("date(l.fecha_entrada) <= date(?)".to_string());
            bind_values.push(hasta.clone());
        }
    }

    // Filtrar solo compras reales (excluir lotes creados por ajustes)
    where_clauses.push("l.numero_factura_compra NOT LIKE 'AJUSTE-%'".to_string());


    // Siempre filtrar lotes activos
    let mut where_clauses_final: Vec<String> = vec!["l.activo = 1".to_string()];
    where_clauses_final.extend(where_clauses);

    let where_sql_final = format!("WHERE {}", where_clauses_final.join(" AND "));

    let data_query = format!(
        "SELECT l.id, l.producto_id, p.codigo as producto_codigo, 
                p.nombre as producto_nombre, l.cantidad_inicial, 
                l.cantidad_restante, l.costo_unitario,
                (l.cantidad_inicial * l.costo_unitario) as costo_total,
                l.fecha_entrada, pr.nombre as proveedor_nombre,
                l.numero_factura_compra, l.observaciones
        FROM lotes_inventario l
        JOIN productos p ON l.producto_id = p.id
        LEFT JOIN proveedores pr ON l.proveedor_id = pr.id
        {}
        ORDER BY l.fecha_entrada DESC, l.id DESC
        LIMIT ? OFFSET ?",
        where_sql_final
    );

    let mut query = sqlx::query_as::<_, LoteConDetalles>(&data_query);
    for val in &bind_values {
        query = query.bind(val);
    }
    query = query.bind(page_size).bind(offset);

    let lotes = query
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    // Contar total
    let count_query = format!(
        "SELECT COUNT(*) FROM lotes_inventario l {}", where_sql_final
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
        "data": lotes,
        "total": total.0,
        "page": page,
        "page_size": page_size
    }))
}

/// Obtiene el stock actual de un producto específico
#[tauri::command]
pub async fn obtener_stock_producto(
    pool: tauri::State<'_, SqlitePool>,
    producto_id: i64,
) -> Result<serde_json::Value, String> {
    // Stock actual = SUMA de cantidad_restante de todos los lotes activos
    let stock: Option<(i64,)> = sqlx::query_as(
        "SELECT COALESCE(SUM(cantidad_restante), 0) 
         FROM lotes_inventario 
         WHERE producto_id = ? AND activo = 1"
    )
    .bind(producto_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let stock_actual = stock.map(|s| s.0).unwrap_or(0);

    // Valor total y costo promedio PEPS
    // (suma de cantidad_restante × costo_unitario de cada lote)
    let valor: Option<(f64,)> = sqlx::query_as(
        "SELECT COALESCE(SUM(cantidad_restante * costo_unitario), 0.0) 
         FROM lotes_inventario 
         WHERE producto_id = ? AND activo = 1"
    )
    .bind(producto_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let valor_total = valor.map(|v| v.0).unwrap_or(0.0);
    let costo_promedio = if stock_actual > 0 { valor_total / stock_actual as f64 } else { 0.0 };

    // Datos del producto para saber si está bajo stock
    let prod: Option<(String, String, i64)> = sqlx::query_as(
        "SELECT codigo, nombre, stock_minimo FROM productos WHERE id = ?"
    )
    .bind(producto_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let (codigo, nombre, stock_minimo) = match prod {
        Some(p) => p,
        None => return Err("Producto no encontrado".to_string()),
    };

    let bajo_stock = if stock_actual <= stock_minimo { 1 } else { 0 };

    Ok(serde_json::json!({
        "producto_id": producto_id,
        "producto_codigo": codigo,
        "producto_nombre": nombre,
        "stock_actual": stock_actual,
        "valor_total": valor_total,
        "costo_promedio": costo_promedio,
        "stock_minimo": stock_minimo,
        "bajo_stock": bajo_stock
    }))
}

/// Elimina una entrada (solo si no ha sido consumida por ventas)
#[tauri::command]
pub async fn eliminar_entrada(
    pool: tauri::State<'_, SqlitePool>,
    lote_id: i64,
) -> Result<serde_json::Value, String> {
    // Obtener el lote
    let lote: Option<LoteInventario> = sqlx::query_as(
        "SELECT * FROM lotes_inventario WHERE id = ?"
    )
    .bind(lote_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let lote = match lote {
        Some(l) => l,
        None => return Err("Lote no encontrado".to_string()),
    };

    // Verificar que no se ha vendido nada de este lote
    if lote.cantidad_restante < lote.cantidad_inicial {
        return Err(format!(
            "No se puede eliminar: ya se han vendido {} unidades de este lote. \
             Solo se pueden eliminar entradas que no hayan sido consumidas.",
            lote.cantidad_inicial - lote.cantidad_restante
        ));
    }

    let ahora = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // Desactivar el lote (eliminación lógica)
    sqlx::query(
        "UPDATE lotes_inventario SET activo = 0, updated_at = ? WHERE id = ?"
    )
    .bind(&ahora)
    .bind(lote_id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error desactivando lote: {}", e))?;

    // Crear movimiento de "anulación" para mantener el historial
    sqlx::query(
        "INSERT INTO movimientos_inventario 
         (producto_id, lote_id, tipo, cantidad, costo_unitario, 
          referencia_tipo, referencia_id, motivo, fecha)
         VALUES (?, ?, 'ANULACION_ENTRADA', ?, ?, 'LOTE', ?, ?, ?)"
    )
    .bind(lote.producto_id)
    .bind(lote_id)
    .bind(-lote.cantidad_inicial) // cantidad negativa para anular
    .bind(lote.costo_unitario)
    .bind(lote_id)
    .bind(format!("Anulación de entrada #{}", lote_id))
    .bind(&ahora)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error creando movimiento de anulación: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Entrada eliminada correctamente"
    }))
}

/// Lista todos los productos con su stock actual (para vista de inventario valorizado)
#[tauri::command]
pub async fn listar_stock_general(
    pool: tauri::State<'_, SqlitePool>,
    solo_bajo_stock: Option<bool>,
    search: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<serde_json::Value, String> {
    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(20);
    let offset = (page - 1) * page_size;

    let mut where_clauses: Vec<String> = vec!["p.activo = 1".to_string()];
    let mut bind_values: Vec<String> = Vec::new();

    if let Some(ref search_term) = search {
        if !search_term.trim().is_empty() {
            where_clauses.push("(p.codigo LIKE ? OR p.nombre LIKE ?)".to_string());
            let pattern = format!("%{}%", search_term.trim());
            bind_values.push(pattern.clone());
            bind_values.push(pattern);
        }
    }

    let where_sql = format!("WHERE {}", where_clauses.join(" AND "));

    let data_query = format!(
        "SELECT p.id as producto_id, p.codigo as producto_codigo, 
                p.nombre as producto_nombre,
                COALESCE(SUM(l.cantidad_restante), 0) as stock_actual,
                COALESCE(SUM(l.cantidad_restante * l.costo_unitario), 0.0) as valor_total,
                CASE 
                    WHEN COALESCE(SUM(l.cantidad_restante), 0) > 0 
                    THEN COALESCE(SUM(l.cantidad_restante * l.costo_unitario), 0.0) / SUM(l.cantidad_restante)
                    ELSE 0.0 
                END as costo_promedio,
                p.stock_minimo,
                CASE 
                    WHEN COALESCE(SUM(l.cantidad_restante), 0) <= p.stock_minimo THEN 1
                    ELSE 0
                END as bajo_stock
         FROM productos p
         LEFT JOIN lotes_inventario l ON p.id = l.producto_id AND l.activo = 1
         {}
         GROUP BY p.id
         ORDER BY p.nombre
         LIMIT ? OFFSET ?",
        where_sql
    );

    let mut query = sqlx::query_as::<_, StockProducto>(&data_query);
    for val in &bind_values {
        query = query.bind(val);
    }
    query = query.bind(page_size).bind(offset);

    let mut productos = query
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    // Filtrar solo bajo stock si se solicita
    if solo_bajo_stock.unwrap_or(false) {
        productos.retain(|p| p.bajo_stock == 1);
    }

    // Contar total (sin paginación)
    let count_query = format!(
        "SELECT COUNT(DISTINCT p.id) FROM productos p 
         LEFT JOIN lotes_inventario l ON p.id = l.producto_id AND l.activo = 1
         {}", where_sql
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

/// Lista todos los movimientos de inventario (historial completo)
#[tauri::command]
pub async fn listar_movimientos(
    pool: tauri::State<'_, SqlitePool>,
    producto_id: Option<i64>,
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

    if let Some(pid) = producto_id {
        where_clauses.push("m.producto_id = ?".to_string());
        bind_values.push(pid.to_string());
    }

    if let Some(ref t) = tipo {
        if !t.trim().is_empty() {
            where_clauses.push("m.tipo = ?".to_string());
            bind_values.push(t.clone());
        }
    }

    if let Some(ref desde) = fecha_desde {
        if !desde.trim().is_empty() {
            where_clauses.push("date(m.fecha) >= date(?)".to_string());
            bind_values.push(desde.clone());
        }
    }

    if let Some(ref hasta) = fecha_hasta {
        if !hasta.trim().is_empty() {
            where_clauses.push("date(m.fecha) <= date(?)".to_string());
            bind_values.push(hasta.clone());
        }
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let data_query = format!(
        "SELECT m.id, m.producto_id, p.codigo as producto_codigo, 
                p.nombre as producto_nombre, m.lote_id, m.tipo, 
                m.cantidad, m.costo_unitario,
                (m.cantidad * m.costo_unitario) as costo_total,
                m.motivo, m.fecha
         FROM movimientos_inventario m
         JOIN productos p ON m.producto_id = p.id
         {}
         ORDER BY m.fecha DESC, m.id DESC
         LIMIT ? OFFSET ?",
        where_sql
    );

    let mut query = sqlx::query_as::<_, MovimientoConDetalles>(&data_query);
    for val in &bind_values {
        query = query.bind(val);
    }
    query = query.bind(page_size).bind(offset);

    let movimientos = query
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    // Contar total
    let count_query = format!(
        "SELECT COUNT(*) FROM movimientos_inventario m {}", where_sql
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
        "data": movimientos,
        "total": total.0,
        "page": page,
        "page_size": page_size
    }))
}

/// Registra una salida/entrada manual de inventario (ajuste, devolución, etc.)
#[tauri::command]
pub async fn crear_salida_manual(
    pool: tauri::State<'_, SqlitePool>,
    producto_id: i64,
    cantidad: i64,
    tipo: String,
    motivo: String,
    fecha: Option<String>,
) -> Result<serde_json::Value, String> {
    // Validaciones básicas
    if cantidad <= 0 {
        return Err("La cantidad debe ser mayor a 0".to_string());
    }

    let tipos_validos = ["AJUSTE_POS", "AJUSTE_NEG", "DEVOLUCION_CLIENTE", "DEVOLUCION_PROVEEDOR", "CONSUMO_INTERNO"];
    if !tipos_validos.contains(&tipo.as_str()) {
        return Err(format!("Tipo inválido. Debe ser uno de: {}", tipos_validos.join(", ")));
    }

    // Verificar que el producto existe, está activo y NO es compuesto
    let producto: Option<(String, String, i32, String)> = sqlx::query_as(
        "SELECT codigo, nombre, activo, tipo FROM productos WHERE id = ?"
    )
    .bind(producto_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let (codigo, nombre, activo, tipo_producto) = match producto {
        Some(p) => p,
        None => return Err("Producto no encontrado".to_string()),
    };

    if activo == 0 {
        return Err("No se puede registrar movimiento para un producto desactivado".to_string());
    }

    if tipo_producto == "COMPUESTO" {
        return Err("Los productos compuestos no pueden tener movimientos directos. Ajusta sus componentes.".to_string());
    }

    let ahora = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    // ✅ CORRECCIÓN: Si la fecha viene sin hora, agregarle la hora actual
    let fecha_mov = match fecha {
        Some(f) if f.len() == 10 => format!("{} {}", f, &ahora[11..]), // "YYYY-MM-DD" + " HH:MM:SS"
        Some(f) => f,
        None => ahora.clone(),
    };

    // Determinar si es ENTRADA o SALIDA según el tipo
    let es_entrada = tipo == "AJUSTE_POS" || tipo == "DEVOLUCION_CLIENTE";

    if es_entrada {
        // ============ ENTRADAS: Crear un nuevo lote ============
        
        // Calcular costo promedio actual para asignar al nuevo lote
        let costo_prom: Option<(f64,)> = sqlx::query_as(
            "SELECT CASE 
                     WHEN COALESCE(SUM(cantidad_restante), 0) > 0 
                     THEN COALESCE(SUM(cantidad_restante * costo_unitario), 0.0) / SUM(cantidad_restante)
                     ELSE 0.0 
                   END
             FROM lotes_inventario WHERE producto_id = ? AND activo = 1"
        )
        .bind(producto_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

        let costo_unit = costo_prom.map(|c| c.0).unwrap_or(0.0);

        // Crear un nuevo lote con la cantidad del ajuste
        let lote_result = sqlx::query(
            "INSERT INTO lotes_inventario 
             (producto_id, cantidad_inicial, cantidad_restante, costo_unitario, 
              fecha_entrada, numero_factura_compra, observaciones)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(producto_id)
        .bind(cantidad)
        .bind(cantidad)
        .bind(costo_unit)
        .bind(&fecha_mov)
        .bind(format!("AJUSTE-{}", &ahora.replace(|c: char| !c.is_ascii_digit(), "")))
        .bind(&motivo)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error creando lote de ajuste: {}", e))?;

        let lote_id = lote_result.last_insert_rowid();

        // Crear el movimiento asociado al lote
        sqlx::query(
            "INSERT INTO movimientos_inventario 
             (producto_id, lote_id, tipo, cantidad, costo_unitario, motivo, fecha)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(producto_id)
        .bind(lote_id)
        .bind(&tipo)
        .bind(cantidad)
        .bind(costo_unit)
        .bind(&motivo)
        .bind(&fecha_mov)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error creando movimiento: {}", e))?;

    } else {
        // ============ SALIDAS: Descontar de lotes PEPS ============
        
        // ✅ VALIDACIÓN: Verificar stock disponible ANTES de descontar
        let stock: Option<(i64,)> = sqlx::query_as(
            "SELECT COALESCE(SUM(cantidad_restante), 0) FROM lotes_inventario WHERE producto_id = ? AND activo = 1"
        )
        .bind(producto_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

        let stock_actual = stock.map(|s| s.0).unwrap_or(0);
        if stock_actual < cantidad {
            return Err(format!(
                "Stock insuficiente. Stock disponible: {}, Cantidad solicitada: {}",
                stock_actual, cantidad
            ));
        }

        // Descontar de los lotes más antiguos (PEPS)
        let mut cantidad_restante = cantidad;
        let lotes: Vec<(i64, i64, f64)> = sqlx::query_as(
            "SELECT id, cantidad_restante, costo_unitario FROM lotes_inventario 
             WHERE producto_id = ? AND activo = 1 AND cantidad_restante > 0
             ORDER BY fecha_entrada ASC, id ASC"
        )
        .bind(producto_id)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

        for (lote_id, cantidad_lote, costo_unit) in lotes {
            if cantidad_restante <= 0 {
                break;
            }

            let descontar = std::cmp::min(cantidad_restante, cantidad_lote);
            
            // Actualizar lote
            sqlx::query(
                "UPDATE lotes_inventario SET cantidad_restante = cantidad_restante - ?, updated_at = ? WHERE id = ?"
            )
            .bind(descontar)
            .bind(&ahora)
            .bind(lote_id)
            .execute(pool.inner())
            .await
            .map_err(|e| format!("Error actualizando lote: {}", e))?;

            // Crear movimiento para este lote
            sqlx::query(
                "INSERT INTO movimientos_inventario 
                 (producto_id, lote_id, tipo, cantidad, costo_unitario, motivo, fecha)
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(producto_id)
            .bind(lote_id)
            .bind(&tipo)
            .bind(-descontar) // cantidad negativa para salida
            .bind(costo_unit)
            .bind(&motivo)
            .bind(&fecha_mov)
            .execute(pool.inner())
            .await
            .map_err(|e| format!("Error creando movimiento: {}", e))?;

            cantidad_restante -= descontar;
        }
    }

    Ok(serde_json::json!({
        "success": true,
        "message": format!("{} registrado: {} unidades de {}", tipo, cantidad, nombre)
    }))
}