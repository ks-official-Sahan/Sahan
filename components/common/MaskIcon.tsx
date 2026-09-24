import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/**
 * A monochrome SVG file painted in the current text colour through a CSS
 * mask, so it follows the theme like an inline `fill-current` icon while the
 * file itself is downloaded once and cached (instead of the SVG markup being
 * repeated in every page's HTML, RSC payload and client bundle). Decorative:
 * the surrounding label names the thing.
 */
export default function MaskIcon({ src, size, className }: { src: string; size?: number; className?: string }) {
  const mask = `url("${src}")`;
  const style: CSSProperties = {
    width: size,
    height: size,
    maskImage: mask,
    WebkitMaskImage: mask,
    maskSize: "contain",
    WebkitMaskSize: "contain",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
  };
  return <span aria-hidden="true" className={cn("inline-block shrink-0 bg-current", className)} style={style} />;
}
