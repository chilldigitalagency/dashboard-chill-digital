# Dashboard Chill Digital — Documentación del Proyecto

Dashboard interno para monitoreo de cuentas Meta Ads de múltiples clientes de la agencia **Chill Digital**.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14 (App Router) |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS v3 + shadcn/ui |
| Auth | Supabase Auth |
| Base de datos | Supabase (PostgreSQL) |
| API externa | Meta Marketing API (Facebook/Instagram Ads) |
| Componentes | shadcn/ui (Radix UI + Tailwind) |
| Iconos | Lucide React |

---

## Identidad visual

- **Color primario:** `#604ad9` — variable CSS: `--primary: oklch(0.488 0.243 264.376)`
- **Tipografía:** Manrope (Google Fonts), pesos 400/500/600/700/800
- **Tema:** Dark mode por defecto (clase `.dark` en `<html>`)
- **Bordes redondeados:** `--radius: 0.75rem`

El tema completo está definido en `src/app/globals.css`. Para componentes nuevos, usar siempre las variables CSS (`bg-background`, `text-foreground`, `text-primary`, etc.) y nunca hardcodear colores.

---

## Estructura de carpetas

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Rutas públicas (sin sidebar)
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/              # Rutas protegidas (con sidebar + header)
│   │   ├── layout.tsx            # Layout compartido del dashboard
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Vista general — todos los clientes
│   │   ├── clients/
│   │   │   ├── page.tsx          # Listado de clientes
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Vista individual de cliente
│   │   └── reports/
│   │       └── page.tsx          # Reportes exportables
│   ├── api/                      # API Routes de Next.js
│   │   ├── auth/                 # Callbacks de Supabase Auth
│   │   └── meta/                 # Proxy hacia Meta Marketing API
│   ├── layout.tsx                # Root layout (fuente, tema)
│   └── globals.css               # Variables CSS, Tailwind base
│
├── components/
│   ├── ui/                       # Componentes shadcn/ui (auto-generados, no editar)
│   ├── layout/                   # Sidebar, Header, NavItem, ThemeProvider
│   ├── charts/                   # Gráficos (Recharts / Chart.js wrappers)
│   ├── clients/                  # ClientCard, ClientSelector, ClientStats
│   └── shared/                   # KPICard, DateRangePicker, EmptyState, Skeleton
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Supabase browser client
│   │   ├── server.ts             # Supabase server client (SSR)
│   │   └── middleware.ts         # Refresh de sesión
│   ├── meta-ads/
│   │   ├── client.ts             # Wrapper de Meta Marketing API
│   │   ├── queries.ts            # Consultas predefinidas (insights, campañas, etc.)
│   │   └── types.ts              # Tipos de respuesta de Meta API
│   └── utils/
│       ├── format.ts             # Formateo de moneda, porcentajes, fechas
│       └── metrics.ts            # Cálculo de ROAS, CPC, CTR, etc.
│
├── hooks/
│   ├── useClients.ts             # SWR/React Query para lista de clientes
│   ├── useMetaInsights.ts        # Datos de Meta Ads por cliente y rango de fechas
│   └── useAuth.ts                # Estado de sesión Supabase
│
├── types/
│   ├── client.ts                 # tipo Client, ClientWithMeta, etc.
│   ├── meta.ts                   # Tipos de campaña, adset, ad, insights
│   └── supabase.ts               # Tipos generados por Supabase CLI
│
└── constants/
    ├── routes.ts                 # Rutas de la app como constantes
    └── metrics.ts                # Nombres y configuración de métricas
```

---

## Variables de entorno

Copiar `.env.local.example` a `.env.local` y completar los valores.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=          # URL del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Clave anon (pública)
SUPABASE_SERVICE_ROLE_KEY=         # Clave service role (solo en servidor)

# Meta Ads API
META_APP_ID=                       # ID de la app en Meta for Developers
META_APP_SECRET=                   # Secret de la app Meta
# Los access tokens de cada cliente se guardan en la tabla `clients` en Supabase

# App
NEXT_PUBLIC_APP_URL=               # URL de la app (ej: http://localhost:3000)
```

---

## Esquema de base de datos (Supabase)

Schema completo en `src/db/schema.sql`. Ejecutar en Supabase > SQL Editor.

### Tabla: `clients`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `name` | text | Nombre del cliente |
| `slug` | text | Identificador URL-friendly, único |
| `meta_account_id` | text | ID de cuenta Meta Ads (`act_XXXXXXXXXX`) |
| `meta_access_token` | text | Token de acceso a Meta API |
| `active` | boolean | Default `true` |
| `created_at` | timestamptz | Default `now()` |

