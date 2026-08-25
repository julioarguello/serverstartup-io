## What this changes, and why

<!-- Two or three lines. The reader is deciding whether the change is the right
     one, not reading the diff twice. Link the issue: Closes #N / Refs #N. -->

## How it was verified

<!-- Name the command and its result, not the intention. A gate you broke on
     purpose and watched fail is worth more than one you ran once and passed. -->

## Not verified

<!-- Gates that were skipped, and why. Anything changed but not exercised.
     A reviewer with nothing here assumes everything was checked. -->

---

- [ ] `npx astro check` — 0 errors (`.astro`, `.ts` and `tsconfig.json` changes break the
      Cloudflare build on a type error even when the dev server is happy)
- [ ] `npm test` — the unit suites, including the boundary and reserved-path guards
- [ ] The quality gates in `CONTRIBUTING.md` that this change can reach,
      run locally first — CI is confirmation, not discovery
- [ ] Copy changes live in the CMS seed, not in a template
- [ ] Both locales, if a route or a UI string moved
