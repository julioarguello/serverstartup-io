# HTML validation policy (issue #158)

Tooling: `html-validate` (offline, `html-validate:recommended`) on the rendered
HTML of all templates, plus the W3C Nu checker for final sign-off.

Two rules are deliberately disabled in `.htmlvalidate.json`:

- `no-inline-style` — service-card and hero colors are CMS-driven (the `color`
  field per service entry). An inline `background-color`/CSS-variable is the
  only way to carry per-entry CMS data into styling without generating CSS at
  build time. Scope: card/hero color attributes only.
- `no-redundant-role` — `role="list"` on real `<ul>` elements is kept ON
  PURPOSE: the global reset applies `list-style: none`, and Safari/VoiceOver
  drops list semantics for such lists unless the role is explicit
  (well-documented AT behavior). The rule cannot distinguish this deliberate
  case, so it is off; truly redundant roles (`banner`, `contentinfo`,
  `listitem` on non-list markup) were removed from the templates instead.
