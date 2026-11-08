# Design system

Layered on the existing identity (dark-first, lime `#91ff00` accent) using
Linear and Vercel as references. Tokens live in `style/globals.css` and
`tailwind.config.ts`; fonts in `lib/fonts.ts`.

## Typography

- **Sans:** Geist (variable, self-hosted, `--font-geist`). Narrative text, UI, headings.
- **Mono:** Geist Mono (`--font-geist-mono`). Eyebrows, indexes, IDs, code.
- **Weight ceiling:** 600. `font-bold` is not used; headings use `font-semibold`.
- **Tracking:** `h1`/`h2` at `-0.035em`, `h3`/`h4` at `-0.015em` (base layer).
  Components that set their own tracking keep it.
- `righteous` stays only for the About hero wordmark.

## Color

- One accent: lime (`--b-chip-selected`, `#91ff00` dark / `#15803d` light).
  Use it for the single primary action in a view and for selection state,
  not for decoration.
- Secondary actions use the neutral inverse pill
  (`bg-foreground text-background`) or a hairline border (`border-bBORDERFADE`).
- No multicolour icon sets. Lists use mono indexes (`01`, `02`) instead of
  coloured dots.

## Layout and chrome

- Floating widgets stay out of content on phones: the audio toggle is hidden
  below `s640`, the chat button sits at `bottom-4 right-4` on phones.

## Review checklist

Weight at most 600, one accent per view, visible focus ring, AA contrast in
both themes, no horizontal scroll at 375px.
