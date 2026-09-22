import ContactPageView from "@/components/pages/ContactPageView";
import { getPageContent } from "@/lib/cms/loaders";

export const revalidate = 3600;

export async function generateMetadata() {
  return {
    title: "Contact",
  };
}

async function Contact() {
  const contact = await getPageContent("contact");
  const home = await getPageContent("home");

  return <ContactPageView content={contact} home={home} />;
}

export default Contact;
