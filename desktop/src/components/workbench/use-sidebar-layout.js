import { useCallback, useState } from "react";

const sidebarSizing = {
  leftDefault: 248,
  leftMin: 220,
  leftMax: 420,
  rightDefault: 248,
  rightMin: 220,
  rightMax: 420,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Owns Workbench sidebar widths and pointer-based resize behavior. */
export function useSidebarLayout() {
  const [leftWidth, setLeftWidth] = useState(sidebarSizing.leftDefault);
  const [rightWidth, setRightWidth] = useState(sidebarSizing.rightDefault);

  const beginSidebarResize = useCallback((side, event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = side === "left" ? leftWidth : rightWidth;
    const min = side === "left" ? sidebarSizing.leftMin : sidebarSizing.rightMin;
    const max = side === "left" ? sidebarSizing.leftMax : sidebarSizing.rightMax;
    const move = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth = side === "left" ? startWidth + delta : startWidth - delta;
      const next = clamp(nextWidth, min, max);
      if (side === "left") setLeftWidth(next);
      else setRightWidth(next);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      document.body.classList.remove("isResizingSidebar");
    };
    document.body.classList.add("isResizingSidebar");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  }, [leftWidth, rightWidth]);

  return { beginSidebarResize, leftWidth, rightWidth };
}
