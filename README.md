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

Para flujo con migraciones:

```bash
npm run db:generate
npm run db:migrate
```

## Datos de prueba

```bash
npm run seed
```

Esto inserta:

- Admin: `admin` / `admin123`
- Ubicacion: Oficina principal - Alameda Manuel Traverso 391, `-12.048947`, `-75.191307`, radio `50`
- Horario base: manana `09:00` a `13:00`, tarde `15:00` a `19:00`, tolerancia `10`
- Trabajadores: Juan Perez, Maria Lopez, Carlos Ramos

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
3. Registra trabajadores con nombre completo.
4. Copia el codigo generado de 4 digitos.
5. Marca horario personalizado por dias al registrar o editalo despues desde el boton de reloj en la tabla.
6. Configura turnos de manana y/o tarde para cada trabajador de lunes a viernes. Puedes dejar solo un turno activo o usar horarios como `09:00-11:00` y `15:00-17:00`.
7. Configura ubicacion y horario general si necesitas cambiar los valores iniciales.
8. Revisa asistencias en `/admin/reports`.
9. Exporta el reporte desde el boton XLS.

## Multas por tardanza

Las multas se calculan con la hora de entrada de cada turno configurada para cada trabajador y dia. Con tolerancia `10`, la regla queda:

- Entrada + 10 a entrada + 20 minutos: `S/. 10.00`
- Entrada + 21 a entrada + 30 minutos: `S/. 20.00`
- Entrada + 31 minutos o mas: `Falta - S/. 40.00`

## Flujo trabajador

1. Entra a `/worker` desde el celular.
2. Si no hay token local, la app redirige a `/worker/activate`.
3. Ingresa el codigo de 4 digitos una sola vez.
4. El navegador guarda el token del dispositivo.
5. Marca entrada o salida.
6. El backend valida GPS con Haversine y usa hora del servidor.

## Prueba de GPS

Los navegadores moviles requieren HTTPS para geolocalizacion fuera de `localhost`. Para probar desde un celular puedes desplegar en Vercel o usar un tunel HTTPS. Acepta el permiso de ubicacion cuando el navegador lo solicite.
