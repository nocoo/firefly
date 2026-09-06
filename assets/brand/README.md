# Firefly identity

Adopted from `nocoo/hexly.ai`, study `firefly/2026-09-06-10`, finishing `02`.
The owner selected the artwork and requested more room inside the rounded tile.
All masters use the same centered 84% placement of the complete firefly/fire group.

| File | Role |
| --- | --- |
| `../../logo.png` | Transparent foreground, 2048 × 2048; no external glow |
| `icon.png` | Square night presentation for operating-system icons |
| `icon-rounded.png` | Rounded presentation for large README and social images |

The insect uses connected flat facets, champagne wings, and a golden abdomen.
Its separate interest point is a small tactile flame on crossed logs. The night
field has a crescent, sparse stars, cloud contours, shallow shadows, and separately
composed warm light. Source art, masks, glow layers, exact prompt, all sizes, and
earlier studies remain in the hexly.ai workbench.

At native size, nearest visible-artwork clearance from the rounded boundary is
157.28 px; no visible pixels are clipped. The source proportions remain intact.
Native opaque pixels retain their original RGB values before uniform placement.

Regenerate checked-in app assets with:

```sh
uv run --with pillow python scripts/resize-logos.py
```

The generator uses the transparent foreground for the 24/80 px app logos,
32 px PNG favicon, and verified 16/32/48 px ICO entries. These small marks have
no night field, external glow, tile, or extra crop. README and social images use
the rounded presentation; the 180 px Apple touch icon uses the square tile for
system masking. At 16 px the wing silhouette and amber abdomen remain visible;
individual eyes, limbs, and wood grain simplify.

Production uses a separate custom blue LZ monogram in its versioned R2 site-logo
setting. That personal mark supplies the login hero and dynamic `/api/favicon`;
Firefly's sidebar and login chrome use the project assets above. The Journal
theme has its own four-square mark and favicon, documented in
`docs/29-journal-play-side.md`. These personal-site identities are distinct from
the Firefly application logo.

See [provenance.json](provenance.json) for exact master hashes and source history;
the public before/after review is [hexly.ai/logos/firefly](https://hexly.ai/logos/firefly).

This transparent-small-mark follow-up is local until publication is requested.
Shared usage and adoption SOP: `hexly.ai/docs/07-logo-usage-sop.md`.
