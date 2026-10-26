import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The large title a tab's screen opens on, as on an iPhone: a small line over
 * it ("3 unread", "JSS 3 Gold"), an action on the right, and anything that
 * belongs under it (chips, a switch). The app shell leaves the screen's name
 * out of its header until this has scrolled away (`LARGE_TITLE` there).
 * Styles are in `screen.css`, which the shell loads.
 */
export function ScreenTitle({
  title,
  eyebrow,
  eyebrowClassName,
  action,
  children,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  eyebrowClassName?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className="screen-title">
        <div>
          {eyebrow && <p className={cn("screen-title-eyebrow", eyebrowClassName)}>{eyebrow}</p>}
          <h1>{title}</h1>
        </div>
        {action}
      </div>
      {children && <div className="screen-title-below">{children}</div>}
    </div>
  );
}
