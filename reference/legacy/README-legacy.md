# Bitácora de Feedback y Mejoras (Web Server Startup)

Registro cronológico inverso de críticas, decisiones de diseño y ajustes de contenido.

## 2026-01-26

### 🟡 Implementación de Banners Responsivos y Revisión de Fondo
**Requerimiento:** La agencia debe implementar la lógica de banners responsivos en cabecera para todas las páginas de área y la página de historia.
**Estado Actual:** Los archivos `.md` de contenido ya referencian la imagen única asignada a cada sección.
**Acción Técnica:**
-   Generar los recortes (crops) necesarios de cada imagen para garantizar su correcta visualización en diferentes dispositivos (Desktop, Tablet, Mobile).
-   Asegurar que el ratio de aspecto sea el adecuado en cada breakpoint.
**Revisión de Diseño:** Evaluar si el fondo azul actual de los banners debe sustituirse por un tono gris que se integre mejor con la línea visual del logo.

## 2026-01-23

### 🔴 Sincronización Web Beta: Ruptura Narrativa
**Crítica:** Análisis de la beta (`ivng318.sg-host.com`). El contenido actual presenta los servicios desordenados (E-commerce primero, Backend último) y con textos genéricos.
**Impacto:** Se rompe la historia de crecimiento y estructura definida en la nueva identidad (Base -> Núcleo -> Ramas -> Escudo).
**Acción Requerida:** Alinear 100% el contenido web con el nuevo orden de `src/pages/serverstartup/inicio.md` y la infografía v18.

### 🔴 Menú de Navegación: Jerarquía Incorrecta en "Otras Áreas"
**Crítica:** La estructura actual del menú oculta servicios críticos ("Integración de sistemas" y "Desarrollo backend a medida") bajo un desplegable genérico llamado "Otras áreas".
**Impacto:** Esto resta visibilidad a capacidades *core* de la empresa. Da la sensación de ser servicios "de segunda clase", contradiciendo el mensaje de "Especialización real" y visión integral.
**Acción Requerida:** Aplanar la jerarquía del menú y reordenar los items siguiendo la narrativa arquitectónica visual:
1. **Desarrollo Backend** (Cimientos/Greenfield)
2. **Integración de Sistemas** (Núcleo)
3. **Comercio Electrónico** (Negocio)
4. **Big Data & Analytics** (Datos)
5. **CDN & WAF (Cloudflare)** (Escudo/Perímetro)
Eliminación total del concepto "Otras áreas".
**Referencia:** Captura de pantalla de la navegación actual.

### 🟡 Mejora Visual: Mapa de Arquitectura Interactivo (Consejo Frikitek)
**Propuesta:** Transformar la sección "Áreas de especialización" de una lista plana a un "Mapa de Imágenes" (Image Map).
**Racional:** Seguir la "Narrativa Visual" definida en la skill (Skill.md #11):
-   **Orígenes (Abajo):** Backend / Greenfield.
-   **Núcleo (Centro):** Integración / Middleware.
-   **Ramas (Arriba):** E-commerce (Izquierda) + Big Data (Derecha).
-   **Escudo (Envolvente):** Cloudflare.
**Acción:** Diseñar/Implementar este asset gráfico interactivo en la Home.

### 🟢 Definición: Paleta de Colores Corporativa (Identidad Visual)
**Contexto:** Se definen los códigos hexadecimales oficiales para mantener coherencia visual entre la web, la arquitectura y los materiales gráficos.
**Paleta Oficial:**
*   📘 **E-commerce:** `#008FD3` (SAP Blue)
*   Sz **Greenfield:** `#3E7D50` (Chalk Green)
*   🦊 **Cloudflare:** `#F38020` (Official Orange)
*   🔴 **Big Data:** `#EA4335` (GCP Red)
*   🟦 **Integración:** `#1D4E89` (Blueprint Blue)
**Acción:** Incorporados a `SKILL.md`.
![Visualización Paleta Corporativa](src/media/assets/areas/corporate_palette.png)

### 🔵 Cambio de Nomenclatura: "Ingeniería Greenfield"
**Decisión:** Sustituir "Desarrollo Backend a medida" por conceptos más amplios como **"Ingeniería Greenfield"** o **"Sistemas Críticos"**.
**Racional:** El término "Backend" restringe la percepción del servicio. "Greenfield" implica construcción desde cero, libertad arquitectónica y visión completa, alineándose mejor con el color verde y la propuesta de valor.
**Acción:** Actualizados textos en `inicio.md` y definiciones en `SKILL.md`. **Recordatorio Agencia:** Revisar copies futuros para evitar "backend a medida".