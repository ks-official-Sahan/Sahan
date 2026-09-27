import { ImageResponse } from "next/og";

import { PageMetadata, SiteMetadata } from "@/config/site";

// Static per-segment social card, no dynamic data — same design language as
// the root app/opengraph-image.tsx, swapped to this page's own title and
// description (config/site.ts's PageMetadata.works). Fully static: no
// params, no fetch, so it is prerendered once and cached like any other
// static asset.
export const alt = PageMetadata.works.description;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "80px",
          backgroundColor: "#0a0a0a",
          backgroundImage: "radial-gradient(circle at 25% 15%, rgba(145,255,0,0.18), transparent 45%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 32,
            color: "#91FF00",
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            display: "flex",
          }}
        >
          {SiteMetadata.legalName}
        </div>
        <div
          style={{
            fontSize: 68,
            color: "#ffffff",
            fontWeight: 800,
            marginTop: 24,
            lineHeight: 1.15,
            display: "flex",
          }}
        >
          {PageMetadata.works.title}
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#a0a0a0",
            marginTop: 28,
            display: "flex",
            maxWidth: "85%",
          }}
        >
          {PageMetadata.works.description}
        </div>
        <div
          style={{
            fontSize: 26,
            color: "#91FF00",
            marginTop: 60,
            display: "flex",
          }}
        >
          {SiteMetadata.siteUrl.replace("https://", "")}/works
        </div>
      </div>
    ),
    { ...size }
  );
}
