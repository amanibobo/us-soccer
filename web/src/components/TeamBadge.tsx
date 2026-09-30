"use client";

import { useState } from "react";
import { teamLogo } from "@/config/matches";

interface Props {
  teamId: number;
  name: string;
  acronym?: string;
  color: string;
  size?: number;
  className?: string;
}

/** Club crest when we have one, otherwise a monogram in the kit color. */
export function TeamBadge({ teamId, name, acronym, color, size = 28, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const src = teamLogo(teamId);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        title={name}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={`shrink-0 object-contain ${className}`}
        style={{ width: size, height: size }}
        draggable={false}
      />
    );
  }
  const dark = luminance(color) < 0.45;
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight ring-1 ring-black/10 ${className}`}
      style={{ width: size, height: size, background: color, color: dark ? "#fff" : "#1c1c1a", fontSize: Math.max(9, size * 0.34) }}
    >
      {(acronym ?? name.slice(0, 3)).toUpperCase()}
    </span>
  );
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length < 6) return 0.5;
  return (0.2126 * parseInt(h.slice(0, 2), 16) + 0.7152 * parseInt(h.slice(2, 4), 16) + 0.0722 * parseInt(h.slice(4, 6), 16)) / 255;
}
