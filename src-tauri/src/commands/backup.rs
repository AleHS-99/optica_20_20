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

/// Verifica que el archivo tenga el magic header de SQLite ("SQLite format 3\0")
fn validate_sqlite_file(path: &std::path::Path) -> Result<(), String> {
    use std::io::Read;
    let mut file = std::fs::File::open(path)
        .map_err(|e| format!("No se puede abrir el archivo: {}", e))?;
    let mut header = [0u8; 16];
    file.read_exact(&mut header)
        .map_err(|_| "El archivo está vacío o es demasiado pequeño".to_string())?;
    if &header != b"SQLite format 3\0" {
        return Err("El archivo seleccionado no es una base de datos SQLite válida".to_string());
    }
    Ok(())
}

/// Crea un backup de la base de datos usando VACUUM INTO.
/// Esto genera una copia consistente aunque el pool siga abierto.
#[tauri::command]
pub async fn crear_backup(
    app: AppHandle,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<serde_json::Value, String> {
    let fecha = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let default_name = format!("backup_optica2020_{}.db", fecha);

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
        None => {
            return Ok(serde_json::json!({
                "success": false,
                "cancelled": true,
                "message": "Operación cancelada por el usuario"
            }))
        }
    };

    // VACUUM INTO falla si el archivo destino ya existe → lo borramos primero
    if destino.exists() {
        std::fs::remove_file(&destino)
            .map_err(|e| format!("No se pudo sobrescribir el archivo: {}", e))?;
    }

    // ✅ VACUUM INTO: backup consistente sin necesidad de cerrar el pool
    // Escapamos comillas simples y normalizamos separadores para SQL
    let destino_sql = destino
        .to_string_lossy()
        .replace('\\', "/")
        .replace('\'', "''");

    sqlx::query(&format!("VACUUM INTO '{}'", destino_sql))
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error creando backup: {}", e))?;

    Ok(serde_json::json!({
        "success": true,
        "message": format!("Backup creado exitosamente en: {}", destino.display()),
        "path": destino.display().to_string()
    }))
}

/// Restaura la base de datos desde un archivo de backup.
///
/// Estrategia:
/// 1. Copia el backup a un archivo temporal (pool AÚN ABIERTO).
/// 2. Valida el temporal.
/// 3. Crea auto-backup del actual.
/// 4. Cierra el pool.
/// 5. Swap atómico: rename(actual → .old) + rename(temp → actual).
/// 6. Si el paso 5b falla, hace rollback renombrando .old de vuelta.
///
/// El frontend debe llamar a `reiniciar_aplicacion` después de esto.
#[tauri::command]
pub async fn restaurar_backup(
    app: AppHandle,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<serde_json::Value, String> {
    // 1. Elegir el archivo de backup
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
        None => {
            return Ok(serde_json::json!({
                "success": false,
                "cancelled": true,
                "message": "Operación cancelada por el usuario"
            }))
        }
    };

    if !origen.exists() {
        return Err("El archivo de backup no existe".to_string());
    }

    // 2. Validar que sea SQLite real
    validate_sqlite_file(&origen)?;

    // 3. Rutas de trabajo
    let db_path = db::get_db_path(&app)?;
    let fecha = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let auto_backup_path = db_path.with_file_name(format!("auto_backup_antes_restore_{}.db", fecha));
    let temp_path = db_path.with_file_name(format!(".restore_pending_{}.db", fecha));
    let old_db_path = db_path.with_extension("db.old");

    // 4. Copiar el backup a un TEMP (pool sigue abierto → si falla, no pasa nada)
    std::fs::copy(&origen, &temp_path)
        .map_err(|e| format!("Error copiando archivo temporal: {}", e))?;

    // 5. Validar el temp (por si acaso el origen mutó entre copia y validación)
    if let Err(e) = validate_sqlite_file(&temp_path) {
        let _ = std::fs::remove_file(&temp_path);
        return Err(e);
    }

    // 6. Auto-backup del actual ANTES de tocar nada crítico
    if db_path.exists() {
        if let Err(e) = std::fs::copy(&db_path, &auto_backup_path) {
            let _ = std::fs::remove_file(&temp_path);
            return Err(format!("Error creando backup de seguridad: {}", e));
        }
    }

    // 7. AHORA SÍ: cerrar el pool para liberar el archivo
    pool.close().await;

    // 8. Swap atómico:
    //    a. Renombrar actual → .old   (Windows no permite rename si el destino existe)
    //    b. Renombrar temp  → actual
    //    c. Eliminar .old
    if let Err(e) = std::fs::rename(&db_path, &old_db_path) {
        let _ = std::fs::remove_file(&temp_path);
        return Err(format!(
            "Error preparando restauración: {}. La base de datos actual sigue intacta.",
            e
        ));
    }

    if let Err(e) = std::fs::rename(&temp_path, &db_path) {
        // Rollback: devolver el .old a su lugar
        let _ = std::fs::rename(&old_db_path, &db_path);
        let _ = std::fs::remove_file(&temp_path);
        return Err(format!(
            "Error reemplazando base de datos: {}. Se restauró la base de datos original.",
            e
        ));
    }

    // 9. Limpieza del .old (ya no lo necesitamos)
    let _ = std::fs::remove_file(&old_db_path);

    // 10. Limpieza de WAL/SHM residuales del backup anterior
    let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
    let _ = std::fs::remove_file(db_path.with_extension("db-shm"));

    Ok(serde_json::json!({
        "success": true,
        "message": "Base de datos restaurada. Reiniciando aplicación...",
        "auto_backup": auto_backup_path.display().to_string(),
        "requires_restart": true
    }))
}

/// Reinicia realmente el proceso de la aplicación (no solo el WebView).
/// Debe llamarse DESPUÉS de `restaurar_backup`.
#[tauri::command]
pub async fn reiniciar_aplicacion(app: AppHandle) -> Result<(), String> {
    // Esto mata el proceso actual y lanza uno nuevo con el mismo binario.
    app.restart();
}