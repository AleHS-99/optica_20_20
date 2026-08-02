// src-tauri/src/models/inventario.rs
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ============ CATEGORÍAS ============
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Categoria {
    pub id: i64,
    pub nombre: String,
    pub descripcion: String,
    pub activo: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct NuevaCategoria {
    pub nombre: String,
    pub descripcion: Option<String>,
}

// ============ PROVEEDORES ============
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Proveedor {
    pub id: i64,
    pub nombre: String,
    pub telefono: Option<String>,
    pub email: Option<String>,
    pub direccion: Option<String>,
    pub activo: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct NuevoProveedor {
    pub nombre: String,
    pub telefono: Option<String>,
    pub email: Option<String>,
    pub direccion: Option<String>,
}

// ============ PRODUCTOS ============
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Producto {
    pub id: i64,
    pub codigo: String,
    pub nombre: String,
    pub descripcion: String,
    pub categoria_id: Option<i64>,
    pub unidad_medida: String,
    pub tipo: String,
    pub proveedor_id: Option<i64>,
    pub stock_minimo: i64,
    pub porcentaje_ganancia_default: f64,
    pub precio_venta_sugerido: f64,
    pub activo: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct NuevoProducto {
    pub nombre: String,
    pub descripcion: Option<String>,
    pub categoria_id: Option<i64>,
    pub unidad_medida: Option<String>,
    pub tipo: Option<String>, // PRODUCTO, SERVICIO
    pub proveedor_id: Option<i64>,
    pub stock_minimo: Option<i64>,
    pub porcentaje_ganancia_default: Option<f64>,
    pub precio_venta_sugerido: Option<f64>,
}

// Struct para listar productos con nombre de categoría
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ProductoConCategoria {
    pub id: i64,
    pub codigo: String,
    pub nombre: String,
    pub descripcion: String,
    pub categoria_nombre: Option<String>,
    pub unidad_medida: String,
    pub tipo: String,
    pub proveedor_nombre: Option<String>,
    pub stock_minimo: i64,
    pub porcentaje_ganancia_default: f64,
    pub precio_venta_sugerido: f64,
    pub activo: i32,
}

// ============ LOTES DE INVENTARIO ============
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LoteInventario {
    pub id: i64,
    pub producto_id: i64,
    pub cantidad_inicial: i64,
    pub cantidad_restante: i64,
    pub costo_unitario: f64,
    pub fecha_entrada: String,
    pub proveedor_id: Option<i64>,
    pub numero_factura_compra: String,
    pub observaciones: String,
    pub activo: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct NuevaEntrada {
    pub producto_id: i64,
    pub cantidad: i64,
    pub costo_unitario: f64,
    pub fecha_entrada: Option<String>, // Si no se pone, usa hoy
    pub proveedor_id: Option<i64>,
    pub numero_factura_compra: Option<String>,
    pub observaciones: Option<String>,
}

// Struct para listar lotes con información adicional
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LoteConDetalles {
    pub id: i64,
    pub producto_id: i64,
    pub producto_codigo: String,
    pub producto_nombre: String,
    pub cantidad_inicial: i64,
    pub cantidad_restante: i64,
    pub costo_unitario: f64,
    pub costo_total: f64, // Calculado en Rust
    pub fecha_entrada: String,
    pub proveedor_nombre: Option<String>,
    pub numero_factura_compra: String,
    pub observaciones: String,
}

// ============ MOVIMIENTOS ============

// Struct para listar stock actual por producto
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StockProducto {
    pub producto_id: i64,
    pub producto_codigo: String,
    pub producto_nombre: String,
    pub stock_actual: i64,
    pub valor_total: f64, // stock × costo promedio PEPS
    pub costo_promedio: f64,
    pub stock_minimo: i64,
    pub bajo_stock: i32, // 1 si stock_actual <= stock_minimo
}

// Struct para listar movimientos con info del producto
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MovimientoConDetalles {
    pub id: i64,
    pub producto_id: i64,
    pub producto_codigo: String,
    pub producto_nombre: String,
    pub lote_id: Option<i64>,
    pub tipo: String,
    pub cantidad: i64,
    pub costo_unitario: f64,
    pub costo_total: f64,
    pub motivo: String,
    pub fecha: String,
}