import type { PageContent } from "@/lib/cms/registry";
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
      dangerouslySetInnerHTML={{
        // Escape "<" so content can never close the script tag early.
        __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
};

export default FaqJsonLd;