### Tabla: `client_thresholds`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | PK |
| `client_id` | uuid | FK → `clients(id)` CASCADE |
| `roas_min` | numeric(10,2) | ROAS mínimo esperado |
| `cpa_max` | numeric(10,2) | CPA máximo aceptable |
| `sales_min` | integer | Ventas mínimas esperadas |
| `updated_at` | timestamptz | Auto-actualizado por trigger |

### Tabla: `profiles`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | PK, referencia `auth.users(id)` CASCADE |
| `full_name` | text | Nombre completo |
| `role` | text | `'admin'` o `'operator'`, default `'operator'` |
| `created_at` | timestamptz | Default `now()` |

### Tabla: `client_user_access`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | PK |
| `client_id` | uuid | FK → `clients(id)` CASCADE |
| `user_id` | uuid | FK → `profiles(id)` CASCADE |
| — | — | UNIQUE `(client_id, user_id)` |

### RLS y policies
- **clients:** admins ven todo; operadores solo sus clientes asignados
- **client_thresholds:** misma lógica que `clients`
- **profiles:** cada usuario ve y edita solo el suyo; admins ven todos; no se puede auto-asignar role
- **client_user_access:** usuarios ven solo sus asignaciones; admins gestionan todo
- **Trigger:** `on_auth_user_created` crea automáticamente un `profile` al registrar un usuario en `auth.users`

---

## Módulos a construir

### 1. Auth (`(auth)/login`)
Login con email/password via Supabase Auth. Redirección post-login al dashboard. Middleware de protección de rutas en `middleware.ts`.

### 2. Dashboard general (`(dashboard)/dashboard`)
Vista resumen de todos los clientes activos. Tarjetas con métricas clave: gasto total, ROAS promedio, leads del período. Selector de rango de fechas global.

### 3. Vista por cliente (`(dashboard)/clients/[id]`)
Métricas detalladas de un cliente específico:
- KPIs principales: Inversión, Alcance, Impresiones, Clics, CTR, CPC, CPM, ROAS, Leads, CPL
- Gráfico de inversión vs resultados por día
- Tabla de campañas activas con métricas
- Comparativa con período anterior

### 4. Listado de clientes (`(dashboard)/clients`)
Grid/tabla de todos los clientes con métricas resumidas del período seleccionado.

### 5. Reportes (`(dashboard)/reports`)
Generación de reportes PDF o compartibles por cliente y rango de fechas.

### 6. Meta Ads integration (`lib/meta-ads/`)
Wrapper sobre Meta Marketing API v18+. Caché de respuestas en Supabase para reducir llamadas a la API. Manejo de expiración de tokens.

---

## Convenciones de código

### General
- Usar TypeScript estricto. No usar `any`.
- Server Components por defecto. Agregar `"use client"` solo cuando sea necesario (interactividad, hooks, browser APIs).
- Imports con alias `@/` (ej: `import { Button } from "@/components/ui/button"`).

### Componentes
- Nombres en PascalCase: `ClientCard.tsx`
- Un componente por archivo.
- Props tipadas con `interface`, no `type` para props de componentes.
- Los componentes de `src/components/ui/` son auto-generados por shadcn — no modificarlos directamente.

### Estilos
- Tailwind CSS para todo. No usar CSS modules ni styled-components.
- Usar variables CSS del tema (`bg-background`, `text-muted-foreground`, `border-border`, etc.).
- El color primario se aplica como `bg-primary`, `text-primary`, `ring-primary`.
- Para hover states en dark mode: usar `hover:bg-accent`.

### Fetch de datos
- En Server Components: fetch directo con el cliente Supabase server.
- En Client Components: SWR o React Query para datos dinámicos.
- Las llamadas a Meta API se hacen siempre desde API Routes (nunca exponer tokens al cliente).

### Formateo
- Moneda: siempre en USD con 2 decimales, usando `Intl.NumberFormat`.
- Porcentajes: 1 decimal (ej: `2.4%`).
- Fechas: formato `dd MMM yyyy` (ej: `15 Jan 2025`).

---

## Comandos útiles

```bash
# Desarrollo
npm run dev

# Build producción
npm run build

# Generar tipos de Supabase
npx supabase gen types typescript --project-id <id> > src/types/supabase.ts

# Agregar componente shadcn
npx shadcn@latest add <component-name>

# Lint
npm run lint
```

---

## Estado del proyecto

- [x] Inicialización del proyecto (Next.js 14, TypeScript, Tailwind, shadcn/ui, Supabase)
- [x] Configuración de tema (dark mode, color primario #604ad9, tipografía Manrope)
- [x] Estructura de carpetas
- [ ] Configuración de Supabase (cliente, servidor, middleware)
- [ ] Esquema de base de datos (migrations)
- [ ] Auth (login, protección de rutas)
- [ ] Integración Meta Ads API
- [ ] Dashboard general
- [ ] Vista por cliente
- [ ] Listado de clientes
- [ ] Reportes
