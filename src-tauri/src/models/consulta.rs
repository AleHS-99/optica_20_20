// src-tauri/src/models/consulta.rs
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Consulta {
    pub id: i64,
    pub paciente_id: i64,
    pub refraccion: String,
    pub ojo_derecho: String,
    pub ojo_izquierdo: String,
    pub add: String,
    pub galenos: String,
    pub corta_y_monta: String,
    pub observaciones: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct NuevaConsulta {
    pub paciente_id: i64,
    pub refraccion: Option<String>,
    pub ojo_derecho: Option<String>,
    pub ojo_izquierdo: Option<String>,
    pub add: Option<String>,
    pub galenos: Option<String>,
    pub corta_y_monta: Option<String>,
    pub observaciones: Option<String>,
}

// Struct específico para mapear el resultado del JOIN
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ConsultaConPaciente {
    pub id: i64,
    pub created_at: String,
    pub ci: String,
    pub nombre: String,
    pub apell1: String,
    pub apell2: String,
    pub refraccion: String,
    pub ojo_derecho: String,
    pub ojo_izquierdo: String,
    pub add: String,
}
