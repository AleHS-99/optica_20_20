// src-tauri/src/lib.rs
mod commands;
mod db;
mod models;

use std::sync::Mutex;
use tauri::Manager;

/// Estado global de la aplicación (accesible desde todos los commands)
pub struct AppState {
    pub authenticated: Mutex<bool>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init()) // Plugin de diálogos
        .setup(|app| {
            // Inicializar base de datos de forma asíncrona
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match db::init_db(&app_handle).await {
                    Ok(pool) => {
                        // Guardar el pool en el managed state
                        app_handle.manage(pool);
                        println!("✅ Base de datos inicializada");
                    }
                    Err(e) => {
                        eprintln!("❌ Error inicializando DB: {}", e);
                    }
                }
            });
            Ok(())
        })
        .manage(AppState {
            authenticated: Mutex::new(false),
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            commands::auth::has_users,
            commands::auth::register_first_user,
            commands::auth::login,
            commands::auth::change_password,
            commands::auth::logout,
            // Pacientes
            commands::pacientes::verificar_ci,
            commands::pacientes::crear_paciente,
            commands::pacientes::listar_pacientes,
            commands::pacientes::eliminar_paciente,
            commands::pacientes::actualizar_paciente,
            // Consultas
            commands::consultas::crear_consulta,
            commands::consultas::obtener_historico_paciente,
            commands::consultas::eliminar_consulta,
            commands::consultas::obtener_detalle_consulta,
            commands::consultas::listar_todas_consultas,
            commands::consultas::obtener_estadisticas_dashboard,
            // Backup/Restore
            commands::backup::crear_backup,
            commands::backup::restaurar_backup,
            // Inventario - Categorías
            commands::inventario::listar_categorias,
            commands::inventario::crear_categoria,
            commands::inventario::actualizar_categoria,
            commands::inventario::eliminar_categoria,
            // Inventario - Proveedores
            commands::inventario::listar_proveedores,
            commands::inventario::crear_proveedor,
            commands::inventario::actualizar_proveedor,
            commands::inventario::eliminar_proveedor,
            // Inventario - Productos
            commands::inventario::listar_productos,
            commands::inventario::crear_producto,
            commands::inventario::actualizar_producto,
            commands::inventario::eliminar_producto,
            commands::inventario::obtener_producto,
            // Entradas de Inventario (PEPS)
            commands::entradas::crear_entrada,
            commands::entradas::listar_entradas,
            commands::entradas::obtener_stock_producto,
            commands::entradas::eliminar_entrada,
            commands::entradas::listar_stock_general,
            commands::entradas::listar_movimientos,
            commands::entradas::crear_salida_manual,
        ])
        .run(tauri::generate_context!())
        .expect("error mientras se ejecuta tauri");
}
