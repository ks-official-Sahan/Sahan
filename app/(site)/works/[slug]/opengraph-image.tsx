import { ImageResponse } from "next/og";

import { Projects } from "@/contents/projects";
import { SiteMetadata } from "@/config/site";
import { getProjects } from "@/lib/collections";
import { siteUrl } from "@/lib/site-url";

export const alt = "Project";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams(): Array<{ slug: string }> {
  return Projects.map((project) => ({ slug: project.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [projects, origin] = await Promise.all([getProjects(Projects), siteUrl()]);
  const project = projects.find((item) => item.slug === slug);
  const host = origin.replace("https://", "");

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
            fontSize: 28,
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
            fontSize: 64,
            color: "#ffffff",
            fontWeight: 800,
            marginTop: 24,
            lineHeight: 1.1,
            display: "flex",
            maxWidth: "90%",
          }}
        >
          {project?.title ?? "Project"}
        </div>
        <div
          style={{
            fontSize: 32,
            color: "#d0d0d0",
            marginTop: 28,
            display: "flex",
            maxWidth: "85%",
          }}
        >
          {project?.tagline ?? ""}
        </div>
        <div
          style={{
            fontSize: 26,
            color: "#91FF00",
            marginTop: 48,
            display: "flex",
          }}
        >
          {host}/works/{slug}
        </div>
      </div>
    ),
    { ...size }
  );
}
