---
excerpt: "How this website is built, layer by layer: from the point of presence that answered your request to the commit that authorised these words. Thresholds and measurements in plain sight."
---

If someone tells you how they work and cannot show you the workshop, be suspicious. This is ours.

The tour runs downwards, from the point of presence that answered your request to the commit that authorised these words. Every layer opens if you want the detail, and everything claimed here is in [the repository](https://github.com/julioarguello/serverstartup-io).

## The architecture

There are no servers to look after, and that is the least of it. What matters is where the response you are reading was made: at the `edge`, on [`Cloudflare Workers`](https://developers.cloudflare.com/workers/). Cache sits in front, and on a hit the code never runs.

Below that, the CMS is [`EmDash`](https://blog.cloudflare.com/emdash-wordpress/), which Cloudflare released under an MIT licence as a successor to WordPress, and not a service to call over the network: it is the same application, served by the same `worker`. And at the bottom of the descent there is no database, there is a text file in Git.

## Content as code

Almost every text lives in [`seed/seed.json`](https://github.com/julioarguello/serverstartup-io/blob/main/seed/seed.json), with the [service](/en/greenfield-development) bodies in `markdown`: the filename is the slug, the directory is the locale. A rebuild from nothing remakes the whole site, and [continuous integration](https://github.com/julioarguello/serverstartup-io/blob/main/.github/workflows/ci.yml) checks that before every merge.

Caching inherits the discipline: a page is cached only if it asks to be, and publishing purges it by tag. One gap is worth saying out loud: menus and site settings emit no event, so a one-hour `TTL` is what bounds their staleness.

## The agents

A model writing the first draft is neither impressive nor mysterious. What decides whether this is serious is **who has authority over what**.

The agent proposes and cannot merge. The checks refuse and cannot write: their credential is read-only. The human can do both, which is why the human is the only one who can be wrong by name. The small print: the agent not merging is a written rule, not a lock on the server.

Before a person is asked anything, the branch goes through fifteen steps that can fail. They refuse what a reading by eye does not catch:

- **Non-citable names:** a client who must not appear in a public repository.
- **Copy outside the CMS:** a label that exists in one locale only, or a sentence burnt into a template.
- **Colours outside the system:** a literal or a new width, which is how seven different measures come back.
- **Caching in the wrong place:** a call placed after the headers have gone, which caches nothing and looks like it does.
- **Copy that changes by itself:** the rendered text of [26 routes](https://github.com/julioarguello/serverstartup-io/tree/main/tests/copy-baseline) is frozen.
- **Accessibility and contrast:** keyboard traversal, reflow at 320 pixels and [W3C](https://validator.w3.org/nu/) validation.

A guard is only worth having if it can fail, and one that finds nothing looks like one that cannot. The two most delicate carry a positive control that blows them up the moment they stop looking. The last door is not automatic either: production is deployed by hand.

## The numbers

An undated number is the worst possible place for drift, so there are two kinds here and they never mix. The threshold lives in [a file](https://github.com/julioarguello/serverstartup-io/blob/main/lighthouserc.json): 95 or more for performance, 100 for accessibility, best practices and SEO, over the median of three runs under mobile emulation.

The measurement carries its date. On 24 August 2026, against the production build: 100 in all four categories across all five addresses, with the largest content painted in under 1.6 seconds. Each figure is a median, and the bound is the worst of the five.

## The workshop, in plain sight

The repository is public and syncs on every change to the main branch, whole history, unfiltered. Publishing like that has a cost: that is why the non-citable-names guard exists.

Code, seeds, checks and deployments: it is all there. [Look inside](https://github.com/julioarguello/serverstartup-io) and [tell us](/en/contact) if you would do it differently.
