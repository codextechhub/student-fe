import { useState } from "react";

import { cn } from "@/lib/utils";

/** A pupil's photo, or their initials on the brand colour where there is none or it fails to load. */
export function PupilAvatar({
  name,
  photo,
  size = 32,
  className,
}: {
  name: string;
  photo?: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  const style = { width: size, height: size };

  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt=""
        style={style}
        onError={() => setFailed(true)}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...style, fontSize: Math.round(size * 0.38) }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}
