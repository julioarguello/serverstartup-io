---
id: "01M02XSPB4687H2JC48XSJKP5H"
cta_label: "Hablemos de tus datos"
excerpt: "Un flujo de datos se monta rápido. Una plataforma que aguante años de negocio, cambios de esquema, picos de campaña y fuentes de datos variables es otra historia. Arquitectura [*medallion*](https://dataengineering.wiki/Concepts/Medallion+Architecture) y tests que se cuentan por miles."
---

Cualquiera monta un *pipeline* en una tarde. Una plataforma que aguante años de negocio, cambios de esquema y picos de campaña es otra historia.

Nosotros la construimos como se construye el [software serio](/desarrollo-greenfield). Cada transformación versionada en `git`, cada dato con su test, cada flujo con su alerta.

La esencia es analítica, y las sinergias con lo operacional la multiplican. Usamos [`dbt`](https://www.getdbt.com/) a los dos lados del *warehouse*.

## dbt ≠ pipeline

`dbt` es la T del [`ELT`](https://www.getdbt.com/blog/extract-load-transform) y lo tratamos como se trata el buen software, el patrón que el sector llama [*analytics engineering*](https://www.getdbt.com/what-is-analytics-engineering). Pero la herramienta es solo una pieza: la ingesta, la orquestación y la vigilancia van aparte, y nuestro valor está en montar y operar el conjunto completo.

- **Donde más hemos profundizado**. En el *cloud* de Google, [`BigQuery`](https://cloud.google.com/bigquery) como *warehouse* y `dbt` en las transformaciones.
- **De la pizarra a la publicación**. Nuestra [*definition of done*](https://scrumguides.org/scrum-guide.html#commitment-definition-of-done) nace en el *blueprint*, mucho antes del código. Diseño de la base de datos con el [modelado clásico del sector](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/), nomenclatura estándar, homogeneización y normalización del dato. Es más análisis que desarrollo, y es donde se gana la fiabilidad.
- **El testeo es la parte que casi todo el mundo se salta**. En nuestras plataformas los tests se cuentan por miles. *Unit tests* que corren antes de publicar y *data tests* que se ejecutan cada día, con cada carga. El dato que no los pasa no llega a *gold*.
- **Arquitectura por capas**. El patrón [*medallion*](https://dataengineering.wiki/Concepts/Medallion+Architecture) separa el dato crudo del verificado, cada capa con su propósito y su control de acceso.
- **La infraestructura también es código**. [`Terraform`](https://www.terraform.io/) levanta los mismos *datasets*, permisos y entornos en desarrollo y en producción.
- **Tiempo real cuando el negocio lo pide**. Ingesta con [`Pub/Sub`](https://cloud.google.com/pubsub) y [`Dataflow`](https://cloud.google.com/dataflow) para los flujos que no pueden esperar al *batch* nocturno.

## Sinergias entre lo analítico y lo operacional

> «Un solo modo de trabajar para dos mundos divergentes.»

En lo analítico trabajamos con [`dbt Cloud`](https://docs.getdbt.com/docs/platform/about-platform/dbt-platform-features) sobre `BigQuery`. Y cuando la transformación nace en la capa operacional, sobre una base relacional como `Oracle`, la gestionamos con [`dbt Core`](https://github.com/dbt-labs/dbt-core) y el [adapter que mantiene Oracle](https://github.com/oracle/dbt-oracle) (con nuestras mejoras, tan obvias como necesarias...).

Los mismos tests y el mismo versionado a los dos lados, sin peajes entre equipos. Al cuadro de mando, el dato llega ya probado.

Conectamos `BigQuery` con [tu e-commerce](/comercio-electronico), con tu [ERP](/integracion-de-sistemas) y con el [*edge*](/cdn-waf-seguridad-edge-cloudflare).
