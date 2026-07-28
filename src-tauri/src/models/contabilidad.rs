// src-tauri/src/models/contabilidad.rs
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ============ CATEGORÍAS DE GASTO ============
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CategoriaGasto {
    pub id: i64,
    pub nombre: String,
    pub descripcion: String,
    pub tipo: String, // FIJO o VARIABLE
    pub activo: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct NuevaCategoriaGasto {
    pub nombre: String,
    pub descripcion: Option<String>,
    pub tipo: Option<String>, // FIJO o VARIABLE
}

// ============ GASTOS ============
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Gasto {
    pub id: i64,
    pub categoria_id: i64,
    pub descripcion: String,
    pub monto: f64,
    pub fecha: String,
    pub tipo: String,
    pub es_autogenerado: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct NuevoGasto {
    pub categoria_id: i64,
    pub descripcion: String,
    pub monto: f64,
    pub fecha: Option<String>,
    pub tipo: Option<String>,
}

// Struct para listar gastos con nombre de categoría
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct GastoConCategoria {
    pub id: i64,
    pub categoria_id: i64,
    pub categoria_nombre: String,
    pub categoria_tipo: String,
    pub descripcion: String,
    pub monto: f64,
    pub fecha: String,
    pub tipo: String,
    pub es_autogenerado: i32,
}

// ============ PLANTILLA DE GASTOS FIJOS ============
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct GastoFijoPlantilla {
    pub id: i64,
    pub categoria_id: i64,
    pub descripcion: String,
    pub monto: f64,
    pub activo: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct NuevoGastoFijo {
    pub categoria_id: i64,
    pub descripcion: String,
    pub monto: f64,
}

// Struct para listar plantilla con nombre de categoría
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct GastoFijoConCategoria {
    pub id: i64,
    pub categoria_id: i64,
    pub categoria_nombre: String,
    pub descripcion: String,
    pub monto: f64,
    pub activo: i32,
}

// ============ IMPUESTOS ============
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Impuesto {
    pub id: i64,
    pub nombre: String,
    pub porcentaje: f64,
    pub activo: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct NuevoImpuesto {
    pub nombre: String,
    pub porcentaje: f64,
}