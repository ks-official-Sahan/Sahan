import type { PageContent } from "@/lib/cms/registry";
import { jsonLdHtml } from "@/lib/seo/json-ld";
import type { FAQAnswer } from "@/types/faq";

const answerToText = ({ intro, points, outro }: FAQAnswer) =>
  [intro, points?.join("; "), outro].filter(Boolean).join(" ");

interface FaqJsonLdProps {
  content: PageContent<"home">["faq"];
}

const FaqJsonLd = ({ content }: FaqJsonLdProps) => {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.questions.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answerToText(item.answer),
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqJsonLd) }}
    />
  );
};

export default FaqJsonLd;
