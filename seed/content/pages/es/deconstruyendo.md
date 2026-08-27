---
excerpt: "Cómo está montada esta web, capa por capa: del punto de presencia que respondió a tu petición al *commit* que autorizó estas palabras. Con los umbrales y las mediciones a la vista."
---

Si te cuentan cómo trabajan y no pueden enseñarte el taller, desconfía. Este es el nuestro.

El recorrido va hacia abajo, del punto de presencia que respondió a tu petición al *commit* que autorizó estas palabras. Cada capa se abre si quieres el detalle, y todo lo que se afirma aquí está en [el repositorio](https://github.com/julioarguello/serverstartup-io).

## La arquitectura

No hay servidores que cuidar, y eso es lo de menos. Importa dónde se fabricó la respuesta que estás leyendo: en el `edge`, sobre [`Cloudflare Workers`](https://developers.cloudflare.com/workers/). Delante hay caché, y cuando acierta el código ni se ejecuta.

Debajo, el CMS es [`EmDash`](https://blog.cloudflare.com/emdash-wordpress/), que Cloudflare publicó con licencia MIT como sucesor de WordPress, y no un servicio al que llamar por red: es la misma aplicación, servida por el mismo `worker`. Y al final del descenso no hay base de datos, hay un fichero de texto en Git.

## Contenido como código

Casi cada texto vive en [`seed/seed.json`](https://github.com/julioarguello/serverstartup-io/blob/main/seed/seed.json), y los cuerpos de los [servicios](/desarrollo-greenfield) en `markdown`: el nombre del fichero es el *slug*, el directorio es el idioma. Una reconstrucción desde cero rehace la web entera, y eso lo comprueba la [integración continua](https://github.com/julioarguello/serverstartup-io/blob/main/.github/workflows/ci.yml) antes de cada fusión.

La caché hereda la disciplina: una página solo se cachea si lo pide, y al publicar se purga por etiquetas. Queda un hueco y conviene decirlo: los menús y los ajustes no emiten evento, así que su desfase lo acota el `TTL` de una hora.

## Los agentes

Que un modelo redacte el primer borrador no tiene mérito ni misterio. Lo que decide si esto es serio es **quién tiene autoridad para qué**.

El agente propone y no fusiona. Las comprobaciones rechazan y no escriben: su credencial es de solo lectura. La persona puede las dos cosas, y por eso es la única que puede equivocarse con nombre y apellidos. La letra pequeña: que el agente no fusione es una regla escrita, no un candado del servidor.

Antes de preguntarle nada a una persona, la rama pasa por dieciséis pasos que pueden fallar. Se niegan a dejar pasar lo que una revisión a ojo no ve:

- **Nombres no citables:** un cliente que no puede salir en un repositorio público.
- **Textos fuera del CMS:** una etiqueta que solo existe en un idioma, o una frase escrita a fuego en la plantilla.
- **Colores fuera del sistema:** un literal o una anchura nueva, que es como vuelven las siete medidas distintas.
- **Caché en el sitio equivocado:** una llamada puesta donde las cabeceras ya se han ido, que no cachea nada y lo parece.
- **Copia que cambia sola:** el texto renderizado de [26 rutas](https://github.com/julioarguello/serverstartup-io/tree/main/tests/copy-baseline) está congelado.
- **Imágenes que se piden a sí mismas:** una URL absoluta a nuestro propio dominio, que en Cloudflare no puede funcionar y en local no se nota.
- **Accesibilidad y contraste:** tabulador, reflujo a 320 píxeles y validación del [W3C](https://validator.w3.org/nu/).

Un guardia solo vale si puede fallar, y uno que no encuentra nada se ve igual que uno que no puede. Los más delicados llevan un control positivo que los revienta si dejan de mirar. La última puerta tampoco es automática: producción se despliega a mano.

## Los números

Un número sin fecha es el peor sitio para la deriva, así que aquí hay dos clases y no se mezclan. El umbral vive en [un fichero](https://github.com/julioarguello/serverstartup-io/blob/main/lighthouserc.json): 95 o más en rendimiento, cien en accesibilidad, buenas prácticas y SEO, sobre la mediana de tres pasadas con emulación móvil.

La medición lleva su fecha. El 24 de agosto de 2026, sobre la construcción de producción: cien en las cuatro categorías y en las cinco direcciones, con el mayor contenido pintado por debajo de 1,6 segundos. Es la mediana de cada una, y la cota es la peor de las cinco.

## El taller, a la vista

El repositorio es público y se sincroniza con cada cambio en la rama principal, con la historia entera y sin filtrar. Publicar así tiene un coste: por eso existe el guardia de nombres no citables.

Código, semillas, comprobaciones y despliegues: está todo. [Mira dentro](https://github.com/julioarguello/serverstartup-io) y [dinos](/contacto) si harías algo distinto.
