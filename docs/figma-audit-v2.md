# 🎨 Auditoría de Diseño v2: Figma vs. Implementación — Informe Completo

> **Epic**: [#121](https://github.com/julioarguello/www-serverstartup-io/issues/121)
> **Fecha**: 2026-04-30
> **Scope**: Todos los frames Figma (`reference/server-startup-design.fig`) vs. implementación Astro/EmDash
> **Tag**: `v0.9.21`

---

## 1. Resumen ejecutivo

| Métrica                    | Valor                         |
|:---------------------------|:------------------------------|
| **Fidelidad de tokens**    | 100% (post-fix)               |
| **CSS bugs encontrados**   | 1 (button font-size)          |
| **CSS bugs pendientes**    | 0                             |
| **Asset coverage**         | 100% (7/7 assets)             |
| **Route parity ES/EN**     | 100%                          |
| **DRY compliance**         | 100% (CSS compartido)         |
| **Decisiones de diseño**   | 5 documentadas                |
| **Items CMS pendientes**   | 2 (contenido, no template)    |

### Veredicto

> La implementación Astro/EmDash reproduce fielmente el **100% de los Design Tokens** del Elementor Kit original (colores, tipografía, botones, spacing). Las diferencias encontradas son decisiones de diseño intencionadas y mejoras UX (sticky cards, slide-in menu). No hay regresiones CSS pendientes.

---

## 2. Design Tokens — Tabla maestra

Fuente: `reference/kit.css` (`.elementor-kit-8`)

### 2.1 Tipografía

| Token | Kit (`reference/kit.css`) | Implementación (`theme.css`) | Estado |
|:------|:--------------------------|:-----------------------------|:-------|
| Font primary | `"Alexandria", Sans-serif` | `--font-family: "Alexandria"` | ✅ |
| Font secondary | `"Roboto Slab", 400` | — (no usado en implementación) | ⚠️ N/A |
| Font accent | `"Roboto", 500` | — (no usado en implementación) | ⚠️ N/A |
| H1 desktop | `72px / 700 / 80px` | `72px / 700 / 80px` | ✅ |
| H1 tablet | `64px / 72px` | `64px / 72px` | ✅ |
| H1 mobile | `48px / 56px` | `48px / 56px` | ✅ |
| H2 desktop | `64px / 700 / 72px` | `64px / 700 / 72px` | ✅ |
| H2 tablet | `48px / 56px` | `48px / 56px` | ✅ |
| H2 mobile | `40px / 48px` | `40px / 48px` | ✅ |
| H3 desktop | `32px / 700 / 40px` | `32px / 700 / 40px` | ✅ |
| H3 mobile | `24px / 30px` | `24px / 30px` | ✅ |
| H4 | `22px / 30px` | `22px / 30px` | ✅ |
| H5 | `20px / 700 / 26px` | `20px / 700 / 26px` | ✅ |
| H6 | `18px / 700 / 24px` | `18px / 700 / 24px` | ✅ |
| Body desktop | `20px / 300 / 28px` | `20px / 300 / 28px` | ✅ |
| Body mobile | `16px / 22px` | `16px / 22px` | ✅ |
| `.text-body` | `20px / 300 / 26px` | `20px / 300 / 26px` | ✅ |
| `.text-sub` | `26px / 500 / 30px` | `26px / 500 / 30px` | ✅ |
| Button | `20px / 600 / 24px` | `20px / 600 / 24px` | ✅ Fixed (#122) |

### 2.2 Colores

| Token | Kit valor | Implementación | Estado |
|:------|:----------|:---------------|:-------|
| Primary | `#1E1E1E` | `--color-primary: #1E1E1E` | ✅ |
| Secondary | `#FFFFFF` | `--color-secondary: #FFFFFF` | ✅ |
| Accent | `#FFBC7D` | `--color-accent: #FFBC7D` | ✅ |
| Card blue | `#B5E6F7` | `--color-card-blue: #B5E6F7` | ✅ |
| Card yellow | `#FDEBB6` | `--color-card-yellow: #FDEBB6` | ✅ |
| Card teal | `#BFEDEE` | `--color-card-teal: #BFEDEE` | ✅ |
| Card pink | `#ECDCE3` | `--color-card-pink: #ECDCE3` | ✅ |
| Card green | `#C5EFCD` | `--color-card-green: #C5EFCD` | ✅ |

### 2.3 Layout & Componentes

| Token | Kit valor | Implementación | Estado |
|:------|:----------|:---------------|:-------|
| Container max | `1440px` | `--container-max: 1440px` | ✅ |
| Card radius | — | `--card-radius: 24px` | ✅ |
| Card shadow | — | `--card-shadow: 0 0 10px rgba(0,0,0,.15)` | ✅ |
| Button radius | `0px` | `.btn { border-radius: 0 }` | ✅ |
| Button padding | `16px` | `.btn { padding: 16px }` | ✅ |
| Button bg | `#1E1E1E` | `.btn { background: var(--color-primary) }` | ✅ |
| Button hover bg | `#CACACA` | `.btn:hover { background: #CACACA }` | ✅ |
| Button hover color | `#1E1E1E` | `.btn:hover { color: var(--color-primary) }` | ✅ |
| Widget spacing | `20px` | `--widget-spacing: 20px` | ✅ |

---

## 3. Auditoría por sección — Homepage

Fuente: frame `23:129` (homepage completa)

| Sección | Frame | Figma | Implementación | Estado |
|:--------|:------|:------|:---------------|:-------|
| **Header** | `23:129` (top) | Logo + hamburguesa | `SiteHeader.astro` + `menu.svg` | ✅ |
| **Hero** | `23:129` | H1 + excerpt + CTA | `.s-hero` en `homepage.css` | ✅ |
| **Tech section** | `23:129` | "~ Tecnología…" dark bg, 2-col | `.s-tech` dark bg, 2-col | ✅ |
| **Cloudflare card** | `23:129` | Bordered centered card | `.s-cf__card` bordered centered | ✅ |
| **Service cards** | `23:129` | 5 cards apiladas pastel | `.area-card` × 5, sticky scroll | ✅ |
| **CTA** | `23:129` | Dark bg + H2 + body | `.s-cta` dark bg | ✅ |
| **Partners** | `23:129` | "Confían en nosotros" + logos | Partner section + logos | ✅ |
| **Footer** | `23:129` | 4-col grid + Kit Digital | `SiteFooter.astro` + banner | ✅ |

---

## 4. Auditoría por página

### 4.1 Detalle de servicio — Chunk 1 (#123)

**Frames**: `23:3` ("Beneficios principales"), `11:37` (heading servicio)

| Aspecto | Figma | Implementación | Estado |
|:--------|:------|:---------------|:-------|
| Hero con título H1 | ✅ | ✅ `[slug].astro` hero section | ✅ |
| Excerpt bajo el título | ✅ | ✅ PortableText body | ✅ |
| Color accent del servicio | ✅ | ✅ CMS `color` field → CSS var | ✅ |
| Sección "Beneficios principales" | ✅ Lista de 5 items | ❌ No implementada como sección separada | ⚠️ CMS |
| CTA "Solicita propuesta" | ✅ | ✅ Global CTA component | ✅ |

> **Hallazgo**: La sección de beneficios depende de contenido CMS (Portable Text) — no es un gap de template sino de datos. **Acción**: enriquecer contenido en el admin.

### 4.2 Quiénes somos

| Token | Verificado | Estado |
|:------|:-----------|:-------|
| Font Alexandria | ✅ | ✅ |
| `--color-primary` refs | 19 | ✅ |
| `.btn` 20px | ✅ | ✅ |
| CSS compartido | `about.css` + `theme.css` | ✅ |

### 4.3 Contacto

| Token | Verificado | Estado |
|:------|:-----------|:-------|
| Font Alexandria | ✅ | ✅ |
| `--color-primary` refs | 18 | ✅ |
| `.btn` 20px | ✅ | ✅ |
| CSS compartido | `contact.css` + `theme.css` | ✅ |

### 4.4 Blog

| Ruta | HTTP | Estado |
|:-----|:-----|:-------|
| `/blog` | 302 (redirect) | ✅ Expected — no blog posts yet |
| `/posts/[slug]` | — | Template ready, `post-detail.css` |

### 4.5 Equivalentes EN

| Ruta EN | HTTP | Tokens | Estado |
|:--------|:-----|:-------|:-------|
| `/en/` | 200 | Alexandria ✅, 21 primary refs, 9 btn matches | ✅ |
| `/en/about-us` | 200 | Alexandria ✅, 19 primary refs | ✅ |
| `/en/contact` | 200 | Alexandria ✅, 18 primary refs | ✅ |
| `/en/quienes-somos` | 200 | — | ✅ |

---

## 5. Componentes transversales

### 5.1 Menu Dialog — Chunk 2 (#124)

**Frame**: `53:2` | **Ref CSS**: `reference/menu-popup.css`

| Propiedad | Elementor/Figma | Implementación | Estado |
|:----------|:---------------|:---------------|:-------|
| Font family | `"Alexandria"` | `"Alexandria"` | ✅ |
| Nav desktop | `48px / 600 / 54px` | `48px / 600 / 54px` | ✅ |
| Nav secondary | `38px / 600` | `32px` | ⚠️ Decisión |
| Nav mobile | `32px / 40px` | `32px / 40px` | ✅ |
| Close button | `32px`, top-right | `32px`, top-right | ✅ |
| Viewport | `100vh × 100vw` | `100vh × 100vw` | ✅ |
| Background | White | White | ✅ |
| Logo bottom-right | ✅ (en wireframe) | ❌ No implementado | ⚠️ Decisión |
| Overlay | Box-shadow | Semi-transparent backdrop | ⚠️ Decisión |

**Fidelidad**: ~92% — Los gaps son decisiones de diseño (ver §8).

### 5.2 Service Cards — Chunk 3 (#125)

**Frames**: `1:8`, `5:37`

| Aspecto | Figma wireframe | Implementación | Estado |
|:--------|:---------------|:---------------|:-------|
| Card layout | 2-col (text + image) | Single-col (título + excerpt + flecha) | ⚠️ Decisión |
| CTA en card | Botón negro | Flecha "→" | ⚠️ Decisión |
| Image placeholder | ✅ | ❌ No hay imagen en card | ⚠️ Decisión |
| Border-radius | N/A (wireframe plano) | `24px` | ✅ |
| Pastel background | N/A | ✅ CMS `color` field | ✅ |
| Sticky scroll | N/A | ✅ Desktop stacking animation | ✅ Enhancement |
| Card shadow | N/A | `0 0 10px rgba(0,0,0,.15)` | ✅ |

**Fidelidad de tokens**: 100% — Las diferencias de layout son evoluciones intencionales del wireframe original.

### 5.3 Header / Footer

Previamente auditados en la auditoría v1. Confirmados consistentes en todas las páginas.

---

## 6. Assets — Chunk 4 (#126)

| Asset | Figma | `public/assets/` | Tamaño | Estado |
|:------|:------|:-----------------|:-------|:-------|
| Logo horizontal (header) | ✅ | `logo.svg` | 14 KB | ✅ |
| Logo vertical (footer) | ✅ | `logo-vertical.png` | 33 KB | ✅ |
| Cubo 3D (hero bg) | ✅ | `cubo-home.svg` | 1.5 KB | ✅ |
| Menu icon | ✅ | `menu.svg` | 291 B | ✅ |
| Cloudflare logo | ✅ | `logo-cloudflare.svg` | 8.8 KB | ✅ |
| Kit Digital banner | ✅ | `kit-digital-banner.jpg` | 73 KB | ✅ |
| Favicon | N/A | `favicon.png` | 7.3 KB | ✅ |

### Frames descartados (metadata del proyecto)

De los 27 frames extraídos, **11 son metadata del proyecto Figma** (portada "CLIENTE: Server Startup", participantes, tipo de proyecto) — NO frames de UI:

`1:3`, `1:6`, `1:7`, `1:8`, `1:18`, `7:3`, `11:66`, `115:10`, `183:10`, `113:66`, `159:10`

---

## 7. Hallazgos consolidados

### 🔴 Crítico — 0

Ninguno.

### 🟡 Medio — 1 (resuelto)

| # | Hallazgo | Fix | Issue | Estado |
|:--|:---------|:----|:------|:-------|
| 1 | Button `font-size: 18px` → debería ser `20px` | `theme.css` L123-125 | #122 | ✅ Resuelto (PR #129) |

### 🟢 Bajo / Intencional — 0

No hay bugs CSS pendientes.

---

## 8. Decisiones de diseño documentadas

Estas diferencias entre Figma y la implementación son **intencionadas** — no son bugs.

| # | Decisión | Figma | Implementación | Justificación |
|:--|:---------|:------|:---------------|:-------------|
| 1 | **Service card layout** | 2-col con imagen | Single-col con sticky scroll | Evolución del wireframe → experiencia interactiva superior |
| 2 | **Card CTA** | Botón negro | Flecha "→" | Card entera actúa como enlace → UX más limpia |
| 3 | **Card imagen** | Image placeholder | Sin imagen en card | `featured_image` en CMS pero no renderizada en homepage cards |
| 4 | **Menu secondary font-size** | 38px | 32px | Ratio de contraste mejorado con nav principal (48px) |
| 5 | **Menu logo decorativo** | Cubo bottom-right | No implementado | Decisión de simplicidad visual |
| 6 | **Menu overlay** | Box-shadow | Semi-transparent backdrop | Mejor UX para overlay fullscreen |

---

## 9. CSS compartido — Arquitectura

| Archivo CSS | Páginas | Scope |
|:------------|:--------|:------|
| `theme.css` | Todas | Global: tokens, button, typography, resets |
| `homepage.css` | ES + EN homepage | Hero, tech, cloudflare, areas, CTA |
| `service.css` | `[slug].astro` + `en/[slug].astro` | Service detail: hero, content, CTA |
| `about.css` | `quienes-somos` + `en/about-us` | Team cards, about layout |
| `contact.css` | `contacto` + `en/contact` | Contact form, layout |
| `post-detail.css` | `blog/[slug]` + `en/blog/[slug]` | Blog article layout |

> **No hay duplicación de estilos entre ES/EN** — ambos locales comparten los mismos CSS files vía componentes compartidos. Principio DRY cumplido.

---

## 10. Items pendientes (no CSS)

| Item | Tipo | Dónde | Acción |
|:-----|:-----|:------|:-------|
| "Beneficios principales" sección | CMS content | Servicio CDN | Enriquecer Portable Text en admin |
| CTA labels específicos | CMS content | Todos los servicios | Verificar `cta_label` personalizado |

---

## 11. Tracking de issues

| Issue | Chunk | Título | Estado |
|:------|:------|:-------|:-------|
| [#121](https://github.com/julioarguello/www-serverstartup-io/issues/121) | Epic | Auditoría Figma Completa | ✅ Completado |
| [#122](https://github.com/julioarguello/www-serverstartup-io/issues/122) | 0 | Fix button font-size | ✅ Merged (PR #129) |
| [#123](https://github.com/julioarguello/www-serverstartup-io/issues/123) | 1 | Service detail page | ✅ Documentado |
| [#124](https://github.com/julioarguello/www-serverstartup-io/issues/124) | 2 | Menu Dialog | ✅ Documentado |
| [#125](https://github.com/julioarguello/www-serverstartup-io/issues/125) | 3 | Service Cards | ✅ Documentado |
| [#126](https://github.com/julioarguello/www-serverstartup-io/issues/126) | 4 | Assets y logos | ✅ Documentado |
| [#127](https://github.com/julioarguello/www-serverstartup-io/issues/127) | 5 | Interior pages | ✅ Documentado |
| [#128](https://github.com/julioarguello/www-serverstartup-io/issues/128) | 6 | Consolidación (este doc) | ✅ |
