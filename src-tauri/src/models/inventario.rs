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
    pub tipo: Option<String>, // PRODUCTO, SERVICIO, COMPUESTO
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