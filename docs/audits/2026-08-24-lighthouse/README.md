# Lighthouse — 2026-08-24

The dated measurement `/deconstruyendo` cites. Committed because the page's own
thesis is that a figure is either a threshold living in a file or an observation
carrying its date, and an observation with no artifact behind it is neither
(#305). Run against the production build served locally.

## How it was run

```bash
rm -rf .wrangler && npx astro build && scripts/ci-local-stack.sh 8787
npx -y @lhci/cli@0.15.1 autorun --config=lighthouserc.json
```

> [!CAUTION]
> **`npx lhci` is NOT Lighthouse.** The unscoped `lhci` name on npm is a
> placeholder package (version `4.1.2`, description *"placeholder anupamas0x1"*)
> that prints a greeting and **exits 0**. Measured 2026-08-24: a full
> `npx lhci autorun --config=lighthouserc.json` produced a 27-byte log reading
> `Hello, this is AnupamAS01!` and returned success. Any local verification run
> that way measured nothing and reported green — including the one cited as a
> source in the project rules for #304. The CLI is **`@lhci/cli`**. CI is
> unaffected: `.github/workflows/ci.yml` uses `treosh/lighthouse-ci-action@v12`,
> never the bare name.

## Results — median of 3 runs per URL

Lighthouse **12.6.1**, `formFactor: mobile`, `screenEmulation.mobile: true` — resolved defaults, which `lighthouserc.json` pins neither of.

| URL | performance (3 runs) | median | a11y | best practices | SEO | LCP (median) |
|---|---|---|---|---|---|---|
| `/` | 100, 100, 100 | **100** | 100 | 100 | 100 | 1.59 s |
| `/cdn-waf-seguridad-edge-cloudflare` | 100, 100, 100 | **100** | 100 | 100 | 100 | 1.37 s |
| `/comercio-electronico` | 100, 100, 100 | **100** | 100 | 100 | 100 | 1.51 s |
| `/contacto` | 100, 100, 100 | **100** | 100 | 100 | 100 | 1.36 s |
| `/deconstruyendo` | 100, 100, 100 | **100** | 100 | 100 | 100 | 1.06 s |

Lowest performance median across the five URLs: **100**. Slowest LCP median:
**1.59 s**.

**The page states a bound, not a point.** Three full runs across one afternoon
put the slowest LCP median at 1.59 s, 1.51 s and 1.59 s — the scores are
stable, the timing is not, and a page whose subject is undated numbers drifting
should not quote a figure that moves between runs. "Under 1.6 s" survives all
three and is still a measurement.

The threshold in `lighthouserc.json` is `minScore 0.95`, i.e. **95 or more**: a
flat 95 passes, which is why the page says "95 o más" and not "por encima de 95".

Raw reports (`.lighthouseci/`, ~25 MB per run) are gitignored on purpose; CI
keeps its own through `uploadArtifacts: true`.
