# Guía de Migración — ServerStartup WordPress → Astro/EmDash

## Arquitectura

| Componente | WordPress (actual) | Astro/EmDash (nuevo) |
|------------|-------------------|---------------------|
| Frontend | Elementor + PHP | Astro components (SSR) |
| CMS | WordPress | EmDash (admin en `/_emdash/admin`) |
| Base de datos | MySQL (hosting) | **D1** (Cloudflare edge SQL) |
| Almacenamiento | wp-content/uploads | **R2** (Cloudflare object storage) |
| Hosting | WordPress hosting | **Cloudflare Workers** |

## Design System (extraído del Elementor Kit)

**IMPORTANTE**: El sitio original es de tema **CLARO** (blanco), no oscuro.

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-primary` | `#1E1E1E` | Texto, fondos oscuros (CTA, header móvil) |
| `--color-secondary` | `#FFFFFF` | Blanco |
| `--color-card-blue` | `#B5E6F7` | Tarjeta Comercio electrónico |
| `--color-card-yellow` | `#FDEBB6` | Tarjeta CDN/WAF |
| `--color-card-teal` | `#BFEDEE` | Tarjeta Big Data |
| `--color-card-pink` | `#ECDCE3` | Tarjeta Integración |
| `--color-card-green` | `#C5EFCD` | Tarjeta Backend |
| `--color-marked` | `rgba(206,212,218,0.5)` | Texto destacado |

**Tipografía**: Alexandria (Google Fonts), body 20px/26px wt300, subtitles 24px/32px wt400, headings wt600.

## Flujo de contenido

```
seed.json (schema + contenido)
    ↓  npx emdash dev (aplica seed al arrancar DB nueva)
    ↓  o setup wizard (primera vez)
D1 (Wrangler emulator en local, Cloudflare D1 en producción)
    ↓  getEmDashCollection / getEmDashEntry
Astro pages (SSR en cada request)
```

## Cómo funciona la persistencia

### Local (desarrollo)
- El dev server usa el **emulador D1 de Wrangler** (en `.wrangler/state/`)
- Los datos son **efímeros** — si borras `.wrangler/state/`, se pierden
- Al arrancar por primera vez, aparece el **setup wizard** en `/_emdash/admin`
- En el wizard: selecciona **"Apply seed with content"** para cargar el contenido del `seed.json`
- Todo el contenido real está definido en `seed/seed.json` (versionado en Git)

### Producción (Cloudflare)
- D1 real + R2 real → datos **persistentes**
- El contenido se importa una sola vez via:
  1. Setup wizard al desplegar por primera vez
  2. O vía CLI: `npx emdash content create ...`
- Los cambios de contenido se hacen desde `/_emdash/admin`

## Estructura del seed.json

El `seed.json` define **todo**: schema + contenido inicial.

| Sección | Qué contiene |
|---------|-------------|
| `settings` | Título, tagline del sitio |
| `collections` | `services` (5), `members` (4), `pages`, `posts`, `elementor_library` |
| `menus` | Navegación principal (7 items) |
| `content.services` | 5 páginas de servicio |
| `content.members` | 4 miembros del equipo |
| `content.pages` | Página About |
| `content.posts` | 7 posts de demo (blog starter) |

## Puesta en marcha local

```bash
# 1. Limpiar estado anterior (si existe)
rm -rf .wrangler/state

# 2. Arrancar dev server (creará DB nueva)
npx emdash dev

# 3. Abrir el setup wizard en el navegador
# → http://localhost:4321/_emdash/admin
# → Seleccionar "Apply seed with content" 
# → Crear cuenta admin con passkey

# 4. Verificar que las páginas funcionan
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/desarrollo-greenfield
curl -s -o /dev/null -w "%{http_code}" http://localhost:4321/quienes-somos
```

## Páginas del sitio

| Ruta | Template | Contenido |
|------|----------|-----------|
| `/` | `src/pages/index.astro` | Homepage (hardcoded) |
| `/desarrollo-greenfield` | `src/pages/[slug].astro` | CMS (services) |
| `/integracion-de-sistemas` | `src/pages/[slug].astro` | CMS (services) |
| `/comercio-electronico` | `src/pages/[slug].astro` | CMS (services) |
| `/big-data-cloud-analytics` | `src/pages/[slug].astro` | CMS (services) |
| `/cdn-waf-seguridad-edge-cloudflare` | `src/pages/[slug].astro` | CMS (services) |
| `/quienes-somos` | `src/pages/quienes-somos.astro` | CMS (members) |
| `/contacto` | `src/pages/contacto.astro` | Hardcoded |
| `/politica-de-privacidad` | `src/pages/politica-de-privacidad.astro` | Hardcoded |

## Despliegue a Cloudflare

```bash
# 1. Crear recursos en Cloudflare (si no existen)
wrangler d1 create www-serverstartup-io
wrangler r2 bucket create www-serverstartup-io

# 2. Actualizar wrangler.jsonc con el database_id real

# 3. Generar auth secret y añadirlo como variable de entorno
npx emdash auth secret
wrangler secret put EMDASH_AUTH_SECRET

# 4. Desplegar
npm run deploy

# 5. Completar setup wizard en producción
# → https://www.serverstartup.io/_emdash/admin
```

## Comandos útiles

```bash
npx emdash dev                           # Arrancar dev server
npx emdash seed seed/seed.json --validate # Validar seed
npx emdash types                         # Regenerar tipos TypeScript
npx emdash content list services         # Listar servicios (requiere server corriendo)
npx emdash export-seed --with-content    # Exportar todo como seed
```
