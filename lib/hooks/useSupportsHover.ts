import { useEffect, useState } from "react";

/**
 * True only on devices with a real mouse (fine pointer + genuine hover capability).
 * Touch taps land as hover-then-click on the underlying canvas library, which without this
 * check leaves nodes stuck showing a "hovered" dim/highlight state after a tap instead of just
 * performing the tap's click action — so hover-driven UI should be skipped entirely on touch.
 */
export function useSupportsHover(): boolean {
  const [supportsHover, setSupportsHover] = useState(true);

  useEffect(() => {
    const mql = window.matchMedia("(hover: hover) and (pointer: fine)");
    setSupportsHover(mql.matches);
    const listener = (e: MediaQueryListEvent) => setSupportsHover(e.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, []);

  return supportsHover;
}
