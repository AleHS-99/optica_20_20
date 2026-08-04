# Optica 20/20

Sistema de gestión integral para ópticas desarrollado con **Tauri**, **React** y **TypeScript**. Diseñado para el control completo de pacientes, consultas, inventario, facturación, contabilidad y cierre mensual, con un enfoque específico para el contexto cubano.

---

## 📋 Tabla de Contenidos

- [Características Principales](#-características-principales)
- [Tecnologías Utilizadas](#-tecnologías-utilizadas)
- [Requisitos del Sistema](#-requisitos-del-sistema)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Módulos Funcionales](#-módulos-funcionales)
  - [Autenticación](#autenticación)
  - [Pacientes y Consultas](#pacientes-y-consultas)
  - [Inventario](#inventario)
  - [Facturación](#facturación)
  - [Contabilidad](#contabilidad)
  - [Cierre Mensual](#cierre-mensual)
  - [Reportes](#reportes)
- [Contribución](#-contribución)

---

## ✨ Características Principales

- **Usuario Único** con autenticación segura mediante **Argon2**
- **Control de Pacientes** con validación de CI cubano (11 dígitos numéricos)
- **Historial de Consultas** completo por paciente
- **Inventario** con:
  - Categorías y proveedores
  - Productos y servicios
  - Entradas y salidas (método PEPS)
  - Ajustes de inventario
  - Alertas de stock mínimo
- **Facturación**:
  - Ventas directas o asociadas a cliente/consulta
  - Múltiples métodos de pago (efectivo, transferencia, mixto)
  - Detalles de transferencia
  - Anulación de facturas
- **Módulo Contable**:
  - Gastos fijos, variables y financieros
  - Plantillas de gastos fijos
  - Registro de impuestos
- **Cierre Mensual**:
  - Bloqueo de facturación en meses cerrados
  - Generación automática de gastos fijos
  - Reporte PDF del estado de resultados
- **Reportes** en tiempo real del estado de resultados

---

## 🛠️ Tecnologías Utilizadas

| Tecnología | Descripción |
|------------|-------------|
| **Tauri** | Framework para aplicaciones desktop ligeras y seguras |
| **React 19.2.8** | Biblioteca para interfaces de usuario |
| **TypeScript** | Tipado estático para JavaScript |
| **SQLite** | Base de datos ligera y embebida |
| **Argon2** | Algoritmo de hashing para contraseñas |
| **Tailwind CSS** | Framework de estilos utilitario |
| **jspdf - jspdf-autotable** | Generación de reportes en PDF |

---

## 📦 Requisitos del Sistema

- **Node.js** v24.18.0 o superior
- **pnpm** (gestor de paquetes de node)
- **Rust** (para compilar Tauri)
- **Cargo** (gestor de paquetes de Rust)
- **Git** (para clonar el repositorio)

---

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/AleHS-99/optica_20_20.git
cd optica-20-20
```

### 2. Instalar dependencias

```bash
pnpm install
```

### 3. Iniciar en modo desarrollo

```bash
pnpm run tauri dev
```

---

## ⚙️ Configuración

### Base de Datos

La base de datos SQLite se crea automáticamente al ejecutar la aplicación por primera vez. Las migraciones se aplican mediante el sistema integrado. Al iniciar el sistema si no existe un usuario te pide crearlo.


---

## 🧩 Módulos Funcionales

### Autenticación

- Usuario único con contraseña hasheada con **Argon2**
- Cambio de contraseña

### Pacientes y Consultas

- **Registro de pacientes** con:
  - CI (validación de 11 dígitos numéricos)
  - Nombre completo, teléfono, dirección
- **Consultas** asociadas a pacientes
- Historial completo de consultas por paciente

### Inventario

- **Categorías**: Clasificación de productos
- **Proveedores**: Registro de proveedores
- **Productos/Servicios**:
  - Nombre, descripción, categoría
  - Stock mínimo para alertas
  - % de Ganancia de referencia (30 % pro defecto)
- **Movimientos**:
  - Entradas (con costo unitario PEPS)
  - Salidas (ventas)
  - Ajustes (aumento/disminución)
- **Alertas**: Notificaciones de stock mínimo
- **Listado**: Vista completa de inventario con cantidades

### Facturación

- **Listado de facturas** con filtros por fecha, cliente, estado
- **Nueva factura**:
  - Venta directa o asociada a cliente
  - Opción de vincular a consulta específica
  - Selección de productos/servicios del inventario
- **Pagos**:
  - Efectivo
  - Transferencia (con detalles: banco, referencia, etc.)
  - Mixto (combinación de métodos)
- **Anulación** de facturas con registro de motivo
- **Bloqueo**: No permite facturar ni anular en meses cerrados

### Contabilidad

- **Categorías de gastos**:
  - Variables (manuales)
  - Fijos (mediante plantillas)
  - Financieros (intereses, comisiones)
- **Plantillas de gastos fijos**:
  - Definición de gastos recurrentes
  - Aplicación automática en cierre mensual
- **Gastos variables**:
  - Registro manual de gastos del mes
- **Impuestos**:
  - Definición de entidades y porcentajes
  - Cálculo automático en estado de resultados

### Cierre Mensual

- **Listado de meses cerrados**
- **Proceso de cierre**:
  1. Verificación de mes no cerrado
  2. Aplicación automática de gastos fijos
  3. Cálculo de estado de resultados
  4. Generación de reporte PDF
- **Bloqueos**:
  - No permite facturar en mes cerrado
  - No permite anular facturas en mes cerrado
- **Reporte PDF** con estado de resultados completo

### Reportes

- **Estado de Resultados**:
  - Ventas totales
  - Costo de ventas (PEPS)
  - **Utilidad Bruta**
  - Gastos variables y fijos
  - **Utilidad Operativa**
  - Gastos financieros
  - **Utilidad Antes de Impuestos**
  - Impuestos
  - **Utilidad Neta**
- **Vista en tiempo real** del mes sin cerrar
- **Checkbox** para incluir gastos fijos en vista preliminar

---

## 🤝 Contribución

1. Haz fork del repositorio
2. Crea tu rama de características (`git checkout -b feature/amazing-feature`)
3. Haz commit de tus cambios (`git commit -m 'Add amazing feature'`)
4. Push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

### Estilo de Código

- **TypeScript**: Sigue las reglas de ESLint y Prettier
- **Rust**: Sigue las convenciones de Rustfmt
- **Commits**: Mensajes descriptivos en español


---

## 📞 Contacto
**Email**: [ahsilva745@gmail.com]  
**GitHub**: [github.com/AleHS-99](https://github.com/AleHS-99)

---