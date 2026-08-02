// src-tauri/src/commands/facturacion.rs
use sqlx::SqlitePool;
use chrono::Local;
use crate::models::facturacion::*;

/// Genera el siguiente número de factura: F-YYYY-NNNN
async fn generar_numero_factura(pool: &SqlitePool) -> Result<String, String> {
    let anio = Local::now().format("%Y").to_string();
    let prefijo = format!("F-{}-", anio);

    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM facturas WHERE numero LIKE ?"
    )
    .bind(format!("{}%", prefijo))
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let siguiente = count.0 + 1;
    Ok(format!("{}{:04}", prefijo, siguiente))
}

/// Crea una nueva factura (vacía, sin detalles)
#[tauri::command]
pub async fn crear_factura(
    pool: tauri::State<'_, SqlitePool>,
    datos: NuevaFactura,
) -> Result<serde_json::Value, String> {
    let ahora = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let fecha = match datos.fecha {
        Some(f) if f.len() == 10 => format!("{} {}", f, &ahora[11..]),
        Some(f) => f,
        None => ahora.clone(),
    };

    crate::commands::periodos::verificar_periodo_abierto(pool.inner(), &fecha).await?;
    let numero = generar_numero_factura(pool.inner()).await?;

    let result = sqlx::query(
        "INSERT INTO facturas (numero, paciente_id, consulta_id, fecha, descuento, metodo_pago, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&numero)
    .bind(datos.paciente_id)
    .bind(datos.consulta_id)
    .bind(&fecha)
    .bind(datos.descuento.unwrap_or(0.0))
    .bind(datos.metodo_pago)
    .bind(datos.observaciones.unwrap_or_default())
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error creando factura: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "factura_id": result.last_insert_rowid(),
        "numero": numero,
        "message": "Factura creada correctamente"
    }))
}

