import { oneLine, renderEmail, type Rendered } from "./layout";

/**
 * The email that carries a sign-in link. The link only opens the sign-in page.
 * A copy for another inbox leaves the link out.
 */
export function signInLinkMessage(input: {
  brand: string;
  name?: string | null;
  url: string;
  /** Already formatted, for example "27 Oct 2026, 12:00 UTC". */
  validUntil: string;
  copy?: boolean;
}): Rendered {
  const name = input.name?.trim() ? oneLine(input.name) : "there";
  return renderEmail(
    `Your sign-in link for the ${oneLine(input.brand, 80)} admin`,
    {
      preheader: "Opens the sign-in page. Your password is still needed.",
      heading: "Your sign-in link",
      paragraphs: [
        `Hi ${name}, use this link to open the sign-in page on a new device or browser.`,
        "It does not sign you in. Your password is still needed, and a second factor when you have one turned on.",
        `The link works until ${oneLine(input.validUntil, 80)}.`,
      ],
      button: { label: "Open the sign-in page", url: input.url },
      footnote: "If you did not ask for this, you can ignore this email.",
    },
    { brand: input.brand, copy: input.copy },
  );
}
