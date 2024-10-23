import { PageMetadata } from "@/config/site";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  ...PageMetadata.works,
};

export default function WorksLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div>{children}</div>
    </Suspense>
  );
}
