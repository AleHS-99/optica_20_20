// src-tauri/src/commands/backup.rs
use sqlx::SqlitePool;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use crate::db;
use chrono::Local;

/// Convierte un FilePath a PathBuf de forma segura
fn filepath_to_pathbuf(file_path: tauri_plugin_dialog::FilePath) -> Option<std::path::PathBuf> {
    match file_path {
        tauri_plugin_dialog::FilePath::Path(p) => Some(p),
        tauri_plugin_dialog::FilePath::Url(u) => u.to_file_path().ok(),
    }
}

/// Crea un backup de la base de datos en la ubicación que elija el usuario
#[tauri::command]
pub async fn crear_backup(app: AppHandle) -> Result<serde_json::Value, String> {
    // Obtener ruta de la BD actual
    let db_path = db::get_db_path(&app)?;
    
    if !db_path.exists() {
        return Err("No se encontró la base de datos".to_string());
    }

    // Nombre por defecto con fecha
    let fecha = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let default_name = format!("backup_optica2020_{}.db", fecha);

    // Abrir diálogo para elegir ubicación
    let file_path = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("Base de datos SQLite", &["db"])
        .blocking_save_file();

    let destino = match file_path {
        Some(fp) => match filepath_to_pathbuf(fp) {
            Some(p) => p,
            None => return Err("Ruta de archivo inválida".to_string()),
        },
        None => return Ok(serde_json::json!({
            "success": false,
            "cancelled": true,
            "message": "Operación cancelada por el usuario"
        })),
    };

    // Copiar archivo
    std::fs::copy(&db_path, &destino)
        .map_err(|e| format!("Error copiando base de datos: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": format!("Backup creado exitosamente en: {}", destino.display()),
        "path": destino.display().to_string()
    }))
}

/// Restaura la base de datos desde un archivo de backup
#[tauri::command]
pub async fn restaurar_backup(
    app: AppHandle,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<serde_json::Value, String> {
    // Abrir diálogo para elegir el archivo de backup
    let file_path = app
        .dialog()
        .file()
        .add_filter("Base de datos SQLite", &["db"])
        .blocking_pick_file();

    let origen = match file_path {
        Some(fp) => match filepath_to_pathbuf(fp) {
            Some(p) => p,
            None => return Err("Ruta de archivo inválida".to_string()),
        },
        None => return Ok(serde_json::json!({
            "success": false,
            "cancelled": true,
            "message": "Operación cancelada por el usuario"
        })),
    };

    if !origen.exists() {
        return Err("El archivo de backup no existe".to_string());
    }

    // Obtener ruta de la BD actual
    let db_path = db::get_db_path(&app)?;

    // ✅ SEGURIDAD: Crear un backup automático antes de restaurar
    let fecha = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let auto_backup_path = db_path.with_file_name(format!("auto_backup_antes_restore_{}.db", fecha));
    
    std::fs::copy(&db_path, &auto_backup_path)
        .map_err(|e| format!("Error creando backup de seguridad: {}", e))?;

    // Cerrar el pool de conexiones antes de reemplazar la BD
    // (SQLite bloquea el archivo si hay conexiones abiertas)
    pool.close().await;

    // Reemplazar la BD con el backup
    std::fs::copy(&origen, &db_path)
        .map_err(|e| format!("Error restaurando base de datos: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Base de datos restaurada exitosamente. La aplicación se reiniciará.",
        "auto_backup": auto_backup_path.display().to_string(),
        "requires_restart": true
    }))
}