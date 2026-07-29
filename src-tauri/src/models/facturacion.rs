// src-tauri/src/models/facturacion.rs
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ============ FACTURAS ============
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Factura {
    pub id: i64,
    pub numero: String,
    pub paciente_id: Option<i64>,
    pub consulta_id: Option<i64>,
    pub fecha: String,
    pub subtotal: f64,
    pub descuento: f64,
    pub total: f64,
    pub estado: String,
    pub metodo_pago: Option<String>,
    pub observaciones: String,
    pub usuario_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct NuevaFactura {
    pub paciente_id: Option<i64>,
    pub consulta_id: Option<i64>,
    pub fecha: Option<String>,
    pub descuento: Option<f64>,
    pub metodo_pago: Option<String>,
    pub observaciones: Option<String>,
}

// Struct para listar facturas con info del paciente
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FacturaConPaciente {
    pub id: i64,
    pub numero: String,
    pub paciente_id: Option<i64>,
    pub paciente_nombre: Option<String>,
    pub paciente_ci: Option<String>,
    pub fecha: String,
    pub subtotal: f64,
    pub descuento: f64,
    pub total: f64,
    pub estado: String,
    pub metodo_pago: Option<String>,
    pub total_pagado: f64,
    pub saldo_pendiente: f64,
}
// ============ DETALLE DE FACTURA ============
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct DetalleFactura {
    pub id: i64,
    pub factura_id: i64,
    pub tipo_item: String,
    pub producto_id: Option<i64>,
    pub descripcion: String,
    pub cantidad: f64,
    pub costo_unitario: f64,
    pub precio_unitario: f64,
    pub porcentaje_ganancia: f64,
    pub subtotal: f64,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct NuevoDetalleFactura {
    pub factura_id: i64,
    pub tipo_item: String, // PRODUCTO o SERVICIO
    pub producto_id: Option<i64>,
    pub descripcion: String,
    pub cantidad: f64,
    pub costo_unitario: f64,
    pub precio_unitario: f64,
    pub porcentaje_ganancia: f64,
}

// ============ PAGOS ============
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Pago {
    pub id: i64,
    pub factura_id: i64,
    pub monto: f64,
    pub metodo_pago: String,
    pub fecha: String,
    pub referencia: String,
    pub observaciones: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct NuevoPago {
    pub factura_id: i64,
    pub monto: f64,
    pub metodo_pago: String,
    pub fecha: Option<String>,
    pub referencia: Option<String>,
    pub observaciones: Option<String>,
}