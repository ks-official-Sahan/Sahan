import { PageMetadata } from "@/config/site";
import { pageMetadata } from "@/lib/metadata";
import PageLoader from "@/components/common/PageLoader";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = pageMetadata("/works", PageMetadata.works);

export default function WorksLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense fallback={<PageLoader />}>
      <div>{children}</div>
    </Suspense>
  );
}
