# Cloudflare Stream — Video Registry

Videos migrated from `julioarguello/serverstartup.io` on 2026-05-01.

## Account

- **Account:** Server Startup (`d70cd71aecc76f94c73d7a6f3cc1265d`)
- **Dashboard:** https://dash.cloudflare.com/d70cd71aecc76f94c73d7a6f3cc1265d/stream

## Videos

| Name | Stream ID | Duration | Embed |
|:-----|:----------|:--------:|:------|
| Logo animation v1 | `ccebcd4e03444ba9b90bd0cca0b1cf95` | 8s | `<iframe src="https://customer-*.cloudflarestream.com/ccebcd4e03444ba9b90bd0cca0b1cf95/iframe" ...>` |
| Logo animation v2 | `8860585d31b3323c3869f884b82c3ee0` | 8s | `<iframe src="https://customer-*.cloudflarestream.com/8860585d31b3323c3869f884b82c3ee0/iframe" ...>` |
| Slideshow original | `2ef883e18d88c166b0b0dea83931c886` | 5s | `<iframe src="https://customer-*.cloudflarestream.com/2ef883e18d88c166b0b0dea83931c886/iframe" ...>` |
| Slideshow TOC - Low | `b1f3b6feaa443835d0736578d5c600a5` | 6s | `<iframe src="https://customer-*.cloudflarestream.com/b1f3b6feaa443835d0736578d5c600a5/iframe" ...>` |
| Slideshow TOC - Med | `787b1ee352ec8c2aefb566a36eeaaf7a` | 5s | `<iframe src="https://customer-*.cloudflarestream.com/787b1ee352ec8c2aefb566a36eeaaf7a/iframe" ...>` |
| Slideshow TOC - High | `c5e3b246d568a28cab5323ac3e469b7d` | 6s | `<iframe src="https://customer-*.cloudflarestream.com/c5e3b246d568a28cab5323ac3e469b7d/iframe" ...>` |

> **Note:** Replace `customer-*` with your actual customer subdomain from the Stream dashboard.

## Usage in Astro

### Embed in a page

```html
<iframe
  src="https://customer-XXXX.cloudflarestream.com/{VIDEO_ID}/iframe"
  style="border: none; width: 100%; aspect-ratio: 16/9;"
  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
  allowfullscreen>
</iframe>
```

### Embed in Portable Text (CMS)

Use the EmDash admin UI to add a raw HTML block or create a custom block type for Stream videos.

## Provenance

- **Source repo:** `github.com/julioarguello/serverstartup.io` (commit `817f097`) — archived 2026-08-30
- **Original path:** `src/media/logo/` and `src/media/misc/`
- **Migration issue:** #139
