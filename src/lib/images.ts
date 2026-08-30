/**
 * The quality every transform this site emits has to carry (#409).
 *
 * The Cloudflare adapter's transform endpoint hands `q` straight to the IMAGES
 * binding, and the binding applies NO default of its own: with the parameter
 * absent it encodes near-losslessly. Measured on the deployed preview worker,
 * same URL, same transform, only `&q=85` appended by hand:
 *
 *     sponsorship photo @852   no q  489 154 B   ·   q=85  116 634 B   (4.2x)
 *     a team photograph @520   no q  144 204 B   ·   q=85   29 932 B   (4.8x)
 *
 * There is no site-wide setting to reach for. `image.service.config` reaches
 * the sharp service only, and what the binding reads is the URL, which is
 * built from the per-image `quality` prop. A custom image service could inject
 * it once — and was rejected: the adapter then uses that same service for the
 * build-time `compile` pass (`prerenderer.js` swaps `userImageServiceEntrypoint`
 * in where sharp would be), and a service that has to load inside workerd
 * cannot import sharp. Silently unoptimised build output is a worse bug than
 * the one being fixed.
 *
 * So the number lives here, every `astro:assets` call site passes it, and
 * scripts/ci-check-image-hrefs.py fails the build over any /_image URL that
 * forgot — which is the part that survives the next call site being written.
 *
 * 85 because it is what EmDash's own endpoint already sends
 * (`DEFAULT_TRANSFORM_QUALITY` in `emdash/src/media/image-endpoint.ts`). Two
 * pipelines answering with different qualities for the same photograph is a
 * difference nobody would be able to explain a month from now.
 */
export const IMAGE_QUALITY = 85;
