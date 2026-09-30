"use client";

import { useState } from "react";
import photos from "@/config/players.json";

interface Photo {
  file: string;
  author: string;
  license: string;
  page: string;
}

const PHOTOS = photos as Record<string, Photo>;

export function playerPhoto(playerId: number): Photo | null {
  return PHOTOS[String(playerId)] ?? null;
}

/** One short credit line for the photos shown, e.g. "Wikimedia Commons (CC BY-SA 4.0)". */
export function photoCredits(playerIds: number[]): string | null {
  const licenses = new Set<string>();
  for (const id of playerIds) {
    const p = PHOTOS[String(id)];
    if (p?.license) licenses.add(p.license);
  }
  if (!licenses.size) return null;
  return `Wikimedia Commons (${[...licenses].join(", ")})`;
}

interface Props {
  playerId: number;
  name: string;
  color: string;
  size?: number;
  className?: string;
}

/** Headshot when we have one, otherwise initials on the kit color. */
export function PlayerAvatar({ playerId, name, color, size = 32, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const photo = playerPhoto(playerId);
  if (photo && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo.file}
        alt={name}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full bg-surface-3 object-cover ring-1 ring-black/10 ${className}`}
        style={{ width: size, height: size }}
        draggable={false}
      />
    );
  }
  const dark = luminance(color) < 0.45;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1 ring-black/10 ${className}`}
      style={{ width: size, height: size, background: color, color: dark ? "#fff" : "#1c1c1a", fontSize: Math.max(9, size * 0.36) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length < 6) return 0.5;
  return (0.2126 * parseInt(h.slice(0, 2), 16) + 0.7152 * parseInt(h.slice(2, 4), 16) + 0.0722 * parseInt(h.slice(4, 6), 16)) / 255;
}
