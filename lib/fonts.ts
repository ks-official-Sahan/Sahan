import localFont from "next/font/local";

// Self-hosted (Latin subset, from @fontsource, SIL OFL 1.1; licenses in
// app/fonts/). next/font/google fetches from fonts.googleapis.com at build and
// dev time and silently falls back to a system font when that fails, so a
// flaky network or a blocked build host changed the site's typography.
// next/font/local reads the files from the repo instead: same preload,
// font-display and size-adjusted fallback, no network.
//
// Geist and Geist Mono are variable fonts: one file per family covers every
// weight. The design caps display type at 600 (docs/design.md).

export const geist = localFont({
  src: "../app/fonts/geist-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist",
});

export const geistMono = localFont({
  src: "../app/fonts/geist-mono-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-geist-mono",
});

export const righteous = localFont({
  src: "../app/fonts/righteous-latin-400-normal.woff2",
  weight: "400",
  display: "swap",
});
