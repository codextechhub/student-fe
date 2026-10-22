import { useEffect, useState } from "react";

/** How much shorter than the window the visible area must be to count as a keyboard being open, in px. */
const KEYBOARD_PX = 120;

/** The part of the screen the pupil can see: where it starts and how tall it is. */
export type ViewportBox = { top: number; height: number; keyboard: boolean };

function measure(): ViewportBox | null {
  const view = window.visualViewport;
  if (!view) return null;
  return {
    top: Math.round(view.offsetTop),
    height: Math.round(view.height),
    keyboard: window.innerHeight - view.height > KEYBOARD_PX,
  };
}

/**
 * The visible area of the screen while `active`, or null when it is not needed
 * or the browser cannot say.
 *
 * `100dvh` follows the browser's toolbars but not the on-screen keyboard on
 * every phone: iOS leaves the layout viewport as it was and slides it under the
 * keyboard. `window.visualViewport` reports what is actually in view, so a
 * screen sized from it keeps its bottom edge (a message box) above the
 * keyboard. Null leaves the caller on its `100dvh` fallback.
 */
export function useVisualViewportBox(active: boolean): ViewportBox | null {
  const [box, setBox] = useState<ViewportBox | null>(null);
  useEffect(() => {
    const view = window.visualViewport;
    if (!active || !view) return;
    const update = () =>
      setBox((held) => {
        const next = measure();
        return held && next && held.top === next.top && held.height === next.height && held.keyboard === next.keyboard ? held : next;
      });
    update();
    view.addEventListener("resize", update);
    view.addEventListener("scroll", update);
    return () => {
      view.removeEventListener("resize", update);
      view.removeEventListener("scroll", update);
    };
  }, [active]);
  return active ? box : null;
}