/// Función auxiliar para restaurar stock (usada al eliminar items o anular facturas)
async fn restaurar_stock_producto(
    pool: &SqlitePool,
    producto_id: i64,
    cantidad: f64,
    costo_unitario: f64,
    factura_id: i64,
) -> Result<(), String> {
    let ahora = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    // En óptica las cantidades suelen ser enteras (1 montura, 2 lentes). Redondeamos por seguridad.
    let cantidad_i64 = cantidad.round() as i64; 

    // 1. Crear un nuevo lote de "entrada" por anulación
    let lote_result = sqlx::query(
        "INSERT INTO lotes_inventario 
         (producto_id, cantidad_inicial, cantidad_restante, costo_unitario, 
          fecha_entrada, numero_factura_compra, observaciones)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(producto_id)
    .bind(cantidad_i64)
    .bind(cantidad_i64)
    .bind(costo_unitario)
    .bind(&ahora)
    .bind(format!("ANULACION-FAC-{}", factura_id))
    .bind(format!("Restauración por anulación/eliminación de factura {}", factura_id))
    .execute(pool)
    .await
    .map_err(|e| format!("Error creando lote de restauración: {}", e))?;

    let lote_id = lote_result.last_insert_rowid();

    // 2. Crear movimiento de restauración
    sqlx::query(
        "INSERT INTO movimientos_inventario 
         (producto_id, lote_id, tipo, cantidad, costo_unitario, 
          referencia_tipo, referencia_id, motivo, fecha)
         VALUES (?, ?, 'ANULACION_VENTA', ?, ?, 'FACTURA', ?, ?, ?)"
    )
    .bind(producto_id)
    .bind(lote_id)
    .bind(cantidad_i64) // Cantidad positiva porque entra al inventario
    .bind(costo_unitario)
    .bind(factura_id)
    .bind(format!("Restauración de {} unidades", cantidad))
    .bind(&ahora)
    .execute(pool)
    .await
    .map_err(|e| format!("Error creando movimiento de restauración: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn agregar_item_factura(
    pool: tauri::State<'_, SqlitePool>,
    datos: NuevoDetalleFactura,
) -> Result<serde_json::Value, String> {
    if datos.descripcion.trim().is_empty() {
        return Err("La descripción es obligatoria".to_string());
    }
    if datos.cantidad <= 0.0 {
        return Err("La cantidad debe ser mayor a 0".to_string());
    }
    if datos.precio_unitario < 0.0 {
        return Err("El precio no puede ser negativo".to_string());
    }
    let factura_fecha: Option<(String,)> = sqlx::query_as(
        "SELECT fecha FROM facturas WHERE id = ?"
    )
    .bind(datos.factura_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if let Some((fecha_factura,)) = factura_fecha {
        crate::commands::periodos::verificar_periodo_abierto(pool.inner(), &fecha_factura).await?;
    } else {
        return Err("Factura no encontrada".to_string());
    }

    // === LÓGICA DE INVENTARIO PARA PRODUCTOS ===
    if datos.tipo_item == "PRODUCTO" {
        if let Some(prod_id) = datos.producto_id {
            // 1. Validar que sea un producto real (no servicio ni compuesto)
            let tipo_prod: Option<(String,)> = sqlx::query_as(
                "SELECT tipo FROM productos WHERE id = ?"
            )
            .bind(prod_id)
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

            match tipo_prod {
                Some((t,)) if t == "PRODUCTO" => {} // OK
                Some((t,)) => return Err(format!("El item debe ser de tipo PRODUCTO, no {}", t)),
                None => return Err("Producto no encontrado".to_string()),
            }

            // 2. Verificar stock disponible
            let stock: Option<(i64,)> = sqlx::query_as(
                "SELECT COALESCE(SUM(cantidad_restante), 0) FROM lotes_inventario WHERE producto_id = ? AND activo = 1"
            )
            .bind(prod_id)
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

            let stock_actual = stock.map(|s| s.0).unwrap_or(0);
            let cantidad_i64 = datos.cantidad.round() as i64;

            if stock_actual < cantidad_i64 {
                return Err(format!(
                    "Stock insuficiente para {}. Disponible: {}, Requerido: {}",
                    datos.descripcion, stock_actual, cantidad_i64
                ));
            }

            // 3. Descontar usando PEPS
            let mut cantidad_restante = cantidad_i64;
            let lotes: Vec<(i64, i64, f64)> = sqlx::query_as(
                "SELECT id, cantidad_restante, costo_unitario FROM lotes_inventario 
                 WHERE producto_id = ? AND activo = 1 AND cantidad_restante > 0
                 ORDER BY fecha_entrada ASC, id ASC"
            )
            .bind(prod_id)
            .fetch_all(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

            let ahora = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

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
                .map_err(|e| e.to_string())?;

                // Crear movimiento de VENTA
                sqlx::query(
                    "INSERT INTO movimientos_inventario 
                     (producto_id, lote_id, tipo, cantidad, costo_unitario, referencia_tipo, referencia_id, motivo, fecha)
                     VALUES (?, ?, 'VENTA', ?, ?, 'FACTURA', ?, ?, ?)"
                )
                .bind(prod_id)
                .bind(lote_id)
                .bind(-descontar) // Negativo porque sale
                .bind(costo_unit)
                .bind(datos.factura_id)
                .bind(format!("Venta en factura"))
                .bind(&ahora)
                .execute(pool.inner())
                .await
                .map_err(|e| e.to_string())?;

                cantidad_restante -= descontar;
            }
        }
    }

    // === GUARDAR EL DETALLE ===
    let subtotal = datos.cantidad * datos.precio_unitario;

    let result = sqlx::query(
        "INSERT INTO detalle_factura (factura_id, tipo_item, producto_id, descripcion, cantidad, costo_unitario, precio_unitario, porcentaje_ganancia, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(datos.factura_id)
    .bind(&datos.tipo_item)
    .bind(datos.producto_id)
    .bind(datos.descripcion.trim())
    .bind(datos.cantidad)
    .bind(datos.costo_unitario)
    .bind(datos.precio_unitario)
    .bind(datos.porcentaje_ganancia)
    .bind(subtotal)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error agregando item: {}", e))?;

    recalcular_totales_factura(pool.inner(), datos.factura_id).await?;

    Ok(serde_json::json!({
        "success": true,
        "detalle_id": result.last_insert_rowid(),
        "message": "Item agregado y inventario actualizado"
    }))
}

/// Elimina un item de la factura Y restaura el inventario si era un producto
#[tauri::command]
pub async fn eliminar_item_factura(
    pool: tauri::State<'_, SqlitePool>,
    detalle_id: i64,
) -> Result<serde_json::Value, String> {
    let detalle: Option<(i64, String, Option<i64>, f64, f64)> = sqlx::query_as(
        "SELECT factura_id, tipo_item, producto_id, cantidad, costo_unitario FROM detalle_factura WHERE id = ?"
    )
    .bind(detalle_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let (factura_id, tipo_item, producto_id, cantidad, costo_unitario) = match detalle {
        Some(d) => d,
        None => return Err("Detalle no encontrado".to_string()),
    };

    let factura_fecha: Option<(String,)> = sqlx::query_as(
        "SELECT fecha FROM facturas WHERE id = ?"
    )
    .bind(factura_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    if let Some((fecha_factura,)) = factura_fecha {
        crate::commands::periodos::verificar_periodo_abierto(pool.inner(), &fecha_factura).await?;
    }


    // Si era un producto, restaurar el stock
    if tipo_item == "PRODUCTO" && producto_id.is_some() {
        restaurar_stock_producto(
            pool.inner(),
            producto_id.unwrap(),
            cantidad,
            costo_unitario,
            factura_id,
        )
        .await?;
    }

    // Eliminar el detalle
    sqlx::query("DELETE FROM detalle_factura WHERE id = ?")
        .bind(detalle_id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error eliminando item: {}", e))?;

    recalcular_totales_factura(pool.inner(), factura_id).await?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Item eliminado y stock restaurado"
    }))
}
/// Recalcula los totales de una factura (subtotal, total)
/// Nota: Los impuestos NO se calculan aquí, se aplican al cierre contable
async fn recalcular_totales_factura(pool: &SqlitePool, factura_id: i64) -> Result<(), String> {
    let factura: Option<(f64,)> = sqlx::query_as(
        "SELECT descuento FROM facturas WHERE id = ?"
    )
    .bind(factura_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    let (descuento,) = match factura {
        Some(f) => f,
        None => return Err("Factura no encontrada".to_string()),
    };

    let subtotal_items: (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(subtotal), 0.0) FROM detalle_factura WHERE factura_id = ?"
    )
    .bind(factura_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    let subtotal = subtotal_items.0 - descuento;
    let total = subtotal; // Sin impuestos

    sqlx::query(
        "UPDATE facturas SET subtotal = ?, total = ?, updated_at = ? WHERE id = ?"
    )
    .bind(subtotal)
    .bind(total)
    .bind(Local::now().format("%Y-%m-%d %H:%M:%S").to_string())
    .bind(factura_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Error recalculando totales: {}", e))?;

    Ok(())
}

/// Registra un pago (abono) a una factura
#[tauri::command]
pub async fn registrar_pago(
    pool: tauri::State<'_, SqlitePool>,
    datos: NuevoPago,
) -> Result<serde_json::Value, String> {
    if datos.monto <= 0.0 {
        return Err("El monto debe ser mayor a 0".to_string());
    }

    // Verificar que la factura existe
    let factura: Option<(f64,)> = sqlx::query_as(
        "SELECT total FROM facturas WHERE id = ?"
    )
    .bind(datos.factura_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let total_factura = match factura {
        Some((t,)) => t,
        None => return Err("Factura no encontrada".to_string()),
    };

    let ahora = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let fecha = match datos.fecha {
        Some(f) if f.len() == 10 => format!("{} {}", f, &ahora[11..]),
        Some(f) => f,
        None => ahora.clone(),
    };

    // Insertar pago
    sqlx::query(
        "INSERT INTO pagos (factura_id, monto, metodo_pago, fecha, referencia, observaciones)
         VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(datos.factura_id)
    .bind(datos.monto)
    .bind(&datos.metodo_pago)
    .bind(&fecha)
    .bind(datos.referencia.unwrap_or_default())
    .bind(datos.observaciones.unwrap_or_default())
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error registrando pago: {}", e))?;

    // Calcular total pagado
    let total_pagado: (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(monto), 0.0) FROM pagos WHERE factura_id = ?"
    )
    .bind(datos.factura_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Actualizar estado de la factura
    let estado = if total_pagado.0 >= total_factura {
        "PAGADA"
    } else if total_pagado.0 > 0.0 {
        "PARCIAL"
    } else {
        "PENDIENTE"
    };

    sqlx::query(
        "UPDATE facturas SET estado = ?, updated_at = ? WHERE id = ?"
    )
    .bind(estado)
    .bind(&ahora)
    .bind(datos.factura_id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error actualizando estado: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": format!("Pago registrado. Estado: {}", estado),
        "total_pagado": total_pagado.0,
        "saldo_pendiente": total_factura - total_pagado.0
    }))
}

/// Lista todas las facturas con filtros
#[tauri::command]
pub async fn listar_facturas(
    pool: tauri::State<'_, SqlitePool>,
    paciente_id: Option<i64>,
    estado: Option<String>,
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

    if let Some(pid) = paciente_id {
        where_clauses.push("f.paciente_id = ?".to_string());
        bind_values.push(pid.to_string());
    }

    if let Some(ref e) = estado {
        if !e.trim().is_empty() {
            where_clauses.push("f.estado = ?".to_string());
            bind_values.push(e.clone());
        }
    }

    if let Some(ref desde) = fecha_desde {
        if !desde.trim().is_empty() {
            where_clauses.push("date(f.fecha) >= date(?)".to_string());
            bind_values.push(desde.clone());
        }
    }

    if let Some(ref hasta) = fecha_hasta {
        if !hasta.trim().is_empty() {
            where_clauses.push("date(f.fecha) <= date(?)".to_string());
            bind_values.push(hasta.clone());
        }
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let data_query = format!(
        "SELECT f.id, f.numero, f.paciente_id, 
                p.nombre || ' ' || p.apell1 as paciente_nombre,
                p.ci as paciente_ci,
                f.fecha, f.subtotal, f.descuento, f.total,
                f.estado, f.metodo_pago,
                COALESCE(SUM(pg.monto), 0.0) as total_pagado,
                f.total - COALESCE(SUM(pg.monto), 0.0) as saldo_pendiente
         FROM facturas f
         LEFT JOIN pacientes p ON f.paciente_id = p.id
         LEFT JOIN pagos pg ON f.id = pg.factura_id
         {}
         GROUP BY f.id
         ORDER BY f.fecha DESC, f.id DESC
         LIMIT ? OFFSET ?",
        where_sql
    );

    let mut query = sqlx::query_as::<_, FacturaConPaciente>(&data_query);
    for val in &bind_values {
        query = query.bind(val);
    }
    query = query.bind(page_size).bind(offset);

    let facturas = query
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    // Contar total
    let count_query = format!(
        "SELECT COUNT(DISTINCT f.id) FROM facturas f {}", where_sql
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
        "data": facturas,
        "total": total.0,
        "page": page,
        "page_size": page_size
    }))
}

/// Obtiene el detalle completo de una factura (con items y pagos)
#[tauri::command]
pub async fn obtener_factura_detalle(
    pool: tauri::State<'_, SqlitePool>,
    factura_id: i64,
) -> Result<serde_json::Value, String> {
    // Obtener datos de la factura
    let factura: Option<FacturaConPaciente> = sqlx::query_as(
        "SELECT f.id, f.numero, f.paciente_id, 
                p.nombre || ' ' || p.apell1 as paciente_nombre,
                p.ci as paciente_ci,
                f.fecha, f.subtotal, f.descuento, f.total,
                f.estado, f.metodo_pago,
                COALESCE(SUM(pg.monto), 0.0) as total_pagado,
                f.total - COALESCE(SUM(pg.monto), 0.0) as saldo_pendiente
         FROM facturas f
         LEFT JOIN pacientes p ON f.paciente_id = p.id
         LEFT JOIN pagos pg ON f.id = pg.factura_id
         WHERE f.id = ?
         GROUP BY f.id"
    )
    .bind(factura_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let factura = match factura {
        Some(f) => f,
        None => return Err("Factura no encontrada".to_string()),
    };

    // Obtener items
    let items: Vec<DetalleFactura> = sqlx::query_as(
        "SELECT * FROM detalle_factura WHERE factura_id = ? ORDER BY id"
    )
    .bind(factura_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // Obtener pagos
    let pagos: Vec<Pago> = sqlx::query_as(
        "SELECT * FROM pagos WHERE factura_id = ? ORDER BY fecha DESC"
    )
    .bind(factura_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "factura": factura,
        "items": items,
        "pagos": pagos
    }))
}

/// Anula una factura completa: cambia estado y restaura TODO el stock de productos
#[tauri::command]
pub async fn anular_factura(
    pool: tauri::State<'_, SqlitePool>,
    factura_id: i64,
) -> Result<serde_json::Value, String> {


    let (estado, fecha_factura): (String, String) = sqlx::query_as(
        "SELECT estado, fecha FROM facturas WHERE id = ?"
    )
    .bind(factura_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?
    .ok_or("Factura no encontrada".to_string())?;

    if estado == "ANULADA" {
        return Err("La factura ya está anulada".to_string());
    }

    crate::commands::periodos::verificar_periodo_abierto(pool.inner(), &fecha_factura).await?;
    // 1. Obtener todos los items de tipo PRODUCTO de esta factura
    let items: Vec<(i64, f64, f64)> = sqlx::query_as(
        "SELECT producto_id, cantidad, costo_unitario FROM detalle_factura 
         WHERE factura_id = ? AND tipo_item = 'PRODUCTO' AND producto_id IS NOT NULL"
    )
    .bind(factura_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    // 2. Restaurar el stock de cada uno
    for (prod_id, cantidad, costo) in items {
        restaurar_stock_producto(pool.inner(), prod_id, cantidad, costo, factura_id).await?;
    }

    let ahora = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    // 3. Marcar factura como anulada
    sqlx::query(
        "UPDATE facturas SET estado = 'ANULADA', updated_at = ? WHERE id = ?"
    )
    .bind(&ahora)
    .bind(factura_id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Error anulando factura: {}", e))?;

    // 4. (Opcional pero recomendado) Eliminar pagos asociados para que no distorsionen reportes
    sqlx::query("DELETE FROM pagos WHERE factura_id = ?")
        .bind(factura_id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error limpiando pagos: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Factura anulada y stock restaurado correctamente"
    }))
}