export interface FAQAnswer {
  intro: string;
  points?: string[];
  outro?: string;
}

export interface FAQItem {
  icon: string;
  question: string;
  answer: FAQAnswer;
}
