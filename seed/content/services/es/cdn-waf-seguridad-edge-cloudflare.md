---
id: "01KZB2G0MXNZQR7Q35JNHYVZNM"
cta_label: "Audita tu edge"
excerpt: "*Partners* oficiales de [`Cloudflare`](https://www.cloudflare.com/es-es/) desde 2019. Auditoría, migración y operación de `CDN`, `WAF` y seguridad perimetral, sobre todo en [comercio electrónico](/comercio-electronico)."
---

Trabajamos con la plataforma de [`Cloudflare`](https://www.cloudflare.com/es-es/) desde 2017, dos años antes de hacernos socios oficiales. Auditamos, migramos y optimizamos cuentas [Enterprise](https://www.cloudflare.com/es-es/plans/enterprise/) y [Business](https://www.cloudflare.com/es-es/plans/business/), sobre todo para *retail* y comercio electrónico.

`Cloudflare` está configurado. ¿Seguro de que está bien configurado? En muchas organizaciones nadie se atreve a tocar las reglas del `WAF`. Bloquean algo, seguro. Nadie recuerda qué.

Nosotros sabemos por qué está cada una, porque las escribimos, las versionamos con [`Terraform`](https://developer.hashicorp.com/terraform) y las mantenemos en producción.

## WAF ≠ seguridad

Un *firewall* no es una estrategia de seguridad, sino una parte de ella. Configuramos `Cloudflare` como arquitectura, y cada interruptor de este panel tiene un porqué.

- **Reglas `WAF` a tu medida.** Ajustadas a tu superficie de ataque real. OWASP Top 10, DDoS, bots. Las plantillas genéricas, fuera.
- **Caché y `CDN`.** Tu origen respira y los tiempos de respuesta se vuelven predecibles. También en la campaña de noviembre.
- **Migraciones sin corte.** Desde Akamai o la `CDN` que toque, sin parar la tienda.
- **Todo en `Terraform`.** La configuración entera como código, versionada y revisada. Nada depende de la memoria de nadie.
- **Lógica junto al usuario.** `Workers` en más de 300 ciudades, a menos de 50 ms. Los primeros los pusimos en producción en 2018.
- **Guardia diaria.** Alertas y comprobaciones que un ingeniero revisa cada mañana. El mismo que escribió tus reglas.

## Quien lo configura, lo mantiene

No montamos `Cloudflare` y desaparecemos. Vigilamos el tráfico, ajustamos las reglas cuando cambian los patrones de ataque y damos la cara cuando algo se degrada.

Hemos montado `Cloudflare` para:

> b64:QURJIEliZXJpYSwgQWxjYW1wbywgRG9vZXJzIFNuZWFrZXJzLCBGb3J1bSBTcG9ydCwgSm9iJlRhbGVudCwgTWFyYXRob24sIFB1bnQgUm9tYSwgVG95cyJSIlVzIEliZXJpYSw=

La plataforma no se acaba en el `CDN` y el `WAF`. `Zero Trust`, `Access`, `Stream`, `R2`. Te ayudamos a decidir qué piezas encajan y cuáles no.

Esta misma web corre sobre `Workers`, `D1` y `R2`, detrás del mismo `WAF` que operamos para clientes. La desmontamos pieza a pieza en [Deconstruyendo esta web](/deconstruyendo).
