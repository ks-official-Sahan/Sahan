import { HomeContainer } from "@/components/home/HomeSection";
import SkeletonBlock from "@/components/common/SkeletonBlock";

// Content-shaped placeholder for /works: status pill + headline + subtitle
// (matches every HeroBackdrop page), a stats row, then a project-card grid
// shaped like WorksExplorer's real grid. Lightweight server component.
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="w-full overflow-hidden">
      <section className="w-full pb-[clamp(2.5rem,5vw,4rem)] pt-[clamp(6.5rem,12vw,9rem)]">
        <HomeContainer>
          <div className="flex flex-col items-start gap-6">
            <SkeletonBlock className="h-9 w-52 rounded-full" />
            <SkeletonBlock className="h-[clamp(2.25rem,1.1rem+4.6vw,5rem)] w-[min(560px,80%)]" />
            <SkeletonBlock className="h-[3.5em] w-full max-w-[52ch]" />
          </div>
        </HomeContainer>
      </section>

      <section className="w-full pt-[clamp(2rem,4vw,3rem)]">
        <HomeContainer>
          <div className="mb-8 flex flex-wrap gap-3">
            <SkeletonBlock className="h-9 w-24 rounded-full" />
            <SkeletonBlock className="h-9 w-32 rounded-full" />
            <SkeletonBlock className="h-9 w-28 rounded-full" />
          </div>
          <div className="grid grid-cols-1 gap-5 s640:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-64 w-full rounded-[24px]" />
            ))}
          </div>
        </HomeContainer>
      </section>
    </div>
  );
}
