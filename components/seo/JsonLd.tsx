import { Site, SiteMetadata } from "@/config/site";

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: SiteMetadata.legalName,
  url: SiteMetadata.siteUrl,
  jobTitle: Site.myRole,
  description: SiteMetadata.description,
  worksFor: {
    "@type": "Organization",
    name: Site.org,
    url: Site.orgUrl,
  },
  address: {
    "@type": "PostalAddress",
    addressCountry: "LK",
  },
  sameAs: [
    "https://github.com/ks-official-Sahan",
    "https://www.linkedin.com/in/sahan-sachintha",
    "https://x.com/SahanSubasingha",
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SiteMetadata.ogSiteName,
  url: SiteMetadata.siteUrl,
  author: {
    "@type": "Person",
    name: SiteMetadata.legalName,
  },
};

const JsonLd = () => {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
    </>
  );
};

export default JsonLd;
