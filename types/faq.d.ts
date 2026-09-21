export interface FAQAnswer {
  intro: string;
  points?: string[];
  outro?: string;
}

export interface FAQItem {
  id: number;
  icon: string;
  question: string;
  answer: FAQAnswer;
}
