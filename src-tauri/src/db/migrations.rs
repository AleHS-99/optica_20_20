// src-tauri/src/db/migrations.rs
use sqlx::SqlitePool;

/// Ejecuta todas las migraciones (crea las tablas si no existen)
pub async fn run_migrations(pool: &SqlitePool) -> Result<(), String> {
    // Tabla de usuarios (solo habrá uno, pero la diseñamos escalable)
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Error creando tabla users: {}", e))?;

    // Tabla de pacientes (equivalente a tu modelo Django)
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS pacientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ci TEXT NOT NULL UNIQUE,
            nombre TEXT NOT NULL,
            apell1 TEXT NOT NULL,
            apell2 TEXT NOT NULL DEFAULT '',
            telefono TEXT,
            direccion TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Error creando tabla pacientes: {}", e))?;

    // Tabla de consultas (equivalente a consultaModel)
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS consultas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id INTEGER NOT NULL,
            refraccion TEXT NOT NULL DEFAULT '',
            ojo_derecho TEXT NOT NULL DEFAULT '',
            ojo_izquierdo TEXT NOT NULL DEFAULT '',
            "add" TEXT NOT NULL DEFAULT '',
            galenos TEXT NOT NULL DEFAULT '',
            corta_y_monta TEXT NOT NULL DEFAULT '',
            observaciones TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE
        )
         "#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Error creando tabla consultas: {}", e))?;

    //  Índice para acelerar búsquedas y ordenamientos por fecha
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_consultas_created_at ON consultas(created_at DESC)",
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Error creando índice: {}", e))?;

    // Índice para búsquedas por paciente
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_consultas_paciente_id ON consultas(paciente_id)")
        .execute(pool)
        .await
        .map_err(|e| format!("Error creando índice: {}", e))?;

    // Índice para búsquedas de pacientes por CI y nombre
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_pacientes_ci ON pacientes(ci)")
        .execute(pool)
        .await
        .map_err(|e| format!("Error creando índice: {}", e))?;

        // ============================================================
    // MÓDULO INVENTARIO - v0.0.2
    // ============================================================

    // Categorías de productos
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            descripcion TEXT NOT NULL DEFAULT '',
            activo INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Error creando tabla categorias: {}", e))?;

    // Proveedores (opcional)
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS proveedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            telefono TEXT,
            email TEXT,
            direccion TEXT,
            activo INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Error creando tabla proveedores: {}", e))?;

    // Productos (corazón del inventario)
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT NOT NULL UNIQUE,
            nombre TEXT NOT NULL,
            descripcion TEXT NOT NULL DEFAULT '',
            categoria_id INTEGER,
            unidad_medida TEXT NOT NULL DEFAULT 'unidad',
            tipo TEXT NOT NULL DEFAULT 'PRODUCTO',
            proveedor_id INTEGER,
            stock_minimo INTEGER NOT NULL DEFAULT 0,
            porcentaje_ganancia_default REAL NOT NULL DEFAULT 30.0,
            precio_venta_sugerido REAL NOT NULL DEFAULT 0.0,
            activo INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (categoria_id) REFERENCES categorias(id),
            FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Error creando tabla productos: {}", e))?;

    // Índices para inventario
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(codigo)")
        .execute(pool)
        .await
        .map_err(|e| format!("Error creando índice: {}", e))?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id)")
        .execute(pool)
        .await
        .map_err(|e| format!("Error creando índice: {}", e))?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_productos_tipo ON productos(tipo)")
        .execute(pool)
        .await
        .map_err(|e| format!("Error creando índice: {}", e))?;

    // ============================================================
    // MÓDULO INVENTARIO - v0.0.2
    // ============================================================

    // Categorías de productos
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            descripcion TEXT NOT NULL DEFAULT '',
            activo INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Error creando tabla categorias: {}", e))?;

    // Proveedores (opcional)
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS proveedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            telefono TEXT,
            email TEXT,
            direccion TEXT,
            activo INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Error creando tabla proveedores: {}", e))?;

    // Productos (corazón del inventario)
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT NOT NULL UNIQUE,
            nombre TEXT NOT NULL,
            descripcion TEXT NOT NULL DEFAULT '',
            categoria_id INTEGER,
            unidad_medida TEXT NOT NULL DEFAULT 'unidad',
            tipo TEXT NOT NULL DEFAULT 'PRODUCTO',
            proveedor_id INTEGER,
            stock_minimo INTEGER NOT NULL DEFAULT 0,
            porcentaje_ganancia_default REAL NOT NULL DEFAULT 30.0,
            precio_venta_sugerido REAL NOT NULL DEFAULT 0.0,
            activo INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (categoria_id) REFERENCES categorias(id),
            FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| format!("Error creando tabla productos: {}", e))?;

    // Índices para inventario
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(codigo)")
        .execute(pool)
        .await
        .map_err(|e| format!("Error creando índice: {}", e))?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id)")
        .execute(pool)
        .await
        .map_err(|e| format!("Error creando índice: {}", e))?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_productos_tipo ON productos(tipo)")
        .execute(pool)
        .await
        .map_err(|e| format!("Error creando índice: {}", e))?;

    println!("✅ Módulo Inventario inicializado");
    
    Ok(())
}
