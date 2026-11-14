# tasks-api

API REST de tareas hecha con NestJS 12, Prisma 7 y PostgreSQL 16. Incluye filtros y paginación, validación con `class-validator`, un filtro global de errores, documentación Swagger, un health check y CI en GitHub Actions.

## Stack

- NestJS 12 (ESM) con TypeScript en modo estricto
- Prisma 7 con el adapter `pg`, sobre PostgreSQL 16
- Vitest y supertest para los tests
- oxlint y Prettier
- pnpm

## Requisitos

- Node.js 24
- pnpm 12
- Docker, para PostgreSQL

## Puesta en marcha

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Levantar PostgreSQL con Docker

```bash
docker compose up -d
```

Crea el contenedor `tasks-api-postgres` con la base `tasks`, el usuario `postgres` y la contraseña `postgres`.

El contenedor se publica en el **puerto 5433** del host, no en el 5432, para no chocar con otro Postgres local. Si prefieres el 5432, cambia el mapeo en `docker-compose.yml` y las URLs en `.env`.

Comprueba que está sano:

```bash
docker compose ps
```

### 3. Configurar `.env`

```bash
cp .env.example .env
```

En PowerShell: `Copy-Item .env.example .env`.

| Variable | Para qué sirve | Valor por defecto |
|---|---|---|
| `PORT` | Puerto de la API | `3000` |
| `DATABASE_URL` | Base de datos de la aplicación | `postgresql://postgres:postgres@localhost:5433/tasks?schema=public` |
| `TEST_DATABASE_URL` | Base de los tests e2e. El nombre **debe terminar en `_test`** | `postgresql://postgres:postgres@localhost:5433/tasks_test?schema=public` |

`.env` está en `.gitignore`, y solo se versiona `.env.example`.

### 4. Generar el cliente de Prisma

```bash
pnpm exec prisma generate
```

El cliente se genera en `src/generated/prisma`, que está en `.gitignore`. Hay que ejecutarlo tras clonar el repo y cada vez que cambie `prisma/schema.prisma`. Sin él, la compilación falla.

### 5. Aplicar las migraciones

```bash
pnpm exec prisma migrate deploy
```

Aplica las migraciones existentes, hoy solo `init`. Mientras desarrollas el esquema usa `pnpm exec prisma migrate dev --name <nombre>`, que además crea la migración.

### 6. Cargar datos de ejemplo (opcional)

```bash
pnpm exec prisma db seed
```

Crea 20 tareas repartidas entre cuatro asignados (`alice`, `bob`, `carla`, `diego`) y los tres estados.

> **Atención:** el seed ejecuta `deleteMany()` antes de insertar, así que **borra todas las tareas** de la base a la que apunte `DATABASE_URL`.

### 7. Arrancar la API

```bash
pnpm start:dev      # modo desarrollo con recarga
pnpm build && pnpm start:prod   # producción
```

- API: http://localhost:3000
- Swagger UI: http://localhost:3000/docs (el JSON está en `/docs-json`)
- Health check: http://localhost:3000/health

## Modelo de datos

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | Generado por la base |
| `title` | string | 3 a 120 caracteres |
| `description` | string, opcional | Hasta 2000 caracteres |
| `status` | `PENDING` \| `IN_PROGRESS` \| `DONE` | Por defecto `PENDING` |
| `assignee` | string | Obligatorio, hasta 100 caracteres (se hace trim) |
| `dueDate` | fecha ISO 8601 | Obligatoria |
| `createdAt`, `updatedAt` | fecha | Automáticas |

Hay índices sobre `status` y `assignee`, que son las columnas por las que se filtra.

## Endpoints

Los ejemplos usan `curl`. En PowerShell escribe `curl.exe`, porque `curl` es un alias de `Invoke-WebRequest`. Sustituye `<id>` por un UUID real.

| Método | Ruta | Éxito | Errores |
|---|---|---|---|
| `POST` | `/tasks` | 201 | 400 |
| `GET` | `/tasks` | 200 | 400 |
| `GET` | `/tasks/:id` | 200 | 400, 404 |
| `PATCH` | `/tasks/:id` | 200 | 400, 404 |
| `DELETE` | `/tasks/:id` | 204 | 400, 404 |
| `GET` | `/health` | 200 | 503 |

