import "./admin.css";

import { headers } from "next/headers";

import { ThemeProvider } from "@/components/theme/ThemeProvider";

// No DOM, no metadata, no site chrome. It forces dynamic rendering, which the
// nonce based CSP needs, and mounts the theme provider with that nonce: the
// provider writes an inline script, and the CSP of /admin allows only scripts
// that carry the nonce the proxy generated for this request
// (docs/plan/admin-cms-adr.md, sections 4.3 and 6.6).
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <ThemeProvider nonce={nonce} enableSystem attribute="class" defaultTheme="dark">
      {children}
    </ThemeProvider>
  );
}
