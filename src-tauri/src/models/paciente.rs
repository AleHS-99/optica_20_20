// src-tauri/src/models/paciente.rs
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Paciente {
    pub id: i64,
    pub ci: String,
    pub nombre: String,
    pub apell1: String,
    pub apell2: String,
    pub telefono: Option<String>,
    pub direccion: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct NuevoPaciente {
    pub ci: String,
    pub nombre: String,
    pub apell1: String,
    pub apell2: Option<String>,
    pub telefono: Option<String>,
    pub direccion: Option<String>,
}
