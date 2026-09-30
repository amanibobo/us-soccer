"use client";

import { useEffect } from "react";
import { usePlayback } from "@/store/playback";
import { secondsToFrames } from "@/lib/clock";

export interface KeyHandlers {
  onClipStart?: () => void;
  onClipEnd?: () => void;
  onNextChance?: () => void;
  onPrevChance?: () => void;
  onHelp?: () => void;
  onEscape?: () => void;
}

/** YouTube-style shortcuts. Ignored while typing in a field. */
export function useKeyboard(h: KeyHandlers) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const s = usePlayback.getState();
      const meta = s.match?.meta;
      if (!meta) return;
      const five = secondsToFrames(meta, 5);
      const ten = secondsToFrames(meta, 10);
      switch (e.key) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          s.toggle();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) h.onPrevChance?.();
          else s.seekBy(-five);
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) h.onNextChance?.();
          else s.seekBy(five);
          break;
        case "j":
        case "J":
          s.seekBy(-ten);
          break;
        case "l":
        case "L":
          s.seekBy(ten);
          break;
        case ",":
          s.pause();
          s.seekBy(-1);
          break;
        case ".":
          s.pause();
          s.seekBy(1);
          break;
        case "i":
        case "I":
          h.onClipStart?.();
          break;
        case "o":
        case "O":
          h.onClipEnd?.();
          break;
        case "?":
          h.onHelp?.();
          break;
        case "Escape":
          h.onEscape?.();
          break;
        case "Home":
          s.seek(0);
          break;
        case "End":
          s.seek(meta.n_frames - 1);
          break;
        default:
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [h]);
}
