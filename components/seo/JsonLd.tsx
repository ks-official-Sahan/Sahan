import { Site, SiteMetadata } from "@/config/site";
import { jsonLdHtml } from "@/lib/seo/json-ld";

const JsonLd = ({ origin }: { origin?: string }) => {
  if (!origin) return null;
  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: SiteMetadata.legalName,
    alternateName: ["Sahan", SiteMetadata.githubUsername],
    url: origin,
    jobTitle: Site.myRole,
    description: SiteMetadata.description,
    disambiguatingDescription: `${Site.myRole} at ${Site.org}, working remotely from Sri Lanka. GitHub: ${SiteMetadata.githubUsername}.`,
    worksFor: {
      "@type": "Organization",
      name: Site.org,
      url: Site.orgUrl,
    },
    address: {
      "@type": "PostalAddress",
      addressCountry: "LK",
    },
    knowsAbout: ["Next.js", "React", "TypeScript", "React Native", "Node.js"],
    sameAs: [
      `https://github.com/${SiteMetadata.githubUsername}`,
      "https://www.linkedin.com/in/sahan-sachintha",
      "https://x.com/SahanSubasingha",
    ],
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SiteMetadata.ogSiteName,
    url: origin,
    description: SiteMetadata.description,
    author: {
      "@type": "Person",
      name: SiteMetadata.legalName,
      url: origin,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(personJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(websiteJsonLd) }}
      />
    </>
  );
};

export default JsonLd;
