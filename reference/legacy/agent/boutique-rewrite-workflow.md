---
description: Reescritura de documentos con estilo Boutique Copywriter manteniendo estructura y principios estratégicos, guardando en carpeta separada
---

1. **Leer el archivo objetivo**: Utiliza `view_file` para leer el contenido del documento original desde `src/frikitek/`.
2. **Leer la skill**: Utiliza `view_file` para leer las instrucciones de la skill de copywriting (repositorio de reglas interno, no incluido en este clon).
3. **Leer principios estratégicos**: Utiliza `view_file` para leer `docs/ai.txt`.
4. **Reescribir el contenido**:
   - Genera el nuevo contenido aplicando estrictamente la personalidad y reglas del "Boutique Copywriter" (Flat101, Codurance, Paradigma).
   - **Contexto Estratégico**: Incorpora sutilmente los principios de `docs/ai.txt` (Certeza, Responsabilidad, Gobernanza, Skin in the Game).
   - **SEO & Brevedad**: Integra keywords (CDN, Cloudflare, Integración) de forma orgánica y aplica la regla "lo bueno, si breve, dos veces bueno".
   - **NORMA CRÍTICA**: Debes respetar **exactamente** la misma estructura que el documento original. Mantén los mismos Títulos (`#`, `##`, `###`) y su jerarquía. No los cambies, ni añadas ni elimines.
   - Solo reescribe los párrafos y textos dentro de las secciones para adaptarlos al tono: profesional, directo, artesanal.
5. **Guardar en nueva ruta**: Utiliza `write_to_file` para guardar el contenido reescrito en `src/serverstartup/` (manteniendo el mismo nombre de archivo).
