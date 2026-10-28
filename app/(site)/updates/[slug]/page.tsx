import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import FinalCta from "@/components/home/FinalCta";
import PostArticle from "@/components/updates/PostArticle";
import { SiteMetadata } from "@/config/site";
import { getPageContent } from "@/lib/cms/loaders";
import { getRecentPosts, getPostBySlug, postStaticParams, getPostRedirect, relatedPosts, type BlogPostView } from "@/lib/blog/queries";
import { RSS_ALTERNATES } from "@/lib/metadata";
import { documentTitle, isIndexableArticle, metaDescription } from "@/lib/seo/copy";
import { jsonLdHtml } from "@/lib/seo/json-ld";
import { siteUrl } from "@/lib/site-url";

// One full post per published slug (docs/plan/admin-cms-adr.md, Step 12).
// The post reads are cached for 300 s (lib/blog/queries.ts), the same window
// as /updates, so a newly published or scheduled post appears within it.
//
// No Suspense boundary or loading.tsx may sit above this route (the home and
// /updates skeletons live in the (home) and updates/(list) route groups for
// that reason): it would start streaming a 200 before notFound() below can
// run, so an unknown slug would answer a soft 404 instead of a real one.
// `instant = false` lets the page await its params and block instead.
export const instant = false;

// The newest 50 are prerendered at build time; any other public slug is
// rendered on its first request and cached from then on.
export const generateStaticParams = postStaticParams;

/** Path on this site. An author-set canonical on our own hosts follows the live origin. */
function canonicalPath(post: BlogPostView): string {
  const local = `/updates/${post.slug}`;
  if (!post.canonicalUrl) return local;
  try {
    const url = new URL(post.canonicalUrl);
    const own =
      url.hostname === "sahansachintha.com" ||
      url.hostname === "www.sahansachintha.com" ||
      url.hostname === "sahansachintha.vercel.app";
    return own ? url.pathname || local : post.canonicalUrl;
  } catch {
    return local;
  }
}

const STALE_COMPARISON = /gpt-4o|gemini 1\.5 pro/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};

  const origin = await siteUrl();
  const path = canonicalPath(post);
  const chosenTitle = post.seoTitle && !STALE_COMPARISON.test(post.seoTitle) ? post.seoTitle : post.title;
  const title = documentTitle(chosenTitle);
  const description = metaDescription(post.seoDescription || post.excerpt || post.contentText);
  const author = post.authorName || SiteMetadata.author;
  const thin = !isIndexableArticle(post.contentText);

  return {
    title: { absolute: title },
    description,
    authors: [{ name: author, url: origin }],
    keywords: post.tags,
    alternates: { canonical: path, types: RSS_ALTERNATES },
    // Short notes stay on the site and in the feed. They are not articles.
    ...(post.noindex || thin ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: "article",
      siteName: SiteMetadata.ogSiteName,
      url: path,
      title,
      description,
      authors: [author],
      section: post.topic,
      tags: post.tags,
      ...(post.publishedAt ? { publishedTime: post.publishedAt } : {}),
      ...(post.updatedAt ? { modifiedTime: post.updatedAt } : {}),
      ...(post.coverUrl
        ? {
            images: [
              {
                url: post.coverUrl,
                alt: post.coverAlt || title,
                ...(post.coverWidth && post.coverHeight ? { width: post.coverWidth, height: post.coverHeight } : {}),
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      creator: SiteMetadata.twitterUsername,
      title,
      description,
    },
  };
}

/** BlogPosting plus its breadcrumb trail, the two entities answer engines read for an article. */
function postJsonLd(post: BlogPostView, origin: string) {
  const path = canonicalPath(post);
  const url = path.startsWith("/") ? `${origin}${path}` : path;
  const author = post.authorName || SiteMetadata.author;
  return [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      headline: post.title,
      description: metaDescription(post.seoDescription || post.excerpt || post.contentText),
      url,
      ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
      ...(post.updatedAt || post.publishedAt ? { dateModified: post.updatedAt || post.publishedAt } : {}),
      author: { "@type": "Person", name: author, url: origin },
      publisher: { "@type": "Person", name: SiteMetadata.author, url: origin },
      ...(post.coverUrl ? { image: post.coverUrl } : {}),
      articleSection: post.topic,
      keywords: post.tags.join(", "),
      wordCount: post.contentText.split(/\s+/).filter(Boolean).length,
      timeRequired: `PT${post.readMinutes}M`,
      inLanguage: "en",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: origin },
        { "@type": "ListItem", position: 2, name: "Updates", item: `${origin}/updates` },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  ];
}

export default async function UpdatePostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, posts, home, origin] = await Promise.all([getPostBySlug(slug), getRecentPosts(50), getPageContent("home"), siteUrl()]);
  if (!post) {
    // A renamed post's old slug answers with a 308 to its current one.
    const target = await getPostRedirect(slug);
    if (target) permanentRedirect(`/updates/${target}`);
    notFound();
  }

  // Candidates are the 50 newest public posts (one cached read, also used by
  // generateMetadata), so recommendations lean toward fresh content and an
  // older post is recommended only while it is among them. Deliberate: a
  // tag-matched read across every post would add a query per article.
  const related = relatedPosts(post, posts);

  return (
    <div className="w-full overflow-hidden font-medium">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(postJsonLd(post, origin)) }} />
      <PostArticle post={post} related={related} />

      <FinalCta content={home.finalCta} channels={home.channels} />
    </div>
  );
}
