"use client";

import { useEffect } from "react";

/**
 * Casual-copy deterrence for artwork images, mounted once in the root layout:
 * no right-click menu on any image, no drag-out, and (with the CSS side in
 * globals.css) no iOS long-press save sheet.
 *
 * Honest scope: this stops the casual grab, nothing more. Screenshots are
 * taken by the operating system and cannot be blocked by any web page, and
 * the underlying files live on IPFS, which is public by design. Molotov's
 * real protection is the contract — ownership and the royalty — not hidden
 * pixels.
 */
export function ArtworkProtection() {
  useEffect(() => {
    const isImage = (target: EventTarget | null) =>
      target instanceof HTMLElement && target.tagName === "IMG";

    const onContextMenu = (e: MouseEvent) => {
      if (isImage(e.target)) e.preventDefault();
    };
    const onDragStart = (e: DragEvent) => {
      if (isImage(e.target)) e.preventDefault();
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart);
    };
  }, []);

  return null;
}