### Crear una tarea

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Preparar release","assignee":"alice","dueDate":"2026-12-31T00:00:00.000Z"}'
```

Campos opcionales: `description` y `status`.

### Listar tareas

```bash
curl "http://localhost:3000/tasks"
curl "http://localhost:3000/tasks?status=DONE&assignee=bob&page=2&limit=5"
```

| Parámetro | Descripción | Por defecto |
|---|---|---|
| `status` | `PENDING`, `IN_PROGRESS` o `DONE` | sin filtro |
| `assignee` | Nombre exacto | sin filtro |
| `page` | Página, mínimo 1 | `1` |
| `limit` | Tamaño de página, de 1 a 100 | `10` |

Ordena por `createdAt` descendente y responde:

```json
{
  "data": [ { "id": "...", "title": "...", "status": "DONE" } ],
  "meta": { "page": 1, "limit": 10, "total": 25, "totalPages": 3 }
}
```

### Obtener, actualizar y borrar

```bash
curl http://localhost:3000/tasks/<id>

curl -X PATCH http://localhost:3000/tasks/<id> \
  -H "Content-Type: application/json" \
  -d '{"status":"IN_PROGRESS"}'

curl -X DELETE http://localhost:3000/tasks/<id>
```

`PATCH` acepta cualquier subconjunto de los campos de creación.

### Health check

```bash
curl http://localhost:3000/health
```

```json
{ "status": "ok", "info": { "database": { "status": "up" } } }
```

Ejecuta una consulta a la base con un timeout de 1,5 s.

### Formato de los errores

Todos los errores salen con la misma forma:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["title must be longer than or equal to 3 characters"],
  "path": "/tasks",
  "timestamp": "2026-11-14T18:00:00.000Z"
}
```

- `message` es una lista en los errores de validación del cuerpo y un string en el resto.
- Un error inesperado devuelve 500 con el mensaje genérico `Internal server error`. El detalle y el stack solo van al log del servidor.
- Se rechazan las propiedades desconocidas en el cuerpo (400).

## Tests

```bash
pnpm test        # unitarios
pnpm test:e2e    # e2e contra PostgreSQL real
pnpm test:cov    # unitarios con cobertura
```

- **Unitarios:** el service con Prisma mockeado, y el filtro de excepciones.
- **E2E:** supertest contra la aplicación completa y una base de datos real. Requieren que Postgres esté levantado (`docker compose up -d`).

La base de los e2e es **`tasks_test`**, distinta de la de la aplicación, así que no tocan tus datos ni el seed. Se crea sola si no existe y recibe las migraciones al empezar (`test/global-setup.ts`).

Cada test e2e ejecuta `deleteMany()`. Por eso, si el nombre de la base de `TEST_DATABASE_URL` no termina en `_test`, la suite se niega a arrancar.

## Calidad y CI

```bash
pnpm lint
pnpm build
pnpm format
```

`.github/workflows/ci.yml` se lanza en cada push y pull request. Levanta un PostgreSQL 16 como servicio, genera el cliente de Prisma y ejecuta lint, build, tests unitarios y e2e.

## Estructura

```
src/
├── common/filters/   filtro global de excepciones
├── health/           GET /health (Terminus)
├── prisma/           PrismaService y su módulo
├── tasks/            controller, service, DTOs y módulo
├── app.module.ts
└── main.ts           bootstrap y Swagger
prisma/               esquema, migraciones y seed
test/                 tests e2e y preparación de la base de test
```

Capas: el controller solo maneja HTTP, el service contiene la lógica y `PrismaService` es el único que accede a los datos.

## Decisiones

- **Prisma 7.10.1 fijado.** El `latest` de npm era una release candidate de la 8.0, así que fijé la última estable. Prisma 7 necesita el adapter `pg`, un `prisma.config.ts` y el cliente generado en `src/generated/prisma`.
- **Puerto 5433.** El 5432 solía estar ocupado por otro Postgres. El CI sí usa el 5432, con sus propias variables.
- **oxlint y Prettier.** Es lo que genera el CLI de Nest 12, y lo mantuve en lugar de cambiarlo por ESLint.
- **`ValidationPipe` y filtro registrados en `AppModule`**, con `APP_PIPE` y `APP_FILTER`, y no en `main.ts`. Así los tests e2e también ejecutan la validación y el filtro reales.
- **El service lanza `NotFoundException`** en `findOne`, `update` y `remove`. En `update` y `remove` traduce el error P2025 de Prisma. El filtro conserva esa conversión como red de seguridad.
- **Título de 3 caracteres como mínimo solo en validación.** Prisma no tiene restricción de longitud mínima, así que lo garantiza `class-validator` y no la base de datos. `assignee` sí tiene tope en ambos lados (`MaxLength(100)` + `VarChar(100)`) y se hace `trim` antes de validar.
- **Errores 400/404 documentados en Swagger** con `ErrorResponseDto` y `@ApiBadRequestResponse` / `@ApiNotFoundResponse` en el controller de tareas.
- **`findMany` y `count` en una transacción**, para que `data` y `total` salgan de la misma lectura.
- **Campos explícitos hacia Prisma** en `create` y `update`, en lugar de hacer spread del DTO, para que no se cuele una propiedad inesperada.
- **`PartialType` de `@nestjs/swagger`**, que conserva los metadatos de OpenAPI en `UpdateTaskDto`.
- **Base de test aparte y con guarda de nombre**, para que ningún `.env` mal configurado pueda borrar datos reales.
- **500 sin detalles.** El cliente nunca ve el mensaje original ni el stack de un error inesperado.

