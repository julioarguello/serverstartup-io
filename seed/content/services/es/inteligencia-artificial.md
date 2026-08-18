---
id: "01M07525BS5E1JAN6X9HBDPNVB"
cta_label: "Cuéntanos tu caso"
excerpt: "La IA es un medio, no un fin. La máquina hace el código repetitivo; nosotros ponemos la arquitectura y el criterio, del desarrollo a la operación — enfoque integral, perfil *DevOps*. El agente propone, el ingeniero dispone."
# evidence traceability in issue 270 and docs/company/04-services-business-model.md
---

Usamos la IA de dos maneras. Como herramienta, para construir con más calidad y menos horas lo que ya sabíamos construir. Y como pieza del sistema, para resolver lo que hace poco no era posible. En los dos casos es un medio, no un fin.

Cuando generar código sale casi gratis, se genera muchísimo más software ([paradoja de Jevons](https://news.northeastern.edu/2025/02/07/jevons-paradox-ai-future/)). Y todo ese software nuevo hay que [integrarlo](/integracion-de-sistemas) y [asegurarlo](/cdn-waf-seguridad-edge-cloudflare) dentro de sistemas que ya existían. Es la parte de más valor del trabajo, y la que hacemos desde 2019.

El código repetitivo lo hace la máquina. Nuestro tiempo va al criterio y la responsabilidad, y un equipo pequeño entrega hoy lo que antes pedía uno grande.

## Generado ≠ entregado

Un agente es IA que hace cosas, no solo responde. Y para ser útil necesita leer el pedido en [`SAP`](/comercio-electronico), comprobar el *stock* en [`BigQuery`](/big-data-cloud-analytics) y escribir el resultado donde tu equipo trabaja de verdad. Ese cableado es lo nuestro.

Nuestro flujo es el de este *pull request*. El agente propone; el ingeniero revisa, aprueba y **firma**. Siempre con permisos mínimos y cada acción registrada.

- **Agentes con permisos acotados.** Construidos sobre el [`Agents SDK`](https://developers.cloudflare.com/agents/), tocan solo lo que deben y siempre hay una persona que puede pararlos.
- **Inferencia en el borde.** Clasificación y extracción de documentos con [`Workers AI`](https://developers.cloudflare.com/workers-ai/), en la red de [`Cloudflare`](https://www.cloudflare.com/es-es/). El dato se procesa en tu propia cuenta, no en el `SaaS` de IA de un tercero.
- **Tráfico de IA gobernado.** Cada llamada a un modelo queda registrada y con techo de gasto en [`AI Gateway`](https://developers.cloudflare.com/ai-gateway/). Sabrás qué modelo respondió y cuánto costó.
- **Auditoría antes de producción.** Seguridad, lógica de negocio y rendimiento. Ninguna línea generada se despliega sin pasarla.

## Firmamos el código

Usamos IA a diario. [`Claude Code`](https://claude.com/claude-code), [`Cursor`](https://cursor.com), modelos abiertos en `Workers AI`. Y por usarla sabemos dónde falla.

La queja más repetida del sector es el código «casi correcto, pero no del todo». Ese «casi», en el cálculo de una promoción o en el *stock* que ve la tienda, es un incidente.

Por eso trabajamos con la seguridad por delante. Los agentes usan credenciales de mínimo privilegio, trabajan en entornos separados de producción y nada llega a `main` sin revisión humana.

El que firma, da la cara. Desde agosto de 2026, además, la [ley europea de IA](https://artificialintelligenceact.eu/es/) exige supervisión humana con competencia y autoridad para corregir o parar un sistema de alto riesgo. Nosotros ya trabajamos así.

Aquí no vas a encontrar un producto de IA. No lo tenemos y no lo fingimos. Tenemos un método hecho de reglas y protocolos versionados que dirigen a los agentes, distribuible y auditable.

[Esta misma web](/deconstruyendo) se construye así, con agentes supervisados, *pull request* a *pull request*. Y si un *chatbot* no te resuelve nada, te diremos que no lo pongas.
