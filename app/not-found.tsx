import NotFoundContent from "@/components/site/NotFoundContent";
import SiteShell from "@/components/site/SiteShell";

// Every unmatched URL lands here, inside the thin root layout, so the page wraps
// its content in SiteShell to keep the public navigation and footer. Unmatched
// URLs render through Next's internal /_not-found route, which is prerendered at
// build and answers 404 with full server-rendered HTML. A notFound() thrown while
// rendering a route is different: it falls back to a client-rendered shell, so
// the locked admin rewrites to an unmatched path instead of calling it
// (docs/plan/admin-cms-adr.md, section 4.4).
// Keep SiteShell free of Suspense boundaries and suspending awaits, or the 404
// would stream and answer 200.
export default function NotFound() {
  return (
    <SiteShell>
      <NotFoundContent />
    </SiteShell>
  );
}
