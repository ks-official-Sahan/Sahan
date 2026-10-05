import { escapeHtml, safeUrl } from "./guards";

// One plain, table-free layout for every email. Inline styles only (mail clients
// drop <style>), system fonts, neutral colours. Each field is escaped here, so a
// template passes raw text in and never builds HTML by hand.

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

export interface EmailContent {
  preheader: string;
  heading: string;
  /** Plain paragraphs. Line breaks inside one are kept. */
  paragraphs: readonly string[];
  /** Label and value rows, for example device and time of a new sign-in. */
  details?: ReadonlyArray<readonly [label: string, value: string]>;
  button?: { label: string; url: string };
  /** A smaller second link under the button, for example "Sign in later". */
  secondaryLink?: { label: string; url: string; note?: string };
  footnote?: string;
}

export interface RenderOptions {
  /** Shown above the heading and as the text signature. */
  brand: string;
  /**
   * A copy for someone other than the recipient (CC): every link is left out
   * and a note says so, because a link in an account email is for its
   * recipient alone (whoever holds an invite or reset link owns the account).
   */
  copy?: boolean;
}

export const COPY_NOTE =
  "This is a copy for your records. The links in the original were left out: only its recipient can use them.";

/** Collapses whitespace and line breaks and cuts to a length, for subjects and names. */
export function oneLine(value: string, max = 80): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

const paragraphHtml = (value: string) => escapeHtml(value).replace(/\r\n|\r|\n/g, "<br>");

export function renderEmail(subjectInput: string, content: EmailContent, options: RenderOptions): Rendered {
  const { brand, copy = false } = options;
  const subject = copy ? oneLine(`Copy: ${subjectInput}`, 200) : subjectInput;
  const font = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const button = !copy && content.button ? { label: content.button.label, url: safeUrl(content.button.url) } : null;
  const secondary =
    !copy && content.secondaryLink ? { ...content.secondaryLink, url: safeUrl(content.secondaryLink.url) } : null;
  const paragraphs = copy ? [COPY_NOTE, ...content.paragraphs] : content.paragraphs;

  const html = [
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>`,
    `<body style="margin:0;padding:0;background:#f4f4f5;${font};color:#18181b">`,
    `<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(copy ? `Copy: ${content.preheader}` : content.preheader)}</span>`,
    `<div style="max-width:560px;margin:0 auto;padding:24px 16px">`,
    `<div style="background:#ffffff;border:1px solid #e4e4e7;border-radius:8px;padding:28px">`,
    `<p style="margin:0 0 16px;font-size:13px;color:#71717a">${escapeHtml(brand)}</p>`,
    `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${escapeHtml(content.heading)}</h1>`,
    ...paragraphs.map(
      (paragraph) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55">${paragraphHtml(paragraph)}</p>`
    ),
    content.details?.length
      ? `<table role="presentation" style="border-collapse:collapse;margin:0 0 16px;font-size:14px">${content.details
          .map(
            ([label, value]) =>
              `<tr><td style="padding:3px 16px 3px 0;color:#71717a">${escapeHtml(label)}</td><td style="padding:3px 0">${escapeHtml(value)}</td></tr>`
          )
          .join("")}</table>`
      : "",
    button
      ? `<p style="margin:20px 0"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:15px">${escapeHtml(button.label)}</a></p><p style="margin:0 0 14px;font-size:12px;color:#71717a;word-break:break-all">${escapeHtml(button.url)}</p>`
      : "",
    secondary
      ? `<p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:#3f3f46">${escapeHtml(secondary.label)}: <a href="${escapeHtml(secondary.url)}" style="color:#18181b;word-break:break-all">${escapeHtml(secondary.url)}</a>${secondary.note ? `<br><span style="color:#71717a">${escapeHtml(secondary.note)}</span>` : ""}</p>`
      : "",
    content.footnote
      ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#71717a">${paragraphHtml(content.footnote)}</p>`
      : "",
    `</div></div></body></html>`,
  ].join("");

  const text = [
    content.heading,
    "",
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
    ...(content.details?.length ? [...content.details.map(([label, value]) => `${label}: ${value}`), ""] : []),
    ...(button ? [`${button.label}: ${button.url}`, ""] : []),
    ...(secondary ? [`${secondary.label}: ${secondary.url}`, ...(secondary.note ? [secondary.note] : []), ""] : []),
    ...(content.footnote ? [content.footnote, ""] : []),
    `-- ${brand}`,
  ].join("\n");

  return { subject, html, text };
}
