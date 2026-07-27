// src-tauri/src/db/mod.rs
pub mod migrations;

use sqlx::sqlite::{SqlitePool, SqlitePoolOptions};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Obtiene la ruta donde se guardará la base de datos.
/// Usa la carpeta de datos de la app (AppData en Windows).
pub fn get_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Error obteniendo directorio de datos: {}", e))?;

    // Crear la carpeta si no existe
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Error creando directorio: {}", e))?;

    Ok(app_data_dir.join("optica2020.db"))
}

/// Crea el pool de conexiones a SQLite
pub async fn init_db(app: &AppHandle) -> Result<SqlitePool, String> {
    let db_path = get_db_path(app)?;
    let db_url = format!("sqlite://{}?mode=rwc", db_path.display());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .map_err(|e| format!("Error conectando a SQLite: {}", e))?;

    // Ejecutar migraciones (crear tablas si no existen)
    migrations::run_migrations(&pool).await?;

    Ok(pool)
}
