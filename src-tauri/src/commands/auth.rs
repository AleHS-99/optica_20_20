// src-tauri/src/commands/auth.rs
use argon2::{
    password_hash::{
        rand_core::OsRng, // <-- Ahora funciona gracias al feature "rand_core" en Cargo.toml
        PasswordHash, PasswordHasher, PasswordVerifier, SaltString,
    },
    Argon2, // <-- ¡Este era el que faltaba!
};
use sqlx::SqlitePool;
use crate::models::user::User;
use crate::AppState;

/// Verifica si existe algún usuario en el sistema (para primera ejecución)
#[tauri::command]
pub async fn has_users(pool: tauri::State<'_, SqlitePool>) -> Result<bool, String> {
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    Ok(count.0 > 0)
}

/// Registra el primer (y único) usuario del sistema
#[tauri::command]
pub async fn register_first_user(
    pool: tauri::State<'_, SqlitePool>,
    username: String,
    password: String,
) -> Result<bool, String> {
    // Verificar que no haya usuarios
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    if count.0 > 0 {
        return Err("Ya existe un usuario en el sistema".to_string());
    }

    // Validaciones básicas
    if username.trim().is_empty() {
        return Err("El nombre de usuario no puede estar vacío".to_string());
    }
    if password.len() < 4 {
        return Err("La contraseña debe tener al menos 4 caracteres".to_string());
    }

    // Hashear contraseña con Argon2
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Error hasheando contraseña: {}", e))?
        .to_string();

    // Insertar usuario
    sqlx::query("INSERT INTO users (username, password_hash) VALUES (?, ?)")
        .bind(username.trim())
        .bind(&password_hash)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Error guardando usuario: {}", e))?;

    Ok(true)
}

/// Inicia sesión y devuelve true si las credenciales son correctas
#[tauri::command]
pub async fn login(
    pool: tauri::State<'_, SqlitePool>,
    state: tauri::State<'_, AppState>,
    username: String,
    password: String,
) -> Result<bool, String> {
    // Buscar usuario
    let user: Option<User> = sqlx::query_as("SELECT * FROM users WHERE username = ?")
        .bind(username.trim())
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    let user = match user {
        Some(u) => u,
        None => return Ok(false),
    };

    // Verificar contraseña
    let parsed_hash = PasswordHash::new(&user.password_hash)
        .map_err(|e| format!("Error parseando hash: {}", e))?;

    if Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok()
    {
        // Marcar como autenticado en el estado global
        let mut auth = state.authenticated.lock().unwrap();
        *auth = true;
        Ok(true)
    } else {
        Ok(false)
    }
}

/// Cambia la contraseña del usuario autenticado
#[tauri::command]
pub async fn change_password(
    pool: tauri::State<'_, SqlitePool>,
    state: tauri::State<'_, AppState>,
    current_password: String,
    new_password: String,
) -> Result<bool, String> {
    // Verificar que esté autenticado
    {
        let auth = state.authenticated.lock().unwrap();
        if !*auth {
            return Err("No estás autenticado".to_string());
        }
    }

    if new_password.len() < 4 {
        return Err("La nueva contraseña debe tener al menos 4 caracteres".to_string());
    }

    // Obtener el usuario (solo hay uno)
    let user: User = sqlx::query_as("SELECT * FROM users LIMIT 1")
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    // Verificar contraseña actual
    let parsed_hash = PasswordHash::new(&user.password_hash)
        .map_err(|e| format!("Error parseando hash: {}", e))?;

    if Argon2::default()
        .verify_password(current_password.as_bytes(), &parsed_hash)
        .is_err()
    {
        return Err("La contraseña actual es incorrecta".to_string());
    }

    // Hashear nueva contraseña
    let salt = SaltString::generate(&mut OsRng);
    let new_hash = Argon2::default()
        .hash_password(new_password.as_bytes(), &salt)
        .map_err(|e| format!("Error hasheando contraseña: {}", e))?
        .to_string();

    // Actualizar en BD
    sqlx::query("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(&new_hash)
        .bind(user.id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

    Ok(true)
}

/// Cierra la sesión
#[tauri::command]
pub async fn logout(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut auth = state.authenticated.lock().unwrap();
    *auth = false;
    Ok(())
}
