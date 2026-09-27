import { HomeContainer } from "@/components/home/HomeSection";
import SkeletonBlock from "@/components/common/SkeletonBlock";

// Content-shaped placeholder for /about, matching AboutHero's banner + centered
// portrait + name + role pills + description so the real content doesn't
// jump the page around when it swaps in. Lightweight server component — no
// state, no client JS.
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="w-full overflow-hidden">
      <section className="w-full pb-[clamp(3rem,6vw,5rem)] pt-[clamp(6.5rem,11vw,8.5rem)]">
        <HomeContainer>
          <SkeletonBlock className="mb-[clamp(4.5rem,9vw,6.5rem)] h-[clamp(170px,24vw,280px)] w-full rounded-[28px]" />

          <div className="flex flex-col items-center gap-5">
            <SkeletonBlock className="h-[clamp(2rem,1.2rem+3.6vw,3.75rem)] w-[min(420px,70%)]" />
            <SkeletonBlock className="h-4 w-24 rounded-full" />
            <div className="flex flex-wrap justify-center gap-2">
              <SkeletonBlock className="h-8 w-36 rounded-full" />
              <SkeletonBlock className="h-8 w-44 rounded-full" />
            </div>
            <SkeletonBlock className="h-[4.5em] w-full max-w-[58ch]" />
            <SkeletonBlock className="h-4 w-40 rounded-full" />
            <div className="flex w-full flex-col items-stretch gap-3 s480:w-auto s480:flex-row">
              <SkeletonBlock className="h-12 w-full rounded-full s480:w-40" />
              <SkeletonBlock className="h-12 w-full rounded-full s480:w-40" />
            </div>
          </div>
        </HomeContainer>
      </section>

      <section className="w-full pt-[clamp(4rem,8vw,7rem)]">
        <HomeContainer>
          <div className="grid grid-cols-1 gap-4 s640:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-48 w-full rounded-[24px]" />
            ))}
          </div>
        </HomeContainer>
      </section>
    </div>
  );
}
