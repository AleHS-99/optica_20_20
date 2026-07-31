use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ============ PERÍODOS CONTABLES ============
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PeriodoContable {
    pub id: i64,
    pub periodo: String,
    pub nombre: String,
    pub estado: String,
    pub fecha_cierre: Option<String>,
    pub usuario_cierre: Option<String>,
    pub ventas_totales_cerradas: f64,
    pub gastos_totales_cerrados: f64,
    pub utilidad_neta_cerrada: f64,
    pub observaciones: String,
    pub created_at: String,
    pub updated_at: String,
}