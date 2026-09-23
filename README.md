# 📍 Sistema Web de Control de Asistencia con Geolocalización GPS y Huella Digital

Plataforma empresarial integral para la gestión y control de asistencia de personal, desarrollada con **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Neon PostgreSQL** y **Drizzle ORM**. Incluye validación de ubicación por GPS (fórmula Haversine), huella digital del navegador (Browser Fingerprint), gestión de doble turno (mañana/tarde), horarios por día y excepciones por fecha (Overrides), recálculo inteligente de tolerancia semanal unificada y administración completa de reportes con exportación en formato Excel (.xlsx).

---

## 🚀 Tecnologías Principales

- **Framework:** Next.js 16 (App Router & React 19)
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS & Lucide Icons
- **Base de Datos:** Neon PostgreSQL (Serverless Driver)
- **ORM:** Drizzle ORM + Drizzle Kit
- **Autenticación y Seguridad:** Cookie sessions seguras con `bcryptjs` y secreto firmado.
- **Exportación:** `xlsx` para generación de hojas de cálculo con formato y `csv`.

---

## ⚙️ Reglas de Negocio Automatizadas

### ⏱️ 1. Tolerancia Semanal Unificada (0 a 9 minutos)
- Cada trabajador dispone de **1 sola oportunidad de tolerancia por semana (lunes a domingo)** de 0 a 9 minutos de retraso sobre su hora oficial de ingreso.
- Esta tolerancia es **compartida unificadamente** entre el turno mañana y tarde.
- Si el trabajador utiliza la tolerancia en su primer ingreso con retraso de la semana (ej. lunes por la mañana), el sistema marcará su estado como `Tolerancia Usada` con **S/. 0.00 de multa**.
- Cualquier retraso posterior en esa misma semana consumirá directamente la escala de multas por ya no tener tolerancia disponible.

### 💰 2. Escala de Multas por Tardanza y Faltas
Si la tolerancia semanal ya fue consumida **o** si la tardanza excede los 9 minutos:
- **1 a 20 minutos de retraso:** Multa de **S/. 10.00**
- **21 a 30 minutos de retraso:** Multa de **S/. 20.00**
- **Más de 30 minutos de retraso:** Califica como **Falta (Multa de S/. 40.00)**

### 🔄 3. Recálculo Automático Dinámico (Edición y Creación Manual)
- Cuando un administrador **edita la hora de entrada/salida** de un registro existente o **crea manualmente una nueva asistencia**:
  - Si un registro pasa de `3:08 PM` (donde aplicaba tolerancia) a `2:59 PM` (puntual), la tolerancia usada **se libera automáticamente** y se reasigna cronológicamente al siguiente registro elegible de esa misma semana para ese trabajador.
  - La cadena cronológica de la semana completa se vuelve a calcular instantáneamente (ajustando minutos de tardanza, estado de tolerancia y montos de multa).

### 📅 4. Sobrescritura de Horario por Fecha (Overrides)
- Permite cambiar de forma excepcional el horario asignado a un trabajador para un día específico (por ejemplo, si normalmente labora en el turno tarde de 3:00 PM a 7:00 PM, pero un día particular asistirá en la mañana de 11:00 AM a 1:00 PM).
- De esta manera, al marcar en el nuevo horario asignado para ese día, la asistencia se valida correctamente sin generar faltas ni tardanzas injustificadas.

---

## 📱 Módulos del Sistema

### 👤 1. Portal del Trabajador (`/worker`)
- **Ingreso por DNI:** Identificación rápida mediante DNI de 8 dígitos.
- **Validación GPS (Geocerca Haversine):** Comprueba que la ubicación física del dispositivo móvil coincida con las coordenadas de la empresa (dentro del radio permitido, ej. 30 metros).
- **Huella Digital del Navegador (Browser Fingerprint):** Captura el Fingerprint único, la IP de conexión y el User Agent en cada marcación (entrada y salida) para prevenir fraudes.
- **Marcación de Doble Turno:** Soporte independiente para marcar ingreso y salida del turno Mañana y/o Tarde.

