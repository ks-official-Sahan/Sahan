import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { HomeContainer } from "@/components/home/HomeSection";
import FinalCta from "@/components/home/FinalCta";
import { SiteMetadata } from "@/config/site";
import { getPageContent } from "@/lib/cms/loaders";
import { getPosts, getPostBySlug, relatedPosts, type BlogPostView } from "@/lib/blog/queries";
import { RSS_ALTERNATES } from "@/lib/metadata";
import { jsonLdHtml } from "@/lib/seo/json-ld";

// One full post per published slug (docs/plan/admin-cms-adr.md, Step 12).
// 300s revalidate matches /updates, so a newly published or scheduled post's
// page appears within the same window.
export const revalidate = 300;
export const dynamicParams = true;

/** An edit counts as an update worth showing only when it lands a day or more after publishing. */
const UPDATE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

const dayFormat = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric" });

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

function postUrl(post: BlogPostView): string {
  return `${SiteMetadata.siteUrl}/updates/${post.slug}`;
}

function wasUpdated(post: BlogPostView): boolean {
  if (!post.publishedAt || !post.updatedAt) return false;
  return new Date(post.updatedAt).getTime() - new Date(post.publishedAt).getTime() >= UPDATE_THRESHOLD_MS;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};

  const url = post.canonicalUrl || postUrl(post);
  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt || post.contentText.slice(0, 160);
  const author = post.authorName || SiteMetadata.author;

  return {
    title,
    description,
    authors: [{ name: author, url: SiteMetadata.siteUrl }],
    keywords: post.tags,
    alternates: { canonical: url, types: RSS_ALTERNATES },
    openGraph: {
      type: "article",
      siteName: SiteMetadata.ogSiteName,
      url,
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
function postJsonLd(post: BlogPostView) {
  const url = postUrl(post);
  const author = post.authorName || SiteMetadata.author;
  return [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      headline: post.title,
      description: post.seoDescription || post.excerpt,
      url,
      ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
      ...(post.updatedAt || post.publishedAt ? { dateModified: post.updatedAt || post.publishedAt } : {}),
      author: { "@type": "Person", name: author, url: SiteMetadata.siteUrl },
      publisher: { "@type": "Person", name: SiteMetadata.author, url: SiteMetadata.siteUrl },
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
        { "@type": "ListItem", position: 1, name: "Home", item: SiteMetadata.siteUrl },
        { "@type": "ListItem", position: 2, name: "Updates", item: `${SiteMetadata.siteUrl}/updates` },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  ];
}

export default async function UpdatePostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, posts, home] = await Promise.all([getPostBySlug(slug), getPosts(), getPageContent("home")]);
  if (!post) notFound();

  const related = relatedPosts(post, posts);
  const author = post.authorName || SiteMetadata.author;

  return (
    <div className="w-full overflow-hidden font-medium">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(postJsonLd(post)) }} />
      <article aria-labelledby="post-title" className="w-full pb-16 pt-[clamp(6.5rem,12vw,9rem)]">
        <HomeContainer>
          <div className="mx-auto max-w-[72ch]">
            <nav aria-label="Breadcrumb" className="text-sm opacity-70">
              <ol className="flex flex-wrap items-center gap-1.5">
                <li>
                  <Link href="/" className="hover:underline">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link href="/updates" className="hover:underline">
                    Updates
                  </Link>
                </li>
              </ol>
            </nav>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm opacity-70">
              <span className="rounded-full bg-bICON_FADE px-3 py-1 text-xs font-semibold text-bICON">
                {post.topic}
              </span>
              <span>{post.readMinutes} min read</span>
            </div>

            <h1
              id="post-title"
              className="mt-4 text-balance text-[length:clamp(2rem,1.1rem+3.6vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.02em]"
            >
              {post.title}
            </h1>

            <p className="mt-4 text-sm opacity-70">
              By <span className="font-semibold">{author}</span>
              {post.publishedAt ? (
                <>
                  {" · "}
                  <time dateTime={post.publishedAt}>{dayFormat.format(new Date(post.publishedAt))}</time>
                </>
              ) : post.date ? (
                <> · {post.date}</>
              ) : null}
              {wasUpdated(post) ? (
                <>
                  {" · Updated "}
                  <time dateTime={post.updatedAt!}>{dayFormat.format(new Date(post.updatedAt!))}</time>
                </>
              ) : null}
            </p>

            {post.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary or LOCAL asset, not build-time optimized here
              <img
                src={post.coverUrl}
                alt={post.coverAlt || ""}
                width={post.coverWidth}
                height={post.coverHeight}
                // The cover is this page's largest paint: fetch it first, never lazily.
                fetchPriority="high"
                decoding="async"
                className="mt-8 h-auto w-full rounded-[20px] border border-bBORDERFADE object-cover"
              />
            ) : null}

            <div
              className="prose prose-invert mt-8 max-w-none text-[15px] leading-relaxed s768:text-base"
              // contentHtml is sanitized on save and again by getPostBySlug()
              // before it ever reaches this component (lib/cms/rich-text.ts).
              dangerouslySetInnerHTML={{ __html: post.contentHtml }}
            />

            {post.tags.length > 0 ? (
              <ul className="mt-8 flex flex-wrap gap-2" aria-label="Tags">
                {post.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border border-bBORDERFADE bg-bCHIP px-3 py-1 text-xs font-medium"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            ) : null}

            {related.length > 0 ? (
              <section aria-labelledby="related-title" className="mt-14 border-t border-bBORDERFADE pt-8">
                <h2 id="related-title" className="text-lg font-semibold">
                  Related updates
                </h2>
                <ul className="mt-4 space-y-4">
                  {related.map((item) => (
                    <li key={item.slug}>
                      <Link href={`/updates/${item.slug}`} className="group block">
                        <span className="font-semibold group-hover:underline">{item.title}</span>
                        <span className="mt-1 block text-sm opacity-70">{item.excerpt}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </HomeContainer>
      </article>

      <FinalCta content={home.finalCta} channels={home.channels} />
    </div>
  );
}
