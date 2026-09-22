import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HomeContainer } from "@/components/home/HomeSection";
import FinalCta from "@/components/home/FinalCta";
import { SiteMetadata } from "@/config/site";
import { getPageContent } from "@/lib/cms/loaders";
import { getPosts, getPostBySlug } from "@/lib/blog/queries";

// One full post per published slug (docs/plan/admin-cms-adr.md, Step 12).
// 300s revalidate matches /updates, so a newly published or scheduled post's
// page appears within the same window.
export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};

  const url = post.canonicalUrl || `${SiteMetadata.siteUrl}/updates/${post.slug}`;
  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt || post.contentText.slice(0, 160);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: SiteMetadata.ogSiteName,
      url,
      title,
      description,
      ...(post.coverUrl ? { images: [{ url: post.coverUrl, alt: post.coverAlt || title }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      creator: SiteMetadata.twitterUsername,
      title,
      description,
    },
  };
}

export default async function UpdatePostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [post, home] = await Promise.all([getPostBySlug(slug), getPageContent("home")]);
  if (!post) notFound();

  return (
    <div className="w-full overflow-hidden font-medium">
      <article aria-labelledby="post-title" className="w-full pb-16 pt-[clamp(6.5rem,12vw,9rem)]">
        <HomeContainer>
          <div className="mx-auto max-w-[72ch]">
            <div className="flex flex-wrap items-center gap-3 text-sm opacity-70">
              <span className="rounded-full bg-bICON_FADE px-3 py-1 text-xs font-semibold text-bICON">
                {post.topic}
              </span>
              {post.date ? <span>{post.date}</span> : null}
              <span>· {post.readMinutes} min read</span>
            </div>

            <h1
              id="post-title"
              className="mt-4 text-balance text-[length:clamp(2rem,1.1rem+3.6vw,3.25rem)] font-semibold leading-[1.08] tracking-[-0.02em]"
            >
              {post.title}
            </h1>

            {post.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary or LOCAL asset, not build-time optimized here
              <img
                src={post.coverUrl}
                alt={post.coverAlt || ""}
                className="mt-8 w-full rounded-[20px] border border-bBORDERFADE object-cover"
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
          </div>
        </HomeContainer>
      </article>

      <FinalCta content={home.finalCta} channels={home.channels} />
    </div>
  );
}