### 🛡️ 2. Panel de Administración (`/admin`)
- **Dashboard (`/admin/dashboard`):** Resumen en tiempo real de asistencias del día, faltas, tardanzas y multas acumuladas.
- **Gestión de Trabajadores (`/admin/workers`):** Alta, edición, desactivación/activación, código de acceso y asignación de modalidad (`worker` / `intern`).
- **Configuración de Horarios por Día (`/admin/workers/[id]`):** Asignación personalizada de horarios de entrada/salida para mañana y tarde según el día de la semana (Lunes a Domingo).
- **Sobrescrituras de Horario (`Overrides`):** Ajuste de horarios específicos por fecha para cambios excepcionales de turno.
- **Gestión de Ubicación Geográfica (`/admin/location`):** Definición de coordenadas GPS principales (Latitud, Longitud) y radio máximo tolerado (metros).
- **Gestión de Horario General (`/admin/schedule`):** Configuración del horario base y la tolerancia predeterminada de la empresa.
- **Panel de Reportes y Auditoría (`/admin/reports`):**
  - **Filtros por Fecha y Trabajador:** Búsqueda por rango de fechas (desde / hasta) y por empleado.
  - **Creación Manual de Asistencias:** Botón "Nueva Asistencia" para registrar marcaciones desde administración indicando fecha, turno, hora de entrada y hora de salida.
  - **Edición Administrativa:** Modificación de registros existentes con recálculo dinámico automático.
  - **Exportación Excel (.xlsx) / CSV:** Generación de reportes detallados en hojas de cálculo formateadas con indicador de tolerancia, multas, ubicación GPS, IP y Fingerprint.

---

## 🛠️ Requisitos e Instalación

### Requisitos Previos
- **Node.js** 18.x o superior.
- Instancia de **Neon PostgreSQL** (o cualquier base de datos PostgreSQL compatible).

### 1. Clonar e Instalar Dependencias
```bash
npm install
```

### 2. Configurar Variables de Entorno
Crea el archivo `.env.local` en la raíz del proyecto:

```env
DATABASE_URL="postgresql://USUARIO:PASSWORD@HOST/dbname?sslmode=require"
ADMIN_SESSION_SECRET="generar_un_secreto_seguro_para_sesiones"
```

### 3. Sincronizar Base de Datos (Drizzle ORM)
Aplica la estructura de tablas a la base de datos Neon:

```bash
npm run db:push
```

### 4. Cargar Datos de Prueba (Seed)
Ejecuta el script de carga inicial para poblar datos de prueba (administrador, ubicación, horarios y trabajadores demo):

```bash
npm run seed
```

**Credenciales e Información Demo Creada:**
- **Administrador:** `admin` / `admin123`
- **Ubicación:** Alameda Manuel Traverso 391 (`-12.048947`, `-75.191307`, radio de `30` metros)
- **Horario Base Demo:** Mañana (`08:00` a `13:00`), Tarde (`14:00` a `19:00`)
- **Trabajadores de Prueba:**
  - Juan Pérez — DNI: `12345678`
  - María López — DNI: `87654321`
  - Carlos Ramos — DNI: `11223344`

---

## 🏃‍♂️ Ejecución en Desarrollo

```bash
npm run dev
```

Acceso en el navegador:
- **Portal de Trabajador:** `http://localhost:3000/worker`
- **Panel de Administración:** `http://localhost:3000/admin/login`

---

## 🌐 Pruebas de Geolocalización GPS en Móviles

Los navegadores web móviles requieren conexión segura **HTTPS** para acceder a la API de Geolocation (`navigator.geolocation`). 
- Para probar la marcación desde un teléfono celular en tu red local o prueba remota, puedes desplegar en **Vercel** o utilizar un túnel HTTPS como **ngrok** / **Cloudflare Tunnels**.
- Asegúrate de aceptar el permiso de ubicación en el navegador cuando se solicite.

---

## 🗄️ Esquema de la Base de Datos (Tablas Principales)

- `admins`: Cuentas de administradores con contraseña encriptada (`bcryptjs`).
- `workers`: Información de empleados, DNI único, tipo (`worker`/`intern`) y estado (`active`/`inactive`).
- `worker_day_schedules`: Configuración de horarios habituales por día de la semana (lunes a domingo) para turno mañana y tarde.
- `worker_schedule_overrides`: Excepciones y ajustes de horario específicos asignados a una fecha particular.
- `locations`: Coordenadas de geocerca (latitud, longitud y radio máximo en metros).
- `work_schedules`: Horario general por defecto del sistema.
- `shift_attendance_records`: Registros de asistencias marcadas o creadas por administración (contiene hora servidor, turno, retraso, multas, flag de tolerancia, coordenadas GPS, IP y Fingerprint).
- `attendance_attempts`: Registro de auditoría de todos los intentos de marcación (aceptados y rechazados con razón).

---

## 📜 Comandos Disponibles

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo local de Next.js |
| `npm run build` | Compila la aplicación optimizada para producción |
| `npm run start` | Arranca el servidor de producción compilado |
| `npm run lint` | Ejecuta las verificaciones de ESLint |
| `npm run db:push` | Sincroniza el esquema Drizzle directamente con PostgreSQL |
| `npm run db:generate` | Genera las migraciones SQL |
| `npm run db:migrate` | Ejecuta las migraciones generadas en la base de datos |
| `npm run db:studio` | Abre la interfaz gráfica web de Drizzle Studio para inspeccionar las tablas |
| `npm run seed` | Carga los datos iniciales de prueba (Admin, Ubicación, Horarios y Empleados) |

