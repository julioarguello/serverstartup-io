# Vendored: EmDash skill pack

Reference material for working with [EmDash](https://emdash.dev) — building a
site, writing plugins, driving the CLI. Useful, and **not ours**.

## Where it came from

| | |
| :--- | :--- |
| Source | The EmDash starter skeleton this project was created from |
| Imported | **2026-04-21**, commit `c8f0df1` — authored by `cloudflare[bot]`, subject *"source repo import"* |
| EmDash at import | **0.6.0** (`package.json` at that commit) |
| Modified since | **No.** Two commits only: the import and the #325 move. `git log` does not follow renames across a directory, so check one file — `git log --follow -- vendor/emdash-skills/emdash-cli/SKILL.md` |

## Read it with the version gap in mind

This project runs **EmDash 0.34.0**. These files were written for **0.6.0** and
have not been revised in the twenty-eight minor versions since. Where they
describe a CLI flag, a hook signature or a config key, check it against the
installed package before believing it — `node_modules/emdash/` is the authority,
not this directory.

One consequence of the move: `building-emdash-site/SKILL.md` sends you to the
plugin skill "in `.agents/skills/creating-plugins/`", a path that no longer
exists. It is `vendor/emdash-skills/creating-plugins/`, one directory over. The
file is a snapshot and is not edited to say so — that is what this paragraph is
for.

Where they explain a *concept* — how Portable Text blocks are shaped, how
plugins hook into the admin UI, how the seed corpus relates to collections —
they have aged much better, and that is what they are kept for.

## Why it is not called `.agents`

It was, until #325. One character separated it from the private `.agent`
directory this project excludes: one public, tracked, vendored, and not ours;
the other private, never committed, and ours. Every rule written about either
one read as if it were about the other, and nothing in the repository told a
reader which was which. `vendor/` is the conventional name for code a project
carries but does not own, and this is the first thing in it — the directory
exists because of this pack. Anything else vendored later belongs beside it.

## Editing

Don't. It is a snapshot of somebody else's documentation. If something here is
wrong, the fix belongs upstream; if we need our own version of it, it belongs
in `docs/`.