## Con más tiempo

- **Dockerfile y servicio de la app** en `docker-compose.yml`, para arrancar todo con un solo comando.
- **Separar liveness y readiness** en el health check.
- **Validar el entorno al arrancar** (por ejemplo con un esquema en `ConfigModule`), para fallar rápido si falta `DATABASE_URL`.
- **Más filtros de búsqueda:** por rango de `dueDate`, texto en el título y orden configurable.
- **Paginación por cursor**, que escala mejor que `skip`/`take` con muchas filas.
- **Borrado lógico y auditoría** de cambios, en lugar de borrar la fila.
- **Autenticación y límite de peticiones.**
- **Logs estructurados e ids de correlación**, y telemetría en producción.
- **Cobertura mínima exigida en el CI** y caché de dependencias más fina.

## Uso de IA

Usé IA durante todo el proyecto como apoyo, revisando y probando cada cambio antes de hacer commit. Usé Claude (esfuerzo máximo) para la implementación inicial y Cursor (Composer) para continuar mientras Claude estaba limitado por la cuota de la cuenta, y también para la revisión final.

### Qué le pedí

- Un plan por pasos y el scaffolding de NestJS + Prisma + PostgreSQL ajustado al brief: CRUD, filtros por estado y responsable, paginación, validación, migraciones, tests y CI.
- Commits pequeños por paso, en Conventional Commits, para que el historial muestre cómo avanzó el trabajo.
- Una revisión final de cumplimiento del brief, con mejoras sin ampliar el alcance.

### Qué acepté

- La arquitectura por capas (controller, service y PrismaService), el filtro global de errores, el health check, Swagger y el CI con Postgres como servicio.
- Las mejoras de la revisión: errores 400/404 documentados en Swagger, tope y trim en `assignee` (con migración), tests e2e del filtro por responsable y de un status inválido, `engines` en `package.json` y `@prisma/client` fijado sin caret.

### Qué corregí o decidí yo

- **Versión de Prisma:** el `latest` de npm era una RC de la 8.0, así que fijé la 7.10.1 estable y adapté la configuración que exige (adapter `pg`, `prisma.config.ts` y cliente generado).
- **Tests e2e:** la primera versión usaba Prisma mockeado, lo que no prueba nada de la base. Los cambié para que corran contra un Postgres real, en una base `tasks_test` con una guarda que impide ejecutarlos si el nombre no termina en `_test`.
- **404 explícito:** el service dependía de que el filtro tradujera el error P2025 de Prisma. Hice que lance `NotFoundException` él mismo y dejé la traducción en el filtro como red de seguridad.
- **Validación global en `AppModule`** (`APP_PIPE`/`APP_FILTER`) en lugar de `main.ts`, para que los e2e ejecuten la validación real.
- **Entorno local:** el puerto 5432 estaba ocupado por otro Postgres, así que lo moví al 5433. También recreé el volumen cuando el primer arranque quedó a medias.
- **Limpieza:** quité los archivos de ejemplo del scaffold y desactivé la telemetría de `@scarf/scarf`.
- **Lo que rechacé:** autenticación, borrado lógico, paginación por cursor, Dockerfile de la app y pasar `description` vacío a `null`. Están fuera del brief o aportan poco; los dejé anotados en "Con más tiempo".

## Tiempo invertido

Unas **2 horas y media** en total:

- ~1 h 15 min: estructura del proyecto, modelo, migraciones y CRUD con filtros y paginación.
- ~45 min: tests unitarios y e2e, CI y Swagger.
- ~30 min: revisión final, correcciones de validación (`null` y fechas estrictas) y documentación.