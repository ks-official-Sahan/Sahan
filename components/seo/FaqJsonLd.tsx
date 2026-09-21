import { HomeContent } from "@/contents/home";
import type { FAQAnswer } from "@/types/faq";

const answerToText = ({ intro, points, outro }: FAQAnswer) =>
  [intro, points?.join("; "), outro].filter(Boolean).join(" ");

const FaqJsonLd = () => {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HomeContent.faq.questions.map((item) => ({
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
