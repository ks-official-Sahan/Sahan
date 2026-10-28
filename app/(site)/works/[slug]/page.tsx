import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import ProjectPreview, { linkLabels, platformLabels, StatusBadge } from "@/components/works/ProjectPreview";
import { Projects, teamOf } from "@/contents/projects";
import { Site, SiteMetadata } from "@/config/site";
import { getProjects } from "@/lib/collections";
import { pageMetadata } from "@/lib/metadata";
import { jsonLdHtml } from "@/lib/seo/json-ld";
import { siteUrl } from "@/lib/site-url";
import type { Project } from "@/types/project";

export const dynamicParams = true;

export function generateStaticParams(): Array<{ slug: string }> {
  return Projects.map((project) => ({ slug: project.slug }));
}

async function projectBySlug(slug: string): Promise<Project | undefined> {
  const projects = await getProjects(Projects);
  return projects.find((project) => project.slug === slug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await projectBySlug(slug);
  if (!project) return {};
  return pageMetadata(`/works/${project.slug}`, {
    title: `${project.title}: ${project.tagline}`,
    description: project.description,
  });
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [project, origin] = await Promise.all([projectBySlug(slug), siteUrl()]);
  if (!project) notFound();

  const url = `${origin}/works/${project.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    headline: project.tagline,
    description: project.description,
    url,
    dateCreated: project.year,
    image: project.image ? `${origin}${project.image.src}` : undefined,
    author: {
      "@type": "Person",
      name: SiteMetadata.legalName,
      url: origin,
      jobTitle: Site.myRole,
    },
    ...(project.organization
      ? { publisher: { "@type": "Organization", name: project.organization, url: project.organizationUrl } }
      : {}),
  };

  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-16 font-medium s640:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
      <p className="text-sm">
        <Link href="/works" className="hover:underline">
          Works
        </Link>
      </p>
      <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.03em]">{project.title}</h1>
      <p className="mt-3 text-lg opacity-80">{project.tagline}</p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <StatusBadge status={project.status} />
        <span className="text-sm opacity-70">
          {teamOf(project)} · {project.year}
        </span>
      </div>

      <ProjectPreview project={project} priority className="mt-8 rounded-[20px] border border-bBORDERFADE" sizes="(min-width: 768px) 768px, 100vw" />

      <p className="mt-8 text-base leading-relaxed">
        {SiteMetadata.legalName}, a {Site.myRole.toLowerCase()} at {Site.org}, {project.status === "upcoming" ? "is building" : "built"} {project.title} in {project.year} as {project.role}
        {project.organization ? ` at ${teamOf(project)}` : ""}. He works remotely from Sri Lanka. This page is the project itself, separate from the catalog.
      </p>
      <p className="mt-4 text-base leading-relaxed opacity-80">{project.description}</p>

      {project.platforms && project.platforms.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">Platforms</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {project.platforms.map((platform) => (
              <li key={platform} className="rounded-full border border-bBORDERFADE bg-bCHIP px-3 py-1 text-sm">
                {platformLabels[platform]}
              </li>
            ))}
          </ul>
        </section>
      )}

      {project.links && project.links.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide opacity-70">Open it</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {project.links.map((item) => (
              <li key={item.url}>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {item.label || linkLabels[item.kind]}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-sm">
        <Link href="/works" className="hover:underline">
          All projects
        </Link>
      </p>
    </article>
  );
}
