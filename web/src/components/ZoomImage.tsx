"use client";

import { useCallback, useEffect, useState } from "react";

interface Props {
  src: string;
  /** larger source for the zoomed view; defaults to src */
  fullSrc?: string;
  alt: string;
  className?: string;
}

/** An image that opens in a dimmed, animated lightbox. Click or press Escape to close. */
export function ZoomImage({ src, fullSrc, alt, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false); // drives the enter animation one frame after mount
  const [fit, setFit] = useState(true);

  const close = useCallback(() => {
    setShown(false);
    setTimeout(() => setOpen(false), 220);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFit(true);
          setOpen(true);
        }}
        className={`block w-full cursor-zoom-in ${className}`}
        title="Click to zoom"
        aria-label={`Zoom: ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="block w-full" draggable={false} />
      </button>

      {open && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm transition-opacity duration-200 ease-out ${shown ? "opacity-100" : "opacity-0"} ${fit ? "cursor-zoom-out" : "cursor-zoom-out overflow-auto"}`}
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
        >
          <div
            className={`transition-transform duration-200 ease-out ${shown ? "scale-100" : "scale-95"} ${fit ? "flex h-full w-full items-center justify-center p-6" : "p-6"}`}
            onClick={(e) => {
              // click on the picture toggles fit / 100%; click on the dim area closes
              e.stopPropagation();
              setFit((f) => !f);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fullSrc ?? src}
              alt={alt}
              draggable={false}
              className={fit ? "max-h-full max-w-full rounded-xl shadow-2xl cursor-zoom-in" : "max-w-none rounded-xl shadow-2xl cursor-zoom-out"}
              style={fit ? undefined : { width: "max(100vw, 1800px)" }}
            />
          </div>
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
            aria-label="Close"
          >
            Close
          </button>
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60">Click the picture to zoom in, click outside or press Esc to close</div>
        </div>
      )}
    </>
  );
}
