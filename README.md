# Sistema Web de Asistencia con Validacion GPS

MVP en Next.js App Router, TypeScript, Tailwind CSS, Neon PostgreSQL y Drizzle ORM.

## Requisitos

- Node.js 18 o superior.
- Base de datos Neon PostgreSQL.
- Variables de entorno en `.env.local`.

## Instalacion

```bash
npm install
```

Crea `.env.local`:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/dbname?sslmode=require"
ADMIN_SESSION_SECRET="cambiar_esto_en_produccion"
```

## Base de datos Neon

1. Crea un proyecto en Neon.
2. Copia la connection string con SSL.
3. Pegala como `DATABASE_URL` en `.env.local`.
4. Aplica el esquema:

```bash
npm run db:push
```

## Datos de prueba

```bash
npm run seed
```

Esto inserta:

- Admin: `admin` / `admin123`
- Ubicacion: Oficina principal - Alameda Manuel Traverso 391, `-12.048947`, `-75.191307`, radio `30`
- Horario base: manana `08:00` a `13:00`, tarde `14:00` a `19:00`
- Trabajadores:
  - Juan Perez - DNI `12345678`
  - Maria Lopez - DNI `87654321`
  - Carlos Ramos - DNI `11223344`

## Desarrollo local

```bash
npm run dev
```

Abre:

- Admin: `http://localhost:3000/admin/login`
- Trabajador: `http://localhost:3000/worker`

## Flujo admin

1. Entra a `/admin/login`.
2. Inicia sesion con `admin` / `admin123`.
3. Registra trabajadores con nombre completo y DNI.
4. Configura turnos de manana y/o tarde por trabajador.
5. Configura ubicacion y horario general si necesitas cambiar los valores iniciales.
6. Revisa asistencias en `/admin/reports`.
7. Exporta el reporte desde el boton XLS.

## Tolerancia semanal

Cada trabajador puede usar la tolerancia de 0 a 9 minutos de retraso una sola vez por semana por turno (lunes a domingo).

- Si aun no uso la tolerancia semanal del turno y llega con 0 a 9 minutos de retraso: asistencia valida sin multa.
- Si ya uso la tolerancia semanal del turno:
  - 1 a 20 minutos: S/. 10.00
  - 21 a 30 minutos: S/. 20.00
  - Mas de 30 minutos: Falta - S/. 40.00

La tolerancia de manana y tarde se evalua de forma independiente.

## Flujo trabajador

1. Entra a `/worker` desde el celular.
2. Ingresa su DNI de 8 digitos.
3. El sistema valida GPS y DNI.
4. Si el DNI existe y esta dentro del radio de 30 metros, puede marcar entrada o salida.
5. El backend valida GPS con Haversine y usa hora del servidor.

## Prueba de GPS

Los navegadores moviles requieren HTTPS para geolocalizacion fuera de `localhost`. Para probar desde un celular puedes desplegar en Vercel o usar un tunel HTTPS. Acepta el permiso de ubicacion cuando el navegador lo solicite.
