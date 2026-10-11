"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// Sends one page view per route change to /api/collect: the path, and the
// external referrer on the first view only (client-side navigations keep the
// landing page's document.referrer). No cookie, no storage, no third party.
// Nothing is sent when the browser asks not to be tracked, or in automation.

function trackingAllowed(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return !nav.webdriver && nav.doNotTrack !== "1" && nav.globalPrivacyControl !== true;
}

export default function PageViewBeacon() {
  const pathname = usePathname();
  const first = useRef(true);
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === last.current || pathname.startsWith("/preview") || !trackingAllowed()) return;
    last.current = pathname;
    const body = JSON.stringify({ p: pathname, r: first.current ? document.referrer : undefined });
    first.current = false;
    fetch("/api/collect", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true, credentials: "omit" }).catch(() => {});
  }, [pathname]);

  return null;
}
